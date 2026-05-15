import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import { StructuredLogger } from "../../../src/platform/shared/observability/structured-logger.js";
import { GracefulShutdown } from "../../../src/platform/five-plane-execution/startup/graceful-shutdown.js";

class SignalBus extends EventEmitter {
  public override on(event: "SIGTERM" | "SIGINT", listener: () => void): this {
    return super.on(event, listener);
  }

  public override removeListener(event: "SIGTERM" | "SIGINT", listener: () => void): this {
    return super.removeListener(event, listener);
  }
}

test("graceful shutdown runs handlers in reverse registration order", async () => {
  const calls: string[] = [];
  const shutdown = new GracefulShutdown({
    logger: new StructuredLogger({ retentionLimit: 10 }),
  });

  shutdown.addHandler({
    name: "first",
    handler: async () => {
      calls.push("first");
    },
  });
  shutdown.addHandler({
    name: "second",
    handler: async () => {
      calls.push("second");
    },
  });

  const result = await shutdown.shutdown();

  assert.deepEqual(calls, ["second", "first"]);
  assert.equal(result.success, true);
});

test("graceful shutdown signal handling reuses the same shutdown result and sets exit code", async () => {
  const signalBus = new SignalBus();
  const exits: number[] = [];
  let runs = 0;
  const shutdown = new GracefulShutdown({
    logger: new StructuredLogger({ retentionLimit: 10 }),
    signalBus,
    registerSignalHandlers: true,
    exitHandler: (code) => {
      exits.push(code);
    },
  });
  shutdown.addHandler({
    name: "cleanup",
    handler: async () => {
      runs += 1;
    },
  });

  signalBus.emit("SIGTERM");
  await new Promise((resolve) => setImmediate(resolve));

  const result = await shutdown.shutdown();
  assert.equal(runs, 1);
  assert.equal(result.success, true);
  assert.deepEqual(exits, [0]);
});

test("graceful shutdown times out slow handlers", async () => {
  const shutdown = new GracefulShutdown({
    logger: new StructuredLogger({ retentionLimit: 10 }),
    timeoutMs: 50, // Very short default timeout
  });

  shutdown.addHandler({
    name: "slow",
    timeoutMs: 50, // Per-handler timeout
    handler: async () => {
      // Simulate a slow handler that takes longer than the timeout
      await new Promise((resolve) => setTimeout(resolve, 200));
    },
  });

  const result = await shutdown.shutdown();

  // Handler should fail due to timeout
  assert.equal(result.success, false);
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors.some((e) => e.includes("slow") && e.includes("timed out")));
});

test("graceful shutdown catches handler throwing an error", async () => {
  // Tests the catch block at line 237 when handler() throws (not times out)
  // This exercises Promise.race rejecting with the handler error
  const shutdown = new GracefulShutdown({
    logger: new StructuredLogger({ retentionLimit: 10 }),
  });

  shutdown.addHandler({
    name: "fails",
    handler: async () => {
      throw new Error("handler internal error");
    },
  });

  const result = await shutdown.shutdown();

  assert.equal(result.success, false);
  assert.equal(result.handlersFailed, 1);
  assert.equal(result.handlersRun, 1);
  assert.ok(result.errors.some((e) => e.includes("fails") && e.includes("handler internal error")));
});

test("graceful shutdown Promise.race handler resolves before timeout", async () => {
  // Tests that when handler completes before timeout, the result reflects success
  // The clearTimeout is called after Promise.race resolves
  const shutdown = new GracefulShutdown({
    logger: new StructuredLogger({ retentionLimit: 10 }),
    timeoutMs: 1000, // Generous timeout
  });

  shutdown.addHandler({
    name: "fast",
    handler: async () => {
      await new Promise((resolve) => setTimeout(resolve, 5)); // Very fast
    },
  });

  const result = await shutdown.shutdown();

  assert.equal(result.success, true);
  assert.equal(result.handlersFailed, 0);
  assert.equal(result.handlersRun, 1);
  assert.equal(result.errors.length, 0);
});

test("graceful shutdown multiple handlers run even if first times out", async () => {
  // Verifies that when first handler times out (Promise.race rejects with timeout),
  // subsequent handlers still execute. This tests the loop continuation after catch.
  // Note: slow's async work continues after its timeout fires; the setTimeout
  // callback may fire after shutdown completes, so we only assert on the calls
  // that are guaranteed to happen before shutdown returns.
  const calls: string[] = [];
  const shutdown = new GracefulShutdown({
    logger: new StructuredLogger({ retentionLimit: 10 }),
    timeoutMs: 10,
  });

  shutdown.addHandler({
    name: "slow",
    handler: async () => {
      calls.push("slow_start");
      await new Promise((resolve) => setTimeout(resolve, 500));
      calls.push("slow_end");
    },
  });
  shutdown.addHandler({
    name: "fast",
    handler: async () => {
      calls.push("fast");
    },
  });

  const result = await shutdown.shutdown();

  // First handler times out, second still runs
  assert.equal(result.handlersFailed, 1);
  assert.equal(result.handlersRun, 2);
  assert.ok(result.errors.some((e) => e.includes("slow") && e.includes("timed out")));
  // fast always runs (it completes before slow times out)
  assert.ok(calls.includes("fast"), `Expected fast in calls, got: ${JSON.stringify(calls)}`);
});
