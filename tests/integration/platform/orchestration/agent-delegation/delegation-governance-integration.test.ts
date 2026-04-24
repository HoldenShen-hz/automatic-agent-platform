// @ts-nocheck
/**
 * Integration Test: Delegation Governance Service
 *
 * Tests the DelegationGovernanceService which implements governance rules
 * for agent delegation including:
 * - Delegation authorization based on policies
 * - Permission boundary enforcement
 * - Delegation audit trail
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import { DelegationGovernanceService, defaultDelegationGovernanceService, type GovernanceRule } from "../../../../../src/platform/orchestration/agent-delegation/delegation-governance-service.js";
import type { AgentContext, DelegationSpec } from "../../../../../src/platform/orchestration/agent-delegation/delegation-types.js";

function createTestAgentContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    agentId: "governance_parent_001",
    agentType: "general_executor",
    packId: "pack_default",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["/workspace", "/code"],
      actions: ["read", "write", "execute", "bash"],
      constraints: {
        maxDurationMs: 300000,
        maxTokens: 8000,
      },
    },
    sandboxTier: "container",
    correlationId: "gov_corr_001",
    tenantId: null,
    ...overrides,
  };
}

function createDelegationSpec(overrides: Partial<DelegationSpec> = {}): DelegationSpec {
  return {
    targetAgentId: "governance_child_001",
    targetAgentType: "general_executor",
    targetPackId: "pack_default",
    requiredPermissions: {
      resources: ["/workspace"],
      actions: ["read", "write"],
      constraints: {
        maxDurationMs: 60000,
        maxTokens: 4000,
      },
    },
    timeout: 120000,
    ...overrides,
  };
}

test("DelegationGovernance evaluates default rules and allows valid delegation", () => {
  const ctx = createIntegrationContext("aa-gov-default-");
  try {
    const service = new DelegationGovernanceService();

    const parent = createTestAgentContext();
    const spec = createDelegationSpec();

    const decision = service.evaluate({
      parentContext: parent,
      delegationSpec: spec,
      riskLevel: "low",
    });

    assert.equal(decision.decision, "allow");
    assert.equal(decision.reasonCode, "delegation.allowed");
    assert.ok(decision.evaluatedRules.length >= 1);
    assert.equal(decision.requiresApproval, false);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationGovernance denies delegation at max depth", () => {
  const ctx = createIntegrationContext("aa-gov-maxdepth-");
  try {
    const service = new DelegationGovernanceService();

    const parent = createTestAgentContext({ delegationDepth: 5 });
    const spec = createDelegationSpec();

    const decision = service.evaluate({
      parentContext: parent,
      delegationSpec: spec,
    });

    assert.equal(decision.decision, "deny");
    assert.equal(decision.reasonCode, "delegation.max_depth_exceeded");
  } finally {
    ctx.cleanup();
  }
});

test("DelegationGovernance denies system agent delegation", () => {
  const ctx = createIntegrationContext("aa-gov-system-");
  try {
    const service = new DelegationGovernanceService();

    const parent = createTestAgentContext({ agentType: "system" });
    const spec = createDelegationSpec();

    const decision = service.evaluate({
      parentContext: parent,
      delegationSpec: spec,
    });

    assert.equal(decision.decision, "deny");
    assert.equal(decision.reasonCode, "delegation.system_agent_restricted");
  } finally {
    ctx.cleanup();
  }
});

test("DelegationGovernance requires approval for high risk delegation", () => {
  const ctx = createIntegrationContext("aa-gov-highrisk-");
  try {
    const service = new DelegationGovernanceService();

    const parent = createTestAgentContext();
    const spec = createDelegationSpec();

    const decision = service.evaluate({
      parentContext: parent,
      delegationSpec: spec,
      riskLevel: "high",
    });

    assert.equal(decision.decision, "require_approval");
    assert.equal(decision.reasonCode, "delegation.high_risk_requires_approval");
    assert.equal(decision.requiresApproval, true);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationGovernance denies critical risk delegation", () => {
  const ctx = createIntegrationContext("aa-gov-critical-");
  try {
    const service = new DelegationGovernanceService();

    const parent = createTestAgentContext();
    const spec = createDelegationSpec();

    const decision = service.evaluate({
      parentContext: parent,
      delegationSpec: spec,
      riskLevel: "critical",
    });

    assert.equal(decision.decision, "deny");
    assert.equal(decision.reasonCode, "delegation.critical_risk_denied");
  } finally {
    ctx.cleanup();
  }
});

test("DelegationGovernance records audit record after decision", () => {
  const ctx = createIntegrationContext("aa-gov-audit-");
  try {
    const service = new DelegationGovernanceService();

    const parent = createTestAgentContext();
    const spec = createDelegationSpec();

    const decision = service.evaluate({
      parentContext: parent,
      delegationSpec: spec,
      riskLevel: "low",
    });

    const record = service.recordDecision(
      { parentContext: parent, delegationSpec: spec, riskLevel: "low" },
      decision,
      "admin_user",
    );

    assert.ok(record.id.startsWith("dlg_gov_"));
    assert.equal(record.decision, "allow");
    assert.equal(record.approvedBy, "admin_user");
    assert.ok(record.createdAt.length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationGovernance records audit record without approver", () => {
  const ctx = createIntegrationContext("aa-gov-audit-noapprover-");
  try {
    const service = new DelegationGovernanceService();

    const parent = createTestAgentContext();
    const spec = createDelegationSpec();

    const decision = service.evaluate({
      parentContext: parent,
      delegationSpec: spec,
    });

    const record = service.recordDecision(
      { parentContext: parent, delegationSpec: spec },
      decision,
    );

    assert.equal(record.approvedBy, null);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationGovernance retrieves audit records for agent", () => {
  const ctx = createIntegrationContext("aa-gov-audit-get-");
  try {
    const service = new DelegationGovernanceService();

    const parent = createTestAgentContext({ agentId: "audit_test_agent" });
    const spec = createDelegationSpec();

    const decision = service.evaluate({
      parentContext: parent,
      delegationSpec: spec,
    });

    service.recordDecision(
      { parentContext: parent, delegationSpec: spec },
      decision,
    );

    const records = service.getAuditRecords("audit_test_agent");
    assert.ok(records.length >= 1);
    assert.equal(records[0]!.request.parentContext.agentId, "audit_test_agent");
  } finally {
    ctx.cleanup();
  }
});

test("DelegationGovernance retrieves all audit records without filter", () => {
  const ctx = createIntegrationContext("aa-gov-audit-all-");
  try {
    const service = new DelegationGovernanceService();

    const parent1 = createTestAgentContext({ agentId: "agent_a" });
    const parent2 = createTestAgentContext({ agentId: "agent_b" });
    const spec = createDelegationSpec();

    const decision1 = service.evaluate({ parentContext: parent1, delegationSpec: spec });
    const decision2 = service.evaluate({ parentContext: parent2, delegationSpec: spec });

    service.recordDecision({ parentContext: parent1, delegationSpec: spec }, decision1);
    service.recordDecision({ parentContext: parent2, delegationSpec: spec }, decision2);

    const allRecords = service.getAuditRecords();
    assert.ok(allRecords.length >= 2);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationGovernance adds custom rule", () => {
  const ctx = createIntegrationContext("aa-gov-addrule-");
  try {
    const service = new DelegationGovernanceService();

    const customRule: GovernanceRule = {
      ruleId: "custom_rule",
      name: "Custom Test Rule",
      description: "A custom rule for testing",
      enabled: true,
      priority: 5,
      condition: { delegationDepth: 2 },
      effect: { decision: "deny", reasonCode: "delegation.custom_rule_triggered" },
    };

    service.addRule(customRule);

    const rules = service.getRules();
    assert.ok(rules.some((r) => r.ruleId === "custom_rule"));
  } finally {
    ctx.cleanup();
  }
});

test("DelegationGovernance removes existing rule", () => {
  const ctx = createIntegrationContext("aa-gov-removerule-");
  try {
    const service = new DelegationGovernanceService();

    const removed = service.removeRule("max_depth");
    assert.equal(removed, true);

    const rules = service.getRules();
    assert.ok(!rules.some((r) => r.ruleId === "max_depth"));
  } finally {
    ctx.cleanup();
  }
});

test("DelegationGovernance enableRule enables disabled rule", () => {
  const ctx = createIntegrationContext("aa-gov-enablerule-");
  try {
    const service = new DelegationGovernanceService();

    service.disableRule("allow_default");
    let rules = service.getRules();
    const disabledRule = rules.find((r) => r.ruleId === "allow_default");
    assert.equal(disabledRule!.enabled, false);

    service.enableRule("allow_default");
    rules = service.getRules();
    const enabledRule = rules.find((r) => r.ruleId === "allow_default");
    assert.equal(enabledRule!.enabled, true);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationGovernance disableRule disables enabled rule", () => {
  const ctx = createIntegrationContext("aa-gov-disablerule-");
  try {
    const service = new DelegationGovernanceService();

    service.disableRule("allow_default");
    const rules = service.getRules();
    const rule = rules.find((r) => r.ruleId === "allow_default");
    assert.equal(rule!.enabled, false);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationGovernance getRules returns sorted rules by priority", () => {
  const ctx = createIntegrationContext("aa-gov-sortrules-");
  try {
    const service = new DelegationGovernanceService();

    const rules = service.getRules();

    // Verify sorted by priority ascending
    for (let i = 1; i < rules.length; i++) {
      assert.ok(rules[i - 1]!.priority <= rules[i]!.priority);
    }
  } finally {
    ctx.cleanup();
  }
});

test("DelegationGovernance evaluate processes rules in priority order", () => {
  const ctx = createIntegrationContext("aa-gov-priority-");
  try {
    const service = new DelegationGovernanceService();

    // critical_risk has priority 5, max_depth has priority 10
    // critical should be evaluated first and return early
    const parent = createTestAgentContext({ delegationDepth: 5 });
    const spec = createDelegationSpec();

    const decision = service.evaluate({
      parentContext: parent,
      delegationSpec: spec,
      riskLevel: "critical",
    });

    // Should deny due to critical risk (priority 5), not max depth (priority 10)
    assert.equal(decision.decision, "deny");
    assert.equal(decision.reasonCode, "delegation.critical_risk_denied");
  } finally {
    ctx.cleanup();
  }
});

test("DelegationGovernance default service instance works correctly", () => {
  const ctx = createIntegrationContext("aa-gov-defaultsvc-");
  try {
    const parent = createTestAgentContext();
    const spec = createDelegationSpec();

    const decision = defaultDelegationGovernanceService.evaluate({
      parentContext: parent,
      delegationSpec: spec,
    });

    assert.equal(decision.decision, "allow");
  } finally {
    ctx.cleanup();
  }
});

test("DelegationGovernance with custom rules processes them correctly", () => {
  const ctx = createIntegrationContext("aa-gov-customrules-");
  try {
    const customRules: GovernanceRule[] = [
      {
        ruleId: "test_deny",
        name: "Test Deny Rule",
        description: "Denies if agentId contains test",
        enabled: true,
        priority: 1,
        condition: { targetAgentType: "test_agent" },
        effect: { decision: "deny", reasonCode: "delegation.test_deny" },
      },
    ];

    const service = new DelegationGovernanceService(customRules);

    const parent = createTestAgentContext();
    const spec = createDelegationSpec({ targetAgentType: "test_agent" });

    const decision = service.evaluate({
      parentContext: parent,
      delegationSpec: spec,
    });

    assert.equal(decision.decision, "deny");
    assert.equal(decision.reasonCode, "delegation.test_deny");
  } finally {
    ctx.cleanup();
  }
});
