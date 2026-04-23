import assert from "node:assert/strict";
import test from "node:test";

import { PolicyEngine, mapToolRiskToPolicyCategory, type PolicyDecisionRequest } from "../../../../../src/platform/control-plane/iam/policy-engine.js";
import type { BudgetPolicy } from "../../../../../src/platform/model-gateway/cost-tracker/budget-guard.js";

function makeRequest(overrides: Partial<PolicyDecisionRequest> = {}): PolicyDecisionRequest {
  return {
    decisionId: "decision-001",
    taskId: "task-001",
    subjectType: "agent",
    subjectId: "agent-001",
    action: "invoke_tool",
    riskCategory: "sensitive_data",
    mode: "auto",
    ...overrides,
  };
}

function makeBudgetPolicy(overrides: Partial<BudgetPolicy> = {}): BudgetPolicy {
  return {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "auto",
    ...overrides,
  };
}

test("PolicyEngine.evaluate throws ValidationError for empty decisionId", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  assert.throws(
    () => engine.evaluate(makeRequest({ decisionId: "" })),
    (err: any) => err.message.includes("policy.invalid_decision_id"),
  );
});

test("PolicyEngine.evaluate throws ValidationError for empty taskId", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  assert.throws(
    () => engine.evaluate(makeRequest({ taskId: "" })),
    (err: any) => err.message.includes("policy.invalid_task_id"),
  );
});

test("PolicyEngine.evaluate throws ValidationError for empty subjectId", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  assert.throws(
    () => engine.evaluate(makeRequest({ subjectId: "" })),
    (err: any) => err.message.includes("policy.invalid_subject_id"),
  );
});

test("PolicyEngine.evaluate throws ValidationError for invalid action", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  assert.throws(
    () => engine.evaluate(makeRequest({ action: "" as any })),
    (err: any) => err.message.includes("policy.invalid_action"),
  );
});

test("PolicyEngine.evaluate throws ValidationError for invalid riskCategory", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  assert.throws(
    () => engine.evaluate(makeRequest({ riskCategory: "" as any })),
    (err: any) => err.message.includes("policy.invalid_risk_category"),
  );
});

test("PolicyEngine.evaluate throws ValidationError for invalid mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  assert.throws(
    () => engine.evaluate(makeRequest({ mode: "" as any })),
    (err: any) => err.message.includes("policy.invalid_mode"),
  );
});

test("PolicyEngine.evaluate returns deny when kill switch is active", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy(), killSwitchEnabled: true });
  const result = engine.evaluate(makeRequest());
  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.kill_switch_active");
  assert.equal(result.killSwitchApplied, true);
});

test("PolicyEngine.evaluate returns deny when task budget would be exceeded", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy({ maxTaskCostUsd: 1 }) });
  const result = engine.evaluate(makeRequest({ estimatedCostUsd: 5 }));
  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "budget.task_limit_exceeded");
  assert.equal(result.killSwitchApplied, false);
});

test("PolicyEngine.evaluate returns allow_with_constraints for normal execution", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy({ maxTaskCostUsd: 10 }) });
  const result = engine.evaluate(makeRequest({ estimatedCostUsd: 1 }));
  assert.equal(result.decision, "allow_with_constraints");
  assert.equal(result.reasonCode, "policy.allow");
  assert.equal(result.requiresApproval, false);
  assert.equal(result.killSwitchApplied, false);
});

test("PolicyEngine.evaluate escalates high-risk action in supervised mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({ mode: "supervised", riskCategory: "destructive", estimatedCostUsd: 1 }),
  );
  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.requiresApproval, true);
  assert.equal(result.reasonCode, "policy.supervised_escalation");
});

test("PolicyEngine.evaluate escalates irreversible action in supervised mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({ mode: "supervised", riskCategory: "irreversible", estimatedCostUsd: 1 }),
  );
  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.requiresApproval, true);
});

test("PolicyEngine.evaluate escalates prod_affecting action in supervised mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({ mode: "supervised", riskCategory: "prod_affecting", estimatedCostUsd: 1 }),
  );
  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.requiresApproval, true);
});

test("PolicyEngine.evaluate escalates org_changing action in supervised mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({ mode: "supervised", riskCategory: "org_changing", estimatedCostUsd: 1 }),
  );
  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.requiresApproval, true);
});

test("PolicyEngine.evaluate escalates high-risk action in auto mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({ mode: "auto", riskCategory: "destructive", estimatedCostUsd: 1 }),
  );
  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.requiresApproval, true);
  assert.equal(result.reasonCode, "policy.high_risk_requires_approval");
});

test("PolicyEngine.evaluate allows non-high-risk action in auto mode without escalation", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({ mode: "auto", riskCategory: "sensitive_data", estimatedCostUsd: 1 }),
  );
  assert.equal(result.decision, "allow_with_constraints");
  assert.equal(result.requiresApproval, false);
});

test("PolicyEngine.evaluate allows high-risk action in full-auto mode without approval", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({ mode: "full-auto", riskCategory: "destructive", estimatedCostUsd: 1 }),
  );
  assert.equal(result.decision, "allow_with_constraints");
  assert.equal(result.requiresApproval, false);
});

test("PolicyEngine.evaluate returns allow_under_budget_warning when approaching limit", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy({ maxTaskCostUsd: 10, warnAtRatio: 0.8 }) });
  const result = engine.evaluate(makeRequest({ estimatedCostUsd: 8.5 }));
  assert.equal(result.decision, "allow_with_constraints");
  assert.equal(result.reasonCode, "policy.allow_under_budget_warning");
});

test("PolicyEngine.evaluate includes remainingBudgetUsd in enforcedConstraints", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy({ maxTaskCostUsd: 10 }) });
  const result = engine.evaluate(makeRequest({ estimatedCostUsd: 1 }));
  assert.equal(typeof result.enforcedConstraints.remainingBudgetUsd, "number");
});

test("PolicyEngine.evaluate sets correct evaluatedPolicyVersion", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(makeRequest());
  assert.equal(result.evaluatedPolicyVersion, "authoritative.v1");
});

test("PolicyEngine.evaluate uses currentTaskCostUsd from metadata for budget check", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy({ maxTaskCostUsd: 5 }) });
  const result = engine.evaluate(
    makeRequest({ estimatedCostUsd: 1, metadata: { currentTaskCostUsd: 4 } }),
  );
  // 4 + 1 = 5 which equals max, so still allowed but requires approval
  assert.equal(result.decision, "allow_with_constraints");
});

test("PolicyEngine.evaluate uses default estimatedCostUsd when not provided", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy({ maxTaskCostUsd: 10 }) });
  // Do not pass estimatedCostUsd - use default factory behavior
  const result = engine.evaluate({
    decisionId: "decision-001",
    taskId: "task-001",
    subjectType: "agent",
    subjectId: "agent-001",
    action: "invoke_tool",
    riskCategory: "sensitive_data",
    mode: "auto",
  });
  assert.equal(result.decision, "allow_with_constraints");
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

test("mapToolRiskToPolicyCategory maps low/other to sensitive_data", () => {
  assert.equal(mapToolRiskToPolicyCategory("low"), "sensitive_data");
  assert.equal(mapToolRiskToPolicyCategory("unknown" as any), "sensitive_data");
});

test("PolicyEngine.evaluate includes auditPayload with action and riskCategory", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(makeRequest({ action: "exec_command", riskCategory: "destructive" }));
  assert.equal(result.auditPayload.action, "exec_command");
  assert.equal(result.auditPayload.riskCategory, "destructive");
});

test("PolicyEngine.evaluate handles exec_command as high-risk action in supervised mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({ mode: "supervised", action: "exec_command", riskCategory: "destructive" }),
  );
  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.requiresApproval, true);
});

test("PolicyEngine.evaluate handles install_extension as org_changing in supervised mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({ mode: "supervised", action: "install_extension", riskCategory: "org_changing" }),
  );
  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.requiresApproval, true);
});