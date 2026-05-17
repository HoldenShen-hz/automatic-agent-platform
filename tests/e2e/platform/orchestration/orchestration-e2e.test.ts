import assert from "node:assert/strict";
import test from "node:test";

import {
  ContextIsolator,
  DelegationGovernanceService,
  createDelegationManager,
  type AgentContext,
  type DelegationSpec,
} from "../../../../src/platform/five-plane-orchestration/agent-delegation/index.js";

function createParentContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    agentId: "parent-agent",
    agentType: "agent",
    packId: "pack-parent",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["/workspace", "/data"],
      actions: ["read", "write", "delegate"],
      constraints: { maxDurationMs: 300000, maxTokens: 8000 },
    },
    sandboxTier: "container",
    correlationId: "corr-orchestration",
    tenantId: "tenant-e2e",
    ...overrides,
  };
}

function createDelegationSpec(overrides: Partial<DelegationSpec> = {}): DelegationSpec {
  return {
    targetAgentId: "child-agent",
    targetAgentType: "agent",
    targetPackId: "pack-child",
    requiredPermissions: {
      resources: ["/workspace"],
      actions: ["read", "write"],
      constraints: {},
    },
    timeout: 60000,
    ...overrides,
  };
}

test("E2E Orchestration: delegation manager tracks a delegation from pending to completed", async () => {
  const manager = createDelegationManager();

  const handle = await manager.delegate(createParentContext(), createDelegationSpec());
  assert.ok(handle.delegationId.startsWith("dlg_"));
  assert.equal(handle.status, "pending");

  await manager.complete(handle.delegationId);
  const record = await manager.getDelegation(handle.delegationId);

  assert.ok(record);
  assert.equal(record?.status, "completed");
});

test("E2E Orchestration: context isolator narrows permissions and increments depth", () => {
  const isolator = new ContextIsolator();
  const parent = createParentContext();

  const isolated = isolator.isolate(parent, createDelegationSpec());

  assert.equal(isolated.context.agentId, "child-agent");
  assert.equal(isolated.context.delegationDepth, 1);
  assert.ok(isolated.narrowedPermissions.resources.length <= parent.permissions.resources.length);
});

test("E2E Orchestration: governance denies critical-risk delegations", () => {
  const governance = new DelegationGovernanceService();

  const decision = governance.evaluate({
    parentContext: createParentContext(),
    delegationSpec: createDelegationSpec(),
    riskLevel: "critical",
  });

  assert.equal(decision.decision, "deny");
});

test("E2E Orchestration: governance allows low-risk delegations without approval", () => {
  const governance = new DelegationGovernanceService();

  const decision = governance.evaluate({
    parentContext: createParentContext(),
    delegationSpec: createDelegationSpec(),
    riskLevel: "low",
  });

  assert.equal(decision.decision, "allow");
  assert.equal(decision.requiresApproval, false);
});
