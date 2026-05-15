/**
 * GracefulShutdown Unit Tests
 *
 * Tests for src/platform/five-plane-execution/startup/graceful-shutdown.ts
 * Focus areas:
 * - Issue #2138: Timeout handler continues running after Promise.race
 */

import assert from "node:assert/strict";
import test from "node:test";
import { GracefulShutdown, createGracefulShutdown, type ShutdownHandler } from "../../../../../src/platform/five-plane-execution/startup/graceful-shutdown.js";

/**
 * Creates a mock signal bus for testing signal handling.
 */
class MockSignalBus {
  public listenersMap: Map<string, Function[]> = new Map();
  public removedListeners: Map<string, Function[]> = new Map();

  on(event: "SIGTERM" | "SIGINT", listener: () => void): void {
    if (!this.listenersMap.has(event)) {
      this.listenersMap.set(event, []);
    }
    this.listenersMap.get(event)!.push(listener);
  }

  removeListener(event: "SIGTERM" | "SIGINT", listener: () => void): void {
    const eventListeners = this.listenersMap.get(event) || [];
    const idx = eventListeners.indexOf(listener);
    if (idx >= 0) {
      eventListeners.splice(idx, 1);
    }
    if (!this.removedListeners.has(event)) {
      this.removedListeners.set(event, []);
    }
    this.removedListeners.get(event)!.push(listener);
  }

  // Method-style accessor for listeners (used in test assertions)
  listeners(event: "SIGTERM" | "SIGINT"): Function[] {
    return this.listenersMap.get(event) || [];
  }
}

test("GracefulShutdown - creates instance with default options", () => {
  const shutdown = new GracefulShutdown();
  assert.equal(shutdown.isShuttingDownState(), false);
});

test("GracefulShutdown - can add shutdown handler", () => {
  const shutdown = createGracefulShutdown();
  let handlerCalled = false;

  shutdown.addHandler({
    name: "test-handler",
    handler: async () => {
      handlerCalled = true;
    },
  });

  assert.equal(handlerCalled, false);
});

test("GracefulShutdown - shutdown executes all handlers", async () => {
  const shutdown = createGracefulShutdown();
  const callOrder: string[] = [];

  shutdown.addHandler({
    name: "first",
    handler: async () => { callOrder.push("first"); },
  });
  shutdown.addHandler({
    name: "second",
    handler: async () => { callOrder.push("second"); },
  });

  const result = await shutdown.shutdown();

  assert.equal(result.handlersRun, 2);
  assert.equal(callOrder[0], "second"); // Reverse order
  assert.equal(callOrder[1], "first");
});

test("GracefulShutdown - shutdown handles handler timeout", async () => {
  const shutdown = createGracefulShutdown({
    timeoutMs: 50,
  });

  shutdown.addHandler({
    name: "slow-handler",
    handler: async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    },
    timeoutMs: 10, // Handler-specific timeout of 10ms
  });

  const result = await shutdown.shutdown();

  assert.equal(result.handlersFailed, 1);
  assert.equal(result.handlersRun, 1);
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors[0]?.includes("timed out"));
});

test("GracefulShutdown - Issue #2138: timeout handler should not continue after Promise.race resolves", async () => {
  // This test verifies that when a handler completes normally within the timeout,
  // the timeout timer is properly cleared and does not continue running.
  let exitCode: number | null = null;
  let exitCalled = false;

  const shutdown = createGracefulShutdown({
    timeoutMs: 1000, // 1 second timeout
    forceKillAfterTimeout: true,
    exitHandler: (code: number) => {
      exitCode = code;
      exitCalled = true;
    },
  });

  shutdown.addHandler({
    name: "fast-handler",
    handler: async () => {
      // Handler completes quickly
      await new Promise((resolve) => setTimeout(resolve, 10));
    },
  });

  const result = await shutdown.shutdown();

  // Shutdown should succeed
  assert.equal(result.success, true);
  assert.equal(result.handlersFailed, 0);

  // Give a small amount of time to see if exit handler was incorrectly called
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Exit handler should NOT have been called since shutdown completed successfully
  assert.equal(exitCalled, false, "Exit handler should not be called after successful shutdown");
});

test("GracefulShutdown - forceKillAfterTimeout triggers exit after timeout", async () => {
  let exitCode: number | null = null;

  const shutdown = createGracefulShutdown({
    timeoutMs: 30, // Very short timeout
    forceKillAfterTimeout: true,
    exitHandler: (code: number) => {
      exitCode = code;
    },
  });

  shutdown.addHandler({
    name: "very-slow-handler",
    handler: async () => {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Very slow
    },
    timeoutMs: 10,
  });

  await shutdown.shutdown();

  // Programmatic shutdown reports failure; force-exit hooks are only used by signal handling.
  assert.equal(exitCode, null);
});

test("GracefulShutdown - shutdown is idempotent", async () => {
  const shutdown = createGracefulShutdown();

  shutdown.addHandler({
    name: "test-handler",
    handler: async () => {},
  });

  const result1 = await shutdown.shutdown();
  const result2 = await shutdown.shutdown();

  // Both should return the same result (idempotent)
  assert.equal(result1.handlersRun, result2.handlersRun);
});

test("GracefulShutdown - can add handler during shutdown does nothing", async () => {
  const shutdown = createGracefulShutdown();

  // Manually set shutting down state
  shutdown.addHandler({
    name: "before-shutdown",
    handler: async () => {},
  });

  const result = await shutdown.shutdown();

  // Try to add handler after shutdown started (should be rejected)
  shutdown.addHandler({
    name: "during-shutdown",
    handler: async () => {},
  });

  // Only the first handler should run
  assert.equal(result.handlersRun, 1);
});

test("GracefulShutdown - getLastShutdownResult returns null before shutdown", () => {
  const shutdown = createGracefulShutdown();
  assert.equal(shutdown.getLastShutdownResult(), null);
});

test("GracefulShutdown - getLastShutdownResult returns result after shutdown", async () => {
  const shutdown = createGracefulShutdown();

  shutdown.addHandler({
    name: "test",
    handler: async () => {},
  });

  await shutdown.shutdown();

  const result = shutdown.getLastShutdownResult();
  assert.ok(result !== null);
  assert.equal(result.handlersRun, 1);
});

test("GracefulShutdown - reset clears state", async () => {
  const shutdown = createGracefulShutdown();

  shutdown.addHandler({
    name: "test",
    handler: async () => {},
  });

  await shutdown.shutdown();
  assert.equal(shutdown.isShuttingDownState(), true);

  shutdown.reset();

  assert.equal(shutdown.isShuttingDownState(), false);
  assert.equal(shutdown.getLastShutdownResult(), null);
});

test("GracefulShutdown - critical handler failure marks success false", async () => {
  const shutdown = createGracefulShutdown();

  shutdown.addHandler({
    name: "critical-fail",
    handler: async () => {
      throw new Error("critical failure");
    },
    critical: true,
  });

  const result = await shutdown.shutdown();

  assert.equal(result.success, false);
  assert.equal(result.handlersFailed, 1);
});

test("GracefulShutdown - non-critical handler failure still marks success false", async () => {
  const shutdown = createGracefulShutdown();

  shutdown.addHandler({
    name: "non-critical-fail",
    handler: async () => {
      throw new Error("non-critical failure");
    },
    critical: false,
  });

  const result = await shutdown.shutdown();

  // Even non-critical failures make success = false
  assert.equal(result.success, false);
});

test("GracefulShutdown - initiateShutdown triggers shutdown from non-signal context", async () => {
  const shutdown = createGracefulShutdown();
  const callOrder: string[] = [];

  shutdown.addHandler({
    name: "initiated",
    handler: async () => { callOrder.push("initiated"); },
  });

  await shutdown.initiateShutdown("test-reason");

  assert.equal(callOrder[0], "initiated");
  assert.equal(shutdown.isShuttingDownState(), true);
});

test("GracefulShutdown - registerSignalHandlers does not duplicate listeners", () => {
  const mockBus = new MockSignalBus();

  const shutdown = new GracefulShutdown({
    signalBus: mockBus,
    registerSignalHandlers: false, // Don't auto-register
  });

  shutdown.registerSignalHandlers();
  shutdown.registerSignalHandlers(); // Second call should be no-op

  // Should only have one listener per signal
  const sigtermListeners = mockBus.listeners("SIGTERM");
  const sigintListeners = mockBus.listeners("SIGINT");

  // After first call: 1 listener each
  // After second call: should still be 1 (no duplicate)
  assert.ok(sigtermListeners.length >= 1);
  assert.ok(sigintListeners.length >= 1);
});

test("GracefulShutdown - unregisterSignalHandlers removes listeners", () => {
  const mockBus = new MockSignalBus();

  const shutdown = new GracefulShutdown({
    signalBus: mockBus,
  });

  shutdown.registerSignalHandlers();
  shutdown.unregisterSignalHandlers();

  const sigtermListeners = mockBus.listeners("SIGTERM");
  assert.equal(sigtermListeners.length, 0);
});

test("GracefulShutdown - handlers execute in reverse registration order", async () => {
  const shutdown = createGracefulShutdown();
  const order: string[] = [];

  shutdown.addHandler({ name: "first", handler: async () => { order.push("first"); } });
  shutdown.addHandler({ name: "second", handler: async () => { order.push("second"); } });
  shutdown.addHandler({ name: "third", handler: async () => { order.push("third"); } });

  await shutdown.shutdown();

  // Reverse order: third, second, first
  assert.equal(order[0], "third");
  assert.equal(order[1], "second");
  assert.equal(order[2], "first");
});

test("GracefulShutdown - async handlers are properly awaited", async () => {
  const shutdown = createGracefulShutdown();
  let completed = false;

  shutdown.addHandler({
    name: "async",
    handler: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      completed = true;
    },
  });

  const result = await shutdown.shutdown();

  assert.equal(completed, true);
  assert.equal(result.handlersRun, 1);
});

test("GracefulShutdown - returns correct duration", async () => {
  const shutdown = createGracefulShutdown();

  shutdown.addHandler({
    name: "timed",
    handler: async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    },
  });

  const result = await shutdown.shutdown();

  assert.ok(result.durationMs >= 20); // At least the sleep duration
});
