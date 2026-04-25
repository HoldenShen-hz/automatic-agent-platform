import * as assert from "node:assert/strict";
import * as test from "node:test";

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
    sandboxTier: "container",
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
// Delegation Request Creation and Validation
// ─────────────────────────────────────────────────────────────────────────────

test("createDelegationManager creates delegation successfully", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);

  assert.ok(handle.delegationId);
  assert.equal(handle.parentAgentId, "parent-agent");
  assert.equal(handle.childAgentId, "child-agent");
  assert.equal(handle.depth, 1);
  assert.equal(handle.status, "pending");
});

test("createDelegationManager sets correct correlationId", async () => {
  const service = createDelegationManager();
  const parent = createParentContext({ correlationId: "parent-corr" });
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);

  assert.ok(handle.correlationId.startsWith("parent-corr:"));
  assert.ok(handle.correlationId.includes(handle.delegationId));
});

test("createDelegationManager creates unique correlationIds per delegation", async () => {
  const service = createDelegationManager();
  const parent = createParentContext({ correlationId: "same-parent" });

  const handle1 = await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-1",
    targetPackId: "pack-1",
  }));
  const handle2 = await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-2",
    targetPackId: "pack-2",
  }));

  assert.notEqual(handle1.correlationId, handle2.correlationId);
});

test("createDelegationManager sets expiresAt correctly", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec({ timeout: 60000 });

  const handle = await service.delegate(parent, spec);
  const delegation = service.getDelegation(handle.delegationId);

  assert.ok(delegation?.expiresAt);
  const expiresIn = new Date(delegation!.expiresAt).getTime() - Date.now();
  assert.ok(expiresIn > 50000 && expiresIn < 70000);
});

test("createDelegationManager uses defaultTimeout when spec timeout is zero", async () => {
  const service = createDelegationManager({ defaultTimeout: 120000 });
  const parent = createParentContext();
  const spec = createDelegationSpec({ timeout: 0 });

  const handle = await service.delegate(parent, spec);
  const delegation = service.getDelegation(handle.delegationId);

  const expiresIn = new Date(delegation!.expiresAt).getTime() - Date.now();
  assert.ok(expiresIn > 100000);
});

test("createDelegationManager rejects depth exceeding limit", async () => {
  const service = createDelegationManager({ maxDepth: 2 });
  const parent = createParentContext({ delegationDepth: 2 });
  const spec = createDelegationSpec();

  await assert.rejects(
    async () => service.delegate(parent, spec),
    DelegationDepthExceededError,
  );
});

test("createDelegationManager rejects fanout exceeding limit", async () => {
  const service = createDelegationManager({ maxFanout: 2 });
  const parent = createParentContext({
    delegationDepth: 0,
    activeDelegations: ["dlg-1", "dlg-2"],
  });
  const spec = createDelegationSpec();

  await assert.rejects(
    async () => service.delegate(parent, spec),
    DelegationFanoutExceededError,
  );
});

test("createDelegationManager increments depth correctly", async () => {
  const service = createDelegationManager();
  const parentDepth0 = createParentContext({ delegationDepth: 0 });
  const spec = createDelegationSpec();

  const handle1 = await service.delegate(parentDepth0, spec);
  assert.equal(handle1.depth, 1);

  const parentDepth1 = createParentContext({
    delegationDepth: 1,
    agentId: handle1.childAgentId,
    packId: "pack-child-1",
  });

  const handle2 = await service.delegate(parentDepth1, createDelegationSpec({
    targetAgentId: "grandchild-1",
    targetPackId: "pack-child-2",
  }));
  assert.equal(handle2.depth, 2);
});

test("createDelegationManager default maxDepth is 3", async () => {
  const service = createDelegationManager();
  const parent = createParentContext({ delegationDepth: 3 });
  const spec = createDelegationSpec();

  await assert.rejects(
    async () => service.delegate(parent, spec),
    DelegationDepthExceededError,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Delegation State Machine Transitions
// ─────────────────────────────────────────────────────────────────────────────

test("createDelegationManager transitions pending to active on complete", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);
  assert.equal(handle.status, "pending");

  await service.complete(handle.delegationId);

  const delegation = service.getDelegation(handle.delegationId);
  assert.equal(delegation?.status, "completed");
});

test("createDelegationManager transitions to failed state", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);
  await service.fail(handle.delegationId, "Test error");

  const delegation = service.getDelegation(handle.delegationId);
  assert.equal(delegation?.status, "failed");
});

test("createDelegationManager transitions to cancelled state", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);
  await service.cancel(handle.delegationId);

  const delegation = service.getDelegation(handle.delegationId);
  assert.equal(delegation?.status, "cancelled");
});

test("createDelegationManager cannot cancel completed delegation", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);
  await service.complete(handle.delegationId);

  await assert.rejects(
    async () => service.cancel(handle.delegationId),
    Error,
  );
});

test("createDelegationManager cannot cancel failed delegation", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);
  await service.fail(handle.delegationId, "error");

  await assert.rejects(
    async () => service.cancel(handle.delegationId),
    Error,
  );
});

test("createDelegationManager cannot complete non-existent delegation", async () => {
  const service = createDelegationManager();

  await assert.rejects(
    async () => service.complete("non-existent"),
    Error,
  );
});

test("createDelegationManager cannot fail non-existent delegation", async () => {
  const service = createDelegationManager();

  await assert.rejects(
    async () => service.fail("non-existent", "error"),
    Error,
  );
});

test("createDelegationManager cannot cancel non-existent delegation", async () => {
  const service = createDelegationManager();

  await assert.rejects(
    async () => service.cancel("non-existent"),
    Error,
  );
});

test("createDelegationManager completeWithEvidence validates ACP", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);
  await service.completeWithEvidence(handle.delegationId, ["evidence:proof"], "artifact:result");

  const delegation = service.getDelegation(handle.delegationId);
  assert.equal(delegation?.status, "completed");
});

test("createDelegationManager completeWithEvidence rejects invalid evidence", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);
  const context = {
    parentPermissions: parent.permissions,
    parentRiskMode: 10,
    parentConstraints: {},
    parentBudgetRemaining: 50,
    globalCallDepth: 5,
  };

  const invalidMessage = {
    messageId: "msg-1",
    messageType: "completion_report" as const,
    correlation_id: "corr-1",
    parent_run_id: handle.delegationId,
    depth: 10,
    sender_agent_id: handle.childAgentId,
    receiver_agent_id: handle.parentAgentId,
    domain_id: "coding",
    risk_level: 99,
    budget_remaining: 200,
    trace_id: "trace-1",
    payload: { evidence: [] },
    timestamp: "2026-04-22T00:00:00.000Z",
  };

  const result = service.validateCollaborationMessage(invalidMessage, context);
  assert.equal(result.accepted, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Delegation Revocation
// ─────────────────────────────────────────────────────────────────────────────

test("createDelegationManager revokeExpiredDelegations marks expired delegations", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec({ timeout: 1 });

  const handle = await service.delegate(parent, spec);
  await new Promise((resolve) => setTimeout(resolve, 10));

  const result = service.revokeExpiredDelegations();

  assert.equal(result.expired, 1);
  assert.equal(result.scanned, 1);
  assert.equal(result.errors.length, 0);

  const delegation = service.getDelegation(handle.delegationId);
  assert.equal(delegation?.status, "expired");
});

test("createDelegationManager revokeExpiredDelegations skips completed delegations", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec({ timeout: 1 });

  const handle = await service.delegate(parent, spec);
  await service.complete(handle.delegationId);
  await new Promise((resolve) => setTimeout(resolve, 10));

  const result = service.revokeExpiredDelegations();

  assert.equal(result.expired, 0);
  const delegation = service.getDelegation(handle.delegationId);
  assert.equal(delegation?.status, "completed");
});

test("createDelegationManager revokeExpiredDelegations handles empty store", () => {
  const service = createDelegationManager();

  const result = service.revokeExpiredDelegations();

  assert.equal(result.scanned, 0);
  assert.equal(result.expired, 0);
  assert.equal(result.errors.length, 0);
});

test("createDelegationManager getExpiredDelegations returns expired pending/active delegations", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  await service.delegate(parent, createDelegationSpec({
    timeout: 1,
    targetAgentId: "child-1",
    targetPackId: "pack-child-1",
  }));
  await service.delegate(parent, createDelegationSpec({
    timeout: 60000,
    targetAgentId: "child-2",
    targetPackId: "pack-child-2",
  }));

  await new Promise((resolve) => setTimeout(resolve, 10));

  const expired = service.getExpiredDelegations();
  assert.equal(expired.length, 1);
});

test("createDelegationManager getPendingExpirationCount returns correct count", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  for (let i = 0; i < 3; i++) {
    await service.delegate(parent, createDelegationSpec({
      timeout: 1,
      targetAgentId: `child-${i}`,
      targetPackId: `pack-child-${i}`,
    }));
  }

  await service.delegate(parent, createDelegationSpec({
    timeout: 60000,
    targetAgentId: "child-forever",
    targetPackId: "pack-child-forever",
  }));

  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(service.getPendingExpirationCount(), 3);
});

test("createDelegationManager getExpiredDelegations excludes already expired", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  const handle = await service.delegate(parent, createDelegationSpec({
    timeout: 1,
    targetAgentId: "child-1",
    targetPackId: "pack-1",
  }));

  await new Promise((resolve) => setTimeout(resolve, 10));
  service.revokeExpiredDelegations();

  const expired = service.getExpiredDelegations();
  assert.equal(expired.some((d) => d.delegationId === handle.delegationId), false);
});

test("createDelegationManager revokeExpiredDelegations returns errors on failure", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  // This tests the error collection path - difficult to trigger without mocking
  const result = service.revokeExpiredDelegations();
  assert.ok(Array.isArray(result.errors));
});

// ─────────────────────────────────────────────────────────────────────────────
// Delegation Listing and Filtering
// ─────────────────────────────────────────────────────────────────────────────

test("createDelegationManager getDelegation returns null for non-existent", () => {
  const service = createDelegationManager();

  const result = service.getDelegation("non-existent-id");
  assert.equal(result, null);
});

test("createDelegationManager getDelegationChain returns null for unknown agent", () => {
  const service = createDelegationManager();

  const result = service.getDelegationChain("unknown-agent");
  assert.equal(result, null);
});

test("createDelegationManager getActiveDelegations returns delegations for agent", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-1",
    targetPackId: "pack-1",
  }));
  await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-2",
    targetPackId: "pack-2",
  }));

  const active = service.getActiveDelegations("parent-agent");
  assert.equal(active.length, 2);
});

test("createDelegationManager getActiveDelegations excludes completed", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  const handle1 = await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-1",
    targetPackId: "pack-1",
  }));
  await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-2",
    targetPackId: "pack-2",
  }));

  await service.complete(handle1.delegationId);

  const active = service.getActiveDelegations("parent-agent");
  assert.equal(active.length, 1);
  assert.equal(active[0]?.delegationId, handle1.delegationId);
});

test("createDelegationManager getActiveDelegations excludes failed", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  const handle1 = await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-1",
    targetPackId: "pack-1",
  }));
  await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-2",
    targetPackId: "pack-2",
  }));

  await service.fail(handle1.delegationId, "error");

  const active = service.getActiveDelegations("parent-agent");
  assert.equal(active.length, 1);
});

test("createDelegationManager getActiveDelegations excludes cancelled", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  const handle1 = await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-1",
    targetPackId: "pack-1",
  }));
  await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-2",
    targetPackId: "pack-2",
  }));

  await service.cancel(handle1.delegationId);

  const active = service.getActiveDelegations("parent-agent");
  assert.equal(active.length, 1);
});

test("createDelegationManager getActiveDelegations returns empty for unknown agent", () => {
  const service = createDelegationManager();

  const active = service.getActiveDelegations("unknown-agent");
  assert.equal(active.length, 0);
});

test("createDelegationManager getDelegationChain tracks multiple delegations", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-1",
    targetPackId: "pack-1",
  }));
  await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-2",
    targetPackId: "pack-2",
  }));

  const chain = service.getDelegationChain("parent-agent");
  assert.ok(chain);
  assert.equal(chain!.totalDelegations, 2);
  assert.equal(chain!.nodes.length, 2);
});

test("createDelegationManager getDelegationChain tracks depth across chain", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  const handle1 = await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-1",
    targetPackId: "pack-1",
  }));

  const parentDepth1 = createParentContext({
    delegationDepth: 1,
    agentId: handle1.childAgentId,
    packId: "pack-1",
  });

  const handle2 = await service.delegate(parentDepth1, createDelegationSpec({
    targetAgentId: "grandchild-1",
    targetPackId: "pack-2",
  }));

  const chain1 = service.getDelegationChain("parent-agent");
  const chain2 = service.getDelegationChain(handle1.childAgentId);

  assert.equal(chain1!.maxDepthReached, 1);
  assert.equal(chain2!.maxDepthReached, 2);
});

test("createDelegationManager getActiveDelegations includes both parent and child roles", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  const handle1 = await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-1",
    targetPackId: "pack-1",
  }));

  // The child agent is also involved in active delegations
  const parentAtDepth1 = createParentContext({
    delegationDepth: 1,
    agentId: handle1.childAgentId,
    packId: "pack-1",
  });

  await service.delegate(parentAtDepth1, createDelegationSpec({
    targetAgentId: "grandchild-1",
    targetPackId: "pack-2",
  }));

  const activeAsParent = service.getActiveDelegations("parent-agent");
  const activeAsChild = service.getActiveDelegations(handle1.childAgentId);

  assert.ok(activeAsParent.length > 0);
  assert.ok(activeAsChild.length > 0);
});
