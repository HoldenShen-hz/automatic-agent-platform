import assert from "node:assert/strict";
import test from "node:test";

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

function createContext(
  overrides: Partial<ExecutionLifecycleContext> = {},
): ExecutionLifecycleContext {
  return {
    executionId: "exec-1",
    taskId: "task-1",
    previousStatus: "created",
    currentStatus: "queued",
    timestamp: Date.now(),
    ...overrides,
  };
}

test("ExecutionLifecycleHooks supports queued and dispatching callbacks", async () => {
  const received: ExecutionLifecycleContext[] = [];
  const hooks: ExecutionLifecycleHooks = {
    onQueued: async (context) => {
      received.push(context);
    },
    onDispatching: async (context) => {
      received.push(context);
    },
  };

  await hooks.onQueued?.(createContext());
  await hooks.onDispatching?.(createContext({
    previousStatus: "queued",
    currentStatus: "dispatching",
  }));

  const queued = received[0];
  const dispatching = received[1];
  assert.ok(queued);
  assert.ok(dispatching);
  assert.equal(queued.currentStatus, "queued");
  assert.equal(dispatching.currentStatus, "dispatching");
});

test("ExecutionLifecycleHooks supports paused and resumed callbacks", async () => {
  const received: ExecutionLifecycleContext[] = [];
  const hooks: ExecutionLifecycleHooks = {
    onPaused: async (context) => {
      received.push(context);
    },
    onResumed: async (context) => {
      received.push(context);
    },
  };

  await hooks.onPaused?.(createContext({
    previousStatus: "running",
    currentStatus: "paused",
  }));
  await hooks.onResumed?.(createContext({
    previousStatus: "paused",
    currentStatus: "running",
  }));

  const paused = received[0];
  const resumed = received[1];
  assert.ok(paused);
  assert.ok(resumed);
  assert.equal(paused.currentStatus, "paused");
  assert.equal(resumed.currentStatus, "running");
});

test("ExecutionLifecycleContext preserves canonical execution identity fields", () => {
  const context = createContext({
    executionId: "exec-abc",
    taskId: "task-xyz",
    previousStatus: "queued",
    currentStatus: "dispatching",
    timestamp: 123,
  });

  assert.deepEqual(context, {
    executionId: "exec-abc",
    taskId: "task-xyz",
    previousStatus: "queued",
    currentStatus: "dispatching",
    timestamp: 123,
  });
});
