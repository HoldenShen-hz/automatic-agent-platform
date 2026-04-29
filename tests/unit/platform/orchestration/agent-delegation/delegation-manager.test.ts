import assert from "node:assert/strict";
import test from "node:test";

import { createDelegationManager, DelegationManagerService } from "../../../../../src/platform/orchestration/agent-delegation/delegation-manager.service.js";
import { DelegationDepthExceededError, DelegationFanoutExceededError, DelegationCycleDetectedError } from "../../../../../src/platform/orchestration/agent-delegation/topology-validator.js";
import type { AgentContext, DelegationSpec } from "../../../../../src/platform/orchestration/agent-delegation/delegation-types.js";

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
// Delegation Manager Service Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DelegationManagerService creates delegation successfully", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);

  assert.ok(handle.delegationId);
  assert.equal(handle.parentAgentId, "parent-agent");
  assert.equal(handle.childAgentId, "child-agent");
  assert.equal(handle.depth, 1);
  assert.equal(handle.status, "pending");
  assert.ok(handle.correlationId.includes("test-correlation"));
});

test("DelegationManagerService rejects depth exceeding limit", async () => {
  const service = createDelegationManager({ maxDepth: 2 });
  const parent = createParentContext({ delegationDepth: 2 });
  const spec = createDelegationSpec();

  await assert.rejects(
    async () => service.delegate(parent, spec),
    DelegationDepthExceededError,
  );
});

test("DelegationManagerService rejects fanout exceeding limit", async () => {
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

test("DelegationManagerService rejects cycle detection", async () => {
  const service = createDelegationManager();
  const parent = createParentContext({ delegationDepth: 1 });

  // First delegation
  await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-1",
    targetPackId: "pack-cycle",
  }));

  // Second delegation that would create a cycle (same pack)
  await assert.rejects(
    async () => service.delegate(parent, createDelegationSpec({
      targetAgentId: "child-2",
      targetPackId: "pack-cycle",
    })),
    DelegationCycleDetectedError,
  );
});

test("DelegationManagerService completes delegation", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);
  await service.complete(handle.delegationId);

  const delegation = service.getDelegation(handle.delegationId);
  assert.equal(delegation?.status, "completed");
});

test("DelegationManagerService completes delegation with ACP evidence", async () => {
  const service = createDelegationManager();
  const handle = await service.delegate(createParentContext(), createDelegationSpec());

  await service.completeWithEvidence(handle.delegationId, ["artifact:proof"], "artifact:result");

  const delegation = service.getDelegation(handle.delegationId);
  assert.equal(delegation?.status, "completed");
});

test("DelegationManagerService fails delegation", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);
  await service.fail(handle.delegationId, "Test error");

  const delegation = service.getDelegation(handle.delegationId);
  assert.equal(delegation?.status, "failed");
});

test("DelegationManagerService cancels delegation", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);
  await service.cancel(handle.delegationId);

  const delegation = service.getDelegation(handle.delegationId);
  assert.equal(delegation?.status, "cancelled");
});

test("DelegationManagerService cannot cancel completed delegation", async () => {
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

test("DelegationManagerService rejects terminal-to-terminal status rewrites", async () => {
  const service = createDelegationManager();
  const handle = await service.delegate(createParentContext(), createDelegationSpec());
  await service.complete(handle.delegationId);

  await assert.rejects(
    async () => service.fail(handle.delegationId, "late failure"),
    /cannot transition from completed to failed/,
  );
});

test("DelegationManagerService returns null for non-existent delegation", () => {
  const service = createDelegationManager();

  const result = service.getDelegation("non-existent-id");
  assert.equal(result, null);
});

test("DelegationManagerService returns active delegations for agent", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  const spec = createDelegationSpec();
  await service.delegate(parent, spec);

  const activeDelegations = service.getActiveDelegations("parent-agent");
  assert.ok(activeDelegations.length > 0);
});

test("DelegationManagerService validates collaboration messages and takeover notices", async () => {
  const service = createDelegationManager();
  const handle = await service.delegate(createParentContext(), createDelegationSpec());
  const context = {
    parentPermissions: createParentContext().permissions,
    parentRiskMode: 50,
    parentConstraints: {},
    parentBudgetRemaining: 100,
    globalCallDepth: 4,
  };

  const message = {
    messageId: "msg-1",
    messageType: "takeover_notice" as const,
    correlation_id: "corr-1",
    parent_run_id: handle.delegationId,
    delegationId: handle.delegationId,
    childRunId: handle.childAgentId,
    capabilityIntersection: ["action-read", "resource-a"],
    budgetCap: 10,
    dataBoundary: "delegation",
    deadline: "2026-04-22T01:00:00.000Z",
    depth: 1,
    sender_agent_id: handle.childAgentId,
    receiver_agent_id: handle.parentAgentId,
    domain_id: "coding",
    risk_level: 10,
    budget_remaining: 10,
    trace_id: "trace-1",
    payload: { audit_trail_ref: "audit:1" },
    timestamp: "2026-04-22T00:00:00.000Z",
  };

  assert.equal(service.validateCollaborationMessage(message, context).accepted, true);
  assert.equal(service.recordTakeoverNotice(message, context).accepted, true);
});

test("DelegationManagerService tracks delegation chain", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  await service.delegate(parent, createDelegationSpec({
    targetAgentId: "child-1",
  }));

  const chain = service.getDelegationChain("parent-agent");
  assert.ok(chain);
  assert.equal(chain.rootAgentId, "parent-agent");
});

test("DelegationManagerService with allowedPackIds restricts delegation", async () => {
  const service = createDelegationManager({
    maxDepth: 5,
    maxFanout: 10,
    allowedPackIds: ["pack-allowed"],
  });

  const parent = createParentContext();
  const spec = createDelegationSpec({
    targetPackId: "pack-disallowed",
  });

  await assert.rejects(
    async () => service.delegate(parent, spec),
    Error,
  );
});

test("DelegationManagerService child has incremented depth", async () => {
  const service = createDelegationManager();
  const parent = createParentContext({ delegationDepth: 1 });
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);

  assert.equal(handle.depth, 2);
});

test("DelegationManagerService delegation has correct correlationId", async () => {
  const service = createDelegationManager();
  const parent = createParentContext({ correlationId: "parent-corr" });
  const spec = createDelegationSpec();

  const handle = await service.delegate(parent, spec);

  assert.ok(handle.correlationId.includes("parent-corr"));
  assert.ok(handle.correlationId.includes(handle.delegationId));
});

test("DelegationManagerService delegation has expiresAt set", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec({ timeout: 60000 });

  const handle = await service.delegate(parent, spec);

  const delegation = service.getDelegation(handle.delegationId);
  assert.ok(delegation?.expiresAt);
  assert.ok(new Date(delegation!.expiresAt).getTime() > Date.now());
});

test("DelegationManagerService cannot fail non-existent delegation", async () => {
  const service = createDelegationManager();

  await assert.rejects(
    async () => service.fail("non-existent", "error"),
    Error,
  );
});

test("DelegationManagerService cannot complete non-existent delegation", async () => {
  const service = createDelegationManager();

  await assert.rejects(
    async () => service.complete("non-existent"),
    Error,
  );
});

test("DelegationManagerService cannot cancel non-existent delegation", async () => {
  const service = createDelegationManager();

  await assert.rejects(
    async () => service.cancel("non-existent"),
    Error,
  );
});

test("DelegationManagerService uses custom default timeout", async () => {
  const service = createDelegationManager({ defaultTimeout: 600000 });
  const parent = createParentContext();
  const spec = createDelegationSpec({ timeout: 0 }); // Use default

  const handle = await service.delegate(parent, spec);

  const delegation = service.getDelegation(handle.delegationId);
  // expiresAt should be ~10 minutes from now (600000ms)
  const expiresIn = new Date(delegation!.expiresAt).getTime() - Date.now();
  assert.ok(expiresIn > 500000); // At least 500 seconds
});

test("DelegationManagerService uses spec timeout when provided", async () => {
  const service = createDelegationManager({ defaultTimeout: 600000 });
  const parent = createParentContext();
  const spec = createDelegationSpec({ timeout: 5000 }); // 5 seconds

  const handle = await service.delegate(parent, spec);

  const delegation = service.getDelegation(handle.delegationId);
  const expiresIn = new Date(delegation!.expiresAt).getTime() - Date.now();
  assert.ok(expiresIn < 10000); // Less than 10 seconds
});

test("DelegationManagerService returns null chain for unknown agent", () => {
  const service = createDelegationManager();

  const result = service.getDelegationChain("unknown-agent");
  assert.equal(result, null);
});

// §49: Delegation Expiration Tests

test("DelegationManagerService revokeExpiredDelegations marks expired delegations", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec({ timeout: 1 }); // 1ms timeout - will expire immediately

  const handle = await service.delegate(parent, spec);

  // Wait for delegation to expire
  await new Promise((resolve) => setTimeout(resolve, 10));

  const result = service.revokeExpiredDelegations();

  assert.equal(result.expired, 1);
  assert.equal(result.scanned, 1);
  assert.equal(result.errors.length, 0);

  const delegation = service.getDelegation(handle.delegationId);
  assert.equal(delegation?.status, "expired");
});

test("DelegationManagerService revokeExpiredDelegations skips non-expired delegations", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec({ timeout: 60000 }); // 1 minute timeout

  await service.delegate(parent, spec);

  const result = service.revokeExpiredDelegations();

  assert.equal(result.expired, 0);
  assert.equal(result.scanned, 1);
});

test("DelegationManagerService revokeExpiredDelegations skips completed delegations", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec({ timeout: 1 });

  const handle = await service.delegate(parent, spec);
  await service.complete(handle.delegationId);

  // Wait for delegation to expire
  await new Promise((resolve) => setTimeout(resolve, 10));

  const result = service.revokeExpiredDelegations();

  assert.equal(result.expired, 0); // Already completed, not expired

  const delegation = service.getDelegation(handle.delegationId);
  assert.equal(delegation?.status, "completed"); // Still completed
});

test("DelegationManagerService getExpiredDelegations returns expired pending/active delegations", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  // Create an already-expired delegation
  await service.delegate(parent, createDelegationSpec({ timeout: 1, targetPackId: "pack-child-1" }));

  // Create a non-expired delegation
  await service.delegate(parent, createDelegationSpec({ targetAgentId: "child-2", targetPackId: "pack-child-2", timeout: 60000 }));

  // Wait for first to expire
  await new Promise((resolve) => setTimeout(resolve, 10));

  const expired = service.getExpiredDelegations();
  assert.equal(expired.length, 1);
  assert.equal(expired[0]?.childAgentId, "child-agent");
});

test("DelegationManagerService getPendingExpirationCount returns correct count", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();

  // Create 3 expired delegations
  for (let i = 0; i < 3; i++) {
    await service.delegate(parent, createDelegationSpec({ timeout: 1, targetAgentId: `child-${i}`, targetPackId: `pack-child-${i}` }));
  }

  // Create 1 non-expired delegation
  await service.delegate(parent, createDelegationSpec({ timeout: 60000, targetAgentId: "child-forever", targetPackId: "pack-child-forever" }));

  // Wait for first 3 to expire
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(service.getPendingExpirationCount(), 3);
});

test("DelegationManagerService revokeExpiredDelegations handles empty store", () => {
  const service = createDelegationManager();

  const result = service.revokeExpiredDelegations();

  assert.equal(result.scanned, 0);
  assert.equal(result.expired, 0);
  assert.equal(result.errors.length, 0);
});

test("DelegationManagerService uses DEFAULT_MAX_DEPTH when no maxDepth provided", () => {
  const service = createDelegationManager();
  const parent = createParentContext({ delegationDepth: 8, currentCallDepth: 8 });
  const spec = createDelegationSpec();

  assert.rejects(
    async () => service.delegate(parent, spec),
    (err: unknown) => (err as { code?: string }).code === "delegation.call_depth_exceeded",
  );
});

test("DelegationManagerService depth validation allows delegation chain through depth 8 and rejects depth 9 by default", async () => {
  const service = createDelegationManager();
  const parentDepth0 = createParentContext({ delegationDepth: 0 });
  const spec = createDelegationSpec();

  // First delegation - depth 1 (allowed)
  const handle1 = await service.delegate(parentDepth0, spec);
  assert.equal(handle1.depth, 1);

  // Create parent at depth 1
  const parentDepth1 = createParentContext({
    delegationDepth: 1,
    agentId: handle1.childAgentId,
    packId: "pack-child-1",
  });

  // Second delegation - depth 2 (allowed)
  const handle2 = await service.delegate(parentDepth1, createDelegationSpec({ targetPackId: "pack-child-2" }));
  assert.equal(handle2.depth, 2);

  // Create parent at depth 2
  const parentDepth2 = createParentContext({
    delegationDepth: 2,
    agentId: handle2.childAgentId,
    packId: "pack-child-2",
  });

  // Third delegation - depth 3 (allowed)
  const handle3 = await service.delegate(parentDepth2, createDelegationSpec({ targetPackId: "pack-child-3" }));
  assert.equal(handle3.depth, 3);

  const parentDepth3 = createParentContext({
    delegationDepth: 3,
    agentId: handle3.childAgentId,
  });
  const handle4 = await service.delegate(parentDepth3, createDelegationSpec({ targetPackId: "pack-child-4" }));
  assert.equal(handle4.depth, 4);

  const parentDepth4 = createParentContext({
    delegationDepth: 4,
    agentId: handle4.childAgentId,
  });
  const handle5 = await service.delegate(parentDepth4, createDelegationSpec({ targetPackId: "pack-child-5" }));
  assert.equal(handle5.depth, 5);

  const parentDepth5 = createParentContext({
    delegationDepth: 5,
    agentId: handle5.childAgentId,
  });
  const handle6 = await service.delegate(parentDepth5, createDelegationSpec({ targetPackId: "pack-child-6" }));
  assert.equal(handle6.depth, 6);

  const parentDepth6 = createParentContext({
    delegationDepth: 6,
    agentId: handle6.childAgentId,
  });
  const handle7 = await service.delegate(parentDepth6, createDelegationSpec({ targetPackId: "pack-child-7" }));
  assert.equal(handle7.depth, 7);

  const parentDepth7 = createParentContext({
    delegationDepth: 7,
    agentId: handle7.childAgentId,
  });
  const handle8 = await service.delegate(parentDepth7, createDelegationSpec({ targetPackId: "pack-child-8" }));
  assert.equal(handle8.depth, 8);

  const parentDepth8 = createParentContext({
    delegationDepth: 8,
    currentCallDepth: 8,
    agentId: handle8.childAgentId,
  });
  await assert.rejects(
    async () => service.delegate(parentDepth8, spec),
    (err: unknown) => (err as { code?: string }).code === "delegation.call_depth_exceeded",
  );
});

test("DelegationManagerService does not triple-count delegationDepth in call-depth budget", async () => {
  const service = createDelegationManager();
  const parent = createParentContext({ delegationDepth: 3, currentCallDepth: 3 });

  const handle = await service.delegate(parent, createDelegationSpec({ targetPackId: "pack-child-4" }));

  assert.equal(handle.depth, 4);
});
