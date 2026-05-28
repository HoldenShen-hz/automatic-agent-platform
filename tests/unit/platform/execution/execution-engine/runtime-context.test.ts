import assert from "node:assert/strict";
import test from "node:test";

import {
  provideContext,
  getContext,
  getContextOrNull,
  withContextPatch,
  assertContext,
  getTenantId,
  getTenantIdOrNull,
  getWorkspaceId,
  getWorkspaceIdOrNull,
  hasTenantContext,
  hasWorkspaceContext,
  type RuntimeContextSnapshot,
} from "../../../../../src/platform/shared/context/runtime-context.js";

test("provideContext establishes context for synchronous function [runtime-context]", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_123",
    taskId: "task_456",
  };

  const result = provideContext(snapshot, () => {
    const ctx = getContext();
    return ctx.traceId;
  });

  assert.equal(result, "trace_123", "should return traceId from context");
});

test("provideContext establishes context for async function [runtime-context]", async () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_async",
    taskId: "task_async",
  };

  const result = await provideContext(snapshot, async () => {
    const ctx = getContext();
    return ctx.traceId;
  });

  assert.equal(result, "trace_async", "should return traceId from async context");
});

test("getContext returns current context snapshot [runtime-context]", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_get",
    taskId: "task_get",
    executionId: "exec_get",
  };

  provideContext(snapshot, () => {
    const ctx = getContext();
    assert.equal(ctx.traceId, "trace_get");
    assert.equal(ctx.taskId, "task_get");
    assert.equal(ctx.executionId, "exec_get");
  });
});

test("getContext throws when called outside provideContext [runtime-context]", () => {
  assert.throws(
    () => getContext(),
    /runtime_context.missing/,
    "getContext should throw when outside provideContext"
  );
});

test("getContextOrNull returns null outside provideContext [runtime-context]", () => {
  const ctx = getContextOrNull();
  assert.equal(ctx, null, "getContextOrNull should return null outside context");
});

test("getContextOrNull returns context inside provideContext [runtime-context]", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_null",
    taskId: "task_null",
  };

  provideContext(snapshot, () => {
    const ctx = getContextOrNull();
    assert.ok(ctx !== null, "getContextOrNull should return non-null inside context");
    assert.equal(ctx!.traceId, "trace_null");
  });
});

test("withContextPatch merges patch into existing context [runtime-context]", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_original",
    taskId: "task_original",
    divisionId: "original_division",
  };

  provideContext(snapshot, () => {
    const patched = withContextPatch({ divisionId: "new_division", sessionId: "sess_123" }, () => {
      const ctx = getContext();
      return ctx;
    });

    assert.equal(patched.traceId, "trace_original", "original fields should be preserved");
    assert.equal(patched.taskId, "task_original", "original fields should be preserved");
    assert.equal(patched.divisionId, "new_division", "patched field should have new value");
    assert.equal(patched.sessionId, "sess_123", "new field should be added");
  });
});

test("withContextPatch throws when called outside provideContext [runtime-context]", () => {
  assert.throws(
    () => withContextPatch({ taskId: "new_task" }, () => "result"),
    /runtime_context.missing/,
    "withContextPatch should throw when outside provideContext"
  );
});

test("assertContext returns context when all keys present [runtime-context]", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_assert",
    taskId: "task_assert",
    executionId: "exec_assert",
    sessionId: "sess_assert",
  };

  provideContext(snapshot, () => {
    const ctx = assertContext("traceId", "taskId");
    assert.equal(ctx.traceId, "trace_assert");
    assert.equal(ctx.taskId, "task_assert");
  });
});

test("assertContext throws when keys are missing [runtime-context]", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_missing",
    taskId: "",
    // executionId and sessionId are undefined
  };

  provideContext(snapshot, () => {
    assert.throws(
      () => assertContext("executionId", "sessionId"),
      /Missing required context fields: executionId, sessionId/,
      "assertContext should throw when required keys are missing"
    );
  });
});

test("assertContext throws with empty string [runtime-context]", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_empty",
    taskId: "", // empty string should fail assertion
  };

  provideContext(snapshot, () => {
    assert.throws(
      () => assertContext("taskId"),
      /Missing required context fields: taskId/,
      "assertContext should throw for empty string"
    );
  });
});

test("getTenantId returns tenant ID when set [runtime-context]", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_tenant",
    taskId: "task_tenant",
    tenantId: "tenant_abc",
  };

  provideContext(snapshot, () => {
    const tenantId = getTenantId();
    assert.equal(tenantId, "tenant_abc", "getTenantId should return tenant ID");
  });
});

test("getTenantId returns null when not set [runtime-context]", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_no_tenant",
    taskId: "task_no_tenant",
  };

  provideContext(snapshot, () => {
    const tenantId = getTenantId();
    assert.equal(tenantId, null, "getTenantId should return null when not set");
  });
});

test("getTenantIdOrNull is alias for getTenantId [runtime-context]", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_alias",
    taskId: "task_alias",
    tenantId: "tenant_alias",
  };

  provideContext(snapshot, () => {
    assert.equal(getTenantIdOrNull(), getTenantId(), "getTenantIdOrNull should equal getTenantId");
  });
});

test("getWorkspaceId returns workspace ID when set [runtime-context]", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_workspace",
    taskId: "task_workspace",
    workspaceId: "workspace_xyz",
  };

  provideContext(snapshot, () => {
    const workspaceId = getWorkspaceId();
    assert.equal(workspaceId, "workspace_xyz", "getWorkspaceId should return workspace ID");
  });
});

test("getWorkspaceId returns null when not set [runtime-context]", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_no_workspace",
    taskId: "task_no_workspace",
  };

  provideContext(snapshot, () => {
    const workspaceId = getWorkspaceId();
    assert.equal(workspaceId, null, "getWorkspaceId should return null when not set");
  });
});

test("getWorkspaceIdOrNull is alias for getWorkspaceId [runtime-context]", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_ws_alias",
    taskId: "task_ws_alias",
    workspaceId: "ws_alias",
  };

  provideContext(snapshot, () => {
    assert.equal(getWorkspaceIdOrNull(), getWorkspaceId(), "getWorkspaceIdOrNull should equal getWorkspaceId");
  });
});

test("hasTenantContext returns true when tenantId is set [runtime-context]", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_has_tenant",
    taskId: "task_has_tenant",
    tenantId: "tenant_present",
  };

  provideContext(snapshot, () => {
    assert.equal(hasTenantContext(), true, "hasTenantContext should return true when tenantId is set");
  });
});

test("hasTenantContext returns false when tenantId is null [runtime-context]", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_null_tenant",
    taskId: "task_null_tenant",
    tenantId: null,
  };

  provideContext(snapshot, () => {
    assert.equal(hasTenantContext(), false, "hasTenantContext should return false when tenantId is null");
  });
});

test("hasTenantContext returns false when tenantId is empty string [runtime-context]", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_empty_tenant",
    taskId: "task_empty_tenant",
    tenantId: "",
  };

  provideContext(snapshot, () => {
    assert.equal(hasTenantContext(), false, "hasTenantContext should return false for empty string");
  });
});

test("hasWorkspaceContext returns true when workspaceId is set [runtime-context]", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_has_workspace",
    taskId: "task_has_workspace",
    workspaceId: "workspace_present",
  };

  provideContext(snapshot, () => {
    assert.equal(hasWorkspaceContext(), true, "hasWorkspaceContext should return true when workspaceId is set");
  });
});

test("hasWorkspaceContext returns false when workspaceId is null [runtime-context]", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_null_workspace",
    taskId: "task_null_workspace",
    workspaceId: null,
  };

  provideContext(snapshot, () => {
    assert.equal(hasWorkspaceContext(), false, "hasWorkspaceContext should return false when workspaceId is null");
  });
});

test("hasWorkspaceContext returns false when workspaceId is empty string [runtime-context]", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_empty_workspace",
    taskId: "task_empty_workspace",
    workspaceId: "",
  };

  provideContext(snapshot, () => {
    assert.equal(hasWorkspaceContext(), false, "hasWorkspaceContext should return false for empty string");
  });
});

test("provideContext preserves all context fields [runtime-context]", () => {
  const fullSnapshot: RuntimeContextSnapshot = {
    traceId: "trace_full",
    spanId: "span_123",
    parentSpanId: "parent_456",
    taskId: "task_full",
    executionId: "exec_full",
    workflowId: "workflow_full",
    sessionId: "sess_full",
    agentId: "agent_full",
    divisionId: "division_full",
    workdir: "/tmp/work",
    requestId: "req_full",
    approvalId: "approval_full",
    abortSignalRef: "abort_123",
    budgetScopeId: "budget_full",
    tenantId: "tenant_full",
    workspaceId: "workspace_full",
  };

  provideContext(fullSnapshot, () => {
    const ctx = getContext();
    assert.equal(ctx.traceId, "trace_full");
    assert.equal(ctx.spanId, "span_123");
    assert.equal(ctx.parentSpanId, "parent_456");
    assert.equal(ctx.taskId, "task_full");
    assert.equal(ctx.executionId, "exec_full");
    assert.equal(ctx.workflowId, "workflow_full");
    assert.equal(ctx.sessionId, "sess_full");
    assert.equal(ctx.agentId, "agent_full");
    assert.equal(ctx.divisionId, "division_full");
    assert.equal(ctx.workdir, "/tmp/work");
    assert.equal(ctx.requestId, "req_full");
    assert.equal(ctx.approvalId, "approval_full");
    assert.equal(ctx.abortSignalRef, "abort_123");
    assert.equal(ctx.budgetScopeId, "budget_full");
    assert.equal(ctx.tenantId, "tenant_full");
    assert.equal(ctx.workspaceId, "workspace_full");
  });
});

test("provideContext nests correctly [runtime-context]", async () => {
  const snapshot1: RuntimeContextSnapshot = {
    traceId: "trace_outer",
    taskId: "task_outer",
  };

  await provideContext(snapshot1, async () => {
    const ctx1 = getContext();
    assert.equal(ctx1.traceId, "trace_outer");

    const snapshot2: RuntimeContextSnapshot = {
      ...ctx1,
      traceId: "trace_inner",
      sessionId: "sess_inner",
    };

    await provideContext(snapshot2, async () => {
      const ctx2 = getContext();
      assert.equal(ctx2.traceId, "trace_inner");
      assert.equal(ctx2.sessionId, "sess_inner");
      assert.equal(ctx2.taskId, "task_outer", "taskId from outer context should be preserved");
    });

    // After exiting inner context, outer context should be restored
    const ctx1Again = getContext();
    assert.equal(ctx1Again.traceId, "trace_outer");
  });
});

test("provideContext returns promise for async function [runtime-context]", async () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace_promise",
    taskId: "task_promise",
  };

  const promise = provideContext(snapshot, async () => {
    return getContext();
  });

  assert.ok(promise instanceof Promise, "provideContext should return Promise for async function");
  const ctx = await promise;
  assert.equal(ctx.traceId, "trace_promise");
});
