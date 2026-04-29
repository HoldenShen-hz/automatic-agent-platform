/**
 * Integration tests for Delegation Manager Service
 *
 * Tests the full delegation lifecycle including creation, completion,
 * cancellation, and chain tracking.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createDelegationManager } from "../../../../src/platform/agent-delegation/index.js";
import { DelegationDepthExceededError, DelegationFanoutExceededError } from "../../../../src/platform/agent-delegation/index.js";
import type { AgentContext, DelegationSpec } from "../../../../src/platform/agent-delegation/index.js";

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
      resources: ["resource-a", "resource-b"],
      actions: ["action-read", "action-write"],
      constraints: {},
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
// Lifecycle Tests
// ─────────────────────────────────────────────────────────────────────────────

test("delegate creates delegation and returns handle", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);

  assert.ok(handle.delegationId);
  assert.equal(handle.parentAgentId, "parent-agent");
  assert.equal(handle.childAgentId, "child-agent");
  assert.equal(handle.depth, 1);
  assert.equal(handle.status, "pending");
  assert.ok(handle.createdAt);
  assert.ok(handle.timeout > 0);
});

test("getDelegation retrieves created delegation", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);
  const delegation = service.getDelegation(handle.delegationId);

  assert.ok(delegation);
  assert.equal(delegation.parentAgentId, "parent-agent");
  assert.equal(delegation.childAgentId, "child-agent");
  assert.equal(delegation.depth, 1);
  assert.equal(delegation.status, "pending");
});

test("complete transitions delegation to completed", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);
  service.complete(handle.delegationId);

  const delegation = service.getDelegation(handle.delegationId);
  assert.ok(delegation);
  assert.equal(delegation.status, "completed");
  assert.ok(delegation.completedAt);
});

test("cancel transitions delegation to cancelled", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);
  service.cancel(handle.delegationId);

  const delegation = service.getDelegation(handle.delegationId);
  assert.ok(delegation);
  assert.equal(delegation.status, "cancelled");
});

test("fail transitions delegation to failed", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);
  service.fail(handle.delegationId, "Test error");

  const delegation = service.getDelegation(handle.delegationId);
  assert.ok(delegation);
  assert.equal(delegation.status, "failed");
});

test("handleDelegationTimeout transitions delegation to timed_out", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);
  service.handleDelegationTimeout(handle.delegationId);

  const delegation = service.getDelegation(handle.delegationId);
  assert.ok(delegation);
  assert.equal(delegation.status, "timed_out");
});

// ─────────────────────────────────────────────────────────────────────────────
// Delegation Chain Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getDelegationChain returns chain after delegation", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);
  const chain = service.getDelegationChain("parent-agent");

  assert.ok(chain);
  assert.equal(chain.rootAgentId, "parent-agent");
  assert.equal(chain.totalDelegations, 1);
  assert.equal(chain.nodes.length, 1);
  assert.equal(chain.nodes[0].agentId, "child-agent");
  assert.equal(chain.maxDepthReached, 1);
});

test("delegation chain tracks multi-level delegation", async () => {
  const service = createDelegationManager();

  // Level 0: root
  const root = createParentContext({ agentId: "root-agent" });
  const spec0 = createDelegationSpec({
    targetAgentId: "level-1-agent",
    targetAgentType: "worker",
    targetPackId: "pack-level-1",
  });
  const handle0 = await service.delegate(root, spec0);

  // Level 1: first delegation
  const level1Ctx = service.createDelegationContext(handle0.delegationId, {
    agentId: "level-1-agent",
    delegationDepth: 1,
    activeDelegations: [handle0.delegationId],
  });
  const spec1 = createDelegationSpec({
    targetAgentId: "level-2-agent",
    targetAgentType: "worker",
    targetPackId: "pack-level-2",
  });
  const handle1 = await service.delegate(level1Ctx, spec1);

  const chain = service.getDelegationChain("root-agent");
  assert.ok(chain);
  assert.equal(chain.totalDelegations, 2);
  assert.equal(chain.nodes.length, 2);
  assert.equal(chain.maxDepthReached, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Fanout Tests
// ─────────────────────────────────────────────────────────────────────────────

test("service respects maxFanout limit", async () => {
  const service = createDelegationManager({ maxFanout: 2 });
  const parent = createParentContext({
    permissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {},
    },
  });

  // First two delegations should succeed
  const spec1 = createDelegationSpec({ targetAgentId: "child-1", targetPackId: "pack-1" });
  const handle1 = await service.delegate(parent, spec1);

  // Update parent context with active delegation
  const parent2 = createParentContext({
    agentId: "parent-agent",
    activeDelegations: [handle1.delegationId],
    permissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {},
    },
  });
  const spec2 = createDelegationSpec({ targetAgentId: "child-2", targetPackId: "pack-2" });
  const handle2 = await service.delegate(parent2, spec2);

  // Third delegation should fail due to fanout limit
  const parent3 = createParentContext({
    agentId: "parent-agent",
    activeDelegations: [handle1.delegationId, handle2.delegationId],
    permissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {},
    },
  });
  const spec3 = createDelegationSpec({ targetAgentId: "child-3", targetPackId: "pack-3" });

  assert.throws(
    () => service.delegate(parent3, spec3),
    DelegationFanoutExceededError,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Depth Limit Tests
// ─────────────────────────────────────────────────────────────────────────────

test("service throws topology depth error when configured depth limit is exceeded", async () => {
  const service = createDelegationManager({ maxDepth: 3 });

  // Create chain at depth 0
  const root = createParentContext({ agentId: "root", delegationDepth: 0 });
  const spec0 = createDelegationSpec({ targetAgentId: "d1", targetPackId: "p1" });
  const h0 = await service.delegate(root, spec0);

  // Create chain at depth 1
  const d1 = service.createDelegationContext(h0.delegationId, {
    agentId: "d1",
    delegationDepth: 1,
    activeDelegations: [h0.delegationId],
  });
  const spec1 = createDelegationSpec({ targetAgentId: "d2", targetPackId: "p2" });
  const h1 = await service.delegate(d1, spec1);

  // Create chain at depth 2
  const d2 = service.createDelegationContext(h1.delegationId, {
    agentId: "d2",
    delegationDepth: 2,
    activeDelegations: [h0.delegationId, h1.delegationId],
  });
  const spec2 = createDelegationSpec({ targetAgentId: "d3", targetPackId: "p3" });
  const h2 = await service.delegate(d2, spec2);

  // At depth 3, next delegation should fail due to the explicit topology maxDepth=3
  const d3 = service.createDelegationContext(h2.delegationId, {
    agentId: "d3",
    delegationDepth: 3,
    activeDelegations: [h0.delegationId, h1.delegationId, h2.delegationId],
  });
  const spec3 = createDelegationSpec({ targetAgentId: "d4", targetPackId: "p4" });

  assert.throws(
    () => service.delegate(d3, spec3),
    DelegationDepthExceededError,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Active Delegations Query Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getActiveDelegations returns pending and active delegations", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  const spec1 = createDelegationSpec({ targetAgentId: "child-1", targetPackId: "pack-1" });
  const handle1 = await service.delegate(parent, spec1);

  const spec2 = createDelegationSpec({ targetAgentId: "child-2", targetPackId: "pack-2" });
  const handle2 = await service.delegate(parent, spec2);

  service.complete(handle1.delegationId);

  const active = service.getActiveDelegations("parent-agent");
  assert.equal(active.length, 1);
  assert.equal(active[0].delegationId, handle2.delegationId);
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Cases
// ─────────────────────────────────────────────────────────────────────────────

test("cancel throws for non-existent delegation", async () => {
  const service = createDelegationManager();

  try {
    service.cancel("non-existent-id");
    assert.fail("Expected error to be thrown");
  } catch (err: unknown) {
    assert.equal((err as { code?: string }).code, "delegation.not_found");
  }
});

test("complete throws for invalid status transition", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);
  service.cancel(handle.delegationId);

  try {
    service.complete(handle.delegationId);
    assert.fail("Expected error to be thrown");
  } catch (err: unknown) {
    assert.equal((err as { code?: string }).code, "delegation.invalid_status_transition");
  }
});

test("delegation with requiresApproval creates pending_approval status", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec({ requiresApproval: true });

  const handle = await service.delegate(parent, spec);

  assert.equal(handle.status, "pending_approval");
  assert.equal(handle.requiresApproval, true);

  const delegation = service.getDelegation(handle.delegationId);
  assert.ok(delegation);
  assert.equal(delegation.status, "pending_approval");
});

// ─────────────────────────────────────────────────────────────────────────────
// Awaitable Handle Tests
// ─────────────────────────────────────────────────────────────────────────────

test("delegation handle is awaitable", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handlePromise = service.delegate(parent, spec);

  // Handle should be thenable
  assert.ok(typeof (handlePromise as PromiseLike<unknown>).then === "function");

  // Should be awaitable
  const handle = await handlePromise;
  assert.ok(handle.delegationId);
});
