/**
 * Graceful Shutdown Unit Tests
 *
 * Tests signal handling, shutdown handlers, timeout behavior,
 * and result reporting.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";

import {
  GracefulShutdown,
  createGracefulShutdown,
  type ShutdownHandler,
  type ShutdownResult,
} from "../../../../../src/platform/five-plane-execution/startup/graceful-shutdown.js";

// ---------------------------------------------------------------------------
// Test Fixtures & Helpers
// ---------------------------------------------------------------------------

function createMockSignalBus(): EventEmitter & { handlers: Map<string, Function> } {
  const emitter = new EventEmitter();
  (emitter as EventEmitter & { handlers: Map<string, Function> }).handlers = new Map();
  return emitter as EventEmitter & { handlers: Map<string, Function> };
}

function createDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  return {
    promise: new Promise<void>((res) => {
      resolve = res;
    }),
    resolve,
  };
}

async function flushMacrotask(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

async function withSimulatedTime<T>(operation: (advanceTime: (ms: number) => void) => Promise<T>): Promise<T> {
  const originalNow = Date.now;
  let nowMs = 1_700_000_000_000;
  Date.now = () => nowMs;
  try {
    return await operation((ms) => {
      nowMs += ms;
    });
  } finally {
    Date.now = originalNow;
  }
}

async function withImmediateTimeouts<T>(operation: () => Promise<T>, onSchedule?: (ms: number) => void): Promise<T> {
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((callback: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (typeof callback !== "function") {
      throw new TypeError("String timer callbacks are not supported in tests");
    }
    queueMicrotask(() => {
      onSchedule?.(delay ?? 0);
      callback(...args);
    });
    return { ref() {}, unref() {}, hasRef() { return false; } } as ReturnType<typeof setTimeout>;
  }) as typeof globalThis.setTimeout;
  try {
    return await operation();
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
}

function createPassingHandler(name: string, delayMs = 0, advanceTime?: (ms: number) => void): ShutdownHandler {
  return {
    name,
    handler: async () => {
      if (delayMs > 0) {
        advanceTime?.(delayMs);
        await flushMacrotask();
      }
    },
  };
}

function createFailingHandler(name: string, errorMsg = "Handler failed"): ShutdownHandler {
  return {
    name,
    handler: async () => {
      throw new Error(errorMsg);
    },
  };
}

function createTrackedFailingHandler(name: string, executionOrder: string[], errorMsg = "Handler failed"): ShutdownHandler {
  return {
    name,
    handler: async () => {
      executionOrder.push(name);
      throw new Error(errorMsg);
    },
  };
}

function createSlowHandler(name: string, delayMs: number, handlerTimeoutMs?: number): ShutdownHandler {
  return {
    name,
    handler: async () => {
      if (delayMs > 0) {
        await new Promise<void>(() => {});
      }
    },
    timeoutMs: handlerTimeoutMs,
  };
}

// ---------------------------------------------------------------------------
// Tests: Constructor & Options
// ---------------------------------------------------------------------------

test("constructor() uses default timeout of 30000ms", () => {
  const shutdown = new GracefulShutdown();

  assert.equal((shutdown as any).timeoutMs, 30000);
});

test("constructor() accepts custom timeout", () => {
  const shutdown = new GracefulShutdown({ timeoutMs: 60000 });

  assert.equal((shutdown as any).timeoutMs, 60000);
});

test("constructor() defaults forceKillAfterTimeout to true", () => {
  const shutdown = new GracefulShutdown();

  assert.equal((shutdown as any).forceKillAfterTimeout, true);
});

test("constructor() accepts false for forceKillAfterTimeout", () => {
  const shutdown = new GracefulShutdown({ forceKillAfterTimeout: false });

  assert.equal((shutdown as any).forceKillAfterTimeout, false);
});

test("constructor() does not register signal handlers by default", () => {
  const shutdown = new GracefulShutdown();

  assert.equal((shutdown as any).signalListeners.size, 0);
});

test("constructor() accepts initial handlers", () => {
  const handler = createPassingHandler("test-handler");
  const shutdown = new GracefulShutdown({ handlers: [handler] });

  assert.equal((shutdown as any).handlers.length, 1);
});

// ---------------------------------------------------------------------------
// Tests: Add Handler
// ---------------------------------------------------------------------------

test("addHandler() adds handler to the list", () => {
  const shutdown = new GracefulShutdown();
  const handler = createPassingHandler("test-handler");

  shutdown.addHandler(handler);

  assert.equal((shutdown as any).handlers.length, 1);
  assert.equal((shutdown as any).handlers[0].name, "test-handler");
});

test("addHandler() throws while shutting down", () => {
  const shutdown = new GracefulShutdown();
  const handler1 = createPassingHandler("handler-1");
  const handler2 = createPassingHandler("handler-2");

  shutdown.addHandler(handler1);
  // Manually set shutting down state
  (shutdown as any).isShuttingDown = true;
  assert.throws(
    () => shutdown.addHandler(handler2),
    /Cannot add shutdown handler 'handler-2' while shutdown is in progress\./,
  );
  assert.equal((shutdown as any).handlers.length, 1, "should not add handler during shutdown");
});

test("addHandler() can add multiple handlers", () => {
  const shutdown = new GracefulShutdown();

  shutdown.addHandler(createPassingHandler("handler-1"));
  shutdown.addHandler(createPassingHandler("handler-2"));
  shutdown.addHandler(createPassingHandler("handler-3"));

  assert.equal((shutdown as any).handlers.length, 3);
});

// ---------------------------------------------------------------------------
// Tests: Signal Handlers
// ---------------------------------------------------------------------------

test("registerSignalHandlers() registers listeners for SIGTERM and SIGINT", () => {
  const signalBus = createMockSignalBus();
  const shutdown = new GracefulShutdown({ signalBus });

  shutdown.registerSignalHandlers();

  assert.equal(signalBus.listeners("SIGTERM").length, 1);
  assert.equal(signalBus.listeners("SIGINT").length, 1);
});

test("registerSignalHandlers() is idempotent", () => {
  const signalBus = createMockSignalBus();
  const shutdown = new GracefulShutdown({ signalBus });

  shutdown.registerSignalHandlers();
  shutdown.registerSignalHandlers();

  assert.equal(signalBus.listeners("SIGTERM").length, 1);
  assert.equal(signalBus.listeners("SIGINT").length, 1);
});

test("unregisterSignalHandlers() removes all signal listeners", () => {
  const signalBus = createMockSignalBus();
  const shutdown = new GracefulShutdown({ signalBus });

  shutdown.registerSignalHandlers();
  shutdown.unregisterSignalHandlers();

  assert.equal(signalBus.listeners("SIGTERM").length, 0);
  assert.equal(signalBus.listeners("SIGINT").length, 0);
});

test("unregisterSignalHandlers() works when no handlers registered", () => {
  const signalBus = createMockSignalBus();
  const shutdown = new GracefulShutdown({ signalBus });

  // Should not throw
  shutdown.unregisterSignalHandlers();
});

// ---------------------------------------------------------------------------
// Tests: Shutdown Execution
// ---------------------------------------------------------------------------

test("shutdown() executes all handlers in reverse order", async () => {
  const shutdown = new GracefulShutdown();
  const executionOrder: string[] = [];

  shutdown.addHandler({
    name: "handler-1",
    handler: async () => { executionOrder.push("handler-1"); },
  });
  shutdown.addHandler({
    name: "handler-2",
    handler: async () => { executionOrder.push("handler-2"); },
  });

  await shutdown.shutdown();

  assert.deepEqual(executionOrder, ["handler-2", "handler-1"]);
});

test("shutdown() returns success true when all handlers pass", async () => {
  const shutdown = new GracefulShutdown({
    handlers: [
      createPassingHandler("handler-1"),
      createPassingHandler("handler-2"),
    ],
  });

  const result = await shutdown.shutdown();

  assert.equal(result.success, true);
  assert.equal(result.handlersRun, 2);
  assert.equal(result.handlersFailed, 0);
  assert.equal(result.errors.length, 0);
});

test("shutdown() returns success false when any handler fails", async () => {
  const shutdown = new GracefulShutdown({
    handlers: [
      createPassingHandler("handler-1"),
      createFailingHandler("handler-2"),
    ],
  });

  const result = await shutdown.shutdown();

  assert.equal(result.success, false);
  assert.equal(result.handlersRun, 2);
  assert.equal(result.handlersFailed, 1);
  assert.equal(result.errors.length, 1);
  assert.ok(result.errors[0].includes("handler-2"));
});

test("shutdown() continues executing handlers after a failure", async () => {
  const executionOrder: string[] = [];
  const shutdown = new GracefulShutdown({
    handlers: [
      {
        name: "handler-1",
        handler: async () => { executionOrder.push("handler-1"); },
      },
      createTrackedFailingHandler("handler-2", executionOrder),
      {
        name: "handler-3",
        handler: async () => { executionOrder.push("handler-3"); },
      },
    ],
  });

  await shutdown.shutdown();

  assert.deepEqual(executionOrder, ["handler-3", "handler-2", "handler-1"]);
});

test("shutdown() tracks duration", async () => {
  await withSimulatedTime(async (advanceTime) => {
    const shutdown = new GracefulShutdown({
      handlers: [createPassingHandler("handler", 50, advanceTime)],
    });

    const result = await shutdown.shutdown();

    assert.ok(result.durationMs >= 50, `duration ${result.durationMs} should be at least 50ms`);
  });
});

test("shutdown() is idempotent - returns same promise on second call", async () => {
  const shutdown = new GracefulShutdown({
    handlers: [createPassingHandler("handler")],
  });

  const result1 = shutdown.shutdown();
  const result2 = shutdown.shutdown();

  assert.equal(result1, result2, "should return same promise");
});

// ---------------------------------------------------------------------------
// Tests: Handler Timeout
// ---------------------------------------------------------------------------

test("shutdown() times out slow handler", async () => {
  await withSimulatedTime(async (advanceTime) => {
    const shutdown = new GracefulShutdown({
      handlers: [createSlowHandler("slow-handler", 500)],
      timeoutMs: 100,
    });

    const result = await withImmediateTimeouts(() => shutdown.shutdown(), advanceTime);

    assert.equal(result.success, false);
    assert.ok(result.errors.some((e) => e.includes("timed out")));
  });
});

// ---------------------------------------------------------------------------
// Tests: Shutdown State
// ---------------------------------------------------------------------------

test("isShuttingDownState() returns false before shutdown", () => {
  const shutdown = new GracefulShutdown();

  assert.equal(shutdown.isShuttingDownState(), false);
});

test("isShuttingDownState() returns true during shutdown", async () => {
  const blocker = createDeferred();
  const shutdown = new GracefulShutdown({
    handlers: [
      {
        name: "slow-handler",
        handler: async () => blocker.promise,
      },
    ],
  });

  const shutdownPromise = shutdown.shutdown();
  assert.equal(shutdown.isShuttingDownState(), true);

  blocker.resolve();
  await shutdownPromise;
});

test("isShuttingDownState() returns true after shutdown completes", async () => {
  const shutdown = new GracefulShutdown({
    handlers: [createPassingHandler("handler")],
  });

  await shutdown.shutdown();

  assert.equal(shutdown.isShuttingDownState(), true);
});

test("getLastShutdownResult() returns null before shutdown", () => {
  const shutdown = new GracefulShutdown();

  assert.equal(shutdown.getLastShutdownResult(), null);
});

test("getLastShutdownResult() returns result after shutdown", async () => {
  const shutdown = new GracefulShutdown({
    handlers: [createPassingHandler("handler")],
  });

  await shutdown.shutdown();

  const result = shutdown.getLastShutdownResult();
  assert.ok(result != null);
  assert.equal(result?.handlersRun, 1);
});

// ---------------------------------------------------------------------------
// Tests: Reset
// ---------------------------------------------------------------------------

test("reset() clears shutdown state", async () => {
  const shutdown = new GracefulShutdown({
    handlers: [createPassingHandler("handler")],
  });

  await shutdown.shutdown();
  shutdown.reset();

  assert.equal(shutdown.isShuttingDownState(), false);
  assert.equal(shutdown.getLastShutdownResult(), null);
  assert.equal((shutdown as any).handlers.length, 0);
});

test("reset() unregisters signal handlers", () => {
  const signalBus = createMockSignalBus();
  const shutdown = new GracefulShutdown({ signalBus, registerSignalHandlers: true });

  shutdown.reset();

  assert.equal(signalBus.listeners("SIGTERM").length, 0);
  assert.equal(signalBus.listeners("SIGINT").length, 0);
});

// ---------------------------------------------------------------------------
// Tests: Initiate Shutdown
// ---------------------------------------------------------------------------

test("initiateShutdown() calls shutdown()", async () => {
  const shutdown = new GracefulShutdown({
    handlers: [createPassingHandler("handler")],
  });

  const result = await shutdown.initiateShutdown("test reason");

  assert.equal(result.success, true);
});

test("initiateShutdown() is idempotent like shutdown()", async () => {
  const shutdown = new GracefulShutdown({
    handlers: [createPassingHandler("handler")],
  });

  const result1 = shutdown.initiateShutdown();
  const result2 = shutdown.initiateShutdown();

  assert.equal(result1, result2);
});

// ---------------------------------------------------------------------------
// Tests: Factory Function
// ---------------------------------------------------------------------------

test("createGracefulShutdown() creates new instance", () => {
  const shutdown1 = createGracefulShutdown();
  const shutdown2 = createGracefulShutdown();

  assert.ok(shutdown1 instanceof GracefulShutdown);
  assert.ok(shutdown2 instanceof GracefulShutdown);
  assert.ok(shutdown1 !== shutdown2);
});

// ---------------------------------------------------------------------------
// Tests: Empty Handlers List
// ---------------------------------------------------------------------------

test("shutdown() with no handlers returns success true", async () => {
  const shutdown = new GracefulShutdown();

  const result = await shutdown.shutdown();

  assert.equal(result.success, true);
  assert.equal(result.handlersRun, 0);
  assert.equal(result.handlersFailed, 0);
  assert.equal(result.errors.length, 0);
});

// ---------------------------------------------------------------------------
// Tests: Critical Handler Failure
// ---------------------------------------------------------------------------

test("shutdown() logs critical handler failure", async () => {
  const shutdown = new GracefulShutdown({
    handlers: [
      {
        name: "critical-handler",
        handler: async () => { throw new Error("Critical failure"); },
        critical: true,
      },
    ],
  });

  const result = await shutdown.shutdown();

  assert.equal(result.success, false);
  assert.ok(result.errors.some((e) => e.includes("critical-handler")));
});

// ---------------------------------------------------------------------------
// Tests: Exit Handler Integration
// ---------------------------------------------------------------------------

test("exitHandler is called with 0 on successful shutdown via signal", async () => {
  let exitCode: number | undefined;
  const signalBus = createMockSignalBus();
  const shutdown = new GracefulShutdown({
    handlers: [createPassingHandler("handler")],
    signalBus,
    exitHandler: (code: number) => { exitCode = code; },
  });
  shutdown.registerSignalHandlers();

  signalBus.emit("SIGTERM");
  await flushMacrotask();
  await flushMacrotask();

  assert.equal(exitCode, 0);
});

test("exitHandler is called with 1 on failed shutdown via signal", async () => {
  let exitCode: number | undefined;
  const signalBus = createMockSignalBus();
  const shutdown = new GracefulShutdown({
    handlers: [createFailingHandler("handler")],
    signalBus,
    exitHandler: (code: number) => { exitCode = code; },
  });
  shutdown.registerSignalHandlers();

  signalBus.emit("SIGTERM");
  await flushMacrotask();
  await flushMacrotask();

  assert.equal(exitCode, 1);
});
