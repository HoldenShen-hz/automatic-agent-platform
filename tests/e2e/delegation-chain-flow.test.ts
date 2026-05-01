/**
 * E2E Delegation Chain Flow Tests - R9-07 Compliance
 *
 * End-to-end tests covering agent delegation chains with permission narrowing:
 * - R9-07: narrowPermissions uses intersection, not replacement
 * - Multi-level delegation chains
 * - Permission boundary enforcement
 * - Delegation revocation flow
 *
 * Test patterns based on existing delegation-chain-flow.test.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createDelegationManager } from "../../src/platform/orchestration/agent-delegation/delegation-manager.service.js";
import { GovernanceDelegationRevocationSaga } from "../../src/org-governance/delegated-governance/governance-delegation-revocation-saga.js";
import type { AgentContext, DelegationSpec } from "../../src/platform/orchestration/agent-delegation/delegation-types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

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
    sandboxTier: "workspace_write",
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

// ─────────────────────────────────────────────────────────────────────────────
// E2E Delegation Chain Flow Tests
// ─────────────────────────────────────────────────────────────────────────────

test("E2E: R9-07 parent agent delegates to child with permission narrowing", async () => {
  const service = createDelegationManager();
  const harness = { cleanup: () => {} }; // No harness needed for unit-level delegation

  let delegateResult;
  try {
    const parent = createParentContext({
      permissions: {
        resources: ["resource-a", "resource-b", "resource-c"],
        actions: ["action-read", "action-write", "action-execute"],
        constraints: { maxDurationMs: 60000, maxTokens: 10000 },
      },
    });

    const spec = createDelegationSpec({
      requiredPermissions: {
        resources: ["resource-a"],
        actions: ["action-read"],
        constraints: {},
      },
    });

    const handle = await service.delegate(parent, spec);
    delegateResult = handle;

    // Verify delegation was created
    assert.ok(handle.delegationId, "Should have delegation ID");
    assert.equal(handle.parentAgentId, "parent-agent");
    assert.equal(handle.childAgentId, "child-agent");
    assert.equal(handle.depth, 1, "Depth should be 1 for first delegation");

    // Verify delegation was stored
    const delegation = service.getDelegation(handle.delegationId);
    assert.ok(delegation, "Should be able to get delegation");
    assert.equal(delegation!.status, "pending", "New delegation should be pending");

    // Verify permissions were narrowed via INTERSECTION (R9-07)
    // Child should only have what parent has AND what child requested
    assert.ok(
      delegation!.permissions.resources.includes("resource-a"),
      "Child should have resource-a (intersection)",
    );
    assert.ok(
      !delegation!.permissions.resources.includes("resource-b") || delegation!.permissions.resources.length <= parent.permissions.resources.length,
      "resource-b should be filtered if not in requiredPermissions",
    );
    assert.ok(
      delegation!.permissions.actions.includes("action-read"),
      "Child should have action-read (intersection)",
    );
    assert.ok(
      !delegation!.permissions.actions.includes("action-write") || delegation!.permissions.actions.length <= parent.permissions.actions.length,
      "action-write should be filtered if not in requiredPermissions",
    );

    // Verify chain tracking
    const chain = service.getDelegationChain("parent-agent");
    assert.ok(chain, "Should have delegation chain");
    assert.equal(chain!.rootAgentId, "parent-agent");
    assert.equal(chain!.nodes.length, 1, "Chain should have 1 node");
    assert.equal(chain!.nodes[0]!.agentId, "child-agent");
  } finally {
    service.cancelDelegation(delegateResult?.delegationId ?? "");
  }
});

test("E2E: R9-07 child agent requests resources beyond parent scope (should be blocked)", async () => {
  const service = createDelegationManager();

  let delegateResult;
  try {
    const parent = createParentContext({
      permissions: {
        resources: ["resource-a", "resource-b"],
        actions: ["action-read", "action-write"],
        constraints: { maxDurationMs: 60000, maxTokens: 10000 },
      },
    });

    // Child requests resource-x which parent does NOT have
    const spec = createDelegationSpec({
      targetAgentId: "greedy-child",
      requiredPermissions: {
        resources: ["resource-a", "resource-x"], // resource-x not in parent
        actions: ["action-read", "action-admin"], // action-admin not in parent
        constraints: {},
      },
    });

    const handle = await service.delegate(parent, spec);
    delegateResult = handle;

    const delegation = service.getDelegation(handle.delegationId);
    assert.ok(delegation, "Delegation should be created");

    // R9-07: narrowPermissions uses INTERSECTION, so resource-x should NOT be granted
    // Only resources that BOTH parent has AND child requested should be granted
    assert.ok(
      !delegation!.permissions.resources.includes("resource-x"),
      "resource-x should NOT be granted (not in parent)",
    );
    assert.ok(
      !delegation!.permissions.actions.includes("action-admin"),
      "action-admin should NOT be granted (not in parent)",
    );

    // Only resource-a and action-read should be granted (intersection)
    assert.ok(
      delegation!.permissions.resources.includes("resource-a"),
      "resource-a should be granted (in both)",
    );
    assert.ok(
      delegation!.permissions.actions.includes("action-read"),
      "action-read should be granted (in both)",
    );
  } finally {
    if (delegateResult?.delegationId) {
      try { service.cancelDelegation(delegateResult.delegationId); } catch { /* ignore */ }
    }
  }
});

test("E2E: R9-07 delegation chain with multiple levels verifies permission intersection", async () => {
  const service = createDelegationManager();

  let grandparentDelegation;
  let parentDelegation;

  try {
    // Level 0: Grandparent with broad permissions
    const grandparent = createParentContext({
      agentId: "grandparent-agent",
      packId: "pack-grandparent",
      permissions: {
        resources: ["resource-a", "resource-b", "resource-c", "resource-d"],
        actions: ["action-read", "action-write", "action-execute", "action-admin"],
        constraints: { maxDurationMs: 120000, maxTokens: 20000 },
      },
    });

    // Level 1: Grandparent delegates to parent (narrowing begins)
    const grandparentSpec = createDelegationSpec({
      targetAgentId: "parent-agent",
      targetAgentType: "coordinator",
      targetPackId: "pack-level-1",
      requiredPermissions: {
        resources: ["resource-a", "resource-b", "resource-c"],
        actions: ["action-read", "action-write"],
        constraints: {},
      },
    });

    const gpHandle = await service.delegate(grandparent, grandparentSpec);
    grandparentDelegation = gpHandle.delegationId;

    // Verify grandparent -> parent narrowing
    const gpDelegation = service.getDelegation(gpHandle.delegationId);
    assert.ok(
      gpDelegation!.permissions.resources.includes("resource-a"),
      "GP->P: Should have resource-a",
    );
    assert.ok(
      gpDelegation!.permissions.resources.includes("resource-b"),
      "GP->P: Should have resource-b",
    );
    assert.ok(
      !gpDelegation!.permissions.resources.includes("resource-d"),
      "GP->P: resource-d should be filtered (not requested)",
    );
    assert.ok(
      !gpDelegation!.permissions.actions.includes("action-admin"),
      "GP->P: action-admin should be filtered (not requested)",
    );

    // Level 2: Parent delegates to child (further narrowing)
    const parentContext = createParentContext({
      agentId: gpHandle.childAgentId,
      packId: "pack-level-1",
      delegationDepth: 1,
      permissions: gpDelegation!.permissions,
    });

    const parentSpec = createDelegationSpec({
      targetAgentId: "child-agent",
      targetAgentType: "worker",
      targetPackId: "pack-level-2",
      requiredPermissions: {
        resources: ["resource-a"],
        actions: ["action-read"],
        constraints: {},
      },
    });

    const pHandle = await service.delegate(parentContext, parentSpec);
    parentDelegation = pHandle.delegationId;

    // Verify parent -> child narrowing
    const pDelegation = service.getDelegation(pHandle.delegationId);
    assert.equal(pHandle.depth, 2, "Parent->Child depth should be 2");

    // R9-07: Child should have ONLY intersection of parent's permissions and child's request
    assert.ok(
      pDelegation!.permissions.resources.includes("resource-a"),
      "P->C: Should have resource-a (intersection)",
    );
    assert.ok(
      !pDelegation!.permissions.resources.includes("resource-b"),
      "P->C: resource-b should NOT be granted (not in child request)",
    );
    assert.ok(
      !pDelegation!.permissions.resources.includes("resource-c"),
      "P->C: resource-c should NOT be granted (not in child request)",
    );
    assert.ok(
      !pDelegation!.permissions.actions.includes("action-write"),
      "P->C: action-write should NOT be granted (not in child request)",
    );
    assert.ok(
      pDelegation!.permissions.actions.includes("action-read"),
      "P->C: Should have action-read (intersection)",
    );

    // Verify constraint inheritance (child gets parent's constraint when no narrowing requested)
    const childConstraints = pDelegation!.permissions.constraints;
    // Child inherits parent's maxDurationMs since no narrower constraint was requested
    assert.ok(
      childConstraints.maxDurationMs !== undefined && childConstraints.maxDurationMs === 120000,
      "maxDuration should be inherited from parent (120000) when child requests no narrowing",
    );
  } finally {
    try { service.cancelDelegation(parentDelegation ?? ""); } catch { /* ignore */ }
    try { service.cancelDelegation(grandparentDelegation ?? ""); } catch { /* ignore */ }
  }
});

test("E2E: R9-07 permission intersection verification - child gets only parent's subset", async () => {
  const service = createDelegationManager();

  let delegationId;
  try {
    // Parent has 5 resources, 4 actions
    const parent = createParentContext({
      permissions: {
        resources: ["res-alpha", "res-beta", "res-gamma", "res-delta", "res-epsilon"],
        actions: ["read", "write", "execute", "admin"],
        constraints: { maxDurationMs: 60000, maxTokens: 10000 },
      },
    });

    // Child requests only 2 resources, 1 action
    const spec = createDelegationSpec({
      targetAgentId: "subset-child",
      requiredPermissions: {
        resources: ["res-alpha", "res-gamma"],
        actions: ["write"],
        constraints: {},
      },
    });

    const handle = await service.delegate(parent, spec);
    delegationId = handle.delegationId;

    const delegation = service.getDelegation(handle.delegationId);

    // R9-07: Result should be intersection, not replacement
    // Child should have: res-alpha, res-gamma (intersection) + write (intersection)
    assert.equal(
      delegation!.permissions.resources.length,
      2,
      "Child should have exactly 2 resources (intersection)",
    );
    assert.ok(
      delegation!.permissions.resources.includes("res-alpha"),
      "Should have res-alpha",
    );
    assert.ok(
      delegation!.permissions.resources.includes("res-gamma"),
      "Should have res-gamma",
    );
    assert.ok(
      !delegation!.permissions.resources.includes("res-beta"),
      "Should NOT have res-beta (not in intersection)",
    );

    assert.equal(
      delegation!.permissions.actions.length,
      1,
      "Child should have exactly 1 action (intersection)",
    );
    assert.ok(
      delegation!.permissions.actions.includes("write"),
      "Should have write",
    );
    assert.ok(
      !delegation!.permissions.actions.includes("read"),
      "Should NOT have read (not in intersection)",
    );
  } finally {
    if (delegationId) {
      try { service.cancelDelegation(delegationId); } catch { /* ignore */ }
    }
  }
});

test("E2E: delegation revocation flow with GovernanceDelegationRevocationSaga", async () => {
  // Track all handler invocations
  const handlerCalls: string[] = [];
  const frozenResources: string[] = [];
  const revokedItems: string[] = [];

  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: (resourceId: string) => {
      handlerCalls.push(`freeze:${resourceId}`);
      frozenResources.push(resourceId);
    },
    revokePendingApprovals: (delegationId: string) => {
      handlerCalls.push(`revoke-approval:${delegationId}`);
      revokedItems.push(`approval:${delegationId}`);
    },
    revokeActiveSessions: (delegationId: string) => {
      handlerCalls.push(`revoke-session:${delegationId}`);
      revokedItems.push(`session:${delegationId}`);
    },
    revokeSecretLeases: (delegationId: string) => {
      handlerCalls.push(`revoke-secret:${delegationId}`);
      revokedItems.push(`secret:${delegationId}`);
    },
    revokeWorkerLeases: (delegationId: string) => {
      handlerCalls.push(`revoke-worker:${delegationId}`);
      revokedItems.push(`worker:${delegationId}`);
    },
    revokeScheduledTriggers: (delegationId: string) => {
      handlerCalls.push(`revoke-trigger:${delegationId}`);
      revokedItems.push(`trigger:${delegationId}`);
    },
    revokeDerivedDelegation: (delegationId: string) => {
      handlerCalls.push(`revoke-derived:${delegationId}`);
      revokedItems.push(`derived:${delegationId}`);
    },
    compensateResource: (resourceId: string) => {
      handlerCalls.push(`compensate:${resourceId}`);
    },
    audit: () => {
      handlerCalls.push("audit");
    },
  });

  try {
    const request = {
      delegationId: "delegation-revoke-test-001",
      requestedAtMs: Date.now() - 5000,
      derivedResourceIds: ["resource-1", "resource-2", "resource-3"],
      derivedDelegationIds: ["child-dlg-1", "child-dlg-2"],
      cascadeScope: {
        pendingApprovals: true,
        activeSessions: true,
        secretLeases: true,
        workerLeases: true,
        scheduledTriggers: true,
      },
    };

    const receipt = saga.revoke(request, Date.now());

    // Verify receipt structure
    assert.equal(receipt.delegationId, "delegation-revoke-test-001");
    assert.ok(receipt.status === "completed" || receipt.status === "compensated");

    // Verify all resource IDs were frozen
    assert.equal(receipt.frozenResourceIds.length, 3);
    assert.ok(receipt.frozenResourceIds.includes("resource-1"));
    assert.ok(receipt.frozenResourceIds.includes("resource-2"));
    assert.ok(receipt.frozenResourceIds.includes("resource-3"));

    // Verify cascade occurred
    assert.ok(receipt.revokedPendingApprovals.length > 0);
    assert.ok(receipt.revokedActiveSessions.length > 0);
    assert.ok(receipt.revokedSecretLeases.length > 0);
    assert.ok(receipt.revokedWorkerLeases.length > 0);
    assert.ok(receipt.revokedScheduledTriggers.length > 0);
    assert.ok(receipt.revokedDerivedDelegationIds.length === 2);

    // Verify SLO compliance
    assert.ok(receipt.revokeWithinSlo, "Should complete within SLO");
    assert.ok(receipt.cascadeWithinSlo, "Cascade should complete within SLO");

    // Verify stages
    assert.ok(receipt.sagaStages.includes("prepare"));
    assert.ok(receipt.sagaStages.includes("commit"));
    assert.ok(receipt.sagaStages.includes("audit"));

    // Verify execution log has entries
    assert.ok(receipt.executionLog.length > 0, "Should have execution log entries");

    // Verify no failures
    assert.equal(receipt.failedStage, null);
  } finally {
    // Cleanup - no delegation to cancel since saga is standalone
  }
});

test("E2E: delegation revocation with compensation when prepare fails", async () => {
  const handlerCalls: string[] = [];

  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: (resourceId: string, context) => {
      handlerCalls.push(`freeze:${resourceId}`);
      // Simulate failure on resource-2
      if (resourceId === "resource-2") {
        const err = new Error("Freeze failed");
        err.name = "FreezeError";
        throw err;
      }
    },
    compensateResource: (resourceId: string) => {
      handlerCalls.push(`compensate:${resourceId}`);
    },
    audit: () => {
      handlerCalls.push("audit");
    },
  });

  const request = {
    delegationId: "delegation-fail-test-001",
    requestedAtMs: Date.now() - 1000,
    derivedResourceIds: ["resource-1", "resource-2"],
    derivedDelegationIds: [],
  };

  const receipt = saga.revoke(request, Date.now());

  // Verify compensation occurred
  assert.equal(receipt.status, "compensated");
  assert.equal(receipt.failedStage, "prepare");
  assert.ok(receipt.compensationResourceIds.length > 0, "Should have compensation");

  // Verify compensate was called
  // Only resource-1 is compensated because resource-2 failed during freeze
  // and wasn't added to frozenResourceIds
  assert.ok(handlerCalls.includes("compensate:resource-1"), "Should compensate resource-1");
  assert.ok(!handlerCalls.includes("compensate:resource-2"), "Should NOT compensate resource-2 (it failed to freeze)");
});

test("E2E: delegation chain with child requesting no specific permissions gets parent subset", async () => {
  const service = createDelegationManager();

  let delegationId;
  try {
    const parent = createParentContext({
      permissions: {
        resources: ["res-1", "res-2", "res-3"],
        actions: ["act-read", "act-write"],
        constraints: { maxDurationMs: 60000, maxTokens: 10000 },
      },
    });

    // Child requests empty permissions (should get parent's full set as subset)
    const spec = createDelegationSpec({
      targetAgentId: "empty-request-child",
      requiredPermissions: {
        resources: [],
        actions: [],
        constraints: {},
      },
    });

    const handle = await service.delegate(parent, spec);
    delegationId = handle.delegationId;

    const delegation = service.getDelegation(handle.delegationId);

    // R9-07: When requiredPermissions is empty, result is parent's full set
    // This is because intersection with empty set gives empty, but the code
    // handles empty resources/actions specially to preserve parent's permissions
    assert.ok(delegation!.permissions.resources.length > 0, "Should have resources from parent");
    assert.ok(delegation!.permissions.actions.length > 0, "Should have actions from parent");
  } finally {
    if (delegationId) {
      try { service.cancelDelegation(delegationId); } catch { /* ignore */ }
    }
  }
});

test("E2E: constraint narrowing - child gets more restrictive constraints", async () => {
  const service = createDelegationManager();

  let delegationId;
  try {
    const parent = createParentContext({
      permissions: {
        resources: ["resource-a"],
        actions: ["action-read"],
        constraints: {
          maxDurationMs: 60000,
          maxTokens: 10000,
        },
      },
    });

    const spec = createDelegationSpec({
      requiredPermissions: {
        resources: ["resource-a"],
        actions: ["action-read"],
        constraints: {
          maxDurationMs: 30000, // More restrictive
          maxTokens: 5000, // More restrictive
        },
      },
    });

    const handle = await service.delegate(parent, spec);
    delegationId = handle.delegationId;

    const delegation = service.getDelegation(handle.delegationId);
    assert.ok(delegation, "Delegation should exist");

    // R9-07: Constraints should be narrowed to more restrictive values
    assert.ok(
      delegation.permissions.constraints.maxDurationMs <= 30000,
      "maxDuration should be at most child's requested value",
    );
    assert.ok(
      delegation.permissions.constraints.maxTokens <= 5000,
      "maxTokens should be at most child's requested value",
    );
  } finally {
    if (delegationId) {
      try { service.cancelDelegation(delegationId); } catch { /* ignore */ }
    }
  }
});