import assert from "node:assert/strict";
import test from "node:test";

import { ApprovalPolicyEngine } from "../../../../../../src/platform/control-plane/approval-center/approval-policy-engine/rule-engine.js";
import { DEFAULT_APPROVAL_POLICY_BUNDLE } from "../../../../../../src/platform/control-plane/approval-center/approval-policy-engine/types.js";

test("approval-policy-engine evaluates destructive action in supervised mode", () => {
  const engine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);
  const result = engine.evaluate({
    decisionId: "dec-001",
    taskId: "task-001",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "write_file",
    riskCategory: "destructive",
    mode: "supervised",
    stage: "execute",
  });

  assert.equal(result.requiresApproval, true);
  assert.equal(result.matchedRuleIds.includes("destructive-high-risk"), true);
});

test("approval-policy-engine evaluates prod-affecting action", () => {
  const engine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);
  const result = engine.evaluate({
    decisionId: "dec-002",
    taskId: "task-002",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "exec_command",
    riskCategory: "prod_affecting",
    mode: "auto",
    stage: "execute",
  });

  assert.equal(result.requiresApproval, true);
  assert.equal(result.matchedRuleIds.includes("prod-affecting-approval"), true);
});

test("approval-policy-engine evaluates high-cost action", () => {
  const engine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);
  const result = engine.evaluate({
    decisionId: "dec-003",
    taskId: "task-003",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
    estimatedCostUsd: 150,
  });

  assert.equal(result.requiresApproval, true);
  assert.equal(result.matchedRuleIds.includes("high-cost-approval"), true);
});

test("approval-policy-engine evaluates critical destructive in auto mode denies", () => {
  const engine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);
  const result = engine.evaluate({
    decisionId: "dec-004",
    taskId: "task-004",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "exec_command",
    riskCategory: "destructive",
    mode: "auto",
    stage: "execute",
  });

  assert.equal(result.deny, true);
  assert.equal(result.matchedRuleIds.includes("critical-action-deny"), true);
});

test("approval-policy-engine safe action requires no approval", () => {
  const engine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);
  const result = engine.evaluate({
    decisionId: "dec-005",
    taskId: "task-005",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "sensitive_data",
    mode: "auto",
    stage: "execute",
    estimatedCostUsd: 5,
  });

  assert.equal(result.requiresApproval, false);
  assert.equal(result.deny, false);
  assert.equal(result.matchedRuleIds.length, 0);
});

test("approval-policy-engine disabled bundle returns default result", () => {
  const disabledBundle = { ...DEFAULT_APPROVAL_POLICY_BUNDLE, enabled: false };
  const engine = new ApprovalPolicyEngine(disabledBundle);
  const result = engine.evaluate({
    decisionId: "dec-006",
    taskId: "task-006",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "write_file",
    riskCategory: "destructive",
    mode: "supervised",
    stage: "execute",
  });

  assert.equal(result.requiresApproval, false);
  assert.equal(result.reasonCode, "No active policy bundle.");
});

test("approval-policy-engine lint detects duplicate rule IDs", () => {
  const duplicateBundle = {
    ...DEFAULT_APPROVAL_POLICY_BUNDLE,
    rules: [
      ...DEFAULT_APPROVAL_POLICY_BUNDLE.rules,
      { ...DEFAULT_APPROVAL_POLICY_BUNDLE.rules[0]!, ruleId: "duplicate-rule" },
      { ...DEFAULT_APPROVAL_POLICY_BUNDLE.rules[1]!, ruleId: "duplicate-rule" },
    ],
  };
  const engine = new ApprovalPolicyEngine(duplicateBundle);
  const lintResult = engine.lint();
  assert.equal(lintResult.valid, false);
  assert.ok(lintResult.errors.some((e) => e.code === "duplicate_rule_id"));
});

test("approval-policy-engine lint detects invalid field references", () => {
  const invalidBundle = {
    ...DEFAULT_APPROVAL_POLICY_BUNDLE,
    rules: [
      {
        ruleId: "invalid-field-rule",
        description: "test",
        priority: 1,
        enabled: true,
        conditions: [{ field: "invalidField", operator: "eq", value: "test" }],
        action: "require_approval" as const,
      },
    ],
  };
  const engine = new ApprovalPolicyEngine(invalidBundle);
  const lintResult = engine.lint();
  assert.equal(lintResult.valid, false);
  assert.ok(lintResult.errors.some((e) => e.code === "invalid_field_reference"));
});

test("approval-policy-engine lint detects shadowed rules", () => {
  const shadowedBundle = {
    ...DEFAULT_APPROVAL_POLICY_BUNDLE,
    rules: [
      {
        ruleId: "high-priority-rule",
        description: "test",
        priority: 100,
        enabled: true,
        conditions: [{ field: "riskCategory", operator: "eq", value: "destructive" }],
        action: "require_approval" as const,
      },
      {
        ruleId: "shadowed-rule",
        description: "test",
        priority: 50,
        enabled: true,
        conditions: [
          { field: "riskCategory", operator: "eq", value: "destructive" },
          { field: "mode", operator: "eq", value: "supervised" },
        ],
        action: "require_approval" as const,
      },
    ],
  };
  const engine = new ApprovalPolicyEngine(shadowedBundle);
  const lintResult = engine.lint();
  assert.ok(lintResult.warnings.some((w) => w.code === "shadowed_rule"));
});

test("approval-policy-engine lint detects empty conditions", () => {
  const emptyConditionsBundle = {
    ...DEFAULT_APPROVAL_POLICY_BUNDLE,
    rules: [
      {
        ruleId: "empty-conditions-rule",
        description: "test",
        priority: 1,
        enabled: true,
        conditions: [],
        action: "require_approval" as const,
      },
    ],
  };
  const engine = new ApprovalPolicyEngine(emptyConditionsBundle);
  const lintResult = engine.lint();
  assert.ok(lintResult.warnings.some((w) => w.code === "empty_conditions"));
});

test("approval-policy-engine condition logic OR", () => {
  const orBundle = {
    ...DEFAULT_APPROVAL_POLICY_BUNDLE,
    rules: [
      {
        ruleId: "or-logic-rule",
        description: "test OR logic",
        priority: 50,
        enabled: true,
        conditions: [
          { field: "riskCategory", operator: "eq", value: "destructive" },
          { field: "mode", operator: "eq", value: "full-auto" },
        ],
        conditionLogic: "or" as const,
        action: "allow" as const,
      },
    ],
  };
  const engine = new ApprovalPolicyEngine(orBundle);

  // Should match because mode is full-auto (OR logic)
  const result = engine.evaluate({
    decisionId: "dec-007",
    taskId: "task-007",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "sensitive_data",
    mode: "full-auto",
    stage: "execute",
  });
  assert.equal(result.requiresApproval, false);
  assert.equal(result.matchedRuleIds.includes("or-logic-rule"), true);
});

test("approval-policy-engine operators work correctly", () => {
  const operatorsBundle = {
    ...DEFAULT_APPROVAL_POLICY_BUNDLE,
    rules: [
      {
        ruleId: "in-operator-rule",
        description: "test IN operator",
        priority: 50,
        enabled: true,
        conditions: [{ field: "action", operator: "in", value: ["write_file", "exec_command"] }],
        action: "deny" as const,
      },
    ],
  };
  const engine = new ApprovalPolicyEngine(operatorsBundle);

  const result = engine.evaluate({
    decisionId: "dec-008",
    taskId: "task-008",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "write_file",
    riskCategory: "sensitive_data",
    mode: "auto",
    stage: "execute",
  });
  assert.equal(result.deny, true);
});

test("approval-policy-engine gte operator works", () => {
  const gteBundle = {
    ...DEFAULT_APPROVAL_POLICY_BUNDLE,
    rules: [
      {
        ruleId: "gte-rule",
        description: "test GTE",
        priority: 50,
        enabled: true,
        conditions: [{ field: "estimatedCostUsd", operator: "gte", value: 100 }],
        action: "require_approval" as const,
      },
    ],
  };
  const engine = new ApprovalPolicyEngine(gteBundle);

  const result = engine.evaluate({
    decisionId: "dec-009",
    taskId: "task-009",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
    estimatedCostUsd: 100,
  });
  assert.equal(result.requiresApproval, true);
});

test("approval-policy-engine metadata field access", () => {
  const metadataBundle = {
    ...DEFAULT_APPROVAL_POLICY_BUNDLE,
    rules: [
      {
        ruleId: "metadata-rule",
        description: "test metadata field access",
        priority: 50,
        enabled: true,
        conditions: [{ field: "metadata.environment", operator: "eq", value: "production" }],
        action: "require_approval" as const,
      },
    ],
  };
  const engine = new ApprovalPolicyEngine(metadataBundle);

  const result = engine.evaluate({
    decisionId: "dec-010",
    taskId: "task-010",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
    metadata: { environment: "production" },
  });
  assert.equal(result.requiresApproval, true);
});

test("approval-policy-engine require_multi_party_approval action", () => {
  const multiPartyBundle = {
    ...DEFAULT_APPROVAL_POLICY_BUNDLE,
    rules: [
      {
        ruleId: "multi-party-rule",
        description: "test multi-party",
        priority: 50,
        enabled: true,
        conditions: [{ field: "riskCategory", operator: "eq", value: "org_changing" }],
        action: "require_multi_party_approval" as const,
        requiredApprovals: 3,
        approverGroups: ["admin", "security"],
      },
    ],
  };
  const engine = new ApprovalPolicyEngine(multiPartyBundle);

  const result = engine.evaluate({
    decisionId: "dec-011",
    taskId: "task-011",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "org_change",
    riskCategory: "org_changing",
    mode: "auto",
    stage: "execute",
  });
  assert.equal(result.requiresApproval, true);
  assert.equal(result.requireMultiParty, true);
  assert.equal(result.requiredApprovals, 3);
  assert.deepEqual(result.approverGroups, ["admin", "security"]);
});