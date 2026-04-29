/**
 * Integration Tests: Policy Center
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  PolicyCenterService,
  type PolicyDecisionRequest,
  PolicyMode,
} from "../../../../../src/platform/five-plane-control-plane/policy-center/index.js";

// ============================================================================
// Policy Center End-to-End Integration Tests
// ============================================================================

test("integration: policy request lifecycle through modes", () => {
  const service = new PolicyCenterService();

  const requestBase = {
    taskId: "task_policy_001",
    subjectType: "user" as const,
    subjectId: "user_001",
    action: "invoke_model" as const,
    riskCategory: "cost_sensitive" as const,
    stage: "execute" as const,
  };

  const autoResult = service.evaluate({ ...requestBase, decisionId: "dec_1", mode: "auto" as PolicyMode });
  assert.equal(autoResult.decision, "allow");

  const supervisedResult = service.evaluate({ ...requestBase, decisionId: "dec_2", mode: "supervised" as PolicyMode });
  assert.equal(supervisedResult.decision, "allow");

  const fullAutoResult = service.evaluate({ ...requestBase, decisionId: "dec_3", mode: "full-auto" as PolicyMode });
  assert.equal(fullAutoResult.decision, "allow");

  const readOnlyResult = service.evaluate({ ...requestBase, decisionId: "dec_4", mode: "read_only" as PolicyMode });
  assert.equal(readOnlyResult.decision, "allow");
});

test("integration: high-risk action escalates through modes", () => {
  const service = new PolicyCenterService();

  const highRiskRequest: PolicyDecisionRequest = {
    decisionId: "dec_risk_001",
    taskId: "task_risk_001",
    subjectType: "user",
    subjectId: "user_001",
    action: "dispatch_execution",
    riskCategory: "prod_affecting",
    mode: "auto",
    stage: "execute",
  };

  const autoResult = service.evaluate(highRiskRequest);
  assert.equal(autoResult.requiresApproval, true);
  assert.equal(autoResult.decision, "escalate_for_approval");

  const incidentModeRequest = { ...highRiskRequest, decisionId: "dec_risk_002", mode: "incident-mode" as PolicyMode };
  const incidentResult = service.evaluate(incidentModeRequest);
  assert.equal(incidentResult.requiresApproval, true);
});

test("integration: kill switch affects all decisions", () => {
  const service = new PolicyCenterService({ killSwitchEnabled: true });

  const requests: PolicyDecisionRequest[] = [
    { decisionId: "dec_kill_1", taskId: "task_1", subjectType: "user", subjectId: "user_1", action: "invoke_model", riskCategory: "cost_sensitive", mode: "auto", stage: "execute" },
    { decisionId: "dec_kill_2", taskId: "task_2", subjectType: "user", subjectId: "user_1", action: "read_file", riskCategory: "low", mode: "auto", stage: "execute" },
    { decisionId: "dec_kill_3", taskId: "task_3", subjectType: "user", subjectId: "user_1", action: "write_file", riskCategory: "medium", mode: "auto", stage: "execute" },
  ];

  const results = requests.map((req) => service.evaluate(req));

  assert.ok(results.every((r) => r.decision === "deny"));
  assert.ok(results.every((r) => r.killSwitchApplied === true));
});

test("integration: frozen actions block regardless of risk", () => {
  const service = new PolicyCenterService({ frozenActions: ["install_extension"] });

  const request: PolicyDecisionRequest = {
    decisionId: "dec_frozen_001",
    taskId: "task_frozen_001",
    subjectType: "user",
    subjectId: "user_001",
    action: "install_extension",
    riskCategory: "low",
    mode: "auto",
    stage: "execute",
  };

  const result = service.evaluate(request);

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.action_frozen");
});

test("integration: budget limits enforced with warnings", () => {
  const service = new PolicyCenterService({
    budgetWarningCostUsd: 5,
    maxEstimatedCostUsd: 10,
  });

  const lowCostRequest: PolicyDecisionRequest = {
    decisionId: "dec_budget_1",
    taskId: "task_budget_1",
    subjectType: "user",
    subjectId: "user_001",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
    estimatedCostUsd: 3,
  };

  const warningRequest: PolicyDecisionRequest = {
    decisionId: "dec_budget_2",
    taskId: "task_budget_2",
    subjectType: "user",
    subjectId: "user_001",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
    estimatedCostUsd: 7,
  };

  const exceededRequest: PolicyDecisionRequest = {
    decisionId: "dec_budget_3",
    taskId: "task_budget_3",
    subjectType: "user",
    subjectId: "user_001",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
    estimatedCostUsd: 15,
  };

  const lowResult = service.evaluate(lowCostRequest);
  const warningResult = service.evaluate(warningRequest);
  const exceededResult = service.evaluate(exceededRequest);

  assert.equal(lowResult.requiresApproval, false);
  assert.equal(warningResult.requiresApproval, true);
  assert.equal(exceededResult.decision, "deny");
});

test("integration: emergency mode break-glass workflow", () => {
  const service = new PolicyCenterService();

  const normalRequest: PolicyDecisionRequest = {
    decisionId: "dec_emergency_1",
    taskId: "task_emergency_1",
    subjectType: "user",
    subjectId: "user_001",
    action: "dispatch_execution",
    riskCategory: "prod_affecting",
    mode: "emergency",
    stage: "execute",
  };

  const systemRequest: PolicyDecisionRequest = {
    decisionId: "dec_emergency_2",
    taskId: "task_emergency_2",
    subjectType: "system",
    subjectId: "system",
    action: "dispatch_execution",
    riskCategory: "prod_affecting",
    mode: "emergency",
    stage: "execute",
  };

  const userResult = service.evaluate(normalRequest);
  const systemResult = service.evaluate(systemRequest);

  assert.equal(userResult.requiresApproval, true);
  assert.equal(userResult.enforcedConstraints.breakGlass, true);
  assert.equal(systemResult.requiresApproval, false);
});

test("integration: role-based access control", () => {
  const service = new PolicyCenterService({
    subjectRoles: {
      developer: ["invoke_model", "read_file", "write_file"],
      admin: ["invoke_model", "read_file", "write_file", "dispatch_execution", "org_change"],
    },
    allowedActionsByRole: {
      developer: ["invoke_model", "read_file", "write_file"],
      admin: ["invoke_model", "read_file", "write_file", "dispatch_execution", "org_change"],
    },
  });

  const devRequest: PolicyDecisionRequest = {
    decisionId: "dec_role_1",
    taskId: "task_role_1",
    subjectType: "user",
    subjectId: "user_developer",
    action: "dispatch_execution",
    riskCategory: "prod_affecting",
    mode: "auto",
    stage: "execute",
  };

  const adminRequest: PolicyDecisionRequest = {
    decisionId: "dec_role_2",
    taskId: "task_role_2",
    subjectType: "user",
    subjectId: "user_admin",
    action: "dispatch_execution",
    riskCategory: "prod_affecting",
    mode: "auto",
    stage: "execute",
  };

  const devResult = service.evaluate(devRequest);
  const adminResult = service.evaluate(adminRequest);

  assert.equal(devResult.decision, "deny");
  assert.equal(adminResult.decision, "allow");
});
