import assert from "node:assert/strict";
import test from "node:test";

import {
  capabilitiesForRole,
  defaultRolesForPrincipalType,
  evaluateAuthorizationContext,
  inferCapabilitiesForAction,
  listPlatformPrincipalTypes,
  listPlatformRoles,
  resolvePrincipalAccessProfile,
} from "../../../../../src/platform/five-plane-control-plane/iam/access-model.js";

test("access model exposes authoritative principal and role inventories", () => {
  assert.deepEqual(listPlatformPrincipalTypes(), ["user", "agent", "system", "service", "worker", "plugin"]);
  assert.equal(listPlatformRoles().includes("platform_admin"), true);
  assert.equal(listPlatformRoles().includes("plugin_runtime"), true);
});

test("access model resolves default roles and action capabilities", () => {
  assert.deepEqual(defaultRolesForPrincipalType("worker"), ["worker_runtime"]);
  assert.deepEqual(inferCapabilitiesForAction("network_access"), ["network:access"]);
  assert.equal(capabilitiesForRole("agent_runtime").includes("tool:invoke"), true);
});

test("access model derives capabilities from roles when explicit capability grants are omitted", () => {
  const profile = resolvePrincipalAccessProfile({
    principalType: "service",
    roles: ["service_operator"],
  });

  assert.deepEqual(profile.roles, ["service_operator"]);
  assert.equal(profile.capabilities.includes("execution:dispatch"), true);
  assert.equal(profile.capabilities.includes("rollout:advance"), true);
});

test("access model freezes resolved roles and capabilities", () => {
  const profile = resolvePrincipalAccessProfile({
    principalType: "service",
    roles: ["service_operator"],
  });

  assert.equal(Object.isFrozen(profile.roles), true);
  assert.equal(Object.isFrozen(profile.capabilities), true);
});

test("access model intersects explicit capabilities with granted role capabilities", () => {
  const profile = resolvePrincipalAccessProfile({
    principalType: "user",
    roles: ["viewer"],
    capabilities: ["tool:invoke", "network:access"],
  });

  assert.deepEqual(profile.capabilities, []);
});

test("access model enforces context-aware plugin trust and regulated data approval", () => {
  const pluginDecision = evaluateAuthorizationContext({
    principalType: "plugin",
    roles: ["plugin_runtime"],
    action: "network_access",
    context: { pluginTrusted: false },
    mode: "auto",
  });
  assert.equal(pluginDecision.allowed, false);
  assert.equal(pluginDecision.reasonCode, "policy.context_plugin_trust_required");

  const regulatedDecision = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "invoke_model",
    context: { dataClassification: "regulated" },
    riskCategory: "sensitive_data",
    mode: "full-auto",
  });
  assert.equal(regulatedDecision.allowed, true);
  assert.equal(regulatedDecision.requiresApproval, true);
  assert.equal(regulatedDecision.reasonCode, "policy.context_regulated_data_requires_approval");
});

test("access model rejects manual takeover for non-operator roles", () => {
  const decision = evaluateAuthorizationContext({
    principalType: "agent",
    roles: ["agent_runtime"],
    action: "invoke_model",
    context: { manualTakeoverActive: true },
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "policy.context_manual_takeover_operator_required");
});

test("access model enforces principal tenant match for tenant-scoped authorization", () => {
  const decision = evaluateAuthorizationContext({
    principalType: "service",
    principalTenantId: "tenant-a",
    roles: ["service_operator"],
    action: "invoke_tool",
    context: {
      tenantId: "tenant-b",
      requiresTenantScope: true,
      originalPrincipal: {
        type: "service",
        roles: ["service_operator"],
        tenantId: "tenant-a",
      },
    },
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "policy.context_tenant_mismatch");
});
