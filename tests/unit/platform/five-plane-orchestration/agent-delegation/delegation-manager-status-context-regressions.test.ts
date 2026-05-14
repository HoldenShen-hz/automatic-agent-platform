import assert from "node:assert/strict";
import test from "node:test";

import { createDelegationManager } from "../../../../../src/platform/agent-delegation/index.js";
import type {
  AgentContext,
  DelegationResult,
  DelegationSpec,
} from "../../../../../src/platform/agent-delegation/index.js";

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
    ) => void;
  };
  const originalTransition = serviceWithInternals.transitionDelegationStatus.bind(serviceWithInternals);
  serviceWithInternals.transitionDelegationStatus = (delegation, nextStatus, fencingToken) => {
    if (nextStatus === "cancelled") {
      delegation.status = "completed";
    }
    originalTransition(delegation, nextStatus, fencingToken);
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
