/**
 * Integration Test: Policy Center
 *
 * Verifies PolicyCenterService integration with policy modes, kill switches,
 * role-based action restrictions, constraint evaluation, and escalation paths.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  PolicyCenterService,
  type PolicyDecisionRequest,
  type PolicyRiskCategory,
  type PolicyAction,
  type PolicyMode,
} from "../../../../../src/platform/control-plane/policy-center/index.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

function makeRequest(overrides: Partial<PolicyDecisionRequest> = {}): PolicyDecisionRequest {
  return {
    decisionId: "dec-test-1",
    taskId: "task-test-1",
    executionId: null,
    sessionId: null,
    subjectType: "user",
    subjectId: "user-1",
    action: "write_file",
    resourceRef: null,
    riskCategory: "destructive",
    mode: "supervised",
    stage: "execute",
    estimatedCostUsd: 10,
    metadata: {},
    ...overrides,
  };
}

test("policy center: allow by default when no restrictions configured", () => {
  const policy = new PolicyCenterService();
  const result = policy.evaluate(makeRequest());

  assert.strictEqual(result.decision, "allow");
  assert.strictEqual(result.reasonCode, "policy.allow");
  assert.strictEqual(result.killSwitchApplied, false);
});

test("policy center: kill switch denies all actions", () => {
  const policy = new PolicyCenterService({ killSwitchEnabled: true });
  const result = policy.evaluate(makeRequest());

  assert.strictEqual(result.decision, "deny");
  assert.strictEqual(result.reasonCode, "policy.kill_switch_active");
  assert.strictEqual(result.killSwitchApplied, true);
});

test("policy center: frozen actions are denied regardless of role", () => {
  const policy = new PolicyCenterService({ frozenActions: ["exec_command"] });
  const result = policy.evaluate(makeRequest({ action: "exec_command" }));

  assert.strictEqual(result.decision, "deny");
  assert.strictEqual(result.reasonCode, "policy.action_frozen");
});

test("policy center: role-based action restriction blocks unauthorized actions", () => {
  const policy = new PolicyCenterService({
    subjectRoles: { "user-1": ["viewer"] },
    allowedActionsByRole: { viewer: ["invoke_model", "invoke_tool"] },
  });

  const result = policy.evaluate(makeRequest({ action: "write_file", subjectId: "user-1" }));
  assert.strictEqual(result.decision, "deny");
  assert.strictEqual(result.reasonCode, "policy.role_action_denied");
});

test("policy center: role-based action restriction allows permitted actions", () => {
  const policy = new PolicyCenterService({
    subjectRoles: { "user-1": ["editor"] },
    allowedActionsByRole: { editor: ["write_file", "exec_command"] },
  });

  const result = policy.evaluate(makeRequest({ action: "write_file", subjectId: "user-1" }));
  assert.strictEqual(result.decision, "allow");
});

test("policy center: read-only mode denies mutating actions", () => {
  const policy = new PolicyCenterService();

  const mutatingActions: PolicyAction[] = ["write_file", "exec_command", "invoke_tool", "install_extension"];
  for (const action of mutatingActions) {
    const result = policy.evaluate(makeRequest({ action, mode: "read-only" }));
    assert.strictEqual(result.decision, "deny", `read-only should deny ${action}`);
    assert.strictEqual(result.reasonCode, "policy.read_only_mode_denied");
  }
});

test("policy center: read-only mode allows non-mutating actions", () => {
  const policy = new PolicyCenterService();
  const result = policy.evaluate(makeRequest({ action: "invoke_model", mode: "read-only" }));

  assert.strictEqual(result.decision, "allow");
  assert.ok(result.matchedRuleRefs.includes("mode.read_only"));
});

test("policy center: maintenance mode blocks rollout and topology changes", () => {
  const policy = new PolicyCenterService();

  const blocked = policy.evaluate(makeRequest({ action: "advance_rollout", mode: "maintenance" }));
  assert.strictEqual(blocked.decision, "deny");
  assert.strictEqual(blocked.reasonCode, "policy.maintenance_mode_denied");

  const orgChange = policy.evaluate(makeRequest({ action: "org_change", mode: "maintenance" }));
  assert.strictEqual(orgChange.decision, "deny");
  assert.strictEqual(orgChange.reasonCode, "policy.maintenance_mode_denied");
});

test("policy center: maintenance mode allows non-blocked actions", () => {
  const policy = new PolicyCenterService();
  const result = policy.evaluate(makeRequest({ action: "write_file", mode: "maintenance" }));

  assert.strictEqual(result.decision, "allow");
});

test("policy center: incident-mode raises evidence requirements for non-cost actions", () => {
  const policy = new PolicyCenterService();
  const result = policy.evaluate(makeRequest({ riskCategory: "destructive", mode: "incident-mode" }));

  assert.strictEqual(result.requiresApproval, true);
  assert.ok(result.enforcedConstraints.changeFreeze === true);
  assert.ok(result.enforcedConstraints.evidenceLevel === "full");
});

test("policy center: incident-mode does not require approval for cost_sensitive", () => {
  const policy = new PolicyCenterService();
  const result = policy.evaluate(makeRequest({ riskCategory: "cost_sensitive", mode: "incident-mode" }));

  assert.strictEqual(result.requiresApproval, false);
});

test("policy center: degraded mode restricts to fallback capacity", () => {
  const policy = new PolicyCenterService();
  const result = policy.evaluate(makeRequest({ mode: "degraded" }));

  assert.ok(result.enforcedConstraints.fallbackOnly === true);
  assert.ok(result.enforcedConstraints.maxParallelism === 1);
});

test("policy center: emergency mode requires operator ack for non-system subjects", () => {
  const policy = new PolicyCenterService();
  const result = policy.evaluate(makeRequest({ subjectType: "user", mode: "emergency" }));

  assert.strictEqual(result.requiresApproval, true);
  assert.ok(result.enforcedConstraints.breakGlass === true);
  assert.ok(result.enforcedConstraints.operatorAckRequired === true);
});

test("policy center: emergency mode allows system subject without approval", () => {
  const policy = new PolicyCenterService();
  const result = policy.evaluate(makeRequest({ subjectType: "system", mode: "emergency" }));

  assert.strictEqual(result.requiresApproval, false);
});

test("policy center: budget exceeded denies action when cost exceeds max", () => {
  const policy = new PolicyCenterService({ maxEstimatedCostUsd: 50 });
  const result = policy.evaluate(makeRequest({ estimatedCostUsd: 100 }));

  assert.strictEqual(result.decision, "deny");
  assert.strictEqual(result.reasonCode, "policy.budget_exceeded");
});

test("policy center: budget warning triggers approval when cost exceeds warning threshold", () => {
  const policy = new PolicyCenterService({ budgetWarningCostUsd: 50 });
  const result = policy.evaluate(makeRequest({ estimatedCostUsd: 75 }));

  assert.strictEqual(result.decision, "allow_with_constraints");
  assert.strictEqual(result.requiresApproval, true);
  assert.strictEqual(result.enforcedConstraints.budgetWarningCostUsd, 50);
});

test("policy center: write_file path scope denied when outside allowed prefixes", () => {
  const policy = new PolicyCenterService({ allowedPathPrefixes: ["/workspace/safe"] });
  const result = policy.evaluate(makeRequest({
    action: "write_file",
    resourceRef: "/tmp/outside.txt",
  }));

  assert.strictEqual(result.decision, "deny");
  assert.strictEqual(result.reasonCode, "policy.path_scope_denied");
});

test("policy center: write_file allowed when path is within allowed prefix", () => {
  const policy = new PolicyCenterService({ allowedPathPrefixes: ["/workspace/safe"] });
  const result = policy.evaluate(makeRequest({
    action: "write_file",
    resourceRef: "/workspace/safe/project/file.txt",
  }));

  assert.strictEqual(result.decision, "allow");
});

test("policy center: network_access denied when host is outside allowed list", () => {
  const policy = new PolicyCenterService({ allowedNetworkHosts: ["api.example.com"] });
  const result = policy.evaluate(makeRequest({
    action: "network_access",
    resourceRef: "https://evil.example.com/data",
  }));

  assert.strictEqual(result.decision, "deny");
  assert.strictEqual(result.reasonCode, "policy.network_scope_denied");
});

test("policy center: network_access allowed when host is in allowed list", () => {
  const policy = new PolicyCenterService({ allowedNetworkHosts: ["api.example.com"] });
  const result = policy.evaluate(makeRequest({
    action: "network_access",
    resourceRef: "https://api.example.com/v1/users",
  }));

  assert.strictEqual(result.decision, "allow");
});

test("policy center: governance actions require explicit enablement", () => {
  const policy = new PolicyCenterService({
    enabledGovernanceActions: ["dispatch_execution"],
  });

  const result = policy.evaluate(makeRequest({ action: "promote_improvement" }));
  assert.strictEqual(result.decision, "deny");
  assert.strictEqual(result.reasonCode, "policy.governance_plane_disabled");
});

test("policy center: governance action allowed when explicitly enabled", () => {
  const policy = new PolicyCenterService({
    enabledGovernanceActions: ["promote_improvement", "advance_rollout"],
  });

  const result = policy.evaluate(makeRequest({ action: "advance_rollout" }));
  assert.strictEqual(result.decision, "allow");
});

test("policy center: high-risk categories require approval by default in auto mode", () => {
  const policy = new PolicyCenterService();

  const categories: PolicyRiskCategory[] = ["destructive", "irreversible", "prod_affecting", "org_changing", "strategy_affecting", "governance_sensitive"];
  for (const category of categories) {
    const result = policy.evaluate(makeRequest({ riskCategory: category, mode: "auto" }));
    assert.strictEqual(result.requiresApproval, true, `auto mode should require approval for ${category}`);
  }
});

test("policy center: full-auto mode skips approval for non-sensitive categories", () => {
  const policy = new PolicyCenterService();
  const result = policy.evaluate(makeRequest({
    riskCategory: "cost_sensitive",
    mode: "full-auto",
  }));

  assert.strictEqual(result.requiresApproval, false);
});

test("policy center: full-auto mode escalates governance-sensitive categories", () => {
  const policy = new PolicyCenterService();
  const result = policy.evaluate(makeRequest({
    riskCategory: "org_changing",
    mode: "full-auto",
  }));

  assert.strictEqual(result.requiresApproval, true);
});

test("policy center: decision includes audit payload with all context", () => {
  const policy = new PolicyCenterService();
  const req = makeRequest();
  const result = policy.evaluate(req);

  assert.ok(result.auditPayload);
  assert.strictEqual(result.auditPayload.decisionId, req.decisionId);
  assert.strictEqual(result.auditPayload.taskId, req.taskId);
  assert.strictEqual(result.auditPayload.subjectId, req.subjectId);
  assert.strictEqual(result.auditPayload.action, req.action);
});

test("policy center: decision ttl is 30s for deny, 5s for allow", () => {
  const policy = new PolicyCenterService();

  const denyResult = policy.evaluate(makeRequest({ action: "exec_command", mode: "read-only" }));
  assert.strictEqual(denyResult.decisionTtlMs, 30_000);

  const allowResult = policy.evaluate(makeRequest());
  assert.strictEqual(allowResult.decisionTtlMs, 5_000);
});

test("policy center: evaluatedPolicyVersion is set on every decision", () => {
  const policy = new PolicyCenterService({ policyVersion: "custom-policy.v2" });
  const result = policy.evaluate(makeRequest());

  assert.strictEqual(result.evaluatedPolicyVersion, "custom-policy.v2");
});

test("policy center: toUnifiedRuntimeMode maps supervised to supervised", () => {
  const mode = PolicyCenterService.toUnifiedRuntimeMode("supervised");
  assert.strictEqual(mode, "supervised");
});

test("policy center: toUnifiedRuntimeMode maps auto to auto", () => {
  const mode = PolicyCenterService.toUnifiedRuntimeMode("auto");
  assert.strictEqual(mode, "auto");
});

test("policy center: toUnifiedRuntimeMode maps emergency to emergency", () => {
  const mode = PolicyCenterService.toUnifiedRuntimeMode("emergency");
  assert.strictEqual(mode, "emergency");
});

test("policy center: reject missing required fields", () => {
  const policy = new PolicyCenterService();

  assert.throws(() => policy.evaluate({
    decisionId: "",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "user-1",
    action: "write_file",
    riskCategory: "destructive",
    mode: "supervised",
    stage: "execute",
  }), /decisionId.*required/);

  assert.throws(() => policy.evaluate({
    decisionId: "dec-1",
    taskId: "",
    subjectType: "user",
    subjectId: "user-1",
    action: "write_file",
    riskCategory: "destructive",
    mode: "supervised",
    stage: "execute",
  }), /taskId.*required/);
});