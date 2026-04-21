import assert from "node:assert/strict";
import test from "node:test";
import { createContextIsolator, IsolationLevel } from "../../../../../src/platform/orchestration/agent-delegation/context-isolator.js";
// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────
function createParentContext(overrides = {}) {
    return {
        agentId: "parent-agent",
        agentType: "coordinator",
        packId: "pack-parent",
        delegationDepth: 0,
        activeDelegations: [],
        permissions: {
            resources: ["resource-a", "resource-b", "resource-c"],
            actions: ["action-read", "action-write", "action-delete"],
            constraints: {
                maxDurationMs: 60000,
                maxTokens: 100000,
                allowedDomains: ["api.example.com", "cdn.example.com"],
            },
        },
        sandboxTier: "container",
        correlationId: "test-correlation",
        tenantId: "tenant-1",
        ...overrides,
    };
}
function createDelegationSpec(overrides = {}) {
    return {
        targetAgentId: "child-agent",
        targetAgentType: "worker",
        targetPackId: "pack-child",
        requiredPermissions: {
            resources: ["resource-a"],
            actions: ["action-read"],
            constraints: {
                maxDurationMs: 30000,
                maxTokens: 50000,
                allowedDomains: ["api.example.com"],
            },
        },
        timeout: 30000,
        ...overrides,
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// Context Isolator Tests
// ─────────────────────────────────────────────────────────────────────────────
test("ContextIsolator.isolate() creates child context with correct depth", () => {
    const isolator = createContextIsolator();
    const parent = createParentContext({ delegationDepth: 1 });
    const spec = createDelegationSpec();
    const result = isolator.isolate(parent, spec);
    assert.equal(result.context.agentId, "child-agent");
    assert.equal(result.context.packId, "pack-child");
    assert.equal(result.context.delegationDepth, 2);
});
test("ContextIsolator.isolate() inherits sandbox tier from parent", () => {
    const isolator = createContextIsolator();
    const parent = createParentContext({ sandboxTier: "container" });
    const spec = createDelegationSpec();
    const result = isolator.isolate(parent, spec);
    assert.equal(result.context.sandboxTier, "container");
});
test("ContextIsolator.isolate() preserves tenant context", () => {
    const isolator = createContextIsolator();
    const parent = createParentContext({ tenantId: "tenant-special" });
    const spec = createDelegationSpec();
    const result = isolator.isolate(parent, spec);
    assert.equal(result.context.tenantId, "tenant-special");
});
test("ContextIsolator.isolate() uses SANDBOXED level for container parent", () => {
    const isolator = createContextIsolator();
    const parent = createParentContext({ sandboxTier: "container" });
    const spec = createDelegationSpec();
    const result = isolator.isolate(parent, spec);
    assert.equal(result.isolationLevel, IsolationLevel.SANDBOXED);
});
test("ContextIsolator.isolate() uses PARTIAL level when permission ratio is moderate", () => {
    const isolator = createContextIsolator();
    const parent = createParentContext({
        delegationDepth: 0,
        permissions: {
            resources: ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9", "r10"],
            actions: ["a1", "a2", "a3", "a4", "a5"],
            constraints: {},
        },
    });
    const spec = createDelegationSpec({
        requiredPermissions: {
            resources: ["r1", "r2"],
            actions: ["a1"],
            constraints: {},
        },
    });
    const result = isolator.isolate(parent, spec);
    assert.equal(result.isolationLevel, IsolationLevel.PARTIAL);
});
test("ContextIsolator.validatePermissionRequest() returns true when all permissions valid", () => {
    const isolator = createContextIsolator();
    const parent = {
        resources: ["resource-a", "resource-b"],
        actions: ["action-read", "action-write"],
        constraints: {},
    };
    const requested = {
        resources: ["resource-a"],
        actions: ["action-read"],
        constraints: {},
    };
    assert.equal(isolator.validatePermissionRequest(parent, requested), true);
});
test("ContextIsolator.validatePermissionRequest() returns false when resource not allowed", () => {
    const isolator = createContextIsolator();
    const parent = {
        resources: ["resource-a"],
        actions: ["action-read"],
        constraints: {},
    };
    const requested = {
        resources: ["resource-b"], // Not in parent
        actions: ["action-read"],
        constraints: {},
    };
    assert.equal(isolator.validatePermissionRequest(parent, requested), false);
});
test("ContextIsolator.validatePermissionRequest() returns false when action not allowed", () => {
    const isolator = createContextIsolator();
    const parent = {
        resources: ["resource-a"],
        actions: ["action-read"],
        constraints: {},
    };
    const requested = {
        resources: ["resource-a"],
        actions: ["action-write"], // Not in parent
        constraints: {},
    };
    assert.equal(isolator.validatePermissionRequest(parent, requested), false);
});
test("ContextIsolator.validatePermissionRequest() checks domain constraints", () => {
    const isolator = createContextIsolator();
    const parent = {
        resources: ["resource-a"],
        actions: ["action-read"],
        constraints: {
            allowedDomains: ["api.example.com"],
        },
    };
    const requested = {
        resources: ["resource-a"],
        actions: ["action-read"],
        constraints: {
            allowedDomains: ["evil.com"], // Not in parent
        },
    };
    assert.equal(isolator.validatePermissionRequest(parent, requested), false);
});
test("ContextIsolator.mergePermissions() takes more restrictive values", () => {
    const isolator = createContextIsolator();
    const base = {
        resources: ["r1", "r2"],
        actions: ["a1", "a2"],
        constraints: {
            maxDurationMs: 60000,
            maxTokens: 100000,
            allowedDomains: ["api.example.com"],
        },
    };
    const override = {
        resources: ["r1"],
        actions: ["a1", "a2", "a3"],
        constraints: {
            maxDurationMs: 30000,
            maxTokens: 50000,
            allowedDomains: ["cdn.example.com", "api.example.com"],
        },
    };
    const merged = isolator.mergePermissions(base, override);
    // Resources: use override's resources
    assert.deepEqual(merged.resources, ["r1"]);
    // Actions: intersect (parent has a1, a2, override has a1, a2, a3)
    assert.ok(merged.actions.includes("a1"));
    assert.ok(merged.actions.includes("a2"));
    // Constraints: take minimum (more restrictive)
    assert.equal(merged.constraints.maxDurationMs, 30000);
    assert.equal(merged.constraints.maxTokens, 50000);
});
test("ContextIsolator.isolate() rejects invalid permission requests", () => {
    const isolator = createContextIsolator();
    const parent = createParentContext();
    const spec = createDelegationSpec({
        requiredPermissions: {
            resources: ["resource-xyz"], // Not in parent
            actions: ["action-read"],
            constraints: {},
        },
    });
    const result = isolator.isolate(parent, spec);
    assert.equal(result.context.permissions.resources.includes("resource-xyz"), false);
});
test("ContextIsolator creates correlation ID with parent and child agents", () => {
    const isolator = createContextIsolator();
    const parent = createParentContext({ correlationId: "parent-corr-id" });
    const spec = createDelegationSpec({ targetAgentId: "my-child-agent" });
    const result = isolator.isolate(parent, spec);
    assert.ok(result.context.correlationId.includes("parent-corr-id"));
    assert.ok(result.context.correlationId.includes("my-child-agent"));
});
//# sourceMappingURL=context-isolator.test.js.map