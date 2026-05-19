import assert from "node:assert/strict";
import test from "node:test";

import { PolicyEngine, mapToolRiskToPolicyCategory } from "../../../../../../src/platform/control-plane/iam/policy-engine.js";

function createTestBudgetPolicy() {
  return {
    scope: "platform" as const,
    scopeId: "test-platform",
    limitCostUsd: 1000,
    limitTokens: 100000,
    warningThreshold: 0.8,
    period: "monthly" as const,
    actionsOnWarning: [],
    actionsOnBreach: [],
  };
}

test("policy-engine evaluates simple allow request", () => {
  const engine = new PolicyEngine({ budgetPolicy: createTestBudgetPolicy() });
  const request = {
    decisionId: "dec-001",
    taskId: "task-001",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
  };

  const result = engine.evaluate(request);
  assert.ok(["allow", "allow_with_constraints", "escalate_for_approval"].includes(result.decision));
  assert.equal(result.killSwitchApplied, false);
});

test("policy-engine denies when budget exceeded", () => {
  const policy = createTestBudgetPolicy();
  policy.limitCostUsd = 0.01;
  const engine = new PolicyEngine({ budgetPolicy: policy });
  const request = {
    decisionId: "dec-002",
    taskId: "task-002",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    estimatedCostUsd: 100,
  };

  const result = engine.evaluate(request);
  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "budget.denied");
});

test("policy-engine kill switch denies all actions", () => {
  const engine = new PolicyEngine({
    budgetPolicy: createTestBudgetPolicy(),
    killSwitchEnabled: true,
  });
  const request = {
    decisionId: "dec-003",
    taskId: "task-003",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
  };

  const result = engine.evaluate(request);
  assert.equal(result.decision, "deny");
  assert.equal(result.killSwitchApplied, true);
  assert.equal(result.reasonCode, "policy.kill_switch_active");
});

test("policy-engine high-risk in supervised mode escalates", () => {
  const engine = new PolicyEngine({ budgetPolicy: createTestBudgetPolicy() });
  const request = {
    decisionId: "dec-004",
    taskId: "task-004",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "write_file",
    riskCategory: "destructive",
    mode: "supervised",
  };

  const result = engine.evaluate(request);
  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.requiresApproval, true);
});

test("policy-engine high-risk in auto mode escalates", () => {
  const engine = new PolicyEngine({ budgetPolicy: createTestBudgetPolicy() });
  const request = {
    decisionId: "dec-005",
    taskId: "task-005",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "write_file",
    riskCategory: "destructive",
    mode: "auto",
  };

  const result = engine.evaluate(request);
  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.requiresApproval, true);
});

test("policy-engine validates decisionId", () => {
  const engine = new PolicyEngine({ budgetPolicy: createTestBudgetPolicy() });
  assert.throws(
    () => {
      engine.evaluate({
        decisionId: "",
        taskId: "task-001",
        subjectType: "agent",
        subjectId: "agent-1",
        action: "invoke_model",
        riskCategory: "cost_sensitive",
        mode: "auto",
      });
    },
    Error,
    "ValidationError",
  );
});

test("policy-engine validates taskId", () => {
  const engine = new PolicyEngine({ budgetPolicy: createTestBudgetPolicy() });
  assert.throws(
    () => {
      engine.evaluate({
        decisionId: "dec-001",
        taskId: "",
        subjectType: "agent",
        subjectId: "agent-1",
        action: "invoke_model",
        riskCategory: "cost_sensitive",
        mode: "auto",
      });
    },
    Error,
    "ValidationError",
  );
});

test("mapToolRiskToPolicyCategory maps correctly", () => {
  assert.equal(mapToolRiskToPolicyCategory("critical"), "prod_affecting");
  assert.equal(mapToolRiskToPolicyCategory("high"), "destructive");
  assert.equal(mapToolRiskToPolicyCategory("medium"), "cost_sensitive");
  assert.equal(mapToolRiskToPolicyCategory("low"), "sensitive_data");
});