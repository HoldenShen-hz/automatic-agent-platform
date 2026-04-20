import assert from "node:assert/strict";
import test from "node:test";

import {
  PolicyEngine,
  mapToolRiskToPolicyCategory,
  type PolicyDecisionRequest,
} from "../../../../../src/platform/control-plane/iam/policy-engine.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

const createMockBudgetPolicy = (): import("../../../../../src/platform/model-gateway/cost-tracker/budget-guard.js").BudgetPolicy => ({
  maxTaskCostUsd: 10,
  maxDailyCostUsd: 1000,
  maxMonthlyCostUsd: 10000,
  warnAtRatio: 0.8,
  mode: "supervised",
});

const createValidRequest = (overrides: Partial<PolicyDecisionRequest> = {}): PolicyDecisionRequest => ({
  decisionId: "dec_123",
  taskId: "task_456",
  subjectType: "agent",
  subjectId: "worker_789",
  action: "invoke_tool",
  riskCategory: "sensitive_data",
  mode: "supervised",
  ...overrides,
});

test("PolicyEngine.evaluate throws for empty decisionId", () => {
  const engine = new PolicyEngine({ budgetPolicy: createMockBudgetPolicy() });
  const request = createValidRequest({ decisionId: "" });
  assert.throws(
    () => engine.evaluate(request),
    (e: any) => e.code === "policy.invalid_decision_id" && e instanceof ValidationError,
  );
});

test("PolicyEngine.evaluate throws for empty taskId", () => {
  const engine = new PolicyEngine({ budgetPolicy: createMockBudgetPolicy() });
  const request = createValidRequest({ taskId: "   " });
  assert.throws(
    () => engine.evaluate(request),
    (e: any) => e.code === "policy.invalid_task_id" && e instanceof ValidationError,
  );
});

test("PolicyEngine.evaluate throws for empty subjectId", () => {
  const engine = new PolicyEngine({ budgetPolicy: createMockBudgetPolicy() });
  const request = createValidRequest({ subjectId: "" });
  assert.throws(
    () => engine.evaluate(request),
    (e: any) => e.code === "policy.invalid_subject_id" && e instanceof ValidationError,
  );
});

test("PolicyEngine.evaluate throws for invalid action", () => {
  const engine = new PolicyEngine({ budgetPolicy: createMockBudgetPolicy() });
  const request = createValidRequest({ action: null as any });
  assert.throws(
    () => engine.evaluate(request),
    (e: any) => e.code === "policy.invalid_action",
  );
});

test("PolicyEngine.evaluate throws for invalid riskCategory", () => {
  const engine = new PolicyEngine({ budgetPolicy: createMockBudgetPolicy() });
  const request = createValidRequest({ riskCategory: null as any });
  assert.throws(
    () => engine.evaluate(request),
    (e: any) => e.code === "policy.invalid_risk_category",
  );
});

test("PolicyEngine.evaluate throws for invalid mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: createMockBudgetPolicy() });
  const request = createValidRequest({ mode: null as any });
  assert.throws(
    () => engine.evaluate(request),
    (e: any) => e.code === "policy.invalid_mode",
  );
});

test("PolicyEngine.evaluate denies when kill switch is enabled", () => {
  const engine = new PolicyEngine({ budgetPolicy: createMockBudgetPolicy(), killSwitchEnabled: true });
  const request = createValidRequest();
  const result = engine.evaluate(request);
  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.kill_switch_active");
  assert.equal(result.killSwitchApplied, true);
});

test("PolicyEngine.evaluate denies when budget exceeded", () => {
  const engine = new PolicyEngine({ budgetPolicy: createMockBudgetPolicy() });
  const request = createValidRequest({
    estimatedCostUsd: 100,
    metadata: { currentTaskCostUsd: 0 },
  });
  const result = engine.evaluate(request);
  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "budget.task_limit_exceeded");
  assert.equal(result.killSwitchApplied, false);
});

test("PolicyEngine.evaluate escalates high-risk in supervised mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: createMockBudgetPolicy() });
  const request = createValidRequest({
    riskCategory: "destructive",
    mode: "supervised",
    metadata: { currentTaskCostUsd: 0 },
  });
  const result = engine.evaluate(request);
  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.reasonCode, "policy.supervised_escalation");
  assert.equal(result.requiresApproval, true);
});

test("PolicyEngine.evaluate escalates irreversible in supervised mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: createMockBudgetPolicy() });
  const request = createValidRequest({
    riskCategory: "irreversible",
    mode: "supervised",
    metadata: { currentTaskCostUsd: 0 },
  });
  const result = engine.evaluate(request);
  assert.equal(result.decision, "escalate_for_approval");
});

test("PolicyEngine.evaluate escalates prod_affecting in supervised mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: createMockBudgetPolicy() });
  const request = createValidRequest({
    riskCategory: "prod_affecting",
    mode: "supervised",
    metadata: { currentTaskCostUsd: 0 },
  });
  const result = engine.evaluate(request);
  assert.equal(result.decision, "escalate_for_approval");
});

test("PolicyEngine.evaluate escalates org_changing in supervised mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: createMockBudgetPolicy() });
  const request = createValidRequest({
    riskCategory: "org_changing",
    mode: "supervised",
    metadata: { currentTaskCostUsd: 0 },
  });
  const result = engine.evaluate(request);
  assert.equal(result.decision, "escalate_for_approval");
});

test("PolicyEngine.evaluate escalates high-risk in auto mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: createMockBudgetPolicy() });
  const request = createValidRequest({
    riskCategory: "destructive",
    mode: "auto",
    metadata: { currentTaskCostUsd: 0 },
  });
  const result = engine.evaluate(request);
  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.reasonCode, "policy.high_risk_requires_approval");
});

test("PolicyEngine.evaluate allows low-risk in supervised mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: createMockBudgetPolicy() });
  const request = createValidRequest({
    riskCategory: "sensitive_data",
    mode: "supervised",
    metadata: { currentTaskCostUsd: 0 },
  });
  const result = engine.evaluate(request);
  assert.equal(result.decision, "allow_with_constraints");
  assert.equal(result.reasonCode, "policy.allow");
});

test("PolicyEngine.evaluate allows in full-auto mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: createMockBudgetPolicy() });
  const request = createValidRequest({
    riskCategory: "destructive",
    mode: "full-auto",
    metadata: { currentTaskCostUsd: 0 },
  });
  const result = engine.evaluate(request);
  // full-auto mode doesn't require approval for high-risk
  assert.equal(result.decision, "allow_with_constraints");
});

test("PolicyEngine.evaluate allows under budget warning", () => {
  const engine = new PolicyEngine({ budgetPolicy: createMockBudgetPolicy() });
  const request = createValidRequest({
    estimatedCostUsd: 1,
    mode: "auto",
    metadata: { currentTaskCostUsd: 8 }, // 80% of budget
  });
  const result = engine.evaluate(request);
  assert.equal(result.decision, "allow_with_constraints");
});

test("PolicyEngine.evaluate includes audit payload", () => {
  const engine = new PolicyEngine({ budgetPolicy: createMockBudgetPolicy() });
  const request = createValidRequest({
    metadata: { currentTaskCostUsd: 0 },
  });
  const result = engine.evaluate(request);
  assert.ok(result.auditPayload);
  assert.equal(result.auditPayload.action, request.action);
});

test("PolicyEngine.evaluate returns correct policy version", () => {
  const engine = new PolicyEngine({ budgetPolicy: createMockBudgetPolicy() });
  const request = createValidRequest({ metadata: { currentTaskCostUsd: 0 } });
  const result = engine.evaluate(request);
  assert.equal(result.evaluatedPolicyVersion, "authoritative.v1");
});

test("mapToolRiskToPolicyCategory maps critical to prod_affecting", () => {
  assert.equal(mapToolRiskToPolicyCategory("critical"), "prod_affecting");
});

test("mapToolRiskToPolicyCategory maps high to destructive", () => {
  assert.equal(mapToolRiskToPolicyCategory("high"), "destructive");
});

test("mapToolRiskToPolicyCategory maps medium to cost_sensitive", () => {
  assert.equal(mapToolRiskToPolicyCategory("medium"), "cost_sensitive");
});

test("mapToolRiskToPolicyCategory maps low to sensitive_data", () => {
  assert.equal(mapToolRiskToPolicyCategory("low"), "sensitive_data");
});

test("PolicyEngine.evaluate handles all action types", () => {
  const engine = new PolicyEngine({ budgetPolicy: createMockBudgetPolicy() });
  const actions: PolicyDecisionRequest["action"][] = [
    "invoke_model",
    "invoke_tool",
    "write_file",
    "exec_command",
    "network_access",
    "install_extension",
    "org_change",
  ];
  for (const action of actions) {
    const request = createValidRequest({ action, metadata: { currentTaskCostUsd: 0 } });
    const result = engine.evaluate(request);
    assert.ok(result.decision !== undefined, `Action ${action} should produce a decision`);
  }
});
