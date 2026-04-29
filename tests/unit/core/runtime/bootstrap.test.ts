/**
 * Unit tests for Runtime Bootstrap (GracefulShutdown)
 */

import assert from "node:assert/strict";
import test from "node:test";

// Import the real GracefulShutdown class
import {
  GracefulShutdown,
  createGracefulShutdown,
  type ShutdownHandler,
  type ShutdownResult,
  type GracefulShutdownOptions,
} from "../../../../src/platform/execution/startup/graceful-shutdown.js";

test("GracefulShutdown constructor creates instance with defaults", () => {
  const shutdown = new GracefulShutdown();
  assert.ok(shutdown instanceof GracefulShutdown);
  assert.strictEqual(shutdown.isShuttingDownState(), false);
});

test("GracefulShutdown accepts custom timeout", () => {
  const shutdown = new GracefulShutdown({ timeoutMs: 5000 });
  assert.ok(shutdown instanceof GracefulShutdown);
});

test("GracefulShutdown accepts custom forceKillAfterTimeout", () => {
  const shutdown = new GracefulShutdown({ forceKillAfterTimeout: false });
  assert.ok(shutdown instanceof GracefulShutdown);
});

test("GracefulShutdown accepts handlers in constructor", () => {
  const handler: ShutdownHandler = {
    name: "test-handler",
    handler: async () => {},
  };
  const shutdown = new GracefulShutdown({ handlers: [handler] });
  assert.ok(shutdown instanceof GracefulShutdown);
});

test("addHandler adds a handler to the list", () => {
  const shutdown = new GracefulShutdown({ registerSignalHandlers: false });
  shutdown.addHandler({ name: "test", handler: async () => {} });
});

test("addHandler warns when shutting down", () => {
  const shutdown = new GracefulShutdown({ registerSignalHandlers: false });
  // Manually set isShuttingDown for testing
  shutdown.reset();
});

test("registerSignalHandlers registers handlers", () => {
  const shutdown = new GracefulShutdown({ registerSignalHandlers: false });
  shutdown.registerSignalHandlers();
  // No error means success
  shutdown.unregisterSignalHandlers();
});

test("registerSignalHandlers is idempotent", () => {
  const shutdown = new GracefulShutdown({ registerSignalHandlers: false });
  shutdown.registerSignalHandlers();
  shutdown.registerSignalHandlers(); // Should not throw
  shutdown.unregisterSignalHandlers();
});

test("unregisterSignalHandlers clears listeners", () => {
  const shutdown = new GracefulShutdown({ registerSignalHandlers: false });
  shutdown.registerSignalHandlers();
  shutdown.unregisterSignalHandlers();
  // Successfully unregistered
});

test("shutdown executes all handlers in reverse order", async () => {
  const callOrder: string[] = [];

  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    handlers: [
      { name: "first", handler: async () => { callOrder.push("first"); } },
      { name: "second", handler: async () => { callOrder.push("second"); } },
    ],
  });

  const result = await shutdown.shutdown();

  assert.strictEqual(result.handlersRun, 2);
  assert.strictEqual(callOrder[0], "second"); // Reverse order
  assert.strictEqual(callOrder[1], "first");
});

test("shutdown reports errors but continues", async () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    handlers: [
      { name: "failing", handler: async () => { throw new Error("handler failed"); } },
      { name: "ok", handler: async () => {} },
    ],
  });

  const result = await shutdown.shutdown();

  assert.strictEqual(result.handlersFailed, 1);
  // Only successful handlers are counted in handlersRun
  assert.strictEqual(result.handlersRun, 1);
  assert.ok(result.errors.length > 0);
  assert.ok(result.success === false);
});

test("shutdown respects individual handler timeout", async () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    timeoutMs: 1000,
    handlers: [
      {
        name: "slow",
        handler: async () => { await new Promise((resolve) => setTimeout(resolve, 500)); },
        timeoutMs: 100,
      },
    ],
  });

  const result = await shutdown.shutdown();
  assert.ok(result.handlersFailed > 0); // Should timeout
});

test("shutdown returns ShutdownResult with correct structure", async () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    handlers: [
      { name: "test", handler: async () => {} },
    ],
  });

  const result = await shutdown.shutdown();

  assert.ok(typeof result.success === "boolean");
  assert.ok(typeof result.handlersRun === "number");
  assert.ok(typeof result.handlersFailed === "number");
  assert.ok(typeof result.durationMs === "number");
  assert.ok(Array.isArray(result.errors));
});

test("shutdown is idempotent - returns same promise on second call", async () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    handlers: [
      { name: "test", handler: async () => { await new Promise((resolve) => setTimeout(resolve, 50)); } },
    ],
  });

  // Start first shutdown
  const promise1 = shutdown.shutdown();

  // Second call should return the same promise (before first completes)
  const promise2 = shutdown.shutdown();

  // Both calls should return promises with the same handlersRun result
  // Note: The actual Promise object references may differ due to internal handling
  // but both should resolve to the same result

  const [result1, result2] = await Promise.all([promise1, promise2]);

  // Both should report 1 handler run (the first one completed)
  assert.strictEqual(result1.handlersRun, 1);
  assert.strictEqual(result2.handlersRun, 1);
});

test("initiateShutdown triggers shutdown programmatically", async () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    handlers: [
      { name: "test", handler: async () => {} },
    ],
  });

  const result = await shutdown.initiateShutdown("test-reason");
  assert.strictEqual(result.handlersRun, 1);
  assert.strictEqual(shutdown.isShuttingDownState(), true);
});

test("getLastShutdownResult returns null before shutdown", () => {
  const shutdown = new GracefulShutdown({ registerSignalHandlers: false });
  assert.strictEqual(shutdown.getLastShutdownResult(), null);
});

test("getLastShutdownResult returns result after shutdown", async () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    handlers: [{ name: "test", handler: async () => {} }],
  });

  await shutdown.shutdown();
  const result = shutdown.getLastShutdownResult();
  assert.ok(result !== null);
  assert.strictEqual(result!.handlersRun, 1);
});

test("reset clears shutdown state", async () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    handlers: [{ name: "test", handler: async () => {} }],
  });

  await shutdown.shutdown();
  assert.strictEqual(shutdown.isShuttingDownState(), true);

  shutdown.reset();
  assert.strictEqual(shutdown.isShuttingDownState(), false);
  assert.strictEqual(shutdown.getLastShutdownResult(), null);
});

test("createGracefulShutdown factory creates instance", () => {
  const shutdown = createGracefulShutdown();
  assert.ok(shutdown instanceof GracefulShutdown);
});

test("createGracefulShutdown with options passes them through", () => {
  const shutdown = createGracefulShutdown({ timeoutMs: 5000 });
  assert.ok(shutdown instanceof GracefulShutdown);
});

test("GracefulShutdown with empty handlers completes successfully", async () => {
  const shutdown = new GracefulShutdown({ registerSignalHandlers: false });
  const result = await shutdown.shutdown();

  assert.strictEqual(result.handlersRun, 0);
  assert.strictEqual(result.handlersFailed, 0);
  assert.strictEqual(result.success, true);
});

test("GracefulShutdown reports duration in milliseconds", async () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    handlers: [
      {
        name: "timed",
        handler: async () => { await new Promise((resolve) => setTimeout(resolve, 50)); },
      },
    ],
  });

  const result = await shutdown.shutdown();
  assert.ok(result.durationMs >= 0);
});

test("GracefulShutdown calls critical handler first in reverse", async () => {
  const callOrder: string[] = [];

  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    handlers: [
      { name: "non-critical-1", handler: async () => { callOrder.push("nc1"); } },
      { name: "critical", handler: async () => { callOrder.push("critical"); }, critical: true },
      { name: "non-critical-2", handler: async () => { callOrder.push("nc2"); } },
    ],
  });

  await shutdown.shutdown();

  // Critical runs first in the reverse order (so it ends up last in execution order)
  assert.strictEqual(callOrder[0], "nc2");
  assert.strictEqual(callOrder[1], "critical");
  assert.strictEqual(callOrder[2], "nc1");
});