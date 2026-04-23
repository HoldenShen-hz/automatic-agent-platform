import assert from "node:assert/strict";
import test from "node:test";

import { PolicyCenterService } from "../../../../../src/platform/control-plane/policy-center/index.js";

test("PolicyCenterService denies all requests when kill switch is enabled", () => {
  const service = new PolicyCenterService({ killSwitchEnabled: true });

  const result = service.evaluate({
    decisionId: "decision-ks",
    taskId: "task-1",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.kill_switch_active");
  assert.equal(result.killSwitchApplied, true);
});

test("PolicyCenterService denies frozen actions", () => {
  const service = new PolicyCenterService({ frozenActions: ["write_file", "exec_command"] });

  const result = service.evaluate({
    decisionId: "decision-frozen",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "user-1",
    action: "write_file",
    riskCategory: "sensitive_data",
    mode: "supervised",
    stage: "execute",
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.action_frozen");
});

test("PolicyCenterService denies when role does not allow action", () => {
  const service = new PolicyCenterService({
    subjectRoles: { "user-1": ["viewer"] },
    allowedActionsByRole: { viewer: ["invoke_model"] },
  });

  const result = service.evaluate({
    decisionId: "decision-role",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "user-1",
    action: "write_file",
    riskCategory: "sensitive_data",
    mode: "supervised",
    stage: "execute",
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.role_action_denied");
});

test("PolicyCenterService denies governance action when not enabled", () => {
  const service = new PolicyCenterService({
    enabledGovernanceActions: ["dispatch_execution"],
  });

  const result = service.evaluate({
    decisionId: "decision-governance",
    taskId: "task-1",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "promote_improvement",
    riskCategory: "governance_sensitive",
    mode: "auto",
    stage: "improve",
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.governance_plane_disabled");
});

test("PolicyCenterService denies when estimated cost exceeds maximum", () => {
  const service = new PolicyCenterService({ maxEstimatedCostUsd: 0.01 });

  const result = service.evaluate({
    decisionId: "decision-budget",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "user-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
    estimatedCostUsd: 1.0,
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.budget_exceeded");
  assert.deepEqual(result.enforcedConstraints.requestedCostUsd, 1.0);
});

test("PolicyCenterService requires approval when estimated cost exceeds warning threshold", () => {
  const service = new PolicyCenterService({ budgetWarningCostUsd: 0.001 });

  const result = service.evaluate({
    decisionId: "decision-warning",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "user-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
    estimatedCostUsd: 0.01,
  });

  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.enforcedConstraints.budgetWarningCostUsd, 0.001);
});

test("PolicyCenterService allows write_file within allowed path prefixes", () => {
  const service = new PolicyCenterService({
    allowedPathPrefixes: ["/workspace/src/"],
  });

  const result = service.evaluate({
    decisionId: "decision-path-ok",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "user-1",
    action: "write_file",
    resourceRef: "/workspace/src/app.ts",
    riskCategory: "sensitive_data",
    mode: "supervised",
    stage: "execute",
  });

  assert.equal(result.decision, "allow_with_constraints");
  assert.deepEqual(result.enforcedConstraints.allowedPathPrefixes, ["/workspace/src/"]);
});

test("PolicyCenterService denies network_access to non-allowed hosts", () => {
  const service = new PolicyCenterService({
    allowedNetworkHosts: ["allowed.example.com"],
  });

  const result = service.evaluate({
    decisionId: "decision-net-denied",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "user-1",
    action: "network_access",
    resourceRef: "https://forbidden.example.com/api",
    riskCategory: "sensitive_data",
    mode: "supervised",
    stage: "execute",
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.network_scope_denied");
});

test("PolicyCenterService allows network_access to allowed hosts", () => {
  const service = new PolicyCenterService({
    allowedNetworkHosts: ["api.example.com"],
  });

  const result = service.evaluate({
    decisionId: "decision-net-ok",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "user-1",
    action: "network_access",
    resourceRef: "https://api.example.com/v1/status",
    riskCategory: "sensitive_data",
    mode: "full-auto",
    stage: "execute",
  });

  assert.equal(result.decision, "allow_with_constraints");
  assert.deepEqual(result.enforcedConstraints.allowedNetworkHosts, ["api.example.com"]);
});

test("PolicyCenterService allows non-mutating actions in read-only mode", () => {
  const service = new PolicyCenterService({});

  const result = service.evaluate({
    decisionId: "decision-readonly-ok",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "user-1",
    action: "invoke_model",
    riskCategory: "sensitive_data",
    mode: "read-only",
    stage: "observe",
  });

  assert.equal(result.decision, "allow_with_constraints");
  assert.equal(result.enforcedConstraints.sideEffectsAllowed, false);
});

test("PolicyCenterService denies specific actions in maintenance mode", () => {
  const service = new PolicyCenterService({});

  const result = service.evaluate({
    decisionId: "decision-maint",
    taskId: "task-1",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "advance_rollout",
    riskCategory: "prod_affecting",
    mode: "maintenance",
    stage: "execute",
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.maintenance_mode_denied");
  assert.equal(result.enforcedConstraints.maintenanceWindow, true);
});

test("PolicyCenterService allows non-blocked actions in maintenance mode", () => {
  const service = new PolicyCenterService({});

  const result = service.evaluate({
    decisionId: "decision-maint-ok",
    taskId: "task-1",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "maintenance",
    stage: "observe",
  });

  assert.equal(result.decision, "allow_with_constraints");
  assert.equal(result.enforcedConstraints.maintenanceWindow, true);
});

test("PolicyCenterService incident mode requires approval for non-cost-sensitive", () => {
  const service = new PolicyCenterService({});

  const result = service.evaluate({
    decisionId: "decision-incident",
    taskId: "task-1",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "destructive",
    mode: "incident-mode",
    stage: "assess",
  });

  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.enforcedConstraints.changeFreeze, true);
  assert.equal(result.enforcedConstraints.evidenceLevel, "full");
});

test("PolicyCenterService incident mode allows cost-sensitive without approval", () => {
  const service = new PolicyCenterService({});

  const result = service.evaluate({
    decisionId: "decision-incident-cost",
    taskId: "task-1",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "incident-mode",
    stage: "assess",
  });

  assert.equal(result.decision, "allow_with_constraints");
  assert.equal(result.enforcedConstraints.changeFreeze, true);
});

test("PolicyCenterService degraded mode restricts to fallback only", () => {
  const service = new PolicyCenterService({});

  const result = service.evaluate({
    decisionId: "decision-degraded",
    taskId: "task-1",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "degraded",
    stage: "execute",
  });

  assert.equal(result.decision, "allow_with_constraints");
  assert.equal(result.enforcedConstraints.fallbackOnly, true);
  assert.equal(result.enforcedConstraints.maxParallelism, 1);
});

test("PolicyCenterService emergency mode allows system subject without approval", () => {
  const service = new PolicyCenterService({});

  const result = service.evaluate({
    decisionId: "decision-emergency-sys",
    taskId: "task-1",
    subjectType: "system",
    subjectId: "system-1",
    action: "dispatch_execution",
    riskCategory: "destructive",
    mode: "emergency",
    stage: "execute",
  });

  assert.equal(result.decision, "allow_with_constraints");
  assert.equal(result.enforcedConstraints.breakGlass, true);
  assert.equal(result.enforcedConstraints.operatorAckRequired, true);
});

test("PolicyCenterService full-auto mode escalates governance-sensitive actions", () => {
  const service = new PolicyCenterService({});

  const result = service.evaluate({
    decisionId: "decision-fullauto",
    taskId: "task-1",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "governance_sensitive",
    mode: "full-auto",
    stage: "execute",
  });

  assert.equal(result.decision, "escalate_for_approval");
});

test("PolicyCenterService full-auto mode allows non-sensitive actions", () => {
  const service = new PolicyCenterService({});

  const result = service.evaluate({
    decisionId: "decision-fullauto-ok",
    taskId: "task-1",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "full-auto",
    stage: "execute",
  });

  assert.equal(result.decision, "allow");
});

test("PolicyCenterService escalates for approval-required risk categories in auto mode", () => {
  const service = new PolicyCenterService({});

  const result = service.evaluate({
    decisionId: "decision-risk",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "user-1",
    action: "invoke_model",
    riskCategory: "destructive",
    mode: "auto",
    stage: "execute",
  });

  assert.equal(result.decision, "escalate_for_approval");
});

test("PolicyCenterService allows non-approval-required risk categories in auto mode", () => {
  const service = new PolicyCenterService({});

  const result = service.evaluate({
    decisionId: "decision-risk-ok",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "user-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
  });

  assert.equal(result.decision, "allow");
});

test("PolicyCenterService defaults to allow when no constraints apply", () => {
  const service = new PolicyCenterService({});

  const result = service.evaluate({
    decisionId: "decision-default",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "user-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
  });

  assert.equal(result.decision, "allow");
  assert.equal(result.reasonCode, "policy.allow");
});

test("PolicyCenterService uses custom policy version", () => {
  const service = new PolicyCenterService({ policyVersion: "custom.v2" });

  const result = service.evaluate({
    decisionId: "decision-version",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "user-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
  });

  assert.equal(result.evaluatedPolicyVersion, "custom.v2");
});

test("PolicyCenterService sets appropriate decisionTtlMs based on decision", () => {
  const service = new PolicyCenterService({});

  const denyResult = service.evaluate({
    decisionId: "decision-ttl-deny",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "user-1",
    action: "write_file",
    riskCategory: "destructive",
    mode: "read-only",
    stage: "execute",
  });

  assert.equal(denyResult.decisionTtlMs, 30_000);

  const allowResult = service.evaluate({
    decisionId: "decision-ttl-allow",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "user-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
  });

  assert.equal(allowResult.decisionTtlMs, 5_000);
});

test("PolicyCenterService validates required fields", () => {
  const service = new PolicyCenterService({});

  assert.throws(() => {
    service.evaluate({
      decisionId: "",
      taskId: "task-1",
      subjectType: "user",
      subjectId: "user-1",
      action: "invoke_model",
      riskCategory: "cost_sensitive",
      mode: "auto",
      stage: "execute",
    });
  }, (error: unknown) => error instanceof Error && error.name === "ValidationError");
});

test("PolicyCenterService validates taskId is not empty", () => {
  const service = new PolicyCenterService({});

  assert.throws(() => {
    service.evaluate({
      decisionId: "decision-1",
      taskId: "   ",
      subjectType: "user",
      subjectId: "user-1",
      action: "invoke_model",
      riskCategory: "cost_sensitive",
      mode: "auto",
      stage: "execute",
    });
  }, (error: unknown) => error instanceof Error && error.name === "ValidationError");
});

test("PolicyCenterService parseHost handles invalid URLs", () => {
  const service = new PolicyCenterService({
    allowedNetworkHosts: ["not-a-valid-url"],
  });

  // parseHost falls back to using the string as-is when URL parsing fails
  const result = service.evaluate({
    decisionId: "decision-invalid-url",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "user-1",
    action: "network_access",
    resourceRef: "not-a-valid-url",
    riskCategory: "sensitive_data",
    mode: "supervised",
    stage: "execute",
  });

  assert.equal(result.decision, "allow_with_constraints");
});

test("PolicyCenterService parseHost handles null resourceRef for network_access", () => {
  const service = new PolicyCenterService({
    allowedNetworkHosts: ["allowed.example.com"],
  });

  const result = service.evaluate({
    decisionId: "decision-null-ref",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "user-1",
    action: "network_access",
    resourceRef: null,
    riskCategory: "sensitive_data",
    mode: "supervised",
    stage: "execute",
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.network_scope_denied");
});

test("PolicyCenterService defaults all options correctly", () => {
  const service = new PolicyCenterService({});

  const result = service.evaluate({
    decisionId: "decision-defaults",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "user-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
  });

  assert.equal(result.evaluatedPolicyVersion, "policy-center.authoritative.v1");
  assert.equal(result.killSwitchApplied, false);
  assert.ok(result.auditPayload);
});

test("PolicyCenterService auditPayload contains all fields", () => {
  const service = new PolicyCenterService({});

  const result = service.evaluate({
    decisionId: "decision-audit",
    taskId: "task-1",
    executionId: "exec-1",
    sessionId: "session-1",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "dispatch_execution",
    resourceRef: "queue:default",
    riskCategory: "prod_affecting",
    mode: "auto",
    stage: "execute",
    estimatedCostUsd: 0.05,
  });

  assert.equal(result.auditPayload.decisionId, "decision-audit");
  assert.equal(result.auditPayload.taskId, "task-1");
  assert.equal(result.auditPayload.executionId, "exec-1");
  assert.equal(result.auditPayload.sessionId, "session-1");
  assert.equal(result.auditPayload.subjectType, "agent");
  assert.equal(result.auditPayload.subjectId, "agent-1");
  assert.equal(result.auditPayload.action, "dispatch_execution");
  assert.equal(result.auditPayload.resourceRef, "queue:default");
  assert.equal(result.auditPayload.riskCategory, "prod_affecting");
  assert.equal(result.auditPayload.mode, "auto");
  assert.equal(result.auditPayload.stage, "execute");
  assert.equal(result.auditPayload.estimatedCostUsd, 0.05);
});

test("PolicyCenterService allows dispatch_execution by default governance actions", () => {
  const service = new PolicyCenterService({});

  const result = service.evaluate({
    decisionId: "decision-governance-default",
    taskId: "task-1",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "dispatch_execution",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
  });

  assert.equal(result.decision, "allow");
});

test("PolicyCenterService matchedRuleRefs includes default_allow", () => {
  const service = new PolicyCenterService({});

  const result = service.evaluate({
    decisionId: "decision-refs",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "user-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
  });

  assert.ok(result.matchedRuleRefs.includes("default_allow"));
});

test("PolicyCenterService write_file allowed when no path prefixes configured", () => {
  const service = new PolicyCenterService({ allowedPathPrefixes: [] });

  const result = service.evaluate({
    decisionId: "decision-empty-prefix",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "user-1",
    action: "write_file",
    resourceRef: "/any/path.txt",
    riskCategory: "sensitive_data",
    mode: "supervised",
    stage: "execute",
  });

  // Empty array means path check is skipped
  assert.equal(result.decision, "allow");
});
