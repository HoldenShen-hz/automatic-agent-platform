import assert from "node:assert/strict";
import test from "node:test";

import { DelegationManagerService } from "../../../../../src/platform/orchestration/agent-delegation/delegation-manager.service.js";
import type { AgentContext, DelegationSpec } from "../../../../../src/platform/orchestration/agent-delegation/delegation-types.js";

function createParent(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    agentId: "parent-agent",
    agentType: "test",
    packId: "pack-root",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["repo:alpha", "repo:beta"],
      actions: ["read", "write", "approve"],
      constraints: {},
    },
    sandboxTier: "read_only",
    correlationId: "corr-root",
    tenantId: null,
    ...overrides,
  };
}

function createSpec(overrides: Partial<DelegationSpec> = {}): DelegationSpec {
  return {
    targetAgentId: "child-agent",
    targetAgentType: "test",
    targetPackId: "pack-child",
    requiredPermissions: {
      resources: ["repo:beta", "repo:gamma"],
      actions: ["read", "delete"],
      constraints: {},
    },
    timeout: 60_000,
    ...overrides,
  };
}

test("delegation permissions are narrowed by resource intersection, not replacement", async () => {
  const service = new DelegationManagerService();

  const handle = await service.delegate(createParent(), createSpec());
  const delegation = await service.getDelegation(handle.delegationId);

  assert.ok(delegation !== null);
  assert.deepEqual(delegation.permissions.resources, ["repo:beta"]);
});

test("delegation permissions are narrowed by action intersection", async () => {
  const service = new DelegationManagerService();

  const handle = await service.delegate(createParent(), createSpec());
  const delegation = await service.getDelegation(handle.delegationId);

  assert.ok(delegation !== null);
  assert.deepEqual(delegation.permissions.actions, ["read"]);
});
