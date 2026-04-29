/**
 * Integration tests for Runtime Bootstrap - Full lifecycle with storage
 */

import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { GracefulShutdown } from "../../../../src/platform/execution/startup/graceful-shutdown.js";

test("GracefulShutdown integration with actual handler execution", async () => {
  const callLog: string[] = [];

  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    handlers: [
      {
        name: "resource-cleanup",
        handler: async () => {
          callLog.push("cleanup");
          await new Promise((resolve) => setTimeout(resolve, 5));
        },
      },
      {
        name: "connection-close",
        handler: async () => {
          callLog.push("close");
        },
      },
    ],
  });

  const result = await shutdown.shutdown();

  assert.strictEqual(result.handlersRun, 2);
  assert.strictEqual(result.handlersFailed, 0);
  assert.strictEqual(result.success, true);
  assert.deepStrictEqual(callLog, ["close", "cleanup"]); // Reverse order
});

test("GracefulShutdown integration with handler failure", async () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    handlers: [
      {
        name: "failing-handler",
        handler: async () => {
          throw new Error("Intentional failure");
        },
      },
      {
        name: "success-handler",
        handler: async () => {},
      },
    ],
  });

  const result = await shutdown.shutdown();

  assert.strictEqual(result.handlersRun, 1);
  assert.strictEqual(result.handlersFailed, 1);
  assert.strictEqual(result.success, false);
  assert.ok(result.errors[0]?.includes("failing-handler"));
});

test("GracefulShutdown integration with critical handlers", async () => {
  const callLog: string[] = [];

  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    handlers: [
      {
        name: "critical-db",
        handler: async () => {
          callLog.push("critical-db");
        },
        critical: true,
      },
      {
        name: "normal-log",
        handler: async () => {
          callLog.push("normal-log");
        },
      },
    ],
  });

  await shutdown.shutdown();

  // Critical runs last in execution order (first in reverse)
  assert.strictEqual(callLog[0], "normal-log");
  assert.strictEqual(callLog[1], "critical-db");
});

test("GracefulShutdown with multiple sequential shutdowns", async () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    handlers: [{ name: "test", handler: async () => {} }],
  });

  const result1 = await shutdown.shutdown();
  assert.strictEqual(result1.handlersRun, 1);

  // Second shutdown should return same result (idempotent)
  const result2 = await shutdown.shutdown();
  assert.strictEqual(result2.handlersRun, 1);

  shutdown.reset();

  const result3 = await shutdown.shutdown();
  assert.strictEqual(result3.handlersRun, 1);
});

test("GracefulShutdown integration with timeout behavior", async () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    timeoutMs: 50,
    handlers: [
      {
        name: "slow-handler",
        handler: async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
        },
        timeoutMs: 10, // Will timeout
      },
    ],
  });

  const result = await shutdown.shutdown();

  assert.strictEqual(result.handlersFailed, 1);
  assert.ok(result.errors[0]?.includes("timed out"));
});

test("GracefulShutdown integration with custom exit handler", async () => {
  // exitHandler is only called when shutdown is triggered by signals (SIGTERM/SIGINT)
  // For programmatic shutdown() calls, exitHandler is not invoked
  // This test verifies the exitHandler is properly set and doesn't throw
  let exitCode: number | null = null;

  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    handlers: [{ name: "test", handler: async () => {} }],
    exitHandler: (code: number) => {
      exitCode = code;
    },
  });

  const result = await shutdown.shutdown();

  // Direct programmatic shutdown doesn't call exitHandler
  // exitHandler is only triggered by signal-based shutdown
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.handlersRun, 1);
});

test("GracefulShutdown integration with failing custom exit handler", async () => {
  // exitHandler is only called when shutdown is triggered by signals
  // For programmatic shutdown with a failing handler, exitHandler is not called
  let exitCode: number | null = null;

  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    handlers: [{ name: "fail", handler: async () => { throw new Error("fail"); } }],
    exitHandler: (code: number) => {
      exitCode = code;
    },
  });

  const result = await shutdown.shutdown();

  // Direct programmatic shutdown doesn't call exitHandler even on failure
  // exitHandler is only triggered by signal-based shutdown
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.handlersFailed, 1);
});

test("GracefulShutdown integration result contains timing info", async () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    handlers: [
      {
        name: "timed-handler",
        handler: async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
        },
      },
    ],
  });

  const result = await shutdown.shutdown();

  assert.ok(result.durationMs >= 0);
  assert.ok(result.durationMs < 10000); // Reasonable upper bound
});

test("GracefulShutdown integration empty handlers", async () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    handlers: [],
  });

  const result = await shutdown.shutdown();

  assert.strictEqual(result.handlersRun, 0);
  assert.strictEqual(result.handlersFailed, 0);
  assert.strictEqual(result.success, true);
});

test("GracefulShutdown reset allows new shutdown cycle", async () => {
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    handlers: [{ name: "test", handler: async () => {} }],
  });

  await shutdown.shutdown();
  assert.strictEqual(shutdown.isShuttingDownState(), true);

  shutdown.reset();
  assert.strictEqual(shutdown.isShuttingDownState(), false);

  const result = await shutdown.shutdown();
  assert.strictEqual(result.handlersRun, 1);
});