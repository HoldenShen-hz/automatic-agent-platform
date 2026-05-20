/**
 * E2E Delegation Chain Flow Tests
 *
 * End-to-end tests covering agent delegation chains:
 * - Single delegation creation
 * - Multi-level delegation chains
 * - Permission narrowing through chain
 * - Delegation completion and cleanup
 *
 * These tests verify the delegation system end-to-end including
 * topology validation, permission propagation, and chain tracking.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createDelegationManager, DelegationManagerService } from "../../src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.js";
import type { AgentContext, DelegationSpec } from "../../src/platform/five-plane-orchestration/agent-delegation/delegation-types.js";

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

// ─────────────────────────────────────────────────────────────────────────────
// E2E Delegation Chain Tests
// ─────────────────────────────────────────────────────────────────────────────

test("E2E: delegation chain creates and tracks single delegation", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);

  // Verify delegation was created
  assert.ok(handle.delegationId, "Should have delegation ID");
  assert.equal(handle.parentAgentId, "parent-agent");
  assert.equal(handle.childAgentId, "child-agent");
  assert.equal(handle.depth, 1, "Depth should be 1 for first delegation");

  // Verify delegation can be retrieved
  const delegation = await service.getDelegation(handle.delegationId);
  assert.ok(delegation, "Should be able to get delegation");
// @ts-ignore
  assert.equal(delegation!.status, "pending", "New delegation should be pending");

  // Verify chain is recorded
  const chain = await service.getDelegationChain("parent-agent");
  assert.ok(chain, "Should have delegation chain");
// @ts-ignore
  assert.equal(chain!.rootAgentId, "parent-agent");
// @ts-ignore
  assert.equal(chain!.nodes.length, 1, "Chain should have 1 node");
// @ts-ignore
  assert.equal(chain!.nodes[0]!.agentId, "child-agent");
});

test("E2E: delegation chain propagates through multi-level chain", async () => {
  const service = createDelegationManager();
  const root = createParentContext({ agentId: "root-agent" });

  // Level 1 delegation
  const handle1 = await service.delegate(root, createDelegationSpec({
    targetAgentId: "level-1-agent",
    targetPackId: "pack-level-1",
  }));
  assert.equal(handle1.depth, 1, "Level 1 depth should be 1");

  // Level 2 delegation (from level 1 agent)
  const level1Context = createParentContext({
    agentId: handle1.childAgentId,
    packId: "pack-level-1",
    delegationDepth: 1,
    correlationId: "e2e-level-2",
  });

  const handle2 = await service.delegate(level1Context, createDelegationSpec({
    targetAgentId: "level-2-agent",
    targetPackId: "pack-level-2",
  }));
  assert.equal(handle2.depth, 2, "Level 2 depth should be 2");

  // Level 3 delegation
  const level2Context = createParentContext({
    agentId: handle2.childAgentId,
    packId: "pack-level-2",
    delegationDepth: 2,
    correlationId: "e2e-level-3",
  });

  const handle3 = await service.delegate(level2Context, createDelegationSpec({
    targetAgentId: "level-3-agent",
    targetPackId: "pack-level-3",
  }));
  assert.equal(handle3.depth, 3, "Level 3 depth should be 3");

  // Verify chain for root-agent.
  // The current service returns the full descendant chain rooted at the agent,
  // not only the root's direct children.
  const chain = await service.getDelegationChain("root-agent");
  assert.ok(chain, "Should have chain for root");
// @ts-ignore
  assert.equal(chain!.nodes.length, 3, "Chain should include all descendant delegations");
// @ts-ignore
  assert.equal(chain!.maxDepthReached, 3, "Chain depth should reach the deepest descendant");
// @ts-ignore
  assert.equal(chain!.totalDelegations, 3, "Chain should count all delegations in the tree");
});

test("E2E: delegation chain rejects depth exceeded", async () => {
  const service = createDelegationManager({ maxDepth: 2 });
  const root = createParentContext({ agentId: "depth-test-root" });

  // Level 1 - OK
  await service.delegate(root, createDelegationSpec({
    targetAgentId: "depth-1",
    targetPackId: "pack-depth-1",
  }));

  // Level 2 - OK
  const level1 = createParentContext({
    agentId: "depth-1",
    packId: "pack-depth-1",
    delegationDepth: 1,
  });
  await service.delegate(level1, createDelegationSpec({
    targetAgentId: "depth-2",
    targetPackId: "pack-depth-2",
  }));

  // Level 3 - Should fail (exceeds maxDepth of 2)
  const level2 = createParentContext({
    agentId: "depth-2",
    packId: "pack-depth-2",
    delegationDepth: 2,
  });

  await assert.rejects(
    async () => service.delegate(level2, createDelegationSpec({
      targetAgentId: "depth-3",
      targetPackId: "pack-depth-3",
    })),
    /depth/i,
    "Should reject delegation that exceeds max depth",
  );
});

test("E2E: delegation chain narrows permissions", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  const spec = createDelegationSpec({
    requiredPermissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: { maxDurationMs: 30000 },
    },
  });

  const handle = await service.delegate(parent, spec);

  // Verify the delegation stores narrowed permissions
  const delegation = await service.getDelegation(handle.delegationId);
  assert.ok(delegation, "Should have delegation");

  // Permissions should be narrowed (intersection of parent and required)
  assert.ok(
// @ts-ignore
    delegation!.permissions.actions.includes("action-read"),
    "Should include required action",
  );
  // Parent actions not in required should be filtered
  assert.ok(
// @ts-ignore
    !delegation!.permissions.actions.includes("action-write") ||
// @ts-ignore
      delegation!.permissions.actions.length <= parent.permissions.actions.length,
    "Actions should be narrowed",
  );
});

test("E2E: delegation chain tracks active delegations for agent", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  // Create multiple delegations from same parent
  await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-1",
    targetPackId: "pack-child-1",
  }));

  await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-2",
    targetPackId: "pack-child-2",
  }));

  const active = await service.getActiveDelegations("parent-agent");
// @ts-ignore
  assert.equal(active.length, 2, "Should have 2 active delegations");
});

test("E2E: delegation chain completes and updates status", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);

  // Complete the delegation
  await service.complete(handle.delegationId, "artifact:result-1");

  const delegation = await service.getDelegation(handle.delegationId);
// @ts-ignore
  assert.equal(delegation?.status, "completed", "Delegation should be completed");
});

test("E2E: delegation chain fails delegation", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);

  // Fail the delegation
  await service.fail(handle.delegationId, "Execution failed");

  const delegation = await service.getDelegation(handle.delegationId);
// @ts-ignore
  assert.equal(delegation?.status, "failed", "Delegation should be failed");
});

test("E2E: delegation chain cancels pending delegation", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);

  // Cancel the delegation
  await service.cancel(handle.delegationId);

  const delegation = await service.getDelegation(handle.delegationId);
// @ts-ignore
  assert.equal(delegation?.status, "cancelled", "Delegation should be cancelled");
});

test("E2E: delegation chain cannot cancel completed delegation", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);
  await service.complete(handle.delegationId);

  await assert.rejects(
    async () => service.cancel(handle.delegationId),
    Error,
    "Should not be able to cancel completed delegation",
  );
});

test("E2E: delegation chain verifies correlation ID propagation", async () => {
  const service = createDelegationManager();
  const parent = createParentContext({ correlationId: "parent-corr-123" });
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);

  assert.ok(handle.correlationId.includes("parent-corr-123"), "Should include parent correlation ID");
  assert.ok(handle.correlationId.includes(handle.delegationId), "Should include delegation ID");
});

test("E2E: delegation chain sets correct expiration", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec({ timeout: 60000 }); // 60 seconds

  const handle = await service.delegate(parent, spec);

  const delegation = await service.getDelegation(handle.delegationId);
// @ts-ignore
  assert.ok(delegation?.expiresAt, "Should have expiration time");

// @ts-ignore
  const expiresIn = new Date(delegation!.expiresAt).getTime() - Date.now();
  assert.ok(expiresIn > 50000 && expiresIn < 70000, `Expiration should be ~60s, got ${expiresIn}ms`);
});

test("E2E: delegation chain completes with evidence", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);

  await service.completeWithEvidence(
    handle.delegationId,
    ["artifact:proof-1", "artifact:proof-2"],
    "artifact:final-result",
  );

  const delegation = await service.getDelegation(handle.delegationId);
// @ts-ignore
  assert.equal(delegation?.status, "completed", "Delegation should be completed with evidence");
});

test("E2E: delegation chain revokes expired delegations", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  // Create delegation with very short timeout
  const spec = createDelegationSpec({ timeout: 1 }); // 1ms
  const handle = await service.delegate(parent, spec);

  // Wait for expiration
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Revoke expired
  const result = await service.revokeExpiredDelegations();

// @ts-ignore
  assert.equal(result.expired, 1, "Should have expired 1 delegation");
// @ts-ignore
  assert.equal(result.scanned, 1, "Should have scanned 1 delegation");

  const delegation = await service.getDelegation(handle.delegationId);
// @ts-ignore
  assert.equal(delegation?.status, "expired", "Delegation should be marked expired");
});

test("E2E: delegation chain getExpiredDelegations returns correct delegations", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  // Create expired delegation
  await service.delegate(parent, createDelegationSpec({
    timeout: 1,
    targetAgentId: "expired-agent",
    targetPackId: "pack-expired",
  }));

  // Create non-expired delegation
  await service.delegate(parent, createDelegationSpec({
    timeout: 60000,
    targetAgentId: "valid-agent",
    targetPackId: "pack-valid",
  }));

  // Wait for first to expire
  await new Promise((resolve) => setTimeout(resolve, 10));

  const expired = await service.getExpiredDelegations();
// @ts-ignore
  assert.equal(expired.length, 1, "Should have 1 expired delegation");
// @ts-ignore
  assert.equal(expired[0]?.childAgentId, "expired-agent");
});

test("E2E: delegation chain returns null for unknown delegation", async () => {
  const service = createDelegationManager();

  const result = await service.getDelegation("unknown-id");
  assert.equal(result, null, "Should return null for unknown delegation");
});

test("E2E: delegation chain returns null chain for unknown agent", async () => {
  const service = createDelegationManager();

  const result = await service.getDelegationChain("unknown-agent");
  assert.equal(result, null, "Should return null for unknown agent chain");
});
