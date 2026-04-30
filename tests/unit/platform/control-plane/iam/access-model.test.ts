/**
 * Access Model Tests
 *
 * Tests for issue #1941: evaluateAuthorizationContext never checks role→capability
 * This tests that authorization properly validates role-based capabilities.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateAuthorizationContext,
  roleGrantsCapabilities,
  capabilitiesForRole,
  type PlatformPrincipalType,
  type PlatformRole,
  type AuthorizationAction,
} from "../../../../../src/platform/control-plane/iam/access-model.js";

// Helper to create context for testing
function createMinimalContext() {
  return {
    tenantId: "test-tenant",
    environment: "production" as const,
    dataClassification: "internal" as const,
    pluginTrusted: true,
    requiresTenantScope: false,
    manualTakeoverActive: false,
  };
}

test("evaluateAuthorizationContext denies when roles lack required capability", () => {
  // viewer has no capabilities - should fail for any action requiring capability
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["viewer"],
    action: "invoke_model", // requires model:invoke which viewer doesn't have
  });

  assert.equal(result.allowed, false, "viewer should not have invoke_model capability");
  assert.equal(result.reasonCode, "policy.capability_required");
});

test("evaluateAuthorizationContext denies when partial roles lack required capability", () => {
  // viewer + human_operator - viewer has no capabilities so should still fail
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["viewer", "human_operator"],
    action: "org_change", // requires org:change which human_operator doesn't have
  });

  assert.equal(result.allowed, false, "viewer+human_operator should not have org:change");
  assert.equal(result.reasonCode, "policy.capability_required");
});

test("evaluateAuthorizationContext allows when roles grant required capability", () => {
  // platform_admin has all capabilities
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["platform_admin"],
    action: "org_change", // platform_admin has org:change
    context: createMinimalContext(),
  });

  // Should allow since platform_admin has org:change capability
  // But production org_change requires operator-grade role check
  // platform_admin IS in the required roles list for production, so should pass
  assert.equal(result.allowed, true);
});

test("roleGrantsCapabilities returns false when role lacks capability", () => {
  const result = roleGrantsCapabilities(["viewer"], ["exec:command"]);
  assert.equal(result, false, "viewer should not have exec:command");
});

test("roleGrantsCapabilities returns true when role has capability", () => {
  const result = roleGrantsCapabilities(["human_operator"], ["exec:command"]);
  assert.equal(result, true, "human_operator should have exec:command");
});

test("roleGrantsCapabilities uses inheritance chain", () => {
  // service_operator inherits human_operator which has exec:command
  const result = roleGrantsCapabilities(["service_operator"], ["exec:command"]);
  assert.equal(result, true, "service_operator should inherit exec:command from human_operator");
});

test("capabilitiesForRole returns inherited capabilities for worker_runtime", () => {
  const caps = capabilitiesForRole("worker_runtime");
  // worker_runtime inherits from viewer, and viewer has no capabilities
  assert.equal(caps.length, 0, "worker_runtime should have no capabilities");
});

test("capabilitiesForRole returns inherited capabilities for system_runtime", () => {
  const caps = capabilitiesForRole("system_runtime");
  // system_runtime inherits full chain including EXTENDED_CAPABILITIES (exec:command)
  assert.ok(caps.includes("exec:command"), "system_runtime should have exec:command");
});

test("evaluateAuthorizationContext verifies capability for exec_command action", () => {
  // worker has no exec:command
  const result = evaluateAuthorizationContext({
    principalType: "worker",
    roles: ["worker_runtime"],
    action: "exec_command",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.capability_required");
});

test("evaluateAuthorizationContext grants exec_command for human_operator", () => {
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["human_operator"],
    action: "exec_command",
  });
  // human_operator has exec:command via inheritance
  assert.equal(result.allowed, true, "human_operator should be allowed exec_command");
});

test("evaluateAuthorizationContext grants network_access for plugin_runtime", () => {
  const result = evaluateAuthorizationContext({
    principalType: "plugin",
    roles: ["plugin_runtime"],
    action: "network_access",
    context: { pluginTrusted: true },
  });
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
});

test("evaluateAuthorizationContext denies network_access for plugin without trust", () => {
  const result = evaluateAuthorizationContext({
    principalType: "plugin",
    roles: ["plugin_runtime"],
    action: "network_access",
    context: { pluginTrusted: false },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.context_plugin_trust_required");
});

test("evaluateAuthorizationContext handles regulated data classification with capability check", () => {
  // Agent with agent_runtime - doesn't have memory:promote
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "promote_memory_layer",
    context: { dataClassification: "regulated" },
    riskCategory: "sensitive_data",
    mode: "full-auto",
  });

  // Should deny because agent_runtime doesn't have memory:promote capability
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.capability_required");
});

test("evaluateAuthorizationContext allows regulated data when capability sufficient", () => {
  // system_runtime has memory:promote
  const result = evaluateAuthorizationContext({
    principalType: "system",
    roles: ["system_runtime"],
    action: "promote_memory_layer",
    context: { dataClassification: "regulated" },
    riskCategory: "sensitive_data",
    mode: "full-auto",
  });

  // Should allow with approval since system_runtime has memory:promote
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
});

test("evaluateAuthorizationContext with production environment and operator role", () => {
  // production exec_command with human_operator (operator-grade)
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["human_operator"],
    action: "exec_command",
    context: { environment: "production" },
  });

  // human_operator is in the allowed list for production operators
  // Then falls through to capability check - human_operator has exec:command
  assert.equal(result.allowed, true, "human_operator should be allowed in production");
});

test("evaluateAuthorizationContext with production environment and non-operator role", () => {
  // production exec_command with viewer (not operator-grade)
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["viewer"],
    action: "exec_command",
    context: { environment: "production" },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.context_production_operator_required");
});

test("evaluateAuthorizationContext manual takeover denies non-operators", () => {
  const result = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "invoke_model",
    context: { manualTakeoverActive: true },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.context_manual_takeover_operator_required");
});

test("evaluateAuthorizationContext manual takeover allows operators", () => {
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["human_operator"],
    action: "invoke_model",
    context: { manualTakeoverActive: true },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
});

test("roleGrantsCapabilities returns true for platform_admin with multiple capabilities", () => {
  const result = roleGrantsCapabilities(
    ["platform_admin"],
    ["org:change", "extension:install", "execution:dispatch"]
  );
  assert.equal(result, true, "platform_admin should have all capabilities");
});

test("roleGrantsCapabilities returns false when one capability is missing", () => {
  const result = roleGrantsCapabilities(
    ["human_operator"],
    ["org:change", "extension:install"]  // human_operator doesn't have these
  );
  assert.equal(result, false, "human_operator should not have org:change or extension:install");
});

test("capabilitiesForRole deduplicates inherited capabilities", () => {
  const caps = capabilitiesForRole("platform_admin");
  const uniqueSet = new Set(caps);
  assert.equal(caps.length, uniqueSet.size, "capabilities should not have duplicates");
});

test("capabilitiesForRole agent_runtime includes network:access from STANDARD_CAPABILITIES", () => {
  const caps = capabilitiesForRole("agent_runtime");
  assert.ok(caps.includes("network:access"), "agent_runtime should have network:access");
});

test("capabilitiesForRole approver has STANDARD_CAPABILITIES only", () => {
  const caps = capabilitiesForRole("approver");
  assert.ok(caps.includes("model:invoke"), "approver should have model:invoke");
  assert.ok(caps.includes("tool:invoke"), "approver should have tool:invoke");
  assert.ok(caps.includes("network:access"), "approver should have network:access");
  assert.ok(!caps.includes("fs:write"), "approver should not have fs:write");
});

test("evaluateAuthorizationContext denies install_extension for non-admin", () => {
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["service_operator"],
    action: "install_extension", // only platform_admin has extension:install
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "policy.capability_required");
});

test("evaluateAuthorizationContext allows install_extension for platform_admin", () => {
  const result = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["platform_admin"],
    action: "install_extension",
  });
  assert.equal(result.allowed, true, "platform_admin should be allowed install_extension");
});