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
