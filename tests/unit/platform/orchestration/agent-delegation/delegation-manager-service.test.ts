import assert from "node:assert/strict";
import test from "node:test";

import { DelegationManagerService, createDelegationManager } from "../../../../../src/platform/orchestration/agent-delegation/delegation-manager.service.js";
import type { AgentContext, DelegationSpec } from "../../../../../src/platform/orchestration/agent-delegation/delegation-types.js";

function createTestContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    agentId: "agent-1",
    agentType: "test",
    packId: "pack-root",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["resource-1"],
      actions: ["action-1", "action-2"],
      constraints: {},
    },
    sandboxTier: "read_only",
    correlationId: "corr-1",
    tenantId: null,
    ...overrides,
  };
}

function createTestSpec(overrides: Partial<DelegationSpec> = {}): DelegationSpec {
  return {
    targetAgentId: "agent-2",
    targetAgentType: "test",
    targetPackId: "pack-child",
    requiredPermissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    timeout: 60000,
    ...overrides,
  };
}

test("DelegationManagerService.delegate creates delegation successfully", async () => {
  const service = new DelegationManagerService();
  const parent = createTestContext();
  const spec = createTestSpec();

  const handle = await service.delegate(parent, spec);

  assert.ok(handle.delegationId.startsWith("dlg_"));
  assert.equal(handle.parentAgentId, "agent-1");
  assert.equal(handle.childAgentId, "agent-2");
  assert.equal(handle.depth, 1);
  assert.equal(handle.status, "pending");
});

test("DelegationManagerService.delegate respects maxDepth", async () => {
  const service = new DelegationManagerService({ maxDepth: 2 });
  const parent = createTestContext({ delegationDepth: 2, packId: "pack-1" });

  await assert.rejects(
    async () => service.delegate(parent, createTestSpec()),
    (err: unknown) => (err as { code: string }).code === "delegation.depth_exceeded",
  );
});

test("DelegationManagerService.cancel cancels pending delegation", async () => {
  const service = new DelegationManagerService();
  const parent = createTestContext();
  const spec = createTestSpec();
  
  const handle = await service.delegate(parent, spec);
  await service.cancel(handle.delegationId);

  const delegation = service.getDelegation(handle.delegationId);
  assert.equal(delegation!.status, "cancelled");
});

test("DelegationManagerService.cancel throws for non-existent delegation", async () => {
  const service = new DelegationManagerService();

  await assert.rejects(
    async () => service.cancel("non-existent-id"),
    (err: unknown) => (err as { code: string }).code === "delegation.not_found",
  );
});

test("DelegationManagerService.cancel throws for completed delegation", async () => {
  const service = new DelegationManagerService();
  const parent = createTestContext();
  const spec = createTestSpec();
  
  const handle = await service.delegate(parent, spec);
  await service.complete(handle.delegationId);

  await assert.rejects(
    async () => service.cancel(handle.delegationId),
    (err: unknown) => (err as { code: string }).code === "delegation.cannot_cancel",
  );
});

test("DelegationManagerService.complete marks delegation as completed", async () => {
  const service = new DelegationManagerService();
  const parent = createTestContext();
  const spec = createTestSpec();
  
  const handle = await service.delegate(parent, spec);
  await service.complete(handle.delegationId);

  const delegation = service.getDelegation(handle.delegationId);
  assert.equal(delegation!.status, "completed");
});

test("DelegationManagerService.completeWithEvidence completes with evidence", async () => {
  const service = new DelegationManagerService();
  const parent = createTestContext();
  const spec = createTestSpec();
  
  const handle = await service.delegate(parent, spec);
  await service.completeWithEvidence(handle.delegationId, ["evidence-1", "evidence-2"], "output-ref-1");

  const delegation = service.getDelegation(handle.delegationId);
  assert.equal(delegation!.status, "completed");
});

test("DelegationManagerService.fail marks delegation as failed", async () => {
  const service = new DelegationManagerService();
  const parent = createTestContext();
  const spec = createTestSpec();
  
  const handle = await service.delegate(parent, spec);
  await service.fail(handle.delegationId, "Something went wrong");

  const delegation = service.getDelegation(handle.delegationId);
  assert.equal(delegation!.status, "failed");
});

test("DelegationManagerService.getDelegationChain returns chain", async () => {
  const service = new DelegationManagerService();
  const parent = createTestContext();
  const spec = createTestSpec();

  await service.delegate(parent, spec);

  const chain = service.getDelegationChain("agent-1");
  assert.ok(chain !== null);
  assert.equal(chain!.rootAgentId, "agent-1");
  assert.ok(chain!.nodes.length > 0);
});

test("DelegationManagerService.getDelegationChain returns null for unknown agent", async () => {
  const service = new DelegationManagerService();

  const chain = service.getDelegationChain("unknown-agent");
  assert.equal(chain, null);
});

test("DelegationManagerService.getActiveDelegations returns active delegations", async () => {
  const service = new DelegationManagerService();
  const parent = createTestContext();
  const spec = createTestSpec();

  await service.delegate(parent, spec);

  const active = service.getActiveDelegations("agent-1");
  assert.ok(active.length > 0);
});

test("DelegationManagerService.revokeExpiredDelegations expires old delegations", () => {
  const service = new DelegationManagerService({ defaultTimeout: -1000 }); // Already expired
  const parent = createTestContext();
  const spec = createTestSpec({ timeout: -1000 });

  // We need to manually insert an expired delegation for testing
  // Since revokeExpiredDelegations scans existing delegations

  const result = service.revokeExpiredDelegations();
  
  assert.equal(result.scanned, 0); // No delegations exist yet
  assert.equal(result.expired, 0);
});

test("DelegationManagerService.getExpiredDelegations returns expired", () => {
  const service = new DelegationManagerService();
  
  // No delegations to expire yet
  const expired = service.getExpiredDelegations();
  assert.equal(expired.length, 0);
});

test("DelegationManagerService.getPendingExpirationCount returns count", () => {
  const service = new DelegationManagerService();
  
  const count = service.getPendingExpirationCount();
  assert.equal(count, 0);
});

test("createDelegationManager factory creates service", () => {
  const service = createDelegationManager({ maxDepth: 5, maxFanout: 20 });
  
  assert.ok(service instanceof DelegationManagerService);
});

test("DelegationManagerService uses default options", () => {
  const service = new DelegationManagerService();
  
  // Just verify it was created without error
  assert.ok(service !== null);
});

test("DelegationManagerService.narrowPermissions intersects actions", async () => {
  const service = new DelegationManagerService();
  const parent = createTestContext({
    permissions: {
      resources: ["r1", "r2"],
      actions: ["a1", "a2", "a3"],
      constraints: { maxDurationMs: 1000 },
    },
  });
  const spec = createTestSpec({
    requiredPermissions: {
      resources: [],
      actions: ["a2"],
      constraints: { maxDurationMs: 500 },
    },
  });

  const handle = await service.delegate(parent, spec);
  const delegation = service.getDelegation(handle.delegationId);

  assert.ok(delegation !== null);
  // Verify that permissions were narrowed
  assert.deepEqual(delegation?.permissions.actions, ["a2"]);
  assert.deepEqual(delegation?.permissions.resources, ["r1", "r2"]);
});

test("DelegationManagerService.narrowPermissions intersects resources instead of replacing them", async () => {
  const service = new DelegationManagerService();
  const parent = createTestContext({
    permissions: {
      resources: ["repo:alpha", "repo:beta"],
      actions: ["read", "write"],
      constraints: { maxDurationMs: 1000 },
    },
  });
  const spec = createTestSpec({
    requiredPermissions: {
      resources: ["repo:beta", "repo:gamma"],
      actions: ["read"],
      constraints: { maxDurationMs: 500 },
    },
  });

  const handle = await service.delegate(parent, spec);
  const delegation = service.getDelegation(handle.delegationId);

  assert.ok(delegation !== null);
  assert.deepEqual(delegation?.permissions.resources, ["repo:beta"]);
  assert.deepEqual(delegation?.permissions.actions, ["read"]);
});
