/**
 * Policy Center Unit Tests
 *
 * Tests PolicyCenterService evaluation logic including:
 * - Kill switch behavior
 * - Frozen actions
 * - Role-based action restrictions
 * - Governance action permissions
 * - Mode-based policies (read-only, maintenance, incident-mode, degraded, emergency)
 * - Budget constraints
 * - Path and network scope constraints
 * - Approval escalation rules
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  PolicyCenterService,
  type PolicyDecisionRequest,
  type PolicyAction,
  type PolicyRiskCategory,
  type PolicyMode,
  type OapeflirStage,
} from "../../../../src/platform/five-plane-control-plane/policy-center/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";

// ---------------------------------------------------------------------------
// Test Fixtures & Helpers
// ---------------------------------------------------------------------------

function createTestRequest(overrides: Partial<PolicyDecisionRequest> = {}): PolicyDecisionRequest {
  const defaultRequest: PolicyDecisionRequest = {
    decisionId: newId("decision"),
    taskId: newId("task"),
    subjectType: "agent",
    subjectId: "agent-001",
    action: "invoke_tool",
    riskCategory: "destructive",
    mode: "auto",
    stage: "execute",
  };
  return { ...defaultRequest, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests: Kill Switch
// ---------------------------------------------------------------------------

test("evaluate() returns deny when kill switch is enabled", () => {
  const service = new PolicyCenterService({ killSwitchEnabled: true });
  const request = createTestRequest();

  const result = service.evaluate(request);

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.kill_switch_active");
  assert.equal(result.killSwitchApplied, true);
  assert.ok(result.matchedRuleRefs.includes("kill_switch"));
});

test("evaluate() returns allow when kill switch is disabled", () => {
  const service = new PolicyCenterService({ killSwitchEnabled: false });
  const request = createTestRequest();

  const result = service.evaluate(request);

  assert.equal(result.decision, "allow");
  assert.equal(result.killSwitchApplied, false);
});

// ---------------------------------------------------------------------------
// Tests: Frozen Actions
// ---------------------------------------------------------------------------

test("evaluate() returns deny for frozen action", () => {
  const service = new PolicyCenterService({ frozenActions: ["invoke_tool"] });
  const request = createTestRequest({ action: "invoke_tool" });

  const result = service.evaluate(request);

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.action_frozen");
  assert.ok(result.matchedRuleRefs.includes("freeze.action"));
});

test("evaluate() allows non-frozen action when other actions are frozen", () => {
  const service = new PolicyCenterService({ frozenActions: ["write_file", "exec_command"] });
  const request = createTestRequest({ action: "invoke_model" });

  const result = service.evaluate(request);

  assert.equal(result.decision, "allow");
});

// ---------------------------------------------------------------------------
// Tests: Role-Based Action Restrictions
// ---------------------------------------------------------------------------

test("evaluate() denies action when subject role does not allow it", () => {
  const service = new PolicyCenterService({
    subjectRoles: { "agent-001": ["reader"] },
    allowedActionsByRole: { reader: ["invoke_model"] },
  });
  const request = createTestRequest({
    subjectId: "agent-001",
    action: "invoke_tool",
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.role_action_denied");
  assert.ok(result.matchedRuleRefs.includes("role_permission"));
});

test("evaluate() allows action when subject role permits it", () => {
  const service = new PolicyCenterService({
    subjectRoles: { "agent-001": ["tool-user"] },
    allowedActionsByRole: { "tool-user": ["invoke_tool", "write_file"] },
  });
  const request = createTestRequest({
    subjectId: "agent-001",
    action: "invoke_tool",
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "allow");
});

test("evaluate() allows action when no role policy is configured", () => {
  const service = new PolicyCenterService({ allowedActionsByRole: {} });
  const request = createTestRequest();

  const result = service.evaluate(request);

  assert.equal(result.decision, "allow");
});

// ---------------------------------------------------------------------------
// Tests: Governance Actions
// ---------------------------------------------------------------------------

test("evaluate() denies governance action when not enabled", () => {
  const service = new PolicyCenterService({
    enabledGovernanceActions: ["dispatch_execution"],
  });
  const request = createTestRequest({ action: "promote_improvement" });

  const result = service.evaluate(request);

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.governance_plane_disabled");
  assert.ok(result.matchedRuleRefs.includes("governance_action"));
});

test("evaluate() allows governance action when enabled", () => {
  const service = new PolicyCenterService({
    enabledGovernanceActions: ["promote_improvement", "advance_rollout"],
  });
  const request = createTestRequest({ action: "promote_improvement" });

  const result = service.evaluate(request);

  assert.equal(result.decision, "allow");
});

// ---------------------------------------------------------------------------
// Tests: Mode Policy - Read-Only
// ---------------------------------------------------------------------------

test("evaluate() denies mutating actions in read-only mode", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest({
    mode: "read-only",
    action: "write_file",
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.read_only_mode_denied");
  assert.ok(result.matchedRuleRefs.includes("mode.read_only"));
});

test("evaluate() allows non-mutating actions in read-only mode", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest({
    mode: "read-only",
    action: "invoke_model",
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "allow");
  assert.ok(result.enforcedConstraints.sideEffectsAllowed === false);
});

// ---------------------------------------------------------------------------
// Tests: Mode Policy - Maintenance
// ---------------------------------------------------------------------------

test("evaluate() denies rollout actions in maintenance mode", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest({
    mode: "maintenance",
    action: "advance_rollout",
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.maintenance_mode_denied");
  assert.ok(result.matchedRuleRefs.includes("mode.maintenance"));
});

test("evaluate() denies org_change in maintenance mode", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest({
    mode: "maintenance",
    action: "org_change",
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.maintenance_mode_denied");
});

test("evaluate() denies install_extension in maintenance mode", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest({
    mode: "maintenance",
    action: "install_extension",
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.maintenance_mode_denied");
});

test("evaluate() allows non-restricted actions in maintenance mode", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest({
    mode: "maintenance",
    action: "invoke_tool",
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "allow");
  assert.ok(result.enforcedConstraints.maintenanceWindow === true);
});

// ---------------------------------------------------------------------------
// Tests: Mode Policy - Incident-Mode
// ---------------------------------------------------------------------------

test("evaluate() requires approval for non-cost-sensitive actions in incident-mode", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest({
    mode: "incident-mode",
    riskCategory: "destructive",
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.requiresApproval, true);
  assert.ok(result.matchedRuleRefs.includes("mode.incident"));
});

test("evaluate() does not require approval for cost_sensitive in incident-mode", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest({
    mode: "incident-mode",
    riskCategory: "cost_sensitive",
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "allow");
  assert.equal(result.requiresApproval, false);
});

test("evaluate() enforces changeFreeze constraint in incident-mode", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest({ mode: "incident-mode" });

  const result = service.evaluate(request);

  assert.ok(result.enforcedConstraints.changeFreeze === true);
  assert.ok(result.enforcedConstraints.evidenceLevel === "full");
});

// ---------------------------------------------------------------------------
// Tests: Mode Policy - Degraded
// ---------------------------------------------------------------------------

test("evaluate() allows actions in degraded mode with constraints", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest({ mode: "degraded" });

  const result = service.evaluate(request);

  assert.equal(result.decision, "allow");
  assert.ok(result.enforcedConstraints.fallbackOnly === true);
  assert.ok(result.enforcedConstraints.maxParallelism === 1);
});

// ---------------------------------------------------------------------------
// Tests: Mode Policy - Emergency
// ---------------------------------------------------------------------------

test("evaluate() requires approval for non-system subjects in emergency mode", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest({
    mode: "emergency",
    subjectType: "user",
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "escalate_for_approval");
  assert.ok(result.enforcedConstraints.breakGlass === true);
  assert.ok(result.enforcedConstraints.operatorAckRequired === true);
});

test("evaluate() allows system subjects in emergency mode without approval", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest({
    mode: "emergency",
    subjectType: "system",
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "allow");
  assert.equal(result.requiresApproval, false);
});

// ---------------------------------------------------------------------------
// Tests: Budget Constraints
// ---------------------------------------------------------------------------

test("evaluate() denies when estimated cost exceeds max", () => {
  const service = new PolicyCenterService({ maxEstimatedCostUsd: 100 });
  const request = createTestRequest({ estimatedCostUsd: 150 });

  const result = service.evaluate(request);

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.budget_exceeded");
  assert.ok(result.matchedRuleRefs.includes("budget.max_estimated_cost"));
});

test("evaluate() adds budget warning constraint when cost exceeds warning threshold", () => {
  const service = new PolicyCenterService({ budgetWarningCostUsd: 50 });
  const request = createTestRequest({ estimatedCostUsd: 75 });

  const result = service.evaluate(request);

  assert.ok(result.enforcedConstraints.budgetWarningCostUsd === 50);
  assert.equal(result.requiresApproval, true);
});

// ---------------------------------------------------------------------------
// Tests: Path Scope Constraints
// ---------------------------------------------------------------------------

test("evaluate() denies write_file outside allowed path prefixes", () => {
  const service = new PolicyCenterService({ allowedPathPrefixes: ["/workspace/project"] });
  const request = createTestRequest({
    action: "write_file",
    resourceRef: "/tmp/secret.txt",
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.path_scope_denied");
  assert.ok(result.matchedRuleRefs.includes("sandbox.path_scope"));
});

test("evaluate() allows write_file within allowed path prefixes", () => {
  const service = new PolicyCenterService({ allowedPathPrefixes: ["/workspace/project"] });
  const request = createTestRequest({
    action: "write_file",
    resourceRef: "/workspace/project/src/index.ts",
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "allow");
  assert.ok(result.enforcedConstraints.allowedPathPrefixes !== undefined);
});

// ---------------------------------------------------------------------------
// Tests: Network Scope Constraints
// ---------------------------------------------------------------------------

test("evaluate() denies network_access to disallowed hosts", () => {
  const service = new PolicyCenterService({ allowedNetworkHosts: ["api.example.com"] });
  const request = createTestRequest({
    action: "network_access",
    resourceRef: "https://evil.com/api",
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.network_scope_denied");
  assert.ok(result.matchedRuleRefs.includes("sandbox.network_scope"));
});

test("evaluate() allows network_access to allowed hosts", () => {
  const service = new PolicyCenterService({ allowedNetworkHosts: ["api.example.com", "cdn.example.com"] });
  const request = createTestRequest({
    action: "network_access",
    resourceRef: "https://api.example.com/endpoint",
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "allow");
  assert.ok(result.enforcedConstraints.allowedNetworkHosts !== undefined);
});

test("evaluate() handles network_access with no resourceRef", () => {
  const service = new PolicyCenterService({ allowedNetworkHosts: ["api.example.com"] });
  const request = createTestRequest({
    action: "network_access",
    resourceRef: null,
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "policy.network_scope_denied");
});

// ---------------------------------------------------------------------------
// Tests: Approval Escalation Rules
// ---------------------------------------------------------------------------

test("evaluate() escalates for approval when risk category requires it", () => {
  const service = new PolicyCenterService({
    approvalRequiredRiskCategories: ["destructive", "irreversible"],
  });
  const request = createTestRequest({
    riskCategory: "destructive",
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.requiresApproval, true);
});

test("evaluate() allows action when risk category does not require approval", () => {
  const service = new PolicyCenterService({
    approvalRequiredRiskCategories: ["destructive", "governance_sensitive"],
  });
  const request = createTestRequest({ riskCategory: "cost_sensitive" });

  const result = service.evaluate(request);

  assert.equal(result.decision, "allow");
});

test("evaluate() does not escalate in full-auto mode for non-sensitive categories", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest({
    mode: "full-auto",
    riskCategory: "cost_sensitive",
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "allow");
});

test("evaluate() escalates in full-auto mode for sensitive categories", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest({
    mode: "full-auto",
    riskCategory: "governance_sensitive",
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "escalate_for_approval");
});

// ---------------------------------------------------------------------------
// Tests: Allow With Constraints
// ---------------------------------------------------------------------------

test("evaluate() returns allow_with_constraints when constraints are present", () => {
  const service = new PolicyCenterService({ budgetWarningCostUsd: 50 });
  const request = createTestRequest({
    estimatedCostUsd: 75,
    action: "invoke_model", // non-mutating action
  });

  const result = service.evaluate(request);

  assert.equal(result.decision, "allow_with_constraints");
  assert.equal(result.reasonCode, "policy.allow_with_constraints");
  assert.ok(Object.keys(result.enforcedConstraints).length > 0);
});

// ---------------------------------------------------------------------------
// Tests: Request Validation
// ---------------------------------------------------------------------------

test("evaluate() throws ValidationError for missing decisionId", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest({ decisionId: "" });

  assert.throws(
    () => service.evaluate(request as PolicyDecisionRequest),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "policy.decisionId_required",
  );
});

test("evaluate() throws ValidationError for missing taskId", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest({ taskId: "" });

  assert.throws(
    () => service.evaluate(request as PolicyDecisionRequest),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "policy.taskId_required",
  );
});

test("evaluate() throws ValidationError for missing subjectId", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest({ subjectId: "" });

  assert.throws(
    () => service.evaluate(request as PolicyDecisionRequest),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "policy.subjectId_required",
  );
});

test("evaluate() throws ValidationError for missing action", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest({ action: "" as PolicyAction });

  assert.throws(
    () => service.evaluate(request as PolicyDecisionRequest),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "policy.action_required",
  );
});

// ---------------------------------------------------------------------------
// Tests: Default Values
// ---------------------------------------------------------------------------

test("PolicyCenterService uses sensible defaults", () => {
  const service = new PolicyCenterService();

  const request = createTestRequest();
  const result = service.evaluate(request);

  // Should allow without constraints by default
  assert.equal(result.decision, "allow");
  assert.equal(result.killSwitchApplied, false);
});

test("PolicyCenterService defaults policyVersion to authoritative.v1", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest();
  const result = service.evaluate(request);

  assert.ok(result.evaluatedPolicyVersion.includes("policy-center.authoritative.v1"));
});

// ---------------------------------------------------------------------------
// Tests: Decision TTL
// ---------------------------------------------------------------------------

test("deny decisions have 30 second TTL", () => {
  const service = new PolicyCenterService({ frozenActions: ["invoke_tool"] });
  const request = createTestRequest({ action: "invoke_tool" });
  const result = service.evaluate(request);

  assert.equal(result.decisionTtlMs, 30_000);
});

test("non-deny decisions have 5 second TTL", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest();
  const result = service.evaluate(request);

  assert.equal(result.decisionTtlMs, 5_000);
});

// ---------------------------------------------------------------------------
// Tests: Audit Payload
// ---------------------------------------------------------------------------

test("evaluate() includes all relevant fields in audit payload", () => {
  const service = new PolicyCenterService();
  const request = createTestRequest({
    executionId: "exec-123",
    sessionId: "session-456",
    estimatedCostUsd: 50,
  });

  const result = service.evaluate(request);

  assert.equal(result.auditPayload.decisionId, request.decisionId);
  assert.equal(result.auditPayload.taskId, request.taskId);
  assert.equal(result.auditPayload.executionId, "exec-123");
  assert.equal(result.auditPayload.sessionId, "session-456");
  assert.equal(result.auditPayload.subjectType, request.subjectType);
  assert.equal(result.auditPayload.subjectId, request.subjectId);
  assert.equal(result.auditPayload.action, request.action);
  assert.equal(result.auditPayload.riskCategory, request.riskCategory);
  assert.equal(result.auditPayload.mode, request.mode);
  assert.equal(result.auditPayload.stage, request.stage);
  assert.ok(result.auditPayload.evaluatedAt);
});

// ---------------------------------------------------------------------------
// Tests: toUnifiedRuntimeMode
// ---------------------------------------------------------------------------

test("toUnifiedRuntimeMode maps supervised to supervised", () => {
  const result = PolicyCenterService.toUnifiedRuntimeMode("supervised");
  assert.equal(result, "supervised");
});

test("toUnifiedRuntimeMode maps auto to auto", () => {
  const result = PolicyCenterService.toUnifiedRuntimeMode("auto");
  assert.equal(result, "auto");
});

test("toUnifiedRuntimeMode maps full-auto to full-auto", () => {
  const result = PolicyCenterService.toUnifiedRuntimeMode("full-auto");
  assert.equal(result, "full-auto");
});

test("toUnifiedRuntimeMode maps read-only to read-only", () => {
  const result = PolicyCenterService.toUnifiedRuntimeMode("read-only");
  assert.equal(result, "read-only");
});

test("toUnifiedRuntimeMode maps incident-mode to incident-mode", () => {
  const result = PolicyCenterService.toUnifiedRuntimeMode("incident-mode");
  assert.equal(result, "incident-mode");
});

test("toUnifiedRuntimeMode maps emergency to emergency", () => {
  const result = PolicyCenterService.toUnifiedRuntimeMode("emergency");
  assert.equal(result, "emergency");
});
