import assert from "node:assert/strict";
import test from "node:test";

import { CallDepthBudget } from "../../../../../src/platform/five-plane-orchestration/agent-delegation/call-depth-budget.js";
import { createDelegationManager } from "../../../../../src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.js";

test("CallDepthBudget sums decomposition and delegation depth instead of taking Math.max", () => {
  const decision = new CallDepthBudget().evaluate({
    currentCallDepth: 2,
    goalDecompositionDepth: 3,
    delegationDepth: 4,
  });

  assert.equal(decision.effectiveCallDepth, 9);
  assert.equal(decision.allowed, false);
});

test("DelegationManagerService caps timeout to 30 days", async () => {
  const service = createDelegationManager();
  const now = Date.now();
  const handle = await service.delegate(
    {
      agentId: "parent-agent",
      agentType: "coordinator",
      packId: "pack-parent",
      delegationDepth: 0,
      activeDelegations: [],
      permissions: {
        resources: ["resource-a"],
        actions: ["action-read"],
        constraints: {},
      },
      sandboxTier: "workspace_write",
      correlationId: "corr-1",
      tenantId: "tenant-1",
    },
    {
      targetAgentId: "child-agent",
      targetAgentType: "worker",
      targetPackId: "pack-child",
      timeout: Number.MAX_SAFE_INTEGER,
      requiredPermissions: {
        resources: [],
        actions: [],
        constraints: {},
      },
    },
  );

  const delegation = await service.getDelegation(handle.delegationId);
  const ttlMs = new Date(delegation?.expiresAt ?? 0).getTime() - now;
  const maxDelegationTimeoutMs = 30 * 24 * 60 * 60 * 1000;
  assert.ok(ttlMs > maxDelegationTimeoutMs - 60_000);
  assert.ok(ttlMs <= maxDelegationTimeoutMs + 5_000);
});
