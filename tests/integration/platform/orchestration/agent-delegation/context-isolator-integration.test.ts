// @ts-nocheck
/**
 * Integration Test: Context Isolator
 *
 * Tests the ContextIsolator which provides context security isolation
 * for delegated agents including permission inheritance narrowing
 * and sandbox tier inheritance.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import { ContextIsolator, createContextIsolator, IsolationLevel } from "../../../../../src/platform/orchestration/agent-delegation/context-isolator.js";
import type { AgentContext, DelegationSpec } from "../../../../../src/platform/orchestration/agent-delegation/delegation-types.js";

function createTestAgentContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    agentId: "parent_context_001",
    agentType: "general_executor",
    packId: "pack_default",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["/workspace", "/code", "/secrets"],
      actions: ["read", "write", "execute", "bash", "admin"],
      constraints: {
        maxDurationMs: 300000,
        maxTokens: 8000,
        allowedDomains: ["github.com", "api.example.com"],
      },
    },
    sandboxTier: "container",
    correlationId: "ctx_corr_001",
    tenantId: "tenant_001",
    ...overrides,
  };
}

function createDelegationSpec(overrides: Partial<DelegationSpec> = {}): DelegationSpec {
  return {
    targetAgentId: "child_context_001",
    targetAgentType: "general_executor",
    targetPackId: "pack_default",
    requiredPermissions: {
      resources: ["/workspace"],
      actions: ["read", "write"],
      constraints: {
        maxDurationMs: 60000,
        maxTokens: 4000,
      },
    },
    timeout: 120000,
    ...overrides,
  };
}

test("ContextIsolator creates isolated context with incremented depth", () => {
  const ctx = createIntegrationContext("aa-iso-depth-");
  try {
    const isolator = createContextIsolator();

    const parent = createTestAgentContext({ delegationDepth: 2 });
    const spec = createDelegationSpec();

    const result = isolator.isolate(parent, spec);

    assert.equal(result.context.delegationDepth, 3);
    assert.equal(result.context.agentId, "child_context_001");
  } finally {
    ctx.cleanup();
  }
});

test("ContextIsolator inherits tenant ID", () => {
  const ctx = createIntegrationContext("aa-iso-tenant-");
  try {
    const isolator = createContextIsolator();

    const parent = createTestAgentContext({ tenantId: "tenant_special" });
    const spec = createDelegationSpec();

    const result = isolator.isolate(parent, spec);

    assert.equal(result.context.tenantId, "tenant_special");
  } finally {
    ctx.cleanup();
  }
});

test("ContextIsolator resets active delegations for child", () => {
  const ctx = createIntegrationContext("aa-iso-delegations-");
  try {
    const isolator = createContextIsolator();

    const parent = createTestAgentContext({
      activeDelegations: ["dlg_1", "dlg_2", "dlg_3"],
    });
    const spec = createDelegationSpec();

    const result = isolator.isolate(parent, spec);

    assert.deepEqual(result.context.activeDelegations, []);
  } finally {
    ctx.cleanup();
  }
});

test("ContextIsolator inherits sandbox tier from parent", () => {
  const ctx = createIntegrationContext("aa-iso-sandbox-");
  try {
    const isolator = createContextIsolator();

    const parent = createTestAgentContext({ sandboxTier: "container" });
    const spec = createDelegationSpec();

    const result = isolator.isolate(parent, spec);

    assert.equal(result.context.sandboxTier, "container");
  } finally {
    ctx.cleanup();
  }
});

test("ContextIsolator uses partial isolation for moderate permission ratio", () => {
  const ctx = createIntegrationContext("aa-iso-partial-");
  try {
    const isolator = createContextIsolator();

    const parent = createTestAgentContext({
      sandboxTier: "process",
      permissions: {
        resources: ["/workspace", "/code"],
        actions: ["read", "write", "execute"],
        constraints: {},
      },
    });
    const spec = createDelegationSpec({
      requiredPermissions: {
        resources: ["/workspace"],
        actions: ["read", "write"],
        constraints: {},
      },
    });

    const result = isolator.isolate(parent, spec);

    assert.equal(result.isolationLevel, IsolationLevel.PARTIAL);
  } finally {
    ctx.cleanup();
  }
});

test("ContextIsolator uses full isolation when permission ratio is high", () => {
  const ctx = createIntegrationContext("aa-iso-full-");
  try {
    const isolator = createContextIsolator();

    const parent = createTestAgentContext({
      sandboxTier: "process",
      permissions: {
        resources: ["/workspace"],
        actions: ["read", "write"],
        constraints: {},
      },
    });
    const spec = createDelegationSpec({
      requiredPermissions: {
        resources: ["/workspace"],
        actions: ["read", "write"],
        constraints: {},
      },
    });

    const result = isolator.isolate(parent, spec);

    assert.equal(result.isolationLevel, IsolationLevel.FULL);
  } finally {
    ctx.cleanup();
  }
});

test("ContextIsolator uses sandboxed isolation for scoped_external_access tier", () => {
  const ctx = createIntegrationContext("aa-iso-sandboxed-");
  try {
    const isolator = createContextIsolator();

    const parent = createTestAgentContext({ sandboxTier: "scoped_external_access" });
    const spec = createDelegationSpec();

    const result = isolator.isolate(parent, spec);

    assert.equal(result.isolationLevel, IsolationLevel.SANDBOXED);
  } finally {
    ctx.cleanup();
  }
});

test("ContextIsolator uses minimal isolation for low permission ratio", () => {
  const ctx = createIntegrationContext("aa-iso-minimal-");
  try {
    const isolator = createContextIsolator();

    const parent = createTestAgentContext({
      sandboxTier: "process",
      permissions: {
        resources: ["/workspace", "/code", "/secrets", "/data"],
        actions: ["read", "write", "execute", "bash", "admin"],
        constraints: {},
      },
    });
    const spec = createDelegationSpec({
      requiredPermissions: {
        resources: ["/workspace"],
        actions: ["read"],
        constraints: {},
      },
    });

    const result = isolator.isolate(parent, spec);

    assert.equal(result.isolationLevel, IsolationLevel.MINIMAL);
  } finally {
    ctx.cleanup();
  }
});

test("ContextIsolator validatePermissionRequest returns true for valid request", () => {
  const ctx = createIntegrationContext("aa-iso-valid-");
  try {
    const isolator = createContextIsolator();

    const parent = createTestAgentContext();
    const requested = {
      resources: ["/workspace"],
      actions: ["read", "write"],
      constraints: {},
    };

    const valid = isolator.validatePermissionRequest(parent.permissions, requested);

    assert.equal(valid, true);
  } finally {
    ctx.cleanup();
  }
});

test("ContextIsolator validatePermissionRequest returns false for unauthorized resource", () => {
  const ctx = createIntegrationContext("aa-iso-invalidres-");
  try {
    const isolator = createContextIsolator();

    const parent = createTestAgentContext();
    const requested = {
      resources: ["/production-secrets"],
      actions: ["read"],
      constraints: {},
    };

    const valid = isolator.validatePermissionRequest(parent.permissions, requested);

    assert.equal(valid, false);
  } finally {
    ctx.cleanup();
  }
});

test("ContextIsolator validatePermissionRequest returns false for unauthorized action", () => {
  const ctx = createIntegrationContext("aa-iso-invalidact-");
  try {
    const isolator = createContextIsolator();

    const parent = createTestAgentContext();
    const requested = {
      resources: ["/workspace"],
      actions: ["delete_users"],
      constraints: {},
    };

    const valid = isolator.validatePermissionRequest(parent.permissions, requested);

    assert.equal(valid, false);
  } finally {
    ctx.cleanup();
  }
});

test("ContextIsolator validatePermissionRequest checks domain constraints", () => {
  const ctx = createIntegrationContext("aa-iso-domain-");
  try {
    const isolator = createContextIsolator();

    const parent = createTestAgentContext();
    const requested = {
      resources: ["/workspace"],
      actions: ["read"],
      constraints: {
        allowedDomains: ["unknown-domain.com"],
      },
    };

    const valid = isolator.validatePermissionRequest(parent.permissions, requested);

    assert.equal(valid, false);
  } finally {
    ctx.cleanup();
  }
});

test("ContextIsolator mergePermissions takes more restrictive duration", () => {
  const ctx = createIntegrationContext("aa-iso-merge-dur-");
  try {
    const isolator = createContextIsolator();

    const base = {
      resources: ["/workspace"],
      actions: ["read"],
      constraints: {
        maxDurationMs: 300000,
      },
    };

    const override = {
      resources: [],
      actions: [],
      constraints: {
        maxDurationMs: 60000,
      },
    };

    const merged = isolator.mergePermissions(base, override);

    assert.equal(merged.constraints.maxDurationMs, 60000);
  } finally {
    ctx.cleanup();
  }
});

test("ContextIsolator mergePermissions takes more restrictive tokens", () => {
  const ctx = createIntegrationContext("aa-iso-merge-tok-");
  try {
    const isolator = createContextIsolator();

    const base = {
      resources: ["/workspace"],
      actions: ["read"],
      constraints: {
        maxTokens: 8000,
      },
    };

    const override = {
      resources: [],
      actions: [],
      constraints: {
        maxTokens: 2000,
      },
    };

    const merged = isolator.mergePermissions(base, override);

    assert.equal(merged.constraints.maxTokens, 2000);
  } finally {
    ctx.cleanup();
  }
});

test("ContextIsolator mergePermissions intersects domain lists", () => {
  const ctx = createIntegrationContext("aa-iso-merge-dom-");
  try {
    const isolator = createContextIsolator();

    const base = {
      resources: ["/workspace"],
      actions: ["read"],
      constraints: {
        allowedDomains: ["github.com", "api.example.com", "other.com"],
      },
    };

    const override = {
      resources: [],
      actions: [],
      constraints: {
        allowedDomains: ["github.com", "api.example.com"],
      },
    };

    const merged = isolator.mergePermissions(base, override);

    assert.deepEqual(merged.constraints.allowedDomains, ["github.com", "api.example.com"]);
  } finally {
    ctx.cleanup();
  }
});

test("ContextIsolator mergePermissions uses base resources when override is empty", () => {
  const ctx = createIntegrationContext("aa-iso-merge-res-");
  try {
    const isolator = createContextIsolator();

    const base = {
      resources: ["/workspace", "/code"],
      actions: ["read", "write"],
      constraints: {},
    };

    const override = {
      resources: [],
      actions: [],
      constraints: {},
    };

    const merged = isolator.mergePermissions(base, override);

    assert.deepEqual(merged.resources, ["/workspace", "/code"]);
  } finally {
    ctx.cleanup();
  }
});

test("ContextIsolator narrowedPermissions contains intersection of actions", () => {
  const ctx = createIntegrationContext("aa-iso-narrow-");
  try {
    const isolator = createContextIsolator();

    const parent = createTestAgentContext();
    const spec = createDelegationSpec();

    const result = isolator.isolate(parent, spec);

    // Should have intersection of parent and required actions
    for (const action of result.narrowedPermissions.actions) {
      assert.ok(
        parent.permissions.actions.includes(action),
        `Action ${action} should be in parent permissions`,
      );
    }
  } finally {
    ctx.cleanup();
  }
});

test("ContextIsolator sandboxed isolation applies max 60 second duration", () => {
  const ctx = createIntegrationContext("aa-iso-sandboxed-dur-");
  try {
    const isolator = createContextIsolator();

    const parent = createTestAgentContext({ sandboxTier: "container" });
    const spec = createDelegationSpec({
      requiredPermissions: {
        resources: ["/workspace"],
        actions: ["read"],
        constraints: {
          maxDurationMs: 300000, // Higher than sandboxed max
        },
      },
    });

    const result = isolator.isolate(parent, spec);

    assert.equal(result.isolationLevel, IsolationLevel.SANDBOXED);
    assert.ok(result.narrowedPermissions.constraints.maxDurationMs! <= 60000);
  } finally {
    ctx.cleanup();
  }
});
