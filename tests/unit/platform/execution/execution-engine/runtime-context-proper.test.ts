/**
 * Unit Tests: Runtime Context
 *
 * Tests the runtime context propagation via AsyncLocalStorage.
 * Tests context creation, retrieval, patching, and nested contexts.
 */

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
} from "../../../../../src/platform/five-plane-execution/execution-engine/runtime-context.js";
import type { RuntimeContextSnapshot } from "../../../../../src/platform/shared/context/runtime-context.js";

function createSnapshot(overrides: Partial<RuntimeContextSnapshot> = {}): RuntimeContextSnapshot {
  return {
    traceId: "trace-123",
    taskId: "task-456",
    executionId: "exec-789",
    workflowId: "wf-101",
    sessionId: "session-202",
    agentId: "agent-303",
    divisionId: "div-404",
    workdir: "/tmp",
    requestId: "req-505",
    approvalId: "approval-606",
    abortSignalRef: "signal-707",
    budgetScopeId: "budget-808",
    tenantId: "tenant-909",
    workspaceId: "workspace-101",
    spanId: null,
    parentSpanId: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// provideContext
// ---------------------------------------------------------------------------

test("provideContext runs function within context snapshot [runtime-context-proper]", () => {
  const snapshot = createSnapshot({ taskId: "context-task" });
  const result = provideContext(snapshot, () => {
    return getContext().taskId;
  });
  assert.equal(result, "context-task");
});

test("provideContext returns promise resolution for async functions [runtime-context-proper]", async () => {
  const snapshot = createSnapshot({ taskId: "async-context-task" });
  const result = await provideContext(snapshot, async () => {
    return getContext().taskId;
  });
  assert.equal(result, "async-context-task");
});

test("provideContext passes through sync return values [runtime-context-proper]", () => {
  const snapshot = createSnapshot();
  const result = provideContext(snapshot, () => {
    return 42;
  });
  assert.equal(result, 42);
});

test("provideContext returns promise for async function [runtime-context-proper]", async () => {
  const snapshot = createSnapshot();
  const promise = provideContext(snapshot, async () => {
    return getContext();
  });

  assert.ok(promise instanceof Promise);
  const ctx = await promise;
  assert.equal(ctx.traceId, "trace-123");
});

// ---------------------------------------------------------------------------
// getContext
// ---------------------------------------------------------------------------

test("getContext returns snapshot when inside provideContext [runtime-context-proper]", () => {
  const snapshot = createSnapshot({ tenantId: "test-tenant" });
  provideContext(snapshot, () => {
    const ctx = getContext();
    assert.equal(ctx.traceId, "trace-123");
    assert.equal(ctx.tenantId, "test-tenant");
    assert.equal(ctx.taskId, "task-456");
  });
});

test("getContext throws ValidationError when outside provideContext [runtime-context-proper]", () => {
  let threw = false;
  try {
    getContext();
  } catch (err) {
    threw = true;
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("runtime_context.missing"));
  }
  assert.equal(threw, true);
});

// ---------------------------------------------------------------------------
// getContextOrNull
// ---------------------------------------------------------------------------

test("getContextOrNull returns snapshot when inside provideContext [runtime-context-proper]", () => {
  const snapshot = createSnapshot();
  const result = provideContext(snapshot, () => {
    return getContextOrNull()?.taskId ?? null;
  });
  assert.equal(result, "task-456");
});

test("getContextOrNull returns null when outside provideContext [runtime-context-proper]", () => {
  const result = getContextOrNull();
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// withContextPatch
// ---------------------------------------------------------------------------

test("withContextPatch creates new context with merged patch [runtime-context-proper]", async () => {
  const original = createSnapshot({ tenantId: "original-tenant", taskId: "original-task" });
  const result = await provideContext(original, () => {
    return withContextPatch({ tenantId: "patched-tenant" }, () => {
      const ctx = getContext();
      return { tenantId: ctx.tenantId, taskId: ctx.taskId };
    });
  });
  assert.equal(result.tenantId, "patched-tenant");
  assert.equal(result.taskId, "original-task");
});

test("withContextPatch adds new fields from patch [runtime-context-proper]", async () => {
  const original = createSnapshot({ taskId: "original-task" });
  const result = await provideContext(original, () => {
    return withContextPatch({ sessionId: "new-session" }, () => {
      const ctx = getContext();
      return ctx.sessionId;
    });
  });
  assert.equal(result, "new-session");
});

test("withContextPatch does not modify original context [runtime-context-proper]", () => {
  const original = createSnapshot({ tenantId: "original-tenant" });
  provideContext(original, () => {
    withContextPatch({ tenantId: "patched-tenant" }, () => {
      return getContext().tenantId;
    });
    const ctx = getContext();
    assert.equal(ctx.tenantId, "original-tenant");
  });
});

test("withContextPatch throws when called outside provideContext [runtime-context-proper]", () => {
  assert.throws(
    () => withContextPatch({ taskId: "new-task" }, () => "result"),
    /runtime_context.missing/,
  );
});

// ---------------------------------------------------------------------------
// assertContext
// ---------------------------------------------------------------------------

test("assertContext returns context when all required keys present [runtime-context-proper]", () => {
  const snapshot = createSnapshot({ taskId: "task-123", tenantId: "tenant-456" });
  provideContext(snapshot, () => {
    const ctx = assertContext("taskId", "tenantId");
    assert.equal(ctx.taskId, "task-123");
    assert.equal(ctx.tenantId, "tenant-456");
  });
});

test("assertContext throws for missing required keys [runtime-context-proper]", () => {
  const snapshot = createSnapshot({ taskId: "task-123", tenantId: "" });
  let threw = false;
  try {
    provideContext(snapshot, () => {
      assertContext("taskId", "tenantId");
    });
  } catch (err) {
    threw = true;
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("Missing required context fields"));
    assert.ok(err.message.includes("tenantId"));
  }
  assert.equal(threw, true);
});

test("assertContext accepts single key [runtime-context-proper]", () => {
  const snapshot = createSnapshot({ traceId: "trace-abc" });
  provideContext(snapshot, () => {
    const ctx = assertContext("traceId");
    assert.equal(ctx.traceId, "trace-abc");
  });
});

test("assertContext throws for undefined values [runtime-context-proper]", () => {
  const snapshot = createSnapshot({ taskId: undefined as unknown as string });
  provideContext(snapshot, () => {
    assert.throws(
      () => assertContext("taskId"),
      /Missing required context fields: taskId/,
    );
  });
});

// ---------------------------------------------------------------------------
// getTenantId
// ---------------------------------------------------------------------------

test("getTenantId returns tenantId from context [runtime-context-proper]", () => {
  const snapshot = createSnapshot({ tenantId: "my-tenant" });
  const result = provideContext(snapshot, () => {
    return getTenantId();
  });
  assert.equal(result, "my-tenant");
});

test("getTenantId returns null when tenantId is not set [runtime-context-proper]", () => {
  const snapshot = createSnapshot({ tenantId: null as unknown as string });
  const result = provideContext(snapshot, () => {
    return getTenantId();
  });
  assert.equal(result, null);
});

test("getTenantId returns null when outside context [runtime-context-proper]", () => {
  const result = getTenantId();
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// getTenantIdOrNull
// ---------------------------------------------------------------------------

test("getTenantIdOrNull is alias for getTenantId [runtime-context-proper]", () => {
  const snapshot = createSnapshot({ tenantId: "alias-tenant" });
  const result = provideContext(snapshot, () => {
    return getTenantIdOrNull();
  });
  assert.equal(result, "alias-tenant");
});

// ---------------------------------------------------------------------------
// getWorkspaceId
// ---------------------------------------------------------------------------

test("getWorkspaceId returns workspaceId from context [runtime-context-proper]", () => {
  const snapshot = createSnapshot({ workspaceId: "my-workspace" });
  const result = provideContext(snapshot, () => {
    return getWorkspaceId();
  });
  assert.equal(result, "my-workspace");
});

test("getWorkspaceId returns null when workspaceId is not set [runtime-context-proper]", () => {
  const snapshot = createSnapshot({ workspaceId: null as unknown as string });
  const result = provideContext(snapshot, () => {
    return getWorkspaceId();
  });
  assert.equal(result, null);
});

test("getWorkspaceId returns null when outside context [runtime-context-proper]", () => {
  const result = getWorkspaceId();
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// getWorkspaceIdOrNull
// ---------------------------------------------------------------------------

test("getWorkspaceIdOrNull is alias for getWorkspaceId [runtime-context-proper]", () => {
  const snapshot = createSnapshot({ workspaceId: "alias-workspace" });
  const result = provideContext(snapshot, () => {
    return getWorkspaceIdOrNull();
  });
  assert.equal(result, "alias-workspace");
});

// ---------------------------------------------------------------------------
// hasTenantContext
// ---------------------------------------------------------------------------

test("hasTenantContext returns true when tenantId is set [runtime-context-proper]", () => {
  const snapshot = createSnapshot({ tenantId: "valid-tenant" });
  provideContext(snapshot, () => {
    assert.equal(hasTenantContext(), true);
  });
});

test("hasTenantContext returns false when tenantId is empty string [runtime-context-proper]", () => {
  const snapshot = createSnapshot({ tenantId: "" });
  provideContext(snapshot, () => {
    assert.equal(hasTenantContext(), false);
  });
});

test("hasTenantContext returns false when tenantId is null [runtime-context-proper]", () => {
  const snapshot = createSnapshot({ tenantId: null as unknown as string });
  provideContext(snapshot, () => {
    assert.equal(hasTenantContext(), false);
  });
});

test("hasTenantContext returns false when outside context [runtime-context-proper]", () => {
  assert.equal(hasTenantContext(), false);
});

// ---------------------------------------------------------------------------
// hasWorkspaceContext
// ---------------------------------------------------------------------------

test("hasWorkspaceContext returns true when workspaceId is set [runtime-context-proper]", () => {
  const snapshot = createSnapshot({ workspaceId: "valid-workspace" });
  provideContext(snapshot, () => {
    assert.equal(hasWorkspaceContext(), true);
  });
});

test("hasWorkspaceContext returns false when workspaceId is empty string [runtime-context-proper]", () => {
  const snapshot = createSnapshot({ workspaceId: "" });
  provideContext(snapshot, () => {
    assert.equal(hasWorkspaceContext(), false);
  });
});

test("hasWorkspaceContext returns false when workspaceId is null [runtime-context-proper]", () => {
  const snapshot = createSnapshot({ workspaceId: null as unknown as string });
  provideContext(snapshot, () => {
    assert.equal(hasWorkspaceContext(), false);
  });
});

test("hasWorkspaceContext returns false when outside context [runtime-context-proper]", () => {
  assert.equal(hasWorkspaceContext(), false);
});

// ---------------------------------------------------------------------------
// Nested contexts
// ---------------------------------------------------------------------------

test("nested provideContext creates independent contexts [runtime-context-proper]", () => {
  const outer = createSnapshot({ taskId: "outer-task", tenantId: "outer-tenant" });
  const inner = createSnapshot({ taskId: "inner-task", tenantId: "inner-tenant" });

  provideContext(outer, () => {
    assert.equal(getContext().taskId, "outer-task");

    provideContext(inner, () => {
      assert.equal(getContext().taskId, "inner-task");
    });

    // Outer context is restored after exiting inner
    assert.equal(getContext().taskId, "outer-task");
  });
});

test("nested context completely replaces outer context [runtime-context-proper]", () => {
  const outer = createSnapshot({ tenantId: "outer-tenant", divisionId: "outer-div" });
  const inner = createSnapshot({ tenantId: "inner-tenant", divisionId: "inner-div" });

  provideContext(outer, () => {
    const outerCtx = getContext();
    assert.equal(outerCtx.tenantId, "outer-tenant");
    assert.equal(outerCtx.divisionId, "outer-div");

    provideContext(inner, () => {
      const ctx = getContext();
      assert.equal(ctx.tenantId, "inner-tenant");
      assert.equal(ctx.divisionId, "inner-div");
      // Inner context does NOT inherit from outer - it's a complete replacement
    });

    // After inner context exits, outer is restored
    const restoredCtx = getContext();
    assert.equal(restoredCtx.tenantId, "outer-tenant");
    assert.equal(restoredCtx.divisionId, "outer-div");
  });
});

test("withContextPatch creates new context inheriting from current [runtime-context-proper]", () => {
  // This tests that withContextPatch DOES inherit from current context
  // while provideContext does NOT
  const outer = createSnapshot({ tenantId: "outer-tenant", divisionId: "outer-div" });

  provideContext(outer, () => {
    withContextPatch({ tenantId: "patched-tenant" }, () => {
      const ctx = getContext();
      assert.equal(ctx.tenantId, "patched-tenant");
      assert.equal(ctx.divisionId, "outer-div", "divisionId inherited from outer context");
    });

    // Original context preserved after patch
    const original = getContext();
    assert.equal(original.tenantId, "outer-tenant");
    assert.equal(original.divisionId, "outer-div");
  });
});

// ---------------------------------------------------------------------------
// Full context snapshot
// ---------------------------------------------------------------------------

test("context snapshot preserves all fields [runtime-context-proper]", () => {
  const snapshot = createSnapshot({
    traceId: "full-trace",
    spanId: "span-abc",
    parentSpanId: "parent-def",
    taskId: "full-task",
    executionId: "full-exec",
    workflowId: "full-wf",
    sessionId: "full-session",
    agentId: "full-agent",
    divisionId: "full-division",
    workdir: "/full/path",
    requestId: "full-request",
    approvalId: "full-approval",
    abortSignalRef: "full-signal",
    budgetScopeId: "full-budget",
    tenantId: "full-tenant",
    workspaceId: "full-workspace",
  });

  provideContext(snapshot, () => {
    const ctx = getContext();
    assert.equal(ctx.traceId, "full-trace");
    assert.equal(ctx.spanId, "span-abc");
    assert.equal(ctx.parentSpanId, "parent-def");
    assert.equal(ctx.taskId, "full-task");
    assert.equal(ctx.executionId, "full-exec");
    assert.equal(ctx.workflowId, "full-wf");
    assert.equal(ctx.sessionId, "full-session");
    assert.equal(ctx.agentId, "full-agent");
    assert.equal(ctx.divisionId, "full-division");
    assert.equal(ctx.workdir, "/full/path");
    assert.equal(ctx.requestId, "full-request");
    assert.equal(ctx.approvalId, "full-approval");
    assert.equal(ctx.abortSignalRef, "full-signal");
    assert.equal(ctx.budgetScopeId, "full-budget");
    assert.equal(ctx.tenantId, "full-tenant");
    assert.equal(ctx.workspaceId, "full-workspace");
  });
});
