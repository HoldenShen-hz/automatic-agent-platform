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
function makeRequest(input) {
    return {
        principalType: input.principalType,
        roles: input.roles,
        action: input.action,
        context: input.context ?? makeMockContext(),
        riskCategory: input.riskCategory ?? "sensitive_data",
        mode: input.mode ?? "auto",
    };
}
test("IamService lists all principal types", () => {
    const types = listPlatformPrincipalTypes();
    assert.deepEqual(types, ["user", "agent", "system", "service", "worker", "plugin"]);
    assert.equal(types.length, 6);
});
test("IamService lists all platform roles", () => {
    const roles = listPlatformRoles();
    assert.ok(roles.includes("viewer"));
    assert.ok(roles.includes("platform_admin"));
    assert.ok(roles.includes("human_operator"));
    assert.ok(roles.includes("agent_runtime"));
    assert.ok(roles.includes("service_operator"));
    assert.ok(roles.includes("worker_runtime"));
    assert.ok(roles.includes("plugin_runtime"));
    assert.ok(roles.includes("system_runtime"));
    assert.ok(roles.includes("approver"));
    assert.equal(roles.length, 9);
});
test("IamService maps user principal to viewer role", () => {
    const roles = defaultRolesForPrincipalType("user");
    assert.deepEqual(roles, ["viewer"]);
});
test("IamService maps agent principal to agent_runtime role", () => {
    const roles = defaultRolesForPrincipalType("agent");
    assert.deepEqual(roles, ["agent_runtime"]);
});
test("IamService maps system principal to system_runtime role", () => {
    const roles = defaultRolesForPrincipalType("system");
    assert.deepEqual(roles, ["system_runtime"]);
});
test("IamService maps service principal to service_operator role", () => {
    const roles = defaultRolesForPrincipalType("service");
    assert.deepEqual(roles, ["service_operator"]);
});
test("IamService maps worker principal to worker_runtime role", () => {
    const roles = defaultRolesForPrincipalType("worker");
    assert.deepEqual(roles, ["worker_runtime"]);
});
test("IamService maps plugin principal to plugin_runtime role", () => {
    const roles = defaultRolesForPrincipalType("plugin");
    assert.deepEqual(roles, ["plugin_runtime"]);
});
test("IamService returns correct capabilities for platform_admin", () => {
    const caps = capabilitiesForRole("platform_admin");
    assert.ok(caps.includes("model:invoke"));
    assert.ok(caps.includes("tool:invoke"));
    assert.ok(caps.includes("fs:write"));
    assert.ok(caps.includes("exec:command"));
    assert.ok(caps.includes("network:access"));
    assert.ok(caps.includes("extension:install"));
    assert.ok(caps.includes("org:change"));
    assert.ok(caps.includes("execution:dispatch"));
    assert.ok(caps.includes("improvement:promote"));
    assert.ok(caps.includes("rollout:advance"));
    assert.ok(caps.includes("memory:promote"));
    assert.ok(caps.includes("knowledge:trust:modify"));
});
test("IamService returns correct capabilities for human_operator", () => {
    const caps = capabilitiesForRole("human_operator");
    assert.ok(caps.includes("model:invoke"));
    assert.ok(caps.includes("tool:invoke"));
    assert.ok(caps.includes("fs:write"));
    assert.ok(caps.includes("exec:command"));
    assert.ok(caps.includes("network:access"));
    assert.ok(!caps.includes("org:change"));
});
test("IamService returns correct capabilities for approver", () => {
    const caps = capabilitiesForRole("approver");
    assert.ok(caps.includes("model:invoke"));
    assert.ok(caps.includes("tool:invoke"));
    assert.ok(caps.includes("network:access"));
    assert.ok(!caps.includes("fs:write"));
    assert.ok(!caps.includes("exec:command"));
});
test("IamService returns empty capabilities for viewer", () => {
    const caps = capabilitiesForRole("viewer");
    assert.deepEqual(caps, []);
});
test("IamService returns correct capabilities for worker_runtime", () => {
    const caps = capabilitiesForRole("worker_runtime");
    assert.ok(caps.includes("tool:invoke"));
    assert.ok(caps.includes("fs:write"));
    assert.ok(caps.includes("exec:command"));
    assert.ok(!caps.includes("network:access"));
});
test("IamService returns correct capabilities for plugin_runtime", () => {
    const caps = capabilitiesForRole("plugin_runtime");
    assert.ok(caps.includes("tool:invoke"));
    assert.ok(caps.includes("fs:write"));
    assert.ok(caps.includes("network:access"));
    assert.ok(!caps.includes("model:invoke"));
    assert.ok(!caps.includes("exec:command"));
});
test("IamService returns correct capabilities for system_runtime", () => {
    const caps = capabilitiesForRole("system_runtime");
    assert.ok(caps.includes("model:invoke"));
    assert.ok(caps.includes("tool:invoke"));
    assert.ok(caps.includes("fs:write"));
    assert.ok(caps.includes("exec:command"));
    assert.ok(caps.includes("network:access"));
    assert.ok(caps.includes("execution:dispatch"));
    assert.ok(caps.includes("memory:promote"));
    assert.ok(!caps.includes("org:change"));
});
test("IamService infers invoke_model capability from action", () => {
    const caps = inferCapabilitiesForAction("invoke_model");
    assert.deepEqual(caps, ["model:invoke"]);
});
test("IamService infers invoke_tool capability from action", () => {
    const caps = inferCapabilitiesForAction("invoke_tool");
    assert.deepEqual(caps, ["tool:invoke"]);
});
test("IamService infers write_file capability from action", () => {
    const caps = inferCapabilitiesForAction("write_file");
    assert.deepEqual(caps, ["fs:write"]);
});
test("IamService infers exec_command capability from action", () => {
    const caps = inferCapabilitiesForAction("exec_command");
    assert.deepEqual(caps, ["exec:command"]);
});
test("IamService infers network_access capability from action", () => {
    const caps = inferCapabilitiesForAction("network_access");
    assert.deepEqual(caps, ["network:access"]);
});
test("IamService infers install_extension capability from action", () => {
    const caps = inferCapabilitiesForAction("install_extension");
    assert.deepEqual(caps, ["extension:install"]);
});
test("IamService infers org_change capability from action", () => {
    const caps = inferCapabilitiesForAction("org_change");
    assert.deepEqual(caps, ["org:change"]);
});
test("IamService infers dispatch_execution capability from action", () => {
    const caps = inferCapabilitiesForAction("dispatch_execution");
    assert.deepEqual(caps, ["execution:dispatch"]);
});
test("IamService infers promote_improvement capability from action", () => {
    const caps = inferCapabilitiesForAction("promote_improvement");
    assert.deepEqual(caps, ["improvement:promote"]);
});
test("IamService infers advance_rollout capability from action", () => {
    const caps = inferCapabilitiesForAction("advance_rollout");
    assert.deepEqual(caps, ["rollout:advance"]);
});
test("IamService infers modify_knowledge_trust capability from action", () => {
    const caps = inferCapabilitiesForAction("modify_knowledge_trust");
    assert.deepEqual(caps, ["knowledge:trust:modify"]);
});
test("IamService infers promote_memory_layer capability from action", () => {
    const caps = inferCapabilitiesForAction("promote_memory_layer");
    assert.deepEqual(caps, ["memory:promote"]);
});
test("IamService resolves access profile from principal type only", () => {
    const profile = resolvePrincipalAccessProfile({ principalType: "agent" });
    assert.equal(profile.principalType, "agent");
    assert.ok(profile.roles.includes("agent_runtime"));
    assert.ok(profile.capabilities.includes("tool:invoke"));
});
test("IamService resolves access profile with explicit roles", () => {
    const profile = resolvePrincipalAccessProfile({
        principalType: "user",
        roles: ["human_operator"],
    });
    assert.ok(profile.roles.includes("human_operator"));
    assert.ok(profile.capabilities.includes("exec:command"));
});
test("IamService resolves access profile with explicit capabilities", () => {
    const profile = resolvePrincipalAccessProfile({
        principalType: "user",
        roles: ["viewer"],
        capabilities: ["model:invoke", "tool:invoke"],
    });
    assert.deepEqual(profile.capabilities, []);
});
test("IamService deduplicates roles in profile", () => {
    const profile = resolvePrincipalAccessProfile({
        principalType: "user",
        roles: ["viewer", "viewer", "human_operator", "human_operator"],
    });
    assert.equal(profile.roles.length, 2);
});
test("IamService deduplicates capabilities in profile", () => {
    const profile = resolvePrincipalAccessProfile({
        principalType: "user",
        roles: ["human_operator"],
        capabilities: ["model:invoke", "model:invoke", "tool:invoke"],
    });
    assert.equal(profile.capabilities.length, 2);
});
test("IamService checks role grants capabilities - granted", () => {
    const result = roleGrantsCapabilities(["platform_admin"], ["tool:invoke", "fs:write", "network:access"]);
    assert.equal(result, true);
});
test("IamService checks role grants capabilities - missing one", () => {
    const result = roleGrantsCapabilities(["viewer"], ["tool:invoke"]);
    assert.equal(result, false);
});
test("IamService checks role grants capabilities - multiple roles combined", () => {
    const result = roleGrantsCapabilities(["viewer", "human_operator"], ["exec:command"]);
    assert.equal(result, true);
});
test("IamService denies when tenant scope is required but missing", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "user",
        roles: ["viewer"],
        action: "org_change",
        context: makeMockContext({ requiresTenantScope: true, tenantId: null }),
    }));
    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, "policy.context_tenant_scope_required");
    assert.equal(result.matchedRuleRefs.includes("context.tenant_scope_required"), true);
});
test("IamService allows when tenant scope is provided", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "user",
        roles: ["viewer"],
        action: "org_change",
        context: makeMockContext({ requiresTenantScope: true, tenantId: "tenant-123" }),
    }));
    assert.equal(result.allowed, true);
});
test("IamService denies production exec_command without operator role", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "agent",
        roles: ["agent_runtime"],
        action: "exec_command",
        context: makeMockContext({ environment: "production" }),
    }));
    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, "policy.context_production_operator_required");
});
test("IamService denies production org_change without operator role", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "agent",
        roles: ["agent_runtime"],
        action: "org_change",
        context: makeMockContext({ environment: "production" }),
    }));
    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, "policy.context_production_operator_required");
});
test("IamService denies production install_extension without operator role", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "agent",
        roles: ["agent_runtime"],
        action: "install_extension",
        context: makeMockContext({ environment: "production" }),
    }));
    assert.equal(result.allowed, false);
});
test("IamService allows production exec_command with platform_admin", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "user",
        roles: ["platform_admin"],
        action: "exec_command",
        context: makeMockContext({ environment: "production" }),
    }));
    assert.equal(result.allowed, true);
});
test("IamService allows production exec_command with human_operator", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "user",
        roles: ["human_operator"],
        action: "exec_command",
        context: makeMockContext({ environment: "production" }),
    }));
    assert.equal(result.allowed, true);
});
test("IamService allows production exec_command with service_operator", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "service",
        roles: ["service_operator"],
        action: "exec_command",
        context: makeMockContext({ environment: "production" }),
    }));
    assert.equal(result.allowed, true);
});
test("IamService denies plugin network access when not trusted", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "plugin",
        roles: ["plugin_runtime"],
        action: "network_access",
        context: makeMockContext({ pluginTrusted: false }),
    }));
    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, "policy.context_plugin_trust_required");
});
test("IamService allows plugin network access when trusted", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "plugin",
        roles: ["plugin_runtime"],
        action: "network_access",
        context: makeMockContext({ pluginTrusted: true }),
    }));
    assert.equal(result.allowed, true);
    assert.equal(result.requiresApproval, false);
});
test("IamService requires approval for regulated data in full-auto mode", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "agent",
        roles: ["agent_runtime"],
        action: "invoke_model",
        context: makeMockContext({ dataClassification: "regulated" }),
        riskCategory: "sensitive_data",
        mode: "full-auto",
    }));
    assert.equal(result.allowed, true);
    assert.equal(result.requiresApproval, true);
    assert.equal(result.reasonCode, "policy.context_regulated_data_requires_approval");
});
test("IamService requires approval for regulated data in auto mode", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "agent",
        roles: ["agent_runtime"],
        action: "invoke_model",
        context: makeMockContext({ dataClassification: "regulated" }),
        riskCategory: "sensitive_data",
        mode: "auto",
    }));
    assert.equal(result.allowed, true);
    assert.equal(result.requiresApproval, true);
});
test("IamService requires approval for regulated data in supervised mode with sensitive risk", () => {
    // When dataClassification is "regulated" AND riskCategory is "sensitive_data",
    // approval is required regardless of mode (supervised, auto, or full-auto)
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "agent",
        roles: ["agent_runtime"],
        action: "invoke_model",
        context: makeMockContext({ dataClassification: "regulated" }),
        riskCategory: "sensitive_data",
        mode: "supervised",
    }));
    assert.equal(result.allowed, true);
    assert.equal(result.requiresApproval, true);
});
test("IamService records manual takeover without blocking", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "user",
        roles: ["human_operator"],
        action: "invoke_tool",
        context: makeMockContext({ manualTakeoverActive: true }),
    }));
    assert.equal(result.allowed, true);
    assert.equal(result.requiresApproval, false);
    assert.equal(result.reasonCode, null);
    assert.equal(result.matchedRuleRefs.includes("context.manual_takeover_active"), true);
});
test("IamService allows action by default", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "agent",
        roles: ["agent_runtime"],
        action: "invoke_tool",
        context: makeMockContext(),
    }));
    assert.equal(result.allowed, true);
    assert.equal(result.matchedRuleRefs.includes("context.default_allow"), true);
});
test("IamService returns correct explain summary for tenant scope denial", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "user",
        roles: ["viewer"],
        action: "org_change",
        context: makeMockContext({ requiresTenantScope: true, tenantId: null }),
    }));
    assert.ok(result.explainSummary.includes("tenant scope"));
});
test("IamService returns correct explain summary for production operator denial", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "agent",
        roles: ["agent_runtime"],
        action: "exec_command",
        context: makeMockContext({ environment: "production" }),
    }));
    assert.ok(result.explainSummary.includes("operator"));
});
test("IamService returns correct explain summary for plugin trust denial", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "plugin",
        roles: ["plugin_runtime"],
        action: "network_access",
        context: makeMockContext({ pluginTrusted: false }),
    }));
    assert.ok(result.explainSummary.includes("plugin"));
});
test("IamService returns correct constraints on tenant scope denial", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "user",
        roles: ["viewer"],
        action: "org_change",
        context: makeMockContext({ requiresTenantScope: true, tenantId: null }),
    }));
    assert.equal(result.constraints["tenantScopeRequired"], true);
});
test("IamService returns correct constraints on plugin trust denial", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "plugin",
        roles: ["plugin_runtime"],
        action: "network_access",
        context: makeMockContext({ pluginTrusted: false }),
    }));
    assert.equal(result.constraints["pluginTrusted"], false);
});
test("IamService handles non-production environment with exec_command", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "worker",
        roles: ["worker_runtime"],
        action: "exec_command",
        context: makeMockContext({ environment: "workspace" }),
    }));
    assert.equal(result.allowed, true);
});
test("IamService handles staging environment with exec_command", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "worker",
        roles: ["worker_runtime"],
        action: "exec_command",
        context: makeMockContext({ environment: "staging" }),
    }));
    assert.equal(result.allowed, true);
});
test("IamService handles confidential data classification without requiring approval for non-sensitive actions", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "agent",
        roles: ["agent_runtime"],
        action: "invoke_tool",
        context: makeMockContext({ dataClassification: "confidential" }),
    }));
    assert.equal(result.allowed, true);
    assert.equal(result.requiresApproval, false);
});
test("IamService handles internal data classification without requiring approval", () => {
    const result = evaluateAuthorizationContext(makeRequest({
        principalType: "agent",
        roles: ["agent_runtime"],
        action: "invoke_model",
        context: makeMockContext({ dataClassification: "internal" }),
    }));
    assert.equal(result.allowed, true);
    assert.equal(result.requiresApproval, false);
});
//# sourceMappingURL=iam-service.test.js.map
