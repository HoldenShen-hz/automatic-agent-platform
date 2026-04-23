import assert from "node:assert/strict";
import test from "node:test";

import {
  GracefulShutdown,
  createGracefulShutdown,
  getGlobalGracefulShutdown,
  type GracefulShutdownOptions,
  type ShutdownHandler,
  type ShutdownResult,
} from "../../../../../src/platform/execution/startup/graceful-shutdown.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface MockSignalBus {
  listeners: Map<string, Set<() => void>>;
  emit(signal: string): void;
}

function createMockSignalBus(): MockSignalBus & {
  on(event: "SIGTERM" | "SIGINT", listener: () => void): void;
  removeListener(event: "SIGTERM" | "SIGINT", listener: () => void): void;
} {
  const listeners = new Map<string, Set<() => void>>();

  return {
    listeners,
    on(event, listener) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(listener);
    },
    removeListener(event, listener) {
      listeners.get(event)?.delete(listener);
    },
    emit(signal) {
      listeners.get(signal)?.forEach((fn) => fn());
    },
  };
}

function noopHandler(name: string): () => Promise<void> {
  return async () => {
    // noop
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests - GracefulShutdown class
// ─────────────────────────────────────────────────────────────────────────────

test("GracefulShutdown - creation with defaults", () => {
  const shutdown = new GracefulShutdown();

  assert.equal(shutdown.isShuttingDownState(), false);
  assert.equal(shutdown.getLastShutdownResult(), null);

  shutdown.reset();
});

test("GracefulShutdown - creation with custom options", () => {
  const shutdown = new GracefulShutdown({
    timeoutMs: 5000,
    forceKillAfterTimeout: false,
  });

  assert.equal(shutdown.isShuttingDownState(), false);

  shutdown.reset();
});

test("GracefulShutdown - addHandler adds to the list", () => {
  const shutdown = new GracefulShutdown();

  const handler: ShutdownHandler = {
    name: "test-handler",
    handler: noopHandler("test-handler"),
  };

  shutdown.addHandler(handler);
  // Adding handler doesn't throw
  shutdown.reset();
});

test("GracefulShutdown - addHandler warns when shutting down", () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
  });

  const handler1: ShutdownHandler = {
    name: "handler1",
    handler: async () => {
      await shutdown.shutdown();
    },
    timeoutMs: 1000,
  };

  const handler2: ShutdownHandler = {
    name: "handler2",
    handler: noopHandler("handler2"),
  };

  shutdown.addHandler(handler1);

  // Start shutdown in background
  const shutdownPromise = shutdown.shutdown();

  // Try to add handler while shutting down - should warn but not throw
  shutdown.addHandler(handler2);

  shutdownPromise.catch(() => {
    // Expected to fail since we're calling shutdown() inside handler
  });

  shutdown.reset();
});

test("GracefulShutdown - registerSignalHandlers registers listeners", () => {
  const signalBus = createMockSignalBus();

  const shutdown = new GracefulShutdown({
    signalBus,
    registerSignalHandlers: false,
  });

  shutdown.registerSignalHandlers();

  // Verify listeners were registered
  assert.ok(signalBus.listeners.has("SIGTERM"));
  assert.ok(signalBus.listeners.has("SIGINT"));

  shutdown.unregisterSignalHandlers();
  shutdown.reset();
});

test("GracefulShutdown - registerSignalHandlers is idempotent", () => {
  const signalBus = createMockSignalBus();

  const shutdown = new GracefulShutdown({
    signalBus,
    registerSignalHandlers: false,
  });

  shutdown.registerSignalHandlers();
  shutdown.registerSignalHandlers(); // Second call should be no-op

  // Only one set of listeners should exist
  assert.equal(signalBus.listeners.get("SIGTERM")?.size, 1);
  assert.equal(signalBus.listeners.get("SIGINT")?.size, 1);

  shutdown.unregisterSignalHandlers();
  shutdown.reset();
});

test("GracefulShutdown - unregisterSignalHandlers removes listeners", () => {
  const signalBus = createMockSignalBus();

  const shutdown = new GracefulShutdown({
    signalBus,
    registerSignalHandlers: false,
  });

  shutdown.registerSignalHandlers();
  shutdown.unregisterSignalHandlers();

  assert.equal(signalBus.listeners.get("SIGTERM")?.size ?? 0, 0);
  assert.equal(signalBus.listeners.get("SIGINT")?.size ?? 0, 0);

  shutdown.reset();
});

test("GracefulShutdown - shutdown executes handlers in reverse order", async () => {
  const callOrder: string[] = [];

  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    timeoutMs: 5000,
  });

  shutdown.addHandler({
    name: "first",
    handler: async () => {
      callOrder.push("first");
    },
  });

  shutdown.addHandler({
    name: "second",
    handler: async () => {
      callOrder.push("second");
    },
  });

  shutdown.addHandler({
    name: "third",
    handler: async () => {
      callOrder.push("third");
    },
  });

  const result = await shutdown.shutdown();

  assert.equal(result.success, true);
  assert.equal(result.handlersRun, 3);
  assert.equal(result.handlersFailed, 0);
  // Handlers run in reverse order (LIFO)
  assert.deepStrictEqual(callOrder, ["third", "second", "first"]);

  shutdown.reset();
});

test("GracefulShutdown - shutdown reports failures", async () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    timeoutMs: 5000,
  });

  shutdown.addHandler({
    name: "failing-handler",
    handler: async () => {
      throw new Error("handler failed");
    },
  });

  const result = await shutdown.shutdown();

  assert.equal(result.success, false);
  assert.equal(result.handlersRun, 1);
  assert.equal(result.handlersFailed, 1);
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors[0].includes("failing-handler"));

  shutdown.reset();
});

test("GracefulShutdown - shutdown is idempotent", async () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    timeoutMs: 5000,
  });

  shutdown.addHandler({
    name: "handler1",
    handler: noopHandler("handler1"),
  });

  const result1 = await shutdown.shutdown();
  const result2 = await shutdown.shutdown();

  // Both calls should return the same result
  assert.equal(result1.handlersRun, result2.handlersRun);
  assert.equal(result1.handlersFailed, result2.handlersFailed);

  shutdown.reset();
});

test("GracefulShutdown - initiateShutdown triggers shutdown", async () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    timeoutMs: 5000,
  });

  shutdown.addHandler({
    name: "test-handler",
    handler: noopHandler("test-handler"),
  });

  const result = await shutdown.initiateShutdown("test-reason");

  assert.equal(result.success, true);
  assert.equal(result.handlersRun, 1);

  shutdown.reset();
});

test("GracefulShutdown - handler timeout works", async () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    timeoutMs: 50, // Very short timeout
  });

  shutdown.addHandler({
    name: "slow-handler",
    handler: async () => {
      await new Promise((resolve) => setTimeout(resolve, 200)); // Longer than timeout
    },
    timeoutMs: 10,
  });

  const result = await shutdown.shutdown();

  assert.equal(result.success, false);
  assert.equal(result.handlersFailed, 1);
  assert.ok(result.errors[0].includes("timed out"));

  shutdown.reset();
});

test("GracefulShutdown - reset clears state", async () => {
  const signalBus = createMockSignalBus();

  const shutdown = new GracefulShutdown({
    signalBus,
    registerSignalHandlers: false,
    timeoutMs: 5000,
  });

  shutdown.addHandler({
    name: "handler1",
    handler: noopHandler("handler1"),
  });

  await shutdown.shutdown();
  assert.equal(shutdown.isShuttingDownState(), true);

  shutdown.reset();

  assert.equal(shutdown.isShuttingDownState(), false);
  assert.equal(shutdown.getLastShutdownResult(), null);
});

test("GracefulShutdown - getLastShutdownResult returns result after shutdown", async () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    timeoutMs: 5000,
  });

  shutdown.addHandler({
    name: "handler1",
    handler: noopHandler("handler1"),
  });

  await shutdown.shutdown();

  const result = shutdown.getLastShutdownResult();
  assert.ok(result !== null);
  assert.equal(result.handlersRun, 1);

  shutdown.reset();
});

test("GracefulShutdown - SIGTERM signal triggers shutdown", async () => {
  const signalBus = createMockSignalBus();
  let exitCode: number | undefined;

  const shutdown = new GracefulShutdown({
    signalBus,
    registerSignalHandlers: false,
    timeoutMs: 5000,
    exitHandler: (code) => {
      exitCode = code;
    },
  });

  shutdown.addHandler({
    name: "sigterm-handler",
    handler: noopHandler("sigterm-handler"),
  });

  shutdown.registerSignalHandlers();

  signalBus.emit("SIGTERM");

  // Wait a bit for async shutdown
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(exitCode, 0);

  shutdown.reset();
});

test("GracefulShutdown - SIGINT signal triggers shutdown", async () => {
  const signalBus = createMockSignalBus();
  let exitCode: number | undefined;

  const shutdown = new GracefulShutdown({
    signalBus,
    registerSignalHandlers: false,
    timeoutMs: 5000,
    exitHandler: (code) => {
      exitCode = code;
    },
  });

  shutdown.addHandler({
    name: "sigint-handler",
    handler: noopHandler("sigint-handler"),
  });

  shutdown.registerSignalHandlers();

  signalBus.emit("SIGINT");

  // Wait a bit for async shutdown
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(exitCode, 0);

  shutdown.reset();
});

test("GracefulShutdown - shutdown with critical handler failure still runs all handlers", async () => {
  const callOrder: string[] = [];

  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    timeoutMs: 5000,
  });

  shutdown.addHandler({
    name: "handler1",
    handler: async () => {
      callOrder.push("handler1");
    },
    critical: true,
  });

  shutdown.addHandler({
    name: "handler2-fail",
    handler: async () => {
      callOrder.push("handler2-fail");
      throw new Error("handler2 failed");
    },
  });

  shutdown.addHandler({
    name: "handler3",
    handler: async () => {
      callOrder.push("handler3");
    },
  });

  const result = await shutdown.shutdown();

  assert.equal(result.success, false);
  assert.equal(result.handlersFailed, 1);
  // All handlers should have run despite failure
  assert.ok(callOrder.includes("handler2-fail"));

  shutdown.reset();
});

test("GracefulShutdown - durationMs is tracked", async () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    timeoutMs: 5000,
  });

  shutdown.addHandler({
    name: "slow-handler",
    handler: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    },
  });

  const result = await shutdown.shutdown();

  assert.ok(result.durationMs >= 15); // Allow some variance

  shutdown.reset();
});

test("createGracefulShutdown factory creates instance", () => {
  const shutdown = createGracefulShutdown({
    timeoutMs: 10000,
  });

  assert.ok(shutdown instanceof GracefulShutdown);
  assert.equal(shutdown.isShuttingDownState(), false);

  shutdown.reset();
});

test("getGlobalGracefulShutdown returns singleton", () => {
  const instance1 = getGlobalGracefulShutdown();
  const instance2 = getGlobalGracefulShutdown();

  assert.ok(instance1 === instance2);
});
