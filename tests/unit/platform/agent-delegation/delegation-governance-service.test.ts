import assert from "node:assert/strict";
import test from "node:test";

import {
  DelegationGovernanceService,
  type GovernanceRule,
  type DelegationGovernanceRequest,
} from "../../../../src/platform/orchestration/agent-delegation/delegation-governance-service.js";

import type { AgentContext, DelegationSpec } from "../../../../src/platform/orchestration/agent-delegation/delegation-types.js";

function createMockParentContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    agentId: "parent-1",
    agentType: "agent",
    packId: "pack-1",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    sandboxTier: "none",
    correlationId: "corr-1",
    tenantId: "tenant-1",
    ...overrides,
  };
}

function createMockDelegationSpec(overrides: Partial<DelegationSpec> = {}): DelegationSpec {
  return {
    targetAgentId: "child-1",
    targetAgentType: "agent",
    targetPackId: "pack-2",
    requiredPermissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    timeout: 30000,
    ...overrides,
  };
}

test("DelegationGovernanceService.evaluate denies when max_depth rule matches", () => {
  const service = new DelegationGovernanceService();

  const request: DelegationGovernanceRequest = {
    parentContext: createMockParentContext({ agentType: "user", delegationDepth: 5 }),
    delegationSpec: createMockDelegationSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);

  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "delegation.max_depth_exceeded");
  assert.ok(decision.evaluatedRules.includes("max_depth"));
});

test("DelegationGovernanceService.evaluate denies system agent when system_agent_restricted matches", () => {
  const service = new DelegationGovernanceService();

  const request: DelegationGovernanceRequest = {
    parentContext: createMockParentContext({ agentType: "system" }),
    delegationSpec: createMockDelegationSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);

  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "delegation.system_agent_restricted");
  assert.ok(decision.evaluatedRules.includes("system_agent_restricted"));
});

test("DelegationGovernanceService.evaluate requires approval for high risk delegation", () => {
  const service = new DelegationGovernanceService();

  const request: DelegationGovernanceRequest = {
    parentContext: createMockParentContext(),
    delegationSpec: createMockDelegationSpec(),
    riskLevel: "high",
  };

  const decision = service.evaluate(request);

  assert.equal(decision.decision, "require_approval");
  assert.equal(decision.reasonCode, "delegation.high_risk_requires_approval");
  assert.ok(decision.requiresApproval);
});

test("DelegationGovernanceService.evaluate denies critical risk delegation", () => {
  const service = new DelegationGovernanceService();

  const request: DelegationGovernanceRequest = {
    parentContext: createMockParentContext(),
    delegationSpec: createMockDelegationSpec(),
    riskLevel: "critical",
  };

  const decision = service.evaluate(request);

  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "delegation.critical_risk_denied");
});

test("DelegationGovernanceService.evaluate allows low risk delegation by default", () => {
  const service = new DelegationGovernanceService();

  const request: DelegationGovernanceRequest = {
    parentContext: createMockParentContext(),
    delegationSpec: createMockDelegationSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);

  assert.equal(decision.decision, "allow");
  assert.equal(decision.reasonCode, "delegation.allowed");
  assert.ok(!decision.requiresApproval);
});

test("DelegationGovernanceService.evaluate applies allow_with_constraints", () => {
  const customRules: GovernanceRule[] = [
    {
      ruleId: "custom_constrained",
      name: "Custom Constrained Rule",
      description: "Applies constraints",
      enabled: true,
      priority: 15,
      condition: {},
      effect: {
        decision: "allow_with_constraints",
        reasonCode: "custom_allowed",
        constraints: { maxDurationMs: 5000 },
      },
    },
  ];

  const service = new DelegationGovernanceService(customRules);

  const request: DelegationGovernanceRequest = {
    parentContext: createMockParentContext(),
    delegationSpec: createMockDelegationSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);

  assert.equal(decision.decision, "allow");
  assert.deepEqual(decision.constraints, { maxDurationMs: 5000 });
});

test("DelegationGovernanceService.recordDecision creates audit record", () => {
  const service = new DelegationGovernanceService();

  const request: DelegationGovernanceRequest = {
    parentContext: createMockParentContext(),
    delegationSpec: createMockDelegationSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  const record = service.recordDecision(request, decision, "approver-1");

  assert.ok(record.id.startsWith("dlg_gov_"));
  assert.equal(record.decision, "allow");
  assert.equal(record.approvedBy, "approver-1");
  assert.ok(record.createdAt.length > 0);
});

test("DelegationGovernanceService.getAuditRecords returns all records when no agentId provided", () => {
  const service = new DelegationGovernanceService();

  const request1: DelegationGovernanceRequest = {
    parentContext: createMockParentContext({ agentId: "parent-1" }),
    delegationSpec: createMockDelegationSpec(),
    riskLevel: "low",
  };

  const request2: DelegationGovernanceRequest = {
    parentContext: createMockParentContext({ agentId: "parent-2" }),
    delegationSpec: createMockDelegationSpec(),
    riskLevel: "low",
  };

  service.recordDecision(request1, service.evaluate(request1));
  service.recordDecision(request2, service.evaluate(request2));

  const records = service.getAuditRecords();
  assert.equal(records.length, 2);
});

test("DelegationGovernanceService.getAuditRecords filters by agentId", () => {
  const service = new DelegationGovernanceService();

  const request1: DelegationGovernanceRequest = {
    parentContext: createMockParentContext({ agentId: "parent-1" }),
    delegationSpec: createMockDelegationSpec(),
    riskLevel: "low",
  };

  const request2: DelegationGovernanceRequest = {
    parentContext: createMockParentContext({ agentId: "parent-2" }),
    delegationSpec: createMockDelegationSpec(),
    riskLevel: "low",
  };

  service.recordDecision(request1, service.evaluate(request1));
  service.recordDecision(request2, service.evaluate(request2));

  const records = service.getAuditRecords("parent-1");
  assert.equal(records.length, 1);
  assert.equal(records[0]!.request.parentContext.agentId, "parent-1");
});

test("DelegationGovernanceService.getRules returns copy of rules", () => {
  const service = new DelegationGovernanceService();
  const rules = service.getRules();

  assert.ok(Array.isArray(rules));
  assert.ok(rules.length > 0);

  // Verify it's a copy by checking that modifications don't affect the service
  rules.push({
    ruleId: "test-rule",
    name: "Test",
    description: "Test rule",
    enabled: true,
    priority: 999,
    condition: {},
    effect: { decision: "allow", reasonCode: "test" },
  });

  const rules2 = service.getRules();
  assert.equal(rules2.length, rules.length - 1);
});

test("DelegationGovernanceService.addRule adds rule and re-sorts by priority", () => {
  const service = new DelegationGovernanceService();
  const initialRules = service.getRules();
  const initialCount = initialRules.length;

  service.addRule({
    ruleId: "new-rule",
    name: "New Rule",
    description: "A new rule",
    enabled: true,
    priority: 1, // Highest priority (lowest number)
    condition: {},
    effect: { decision: "allow", reasonCode: "new_rule" },
  });

  const rules = service.getRules();
  assert.equal(rules.length, initialCount + 1);
  assert.equal(rules[0]!.ruleId, "new-rule"); // Should be first due to highest priority
});

test("DelegationGovernanceService.removeRule removes existing rule", () => {
  const service = new DelegationGovernanceService();
  const initialRules = service.getRules();
  const initialCount = initialRules.length;

  const result = service.removeRule("max_depth");

  assert.equal(result, true);
  assert.equal(service.getRules().length, initialCount - 1);
  assert.ok(!service.getRules().some((r) => r.ruleId === "max_depth"));
});

test("DelegationGovernanceService.removeRule returns false for non-existent rule", () => {
  const service = new DelegationGovernanceService();

  const result = service.removeRule("non-existent-rule");

  assert.equal(result, false);
});

test("DelegationGovernanceService.enableRule enables existing disabled rule", () => {
  const service = new DelegationGovernanceService();

  // First disable a rule
  service.disableRule("max_depth");

  // Then enable it
  const result = service.enableRule("max_depth");

  assert.equal(result, true);
  assert.ok(service.getRules().find((r) => r.ruleId === "max_depth")!.enabled);
});

test("DelegationGovernanceService.enableRule returns false for non-existent rule", () => {
  const service = new DelegationGovernanceService();

  const result = service.enableRule("non-existent-rule");

  assert.equal(result, false);
});

test("DelegationGovernanceService.disableRule disables existing enabled rule", () => {
  const service = new DelegationGovernanceService();

  // First ensure the rule is enabled
  service.enableRule("max_depth");

  // Then disable it
  const result = service.disableRule("max_depth");

  assert.equal(result, true);
  assert.ok(!service.getRules().find((r) => r.ruleId === "max_depth")!.enabled);
});

test("DelegationGovernanceService.disableRule returns false for non-existent rule", () => {
  const service = new DelegationGovernanceService();

  const result = service.disableRule("non-existent-rule");

  assert.equal(result, false);
});

test("DelegationGovernanceService.evaluate evaluates rules in priority order", () => {
  const customRules: GovernanceRule[] = [
    {
      ruleId: "first-rule",
      name: "First Rule",
      description: "Should match first",
      enabled: true,
      priority: 1, // Highest priority
      condition: {},
      effect: { decision: "deny", reasonCode: "first_rule_deny" },
    },
    {
      ruleId: "second-rule",
      name: "Second Rule",
      description: "Should not be reached",
      enabled: true,
      priority: 2,
      condition: {},
      effect: { decision: "allow", reasonCode: "second_rule_allow" },
    },
  ];

  const service = new DelegationGovernanceService(customRules);

  const request: DelegationGovernanceRequest = {
    parentContext: createMockParentContext(),
    delegationSpec: createMockDelegationSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);

  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "first_rule_deny");
  assert.ok(decision.evaluatedRules.includes("first-rule"));
  assert.ok(!decision.evaluatedRules.includes("second-rule"));
});

test("DelegationGovernanceService.evaluate handles targetAgentType condition", () => {
  const customRules: GovernanceRule[] = [
    {
      ruleId: "target-type-rule",
      name: "Target Type Rule",
      description: "Matches specific target type",
      enabled: true,
      priority: 10,
      condition: { targetAgentType: "external-agent" },
      effect: { decision: "deny", reasonCode: "external_not_allowed" },
    },
  ];

  const service = new DelegationGovernanceService(customRules);

  const request: DelegationGovernanceRequest = {
    parentContext: createMockParentContext(),
    delegationSpec: createMockDelegationSpec({ targetAgentType: "external-agent" }),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);

  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "external_not_allowed");
});

test("DelegationGovernanceService.evaluate handles permissionActions condition", () => {
  const customRules: GovernanceRule[] = [
    {
      ruleId: "permission-rule",
      name: "Permission Rule",
      description: "Matches specific permissions",
      enabled: true,
      priority: 10,
      condition: { permissionActions: ["admin"] },
      effect: { decision: "deny", reasonCode: "admin_not_allowed" },
    },
  ];

  const service = new DelegationGovernanceService(customRules);

  const request: DelegationGovernanceRequest = {
    parentContext: createMockParentContext(),
    delegationSpec: createMockDelegationSpec({
      requiredPermissions: { resources: [], actions: ["admin"], constraints: {} },
    }),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);

  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "admin_not_allowed");
});

test("DelegationGovernanceService.evaluate skips disabled rules", () => {
  const customRules: GovernanceRule[] = [
    {
      ruleId: "disabled-rule",
      name: "Disabled Rule",
      description: "Should be skipped",
      enabled: false,
      priority: 1,
      condition: {},
      effect: { decision: "deny", reasonCode: "disabled_rule_deny" },
    },
  ];

  const service = new DelegationGovernanceService(customRules);

  const request: DelegationGovernanceRequest = {
    parentContext: createMockParentContext(),
    delegationSpec: createMockDelegationSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);

  assert.equal(decision.decision, "allow");
  assert.ok(!decision.evaluatedRules.includes("disabled-rule"));
});

test("DelegationGovernanceService.recordDecision without approvedBy sets approvedBy to null", () => {
  const service = new DelegationGovernanceService();

  const request: DelegationGovernanceRequest = {
    parentContext: createMockParentContext(),
    delegationSpec: createMockDelegationSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  const record = service.recordDecision(request, decision);

  assert.equal(record.approvedBy, null);
});
