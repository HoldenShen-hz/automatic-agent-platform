import assert from "node:assert/strict";
import test from "node:test";

import {
  capabilitiesForRole,
  evaluateAuthorizationContext,
  inferCapabilitiesForAction,
  resolvePrincipalAccessProfile,
  roleGrantsCapabilities,
  type PlatformPrincipalType,
  type PlatformRole,
  type AuthorizationAction,
  type AuthorizationContext,
} from "../../../../../src/platform/control-plane/iam/access-model.js";

function makeMockContext(overrides: Partial<AuthorizationContext> = {}): AuthorizationContext {
  return {
    tenantId: null,
    environment: "workspace",
    dataClassification: "internal",
    pluginTrusted: false,
    requiresTenantScope: false,
    manualTakeoverActive: false,
    ...overrides,
  };
}

test("PermissionEvaluator checks invoke_model permission for agent", () => {
  const result = roleGrantsCapabilities(["agent_runtime"], ["model:invoke"]);
  assert.equal(result, true);
});

test("PermissionEvaluator checks invoke_model permission denied for worker", () => {
  const result = roleGrantsCapabilities(["worker_runtime"], ["model:invoke"]);
  assert.equal(result, false);
});

test("PermissionEvaluator checks tool:invoke permission for agent", () => {
  const result = roleGrantsCapabilities(["agent_runtime"], ["tool:invoke"]);
  assert.equal(result, true);
});

test("PermissionEvaluator checks fs:write permission for agent", () => {
  const result = roleGrantsCapabilities(["agent_runtime"], ["fs:write"]);
  assert.equal(result, false);
});

test("PermissionEvaluator checks exec:command permission for human_operator", () => {
  const result = roleGrantsCapabilities(["human_operator"], ["exec:command"]);
  assert.equal(result, true);
});

test("PermissionEvaluator checks exec:command permission denied for viewer", () => {
  const result = roleGrantsCapabilities(["viewer"], ["exec:command"]);
  assert.equal(result, false);
});

test("PermissionEvaluator checks network:access permission for agent", () => {
  const result = roleGrantsCapabilities(["agent_runtime"], ["network:access"]);
  assert.equal(result, true);
});

test("PermissionEvaluator checks extension:install permission for platform_admin", () => {
  const result = roleGrantsCapabilities(["platform_admin"], ["extension:install"]);
  assert.equal(result, true);
});

test("PermissionEvaluator checks extension:install permission denied for agent", () => {
  const result = roleGrantsCapabilities(["agent_runtime"], ["extension:install"]);
  assert.equal(result, false);
});

test("PermissionEvaluator checks org:change permission for platform_admin", () => {
  const result = roleGrantsCapabilities(["platform_admin"], ["org:change"]);
  assert.equal(result, true);
});

test("PermissionEvaluator checks org:change permission denied for human_operator", () => {
  const result = roleGrantsCapabilities(["human_operator"], ["org:change"]);
  assert.equal(result, false);
});

test("PermissionEvaluator checks execution:dispatch permission for service_operator", () => {
  const result = roleGrantsCapabilities(["service_operator"], ["execution:dispatch"]);
  assert.equal(result, true);
});

test("PermissionEvaluator checks execution:dispatch permission denied for agent", () => {
  const result = roleGrantsCapabilities(["agent_runtime"], ["execution:dispatch"]);
  assert.equal(result, false);
});

test("PermissionEvaluator checks improvement:promote permission for platform_admin", () => {
  const result = roleGrantsCapabilities(["platform_admin"], ["improvement:promote"]);
  assert.equal(result, true);
});

test("PermissionEvaluator checks rollout:advance permission for service_operator", () => {
  const result = roleGrantsCapabilities(["service_operator"], ["rollout:advance"]);
  assert.equal(result, true);
});

test("PermissionEvaluator checks memory:promote permission for system_runtime", () => {
  const result = roleGrantsCapabilities(["system_runtime"], ["memory:promote"]);
  assert.equal(result, true);
});

test("PermissionEvaluator checks knowledge:trust:modify permission for service_operator", () => {
  const result = roleGrantsCapabilities(["service_operator"], ["knowledge:trust:modify"]);
  assert.equal(result, true);
});

test("PermissionEvaluator evaluates invoke_model action context", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "invoke_model",
    context: makeMockContext(),
    mode: "auto",
  });
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
});

test("PermissionEvaluator evaluates invoke_tool action context", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "invoke_tool",
    context: makeMockContext(),
    mode: "auto",
  });
  assert.equal(result.allowed, true);
});

test("PermissionEvaluator evaluates write_file action context", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "write_file",
    context: makeMockContext(),
    mode: "auto",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.capability_required");
});

test("PermissionEvaluator evaluates exec_command action in workspace", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "exec_command",
    context: makeMockContext({ environment: "workspace" }),
    mode: "auto",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.capability_required");
});

test("PermissionEvaluator evaluates network_access action for agent", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "network_access",
    context: makeMockContext(),
    mode: "auto",
  });
  assert.equal(result.allowed, true);
});

test("PermissionEvaluator evaluates install_extension action for platform_admin", () => {
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["platform_admin"],
    action: "install_extension",
    context: makeMockContext(),
    mode: "auto",
  });
  assert.equal(result.allowed, true);
});

test("PermissionEvaluator evaluates org_change action with tenant scope", () => {
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["platform_admin"],
    action: "org_change",
    context: makeMockContext({ requiresTenantScope: true, tenantId: "tenant-001" }),
    mode: "auto",
  });
  assert.equal(result.allowed, true);
});

test("PermissionEvaluator evaluates dispatch_execution action for service", () => {
  const result = evaluateAuthorizationContext({
    principalType: "service",
    roles: ["service_operator"],
    action: "dispatch_execution",
    context: makeMockContext(),
    mode: "auto",
  });
  assert.equal(result.allowed, true);
});

test("PermissionEvaluator evaluates promote_improvement action for platform_admin", () => {
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["platform_admin"],
    action: "promote_improvement",
    context: makeMockContext(),
    mode: "auto",
  });
  assert.equal(result.allowed, true);
});

test("PermissionEvaluator evaluates advance_rollout action for service_operator", () => {
  const result = evaluateAuthorizationContext({
    principalType: "service",
    roles: ["service_operator"],
    action: "advance_rollout",
    context: makeMockContext(),
    mode: "auto",
  });
  assert.equal(result.allowed, true);
});

test("PermissionEvaluator evaluates modify_knowledge_trust action for service_operator", () => {
  const result = evaluateAuthorizationContext({
    principalType: "service",
    roles: ["service_operator"],
    action: "modify_knowledge_trust",
    context: makeMockContext(),
    mode: "auto",
  });
  assert.equal(result.allowed, true);
});

test("PermissionEvaluator evaluates promote_memory_layer action for system_runtime", () => {
  const result = evaluateAuthorizationContext({
    principalType: "system",
    roles: ["system_runtime"],
    action: "promote_memory_layer",
    context: makeMockContext(),
    mode: "auto",
  });
  assert.equal(result.allowed, true);
});

test("PermissionEvaluator denies org_change without tenant scope", () => {
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["viewer"],
    action: "org_change",
    context: makeMockContext({ requiresTenantScope: true, tenantId: null }),
    mode: "auto",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.context_tenant_scope_required");
});

test("PermissionEvaluator denies plugin network access when pluginTrusted is false", () => {
  const result = evaluateAuthorizationContext({
    principalType: "plugin",
    roles: ["plugin_runtime"],
    action: "network_access",
    context: makeMockContext({ pluginTrusted: false }),
    mode: "auto",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.context_plugin_trust_required");
});

test("PermissionEvaluator allows plugin network access when pluginTrusted is true", () => {
  const result = evaluateAuthorizationContext({
    principalType: "plugin",
    roles: ["plugin_runtime"],
    action: "network_access",
    context: makeMockContext({ pluginTrusted: true }),
    mode: "auto",
  });
  assert.equal(result.allowed, true);
});

test("PermissionEvaluator requires approval for regulated data in full-auto mode", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "invoke_model",
    context: makeMockContext({ dataClassification: "regulated" }),
    riskCategory: "sensitive_data",
    mode: "full-auto",
  });
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.reasonCode, "policy.context_regulated_data_requires_approval");
});

test("PermissionEvaluator allows with manual takeover active", () => {
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["human_operator"],
    action: "invoke_tool",
    context: makeMockContext({ manualTakeoverActive: true }),
    mode: "auto",
  });
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
});

test("PermissionEvaluator returns matched rule refs", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "invoke_tool",
    context: makeMockContext(),
    mode: "auto",
  });
  assert.ok(result.matchedRuleRefs.length > 0);
  assert.equal(result.matchedRuleRefs.includes("context.default_allow"), true);
});

test("PermissionEvaluator returns constraints map", () => {
  const result = evaluateAuthorizationContext({
    principalType: "plugin",
    roles: ["plugin_runtime"],
    action: "network_access",
    context: makeMockContext({ pluginTrusted: false }),
    mode: "auto",
  });
  assert.equal(typeof result.constraints, "object");
  assert.equal(result.constraints["pluginTrusted"], false);
});

test("PermissionEvaluator grants multiple capabilities at once", () => {
  const result = roleGrantsCapabilities(["platform_admin"], [
    "model:invoke",
    "tool:invoke",
    "fs:write",
    "exec:command",
    "network:access",
  ]);
  assert.equal(result, true);
});

test("PermissionEvaluator denies when missing one capability from set", () => {
  const result = roleGrantsCapabilities(["agent_runtime"], [
    "model:invoke",
    "org:change",
  ]);
  assert.equal(result, false);
});

test("PermissionEvaluator combines multiple roles to grant capabilities", () => {
  const result = roleGrantsCapabilities(
    ["viewer", "human_operator"],
    ["fs:write", "exec:command"],
  );
  assert.equal(result, true);
});

test("PermissionEvaluator resolves profile with no explicit capabilities", () => {
  const profile = resolvePrincipalAccessProfile({
    principalType: "agent",
    roles: ["agent_runtime"],
  });
  assert.ok(profile.capabilities.includes("tool:invoke"));
  assert.ok(profile.capabilities.includes("model:invoke"));
  assert.ok(!profile.capabilities.includes("fs:write"));
  assert.ok(!profile.capabilities.includes("exec:command"));
  assert.ok(profile.capabilities.includes("network:access"));
});

test("PermissionEvaluator resolves profile with custom capabilities filtered by role grants", () => {
  const profile = resolvePrincipalAccessProfile({
    principalType: "user",
    roles: ["viewer"],
    capabilities: ["model:invoke", "tool:invoke", "network:access"],
  });
  assert.deepEqual(profile.capabilities, []);
});

test("PermissionEvaluator inferCapabilitiesForAction covers all actions", () => {
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
    assert.ok(caps.length > 0, `Expected capabilities for action ${action}`);
  }
});

test("PermissionEvaluator capabilitiesForRole covers all roles", () => {
  const roles: PlatformRole[] = [
    "viewer",
    "human_operator",
    "approver",
    "platform_admin",
    "agent_runtime",
    "service_operator",
    "worker_runtime",
    "plugin_runtime",
    "system_runtime",
  ];
  for (const role of roles) {
    const caps = capabilitiesForRole(role);
    assert.ok(Array.isArray(caps), `Expected array for role ${role}`);
  }
});

test("PermissionEvaluator context environment staging still denies exec_command without capability grant", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "exec_command",
    context: makeMockContext({ environment: "staging" }),
    mode: "auto",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.capability_required");
});

test("PermissionEvaluator context environment production requires operator for exec_command", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "exec_command",
    context: makeMockContext({ environment: "production" }),
    mode: "auto",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.context_production_operator_required");
});

test("PermissionEvaluator regulated data in auto mode requires approval", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "invoke_model",
    context: makeMockContext({ dataClassification: "regulated" }),
    riskCategory: "sensitive_data",
    mode: "auto",
  });
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
});

test("PermissionEvaluator regulated data in auto mode requires approval for sensitive risk", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "invoke_model",
    context: makeMockContext({ dataClassification: "regulated" }),
    riskCategory: "sensitive_data",
    mode: "auto",
  });
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
});

test("PermissionEvaluator regulated data in full-auto mode requires approval for sensitive risk", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "invoke_model",
    context: makeMockContext({ dataClassification: "regulated" }),
    riskCategory: "sensitive_data",
    mode: "full-auto",
  });
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
});

test("PermissionEvaluator explainSummary is human-readable", () => {
  const result = evaluateAuthorizationContext({
    principalType: "plugin",
    roles: ["plugin_runtime"],
    action: "network_access",
    context: makeMockContext({ pluginTrusted: false }),
    mode: "auto",
  });
  assert.ok(typeof result.explainSummary === "string");
  assert.ok(result.explainSummary.length > 0);
});

test("PermissionEvaluator explainSummary for manual takeover", () => {
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["human_operator"],
    action: "invoke_tool",
    context: makeMockContext({ manualTakeoverActive: true }),
    mode: "auto",
  });
  assert.ok(result.explainSummary.includes("Manual takeover") || result.explainSummary.includes("manual"));
});

test("PermissionEvaluator explainSummary for default allow", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "invoke_tool",
    context: makeMockContext(),
    mode: "auto",
  });
  assert.ok(result.explainSummary.includes("allows") || result.explainSummary.includes("allowed"));
});

test("PermissionEvaluator matchedRuleRefs contains context plugin trust when denied", () => {
  const result = evaluateAuthorizationContext({
    principalType: "plugin",
    roles: ["plugin_runtime"],
    action: "network_access",
    context: makeMockContext({ pluginTrusted: false }),
    mode: "auto",
  });
  assert.equal(result.matchedRuleRefs.includes("context.plugin_trust_required"), true);
});

test("PermissionEvaluator matchedRuleRefs contains context tenant scope when denied", () => {
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["viewer"],
    action: "org_change",
    context: makeMockContext({ requiresTenantScope: true, tenantId: null }),
    mode: "auto",
  });
  assert.equal(result.matchedRuleRefs.includes("context.tenant_scope_required"), true);
});
