const ROLE_CAPABILITY_MAP = {
    viewer: [],
    human_operator: [
        "model:invoke",
        "tool:invoke",
        "fs:write",
        "exec:command",
        "network:access",
    ],
    approver: [
        "model:invoke",
        "tool:invoke",
        "network:access",
    ],
    platform_admin: [
        "model:invoke",
        "tool:invoke",
        "fs:write",
        "exec:command",
        "network:access",
        "extension:install",
        "org:change",
        "execution:dispatch",
        "improvement:promote",
        "rollout:advance",
        "memory:promote",
        "knowledge:trust:modify",
    ],
    agent_runtime: [
        "model:invoke",
        "tool:invoke",
        "fs:write",
        "exec:command",
        "network:access",
    ],
    service_operator: [
        "model:invoke",
        "tool:invoke",
        "network:access",
        "execution:dispatch",
        "rollout:advance",
        "knowledge:trust:modify",
    ],
    worker_runtime: [
        "tool:invoke",
        "fs:write",
        "exec:command",
    ],
    plugin_runtime: [
        "tool:invoke",
        "fs:write",
        "network:access",
    ],
    system_runtime: [
        "model:invoke",
        "tool:invoke",
        "fs:write",
        "exec:command",
        "network:access",
        "execution:dispatch",
        "memory:promote",
    ],
};
const DEFAULT_ROLES_BY_PRINCIPAL = {
    user: ["viewer"],
    agent: ["agent_runtime"],
    system: ["system_runtime"],
    service: ["service_operator"],
    worker: ["worker_runtime"],
    plugin: ["plugin_runtime"],
};
const ACTION_CAPABILITY_MAP = {
    invoke_model: ["model:invoke"],
    invoke_tool: ["tool:invoke"],
    write_file: ["fs:write"],
    exec_command: ["exec:command"],
    network_access: ["network:access"],
    install_extension: ["extension:install"],
    org_change: ["org:change"],
    dispatch_execution: ["execution:dispatch"],
    set_isolation_level: ["execution:dispatch"],
    promote_improvement: ["improvement:promote"],
    advance_rollout: ["rollout:advance"],
    modify_knowledge_trust: ["knowledge:trust:modify"],
    promote_memory_layer: ["memory:promote"],
};
export function listPlatformPrincipalTypes() {
    return ["user", "agent", "system", "service", "worker", "plugin"];
}
export function listPlatformRoles() {
    return Object.keys(ROLE_CAPABILITY_MAP);
}
export function defaultRolesForPrincipalType(principalType) {
    return DEFAULT_ROLES_BY_PRINCIPAL[principalType];
}
export function capabilitiesForRole(role) {
    return ROLE_CAPABILITY_MAP[role];
}
export function inferCapabilitiesForAction(action) {
    return ACTION_CAPABILITY_MAP[action];
}
export function resolvePrincipalAccessProfile(input) {
    const roles = dedupeRoles(input.roles?.length ? input.roles : defaultRolesForPrincipalType(input.principalType));
    const roleCapabilities = dedupeCapabilities(roles.flatMap((role) => ROLE_CAPABILITY_MAP[role]));
    const capabilities = dedupeCapabilities(input.capabilities?.length ? input.capabilities : roleCapabilities);
    return {
        principalType: input.principalType,
        roles,
        capabilities,
    };
}
export function roleGrantsCapabilities(roles, requiredCapabilities) {
    const granted = new Set(roles.flatMap((role) => ROLE_CAPABILITY_MAP[role]));
    return requiredCapabilities.every((capability) => granted.has(capability));
}
export function evaluateAuthorizationContext(input) {
    const context = input.context;
    if (context?.requiresTenantScope === true && (context.tenantId == null || context.tenantId.length === 0)) {
        return {
            allowed: false,
            requiresApproval: false,
            reasonCode: "policy.context_tenant_scope_required",
            matchedRuleRefs: ["context.tenant_scope_required"],
            constraints: { tenantScopeRequired: true },
            explainSummary: "Context-aware authorization requires a tenant scope for this action.",
        };
    }
    if (context?.environment === "production"
        && ["exec_command", "org_change", "install_extension"].includes(input.action)
        && !input.roles.some((role) => role === "platform_admin" || role === "human_operator" || role === "service_operator")) {
        return {
            allowed: false,
            requiresApproval: false,
            reasonCode: "policy.context_production_operator_required",
            matchedRuleRefs: ["context.production_operator_required"],
            constraints: { environment: "production", requiredRoles: ["platform_admin", "human_operator", "service_operator"] },
            explainSummary: "Production-scoped execution requires an operator-grade principal role.",
        };
    }
    if (input.principalType === "plugin" && input.action === "network_access" && context?.pluginTrusted !== true) {
        return {
            allowed: false,
            requiresApproval: false,
            reasonCode: "policy.context_plugin_trust_required",
            matchedRuleRefs: ["context.plugin_trust_required"],
            constraints: { pluginTrusted: false },
            explainSummary: "Plugin network access requires a trusted plugin context.",
        };
    }
    if (context?.dataClassification === "regulated"
        && (input.mode === "full-auto" || input.riskCategory === "sensitive_data")) {
        return {
            allowed: true,
            requiresApproval: true,
            reasonCode: "policy.context_regulated_data_requires_approval",
            matchedRuleRefs: ["context.regulated_data_requires_approval"],
            constraints: { dataClassification: "regulated" },
            explainSummary: "Regulated data access requires approval in the current execution context.",
        };
    }
    if (context?.manualTakeoverActive === true) {
        return {
            allowed: true,
            requiresApproval: false,
            reasonCode: null,
            matchedRuleRefs: ["context.manual_takeover_active"],
            constraints: { manualTakeoverActive: true },
            explainSummary: "Manual takeover context recorded for audit and downstream controls.",
        };
    }
    return {
        allowed: true,
        requiresApproval: false,
        reasonCode: null,
        matchedRuleRefs: ["context.default_allow"],
        constraints: {},
        explainSummary: "Context-aware authorization allows this action.",
    };
}
function dedupeRoles(roles) {
    return [...new Set(roles)];
}
function dedupeCapabilities(capabilities) {
    return [...new Set(capabilities)];
}
//# sourceMappingURL=access-model.js.map