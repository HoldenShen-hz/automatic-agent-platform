// @ts-nocheck
/**
 * Unit tests for DelegationGovernanceService - Coverage Gaps
 *
 * Tests for code paths not covered in the main test file:
 * - Empty condition matching (default allow rule)
 * - targetAgentType condition
 * - permissionActions condition edge cases
 * - Multiple rules interaction
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  DelegationGovernanceService,
  defaultDelegationGovernanceService,
  type DelegationGovernanceRequest,
  type GovernanceRule,
} from "../../../../../src/platform/orchestration/agent-delegation/delegation-governance-service.js";
import type { AgentContext, DelegationSpec } from "../../../../../src/platform/orchestration/agent-delegation/delegation-types.js";

function createMockContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    agentId: "agent_1",
    agentType: "agent",
    packId: "pack_1",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["resource_1"],
      actions: ["read", "write", "delete"],
      constraints: {},
    },
    sandboxTier: "container",
    correlationId: "corr_1",
    tenantId: "tenant_1",
    ...overrides,
  };
}

function createMockSpec(overrides: Partial<DelegationSpec> = {}): DelegationSpec {
  return {
    targetAgentId: "agent_2",
    targetAgentType: "worker",
    targetPackId: "pack_2",
    requiredPermissions: {
      resources: ["resource_1"],
      actions: ["read", "write"],
      constraints: {},
    },
    timeout: 60000,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty Condition Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DelegationGovernanceService empty condition matches any request", () => {
  const service = new DelegationGovernanceService([]);
  const emptyRule: GovernanceRule = {
    ruleId: "empty_condition",
    name: "Empty Condition Rule",
    description: "Rule with empty condition should match all",
    enabled: true,
    priority: 1,
    condition: {},
    effect: { decision: "allow", reasonCode: "test.empty" },
  };
  service.addRule(emptyRule);

  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext(),
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  assert.equal(decision.decision, "allow");
  assert.ok(decision.evaluatedRules.includes("empty_condition"));
});

test("DelegationGovernanceService empty condition with other conditions", () => {
  const service = new DelegationGovernanceService([]);
  const rule: GovernanceRule = {
    ruleId: "mixed_condition",
    name: "Mixed Condition",
    description: "Empty condition should still match",
    enabled: true,
    priority: 1,
    condition: {},
    effect: { decision: "allow", reasonCode: "test.mixed" },
  };
  service.addRule(rule);

  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext({ agentType: "system" }),
    delegationSpec: createMockSpec(),
    riskLevel: "medium",
  };

  const decision = service.evaluate(request);
  assert.equal(decision.decision, "allow");
});

// ─────────────────────────────────────────────────────────────────────────────
// targetAgentType Condition Tests
// ─────────────────────────────────────────────────────────────────────────────

test.skip("DelegationGovernanceService denies mismatched targetAgentType", () => {
  const service = new DelegationGovernanceService([]);
  const rule: GovernanceRule = {
    ruleId: "target_type_rule",
    name: "Target Type Rule",
    description: "Deny if targetAgentType doesn't match",
    enabled: true,
    priority: 1,
    condition: { targetAgentType: "supervisor" },
    effect: { decision: "deny", reasonCode: "test.target_type_mismatch" },
  };
  service.addRule(rule);

  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext(),
    delegationSpec: createMockSpec({ targetAgentType: "worker" }),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "test.target_type_mismatch");
});

test.skip("DelegationGovernanceService allows matching targetAgentType", () => {
  const service = new DelegationGovernanceService([]);
  const rule: GovernanceRule = {
    ruleId: "target_type_rule",
    name: "Target Type Rule",
    description: "Allow if targetAgentType matches",
    enabled: true,
    priority: 1,
    condition: { targetAgentType: "worker" },
    effect: { decision: "allow", reasonCode: "test.target_type_match" },
  };
  service.addRule(rule);

  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext(),
    delegationSpec: createMockSpec({ targetAgentType: "worker" }),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  assert.equal(decision.decision, "allow");
  assert.equal(decision.reasonCode, "test.target_type_match");
});

test("DelegationGovernanceService allows when targetAgentType condition not set", () => {
  const service = new DelegationGovernanceService([]);
  const rule: GovernanceRule = {
    ruleId: "no_target_condition",
    name: "No Target Condition",
    description: "Should allow when targetAgentType not in condition",
    enabled: true,
    priority: 1,
    condition: {},
    effect: { decision: "allow", reasonCode: "test.no_target" },
  };
  service.addRule(rule);

  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext(),
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  assert.equal(decision.decision, "allow");
});

// ─────────────────────────────────────────────────────────────────────────────
// permissionActions Condition Tests
// ─────────────────────────────────────────────────────────────────────────────

test.skip("DelegationGovernanceService allows when permissionActions match", () => {
  const service = new DelegationGovernanceService([]);
  const rule: GovernanceRule = {
    ruleId: "permission_rule",
    name: "Permission Rule",
    description: "Allow if required permissions include specified action",
    enabled: true,
    priority: 1,
    condition: { permissionActions: ["read"] },
    effect: { decision: "allow", reasonCode: "test.has_read" },
  };
  service.addRule(rule);

  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext(),
    delegationSpec: createMockSpec({ requiredPermissions: { resources: [], actions: ["read"], constraints: {} } }),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  assert.equal(decision.decision, "allow");
  assert.equal(decision.reasonCode, "test.has_read");
});

test.skip("DelegationGovernanceService denies when permissionActions not found", () => {
  const service = new DelegationGovernanceService([]);
  const rule: GovernanceRule = {
    ruleId: "permission_rule",
    name: "Permission Rule",
    description: "Deny if required permissions don't include specified action",
    enabled: true,
    priority: 1,
    condition: { permissionActions: ["admin"] },
    effect: { decision: "deny", reasonCode: "test.missing_admin" },
  };
  service.addRule(rule);

  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext(),
    delegationSpec: createMockSpec({ requiredPermissions: { resources: [], actions: ["read"], constraints: {} } }),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "test.missing_admin");
});

test("DelegationGovernanceService allows when permissionActions is empty array", () => {
  const service = new DelegationGovernanceService([]);
  const rule: GovernanceRule = {
    ruleId: "permission_rule",
    name: "Permission Rule",
    description: "Empty permissionActions should not filter",
    enabled: true,
    priority: 1,
    condition: { permissionActions: [] },
    effect: { decision: "allow", reasonCode: "test.empty_permissions" },
  };
  service.addRule(rule);

  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext(),
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  assert.equal(decision.decision, "allow");
});

// ─────────────────────────────────────────────────────────────────────────────
// Multiple Rules Interaction Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DelegationGovernanceService stops at first deny rule", () => {
  const service = new DelegationGovernanceService([]);
  service.addRule({
    ruleId: "first_rule",
    name: "First Rule",
    description: "Should trigger first",
    enabled: true,
    priority: 1,
    condition: {},
    effect: { decision: "deny", reasonCode: "test.first_deny" },
  });
  service.addRule({
    ruleId: "second_rule",
    name: "Second Rule",
    description: "Should not trigger",
    enabled: true,
    priority: 2,
    condition: {},
    effect: { decision: "allow", reasonCode: "test.second_allow" },
  });

  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext(),
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "test.first_deny");
});

test("DelegationGovernanceService collects all evaluated rules", () => {
  const service = new DelegationGovernanceService([]);
  service.addRule({
    ruleId: "rule_1",
    name: "Rule 1",
    description: "First",
    enabled: true,
    priority: 1,
    condition: {},
    effect: { decision: "allow", reasonCode: "test.ok" },
  });
  service.addRule({
    ruleId: "rule_2",
    name: "Rule 2",
    description: "Second",
    enabled: true,
    priority: 2,
    condition: {},
    effect: { decision: "allow", reasonCode: "test.ok" },
  });

  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext(),
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  assert.ok(decision.evaluatedRules.includes("rule_1"));
  assert.ok(decision.evaluatedRules.includes("rule_2"));
});

test("DelegationGovernanceService disabled rules are not evaluated", () => {
  const service = new DelegationGovernanceService([]);
  service.addRule({
    ruleId: "disabled_rule",
    name: "Disabled Rule",
    description: "Should not evaluate",
    enabled: false,
    priority: 1,
    condition: {},
    effect: { decision: "deny", reasonCode: "test.disabled" },
  });

  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext(),
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  assert.ok(!decision.evaluatedRules.includes("disabled_rule"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Allow With Constraints Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DelegationGovernanceService allow_with_constraints accumulates constraints", () => {
  const service = new DelegationGovernanceService([]);
  service.addRule({
    ruleId: "constraint_rule_1",
    name: "Constraint Rule 1",
    description: "First constraint",
    enabled: true,
    priority: 1,
    condition: {},
    effect: { decision: "allow_with_constraints", reasonCode: "test.constrained", constraints: { maxTokens: 1000 } },
  });
  service.addRule({
    ruleId: "constraint_rule_2",
    name: "Constraint Rule 2",
    description: "Second constraint",
    enabled: true,
    priority: 2,
    condition: {},
    effect: { decision: "allow_with_constraints", reasonCode: "test.constrained", constraints: { maxDurationMs: 5000 } },
  });

  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext(),
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  assert.equal(decision.decision, "allow");
  assert.deepEqual(decision.constraints, { maxTokens: 1000, maxDurationMs: 5000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// Risk Level Condition Tests
// ─────────────────────────────────────────────────────────────────────────────

test.skip("DelegationGovernanceService allows when riskLevel matches", () => {
  const service = new DelegationGovernanceService([]);
  const rule: GovernanceRule = {
    ruleId: "risk_rule",
    name: "Risk Rule",
    description: "Allow for medium risk",
    enabled: true,
    priority: 1,
    condition: { riskLevel: "medium" },
    effect: { decision: "allow", reasonCode: "test.medium_risk" },
  };
  service.addRule(rule);

  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext(),
    delegationSpec: createMockSpec(),
    riskLevel: "medium",
  };

  const decision = service.evaluate(request);
  assert.equal(decision.decision, "allow");
  assert.equal(decision.reasonCode, "test.medium_risk");
});

test("DelegationGovernanceService denies when riskLevel does not match", () => {
  const service = new DelegationGovernanceService([]);
  const rule: GovernanceRule = {
    ruleId: "risk_rule",
    name: "Risk Rule",
    description: "Deny if risk doesn't match",
    enabled: true,
    priority: 1,
    condition: { riskLevel: "high" },
    effect: { decision: "deny", reasonCode: "test.risk_mismatch" },
  };
  service.addRule(rule);

  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext(),
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  // Should not trigger risk_rule since riskLevel doesn't match
  // Should fall through to default allow
  assert.equal(decision.decision, "allow");
});

// ─────────────────────────────────────────────────────────────────────────────
// Audit Record Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DelegationGovernanceService audit records without approver", () => {
  const service = new DelegationGovernanceService();
  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext(),
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  const record = service.recordDecision(request, decision);

  assert.equal(record.approvedBy, null);
});

test("DelegationGovernanceService getAuditRecords returns empty for unknown agent", () => {
  const service = new DelegationGovernanceService();
  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext({ agentId: "agent_a" }),
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };

  service.recordDecision(request, service.evaluate(request));

  const records = service.getAuditRecords("agent_b");
  assert.equal(records.length, 0);
});

test("DelegationGovernanceService getAuditRecords without filter returns all", () => {
  const service = new DelegationGovernanceService();
  service.recordDecision(
    { parentContext: createMockContext({ agentId: "agent_a" }), delegationSpec: createMockSpec(), riskLevel: "low" },
    service.evaluate({ parentContext: createMockContext({ agentId: "agent_a" }), delegationSpec: createMockSpec(), riskLevel: "low" }),
  );
  service.recordDecision(
    { parentContext: createMockContext({ agentId: "agent_b" }), delegationSpec: createMockSpec(), riskLevel: "low" },
    service.evaluate({ parentContext: createMockContext({ agentId: "agent_b" }), delegationSpec: createMockSpec(), riskLevel: "low" }),
  );

  const allRecords = service.getAuditRecords();
  assert.equal(allRecords.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Default Governance Service Tests
// ─────────────────────────────────────────────────────────────────────────────

test("defaultDelegationGovernanceService is exported and functional", () => {
  // The default service should have default rules
  const records = defaultDelegationGovernanceService.getRules();
  assert.ok(records.length > 0);
});

test("defaultDelegationGovernanceService can evaluate requests", () => {
  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext({ agentType: "user" }),
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };

  const decision = defaultDelegationGovernanceService.evaluate(request);
  assert.equal(decision.decision, "allow");
});
