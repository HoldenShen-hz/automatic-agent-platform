import test from "node:test";
import assert from "node:assert/strict";

import {
  provideContext,
  getContext,
  getContextOrNull,
  withContextPatch,
  assertContext,
  type RuntimeContextSnapshot,
} from "../../../src/platform/five-plane-execution/execution-engine/runtime-context.js";

function baseContext(overrides: Partial<RuntimeContextSnapshot> = {}): RuntimeContextSnapshot {
  return {
    traceId: "trace_test",
    taskId: "task_test",
    ...overrides,
  };
}

test("getContext throws when called outside provideContext", () => {
  assert.throws(
    () => getContext(),
    (err: Error) => err.message.includes("runtime_context.missing"),
  );
});

test("getContextOrNull returns null outside provideContext", () => {
  assert.equal(getContextOrNull(), null);
});

test("provideContext makes context available via getContext", () => {
  const ctx = baseContext({ executionId: "exec_1" });
  provideContext(ctx, () => {
    const retrieved = getContext();
    assert.equal(retrieved.traceId, "trace_test");
    assert.equal(retrieved.taskId, "task_test");
    assert.equal(retrieved.executionId, "exec_1");
  });
});

test("nested async calls preserve context", async () => {
  const ctx = baseContext({ sessionId: "sess_1" });
  await provideContext(ctx, async () => {
    const inner = await nestedAsyncRead();
    assert.equal(inner.sessionId, "sess_1");
    assert.equal(inner.taskId, "task_test");
  });
});

async function nestedAsyncRead(): Promise<RuntimeContextSnapshot> {
  await new Promise((resolve) => setTimeout(resolve, 1));
  return getContext();
}

test("concurrent tasks do not leak context between each other", async () => {
  const results: string[] = [];

  const task1 = provideContext(baseContext({ taskId: "task_A" }), async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    results.push(getContext().taskId);
  });

  const task2 = provideContext(baseContext({ taskId: "task_B" }), async () => {
    await new Promise((resolve) => setTimeout(resolve, 2));
    results.push(getContext().taskId);
  });

  await Promise.all([task1, task2]);

  assert.ok(results.includes("task_A"));
  assert.ok(results.includes("task_B"));
  assert.equal(results.length, 2);
});

test("withContextPatch merges partial fields without losing existing context", () => {
  const ctx = baseContext({
    executionId: "exec_1",
    sessionId: "sess_1",
    agentId: "agent_1",
  });
  provideContext(ctx, () => {
    withContextPatch({ executionId: "exec_2", spanId: "span_new" }, () => {
      const patched = getContext();
      assert.equal(patched.executionId, "exec_2");
      assert.equal(patched.spanId, "span_new");
      // Preserved from parent
      assert.equal(patched.sessionId, "sess_1");
      assert.equal(patched.agentId, "agent_1");
      assert.equal(patched.taskId, "task_test");
    });
    // After patch scope, original context is restored
    const restored = getContext();
    assert.equal(restored.executionId, "exec_1");
    assert.equal(restored.spanId, undefined);
  });
});

test("withContextPatch throws when called outside provideContext", () => {
  assert.throws(
    () => withContextPatch({ executionId: "exec_x" }, () => {}),
    (err: Error) => err.message.includes("runtime_context.missing"),
  );
});

test("assertContext passes when all required keys are present", () => {
  provideContext(baseContext({ executionId: "exec_1", sessionId: "sess_1" }), () => {
    const ctx = assertContext("traceId", "taskId", "executionId");
    assert.equal(ctx.traceId, "trace_test");
  });
});

test("assertContext throws listing missing keys", () => {
  provideContext(baseContext(), () => {
    assert.throws(
      () => assertContext("traceId", "executionId", "agentId"),
      (err: Error) => {
        return err.message.includes("executionId") && err.message.includes("agentId");
      },
    );
  });
});

test("detached task without explicit context fails on getContext", async () => {
  let detachedError: Error | null = null;

  provideContext(baseContext(), () => {
    // Simulate a detached background task that does NOT inherit context
    setTimeout(() => {
      // Context should still be available here since setTimeout inherits ALS
      // But if someone explicitly enters a new scope without context, it should fail
    }, 0);
  });

  // Outside provideContext — simulates truly detached work
  try {
    getContext();
  } catch (err) {
    detachedError = err as Error;
  }
  assert.ok(detachedError != null);
  assert.ok(detachedError.message.includes("runtime_context.missing"));
});

test("recovery execution refreshes executionId while preserving taskId and traceId lineage", () => {
  const originalCtx = baseContext({
    executionId: "exec_original",
    sessionId: "sess_1",
  });

  provideContext(originalCtx, () => {
    // Simulate recovery: new execution with same task/trace lineage
    withContextPatch({ executionId: "exec_recovery" }, () => {
      const recoveryCtx = getContext();
      assert.equal(recoveryCtx.executionId, "exec_recovery");
      assert.equal(recoveryCtx.taskId, "task_test");
      assert.equal(recoveryCtx.traceId, "trace_test");
      assert.equal(recoveryCtx.sessionId, "sess_1");
    });

    // Original execution context is intact after recovery scope
    assert.equal(getContext().executionId, "exec_original");
  });
});
