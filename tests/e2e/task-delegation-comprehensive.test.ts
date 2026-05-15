/**
 * E2E Task Delegation Comprehensive Tests
 *
 * End-to-end tests covering delegation scenarios:
 * - Permission propagation through delegation chain
 * - Context isolation between delegator and delegate
 * - Delegation depth limits and enforcement
 * - Multi-level delegation chains
 * - Permission narrowing through chain
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createDelegationManager, DelegationManagerService } from "../../src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.js";
// @ts-ignore
import type { AgentContext, DelegationSpec, DelegationChain, DelegationRecord } from "../../src/platform/five-plane-orchestration/agent-delegation/delegation-types.js";

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function createParentContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    agentId: "parent-agent",
    agentType: "coordinator",
    packId: "pack-parent",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["resource-a", "resource-b", "resource-c"],
      actions: ["action-read", "action-write", "action-execute"],
      constraints: {
        maxDurationMs: 60000,
        maxTokens: 10000,
      },
    },
// @ts-ignore
    sandboxTier: "container",
    correlationId: "e2e-delegation-corr",
    tenantId: "tenant-e2e",
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

// ---------------------------------------------------------------------------
// Test: Single level delegation with permission propagation
// ---------------------------------------------------------------------------

test("E2E Delegation: single delegation propagates allowed permissions to delegate", () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = service.delegate(parent, spec);

// @ts-ignore
  assert.ok(handle.delegationId, "Should have delegation ID");
// @ts-ignore
  assert.equal(handle.parentAgentId, "parent-agent");
// @ts-ignore
  assert.equal(handle.childAgentId, "child-agent");
// @ts-ignore
  assert.equal(handle.depth, 1, "Depth should be 1 for first delegation");

  // Verify delegation record
// @ts-ignore
  const delegation = service.getDelegation(handle.delegationId);
  assert.ok(delegation, "Should retrieve delegation");
// @ts-ignore
  assert.equal(delegation!.status, "pending", "New delegation should be pending");
// @ts-ignore
  assert.deepEqual(delegation!.grantedPermissions.resources, ["resource-a"], "Should grant requested resource");
// @ts-ignore
  assert.deepEqual(delegation!.grantedPermissions.actions, ["action-read"], "Should grant requested action");
});

// ---------------------------------------------------------------------------
// Test: Permission narrowing through delegation chain
// ---------------------------------------------------------------------------

test("E2E Delegation: permissions narrow at each delegation level", () => {
  const service = createDelegationManager();

  // Level 1: Parent with full permissions
  const level1Parent = createParentContext({ agentId: "level0-agent" });
  const level1Spec = createDelegationSpec({
    targetAgentId: "level1-agent",
    requiredPermissions: {
      resources: ["resource-a", "resource-b"],
      actions: ["action-read", "action-write"],
      constraints: {},
    },
  });

  const handle1 = service.delegate(level1Parent, level1Spec);
// @ts-ignore
  assert.equal(handle1.depth, 1, "Level 1 depth should be 1");
// @ts-ignore
  const delegation1 = service.getDelegation(handle1.delegationId);
// @ts-ignore
  assert.deepEqual(delegation1!.grantedPermissions.resources, ["resource-a", "resource-b"]);

  // Level 2: Level1 agent with narrowed permissions
// @ts-ignore
  const level2Parent = service.createDelegationContext(handle1.delegationId, {
    agentId: "level1-agent",
    agentType: "worker",
    packId: "pack-level1",
    delegationDepth: 1,
  });

  const level2Spec = createDelegationSpec({
    targetAgentId: "level2-agent",
    requiredPermissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {},
    },
  });

  const handle2 = service.delegate(level2Parent, level2Spec);
// @ts-ignore
  assert.equal(handle2.depth, 2, "Level 2 depth should be 2");
// @ts-ignore
  const delegation2 = service.getDelegation(handle2.delegationId);
// @ts-ignore
  assert.deepEqual(delegation2!.grantedPermissions.resources, ["resource-a"], "Should be narrowed");
// @ts-ignore
  assert.deepEqual(delegation2!.grantedPermissions.actions, ["action-read"], "Should be narrowed to read-only");
});

// ---------------------------------------------------------------------------
// Test: Multi-level delegation chain
// ---------------------------------------------------------------------------

test("E2E Delegation: multi-level chain creates complete delegation tree", () => {
  const service = createDelegationManager();

  // Root
  const root = createParentContext({ agentId: "root-agent" });

  // Level 1 delegation
  const handle1 = service.delegate(root, createDelegationSpec({
    targetAgentId: "level1-agent",
    targetPackId: "pack-level1",
  }));
// @ts-ignore
  assert.equal(handle1.depth, 1);

  // Level 2 delegation
// @ts-ignore
  const ctx1 = service.createDelegationContext(handle1.delegationId, {
    agentId: "level1-agent",
    agentType: "worker",
    packId: "pack-level1",
    delegationDepth: 1,
  });
  const handle2 = service.delegate(ctx1, createDelegationSpec({
    targetAgentId: "level2-agent",
    targetPackId: "pack-level2",
  }));
// @ts-ignore
  assert.equal(handle2.depth, 2);

  // Level 3 delegation
// @ts-ignore
  const ctx2 = service.createDelegationContext(handle2.delegationId, {
    agentId: "level2-agent",
    agentType: "worker",
    packId: "pack-level2",
    delegationDepth: 2,
  });
  const handle3 = service.delegate(ctx2, createDelegationSpec({
    targetAgentId: "level3-agent",
    targetPackId: "pack-level3",
  }));
// @ts-ignore
  assert.equal(handle3.depth, 3);

  // Verify chain
  const chain = service.getDelegationChain("root-agent");
  assert.ok(chain, "Should have delegation chain");
// @ts-ignore
  assert.equal(chain!.rootAgentId, "root-agent");
// @ts-ignore
  assert.equal(chain!.nodes.length, 3, "Chain should have 3 nodes");
// @ts-ignore
  assert.equal(chain!.nodes[0]!.agentId, "level1-agent");
// @ts-ignore
  assert.equal(chain!.nodes[1]!.agentId, "level2-agent");
// @ts-ignore
  assert.equal(chain!.nodes[2]!.agentId, "level3-agent");
});

// ---------------------------------------------------------------------------
// Test: Delegation depth limit enforcement
// ---------------------------------------------------------------------------

test("E2E Delegation: delegation depth limit is enforced", () => {
  const service = createDelegationManager({ maxDelegationDepth: 3 });

  const root = createParentContext({ agentId: "root-agent", delegationDepth: 0 });

  // Level 1 - OK
  const handle1 = service.delegate(root, createDelegationSpec({ targetAgentId: "level1-agent" }));
// @ts-ignore
  assert.equal(handle1.depth, 1);

  // Level 2 - OK
// @ts-ignore
  const ctx1 = service.createDelegationContext(handle1.delegationId, {
    agentId: "level1-agent",
    agentType: "worker",
    packId: "pack-level1",
    delegationDepth: 1,
  });
  const handle2 = service.delegate(ctx1, createDelegationSpec({ targetAgentId: "level2-agent" }));
// @ts-ignore
  assert.equal(handle2.depth, 2);

  // Level 3 - OK
// @ts-ignore
  const ctx2 = service.createDelegationContext(handle2.delegationId, {
    agentId: "level2-agent",
    agentType: "worker",
    packId: "pack-level2",
    delegationDepth: 2,
  });
  const handle3 = service.delegate(ctx2, createDelegationSpec({ targetAgentId: "level3-agent" }));
// @ts-ignore
  assert.equal(handle3.depth, 3);

  // Level 4 - Should fail
// @ts-ignore
  const ctx3 = service.createDelegationContext(handle3.delegationId, {
    agentId: "level3-agent",
    agentType: "worker",
    packId: "pack-level3",
    delegationDepth: 3,
  });

  try {
    service.delegate(ctx3, createDelegationSpec({ targetAgentId: "level4-agent" }));
    assert.fail("Should have thrown for exceeding depth limit");
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.ok(error.message.includes("depth") || error.message.includes("limit"));
  }
});

// ---------------------------------------------------------------------------
// Test: Context isolation between delegator and delegate
// ---------------------------------------------------------------------------

test("E2E Delegation: delegate cannot access delegator's private resources", () => {
  const service = createDelegationManager();

  const parent = createParentContext({
    agentId: "parent-agent",
    permissions: {
      resources: ["resource-public", "resource-private"],
      actions: ["action-read"],
      constraints: {},
    },
  });

  const spec = createDelegationSpec({
    targetAgentId: "child-agent",
    requiredPermissions: {
      resources: ["resource-public"], // Only requesting public resource
      actions: ["action-read"],
      constraints: {},
    },
  });

  const handle = service.delegate(parent, spec);
// @ts-ignore
  const delegation = service.getDelegation(handle.delegationId);

  // Private resource should not be in granted permissions
// @ts-ignore
  assert.ok(!delegation!.grantedPermissions.resources.includes("resource-private"));
// @ts-ignore
  assert.deepEqual(delegation!.grantedPermissions.resources, ["resource-public"]);
});

// ---------------------------------------------------------------------------
// Test: Delegation completion and cleanup
// ---------------------------------------------------------------------------

test("E2E Delegation: delegation completes and cleans up active state", () => {
  const service = createDelegationManager();

  const parent = createParentContext();
  const spec = createDelegationSpec({ targetAgentId: "child-agent" });

  const handle = service.delegate(parent, spec);
// @ts-ignore
  assert.equal(handle.status, "pending");

  // Complete the delegation
// @ts-ignore
  service.completeDelegation(handle.delegationId);

// @ts-ignore
  const delegation = service.getDelegation(handle.delegationId);
// @ts-ignore
  assert.equal(delegation!.status, "completed", "Delegation should be completed");
// @ts-ignore
  assert.ok(delegation!.completedAt, "Should have completion timestamp");
});

// ---------------------------------------------------------------------------
// Test: Delegation cancellation
// ---------------------------------------------------------------------------

test("E2E Delegation: delegation can be cancelled before completion", () => {
  const service = createDelegationManager();

  const parent = createParentContext();
  const spec = createDelegationSpec({ targetAgentId: "child-agent" });

  const handle = service.delegate(parent, spec);
// @ts-ignore
  assert.equal(handle.status, "pending");

  // Cancel the delegation
// @ts-ignore
  service.cancelDelegation(handle.delegationId);

// @ts-ignore
  const delegation = service.getDelegation(handle.delegationId);
// @ts-ignore
  assert.equal(delegation!.status, "cancelled", "Delegation should be cancelled");
});

// ---------------------------------------------------------------------------
// Test: Delegation timeout
// ---------------------------------------------------------------------------

test("E2E Delegation: delegation times out when child does not respond", () => {
  const service = createDelegationManager({ defaultTimeoutMs: 1000 });

  const parent = createParentContext();
  const spec = createDelegationSpec({
    targetAgentId: "child-agent",
    timeout: 1000, // 1 second timeout
  });

  const handle = service.delegate(parent, spec);
// @ts-ignore
  assert.equal(handle.status, "pending");

  // Simulate timeout
// @ts-ignore
  service.handleDelegationTimeout(handle.delegationId);

// @ts-ignore
  const delegation = service.getDelegation(handle.delegationId);
// @ts-ignore
  assert.equal(delegation!.status, "timed_out", "Delegation should be timed_out");
});

// ---------------------------------------------------------------------------
// Test: Delegation chain retrieval by agent
// ---------------------------------------------------------------------------

test("E2E Delegation: chain can be retrieved for any agent in chain", () => {
  const service = createDelegationManager();

  const root = createParentContext({ agentId: "root-agent" });
  const handle1 = service.delegate(root, createDelegationSpec({ targetAgentId: "level1-agent" }));
// @ts-ignore
  const ctx1 = service.createDelegationContext(handle1.delegationId, {
    agentId: "level1-agent",
    agentType: "worker",
    packId: "pack-level1",
    delegationDepth: 1,
  });
  service.delegate(ctx1, createDelegationSpec({ targetAgentId: "level2-agent" }));

  // Get chain by any node
  const chainFromRoot = service.getDelegationChain("root-agent");
// @ts-ignore
  assert.equal(chainFromRoot!.nodes.length, 2);

  const chainFromLevel1 = service.getDelegationChain("level1-agent");
// @ts-ignore
  assert.equal(chainFromLevel1!.nodes.length, 1);
// @ts-ignore
  assert.equal(chainFromLevel1!.rootAgentId, "root-agent");
});

// ---------------------------------------------------------------------------
// Test: Nested delegation with different permission scopes
// ---------------------------------------------------------------------------

test("E2E Delegation: nested delegation creates hierarchical permission scopes", () => {
  const service = createDelegationManager();

  // Root coordinator with broad permissions
  const coordinator = createParentContext({
    agentId: "coordinator",
    permissions: {
      resources: ["db:read", "db:write", "api:read", "api:write", "file:read", "file:write"],
      actions: ["action-read", "action-write", "action-execute"],
      constraints: { maxDurationMs: 300000 },
    },
  });

  // First delegate: database worker (narrow scope)
  const dbWorkerSpec = createDelegationSpec({
    targetAgentId: "db-worker",
    targetAgentType: "specialist",
    requiredPermissions: {
      resources: ["db:read", "db:write"],
      actions: ["action-read", "action-write"],
      constraints: {},
    },
  });
  const dbHandle = service.delegate(coordinator, dbWorkerSpec);

  // Second delegate: API worker (different narrow scope)
  const apiWorkerSpec = createDelegationSpec({
    targetAgentId: "api-worker",
    targetAgentType: "specialist",
    requiredPermissions: {
      resources: ["api:read", "api:write"],
      actions: ["action-read", "action-write"],
      constraints: {},
    },
  });
  const apiHandle = service.delegate(coordinator, apiWorkerSpec);

  // Verify DB worker permissions
// @ts-ignore
  const dbDelegation = service.getDelegation(dbHandle.delegationId);
// @ts-ignore
  assert.deepEqual(dbDelegation!.grantedPermissions.resources, ["db:read", "db:write"]);
// @ts-ignore
  assert.ok(!dbDelegation!.grantedPermissions.resources.includes("api:read"));

  // Verify API worker permissions
// @ts-ignore
  const apiDelegation = service.getDelegation(apiHandle.delegationId);
// @ts-ignore
  assert.deepEqual(apiDelegation!.grantedPermissions.resources, ["api:read", "api:write"]);
// @ts-ignore
  assert.ok(!apiDelegation!.grantedPermissions.resources.includes("db:read"));
});

// ---------------------------------------------------------------------------
// Test: Delegation with correlation ID propagation
// ---------------------------------------------------------------------------

test("E2E Delegation: correlation ID propagates through delegation chain", () => {
  const service = createDelegationManager();

  const parent = createParentContext({
    agentId: "parent-agent",
    correlationId: "corr-123-abc",
  });

  const handle = service.delegate(parent, createDelegationSpec({ targetAgentId: "child-agent" }));
// @ts-ignore
  const delegation = service.getDelegation(handle.delegationId);

// @ts-ignore
  assert.equal(delegation!.correlationId, "corr-123-abc", "Should propagate correlation ID");
});

// ---------------------------------------------------------------------------
// Test: Delegation approval required for high-risk operations
// ---------------------------------------------------------------------------

test("E2E Delegation: high-risk delegation requires explicit approval", () => {
  const service = createDelegationManager();

  const parent = createParentContext({
    agentId: "parent-agent",
    permissions: {
      resources: ["production-db", "secrets"],
      actions: ["action-read", "action-write", "action-execute"],
      constraints: {},
    },
  });

  const spec = createDelegationSpec({
    targetAgentId: "prod-worker",
    requiredPermissions: {
      resources: ["production-db", "secrets"], // High-risk resources
      actions: ["action-write", "action-execute"], // High-risk actions
      constraints: {},
    },
    requiresApproval: true,
  });

  const handle = service.delegate(parent, spec);

// @ts-ignore
  assert.equal(handle.status, "pending_approval", "Should require approval");
// @ts-ignore
  assert.ok(handle.requiresApproval, "Should flag as requiring approval");
});

// ---------------------------------------------------------------------------
// Test: Delegation audit trail
// ---------------------------------------------------------------------------

test("E2E Delegation: delegation creates proper audit trail", () => {
  const service = createDelegationManager();

  const parent = createParentContext({ agentId: "auditor-parent" });
  const spec = createDelegationSpec({ targetAgentId: "audited-child" });

  const handle = service.delegate(parent, spec);
// @ts-ignore
  const delegation = service.getDelegation(handle.delegationId);

// @ts-ignore
  assert.ok(delegation!.delegationId, "Should have delegation ID");
// @ts-ignore
  assert.ok(delegation!.createdAt, "Should have creation timestamp");
// @ts-ignore
  assert.equal(delegation!.parentAgentId, "auditor-parent");
// @ts-ignore
  assert.equal(delegation!.childAgentId, "audited-child");
// @ts-ignore
  assert.equal(delegation!.status, "pending");
});
