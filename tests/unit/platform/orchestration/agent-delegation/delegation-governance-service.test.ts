/**
 * Unit tests for DelegationGovernanceService
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  DelegationGovernanceService,
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
      actions: ["read", "write"],
      constraints: {},
    },
    sandboxTier: "workspace_write",
    correlationId: "corr_1",
    tenantId: "tenant_1",
    ...overrides,
  };
}

function createMockSpec(overrides: Partial<DelegationSpec> = {}): DelegationSpec {
  return {
    targetAgentId: "agent_2",
    targetAgentType: "agent",
    targetPackId: "pack_2",
    requiredPermissions: {
      resources: ["resource_1"],
      actions: ["read"],
      constraints: {},
    },
    timeout: 60000,
    ...overrides,
  };
}

test("DelegationGovernanceService denies when max depth exceeded", () => {
  const service = new DelegationGovernanceService();
  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext({ delegationDepth: 5 }),
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);

  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "delegation.max_depth_exceeded");
  assert.ok(decision.evaluatedRules.includes("max_depth"));
});

test("DelegationGovernanceService denies system agent delegation", () => {
  const service = new DelegationGovernanceService();
  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext({ agentType: "system" }),
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);

  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "delegation.system_agent_restricted");
});

test("DelegationGovernanceService requires approval for high risk", () => {
  const service = new DelegationGovernanceService();
  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext(),
    delegationSpec: createMockSpec(),
    riskLevel: "high",
  };

  const decision = service.evaluate(request);

  assert.equal(decision.decision, "require_approval");
  assert.equal(decision.reasonCode, "delegation.high_risk_requires_approval");
  assert.equal(decision.requiresApproval, true);
});

test("DelegationGovernanceService denies critical risk", () => {
  const service = new DelegationGovernanceService();
  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext(),
    delegationSpec: createMockSpec(),
    riskLevel: "critical",
  };

  const decision = service.evaluate(request);

  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "delegation.critical_risk_denied");
});

test("DelegationGovernanceService allows low risk delegation", () => {
  const service = new DelegationGovernanceService();
  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext(),
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);

  assert.equal(decision.decision, "allow");
  assert.equal(decision.reasonCode, "delegation.allowed");
  assert.equal(decision.requiresApproval, false);
});

test("DelegationGovernanceService records governance decision", () => {
  const service = new DelegationGovernanceService();
  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext(),
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  const record = service.recordDecision(request, decision, "admin");

  assert.equal(record.decision, "allow");
  assert.equal(record.approvedBy, "admin");
  assert.ok(record.id.startsWith("dlg_gov_"));
});

test("DelegationGovernanceService.addRule adds new rule", () => {
  const service = new DelegationGovernanceService();
  const newRule: GovernanceRule = {
    ruleId: "custom_rule",
    name: "Custom Rule",
    description: "A custom test rule",
    enabled: true,
    priority: 15,
    condition: { riskLevel: "medium" },
    effect: { decision: "deny", reasonCode: "delegation.custom_rule" },
  };

  service.addRule(newRule);
  const rules = service.getRules();

  assert.ok(rules.some((r) => r.ruleId === "custom_rule"));
});

test("DelegationGovernanceService.removeRule removes rule", () => {
  const service = new DelegationGovernanceService();
  const removed = service.removeRule("max_depth");

  assert.equal(removed, true);
  assert.ok(!service.getRules().some((r) => r.ruleId === "max_depth"));
});

test("DelegationGovernanceService.enableRule enables disabled rule", () => {
  const service = new DelegationGovernanceService();
  service.disableRule("max_depth");

  assert.ok(service.enableRule("max_depth"));
  const rule = service.getRules().find((r) => r.ruleId === "max_depth");
  assert.equal(rule?.enabled, true);
});

test("DelegationGovernanceService.disableRule disables rule", () => {
  const service = new DelegationGovernanceService();

  assert.ok(service.disableRule("max_depth"));
  const rule = service.getRules().find((r) => r.ruleId === "max_depth");
  assert.equal(rule?.enabled, false);
});

test("DelegationGovernanceService.getAuditRecords returns filtered records", () => {
  const service = new DelegationGovernanceService();
  const request1: DelegationGovernanceRequest = {
    parentContext: createMockContext({ agentId: "agent_a" }),
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };
  const request2: DelegationGovernanceRequest = {
    parentContext: createMockContext({ agentId: "agent_b" }),
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };

  service.recordDecision(request1, service.evaluate(request1));
  service.recordDecision(request2, service.evaluate(request2));

  const recordsA = service.getAuditRecords("agent_a");
  assert.equal(recordsA.length, 1);
  assert.equal(recordsA[0]?.request.parentContext.agentId, "agent_a");
});
