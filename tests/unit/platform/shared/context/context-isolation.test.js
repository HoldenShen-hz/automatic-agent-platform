import assert from "node:assert/strict";
import test from "node:test";
import { provideContext, getContext, getContextOrNull, withContextPatch, assertContext, getTenantId, getWorkspaceId, hasTenantContext, hasWorkspaceContext, } from "../../../../../src/platform/shared/context/runtime-context.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
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
test("getContext throws ValidationError with correct error code", () => {
    let error = null;
    try {
        getContext();
    }
    catch (err) {
        error = err;
    }
    assert.ok(error instanceof ValidationError, "Should be ValidationError instance");
    assert.equal(error.code, "runtime_context.missing");
});
test("getContext throws ValidationError with function name in details", () => {
    let error = null;
    try {
        getContext();
    }
    catch (err) {
        error = err;
    }
    assert.ok(error instanceof ValidationError);
    const details = error.details;
    assert.ok(details != null);
    assert.equal(details.function, "getContext");
});
test("assertContext throws ValidationError with correct error code for missing fields", () => {
    const snapshot = createTestSnapshot({ taskId: "", tenantId: "" });
    let error = null;
    try {
        provideContext(snapshot, () => {
            assertContext("taskId", "tenantId");
        });
    }
    catch (err) {
        error = err;
    }
    assert.ok(error instanceof ValidationError);
    assert.equal(error.code, "runtime_context.missing_fields");
});
test("assertContext reports all missing fields in error details", () => {
    const snapshot = createTestSnapshot({ taskId: "", traceId: "" });
    let error = null;
    try {
        provideContext(snapshot, () => {
            assertContext("taskId", "traceId");
        });
    }
    catch (err) {
        error = err;
    }
    assert.ok(error instanceof ValidationError);
    const details = error.details;
    assert.ok(details != null);
    assert.ok(details.missingFields.includes("taskId"));
    assert.ok(details.missingFields.includes("traceId"));
});
test("withContextPatch preserves non-patched fields", () => {
    const original = createTestSnapshot({ tenantId: "original", traceId: "original-trace" });
    provideContext(original, () => {
        const result = withContextPatch({ tenantId: "patched" }, () => {
            const ctx = getContext();
            return { traceId: ctx.traceId, tenantId: ctx.tenantId };
        });
        assert.equal(result.traceId, "original-trace");
        assert.equal(result.tenantId, "patched");
    });
});
test("withContextPatch with async function preserves context", async () => {
    const original = createTestSnapshot({ taskId: "async-task" });
    const result = await provideContext(original, async () => {
        return withContextPatch({ tenantId: "patched-tenant" }, async () => {
            return getContext().taskId;
        });
    });
    assert.equal(result, "async-task");
});
test("withContextPatch with multiple field patches", () => {
    const original = createTestSnapshot({
        taskId: "original-task",
        tenantId: "original-tenant",
        traceId: "original-trace",
    });
    provideContext(original, () => {
        const result = withContextPatch({ taskId: "patched-task", tenantId: "patched-tenant" }, () => {
            const ctx = getContext();
            return {
                taskId: ctx.taskId,
                tenantId: ctx.tenantId,
                traceId: ctx.traceId,
            };
        });
        assert.equal(result.taskId, "patched-task");
        assert.equal(result.tenantId, "patched-tenant");
        assert.equal(result.traceId, "original-trace");
    });
});
test("nested withContextPatch creates chained patches", () => {
    const original = createTestSnapshot({ taskId: "level-0", tenantId: "tenant-0" });
    provideContext(original, () => {
        const result = withContextPatch({ taskId: "level-1" }, () => {
            return withContextPatch({ tenantId: "tenant-2" }, () => {
                const ctx = getContext();
                return { taskId: ctx.taskId, tenantId: ctx.tenantId };
            });
        });
        assert.equal(result.taskId, "level-1");
        assert.equal(result.tenantId, "tenant-2");
    });
});
test("context is preserved through Promise.then chain", async () => {
    const snapshot = createTestSnapshot({ taskId: "promise-chain-task" });
    const result = await provideContext(snapshot, async () => {
        return Promise.resolve("value").then((val) => {
            return getContext().taskId + "-" + val;
        });
    });
    assert.equal(result, "promise-chain-task-value");
});
test("context is preserved through Promise.catch", async () => {
    const snapshot = createTestSnapshot({ taskId: "promise-catch-task" });
    const result = await provideContext(snapshot, async () => {
        return Promise.reject(new Error("test")).catch(() => {
            return getContext().taskId;
        });
    });
    assert.equal(result, "promise-catch-task");
});
test("context is preserved through async/await boundaries", async () => {
    const snapshot = createTestSnapshot({ taskId: "await-boundary-task" });
    async function innerAsync() {
        return getContext().taskId;
    }
    const result = await provideContext(snapshot, async () => {
        return innerAsync();
    });
    assert.equal(result, "await-boundary-task");
});
test("concurrent provideContext calls maintain isolated contexts", async () => {
    const snapshot1 = createTestSnapshot({ taskId: "concurrent-task-1", tenantId: "tenant-1" });
    const snapshot2 = createTestSnapshot({ taskId: "concurrent-task-2", tenantId: "tenant-2" });
    const [result1, result2] = await Promise.all([
        provideContext(snapshot1, async () => {
            return getContext().taskId;
        }),
        provideContext(snapshot2, async () => {
            return getContext().taskId;
        }),
    ]);
    assert.equal(result1, "concurrent-task-1");
    assert.equal(result2, "concurrent-task-2");
});
test("context isolation in nested concurrent operations", async () => {
    const outer = createTestSnapshot({ taskId: "outer-task" });
    await provideContext(outer, async () => {
        const [r1, r2] = await Promise.all([
            provideContext(createTestSnapshot({ taskId: "inner-1" }), () => Promise.resolve(getContext().taskId)),
            provideContext(createTestSnapshot({ taskId: "inner-2" }), () => Promise.resolve(getContext().taskId)),
        ]);
        assert.equal(r1, "inner-1");
        assert.equal(r2, "inner-2");
        // outer context is still available after concurrent operations
        assert.equal(getContext().taskId, "outer-task");
    });
});
test("context preserves spanId field", () => {
    const snapshot = createTestSnapshot({ spanId: "span-abc" });
    provideContext(snapshot, () => {
        const ctx = getContext();
        assert.equal(ctx.spanId, "span-abc");
    });
});
test("context preserves parentSpanId field", () => {
    const snapshot = createTestSnapshot({ parentSpanId: "parent-def" });
    provideContext(snapshot, () => {
        const ctx = getContext();
        assert.equal(ctx.parentSpanId, "parent-def");
    });
});
test("context preserves abortSignalRef field", () => {
    const snapshot = createTestSnapshot({ abortSignalRef: "signal-xyz" });
    provideContext(snapshot, () => {
        const ctx = getContext();
        assert.equal(ctx.abortSignalRef, "signal-xyz");
    });
});
test("context preserves budgetScopeId field", () => {
    const snapshot = createTestSnapshot({ budgetScopeId: "budget-abc" });
    provideContext(snapshot, () => {
        const ctx = getContext();
        assert.equal(ctx.budgetScopeId, "budget-abc");
    });
});
test("assertContext treats empty string as missing", () => {
    const snapshot = createTestSnapshot({ taskId: "" });
    let threw = false;
    try {
        provideContext(snapshot, () => {
            assertContext("taskId");
        });
    }
    catch (err) {
        threw = true;
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("taskId"));
    }
    assert.equal(threw, true);
});
test("assertContext accepts zero-length required keys array", () => {
    const snapshot = createTestSnapshot();
    provideContext(snapshot, () => {
        const ctx = assertContext();
        assert.equal(ctx.taskId, "task-456");
    });
});
test("getContextOrNull returns context with null fields when context exists", () => {
    const snapshot = createTestSnapshot({ tenantId: null });
    provideContext(snapshot, () => {
        const result = getContextOrNull();
        assert.ok(result != null);
        assert.equal(result?.tenantId, null);
    });
});
test("hasTenantContext returns false for undefined tenantId", () => {
    const snapshot = createTestSnapshot({ tenantId: undefined });
    provideContext(snapshot, () => {
        assert.equal(hasTenantContext(), false);
    });
});
test("hasWorkspaceContext returns false for undefined workspaceId", () => {
    const snapshot = createTestSnapshot({ workspaceId: undefined });
    provideContext(snapshot, () => {
        assert.equal(hasWorkspaceContext(), false);
    });
});
test("provideContext returns promise rejected when inner function rejects", async () => {
    const snapshot = createTestSnapshot();
    let threw = false;
    try {
        await provideContext(snapshot, async () => {
            throw new Error("inner rejection");
        });
    }
    catch (err) {
        threw = true;
        assert.ok(err instanceof Error);
        assert.equal(err.message, "inner rejection");
    }
    assert.equal(threw, true);
});
test("getWorkspaceId returns correct value when tenantId is set but workspaceId is null", () => {
    const snapshot = createTestSnapshot({ tenantId: "test-tenant", workspaceId: null });
    provideContext(snapshot, () => {
        assert.equal(getWorkspaceId(), null);
    });
});
test("getTenantId returns correct value when tenantId is set but workspaceId is null", () => {
    const snapshot = createTestSnapshot({ tenantId: "test-tenant", workspaceId: null });
    provideContext(snapshot, () => {
        assert.equal(getTenantId(), "test-tenant");
    });
});
test("context preserves executionId field", () => {
    const snapshot = createTestSnapshot({ executionId: "exec-xyz" });
    provideContext(snapshot, () => {
        const ctx = getContext();
        assert.equal(ctx.executionId, "exec-xyz");
    });
});
test("context preserves workflowId field", () => {
    const snapshot = createTestSnapshot({ workflowId: "wf-xyz" });
    provideContext(snapshot, () => {
        const ctx = getContext();
        assert.equal(ctx.workflowId, "wf-xyz");
    });
});
test("context preserves sessionId field", () => {
    const snapshot = createTestSnapshot({ sessionId: "session-xyz" });
    provideContext(snapshot, () => {
        const ctx = getContext();
        assert.equal(ctx.sessionId, "session-xyz");
    });
});
test("context preserves agentId field", () => {
    const snapshot = createTestSnapshot({ agentId: "agent-xyz" });
    provideContext(snapshot, () => {
        const ctx = getContext();
        assert.equal(ctx.agentId, "agent-xyz");
    });
});
test("context preserves divisionId field", () => {
    const snapshot = createTestSnapshot({ divisionId: "div-xyz" });
    provideContext(snapshot, () => {
        const ctx = getContext();
        assert.equal(ctx.divisionId, "div-xyz");
    });
});
test("context preserves workdir field", () => {
    const snapshot = createTestSnapshot({ workdir: "/custom/path" });
    provideContext(snapshot, () => {
        const ctx = getContext();
        assert.equal(ctx.workdir, "/custom/path");
    });
});
test("context preserves requestId field", () => {
    const snapshot = createTestSnapshot({ requestId: "req-xyz" });
    provideContext(snapshot, () => {
        const ctx = getContext();
        assert.equal(ctx.requestId, "req-xyz");
    });
});
test("context preserves approvalId field", () => {
    const snapshot = createTestSnapshot({ approvalId: "approval-xyz" });
    provideContext(snapshot, () => {
        const ctx = getContext();
        assert.equal(ctx.approvalId, "approval-xyz");
    });
});
test("withContextPatch does not affect outer context after nested patch exits", () => {
    const original = createTestSnapshot({ taskId: "outer", tenantId: "outer-tenant" });
    provideContext(original, () => {
        withContextPatch({ taskId: "inner" }, () => {
            assert.equal(getContext().taskId, "inner");
        });
        // Verify outer context is restored
        assert.equal(getContext().taskId, "outer");
        assert.equal(getContext().tenantId, "outer-tenant");
    });
});
//# sourceMappingURL=context-isolation.test.js.map