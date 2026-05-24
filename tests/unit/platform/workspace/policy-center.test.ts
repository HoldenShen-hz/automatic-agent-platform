/**
 * Unit Tests: Policy Center
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  PolicyCenterService,
  toUnifiedRuntimeMode,
  type PolicyDecisionRequest,
  type PolicyMode,
} from "../../../../src/platform/five-plane-control-plane/policy-center/index.js";
import type { UnifiedRuntimeMode } from "../../../../src/platform/contracts/types/unified-runtime-mode.js";

// ============================================================================
// Policy Center Service Tests
// ============================================================================

test("PolicyCenterService allows default action in auto mode", () => {
  const service = new PolicyCenterService();

  const request: PolicyDecisionRequest = {
    decisionId: "dec_001",
    taskId: "task_123",
    subjectType: "user",
    subjectId: "user_456",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
  };

  const result = service.evaluate(request);

  assert.equal(result.decision, "allow");
  assert.equal(result.reasonCode, "policy.allow");
});

test("PolicyCenterService denies action in read-only mode", () => {
  const service = new PolicyCenterService();

  const request: PolicyDecisionRequest = {
    decisionId: "dec_002",
    taskId: "task_123",
    subjectType: "user",
    subjectId: "user_456",
    action: "write_file",
    riskCategory: "destructive",
    mode: "read_only",
    stage: "execute",
  };

  const result = service.evaluate(request);

  assert.equal(result.decision, "deny");
  assert.ok(result.reasonCode.includes("read_only"));
});

test("PolicyCenterService enforces frozen actions", () => {
  const service = new PolicyCenterService({
    frozenActions: ["install_extension"],
  });

  const request: PolicyDecisionRequest = {
    decisionId: "dec_003",
    taskId: "task_123",
    subjectType: "user",
    subjectId: "user_456",
    action: "install_extension",
    riskCategory: "prod_affecting",
    mode: "auto",
    stage: "execute",
  };

  const result = service.evaluate(request);

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.action_frozen");
});

test("PolicyCenterService enforces kill switch", () => {
  const service = new PolicyCenterService({
    killSwitchEnabled: true,
  });

  const request: PolicyDecisionRequest = {
    decisionId: "dec_004",
    taskId: "task_123",
    subjectType: "user",
    subjectId: "user_456",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
  };

  const result = service.evaluate(request);

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.kill_switch_active");
  assert.equal(result.killSwitchApplied, true);
});

test("PolicyCenterService enforces max estimated cost", () => {
  const service = new PolicyCenterService({
    maxEstimatedCostUsd: 10,
  });

  const request: PolicyDecisionRequest = {
    decisionId: "dec_005",
    taskId: "task_123",
    subjectType: "user",
    subjectId: "user_456",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
    estimatedCostUsd: 50,
  };

  const result = service.evaluate(request);

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.budget_exceeded");
});

test("PolicyCenterService escalates governance actions", () => {
  const service = new PolicyCenterService();

  const request: PolicyDecisionRequest = {
    decisionId: "dec_006",
    taskId: "task_123",
    subjectType: "user",
    subjectId: "user_456",
    action: "advance_rollout",
    riskCategory: "prod_affecting",
    mode: "auto",
    stage: "execute",
  };

  const result = service.evaluate(request);

  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.requiresApproval, true);
});

test("PolicyCenterService enforces budget warning", () => {
  const service = new PolicyCenterService({
    budgetWarningCostUsd: 5,
  });

  const request: PolicyDecisionRequest = {
    decisionId: "dec_007",
    taskId: "task_123",
    subjectType: "user",
    subjectId: "user_456",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
    estimatedCostUsd: 7,
  };

  const result = service.evaluate(request);

  assert.equal(result.requiresApproval, true);
  assert.ok(result.enforcedConstraints.budgetWarningCostUsd === 5);
});

test("PolicyCenterService enforces allowed path prefixes", () => {
  const service = new PolicyCenterService({
    allowedPathPrefixes: ["/workspace/project"],
  });

  const request: PolicyDecisionRequest = {
    decisionId: "dec_008",
    taskId: "task_123",
    subjectType: "user",
    subjectId: "user_456",
    action: "write_file",
    resourceRef: "/workspace/other/path.txt",
    riskCategory: "sensitive_data",
    mode: "auto",
    stage: "execute",
  };

  const result = service.evaluate(request);

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.path_scope_denied");
});

test("PolicyCenterService allows path within scope", () => {
  const service = new PolicyCenterService({
    allowedPathPrefixes: ["/workspace/project"],
  });

  const request: PolicyDecisionRequest = {
    decisionId: "dec_009",
    taskId: "task_123",
    subjectType: "user",
    subjectId: "user_456",
    action: "write_file",
    resourceRef: "/workspace/project/src/index.ts",
    riskCategory: "sensitive_data",
    mode: "auto",
    stage: "execute",
  };

  const result = service.evaluate(request);

  assert.equal(result.decision, "allow_with_constraints");
  assert.ok(result.enforcedConstraints.allowedPathPrefixes !== undefined);
});

test("PolicyCenterService enforces allowed network hosts", () => {
  const service = new PolicyCenterService({
    allowedNetworkHosts: ["api.example.com", "cdn.example.com"],
  });

  const request: PolicyDecisionRequest = {
    decisionId: "dec_010",
    taskId: "task_123",
    subjectType: "user",
    subjectId: "user_456",
    action: "network_access",
    resourceRef: "https://evil.example.com",
    riskCategory: "sensitive_data",
    mode: "auto",
    stage: "execute",
  };

  const result = service.evaluate(request);

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.network_scope_denied");
});

test("PolicyCenterService enforces maintenance mode restrictions", () => {
  const service = new PolicyCenterService();

  const request: PolicyDecisionRequest = {
    decisionId: "dec_011",
    taskId: "task_123",
    subjectType: "user",
    subjectId: "user_456",
    action: "advance_rollout",
    riskCategory: "prod_affecting",
    mode: "maintenance",
    stage: "execute",
  };

  const result = service.evaluate(request);

  assert.equal(result.decision, "deny");
  assert.ok(result.reasonCode.includes("maintenance"));
});

test("PolicyCenterService enforces incident-mode requirements", () => {
  const service = new PolicyCenterService();

  const request: PolicyDecisionRequest = {
    decisionId: "dec_012",
    taskId: "task_123",
    subjectType: "user",
    subjectId: "user_456",
    action: "invoke_model",
    riskCategory: "destructive",
    mode: "incident-mode",
    stage: "execute",
  };

  const result = service.evaluate(request);

  assert.equal(result.requiresApproval, true);
  assert.ok(result.enforcedConstraints.changeFreeze === true);
});

test("PolicyCenterService enforces degraded mode", () => {
  const service = new PolicyCenterService();

  const request: PolicyDecisionRequest = {
    decisionId: "dec_013",
    taskId: "task_123",
    subjectType: "user",
    subjectId: "user_456",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "degraded",
    stage: "execute",
  };

  const result = service.evaluate(request);

  assert.equal(result.enforcedConstraints.fallbackOnly, true);
  assert.equal(result.enforcedConstraints.maxParallelism, 1);
});

test("PolicyCenterService enforces emergency mode", () => {
  const service = new PolicyCenterService();

  const request: PolicyDecisionRequest = {
    decisionId: "dec_014",
    taskId: "task_123",
    subjectType: "user",
    subjectId: "user_456",
    action: "dispatch_execution",
    riskCategory: "prod_affecting",
    mode: "emergency",
    stage: "execute",
  };

  const result = service.evaluate(request);

  assert.equal(result.requiresApproval, true);
  assert.equal(result.enforcedConstraints.breakGlass, true);
  assert.equal(result.enforcedConstraints.operatorAckRequired, true);
});

test("PolicyCenterService role-based action enforcement", () => {
  const service = new PolicyCenterService({
    subjectRoles: { "user_456": ["developer"] },
    allowedActionsByRole: { developer: ["invoke_model", "invoke_tool"] },
  });

  const allowedRequest: PolicyDecisionRequest = {
    decisionId: "dec_015",
    taskId: "task_123",
    subjectType: "user",
    subjectId: "user_456",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
  };

  const deniedRequest: PolicyDecisionRequest = {
    decisionId: "dec_016",
    taskId: "task_123",
    subjectType: "user",
    subjectId: "user_456",
    action: "write_file",
    riskCategory: "sensitive_data",
    mode: "auto",
    stage: "execute",
  };

  assert.equal(service.evaluate(allowedRequest).decision, "allow");
  assert.equal(service.evaluate(deniedRequest).decision, "deny");
});

test("PolicyCenterService rejects empty required fields", () => {
  const service = new PolicyCenterService();

  const request = {
    decisionId: "",
    taskId: "task_123",
    subjectType: "user",
    subjectId: "user_456",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
  };

  assert.throws(
    () => service.evaluate(request as PolicyDecisionRequest),
    /required field/,
  );
});

// ============================================================================
// toUnifiedRuntimeMode Tests
// ============================================================================

test("toUnifiedRuntimeMode maps supervised", () => {
  const mode: PolicyMode = "supervised";
  const result = toUnifiedRuntimeMode(mode);

  assert.equal(typeof result, "string");
});

test("toUnifiedRuntimeMode maps auto", () => {
  const mode: PolicyMode = "auto";
  const result = toUnifiedRuntimeMode(mode);

  assert.equal(typeof result, "string");
});

test("toUnifiedRuntimeMode maps full-auto", () => {
  const mode: PolicyMode = "full-auto";
  const result = toUnifiedRuntimeMode(mode);

  assert.equal(typeof result, "string");
});

test("toUnifiedRuntimeMode maps read-only", () => {
  const mode: PolicyMode = "read_only";
  const result = toUnifiedRuntimeMode(mode);

  assert.equal(typeof result, "string");
});

test("toUnifiedRuntimeMode maps emergency", () => {
  const mode: PolicyMode = "emergency";
  const result = toUnifiedRuntimeMode(mode);

  assert.equal(typeof result, "string");
});
