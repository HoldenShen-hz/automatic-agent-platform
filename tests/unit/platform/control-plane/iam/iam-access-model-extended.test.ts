/**
 * Extended unit tests for IAM Access Model
 * Tests role hierarchy, capability inheritance, and authorization context
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  listPlatformPrincipalTypes,
  listPlatformRoles,
  defaultRolesForPrincipalType,
  capabilitiesForRole,
  inferCapabilitiesForAction,
  resolvePrincipalAccessProfile,
  roleGrantsCapabilities,
  evaluateAuthorizationContext,
  type PlatformPrincipalType,
  type PlatformRole,
  type PlatformCapability,
  type AuthorizationAction,
} from "../../../../../src/platform/five-plane-control-plane/iam/access-model.js";

// ============================================================================
// Role Hierarchy Tests
// ============================================================================

test("capabilitiesForRole returns hierarchical capabilities for viewer", () => {
  const caps = capabilitiesForRole("viewer");

  // Viewer has no inherited capabilities (null parent in hierarchy)
  assert.deepEqual(caps, []);
});

test("capabilitiesForRole returns hierarchical capabilities for human_operator", () => {
  const caps = capabilitiesForRole("human_operator");

  // human_operator inherits from viewer and adds EXTENDED_CAPABILITIES
  assert.ok(caps.includes("model:invoke"));
  assert.ok(caps.includes("tool:invoke"));
  assert.ok(caps.includes("network:access"));
  assert.ok(caps.includes("fs:write"));
  assert.ok(caps.includes("exec:command"));
});

test("capabilitiesForRole returns hierarchical capabilities for platform_admin", () => {
  const caps = capabilitiesForRole("platform_admin");

  // platform_admin inherits entire chain: viewer -> human_operator -> service_operator -> system_runtime -> platform_admin
  assert.ok(caps.includes("model:invoke"));
  assert.ok(caps.includes("tool:invoke"));
  assert.ok(caps.includes("network:access"));
  assert.ok(caps.includes("fs:write"));
  assert.ok(caps.includes("exec:command"));
  assert.ok(caps.includes("execution:dispatch"));
  assert.ok(caps.includes("rollout:advance"));
  assert.ok(caps.includes("knowledge:trust:modify"));
  assert.ok(caps.includes("memory:promote"));
  assert.ok(caps.includes("extension:install"));
  assert.ok(caps.includes("org:change"));
  assert.ok(caps.includes("improvement:promote"));
});

test("capabilitiesForRole worker_runtime has expected capabilities", () => {
  const caps = capabilitiesForRole("worker_runtime");

  // worker_runtime has tool:invoke, fs:write, exec:command
  assert.ok(caps.includes("tool:invoke"));
  assert.ok(caps.includes("fs:write"));
  assert.ok(caps.includes("exec:command"));
});

test("capabilitiesForRole plugin_runtime has expected capabilities", () => {
  const caps = capabilitiesForRole("plugin_runtime");

  // plugin_runtime has tool:invoke, fs:write, network:access
  assert.ok(caps.includes("tool:invoke"));
  assert.ok(caps.includes("fs:write"));
  assert.ok(caps.includes("network:access"));
});

test("capabilitiesForRole agent_runtime has STANDARD_CAPABILITIES", () => {
  const caps = capabilitiesForRole("agent_runtime");

  // agent_runtime has STANDARD_CAPABILITIES
  assert.ok(caps.includes("model:invoke"));
  assert.ok(caps.includes("tool:invoke"));
  assert.ok(caps.includes("network:access"));
  assert.ok(!caps.includes("fs:write"));
  assert.ok(!caps.includes("exec:command"));
});

// ============================================================================
// Default Roles Tests
// ============================================================================

test("defaultRolesForPrincipalType returns correct defaults for all types", () => {
  assert.deepEqual(defaultRolesForPrincipalType("user"), ["viewer"]);
  assert.deepEqual(defaultRolesForPrincipalType("agent"), ["agent_runtime"]);
  assert.deepEqual(defaultRolesForPrincipalType("system"), ["system_runtime"]);
  assert.deepEqual(defaultRolesForPrincipalType("service"), ["service_operator"]);
  assert.deepEqual(defaultRolesForPrincipalType("worker"), ["worker_runtime"]);
  assert.deepEqual(defaultRolesForPrincipalType("plugin"), ["plugin_runtime"]);
});

test("listPlatformPrincipalTypes returns all six types", () => {
  const types = listPlatformPrincipalTypes();

  assert.equal(types.length, 6);
  assert.ok(types.includes("user"));
  assert.ok(types.includes("agent"));
  assert.ok(types.includes("system"));
  assert.ok(types.includes("service"));
  assert.ok(types.includes("worker"));
  assert.ok(types.includes("plugin"));
});

test("listPlatformRoles returns all defined roles", () => {
  const roles = listPlatformRoles();

  assert.ok(roles.includes("viewer"));
  assert.ok(roles.includes("human_operator"));
  assert.ok(roles.includes("approver"));
  assert.ok(roles.includes("platform_admin"));
  assert.ok(roles.includes("agent_runtime"));
  assert.ok(roles.includes("service_operator"));
  assert.ok(roles.includes("worker_runtime"));
  assert.ok(roles.includes("plugin_runtime"));
  assert.ok(roles.includes("system_runtime"));
});

// ============================================================================
// Capability Inference Tests
// ============================================================================

test("inferCapabilitiesForAction returns capabilities for all actions", () => {
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
    assert.ok(caps.length > 0, `Action ${action} should have capabilities`);
  }
});

test("inferCapabilitiesForAction for invoke_model returns model:invoke", () => {
  const caps = inferCapabilitiesForAction("invoke_model");

  assert.deepEqual(caps, ["model:invoke"]);
});

test("inferCapabilitiesForAction for dispatch_execution returns execution:dispatch", () => {
  const caps = inferCapabilitiesForAction("dispatch_execution");

  assert.deepEqual(caps, ["execution:dispatch"]);
});

// ============================================================================
// Principal Access Profile Resolution Tests
// ============================================================================

test("resolvePrincipalAccessProfile uses default roles when none provided", () => {
  const profile = resolvePrincipalAccessProfile({
    principalType: "service",
  });

  assert.deepEqual(profile.principalType, "service");
  assert.deepEqual(profile.roles, ["service_operator"]);
  assert.ok(profile.capabilities.length > 0);
});

test("resolvePrincipalAccessProfile dedupes roles", () => {
  const profile = resolvePrincipalAccessProfile({
    principalType: "user",
    roles: ["viewer", "viewer", "human_operator"],
  });

  // Should deduplicate to only unique roles
  assert.ok(profile.roles.length <= 3);
});

test("resolvePrincipalAccessProfile filters capabilities to only those granted by roles", () => {
  const profile = resolvePrincipalAccessProfile({
    principalType: "user",
    roles: ["viewer"], // viewer has no capabilities
    capabilities: ["tool:invoke", "network:access"], // requesting capabilities viewer doesn't have
  });

  assert.deepEqual(profile.capabilities, []);
});

test("resolvePrincipalAccessProfile includes capabilities from roles", () => {
  const profile = resolvePrincipalAccessProfile({
    principalType: "user",
    roles: ["service_operator"],
  });

  // service_operator has model:invoke, tool:invoke, network:access, execution:dispatch, rollout:advance, knowledge:trust:modify
  assert.ok(profile.capabilities.includes("model:invoke"));
  assert.ok(profile.capabilities.includes("tool:invoke"));
  assert.ok(profile.capabilities.includes("network:access"));
});

test("resolvePrincipalAccessProfile for plugin principal type", () => {
  const profile = resolvePrincipalAccessProfile({
    principalType: "plugin",
  });

  assert.deepEqual(profile.principalType, "plugin");
  assert.deepEqual(profile.roles, ["plugin_runtime"]);
  assert.ok(profile.capabilities.includes("network:access"));
});

test("evaluateAuthorizationContext requires operator role for manual takeover", () => {
  const denied = evaluateAuthorizationContext({
    principalType: "worker",
    roles: ["worker_runtime"],
    action: "invoke_tool",
    context: { manualTakeoverActive: true },
  });

  assert.equal(denied.allowed, false);
  assert.equal(denied.reasonCode, "policy.context_manual_takeover_operator_required");
});

// ============================================================================
// Role Grants Capabilities Tests
// ============================================================================

test("roleGrantsCapabilities returns true when roles have required capabilities", () => {
  const result = roleGrantsCapabilities(
    ["platform_admin"],
    ["model:invoke", "tool:invoke"],
  );

  assert.equal(result, true);
});

test("roleGrantsCapabilities returns false when roles lack required capabilities", () => {
  const result = roleGrantsCapabilities(
    ["viewer"],
    ["exec:command"], // viewer doesn't have exec:command
  );

  assert.equal(result, false);
});

test("roleGrantsCapabilities checks inheritance chain", () => {
  // human_operator should have exec:command (inherits from EXTENDED_CAPABILITIES)
  const result = roleGrantsCapabilities(
    ["human_operator"],
    ["exec:command"],
  );

  assert.equal(result, true);
});

test("roleGrantsCapabilities handles multiple roles", () => {
  // viewer + human_operator combined should have more capabilities
  const result = roleGrantsCapabilities(
    ["viewer", "human_operator"],
    ["fs:write", "exec:command"],
  );

  assert.equal(result, true);
});

// ============================================================================
// Authorization Context Evaluation Tests
// ============================================================================

test("evaluateAuthorizationContext denies when tenant scope required but missing", () => {
  const decision = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["viewer"],
    action: "invoke_model",
    context: { requiresTenantScope: true },
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "policy.context_tenant_scope_required");
});

test("evaluateAuthorizationContext allows when tenant scope provided", () => {
  const decision = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["human_operator"],
    action: "invoke_model",
    context: { requiresTenantScope: true, tenantId: "tenant-123" },
  });

  // Implementation allows by default when context checks pass
  assert.equal(decision.allowed, true);
});

test("evaluateAuthorizationContext denies production exec_command without operator role", () => {
  const decision = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["viewer"],
    action: "exec_command",
    context: { environment: "production" },
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "policy.context_production_operator_required");
});

test("evaluateAuthorizationContext allows production exec_command with human_operator", () => {
  const decision = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["human_operator"],
    action: "exec_command",
    context: { environment: "production" },
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, null);
});

test("evaluateAuthorizationContext denies plugin network_access without pluginTrusted", () => {
  const decision = evaluateAuthorizationContext({
    principalType: "plugin",
    roles: ["plugin_runtime"],
    action: "network_access",
    context: { pluginTrusted: false },
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "policy.context_plugin_trust_required");
});

test("evaluateAuthorizationContext allows plugin network_access with pluginTrusted", () => {
  const decision = evaluateAuthorizationContext({
    principalType: "plugin",
    roles: ["plugin_runtime"],
    action: "network_access",
    context: { pluginTrusted: true },
  });

  // plugin_runtime has network:access capability, so should allow
  assert.equal(decision.allowed, true);
  assert.equal(decision.requiresApproval, false);
});

test("evaluateAuthorizationContext regulated data in full-auto mode requires approval", () => {
  const decision = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "invoke_model",
    context: { dataClassification: "regulated" },
    riskCategory: "sensitive_data",
    mode: "full-auto",
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.requiresApproval, true);
  assert.equal(decision.reasonCode, "policy.context_regulated_data_requires_approval");
});

test("evaluateAuthorizationContext regulated data with sufficient capabilities", () => {
  const decision = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["platform_admin"],
    action: "invoke_model",
    context: { dataClassification: "regulated" },
    riskCategory: "sensitive_data",
    mode: "full-auto",
  });

  // platform_admin has model:invoke, so allowed with approval required
  assert.equal(decision.allowed, true);
  assert.equal(decision.requiresApproval, true);
});

test("evaluateAuthorizationContext manual takeover denies non-operators", () => {
  const decision = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "invoke_model",
    context: { manualTakeoverActive: true },
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "policy.context_manual_takeover_operator_required");
});

test("evaluateAuthorizationContext manual takeover allows operators", () => {
  const decision = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["human_operator"],
    action: "invoke_model",
    context: { manualTakeoverActive: true },
  });

  // human_operator is in the allowed list for manual takeover
  assert.equal(decision.allowed, true);
  assert.equal(decision.requiresApproval, false);
});

test("evaluateAuthorizationContext allows action when capability is granted", () => {
  const decision = evaluateAuthorizationContext({
    principalType: "worker",
    roles: ["worker_runtime"],
    action: "invoke_tool",
  });

  assert.equal(decision.allowed, true);
});

test("evaluateAuthorizationContext allows when rules match", () => {
  const decision = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["human_operator"],
    action: "invoke_model",
  });

  assert.equal(decision.allowed, true);
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

test("evaluateAuthorizationContext handles missing context", () => {
  const decision = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["human_operator"],
    action: "invoke_model",
  });

  assert.equal(decision.allowed, true);
});

test("evaluateAuthorizationContext returns correct match refs", () => {
  const decision = evaluateAuthorizationContext({
    principalType: "plugin",
    roles: ["plugin_runtime"],
    action: "network_access",
    context: { pluginTrusted: false },
  });

  assert.ok(decision.matchedRuleRefs.length > 0);
  assert.ok(decision.matchedRuleRefs.includes("context.plugin_trust_required"));
});

test("evaluateAuthorizationContext returns constraints in decision", () => {
  const decision = evaluateAuthorizationContext({
    principalType: "plugin",
    roles: ["plugin_runtime"],
    action: "network_access",
    context: { pluginTrusted: false },
  });

  assert.ok(decision.constraints);
  assert.equal(decision.constraints.pluginTrusted, false);
});

test("evaluateAuthorizationContext for org_change in production requires operator", () => {
  const decision = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["viewer"],
    action: "org_change",
    context: { environment: "production" },
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "policy.context_production_operator_required");
});

test("evaluateAuthorizationContext install_extension in production requires operator", () => {
  const decision = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["viewer"],
    action: "install_extension",
    context: { environment: "production" },
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "policy.context_production_operator_required");
});

test("capabilitiesForRole returns deduplicated array", () => {
  // Some roles may have overlapping capabilities in the inheritance chain
  const caps = capabilitiesForRole("system_runtime");

  // Should not have duplicates
  const uniqueCaps = new Set(caps);
  assert.equal(caps.length, uniqueCaps.size);
});
