import test from "node:test";
import assert from "node:assert/strict";
import { provideContext, getContext, getContextOrNull, withContextPatch, assertContext, getTenantId, getWorkspaceId, hasTenantContext, hasWorkspaceContext, type RuntimeContextSnapshot } from "../../../../src/platform/shared/context/runtime-context.js";

/**
 * Tests for src/platform/shared/context/runtime-context.ts
 * AsyncLocalStorage-based runtime context propagation
 */

/**
 * Helper to create a minimal RuntimeContextSnapshot
 */
function createSnapshot(overrides: Partial<RuntimeContextSnapshot> = {}): RuntimeContextSnapshot {
  return {
    traceId: "trace_test",
    spanId: null,
    parentSpanId: null,
    taskId: "task_test",
    executionId: null,
    workflowId: null,
    sessionId: null,
    agentId: null,
    divisionId: null,
    workdir: null,
    requestId: null,
    approvalId: null,
    abortSignalRef: null,
    budgetScopeId: null,
    tenantId: null,
    workspaceId: null,
    ...overrides,
  };
}

test("provideContext makes context available within callback", () => {
  const snapshot = createSnapshot({ taskId: "task_provide_test" });

  const result = provideContext(snapshot, () => {
    const ctx = getContext();
    return ctx.taskId;
  });

  assert.equal(result, "task_provide_test");
});

test("provideContext returns promise when callback returns promise", async () => {
  const snapshot = createSnapshot({ executionId: "exec_async" });

  const result = await provideContext(snapshot, async () => {
    await new Promise((resolve) => setTimeout(resolve, 1));
    return getContext().executionId;
  });

  assert.equal(result, "exec_async");
});

test("getContext throws when called outside provideContext", () => {
  assert.throws(
    () => getContext(),
    (err: Error) => err.message.includes("runtime_context.missing"),
  );
});

test("getContext returns full context snapshot", () => {
  const snapshot = createSnapshot({
    traceId: "trace_full",
    taskId: "task_full",
    executionId: "exec_full",
    sessionId: "sess_full",
    agentId: "agent_full",
  });

  provideContext(snapshot, () => {
    const ctx = getContext();
    assert.equal(ctx.traceId, "trace_full");
    assert.equal(ctx.taskId, "task_full");
    assert.equal(ctx.executionId, "exec_full");
    assert.equal(ctx.sessionId, "sess_full");
    assert.equal(ctx.agentId, "agent_full");
  });
});

test("getContextOrNull returns null outside provideContext", () => {
  assert.equal(getContextOrNull(), null);
});

test("getContextOrNull returns context inside provideContext", () => {
  const snapshot = createSnapshot({ taskId: "task_or_null" });

  provideContext(snapshot, () => {
    const ctx = getContextOrNull();
    assert.ok(ctx != null);
    assert.equal(ctx!.taskId, "task_or_null");
  });
});

test("withContextPatch creates patched context within callback", () => {
  const snapshot = createSnapshot({
    taskId: "task_patch",
    executionId: "exec_original",
  });

  provideContext(snapshot, () => {
    withContextPatch({ executionId: "exec_patched", spanId: "span_new" }, () => {
      const ctx = getContext();
      assert.equal(ctx.executionId, "exec_patched");
      assert.equal(ctx.spanId, "span_new");
      assert.equal(ctx.taskId, "task_patch");
    });
  });
});

test("withContextPatch restores original context after callback", () => {
  const snapshot = createSnapshot({
    taskId: "task_restore",
    executionId: "exec_original",
  });

  provideContext(snapshot, () => {
    withContextPatch({ executionId: "exec_temp" }, () => {
      // Inside patch scope
    });
    // After patch scope
    const ctx = getContext();
    assert.equal(ctx.executionId, "exec_original");
  });
});

test("withContextPatch throws when called outside provideContext", () => {
  assert.throws(
    () => withContextPatch({ executionId: "exec_x" }, () => {}),
    (err: Error) => err.message.includes("runtime_context.missing"),
  );
});

test("assertContext returns context when all required keys present", () => {
  const snapshot = createSnapshot({
    traceId: "trace_assert",
    taskId: "task_assert",
    executionId: "exec_assert",
  });

  provideContext(snapshot, () => {
    const ctx = assertContext("traceId", "taskId", "executionId");
    assert.equal(ctx.traceId, "trace_assert");
  });
});

test("assertContext throws with list of missing fields", () => {
  const snapshot = createSnapshot({ traceId: "trace_missing" }); // Missing taskId and executionId

  provideContext(snapshot, () => {
    assert.throws(
      () => assertContext("traceId", "taskId", "executionId"),
      (err: Error) => {
        return err.message.includes("taskId") && err.message.includes("executionId");
      },
    );
  });
});

test("assertContext passes when only some required keys are checked", () => {
  const snapshot = createSnapshot({ traceId: "trace_some" });

  provideContext(snapshot, () => {
    const ctx = assertContext("traceId");
    assert.equal(ctx.traceId, "trace_some");
  });
});

test("getTenantId returns tenantId from context", () => {
  const snapshot = createSnapshot({ tenantId: "tenant_get_test" });

  provideContext(snapshot, () => {
    assert.equal(getTenantId(), "tenant_get_test");
  });
});

test("getTenantId returns null when tenantId is null", () => {
  const snapshot = createSnapshot({ tenantId: null });

  provideContext(snapshot, () => {
    assert.equal(getTenantId(), null);
  });
});

test("getTenantId returns null outside provideContext", () => {
  assert.equal(getTenantId(), null);
});

test("getWorkspaceId returns workspaceId from context", () => {
  const snapshot = createSnapshot({ workspaceId: "workspace_get_test" });

  provideContext(snapshot, () => {
    assert.equal(getWorkspaceId(), "workspace_get_test");
  });
});

test("getWorkspaceId returns null when workspaceId is null", () => {
  const snapshot = createSnapshot({ workspaceId: null });

  provideContext(snapshot, () => {
    assert.equal(getWorkspaceId(), null);
  });
});

test("getWorkspaceId returns null outside provideContext", () => {
  assert.equal(getWorkspaceId(), null);
});

test("hasTenantContext returns true when tenantId is non-empty", () => {
  const snapshot = createSnapshot({ tenantId: "tenant_has_it" });

  provideContext(snapshot, () => {
    assert.equal(hasTenantContext(), true);
  });
});

test("hasTenantContext returns false when tenantId is null", () => {
  const snapshot = createSnapshot({ tenantId: null });

  provideContext(snapshot, () => {
    assert.equal(hasTenantContext(), false);
  });
});

test("hasTenantContext returns false when tenantId is empty string", () => {
  const snapshot = createSnapshot({ tenantId: "" });

  provideContext(snapshot, () => {
    assert.equal(hasTenantContext(), false);
  });
});

test("hasWorkspaceContext returns true when workspaceId is non-empty", () => {
  const snapshot = createSnapshot({ workspaceId: "workspace_has_it" });

  provideContext(snapshot, () => {
    assert.equal(hasWorkspaceContext(), true);
  });
});

test("hasWorkspaceContext returns false when workspaceId is null", () => {
  const snapshot = createSnapshot({ workspaceId: null });

  provideContext(snapshot, () => {
    assert.equal(hasWorkspaceContext(), false);
  });
});

test("hasWorkspaceContext returns false when workspaceId is empty string", () => {
  const snapshot = createSnapshot({ workspaceId: "" });

  provideContext(snapshot, () => {
    assert.equal(hasWorkspaceContext(), false);
  });
});

test("context is isolated across concurrent async operations", async () => {
  const task1 = provideContext(createSnapshot({ taskId: "task_concurrent_1" }), async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return getContext().taskId;
  });

  const task2 = provideContext(createSnapshot({ taskId: "task_concurrent_2" }), async () => {
    await new Promise((resolve) => setTimeout(resolve, 2));
    return getContext().taskId;
  });

  const [result1, result2] = await Promise.all([task1, task2]);

  assert.ok(result1 === "task_concurrent_1" || result1 === "task_concurrent_2");
  assert.ok(result2 === "task_concurrent_1" || result2 === "task_concurrent_2");
  assert.notStrictEqual(result1, result2);
});

test("nested provideContext creates inner context", () => {
  const outer = createSnapshot({ taskId: "task_outer" });
  const inner = createSnapshot({ taskId: "task_inner" });

  provideContext(outer, () => {
    assert.equal(getContext().taskId, "task_outer");

    provideContext(inner, () => {
      assert.equal(getContext().taskId, "task_inner");
    });

    // After inner context exits, outer context restored
    assert.equal(getContext().taskId, "task_outer");
  });
});