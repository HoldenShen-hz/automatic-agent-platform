import assert from "node:assert/strict";
import test from "node:test";
import { provideContext, getContext, getContextOrNull, withContextPatch, assertContext, getTenantId, getTenantIdOrNull, getWorkspaceId, getWorkspaceIdOrNull, hasTenantContext, hasWorkspaceContext, } from "../../../../../src/platform/shared/context/runtime-context.js";
function createTestSnapshot(overrides = {}) {
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
test("provideContext runs function within context", () => {
    const snapshot = createTestSnapshot();
    const result = provideContext(snapshot, () => {
        return getContext().taskId;
    });
    assert.equal(result, "task-456");
});
test("provideContext returns promise resolution for async functions", async () => {
    const snapshot = createTestSnapshot({ taskId: "async-task" });
    const result = await provideContext(snapshot, async () => {
        return getContext().taskId;
    });
    assert.equal(result, "async-task");
});
test("provideContext passes through sync return values", () => {
    const snapshot = createTestSnapshot();
    const result = provideContext(snapshot, () => {
        return 42;
    });
    assert.equal(result, 42);
});
test("getContext returns snapshot when inside provideContext", () => {
    const snapshot = createTestSnapshot({ tenantId: "test-tenant" });
    provideContext(snapshot, () => {
        const ctx = getContext();
        assert.equal(ctx.traceId, "trace-123");
        assert.equal(ctx.tenantId, "test-tenant");
        assert.equal(ctx.taskId, "task-456");
    });
});
test("getContext throws ValidationError when outside provideContext", () => {
    let threw = false;
    try {
        getContext();
    }
    catch (err) {
        threw = true;
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("runtime_context.missing"));
    }
    assert.equal(threw, true);
});
test("getContextOrNull returns snapshot when inside provideContext", () => {
    const snapshot = createTestSnapshot();
    const result = provideContext(snapshot, () => {
        return getContextOrNull()?.taskId ?? null;
    });
    assert.equal(result, "task-456");
});
test("getContextOrNull returns null when outside provideContext", () => {
    const result = getContextOrNull();
    assert.equal(result, null);
});
test("withContextPatch creates new context with merged patch", async () => {
    const original = createTestSnapshot({ tenantId: "original-tenant", taskId: "original-task" });
    const result = await provideContext(original, () => {
        return withContextPatch({ tenantId: "patched-tenant" }, () => {
            const ctx = getContext();
            return { tenantId: ctx.tenantId, taskId: ctx.taskId };
        });
    });
    assert.equal(result.tenantId, "patched-tenant");
    assert.equal(result.taskId, "original-task");
});
test("withContextPatch does not modify original context", () => {
    const original = createTestSnapshot({ tenantId: "original-tenant" });
    provideContext(original, () => {
        withContextPatch({ tenantId: "patched-tenant" }, () => {
            return getContext().tenantId;
        });
        const ctx = getContext();
        assert.equal(ctx.tenantId, "original-tenant");
    });
});
test("assertContext returns context when all required keys present", () => {
    const snapshot = createTestSnapshot({ taskId: "task-123", tenantId: "tenant-456" });
    provideContext(snapshot, () => {
        const ctx = assertContext("taskId", "tenantId");
        assert.equal(ctx.taskId, "task-123");
        assert.equal(ctx.tenantId, "tenant-456");
    });
});
test("assertContext throws for missing required keys", () => {
    const snapshot = createTestSnapshot({ taskId: "task-123", tenantId: "" });
    let threw = false;
    try {
        provideContext(snapshot, () => {
            assertContext("taskId", "tenantId");
        });
    }
    catch (err) {
        threw = true;
        assert.ok(err instanceof Error);
        // The message contains the field names but not the error code
        assert.ok(err.message.includes("Missing required context fields"));
        assert.ok(err.message.includes("tenantId"));
    }
    assert.equal(threw, true);
});
test("assertContext accepts single key", () => {
    const snapshot = createTestSnapshot({ traceId: "trace-abc" });
    provideContext(snapshot, () => {
        const ctx = assertContext("traceId");
        assert.equal(ctx.traceId, "trace-abc");
    });
});
test("getTenantId returns tenantId from context", () => {
    const snapshot = createTestSnapshot({ tenantId: "my-tenant" });
    const result = provideContext(snapshot, () => {
        return getTenantId();
    });
    assert.equal(result, "my-tenant");
});
test("getTenantId returns null when tenantId is not set", () => {
    const snapshot = createTestSnapshot({ tenantId: null });
    const result = provideContext(snapshot, () => {
        return getTenantId();
    });
    assert.equal(result, null);
});
test("getTenantId returns null when outside context", () => {
    const result = getTenantId();
    assert.equal(result, null);
});
test("getTenantIdOrNull is alias for getTenantId", () => {
    const snapshot = createTestSnapshot({ tenantId: "alias-tenant" });
    const result = provideContext(snapshot, () => {
        return getTenantIdOrNull();
    });
    assert.equal(result, "alias-tenant");
});
test("getWorkspaceId returns workspaceId from context", () => {
    const snapshot = createTestSnapshot({ workspaceId: "my-workspace" });
    const result = provideContext(snapshot, () => {
        return getWorkspaceId();
    });
    assert.equal(result, "my-workspace");
});
test("getWorkspaceId returns null when workspaceId is not set", () => {
    const snapshot = createTestSnapshot({ workspaceId: null });
    const result = provideContext(snapshot, () => {
        return getWorkspaceId();
    });
    assert.equal(result, null);
});
test("getWorkspaceId returns null when outside context", () => {
    const result = getWorkspaceId();
    assert.equal(result, null);
});
test("getWorkspaceIdOrNull is alias for getWorkspaceId", () => {
    const snapshot = createTestSnapshot({ workspaceId: "alias-workspace" });
    const result = provideContext(snapshot, () => {
        return getWorkspaceIdOrNull();
    });
    assert.equal(result, "alias-workspace");
});
test("hasTenantContext returns true when tenantId is set", () => {
    const snapshot = createTestSnapshot({ tenantId: "valid-tenant" });
    provideContext(snapshot, () => {
        assert.equal(hasTenantContext(), true);
    });
});
test("hasTenantContext returns false when tenantId is empty string", () => {
    const snapshot = createTestSnapshot({ tenantId: "" });
    provideContext(snapshot, () => {
        assert.equal(hasTenantContext(), false);
    });
});
test("hasTenantContext returns false when tenantId is null", () => {
    const snapshot = createTestSnapshot({ tenantId: null });
    provideContext(snapshot, () => {
        assert.equal(hasTenantContext(), false);
    });
});
test("hasTenantContext returns false when outside context", () => {
    assert.equal(hasTenantContext(), false);
});
test("hasWorkspaceContext returns true when workspaceId is set", () => {
    const snapshot = createTestSnapshot({ workspaceId: "valid-workspace" });
    provideContext(snapshot, () => {
        assert.equal(hasWorkspaceContext(), true);
    });
});
test("hasWorkspaceContext returns false when workspaceId is empty string", () => {
    const snapshot = createTestSnapshot({ workspaceId: "" });
    provideContext(snapshot, () => {
        assert.equal(hasWorkspaceContext(), false);
    });
});
test("hasWorkspaceContext returns false when workspaceId is null", () => {
    const snapshot = createTestSnapshot({ workspaceId: null });
    provideContext(snapshot, () => {
        assert.equal(hasWorkspaceContext(), false);
    });
});
test("hasWorkspaceContext returns false when outside context", () => {
    assert.equal(hasWorkspaceContext(), false);
});
test("nested provideContext creates independent contexts", () => {
    const outer = createTestSnapshot({ taskId: "outer-task", tenantId: "outer-tenant" });
    const inner = createTestSnapshot({ taskId: "inner-task", tenantId: "inner-tenant" });
    provideContext(outer, () => {
        assert.equal(getContext().taskId, "outer-task");
        provideContext(inner, () => {
            assert.equal(getContext().taskId, "inner-task");
        });
        // Outer context is restored after exiting inner
        assert.equal(getContext().taskId, "outer-task");
    });
});
test("context snapshot preserves all fields", () => {
    const snapshot = createTestSnapshot({
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
//# sourceMappingURL=runtime-context.test.js.map