/**
 * Integration Test: IAM Identity Provider
 *
 * Tests the identity and access model functions including:
 * - Principal type management
 * - Role and capability resolution
 * - Authorization context evaluation
 * - Role-based access control
 *
 * Uses createIntegrationContext() with SQLite for integration testing.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext, createSeededIntegrationContext } from "../../../../helpers/integration-context.js";
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

test("identity provider: listPlatformPrincipalTypes returns all principal types", () => {
  const ctx = createIntegrationContext("aa-identity-principal-types-");
  try {
    const principalTypes = listPlatformPrincipalTypes();
    assert.deepEqual(principalTypes, ["user", "agent", "system", "service", "worker", "plugin"]);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: listPlatformRoles returns all platform roles", () => {
  const ctx = createIntegrationContext("aa-identity-roles-");
  try {
    const roles = listPlatformRoles();
    assert.ok(roles.length > 0, "Should have at least one role");
    assert.ok(roles.includes("viewer"), "Should include viewer role");
    assert.ok(roles.includes("platform_admin"), "Should include platform_admin role");
    assert.ok(roles.includes("agent_runtime"), "Should include agent_runtime role");
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: defaultRolesForPrincipalType maps user to viewer", () => {
  const ctx = createIntegrationContext("aa-identity-default-user-");
  try {
    const roles = defaultRolesForPrincipalType("user");
    assert.deepEqual(roles, ["viewer"]);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: defaultRolesForPrincipalType maps agent to agent_runtime", () => {
  const ctx = createIntegrationContext("aa-identity-default-agent-");
  try {
    const roles = defaultRolesForPrincipalType("agent");
    assert.deepEqual(roles, ["agent_runtime"]);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: defaultRolesForPrincipalType maps service to service_operator", () => {
  const ctx = createIntegrationContext("aa-identity-default-service-");
  try {
    const roles = defaultRolesForPrincipalType("service");
    assert.deepEqual(roles, ["service_operator"]);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: defaultRolesForPrincipalType maps worker to worker_runtime", () => {
  const ctx = createIntegrationContext("aa-identity-default-worker-");
  try {
    const roles = defaultRolesForPrincipalType("worker");
    assert.deepEqual(roles, ["worker_runtime"]);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: defaultRolesForPrincipalType maps plugin to plugin_runtime", () => {
  const ctx = createIntegrationContext("aa-identity-default-plugin-");
  try {
    const roles = defaultRolesForPrincipalType("plugin");
    assert.deepEqual(roles, ["plugin_runtime"]);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: defaultRolesForPrincipalType maps system to system_runtime", () => {
  const ctx = createIntegrationContext("aa-identity-default-system-");
  try {
    const roles = defaultRolesForPrincipalType("system");
    assert.deepEqual(roles, ["system_runtime"]);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: capabilitiesForRole returns correct capabilities for platform_admin", () => {
  const ctx = createIntegrationContext("aa-identity-capabilities-admin-");
  try {
    const caps = capabilitiesForRole("platform_admin");
    assert.ok(caps.includes("model:invoke"), "platform_admin should have model:invoke");
    assert.ok(caps.includes("tool:invoke"), "platform_admin should have tool:invoke");
    assert.ok(caps.includes("fs:write"), "platform_admin should have fs:write");
    assert.ok(caps.includes("exec:command"), "platform_admin should have exec:command");
    assert.ok(caps.includes("network:access"), "platform_admin should have network:access");
    assert.ok(caps.includes("extension:install"), "platform_admin should have extension:install");
    assert.ok(caps.includes("org:change"), "platform_admin should have org:change");
    assert.ok(caps.includes("execution:dispatch"), "platform_admin should have execution:dispatch");
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: capabilitiesForRole returns correct capabilities for viewer", () => {
  const ctx = createIntegrationContext("aa-identity-capabilities-viewer-");
  try {
    const caps = capabilitiesForRole("viewer");
    assert.deepEqual(caps, [], "viewer should have no capabilities");
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: capabilitiesForRole returns correct capabilities for agent_runtime", () => {
  const ctx = createIntegrationContext("aa-identity-capabilities-agent-");
  try {
    const caps = capabilitiesForRole("agent_runtime");
    assert.ok(caps.includes("model:invoke"), "agent_runtime should have model:invoke");
    assert.ok(caps.includes("tool:invoke"), "agent_runtime should have tool:invoke");
    assert.ok(caps.includes("network:access"), "agent_runtime should have network:access");
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: inferCapabilitiesForAction maps invoke_model to model:invoke", () => {
  const ctx = createIntegrationContext("aa-identity-action-invoke-model-");
  try {
    const caps = inferCapabilitiesForAction("invoke_model");
    assert.deepEqual(caps, ["model:invoke"]);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: inferCapabilitiesForAction maps invoke_tool to tool:invoke", () => {
  const ctx = createIntegrationContext("aa-identity-action-invoke-tool-");
  try {
    const caps = inferCapabilitiesForAction("invoke_tool");
    assert.deepEqual(caps, ["tool:invoke"]);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: inferCapabilitiesForAction maps exec_command to exec:command", () => {
  const ctx = createIntegrationContext("aa-identity-action-exec-command-");
  try {
    const caps = inferCapabilitiesForAction("exec_command");
    assert.deepEqual(caps, ["exec:command"]);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: inferCapabilitiesForAction maps network_access to network:access", () => {
  const ctx = createIntegrationContext("aa-identity-action-network-access-");
  try {
    const caps = inferCapabilitiesForAction("network_access");
    assert.deepEqual(caps, ["network:access"]);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: resolvePrincipalAccessProfile derives capabilities from roles", () => {
  const ctx = createIntegrationContext("aa-identity-resolve-derive-");
  try {
    const profile = resolvePrincipalAccessProfile({
      principalType: "service",
      roles: ["service_operator"],
    });

    assert.deepEqual(profile.principalType, "service");
    assert.deepEqual(profile.roles, ["service_operator"]);
    assert.ok(profile.capabilities.includes("execution:dispatch"), "Should have execution:dispatch");
    assert.ok(profile.capabilities.includes("rollout:advance"), "Should have rollout:advance");
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: resolvePrincipalAccessProfile uses default roles when omitted", () => {
  const ctx = createIntegrationContext("aa-identity-resolve-default-");
  try {
    const profile = resolvePrincipalAccessProfile({
      principalType: "agent",
    });

    assert.deepEqual(profile.principalType, "agent");
    assert.deepEqual(profile.roles, ["agent_runtime"]);
    assert.ok(profile.capabilities.includes("tool:invoke"), "Should have tool:invoke from default role");
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: resolvePrincipalAccessProfile respects explicit capabilities", () => {
  const ctx = createIntegrationContext("aa-identity-resolve-explicit-");
  try {
    const profile = resolvePrincipalAccessProfile({
      principalType: "worker",
      capabilities: ["tool:invoke", "fs:write"],
    });

    assert.deepEqual(profile.principalType, "worker");
    assert.deepEqual(profile.capabilities, ["tool:invoke", "fs:write"]);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: roleGrantsCapabilities returns true when roles have required capabilities", () => {
  const ctx = createIntegrationContext("aa-identity-grants-true-");
  try {
    const result = roleGrantsCapabilities(
      ["platform_admin"],
      ["model:invoke", "tool:invoke"]
    );
    assert.strictEqual(result, true);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: roleGrantsCapabilities returns false when roles lack required capabilities", () => {
  const ctx = createIntegrationContext("aa-identity-grants-false-");
  try {
    const result = roleGrantsCapabilities(
      ["viewer"],
      ["tool:invoke"]
    );
    assert.strictEqual(result, false);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: roleGrantsCapabilities handles multiple roles", () => {
  const ctx = createIntegrationContext("aa-identity-grants-multi-");
  try {
    const result = roleGrantsCapabilities(
      ["viewer", "agent_runtime"],
      ["tool:invoke"]
    );
    assert.strictEqual(result, true);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: evaluateAuthorizationContext allows action with default context", () => {
  const ctx = createIntegrationContext("aa-identity-eval-default-");
  try {
    const decision = evaluateAuthorizationContext({
      principalType: "agent",
      roles: ["agent_runtime"],
      action: "invoke_tool",
      mode: "auto",
    });

    assert.strictEqual(decision.allowed, true);
    assert.strictEqual(decision.requiresApproval, false);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: evaluateAuthorizationContext denies plugin network access without trust", () => {
  const ctx = createIntegrationContext("aa-identity-eval-plugin-");
  try {
    const decision = evaluateAuthorizationContext({
      principalType: "plugin",
      roles: ["plugin_runtime"],
      action: "network_access",
      context: { pluginTrusted: false },
      mode: "auto",
    });

    assert.strictEqual(decision.allowed, false);
    assert.strictEqual(decision.reasonCode, "policy.context_plugin_trust_required");
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: evaluateAuthorizationContext allows plugin network access with trust", () => {
  const ctx = createIntegrationContext("aa-identity-eval-plugin-trusted-");
  try {
    const decision = evaluateAuthorizationContext({
      principalType: "plugin",
      roles: ["plugin_runtime"],
      action: "network_access",
      context: { pluginTrusted: true },
      mode: "auto",
    });

    assert.strictEqual(decision.allowed, true);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: evaluateAuthorizationContext requires tenant scope when context demands it", () => {
  const ctx = createIntegrationContext("aa-identity-eval-tenant-");
  try {
    const decision = evaluateAuthorizationContext({
      principalType: "user",
      roles: ["viewer"],
      action: "org_change",
      context: { requiresTenantScope: true, tenantId: null },
      mode: "auto",
    });

    assert.strictEqual(decision.allowed, false);
    assert.strictEqual(decision.reasonCode, "policy.context_tenant_scope_required");
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: evaluateAuthorizationContext allows action with tenant scope provided", () => {
  const ctx = createIntegrationContext("aa-identity-eval-tenant-provided-");
  try {
    const decision = evaluateAuthorizationContext({
      principalType: "user",
      roles: ["service_operator"],
      action: "org_change",
      context: { requiresTenantScope: true, tenantId: "tenant-001" },
      mode: "auto",
    });

    assert.strictEqual(decision.allowed, true);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: evaluateAuthorizationContext marks regulated data for approval in full-auto mode", () => {
  const ctx = createIntegrationContext("aa-identity-eval-regulated-");
  try {
    const decision = evaluateAuthorizationContext({
      principalType: "agent",
      roles: ["agent_runtime"],
      action: "invoke_model",
      context: { dataClassification: "regulated" },
      riskCategory: "sensitive_data",
      mode: "full-auto",
    });

    assert.strictEqual(decision.allowed, true);
    assert.strictEqual(decision.requiresApproval, true);
    assert.strictEqual(decision.reasonCode, "policy.context_regulated_data_requires_approval");
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: evaluateAuthorizationContext records manual takeover context", () => {
  const ctx = createIntegrationContext("aa-identity-eval-takeover-");
  try {
    const decision = evaluateAuthorizationContext({
      principalType: "human_operator",
      roles: ["human_operator"],
      action: "exec_command",
      context: { manualTakeoverActive: true },
      mode: "auto",
    });

    assert.strictEqual(decision.allowed, true);
    assert.strictEqual(decision.requiresApproval, false);
    assert.strictEqual(decision.reasonCode, null);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: evaluateAuthorizationContext denies production exec_command without operator role", () => {
  const ctx = createIntegrationContext("aa-identity-eval-prod-exec-");
  try {
    const decision = evaluateAuthorizationContext({
      principalType: "agent",
      roles: ["agent_runtime"],
      action: "exec_command",
      context: { environment: "production" },
      mode: "auto",
    });

    assert.strictEqual(decision.allowed, false);
    assert.strictEqual(decision.reasonCode, "policy.context_production_operator_required");
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: evaluateAuthorizationContext allows production exec_command with platform_admin", () => {
  const ctx = createIntegrationContext("aa-identity-eval-prod-admin-");
  try {
    const decision = evaluateAuthorizationContext({
      principalType: "user",
      roles: ["platform_admin"],
      action: "exec_command",
      context: { environment: "production" },
      mode: "auto",
    });

    assert.strictEqual(decision.allowed, true);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: evaluateAuthorizationContext allows production exec_command with human_operator", () => {
  const ctx = createIntegrationContext("aa-identity-eval-prod-human-");
  try {
    const decision = evaluateAuthorizationContext({
      principalType: "user",
      roles: ["human_operator"],
      action: "exec_command",
      context: { environment: "production" },
      mode: "auto",
    });

    assert.strictEqual(decision.allowed, true);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: evaluateAuthorizationContext allows production exec_command with service_operator", () => {
  const ctx = createIntegrationContext("aa-identity-eval-prod-service-");
  try {
    const decision = evaluateAuthorizationContext({
      principalType: "service",
      roles: ["service_operator"],
      action: "exec_command",
      context: { environment: "production" },
      mode: "auto",
    });

    assert.strictEqual(decision.allowed, true);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: integration with seeded context - principal access profile evaluation", () => {
  const ctx = createSeededIntegrationContext("aa-identity-seeded-");
  try {
    const profile = resolvePrincipalAccessProfile({
      principalType: "agent",
      roles: ["agent_runtime"],
    });

    assert.deepEqual(profile.principalType, "agent");
    assert.ok(profile.capabilities.includes("tool:invoke"));

    const decision = evaluateAuthorizationContext({
      principalType: profile.principalType,
      roles: [...profile.roles],
      action: "invoke_tool",
      mode: "auto",
    });

    assert.strictEqual(decision.allowed, true);
  } finally {
    ctx.cleanup();
  }
});

test("identity provider: integration with seeded context - production environment constraints", () => {
  const ctx = createSeededIntegrationContext("aa-identity-prod-seeded-");
  try {
    const adminProfile = resolvePrincipalAccessProfile({
      principalType: "user",
      roles: ["platform_admin"],
    });

    const decision = evaluateAuthorizationContext({
      principalType: adminProfile.principalType,
      roles: [...adminProfile.roles],
      action: "install_extension",
      context: { environment: "production" },
      mode: "auto",
    });

    assert.strictEqual(decision.allowed, true);
  } finally {
    ctx.cleanup();
  }
});
