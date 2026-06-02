import assert from "node:assert/strict";
import test from "node:test";

import { createDelegationManager } from "../../../../../src/platform/five-plane-orchestration/agent-delegation/index.js";
import { DelegationManagerService } from "../../../../../src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.js";
import type {
  AgentContext,
  DelegationResult,
  DelegationSpec,
} from "../../../../../src/platform/five-plane-orchestration/agent-delegation/index.js";
import { InMemoryDelegationRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/delegation-repository.js";

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
      constraints: {
        maxDurationMs: 60_000,
        maxTokens: 10_000,
      },
    },
    sandboxTier: "workspace_write",
    correlationId: "corr-001",
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
    timeout: 30_000,
    ...overrides,
  };
}

test("cancel rejects concurrent status changes via fencing token", async () => {
  const service = createDelegationManager();
  const handle = await service.delegate(createParentContext(), createDelegationSpec());

  const serviceWithInternals = service as unknown as {
    transitionDelegationStatus: (
      delegation: DelegationResult,
      nextStatus: string,
      fencingToken?: string,
    ) => Promise<void>;
  };
  const originalTransition = serviceWithInternals.transitionDelegationStatus.bind(serviceWithInternals);
  serviceWithInternals.transitionDelegationStatus = async (delegation, nextStatus, fencingToken) => {
    if (nextStatus === "cancelled") {
      delegation.status = "completed";
    }
    await originalTransition(delegation, nextStatus, fencingToken);
  };

  await assert.rejects(
    () => service.cancel(handle.delegationId),
    (error: unknown) =>
      typeof error === "object"
      && error !== null
      && "code" in error
      && error.code === "delegation.concurrent_modification",
  );
});

test("createDelegationContext rejects expired delegations as revoked permissions", async () => {
  const service = createDelegationManager();
  const handle = await service.delegate(createParentContext(), createDelegationSpec());
  const delegation = await service.getDelegation(handle.delegationId);

  assert.ok(delegation);
  (delegation as DelegationResult).expiresAt = "2026-01-01T00:00:00.000Z";

  assert.throws(
    () => service.createDelegationContext(handle.delegationId),
    (error: unknown) =>
      typeof error === "object"
      && error !== null
      && "code" in error
      && error.code === "delegation.permissions_revoked",
  );
});

test("repository-backed delegations survive restart with narrowed permissions intact", async () => {
  const repository = new InMemoryDelegationRepository();
  const service = new DelegationManagerService({}, repository);
  const handle = await service.delegate(createParentContext(), createDelegationSpec());

  const reloadedService = new DelegationManagerService({}, repository);
  const reloadedDelegation = await reloadedService.getDelegation(handle.delegationId);
  const reloadedContext = reloadedService.createDelegationContext(handle.delegationId);

  assert.ok(reloadedDelegation);
  assert.deepEqual(reloadedDelegation?.permissions.resources, ["resource-a"]);
  assert.deepEqual(reloadedDelegation?.permissions.actions, ["action-read"]);
  assert.deepEqual(reloadedDelegation?.grantedPermissions.resources, ["resource-a"]);
  assert.deepEqual(reloadedContext.permissions.resources, ["resource-a"]);
  assert.deepEqual(reloadedContext.permissions.actions, ["action-read"]);
});

test("repository-backed delegation chains are recomputed after terminal status changes", async () => {
  const repository = new InMemoryDelegationRepository();
  const service = new DelegationManagerService({}, repository);
  const handle = await service.delegate(createParentContext(), createDelegationSpec());

  const chainBeforeCancel = await service.getDelegationChain("parent-agent");
  assert.equal(chainBeforeCancel?.totalDelegations, 1);

  await service.cancel(handle.delegationId);

  const chainAfterCancel = await service.getDelegationChain("parent-agent");
  assert.equal(chainAfterCancel, null);
});
