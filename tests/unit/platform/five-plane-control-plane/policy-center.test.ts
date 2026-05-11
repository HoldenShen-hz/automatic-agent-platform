import assert from "node:assert/strict";
import test from "node:test";

import {
  PolicyCenterService,
  type PolicyDecisionRequest,
} from "../../../../src/platform/five-plane-control-plane/policy-center/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";

function createTestRequest(overrides: Partial<PolicyDecisionRequest> = {}): PolicyDecisionRequest {
  return {
    decisionId: newId("decision"),
    taskId: newId("task"),
    subjectType: "agent",
    subjectId: "agent-001",
    action: "invoke_tool",
    riskCategory: "destructive",
    mode: "auto",
    stage: "execute",
    ...overrides,
  };
}

test("PolicyCenterService denies all actions when the kill switch is enabled", () => {
  const service = new PolicyCenterService({ killSwitchEnabled: true });
  const result = service.evaluate(createTestRequest());

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.kill_switch_active");
  assert.equal(result.killSwitchApplied, true);
});

test("PolicyCenterService blocks mutating actions in read-only mode", () => {
  const service = new PolicyCenterService();
  const result = service.evaluate(createTestRequest({ mode: "read-only", action: "write_file" }));

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.read_only_mode_denied");
  assert.equal(result.matchedRuleRefs.includes("mode.read_only"), true);
});

test("PolicyCenterService allows non-mutating actions in read-only mode with constraints", () => {
  const service = new PolicyCenterService();
  const result = service.evaluate(createTestRequest({ mode: "read-only", action: "invoke_model", riskCategory: "cost_sensitive" }));

  assert.equal(result.decision, "allow_with_constraints");
  assert.equal(result.enforcedConstraints.sideEffectsAllowed, false);
});

test("PolicyCenterService escalates destructive work in incident mode", () => {
  const service = new PolicyCenterService();
  const result = service.evaluate(createTestRequest({ mode: "incident-mode", riskCategory: "destructive" }));

  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.requiresApproval, true);
  assert.equal(result.enforcedConstraints.changeFreeze, true);
  assert.equal(result.enforcedConstraints.evidenceLevel, "full");
});

test("PolicyCenterService allows cost-sensitive work in incident mode without approval", () => {
  const service = new PolicyCenterService({
    approvalRequiredRiskCategories: ["destructive", "irreversible", "governance_sensitive"],
  });
  const result = service.evaluate(createTestRequest({ mode: "incident-mode", riskCategory: "cost_sensitive" }));

  assert.equal(result.decision, "allow_with_constraints");
  assert.equal(result.requiresApproval, false);
});

test("PolicyCenterService preserves the full-auto escalation exception for non-sensitive risk", () => {
  const service = new PolicyCenterService();
  const result = service.evaluate(createTestRequest({ mode: "full-auto", riskCategory: "cost_sensitive" }));

  assert.equal(result.decision, "allow");
});

test("PolicyCenterService still escalates governance-sensitive work in full-auto mode", () => {
  const service = new PolicyCenterService();
  const result = service.evaluate(createTestRequest({ mode: "full-auto", riskCategory: "governance_sensitive" }));

  assert.equal(result.decision, "escalate_for_approval");
});

test("PolicyCenterService applies path and network scope constraints", () => {
  const service = new PolicyCenterService({
    allowedPathPrefixes: ["/workspace/project"],
    allowedNetworkHosts: ["api.example.com"],
  });

  const pathDenied = service.evaluate(createTestRequest({
    action: "write_file",
    resourceRef: "/tmp/outside.txt",
    riskCategory: "cost_sensitive",
  }));
  const networkAllowed = service.evaluate(createTestRequest({
    action: "network_access",
    resourceRef: "https://api.example.com/endpoint",
    riskCategory: "cost_sensitive",
  }));

  assert.equal(pathDenied.reasonCode, "policy.path_scope_denied");
  assert.equal(networkAllowed.decision, "allow_with_constraints");
  assert.deepEqual(networkAllowed.enforcedConstraints.allowedNetworkHosts, ["api.example.com"]);
});

test("PolicyCenterService returns allow_with_constraints for budget warnings", () => {
  const service = new PolicyCenterService({ budgetWarningCostUsd: 50 });
  const result = service.evaluate(createTestRequest({
    estimatedCostUsd: 75,
    action: "invoke_model",
    riskCategory: "cost_sensitive",
  }));

  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.requiresApproval, true);
  assert.equal(result.enforcedConstraints.budgetWarningCostUsd, 50);
});

test("PolicyCenterService validates required request fields", () => {
  const service = new PolicyCenterService();

  assert.throws(
    () => service.evaluate(createTestRequest({ decisionId: "" })),
    (error) => error instanceof ValidationError && error.code === "policy.decisionId_required",
  );
});
