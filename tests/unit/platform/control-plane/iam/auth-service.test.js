import assert from "node:assert/strict";
import test from "node:test";
import { capabilitiesForRole, defaultRolesForPrincipalType, evaluateAuthorizationContext, inferCapabilitiesForAction, listPlatformPrincipalTypes, listPlatformRoles, resolvePrincipalAccessProfile, roleGrantsCapabilities, } from "../../../../../src/platform/control-plane/iam/access-model.js";
function makeMockContext(overrides = {}) {
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
test("listPlatformPrincipalTypes returns all six principal types", () => {
    const types = listPlatformPrincipalTypes();
    assert.deepEqual(types, ["user", "agent", "system", "service", "worker", "plugin"]);
    assert.equal(types.length, 6);
});
test("listPlatformRoles returns all platform roles", () => {
    const roles = listPlatformRoles();
    assert.ok(roles.includes("viewer"));
    assert.ok(roles.includes("platform_admin"));
    assert.ok(roles.includes("agent_runtime"));
    assert.ok(roles.includes("worker_runtime"));
    assert.ok(roles.length >= 8);
});
test("defaultRolesForPrincipalType maps user to viewer role", () => {
    const roles = defaultRolesForPrincipalType("user");
    assert.deepEqual(roles, ["viewer"]);
});
test("defaultRolesForPrincipalType maps agent to agent_runtime role", () => {
    const roles = defaultRolesForPrincipalType("agent");
    assert.deepEqual(roles, ["agent_runtime"]);
});
test("defaultRolesForPrincipalType maps system to system_runtime role", () => {
    const roles = defaultRolesForPrincipalType("system");
    assert.deepEqual(roles, ["system_runtime"]);
});
test("defaultRolesForPrincipalType maps worker to worker_runtime role", () => {
    const roles = defaultRolesForPrincipalType("worker");
    assert.deepEqual(roles, ["worker_runtime"]);
});
test("capabilitiesForRole returns correct capabilities for platform_admin", () => {
    const caps = capabilitiesForRole("platform_admin");
    assert.ok(caps.includes("model:invoke"));
    assert.ok(caps.includes("tool:invoke"));
    assert.ok(caps.includes("fs:write"));
    assert.ok(caps.includes("exec:command"));
    assert.ok(caps.includes("org:change"));
    assert.ok(caps.includes("execution:dispatch"));
});
test("capabilitiesForRole returns correct capabilities for agent_runtime", () => {
    const caps = capabilitiesForRole("agent_runtime");
    assert.ok(caps.includes("tool:invoke"));
    assert.ok(caps.includes("fs:write"));
    assert.ok(!caps.includes("org:change"));
});
test("capabilitiesForRole returns empty array for viewer role", () => {
    const caps = capabilitiesForRole("viewer");
    assert.deepEqual(caps, []);
});
test("inferCapabilitiesForAction maps invoke_model to model:invoke", () => {
    const caps = inferCapabilitiesForAction("invoke_model");
    assert.deepEqual(caps, ["model:invoke"]);
});
test("inferCapabilitiesForAction maps exec_command to exec:command", () => {
    const caps = inferCapabilitiesForAction("exec_command");
    assert.deepEqual(caps, ["exec:command"]);
});
test("inferCapabilitiesForAction maps write_file to fs:write", () => {
    const caps = inferCapabilitiesForAction("write_file");
    assert.deepEqual(caps, ["fs:write"]);
});
test("inferCapabilitiesForAction maps org_change to org:change", () => {
    const caps = inferCapabilitiesForAction("org_change");
    assert.deepEqual(caps, ["org:change"]);
});
test("resolvePrincipalAccessProfile derives capabilities from roles", () => {
    const profile = resolvePrincipalAccessProfile({
        principalType: "agent",
        roles: ["agent_runtime"],
    });
    assert.ok(profile.capabilities.includes("tool:invoke"));
    assert.ok(profile.capabilities.includes("fs:write"));
    assert.equal(profile.principalType, "agent");
});
test("resolvePrincipalAccessProfile uses explicit capabilities when provided", () => {
    const profile = resolvePrincipalAccessProfile({
        principalType: "user",
        roles: ["viewer"],
        capabilities: ["model:invoke", "tool:invoke"],
    });
    assert.ok(profile.capabilities.includes("model:invoke"));
    assert.ok(profile.capabilities.includes("tool:invoke"));
});
test("resolvePrincipalAccessProfile deduplicates roles", () => {
    const profile = resolvePrincipalAccessProfile({
        principalType: "user",
        roles: ["viewer", "viewer"],
    });
    assert.equal(profile.roles.length, 1);
});
test("roleGrantsCapabilities returns true when roles have required capabilities", () => {
    const result = roleGrantsCapabilities(["platform_admin"], ["tool:invoke", "fs:write"]);
    assert.equal(result, true);
});
test("roleGrantsCapabilities returns false when roles lack required capability", () => {
    const result = roleGrantsCapabilities(["viewer"], ["exec:command"]);
    assert.equal(result, false);
});
test("roleGrantsCapabilities handles multiple roles with combined capabilities", () => {
    const result = roleGrantsCapabilities(["viewer", "human_operator"], ["exec:command"]);
    assert.equal(result, true);
});
test("evaluateAuthorizationContext denies when tenant scope is required but missing", () => {
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
test("evaluateAuthorizationContext denies production exec_command without operator role", () => {
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
test("evaluateAuthorizationContext allows production exec_command with platform_admin role", () => {
    const result = evaluateAuthorizationContext({
        principalType: "user",
        roles: ["platform_admin"],
        action: "exec_command",
        context: makeMockContext({ environment: "production" }),
        mode: "auto",
    });
    assert.equal(result.allowed, true);
});
test("evaluateAuthorizationContext denies plugin network access when not trusted", () => {
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
test("evaluateAuthorizationContext allows plugin network access when trusted", () => {
    const result = evaluateAuthorizationContext({
        principalType: "plugin",
        roles: ["plugin_runtime"],
        action: "network_access",
        context: makeMockContext({ pluginTrusted: true }),
        mode: "auto",
    });
    assert.equal(result.allowed, true);
    assert.equal(result.requiresApproval, false);
});
test("evaluateAuthorizationContext requires approval for regulated data in full-auto mode", () => {
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
test("evaluateAuthorizationContext records manual takeover without blocking", () => {
    const result = evaluateAuthorizationContext({
        principalType: "user",
        roles: ["human_operator"],
        action: "invoke_tool",
        context: makeMockContext({ manualTakeoverActive: true }),
        mode: "auto",
    });
    assert.equal(result.allowed, true);
    assert.equal(result.requiresApproval, false);
    assert.equal(result.reasonCode, null);
});
test("evaluateAuthorizationContext allows action by default", () => {
    const result = evaluateAuthorizationContext({
        principalType: "agent",
        roles: ["agent_runtime"],
        action: "invoke_tool",
        context: makeMockContext(),
        mode: "auto",
    });
    assert.equal(result.allowed, true);
    assert.equal(result.matchedRuleRefs.includes("context.default_allow"), true);
});
//# sourceMappingURL=auth-service.test.js.map