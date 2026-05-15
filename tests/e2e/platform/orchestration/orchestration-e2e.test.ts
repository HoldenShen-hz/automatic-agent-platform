/**
 * E2E Test: Orchestration - Delegation + Escalation Combined Flow
 *
 * Tests the complete orchestration flow combining delegation and escalation
 * to verify they work together correctly in realistic scenarios.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import {
  DelegationManagerService,
  createDelegationManager,
  ContextIsolator,
  EscalationService,
  DelegationGovernanceService,
  type AgentContext,
  type DelegationSpec,
} from "../../../../../src/platform/five-plane-orchestration/agent-delegation/index.js";

// Mock external services for E2E testing
const mockPanicService = {
  activate: (request: any) => ({
    directive: { directiveId: `panic_e2e_${Date.now()}` },
    request,
  }),
  resume: () => ({ resumed: true }),
  getActive: () => null,
};

const mockApprovalService = {
  createRequest: (opts: { taskId: string }) => ({
    approvalId: `approval_e2e_${opts.taskId}`,
    ...opts,
  }),
};

function createE2EContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    agentId: "e2e_parent",
    agentType: "agent",
    packId: "pack_e2e",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["/workspace", "/code", "/data"],
      actions: ["read", "write", "execute", "delegate"],
      constraints: { maxDurationMs: 600000, maxTokens: 16000 },
    },
    sandboxTier: "container",
    correlationId: "e2e_corr",
    tenantId: "tenant_e2e",
    ...overrides,
  };
}

function createE2ESpec(overrides: Partial<DelegationSpec> = {}): DelegationSpec {
  return {
    targetAgentId: "e2e_child",
    targetAgentType: "agent",
    targetPackId: "pack_e2e_child",
    requiredPermissions: {
      resources: ["/workspace"],
      actions: ["read", "write"],
      constraints: {},
    },
    timeout: 120000,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// E2E Scenario 1: Normal Delegation Flow
// ─────────────────────────────────────────────────────────────────────────────

test("E2E: Normal delegation creation through completion", async () => {
  const ctx = createIntegrationContext("e2e-normal-");
  try {
    const manager = createDelegationManager();
    const parent = createE2EContext();
    const spec = createE2ESpec();

    // Create delegation
    const handle = manager.delegate(parent, spec);
    assert.ok(handle.delegationId.startsWith("dlg_"));
    assert.equal(handle.status, "pending");

    // Verify delegation exists
    const delegation = manager.getDelegation(handle.delegationId);
    assert.ok(delegation !== null);
    assert.equal(delegation!.status, "pending");

    // Complete delegation
    manager.complete(handle.delegationId);
    const completed = manager.getDelegation(handle.delegationId);
    assert.equal(completed!.status, "completed");
    assert.ok(completed!.completedAt !== undefined);
  } finally {
    ctx.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E Scenario 2: Escalation Flow with Approval
// ─────────────────────────────────────────────────────────────────────────────

test("E2E: Escalation triggers approval for production impact", async () => {
  const ctx = createIntegrationContext("e2e-escalation-");
  try {
    const escalationService = new EscalationService(mockPanicService as any, mockApprovalService as any);

    const request = {
      taskId: "task_prod_impact",
      executionId: "exec_prod",
      tenantId: "tenant_production",
      stage: "execute" as const,
      riskLevel: "high" as const,
      reasonCode: "production.impact",
      estimatedCostUsd: 25,
      affectsProduction: true,
    };

    const decision = escalationService.decide(request);

    assert.equal(decision.decision, "approval");
    assert.ok(decision.approvalRequestId !== undefined);
    assert.equal(decision.requiresOperatorAction, true);
  } finally {
    ctx.cleanup();
  }
});

test("E2E: Escalation triggers panic_stop for critical production", async () => {
  const ctx = createIntegrationContext("e2e-panic-");
  try {
    const escalationService = new EscalationService(mockPanicService as any, null);

    const request = {
      taskId: "task_critical",
      executionId: "exec_critical",
      tenantId: "tenant_critical",
      stage: "execute" as const,
      riskLevel: "critical" as const,
      reasonCode: "critical.failure",
      estimatedCostUsd: 100,
      affectsProduction: true,
    };

    const decision = escalationService.decide(request);

    assert.equal(decision.decision, "panic_stop");
    assert.ok(decision.panicDirectiveId !== undefined);
    assert.equal(decision.requiresOperatorAction, true);
  } finally {
    ctx.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E Scenario 3: Delegation with Context Isolation
// ─────────────────────────────────────────────────────────────────────────────

test("E2E: Delegation with context isolation produces narrowed permissions", async () => {
  const ctx = createIntegrationContext("e2e-isolation-");
  try {
    const isolator = new ContextIsolator();
    const parent = createE2EContext();
    const spec = createE2ESpec();

    const result = isolator.isolate(parent, spec);

    // Verify isolation worked
    assert.equal(result.context.agentId, "e2e_child");
    assert.equal(result.context.delegationDepth, 1);
    assert.ok(result.isolationLevel !== undefined);

    // Verify permissions are narrowed
    assert.ok(result.narrowedPermissions.resources.length <= parent.permissions.resources.length);
  } finally {
    ctx.cleanup();
  }
});

test("E2E: Permission validation prevents unauthorized access", async () => {
  const ctx = createIntegrationContext("e2e-perm-validate-");
  try {
    const isolator = new ContextIsolator();
    const parent = createE2EContext();

    // Valid request
    const validRequest = {
      resources: ["/workspace"],
      actions: ["read"],
      constraints: {},
    };
    assert.equal(isolator.validatePermissionRequest(parent.permissions, validRequest), true);

    // Invalid request - resource not allowed
    const invalidRequest = {
      resources: ["/secrets"],
      actions: ["read"],
      constraints: {},
    };
    assert.equal(isolator.validatePermissionRequest(parent.permissions, invalidRequest), false);
  } finally {
    ctx.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E Scenario 4: Governance Enforcement
// ─────────────────────────────────────────────────────────────────────────────

test("E2E: Governance blocks critical risk delegations", async () => {
  const ctx = createIntegrationContext("e2e-governance-");
  try {
    const governance = new DelegationGovernanceService();
    const request = {
      parentContext: createE2EContext(),
      delegationSpec: createE2ESpec(),
      riskLevel: "critical" as const,
    };

    const decision = governance.evaluate(request);

    assert.equal(decision.decision, "deny");
    assert.equal(decision.reasonCode, "delegation.critical_risk_denied");
  } finally {
    ctx.cleanup();
  }
});

test("E2E: Governance allows low risk delegations", async () => {
  const ctx = createIntegrationContext("e2e-governance-allow-");
  try {
    const governance = new DelegationGovernanceService();
    const request = {
      parentContext: createE2EContext(),
      delegationSpec: createE2ESpec(),
      riskLevel: "low" as const,
    };

    const decision = governance.evaluate(request);

    assert.equal(decision.decision, "allow");
    assert.equal(decision.requiresApproval, false);
  } finally {
    ctx.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E Scenario 5: Multi-level Delegation Chain
// ─────────────────────────────────────────────────────────────────────────────

test("E2E: Multi-level delegation chain tracking", async () => {
  const ctx = createIntegrationContext("e2e-chain-");
  try {
    const manager = createDelegationManager();

    // Level 0 -> 1
    const parent0 = createE2EContext({ agentId: "root" });
    const spec0 = createE2ESpec({ targetAgentId: "level1" });
    const handle0 = manager.delegate(parent0, spec0);

    // Level 1 -> 2
    const parent1 = createE2EContext({
      agentId: "level1",
      delegationDepth: 1,
      activeDelegations: [handle0.delegationId],
    });
    const spec1 = createE2ESpec({ targetAgentId: "level2" });
    const handle1 = manager.delegate(parent1, spec1);

    // Level 2 -> 3
    const parent2 = createE2EContext({
      agentId: "level2",
      delegationDepth: 2,
      activeDelegations: [handle1.delegationId],
    });
    const spec2 = createE2ESpec({ targetAgentId: "level3" });
    const handle2 = manager.delegate(parent2, spec2);

    // Verify depths
    assert.equal(handle0.depth, 1);
    assert.equal(handle1.depth, 2);
    assert.equal(handle2.depth, 3);

    // Verify chain exists
    const chain = manager.getDelegationChain("root");
    assert.ok(chain !== null);
    assert.ok(chain!.nodes.length >= 1);
  } finally {
    ctx.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E Scenario 6: Delegation Cancellation Flow
// ─────────────────────────────────────────────────────────────────────────────

test("E2E: Delegation cancellation removes active delegation", async () => {
  const ctx = createIntegrationContext("e2e-cancel-");
  try {
    const manager = createDelegationManager();
    const parent = createE2EContext();
    const spec = createE2ESpec();

    const handle = manager.delegate(parent, spec);

    // Verify active before cancel
    let active = manager.getActiveDelegations(parent.agentId);
    assert.ok(active.length >= 1);

    // Cancel
    manager.cancel(handle.delegationId);

    // Verify status changed
    const delegation = manager.getDelegation(handle.delegationId);
    assert.equal(delegation!.status, "cancelled");
  } finally {
    ctx.cleanup();
  }
});

test("E2E: Cannot cancel completed delegation", async () => {
  const ctx = createIntegrationContext("e2e-cancel-done-");
  try {
    const manager = createDelegationManager();
    const parent = createE2EContext();
    const spec = createE2ESpec();

    const handle = manager.delegate(parent, spec);
    manager.complete(handle.delegationId);

    // Attempting to cancel should throw
    assert.throws(
      () => manager.cancel(handle.delegationId),
      /cannot be cancelled/,
    );
  } finally {
    ctx.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E Scenario 7: Escalation Decision with Custom Cost Threshold
// ─────────────────────────────────────────────────────────────────────────────

test("E2E: Escalation respects custom cost threshold", async () => {
  const ctx = createIntegrationContext("e2e-cost-");
  try {
    const escalationService = new EscalationService(mockPanicService as any, mockApprovalService as any);

    // $50 with $100 threshold should NOT trigger approval
    const request = {
      taskId: "task_custom_cost",
      executionId: "exec_cost",
      tenantId: "tenant_cost",
      stage: "execute" as const,
      riskLevel: "low" as const,
      reasonCode: "cost.test",
      estimatedCostUsd: 50,
      costThresholdUsd: 100,
      affectsProduction: false,
    };

    const decision = escalationService.decide(request);

    assert.equal(decision.decision, "none");
  } finally {
    ctx.cleanup();
  }
});

test("E2E: Escalation at exact threshold triggers approval", async () => {
  const ctx = createIntegrationContext("e2e-cost-exact-");
  try {
    const escalationService = new EscalationService(mockPanicService as any, mockApprovalService as any);

    // $10 at $10 threshold should trigger (>=)
    const request = {
      taskId: "task_exact",
      executionId: "exec_exact",
      tenantId: "tenant_exact",
      stage: "assess" as const,
      riskLevel: "low" as const,
      reasonCode: "cost.exact",
      estimatedCostUsd: 10,
      costThresholdUsd: 10,
      affectsProduction: false,
    };

    const decision = escalationService.decide(request);

    assert.equal(decision.decision, "approval");
  } finally {
    ctx.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E Scenario 8: Failure Handling
// ─────────────────────────────────────────────────────────────────────────────

test("E2E: Delegation failure marks status correctly", async () => {
  const ctx = createIntegrationContext("e2e-fail-");
  try {
    const manager = createDelegationManager();
    const parent = createE2EContext();
    const spec = createE2ESpec();

    const handle = manager.delegate(parent, spec);
    manager.fail(handle.delegationId, "Simulated failure");

    const delegation = manager.getDelegation(handle.delegationId);
    assert.equal(delegation!.status, "failed");
  } finally {
    ctx.cleanup();
  }
});

test("E2E: Delegation timeout handling", async () => {
  const ctx = createIntegrationContext("e2e-timeout-");
  try {
    const manager = createDelegationManager();
    const parent = createE2EContext();
    const spec = createE2ESpec();

    const handle = manager.delegate(parent, spec);
    manager.handleDelegationTimeout(handle.delegationId);

    const delegation = manager.getDelegation(handle.delegationId);
    assert.equal(delegation!.status, "timed_out");
  } finally {
    ctx.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E Scenario 9: Escalation takes precedence correctly
// ─────────────────────────────────────────────────────────────────────────────

test("E2E: Critical production triggers panic even when other conditions exist", async () => {
  const ctx = createIntegrationContext("e2e-precedence-");
  try {
    const escalationService = new EscalationService(mockPanicService as any, mockApprovalService as any);

    // Critical + production = panic_stop (highest priority)
    const request = {
      taskId: "task_precedence",
      executionId: "exec_precedence",
      tenantId: "tenant_precedence",
      stage: "execute" as const,
      riskLevel: "critical" as const,
      reasonCode: "multiple.conditions",
      estimatedCostUsd: 100, // Also exceeds cost threshold
      affectsProduction: true, // Also production impact
    };

    const decision = escalationService.decide(request);

    // panic_stop should win over approval or takeover
    assert.equal(decision.decision, "panic_stop");
  } finally {
    ctx.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E Scenario 10: Merge Permissions in Isolation
// ─────────────────────────────────────────────────────────────────────────────

test("E2E: Merge permissions takes most restrictive values", async () => {
  const ctx = createIntegrationContext("e2e-merge-");
  try {
    const isolator = new ContextIsolator();
    const base = createE2EContext().permissions;
    const override = {
      resources: [],
      actions: [],
      constraints: { maxDurationMs: 30000, maxTokens: 8000 },
    };

    const merged = isolator.mergePermissions(base, override);

    assert.deepEqual(merged.resources, base.resources); // Resources inherit when override empty
    assert.equal(merged.constraints.maxDurationMs, 30000); // More restrictive
    assert.equal(merged.constraints.maxTokens, 8000); // More restrictive
  } finally {
    ctx.cleanup();
  }
});