import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import {
  GracefulShutdown,
  createGracefulShutdown,
  type ShutdownHandler,
} from "../../../../../src/platform/five-plane-execution/startup/graceful-shutdown.js";

class TestSignalBus extends EventEmitter {
  override on(event: "SIGTERM" | "SIGINT", listener: () => void): this {
    return super.on(event, listener);
  }

  override removeListener(event: "SIGTERM" | "SIGINT", listener: () => void): this {
    return super.removeListener(event, listener);
  }
}

function createHandler(name: string, calls: string[], options: Partial<ShutdownHandler> = {}): ShutdownHandler {
  return {
    name,
    handler: async () => {
      calls.push(name);
    },
    ...options,
  };
}

test("constructor uses defaults and accepts initial handlers", () => {
  const calls: string[] = [];
  const shutdown = new GracefulShutdown({
    handlers: [createHandler("cleanup", calls)],
  });

  assert.equal((shutdown as unknown as { timeoutMs: number }).timeoutMs, 30_000);
  assert.equal((shutdown as unknown as { forceKillAfterTimeout: boolean }).forceKillAfterTimeout, true);
  assert.equal((shutdown as unknown as { handlers: ShutdownHandler[] }).handlers.length, 1);
});

test("shutdown runs handlers in reverse order when no dependencies exist", async () => {
  const calls: string[] = [];
  const shutdown = createGracefulShutdown();
  shutdown.addHandler(createHandler("first", calls));
  shutdown.addHandler(createHandler("second", calls));

  const result = await shutdown.shutdown();

  assert.deepEqual(calls, ["second", "first"]);
  assert.equal(result.success, true);
  assert.equal(result.handlersRun, 2);
  assert.equal(result.handlersFailed, 0);
});

test("shutdown respects dependency ordering", async () => {
  const calls: string[] = [];
  const shutdown = createGracefulShutdown();
  shutdown.addHandler(createHandler("database", calls));
  shutdown.addHandler(createHandler("http", calls, { dependsOn: ["database"] }));

  await shutdown.shutdown();

  assert.deepEqual(calls, ["http", "database"]);
});

test("shutdown reports handler failures without aborting remaining handlers", async () => {
  const calls: string[] = [];
  const shutdown = createGracefulShutdown();
  shutdown.addHandler(createHandler("ok", calls));
  shutdown.addHandler({
    name: "boom",
    handler: async () => {
      calls.push("boom");
      throw new Error("failed");
    },
  });

  const result = await shutdown.shutdown();

  assert.deepEqual(calls, ["boom", "ok"]);
  assert.equal(result.success, false);
  assert.equal(result.handlersFailed, 1);
  assert.equal(result.errors[0], "boom: failed");
});

test("shutdown aborts a slow handler when its timeout elapses", async () => {
  const shutdown = createGracefulShutdown({ timeoutMs: 50 });
  shutdown.addHandler({
    name: "slow",
    timeoutMs: 5,
    handler: async (signal) => new Promise<void>((resolve, reject) => {
      signal?.addEventListener("abort", () => resolve(), { once: true });
      setTimeout(() => reject(new Error("should have been aborted")), 25);
    }),
  });

  const result = await shutdown.shutdown();

  assert.equal(result.success, false);
  assert.equal(result.handlersFailed, 1);
  assert.match(result.errors[0] ?? "", /timed out/);
});

test("shutdown is idempotent and addHandler is blocked during shutdown", async () => {
  const shutdown = createGracefulShutdown();
  let release!: () => void;
  shutdown.addHandler({
    name: "pending",
    handler: async () => new Promise<void>((resolve) => {
      release = resolve;
    }),
  });

  const first = shutdown.shutdown();
  assert.throws(
    () => shutdown.addHandler(createHandler("late", [])),
    /shutdown is in progress/,
  );
  const second = shutdown.shutdown();
  release();

  assert.equal(await first, await second);
});

test("registerSignalHandlers triggers shutdown and exit handler on signal", async () => {
  const signalBus = new TestSignalBus();
  const exitCodes: number[] = [];
  const calls: string[] = [];
  const shutdown = createGracefulShutdown({
    signalBus,
    exitHandler: (code) => {
      exitCodes.push(code);
    },
    registerSignalHandlers: true,
  });
  shutdown.addHandler(createHandler("cleanup", calls));

  signalBus.emit("SIGTERM");
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(calls, ["cleanup"]);
  assert.deepEqual(exitCodes, [0]);
  assert.equal(shutdown.getLastShutdownResult()?.success, true);
});

test("reset clears shutdown state and registered handlers", async () => {
  const shutdown = createGracefulShutdown();
  shutdown.addHandler(createHandler("cleanup", []));
  await shutdown.shutdown();

  shutdown.reset();

  assert.equal(shutdown.isShuttingDownState(), false);
  assert.equal(shutdown.getLastShutdownResult(), null);
  assert.equal((shutdown as unknown as { handlers: ShutdownHandler[] }).handlers.length, 0);
});
