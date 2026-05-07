// @ts-nocheck
/**
 * Unit tests for DelegationManagerService - Coverage Gaps
 *
 * Tests for code paths not covered in the main test file:
 * - Permission narrowing edge cases
 * - Intersect actions with empty arrays
 * - Eviction logic edge cases
 * - Multiple delegation chain scenarios
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  createDelegationManager,
  DelegationManagerService,
} from "../../../../../src/platform/orchestration/agent-delegation/delegation-manager.service.js";
import type { AgentContext, DelegationSpec, DelegationChain } from "../../../../../src/platform/orchestration/agent-delegation/delegation-types.js";

function createParentContext(overrides: Partial<AgentContext> = {}): AgentContext {
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
        allowedDomains: ["api.example.com"],
      },
    },
    sandboxTier: "workspace_write",
    correlationId: "test-correlation",
    tenantId: "tenant-1",
    ...overrides,
  };
}

function createDelegationSpec(overrides: Partial<DelegationSpec> = {}): DelegationSpec {
  return {
    targetAgentId: "child-agent",
    targetAgentType: "worker",
    targetPackId: "pack-child",
    requiredPermissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {},
    },
    timeout: 30000,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission Narrowing Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DelegationManagerService permission narrowing with empty child actions", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec({
    requiredPermissions: {
      resources: [],
      actions: [], // Empty actions
      constraints: {},
    },
  });

  const handle = await service.delegate(parent, spec);
  const delegation = await service.getDelegation(handle.delegationId);

  // With empty child actions, parent actions should be used
  assert.ok(delegation?.permissions.actions.length > 0);
});

test("DelegationManagerService permission narrowing with empty parent actions", async () => {
  const service = createDelegationManager();
  const parent = createParentContext({
    permissions: {
      resources: ["resource-a"],
      actions: [], // Empty parent actions
      constraints: {},
    },
  });
  const spec = createDelegationSpec({
    requiredPermissions: {
      resources: [],
      actions: ["action-read"],
      constraints: {},
    },
  });

  const handle = await service.delegate(parent, spec);
  const delegation = await service.getDelegation(handle.delegationId);

  // Intersection of empty parent and child should be empty
  assert.ok(Array.isArray(delegation?.permissions.actions));
});

test("DelegationManagerService permission narrowing takes more restrictive duration", async () => {
  const service = createDelegationManager();
  const parent = createParentContext({
    permissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {
        maxDurationMs: 120000, // 2 minutes
        maxTokens: 50000,
      },
    },
  });
  const spec = createDelegationSpec({
    requiredPermissions: {
      resources: [],
      actions: [],
      constraints: {
        maxDurationMs: 30000, // 30 seconds - more restrictive
        maxTokens: 100000,
      },
    },
  });

  const handle = await service.delegate(parent, spec);
  const delegation = await service.getDelegation(handle.delegationId);

  // Should take the more restrictive value (30000)
  assert.equal(delegation?.permissions.constraints.maxDurationMs, 30000);
});

test("DelegationManagerService permission narrowing takes more restrictive tokens", async () => {
  const service = createDelegationManager();
  const parent = createParentContext({
    permissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {
        maxDurationMs: 60000,
        maxTokens: 200000, // More tokens
      },
    },
  });
  const spec = createDelegationSpec({
    requiredPermissions: {
      resources: [],
      actions: [],
      constraints: {
        maxDurationMs: 60000,
        maxTokens: 50000, // Fewer tokens - more restrictive
      },
    },
  });

  const handle = await service.delegate(parent, spec);
  const delegation = await service.getDelegation(handle.delegationId);

  // Should take the more restrictive value (50000)
  assert.equal(delegation?.permissions.constraints.maxTokens, 50000);
});

test("DelegationManagerService permission narrowing merges constraints", async () => {
  const service = createDelegationManager();
  const parent = createParentContext({
    permissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {
        maxDurationMs: 60000,
        allowedDomains: ["api.example.com", "cdn.example.com"],
        deniedDomains: ["evil.com"],
      },
    },
  });
  const spec = createDelegationSpec({
    requiredPermissions: {
      resources: [],
      actions: [],
      constraints: {
        maxDurationMs: 30000,
        allowedDomains: ["api.example.com"],
      },
    },
  });

  const handle = await service.delegate(parent, spec);
  const delegation = await service.getDelegation(handle.delegationId);

  assert.equal(delegation?.permissions.constraints.maxDurationMs, 30000);
  assert.ok(delegation?.permissions.constraints.allowedDomains?.includes("api.example.com"));
});

test("DelegationManagerService permission narrowing uses parent resources when child has empty", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec({
    requiredPermissions: {
      resources: [], // Empty resources
      actions: [],
      constraints: {},
    },
  });

  const handle = await service.delegate(parent, spec);
  const delegation = await service.getDelegation(handle.delegationId);

  // Should use parent resources
  assert.ok(delegation?.permissions.resources.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Delegation Chain Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DelegationManagerService chain tracks multiple delegations", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  await service.delegate(parent, createDelegationSpec({ targetAgentId: "child-1", targetPackId: "pack-1" }));
  await service.delegate(parent, createDelegationSpec({ targetAgentId: "child-2", targetPackId: "pack-2" }));

  const chain = service.getDelegationChain("parent-agent");

  assert.ok(chain !== null);
  assert.equal(chain!.totalDelegations, 2);
  assert.equal(chain!.nodes.length, 2);
});

test("DelegationManagerService chain tracks depth correctly across delegations", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  // First level
  const handle1 = await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-1",
    targetPackId: "pack-1",
  }));

  // Second level
  const parentAtDepth1 = createParentContext({
    agentId: handle1.childAgentId,
    delegationDepth: 1,
    packId: "pack-1",
  });
  const handle2 = await service.delegate(parentAtDepth1, createDelegationSpec({
    targetAgentId: "grandchild-1",
    targetPackId: "pack-2",
  }));

  const chain1 = service.getDelegationChain("parent-agent");
  const chain2 = service.getDelegationChain(handle1.childAgentId);

  assert.equal(handle1.depth, 1);
  assert.equal(handle2.depth, 2);
  assert.equal(chain1!.maxDepthReached, 1);
  assert.equal(chain2!.maxDepthReached, 2);
});

test("DelegationManagerService getActiveDelegations excludes completed", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  const handle1 = await service.delegate(parent, createDelegationSpec({ targetAgentId: "child-1", targetPackId: "pack-1" }));
  const handle2 = await service.delegate(parent, createDelegationSpec({ targetAgentId: "child-2", targetPackId: "pack-2" }));

  await service.complete(handle1.delegationId);

  const active = await service.getActiveDelegations("parent-agent");

  assert.equal(active.length, 1);
  assert.equal(active[0]?.delegationId, handle2.delegationId);
});

test("DelegationManagerService getActiveDelegations excludes failed", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  const handle1 = await service.delegate(parent, createDelegationSpec({ targetAgentId: "child-1", targetPackId: "pack-1" }));
  const handle2 = await service.delegate(parent, createDelegationSpec({ targetAgentId: "child-2", targetPackId: "pack-2" }));

  await service.fail(handle1.delegationId, "test error");

  const active = await service.getActiveDelegations("parent-agent");

  assert.equal(active.length, 1);
  assert.equal(active[0]?.delegationId, handle2.delegationId);
});

test("DelegationManagerService getActiveDelegations excludes cancelled", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  const handle1 = await service.delegate(parent, createDelegationSpec({ targetAgentId: "child-1", targetPackId: "pack-1" }));
  const handle2 = await service.delegate(parent, createDelegationSpec({ targetAgentId: "child-2", targetPackId: "pack-2" }));

  await service.cancel(handle1.delegationId);

  const active = await service.getActiveDelegations("parent-agent");

  assert.equal(active.length, 1);
  assert.equal(active[0]?.delegationId, handle2.delegationId);
});

test("DelegationManagerService getActiveDelegations returns empty for unknown agent", async () => {
  const service = createDelegationManager();

  const active = await service.getActiveDelegations("unknown-agent");

  assert.equal(active.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Timeout Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DelegationManagerService uses defaultTimeout when spec timeout is zero", async () => {
  const service = createDelegationManager({ defaultTimeout: 120000 });
  const parent = createParentContext();
  const spec = createDelegationSpec({ timeout: 0 });

  const handle = await service.delegate(parent, spec);

  // Should use defaultTimeout of 120000ms (2 minutes)
  const delegation = await service.getDelegation(handle.delegationId);
  const expiresIn = new Date(delegation!.expiresAt).getTime() - Date.now();
  assert.ok(expiresIn > 100000); // At least 100 seconds
});

test("DelegationManagerService uses spec timeout when positive", async () => {
  const service = createDelegationManager({ defaultTimeout: 600000 });
  const parent = createParentContext();
  const spec = createDelegationSpec({ timeout: 10000 }); // 10 seconds

  const handle = await service.delegate(parent, spec);

  // Should use spec timeout of 10000ms
  const delegation = await service.getDelegation(handle.delegationId);
  const expiresIn = new Date(delegation!.expiresAt).getTime() - Date.now();
  assert.ok(expiresIn < 20000); // Less than 20 seconds
});

// ─────────────────────────────────────────────────────────────────────────────
// Correlation ID Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DelegationManagerService child context has extended correlationId", async () => {
  const service = createDelegationManager();
  const parent = createParentContext({ correlationId: "parent-corr" });
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);

  // Correlation should include parent correlation and new ID
  assert.ok(handle.correlationId.startsWith("parent-corr:"));
  assert.ok(handle.correlationId.includes(handle.delegationId));
});

test("DelegationManagerService each delegation gets unique correlationId", async () => {
  const service = createDelegationManager();
  const parent = createParentContext({ correlationId: "same-parent" });

  const handle1 = await service.delegate(parent, createDelegationSpec({ targetAgentId: "child-1", targetPackId: "pack-1" }));
  const handle2 = await service.delegate(parent, createDelegationSpec({ targetAgentId: "child-2", targetPackId: "pack-2" }));

  assert.notEqual(handle1.correlationId, handle2.correlationId);
});

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createDelegationManager without options uses defaults", () => {
  const service = createDelegationManager();

  // Should use DEFAULT_MAX_DEPTH from topology validator
  const parent = createParentContext({ delegationDepth: 3 });
  const spec = createDelegationSpec();

  // Depth 3 should fail with default maxDepth of 3
  return assert.rejects(
    async () => service.delegate(parent, spec),
    Error,
  );
});

test("createDelegationManager with custom options", () => {
  const service = createDelegationManager({
    maxDepth: 10,
    maxFanout: 5,
    defaultTimeout: 60000,
  });

  const parent = createParentContext({ delegationDepth: 5 });
  const spec = createDelegationSpec();

  // Depth 5 should be allowed with maxDepth of 10
  return service.delegate(parent, spec).then((handle) => {
    assert.equal(handle.depth, 6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Collaboration Protocol Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DelegationManagerService validateCollaborationMessage rejects invalid message", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  const handle = await service.delegate(parent, createDelegationSpec());

  const invalidMessage = {
    messageId: "msg-1",
    messageType: "completion_report" as const,
    correlation_id: "corr-1",
    parent_run_id: handle.delegationId,
    depth: 10, // Exceeds depth limit
    sender_agent_id: handle.childAgentId,
    receiver_agent_id: handle.parentAgentId,
    domain_id: "coding",
    risk_level: 99, // Exceeds risk limit
    budget_remaining: 200, // Exceeds budget
    trace_id: "trace-1",
    payload: { evidence: [] }, // Empty evidence - invalid
    timestamp: "2026-04-22T00:00:00.000Z",
  };

  const context = {
    parentPermissions: parent.permissions,
    parentRiskMode: 50,
    parentConstraints: {},
    parentBudgetRemaining: 100,
    globalCallDepth: 5,
  };

  const result = service.validateCollaborationMessage(invalidMessage, context);

  assert.equal(result.accepted, false);
  assert.ok(result.violations.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// getExpiredDelegations Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("DelegationManagerService getExpiredDelegations excludes already expired", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  // Create delegation that expires immediately
  const handle = await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-1",
    targetPackId: "pack-1",
    timeout: 1,
  }));

  // Wait for it to expire
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Mark it as expired
  service.revokeExpiredDelegations();

  // Now getExpiredDelegations should not include it
  const expired = service.getExpiredDelegations();
  assert.equal(expired.some((d) => d.delegationId === handle.delegationId), false);
});

test("DelegationManagerService getPendingExpirationCount returns zero when no expired", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-1",
    targetPackId: "pack-1",
    timeout: 60000, // Long timeout
  }));

  const count = service.getPendingExpirationCount();
  assert.equal(count, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Service Instantiation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DelegationManagerService can be instantiated with new", () => {
  const service = new DelegationManagerService();
  assert.ok(service !== undefined);
});

test("DelegationManagerService instance works correctly", async () => {
  const service = new DelegationManagerService({ defaultTimeout: 60000 });
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);

  assert.ok(handle.delegationId.length > 0);
});
