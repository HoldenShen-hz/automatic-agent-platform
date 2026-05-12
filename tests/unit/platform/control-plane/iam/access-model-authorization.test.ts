import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateAuthorizationContext,
  inferCapabilitiesForAction,
  listPlatformRoles,
  PlatformPrincipalType,
  PlatformRole,
  roleGrantsCapabilities,
} from "../../../../../src/platform/control-plane/iam/access-model.js";

const ALL_ROLES = listPlatformRoles();

test("roleGrantsCapabilities returns true when all required capabilities are granted", () => {
  assert.equal(roleGrantsCapabilities(["platform_admin"], ["model:invoke"]), true);
  assert.equal(roleGrantsCapabilities(["platform_admin"], ["model:invoke", "tool:invoke", "fs:write"]), true);
  assert.equal(roleGrantsCapabilities(["worker_runtime"], ["tool:invoke", "fs:write", "exec:command"]), true);
});

test("roleGrantsCapabilities returns false when any required capability is missing", () => {
  assert.equal(roleGrantsCapabilities(["viewer"], ["tool:invoke"]), false);
  assert.equal(roleGrantsCapabilities(["worker_runtime"], ["model:invoke"]), false);
  assert.equal(roleGrantsCapabilities(["agent_runtime"], ["extension:install"]), false);
});

test("roleGrantsCapabilities returns true with multiple roles combining capabilities", () => {
  assert.equal(roleGrantsCapabilities(["viewer", "worker_runtime"], ["tool:invoke"]), true);
  assert.equal(roleGrantsCapabilities(["viewer", "agent_runtime"], ["tool:invoke", "model:invoke"]), true);
});

test("roleGrantsCapabilities returns true for empty required capabilities", () => {
  assert.equal(roleGrantsCapabilities(["viewer"], []), true);
});

test("evaluateAuthorizationContext rejects when tenant scope is required but missing", () => {
  // Issue 1941: platform_admin has org:change capability, so we test tenant scope check
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["platform_admin"],
    action: "org_change",
    context: { requiresTenantScope: true },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.context_tenant_scope_required");
  assert.deepEqual(result.matchedRuleRefs, ["context.tenant_scope_required"]);
  assert.equal(result.requiresApproval, false);
});

test("evaluateAuthorizationContext allows when tenant scope is provided", () => {
  // Issue 1941: platform_admin has org:change capability and org is granted
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["platform_admin"],
    action: "org_change",
    context: { requiresTenantScope: true, tenantId: "tenant-123" },
  });

  assert.equal(result.allowed, true);
});

test("evaluateAuthorizationContext rejects production exec_command without operator role", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "exec_command",
    context: { environment: "production" },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.context_production_operator_required");
  assert.deepEqual(result.matchedRuleRefs, ["context.production_operator_required"]);
  assert.deepEqual(result.constraints.requiredRoles, ["platform_admin", "human_operator", "service_operator"]);
});

test("evaluateAuthorizationContext allows production exec_command with platform_admin", () => {
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["platform_admin"],
    action: "exec_command",
    context: { environment: "production" },
  });

  assert.equal(result.allowed, true);
});

test("evaluateAuthorizationContext allows production exec_command with human_operator", () => {
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["human_operator"],
    action: "exec_command",
    context: { environment: "production" },
  });

  assert.equal(result.allowed, true);
});

test("evaluateAuthorizationContext allows production exec_command with service_operator", () => {
  const result = evaluateAuthorizationContext({
    principalType: "service",
    roles: ["service_operator"],
    action: "exec_command",
    context: { environment: "production" },
  });

  assert.equal(result.allowed, true);
});

test("evaluateAuthorizationContext rejects production org_change without operator role", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "org_change",
    context: { environment: "production" },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.context_production_operator_required");
});

test("evaluateAuthorizationContext rejects production install_extension without operator role", () => {
  const result = evaluateAuthorizationContext({
    principalType: "plugin",
    roles: ["plugin_runtime"],
    action: "install_extension",
    context: { environment: "production" },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.context_production_operator_required");
});

test("evaluateAuthorizationContext allows non-production environment exec_command for agent", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "exec_command",
    context: { environment: "staging" },
  });

  assert.equal(result.allowed, true);
});

test("evaluateAuthorizationContext rejects untrusted plugin network_access", () => {
  const result = evaluateAuthorizationContext({
    principalType: "plugin",
    roles: ["plugin_runtime"],
    action: "network_access",
    context: { pluginTrusted: false },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.context_plugin_trust_required");
  assert.deepEqual(result.matchedRuleRefs, ["context.plugin_trust_required"]);
});

test("evaluateAuthorizationContext allows trusted plugin network_access", () => {
  const result = evaluateAuthorizationContext({
    principalType: "plugin",
    roles: ["plugin_runtime"],
    action: "network_access",
    context: { pluginTrusted: true },
  });

  assert.equal(result.allowed, true);
});

test("evaluateAuthorizationContext blocks plugin network_access when context is absent", () => {
  const result = evaluateAuthorizationContext({
    principalType: "plugin",
    roles: ["plugin_runtime"],
    action: "network_access",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.context_plugin_trust_required");
});

test("evaluateAuthorizationContext allows non-plugin principal network_access without special context", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "network_access",
  });

  assert.equal(result.allowed, true);
});

test("evaluateAuthorizationContext requires approval for regulated data with full-auto mode", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "invoke_model",
    context: { dataClassification: "regulated" },
    mode: "full-auto",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.reasonCode, "policy.context_regulated_data_requires_approval");
});

test("evaluateAuthorizationContext requires approval for regulated data with sensitive_data risk", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "invoke_tool",
    context: { dataClassification: "regulated" },
    riskCategory: "sensitive_data",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.reasonCode, "policy.context_regulated_data_requires_approval");
});

test("evaluateAuthorizationContext allows regulated data without full-auto or sensitive_data", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "invoke_model",
    context: { dataClassification: "regulated" },
    mode: "auto",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
});

test("evaluateAuthorizationContext records manual takeover and allows without approval", () => {
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["human_operator"],
    action: "exec_command",
    context: { manualTakeoverActive: true },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.reasonCode, null);
  assert.deepEqual(result.matchedRuleRefs, ["context.manual_takeover_active"]);
});

test("evaluateAuthorizationContext returns default deny for actions without granted capability", () => {
  // Issue 1941: viewer has no capabilities, so invoke_model is denied even without other context checks
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["viewer"],
    action: "invoke_model",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.capability_not_granted");
  assert.deepEqual(result.matchedRuleRefs, ["role.capability_required"]);
});

test("evaluateAuthorizationContext records manualTakeoverActive for non-production-restricted actions", () => {
  // Issue 1941: Use human_operator which has model:invoke capability to test manualTakeoverActive override
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["human_operator"],
    action: "invoke_model",
    context: { environment: "production", manualTakeoverActive: true },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.deepEqual(result.matchedRuleRefs, ["context.manual_takeover_active"]);
});

test("inferCapabilitiesForAction maps all authorization actions to capabilities", () => {
  assert.deepEqual(inferCapabilitiesForAction("invoke_model"), ["model:invoke"]);
  assert.deepEqual(inferCapabilitiesForAction("invoke_tool"), ["tool:invoke"]);
  assert.deepEqual(inferCapabilitiesForAction("write_file"), ["fs:write"]);
  assert.deepEqual(inferCapabilitiesForAction("exec_command"), ["exec:command"]);
  assert.deepEqual(inferCapabilitiesForAction("network_access"), ["network:access"]);
  assert.deepEqual(inferCapabilitiesForAction("install_extension"), ["extension:install"]);
  assert.deepEqual(inferCapabilitiesForAction("org_change"), ["org:change"]);
  assert.deepEqual(inferCapabilitiesForAction("dispatch_execution"), ["execution:dispatch"]);
  assert.deepEqual(inferCapabilitiesForAction("set_isolation_level"), ["execution:dispatch"]);
  assert.deepEqual(inferCapabilitiesForAction("promote_improvement"), ["improvement:promote"]);
  assert.deepEqual(inferCapabilitiesForAction("advance_rollout"), ["rollout:advance"]);
  assert.deepEqual(inferCapabilitiesForAction("modify_knowledge_trust"), ["knowledge:trust:modify"]);
  assert.deepEqual(inferCapabilitiesForAction("promote_memory_layer"), ["memory:promote"]);
});

test("evaluateAuthorizationContext workspace environment does not trigger production checks", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "exec_command",
    context: { environment: "workspace" },
  });

  assert.equal(result.allowed, true);
});

test("evaluateAuthorizationContext context is optional", () => {
  const result = evaluateAuthorizationContext({
    principalType: "system",
    roles: ["system_runtime"],
    action: "dispatch_execution",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
});

test("evaluateAuthorizationContext production with staging environment does not block", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "exec_command",
    context: { environment: "staging" },
  });

  assert.equal(result.allowed, true);
});

test("evaluateAuthorizationContext internal data classification does not trigger approval", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "invoke_model",
    context: { dataClassification: "internal" },
    mode: "full-auto",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
});

test("evaluateAuthorizationContext confidential data without full-auto does not trigger approval", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "invoke_model",
    context: { dataClassification: "confidential" },
    mode: "auto",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
});

test("roleGrantsCapabilities works with all roles", () => {
  for (const role of ALL_ROLES) {
    const caps: PlatformRole[] = [];
    const result = roleGrantsCapabilities([role], caps);
    assert.equal(result, true, `roleGrantsCapabilities([${role}], []) should return true`);
  }
});

test("evaluateAuthorizationContext returns explainSummary for all scenarios", () => {
  const tenantResult = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["human_operator"],
    action: "org_change",
    context: { requiresTenantScope: true },
  });
  assert.ok(tenantResult.explainSummary.length > 0);

  const pluginResult = evaluateAuthorizationContext({
    principalType: "plugin",
    roles: ["plugin_runtime"],
    action: "network_access",
    context: { pluginTrusted: false },
  });
  assert.ok(pluginResult.explainSummary.length > 0);

  const defaultResult = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["human_operator"],
    action: "invoke_model",
  });
  assert.ok(defaultResult.explainSummary.length > 0);
});

/**
 * R33-02: verify viewer cannot authorize exec_command.
 * The viewer role has no capabilities (empty array), so it cannot grant
 * exec:command which is required for exec_command action.
 */
test("R33-02: viewer cannot authorize exec_command", () => {
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["viewer"],
    action: "exec_command",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.capability_not_granted");
  assert.deepEqual(result.matchedRuleRefs, ["role.capability_required"]);
  assert.ok(result.explainSummary.includes("viewer") && result.explainSummary.includes("exec_command"));
});

/**
 * R33-02: verify that roles with exec:command capability CAN authorize exec_command.
 */
test("R33-02: roles with exec:command capability can authorize exec_command", () => {
  // human_operator has exec:command in its capabilities
  const humanOpResult = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["human_operator"],
    action: "exec_command",
  });
  assert.equal(humanOpResult.allowed, true);

  // agent_runtime has exec:command in its capabilities
  const agentResult = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "exec_command",
  });
  assert.equal(agentResult.allowed, true);

  // worker_runtime has exec:command in its capabilities
  const workerResult = evaluateAuthorizationContext({
    principalType: "worker",
    roles: ["worker_runtime"],
    action: "exec_command",
  });
  assert.equal(workerResult.allowed, true);
});