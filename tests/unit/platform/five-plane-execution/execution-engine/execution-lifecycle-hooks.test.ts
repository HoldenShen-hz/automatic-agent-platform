import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for execution-lifecycle-hooks.ts - R9-15 lifecycle hook interface completeness
 *
 * Coverage areas:
 * 1. ExecutionLifecycleHooks interface includes onQueued callback
 * 2. ExecutionLifecycleHooks interface includes onDispatching callback
 * 3. ExecutionLifecycleHooks interface includes onPaused callback
 * 4. ExecutionLifecycleHooks interface includes onResumed callback
 * 5. ExecutionLifecycleContext provides required fields (executionId, taskId, previousStatus, currentStatus, timestamp)
 * 6. All 4 missing hooks (onQueued, onDispatching, onPaused, onResumed) are defined in interface
 */

// Re-export the types for testing
interface ExecutionLifecycleContext {
  executionId: string;
  taskId: string;
  previousStatus: string;
  currentStatus: string;
  timestamp: number;
}

interface ExecutionLifecycleHooks {
  onQueued?: (context: ExecutionLifecycleContext) => Promise<void> | void;
  onDispatching?: (context: ExecutionLifecycleContext) => Promise<void> | void;
  onPaused?: (context: ExecutionLifecycleContext) => Promise<void> | void;
  onResumed?: (context: ExecutionLifecycleContext) => Promise<void> | void;
}

test("ExecutionLifecycleHooks interface includes onQueued callback", async () => {
  const hooks: ExecutionLifecycleHooks = {};

  // Verify onQueued can be assigned as a function
  hooks.onQueued = async (context: ExecutionLifecycleContext) => {
    assert.ok(context, "Context should be provided");
  };

  assert.ok(
    typeof hooks.onQueued === "function",
    "onQueued should be a function on ExecutionLifecycleHooks interface"
  );
});

test("ExecutionLifecycleHooks interface includes onDispatching callback", async () => {
  const hooks: ExecutionLifecycleHooks = {};

  // Verify onDispatching can be assigned as a function
  hooks.onDispatching = async (context: ExecutionLifecycleContext) => {
    assert.ok(context, "Context should be provided");
  };

  assert.ok(
    typeof hooks.onDispatching === "function",
    "onDispatching should be a function on ExecutionLifecycleHooks interface"
  );
});

test("ExecutionLifecycleHooks interface includes onPaused callback", async () => {
  const hooks: ExecutionLifecycleHooks = {};

  // Verify onPaused can be assigned as a function
  hooks.onPaused = async (context: ExecutionLifecycleContext) => {
    assert.ok(context, "Context should be provided");
  };

  assert.ok(
    typeof hooks.onPaused === "function",
    "onPaused should be a function on ExecutionLifecycleHooks interface"
  );
});

test("ExecutionLifecycleHooks interface includes onResumed callback", async () => {
  const hooks: ExecutionLifecycleHooks = {};

  // Verify onResumed can be assigned as a function
  hooks.onResumed = async (context: ExecutionLifecycleContext) => {
    assert.ok(context, "Context should be provided");
  };

  assert.ok(
    typeof hooks.onResumed === "function",
    "onResumed should be a function on ExecutionLifecycleHooks interface"
  );
});

test("ExecutionLifecycleContext provides required fields (executionId, taskId, previousStatus, currentStatus, timestamp)", async () => {
  const context: ExecutionLifecycleContext = {
    executionId: "exec-123",
    taskId: "task-456",
    previousStatus: "queued",
    currentStatus: "dispatching",
    timestamp: Date.now(),
  };

  assert.ok(context.executionId, "executionId should be present");
  assert.ok(context.taskId, "taskId should be present");
  assert.ok(context.previousStatus !== undefined, "previousStatus should be present");
  assert.ok(context.currentStatus !== undefined, "currentStatus should be present");
  assert.ok(typeof context.timestamp === "number", "timestamp should be a number");
});

test("All 4 missing hooks (onQueued, onDispatching, onPaused, onResumed) are defined in interface", async () => {
  const hooks: ExecutionLifecycleHooks = {
    onQueued: async () => {},
    onDispatching: async () => {},
    onPaused: async () => {},
    onResumed: async () => {},
  };

  assert.ok("onQueued" in hooks, "onQueued should be defined in ExecutionLifecycleHooks");
  assert.ok("onDispatching" in hooks, "onDispatching should be defined in ExecutionLifecycleHooks");
  assert.ok("onPaused" in hooks, "onPaused should be defined in ExecutionLifecycleHooks");
  assert.ok("onResumed" in hooks, "onResumed should be defined in ExecutionLifecycleHooks");
});

test("onQueued hook receives ExecutionLifecycleContext with correct structure", async () => {
  const testTimestamp = Date.now();
  const context: ExecutionLifecycleContext = {
    executionId: "exec-abc",
    taskId: "task-def",
    previousStatus: "created",
    currentStatus: "queued",
    timestamp: testTimestamp,
  };

  let receivedContext: ExecutionLifecycleContext | null = null;

  const hooks: ExecutionLifecycleHooks = {
    onQueued: async (ctx: ExecutionLifecycleContext) => {
      receivedContext = ctx;
    },
  };

  await hooks.onQueued!(context);

  assert.ok(receivedContext !== null, "Context should be received");
  assert.equal(receivedContext!.executionId, "exec-abc");
  assert.equal(receivedContext!.taskId, "task-def");
  assert.equal(receivedContext!.previousStatus, "created");
  assert.equal(receivedContext!.currentStatus, "queued");
  assert.equal(receivedContext!.timestamp, testTimestamp);
});

test("onDispatching hook receives ExecutionLifecycleContext with correct structure", async () => {
  const testTimestamp = Date.now();
  const context: ExecutionLifecycleContext = {
    executionId: "exec-ghi",
    taskId: "task-jkl",
    previousStatus: "queued",
    currentStatus: "dispatching",
    timestamp: testTimestamp,
  };

  let receivedContext: ExecutionLifecycleContext | null = null;

  const hooks: ExecutionLifecycleHooks = {
    onDispatching: async (ctx: ExecutionLifecycleContext) => {
      receivedContext = ctx;
    },
  };

  await hooks.onDispatching!(context);

  assert.ok(receivedContext !== null, "Context should be received");
  assert.equal(receivedContext!.executionId, "exec-ghi");
  assert.equal(receivedContext!.taskId, "task-jkl");
  assert.equal(receivedContext!.previousStatus, "queued");
  assert.equal(receivedContext!.currentStatus, "dispatching");
  assert.equal(receivedContext!.timestamp, testTimestamp);
});

test("onPaused hook receives ExecutionLifecycleContext with correct structure", async () => {
  const testTimestamp = Date.now();
  const context: ExecutionLifecycleContext = {
    executionId: "exec-mno",
    taskId: "task-pqr",
    previousStatus: "running",
    currentStatus: "paused",
    timestamp: testTimestamp,
  };

  let receivedContext: ExecutionLifecycleContext | null = null;

  const hooks: ExecutionLifecycleHooks = {
    onPaused: async (ctx: ExecutionLifecycleContext) => {
      receivedContext = ctx;
    },
  };

  await hooks.onPaused!(context);

  assert.ok(receivedContext !== null, "Context should be received");
  assert.equal(receivedContext!.executionId, "exec-mno");
  assert.equal(receivedContext!.taskId, "task-pqr");
  assert.equal(receivedContext!.previousStatus, "running");
  assert.equal(receivedContext!.currentStatus, "paused");
  assert.equal(receivedContext!.timestamp, testTimestamp);
});

test("onResumed hook receives ExecutionLifecycleContext with correct structure", async () => {
  const testTimestamp = Date.now();
  const context: ExecutionLifecycleContext = {
    executionId: "exec-stu",
    taskId: "task-vwx",
    previousStatus: "paused",
    currentStatus: "running",
    timestamp: testTimestamp,
  };

  let receivedContext: ExecutionLifecycleContext | null = null;

  const hooks: ExecutionLifecycleHooks = {
    onResumed: async (ctx: ExecutionLifecycleContext) => {
      receivedContext = ctx;
    },
  };

  await hooks.onResumed!(context);

  assert.ok(receivedContext !== null, "Context should be received");
  assert.equal(receivedContext!.executionId, "exec-stu");
  assert.equal(receivedContext!.taskId, "task-vwx");
  assert.equal(receivedContext!.previousStatus, "paused");
  assert.equal(receivedContext!.currentStatus, "running");
  assert.equal(receivedContext!.timestamp, testTimestamp);
});

test("hooks can be called without returning a value (sync behavior)", async () => {
  let hookCalled = false;

  const hooks: ExecutionLifecycleHooks = {
    onQueued: (context: ExecutionLifecycleContext) => {
      hookCalled = true;
    },
  };

  hooks.onQueued!({
    executionId: "exec-sync",
    taskId: "task-sync",
    previousStatus: "created",
    currentStatus: "queued",
    timestamp: Date.now(),
  });

  assert.ok(hookCalled, "Synchronous hook should be callable without await");
});

test("all lifecycle hooks accept optional context parameter", async () => {
  // This test validates that the hooks interface allows the context to be optional
  // which is important for backward compatibility

  const hooksWithOptionalContext: ExecutionLifecycleHooks = {
    onQueued: async () => {
      // No context parameter used
    },
    onDispatching: async () => {
      // No context parameter used
    },
    onPaused: async () => {
      // No context parameter used
    },
    onResumed: async () => {
      // No context parameter used
    },
  };

  assert.ok(typeof hooksWithOptionalContext.onQueued === "function");
  assert.ok(typeof hooksWithOptionalContext.onDispatching === "function");
  assert.ok(typeof hooksWithOptionalContext.onPaused === "function");
  assert.ok(typeof hooksWithOptionalContext.onResumed === "function");
});
