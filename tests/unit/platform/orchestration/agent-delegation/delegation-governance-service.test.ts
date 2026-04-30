// @ts-nocheck
/**
 * Unit Tests: Delegation Governance Service - Issue #2184 & #2186
 *
 * - Issue #2184: delegationDepth condition short-circuits subsequent checks
 * - Issue #2186: addRule allows duplicate ruleId
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
    agentId: "agent_gov",
    agentType: "agent",
    packId: "pack_gov",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["resource_1"],
      actions: ["read", "write"],
      constraints: {},
    },
    sandboxTier: "workspace_write",
    correlationId: "corr_gov",
    tenantId: "tenant_gov",
    ...overrides,
  };
}

function createMockSpec(overrides: Partial<DelegationSpec> = {}): DelegationSpec {
  return {
    targetAgentId: "agent_target",
    targetAgentType: "agent",
    targetPackId: "pack_target",
    requiredPermissions: {
      resources: ["resource_1"],
      actions: ["read"],
      constraints: {},
    },
    timeout: 60000,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2184: delegationDepth condition short-circuits subsequent checks
// ─────────────────────────────────────────────────────────────────────────────

test("DelegationGovernanceService - delegationDepth condition does NOT short-circuit on depth check", () => {
  // The bug: when condition.delegationDepth is set (e.g., 5), the code does:
  //   if (request.parentContext.delegationDepth >= condition.delegationDepth) return true;
  // This means ANY depth >= 5 immediately matches, even when other conditions should be checked.
  // The fix should require ALL conditions to match, not just delegationDepth.

  const service = new DelegationGovernanceService([]);
  const rule: GovernanceRule = {
    ruleId: "depth_plus_action",
    name: "Depth Plus Action Rule",
    description: "Should match only when depth >= 3 AND action is present",
    enabled: true,
    priority: 1,
    condition: {
      delegationDepth: 3,
      permissionActions: ["admin"], // This should also need to match
    },
    effect: { decision: "deny", reasonCode: "test.depth_plus_action" },
  };
  service.addRule(rule);

  // Case 1: depth >= 3 but NO admin action - should NOT match (bug: currently matches)
  const request1: DelegationGovernanceRequest = {
    parentContext: createMockContext({ delegationDepth: 4 }),
    delegationSpec: createMockSpec({
      requiredPermissions: { resources: [], actions: ["read"], constraints: {} }, // No admin
    }),
    riskLevel: "low",
  };

  const decision1 = service.evaluate(request1);
  // With the bug, this would match because depth >= 3
  // The fix should require BOTH conditions to match
  assert.equal(decision1.decision, "allow", "Should not match when only depth condition is met but action missing");
});

test("DelegationGovernanceService - delegationDepth matches when ALL conditions met", () => {
  const service = new DelegationGovernanceService([]);
  const rule: GovernanceRule = {
    ruleId: "depth_and_action",
    name: "Depth And Action",
    description: "Match when depth >= 2 AND action includes write",
    enabled: true,
    priority: 1,
    condition: {
      delegationDepth: 2,
      permissionActions: ["write"],
    },
    effect: { decision: "deny", reasonCode: "test.depth_and_action" },
  };
  service.addRule(rule);

  // Depth is 3 (>=2) and action includes write - should match
  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext({ delegationDepth: 3 }),
    delegationSpec: createMockSpec({
      requiredPermissions: { resources: [], actions: ["read", "write"], constraints: {} },
    }),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "test.depth_and_action");
});

test("DelegationGovernanceService - empty condition should match always", () => {
  const service = new DelegationGovernanceService([]);
  const rule: GovernanceRule = {
    ruleId: "empty_condition_rule",
    name: "Empty Condition Rule",
    description: "Empty condition should match all",
    enabled: true,
    priority: 1,
    condition: {},
    effect: { decision: "allow", reasonCode: "test.empty_ok" },
  };
  service.addRule(rule);

  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext({ delegationDepth: 10 }), // Very deep
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  assert.equal(decision.decision, "allow");
});

test("DelegationGovernanceService - depth condition at boundary", () => {
  const service = new DelegationGovernanceService([]);
  const rule: GovernanceRule = {
    ruleId: "depth_boundary",
    name: "Depth Boundary",
    description: "Match when depth >= max_depth",
    enabled: true,
    priority: 1,
    condition: { delegationDepth: 5 },
    effect: { decision: "deny", reasonCode: "test.depth_boundary" },
  };
  service.addRule(rule);

  // At exactly depth 5 - should match (>= 5)
  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext({ delegationDepth: 5 }),
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  assert.equal(decision.decision, "deny");
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2186: addRule allows duplicate ruleId
// ─────────────────────────────────────────────────────────────────────────────

test("DelegationGovernanceService - addRule should reject duplicate ruleId", () => {
  const service = new DelegationGovernanceService([]);
  const rule1: GovernanceRule = {
    ruleId: "duplicate_test",
    name: "First Rule",
    description: "First rule with id",
    enabled: true,
    priority: 1,
    condition: {},
    effect: { decision: "allow", reasonCode: "test.first" },
  };

  service.addRule(rule1);

  // Attempt to add second rule with same ruleId
  const rule2: GovernanceRule = {
    ruleId: "duplicate_test", // Same ID
    name: "Second Rule",
    description: "Second rule with duplicate id",
    enabled: true,
    priority: 2,
    condition: {},
    effect: { decision: "deny", reasonCode: "test.duplicate" },
  };

  // The bug: addRule doesn't check for duplicates, so it adds both
  service.addRule(rule2);

  const rules = service.getRules();
  const duplicateRules = rules.filter((r) => r.ruleId === "duplicate_test");

  // Bug would result in 2 rules with same ID
  assert.equal(duplicateRules.length, 1, "Should only have one rule with duplicate_test id");
});

test("DelegationGovernanceService - addRule allows different ruleIds", () => {
  const service = new DelegationGovernanceService([]);

  service.addRule({
    ruleId: "unique_1",
    name: "Unique Rule 1",
    description: "First unique rule",
    enabled: true,
    priority: 1,
    condition: {},
    effect: { decision: "allow", reasonCode: "test.unique1" },
  });

  service.addRule({
    ruleId: "unique_2",
    name: "Unique Rule 2",
    description: "Second unique rule",
    enabled: true,
    priority: 2,
    condition: {},
    effect: { decision: "allow", reasonCode: "test.unique2" },
  });

  const rules = service.getRules();
  assert.equal(rules.length, 2);
});

test("DelegationGovernanceService - removeRule works for existing rule", () => {
  const service = new DelegationGovernanceService([]);

  service.addRule({
    ruleId: "removable",
    name: "Removable Rule",
    description: "Rule to remove",
    enabled: true,
    priority: 1,
    condition: {},
    effect: { decision: "allow", reasonCode: "test.removable" },
  });

  const removed = service.removeRule("removable");
  assert.equal(removed, true);

  const rules = service.getRules();
  assert.ok(!rules.some((r) => r.ruleId === "removable"));
});

test("DelegationGovernanceService - removeRule returns false for non-existent", () => {
  const service = new DelegationGovernanceService([]);
  const removed = service.removeRule("non_existent_rule");
  assert.equal(removed, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// GovernanceService priority ordering
// ─────────────────────────────────────────────────────────────────────────────

test("DelegationGovernanceService - rules evaluated in priority order", () => {
  const service = new DelegationGovernanceService([]);

  service.addRule({
    ruleId: "low_priority",
    name: "Low Priority",
    description: "Priority 100",
    enabled: true,
    priority: 100,
    condition: {},
    effect: { decision: "allow", reasonCode: "test.low_priority" },
  });

  service.addRule({
    ruleId: "high_priority",
    name: "High Priority",
    description: "Priority 1 - should trigger first",
    enabled: true,
    priority: 1,
    condition: {},
    effect: { decision: "deny", reasonCode: "test.high_priority" },
  });

  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext(),
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "test.high_priority");
});

test("DelegationGovernanceService - first matching deny stops evaluation", () => {
  const service = new DelegationGovernanceService([]);

  service.addRule({
    ruleId: "first_deny",
    name: "First Deny",
    description: "Should trigger and stop",
    enabled: true,
    priority: 1,
    condition: {},
    effect: { decision: "deny", reasonCode: "test.first_deny" },
  });

  service.addRule({
    ruleId: "second_deny",
    name: "Second Deny",
    description: "Should not trigger",
    enabled: true,
    priority: 2,
    condition: {},
    effect: { decision: "deny", reasonCode: "test.second_deny" },
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

test("DelegationGovernanceService - require_approval also stops evaluation", () => {
  const service = new DelegationGovernanceService([]);

  service.addRule({
    ruleId: "require_approval_rule",
    name: "Require Approval",
    description: "Should trigger and stop",
    enabled: true,
    priority: 1,
    condition: {},
    effect: { decision: "require_approval", reasonCode: "test.approval_required" },
  });

  service.addRule({
    ruleId: "allow_rule",
    name: "Allow",
    description: "Should not trigger",
    enabled: true,
    priority: 2,
    condition: {},
    effect: { decision: "allow", reasonCode: "test.allow" },
  });

  const request: DelegationGovernanceRequest = {
    parentContext: createMockContext(),
    delegationSpec: createMockSpec(),
    riskLevel: "low",
  };

  const decision = service.evaluate(request);
  assert.equal(decision.decision, "require_approval");
  assert.equal(decision.requiresApproval, true);
});