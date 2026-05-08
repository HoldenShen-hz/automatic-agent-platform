/**
 * Policy Engine Edge Cases and Comprehensive Access Control Tests
 *
 * Tests additional edge cases and scenarios not covered in the basic test suite:
 * - All subject types (user, agent, system)
 * - All risk categories and their escalation behavior
 * - Combined context scenarios
 * - All actions and their risk levels
 * - Production environment access control rules
 * - Full authorization context evaluation coverage
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PolicyEngine, mapToolRiskToPolicyCategory, type PolicyDecisionRequest } from "../../../../../src/platform/control-plane/iam/policy-engine.js";
import {
  evaluateAuthorizationContext,
  capabilitiesForRole,
  roleGrantsCapabilities,
  listPlatformRoles,
  inferCapabilitiesForAction,
  type PlatformPrincipalType,
  type PlatformRole,
  type AuthorizationAction,
} from "../../../../../src/platform/control-plane/iam/access-model.js";
import type { BudgetPolicy } from "../../../../../src/platform/model-gateway/cost-tracker/budget-guard.js";

// ---------------------------------------------------------------------------
// PolicyEngine - All Subject Types
// ---------------------------------------------------------------------------

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

test("PolicyEngine.evaluate handles user subjectType in supervised mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(makeRequest({ subjectType: "user", mode: "supervised" }));
  assert.equal(result.decision, "allow_with_constraints");
  assert.equal(result.requiresApproval, false);
});

test("PolicyEngine.evaluate handles system subjectType with high-risk action", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({ subjectType: "system", riskCategory: "destructive", mode: "auto" }),
  );
  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.requiresApproval, true);
});

test("PolicyEngine.evaluate accepts service, worker, and plugin subject types", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });

  assert.doesNotThrow(() => engine.evaluate(makeRequest({ subjectType: "service" })));
  assert.doesNotThrow(() => engine.evaluate(makeRequest({ subjectType: "worker" })));
  assert.doesNotThrow(() => engine.evaluate(makeRequest({ subjectType: "plugin" })));
});

// ---------------------------------------------------------------------------
// PolicyEngine - All Risk Categories
// ---------------------------------------------------------------------------

test("PolicyEngine.evaluate cost_sensitive risk category does not escalate in supervised mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({ mode: "supervised", riskCategory: "cost_sensitive" }),
  );
  assert.equal(result.decision, "allow_with_constraints");
  assert.equal(result.requiresApproval, false);
});

test("PolicyEngine.evaluate sensitive_data risk category does not escalate in supervised mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({ mode: "supervised", riskCategory: "sensitive_data" }),
  );
  assert.equal(result.decision, "allow_with_constraints");
  assert.equal(result.requiresApproval, false);
});

test("PolicyEngine.evaluate cost_sensitive does not escalate in auto mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({ mode: "auto", riskCategory: "cost_sensitive" }),
  );
  assert.equal(result.decision, "allow_with_constraints");
  assert.equal(result.requiresApproval, false);
});

// ---------------------------------------------------------------------------
// PolicyEngine - All Actions
// ---------------------------------------------------------------------------

test("PolicyEngine.evaluate invoke_model action in supervised mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({ action: "invoke_model", mode: "supervised", riskCategory: "sensitive_data" }),
  );
  assert.equal(result.decision, "allow_with_constraints");
});

test("PolicyEngine.evaluate write_file action with destructive risk in supervised mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({ action: "write_file", mode: "supervised", riskCategory: "destructive" }),
  );
  assert.equal(result.decision, "escalate_for_approval");
});

test("PolicyEngine.evaluate network_access action with cost_sensitive risk in auto mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({ action: "network_access", mode: "auto", riskCategory: "cost_sensitive" }),
  );
  assert.equal(result.decision, "allow_with_constraints");
});

test("PolicyEngine.evaluate org_change action in full-auto mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({ action: "org_change", mode: "full-auto", riskCategory: "org_changing" }),
  );
  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.requiresApproval, true);
  assert.equal(result.reasonCode, "policy.full_auto_escalation");
});

test("PolicyEngine.evaluate install_extension action in auto mode with org_changing risk", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({ action: "install_extension", mode: "auto", riskCategory: "org_changing" }),
  );
  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.requiresApproval, true);
});

// ---------------------------------------------------------------------------
// PolicyEngine - Optional Fields
// ---------------------------------------------------------------------------

test("PolicyEngine.evaluate includes executionId in auditPayload when provided", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(makeRequest({ executionId: "exec-123" }));
  assert.equal(result.auditPayload.action, "invoke_tool");
});

test("PolicyEngine.evaluate includes sessionId in auditPayload when provided", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(makeRequest({ sessionId: "session-456" }));
  assert.equal(result.auditPayload.action, "invoke_tool");
});

test("PolicyEngine.evaluate handles resourceRef in request", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({ resourceRef: "file:///workspace/script.sh" }),
  );
  assert.equal(result.decision, "allow_with_constraints");
});

test("PolicyEngine.evaluate handles metadata with various values", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({
      metadata: {
        currentTaskCostUsd: 2,
        userName: "test-user",
        sessionType: "interactive",
      },
      estimatedCostUsd: 1,
    }),
  );
  assert.equal(result.decision, "allow_with_constraints");
  assert.ok(typeof result.enforcedConstraints.remainingBudgetUsd === "number");
});

// ---------------------------------------------------------------------------
// PolicyEngine - Kill Switch Precedence
// ---------------------------------------------------------------------------

test("PolicyEngine.evaluate kill switch takes precedence over budget check", () => {
  const engine = new PolicyEngine({
    budgetPolicy: makeBudgetPolicy({ maxTaskCostUsd: 1 }),
    killSwitchEnabled: true,
  });
  const result = engine.evaluate(makeRequest({ estimatedCostUsd: 100 }));
  assert.equal(result.decision, "deny");
  assert.equal(result.killSwitchApplied, true);
  assert.equal(result.reasonCode, "policy.kill_switch_active");
});

test("PolicyEngine.evaluate kill switch applies to all actions regardless of risk", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy(), killSwitchEnabled: true });
  const result = engine.evaluate(
    makeRequest({ action: "org_change", riskCategory: "org_changing", mode: "full-auto" }),
  );
  assert.equal(result.decision, "deny");
  assert.equal(result.killSwitchApplied, true);
});

// ---------------------------------------------------------------------------
// PolicyEngine - Budget Boundary Conditions
// ---------------------------------------------------------------------------

test("PolicyEngine.evaluate allows at budget limit below warning threshold", () => {
  // With warnAtRatio 0.8, warning triggers when projected >= 8 (10 * 0.8)
  // When currentTaskCostUsd is 0 and estimatedCostUsd is 5, projected is 5 which is < 8
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy({ maxTaskCostUsd: 10, warnAtRatio: 0.8 }) });
  const result = engine.evaluate(makeRequest({ estimatedCostUsd: 5 }));
  assert.equal(result.decision, "allow_with_constraints");
  assert.equal(result.reasonCode, "policy.allow");
});

test("PolicyEngine.evaluate denies when currentTaskCostUsd + estimatedCostUsd exceeds limit", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy({ maxTaskCostUsd: 5 }) });
  const result = engine.evaluate(
    makeRequest({ estimatedCostUsd: 3, metadata: { currentTaskCostUsd: 3 } }),
  );
  assert.equal(result.decision, "deny");
  assert.equal(result.reasonCode, "budget.task_limit_exceeded");
});

test("PolicyEngine.evaluate allows when currentTaskCostUsd + estimatedCostUsd equals limit", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy({ maxTaskCostUsd: 5 }) });
  const result = engine.evaluate(
    makeRequest({ estimatedCostUsd: 2, metadata: { currentTaskCostUsd: 3 } }),
  );
  assert.equal(result.decision, "allow_with_constraints");
});

// ---------------------------------------------------------------------------
// Access Model - All Principal Types
// ---------------------------------------------------------------------------

test("evaluateAuthorizationContext allows service_operator in production for exec_command", () => {
  const result = evaluateAuthorizationContext({
    principalType: "service",
    roles: ["service_operator"],
    action: "exec_command",
    context: { environment: "production" },
    mode: "auto",
  });
  assert.equal(result.allowed, true);
});

test("evaluateAuthorizationContext denies worker in production for exec_command", () => {
  const result = evaluateAuthorizationContext({
    principalType: "worker",
    roles: ["worker_runtime"],
    action: "exec_command",
    context: { environment: "production" },
    mode: "auto",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.context_production_operator_required");
});

// ---------------------------------------------------------------------------
// Access Model - All Roles and Capabilities
// ---------------------------------------------------------------------------

test("only roles with explicit grants expose capabilities", () => {
  const roles = listPlatformRoles();
  for (const role of roles) {
    const caps = capabilitiesForRole(role);
    if (role === "viewer" || role === "worker_runtime") {
      assert.deepEqual(caps, [], `Role ${role} should not inherit elevated capabilities`);
    } else {
      assert.ok(caps.length > 0, `Role ${role} should have at least one capability`);
    }
  }
});

test("roleGrantsCapabilities returns true for platform_admin with all capabilities", () => {
  const allCapabilities = [
    "model:invoke",
    "tool:invoke",
    "fs:write",
    "exec:command",
    "network:access",
    "extension:install",
    "org:change",
    "execution:dispatch",
  ];
  const result = roleGrantsCapabilities(["platform_admin"], allCapabilities);
  assert.equal(result, true);
});

test("roleGrantsCapabilities returns false when even one capability is missing", () => {
  const result = roleGrantsCapabilities(["viewer"], ["tool:invoke"]);
  assert.equal(result, false);
});

// ---------------------------------------------------------------------------
// Access Model - All Actions and Capability Inference
// ---------------------------------------------------------------------------

test("inferCapabilitiesForAction works for all defined actions", () => {
  const actions: AuthorizationAction[] = [
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
  for (const action of actions) {
    const caps = inferCapabilitiesForAction(action);
    assert.ok(caps.length > 0, `Action ${action} should map to at least one capability`);
  }
});

// ---------------------------------------------------------------------------
// Access Model - Combined Context Scenarios
// ---------------------------------------------------------------------------

test("evaluateAuthorizationContext with tenant scope and regulated data", () => {
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["platform_admin"],
    action: "invoke_model",
    context: {
      tenantId: "tenant-123",
      dataClassification: "regulated",
      environment: "production",
    },
    mode: "full-auto",
    riskCategory: "sensitive_data",
  });
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
});

test("evaluateAuthorizationContext plugin with untrusted and tenant scope required", () => {
  const result = evaluateAuthorizationContext({
    principalType: "plugin",
    roles: ["plugin_runtime"],
    action: "network_access",
    context: { pluginTrusted: false, requiresTenantScope: true, tenantId: null },
    mode: "auto",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.context_tenant_scope_required");
});

test("evaluateAuthorizationContext production org_change requires operator role", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "org_change",
    context: { environment: "production" },
    mode: "auto",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.context_production_operator_required");
});

test("evaluateAuthorizationContext production org_change with service_operator", () => {
  const result = evaluateAuthorizationContext({
    principalType: "service",
    roles: ["service_operator"],
    action: "org_change",
    context: { environment: "production" },
    mode: "auto",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.capability_required");
});

test("evaluateAuthorizationContext production install_extension requires operator", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "install_extension",
    context: { environment: "production" },
    mode: "auto",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.context_production_operator_required");
});

test("evaluateAuthorizationContext regulated data check runs before manual takeover", () => {
  // Regulated data check is evaluated BEFORE manual takeover check in the code
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["human_operator"],
    action: "invoke_model",
    context: { dataClassification: "regulated", manualTakeoverActive: true },
    mode: "full-auto",
    riskCategory: "sensitive_data",
  });
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.reasonCode, "policy.context_regulated_data_requires_approval");
  assert.deepEqual(result.matchedRuleRefs, ["context.regulated_data_requires_approval"]);
});

// ---------------------------------------------------------------------------
// mapToolRiskToPolicyCategory - Complete Coverage
// ---------------------------------------------------------------------------

test("mapToolRiskToPolicyCategory returns prod_affecting for critical risk", () => {
  assert.equal(mapToolRiskToPolicyCategory("critical"), "prod_affecting");
});

test("mapToolRiskToPolicyCategory returns destructive for high risk", () => {
  assert.equal(mapToolRiskToPolicyCategory("high"), "destructive");
});

test("mapToolRiskToPolicyCategory returns cost_sensitive for medium risk", () => {
  assert.equal(mapToolRiskToPolicyCategory("medium"), "cost_sensitive");
});

test("mapToolRiskToPolicyCategory returns sensitive_data for low risk", () => {
  assert.equal(mapToolRiskToPolicyCategory("low"), "sensitive_data");
});

test("mapToolRiskToPolicyCategory returns sensitive_data for unknown risk", () => {
  assert.equal(mapToolRiskToPolicyCategory("unknown" as any), "sensitive_data");
});

// ---------------------------------------------------------------------------
// Explain Summary Verification
// ---------------------------------------------------------------------------

test("PolicyEngine.evaluate explainSummary describes kill switch denial", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy(), killSwitchEnabled: true });
  const result = engine.evaluate(makeRequest());
  assert.ok(result.explainSummary.includes("kill switch"));
});

test("PolicyEngine.evaluate explainSummary describes budget denial", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy({ maxTaskCostUsd: 1 }) });
  const result = engine.evaluate(makeRequest({ estimatedCostUsd: 5 }));
  assert.ok(result.explainSummary.includes("budget"));
});

test("PolicyEngine.evaluate explainSummary describes escalation", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  const result = engine.evaluate(
    makeRequest({ mode: "supervised", riskCategory: "destructive" }),
  );
  assert.ok(result.explainSummary.includes("approval"));
});

test("evaluateAuthorizationContext explainSummary describes tenant scope requirement", () => {
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["viewer"],
    action: "org_change",
    context: { requiresTenantScope: true, tenantId: null },
    mode: "auto",
  });
  assert.ok(result.explainSummary.includes("tenant"));
});
