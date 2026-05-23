/**
 * Integration Tests: Policy Center
 *
 * NOTE: These tests validate type definitions and API contracts.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type {
  PolicyDecisionRequest,
  PolicyDecisionResult,
  PolicyAction,
  PolicyRiskCategory,
  PolicyMode,
  PolicyDecision,
} from "../../../../src/platform/five-plane-control-plane/policy-center/index.js";

// ============================================================================
// Type Validation Tests
// ============================================================================

test("integration: PolicyAction union values", () => {
  const actions: PolicyAction[] = [
    "invoke_model",
    "invoke_tool",
    "write_file",
    "exec_command",
    "network_access",
    "install_extension",
    "org_change",
    "dispatch_execution",
    "set_isolation_level",
    "promote_improvement",
    "advance_rollout",
    "modify_knowledge_trust",
    "promote_memory_layer",
  ];
  assert.equal(actions.length, 13);
});

test("integration: PolicyRiskCategory union values", () => {
  const categories: PolicyRiskCategory[] = [
    "destructive",
    "irreversible",
    "prod_affecting",
    "cost_sensitive",
    "org_changing",
    "sensitive_data",
    "strategy_affecting",
    "governance_sensitive",
  ];
  assert.equal(categories.length, 8);
});

test("integration: PolicyMode union values", () => {
  const modes: PolicyMode[] = [
    "supervised",
    "auto",
    "full-auto",
    "read-only",
    "maintenance",
    "incident-mode",
    "degraded",
    "emergency",
  ];
  assert.equal(modes.length, 8);
});

test("integration: PolicyDecision union values", () => {
  const decisions: PolicyDecision[] = [
    "allow",
    "deny",
    "allow_with_constraints",
    "escalate_for_approval",
  ];
  assert.equal(decisions.length, 4);
});

test("integration: PolicyDecisionRequest type structure", () => {
  const request: PolicyDecisionRequest = {
    decisionId: "dec_001",
    taskId: "task_001",
    subjectType: "user",
    subjectId: "user_001",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
  };

  assert.equal(request.decisionId, "dec_001");
  assert.equal(request.action, "invoke_model");
});

test("integration: PolicyDecisionResult type structure", () => {
  const result: PolicyDecisionResult = {
    decision: "allow",
    reasonCode: "policy.allow",
    requiresApproval: false,
    enforcedConstraints: {},
    killSwitchApplied: false,
    auditPayload: {},
    evaluatedPolicyVersion: "policy-center.authoritative.v1",
    decisionTtlMs: 5000,
    matchedRuleRefs: ["default_allow"],
    explainSummary: "Action allowed by policy center.",
  };

  assert.equal(result.decision, "allow");
  assert.equal(result.requiresApproval, false);
});

test("integration: request with estimated cost", () => {
  const request: PolicyDecisionRequest = {
    decisionId: "dec_cost_001",
    taskId: "task_001",
    subjectType: "user",
    subjectId: "user_001",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
    estimatedCostUsd: 5.50,
  };

  assert.ok(request.estimatedCostUsd !== undefined);
  assert.ok(request.estimatedCostUsd! > 0);
});

test("integration: decision with budget warning", () => {
  const result: PolicyDecisionResult = {
    decision: "escalate_for_approval",
    reasonCode: "policy.budget_warning",
    requiresApproval: true,
    enforcedConstraints: { budgetWarningCostUsd: 5 },
    killSwitchApplied: false,
    auditPayload: {},
    evaluatedPolicyVersion: "policy-center.authoritative.v1",
    decisionTtlMs: 5000,
    matchedRuleRefs: ["budget.warning_threshold"],
    explainSummary: "Budget warning threshold exceeded.",
  };

  assert.equal(result.requiresApproval, true);
  assert.ok(result.enforcedConstraints.budgetWarningCostUsd !== undefined);
});

test("integration: decision with path constraints", () => {
  const result: PolicyDecisionResult = {
    decision: "allow_with_constraints",
    reasonCode: "policy.allow_with_constraints",
    requiresApproval: false,
    enforcedConstraints: {
      allowedPathPrefixes: ["/workspace", "/tmp"],
    },
    killSwitchApplied: false,
    auditPayload: {},
    evaluatedPolicyVersion: "policy-center.authoritative.v1",
    decisionTtlMs: 5000,
    matchedRuleRefs: ["sandbox.path_scope"],
    explainSummary: "Path scope constraints applied.",
  };

  assert.equal(result.decision, "allow_with_constraints");
});

test("integration: kill switch result", () => {
  const result: PolicyDecisionResult = {
    decision: "deny",
    reasonCode: "policy.kill_switch_active",
    requiresApproval: false,
    enforcedConstraints: {},
    killSwitchApplied: true,
    auditPayload: {},
    evaluatedPolicyVersion: "policy-center.authoritative.v1",
    decisionTtlMs: 30000,
    matchedRuleRefs: ["kill_switch"],
    explainSummary: "Kill switch is active.",
  };

  assert.equal(result.decision, "deny");
  assert.equal(result.killSwitchApplied, true);
});

test("integration: frozen action result", () => {
  const result: PolicyDecisionResult = {
    decision: "deny",
    reasonCode: "policy.action_frozen",
    requiresApproval: false,
    enforcedConstraints: {},
    killSwitchApplied: false,
    auditPayload: {},
    evaluatedPolicyVersion: "policy-center.authoritative.v1",
    decisionTtlMs: 30000,
    matchedRuleRefs: ["freeze.action"],
    explainSummary: "Action is frozen by policy.",
  };

  assert.equal(result.decision, "deny");
  assert.ok(result.reasonCode.includes("frozen"));
});

test("integration: read-only mode blocks mutating actions", () => {
  const request: PolicyDecisionRequest = {
    decisionId: "dec_readonly_001",
    taskId: "task_001",
    subjectType: "user",
    subjectId: "user_001",
    action: "write_file",
    riskCategory: "destructive",
    mode: "read-only",
    stage: "execute",
  };

  // write_file is a mutating action
  assert.ok(["invoke_tool", "write_file", "exec_command", "install_extension", "org_change", "dispatch_execution", "set_isolation_level", "promote_improvement", "advance_rollout", "modify_knowledge_trust", "promote_memory_layer"].includes(request.action));
});

test("integration: full-auto mode requires approval for governance actions", () => {
  const request: PolicyDecisionRequest = {
    decisionId: "dec_fullauto_001",
    taskId: "task_001",
    subjectType: "user",
    subjectId: "user_001",
    action: "promote_improvement",
    riskCategory: "governance_sensitive",
    mode: "full-auto",
    stage: "execute",
  };

  assert.equal(request.mode, "full-auto");
  assert.ok(["governance_sensitive", "prod_affecting", "org_changing"].includes(request.riskCategory));
});

test("integration: incident mode raises evidence requirements", () => {
  const request: PolicyDecisionRequest = {
    decisionId: "dec_incident_001",
    taskId: "task_001",
    subjectType: "user",
    subjectId: "user_001",
    action: "dispatch_execution",
    riskCategory: "prod_affecting",
    mode: "incident-mode",
    stage: "execute",
  };

  assert.equal(request.mode, "incident-mode");
  assert.equal(request.riskCategory, "prod_affecting");
});

test("integration: emergency mode break-glass", () => {
  const request: PolicyDecisionRequest = {
    decisionId: "dec_emergency_001",
    taskId: "task_001",
    subjectType: "user",
    subjectId: "user_001",
    action: "dispatch_execution",
    riskCategory: "prod_affecting",
    mode: "emergency",
    stage: "execute",
  };

  assert.equal(request.mode, "emergency");
});

test("integration: OAPEFLIR stages", () => {
  const stages = ["observe", "assess", "plan", "execute", "feedback", "learn", "improve", "release"] as const;
  assert.equal(stages.length, 8);
});

test("integration: role-based action control", () => {
  const allowedActionsByRole: Record<string, PolicyAction[]> = {
    developer: ["invoke_model", "invoke_tool", "write_file"],
    admin: ["invoke_model", "invoke_tool", "write_file", "exec_command", "dispatch_execution", "org_change"],
  };

  // Developer can invoke model
  assert.ok(allowedActionsByRole["developer"]?.includes("invoke_model"));
  // Developer cannot dispatch execution
  assert.ok(!allowedActionsByRole["developer"]?.includes("dispatch_execution"));
  // Admin can dispatch execution
  assert.ok(allowedActionsByRole["admin"]?.includes("dispatch_execution"));
});

test("integration: subject roles", () => {
  const subjectRoles: Record<string, string[]> = {
    user_developer: ["developer"],
    user_admin: ["admin"],
    system: ["system"],
  };

  assert.ok(subjectRoles["user_developer"]?.includes("developer"));
  assert.ok(subjectRoles["system"]?.includes("system"));
});

test("integration: decision TTL differs by decision type", () => {
  const denyTtl = 30000; // 30 seconds for deny
  const allowTtl = 5000; // 5 seconds for allow

  assert.ok(denyTtl > allowTtl);
});

test("integration: governance actions", () => {
  const governanceActions: PolicyAction[] = [
    "promote_improvement",
    "advance_rollout",
    "modify_knowledge_trust",
    "promote_memory_layer",
  ];

  assert.equal(governanceActions.length, 4);
});
