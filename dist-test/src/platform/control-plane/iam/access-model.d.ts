export type PlatformPrincipalType = "user" | "agent" | "system" | "service" | "worker" | "plugin";
export type PlatformRole = "viewer" | "human_operator" | "approver" | "platform_admin" | "agent_runtime" | "service_operator" | "worker_runtime" | "plugin_runtime" | "system_runtime";
export type PlatformCapability = "model:invoke" | "tool:invoke" | "fs:write" | "exec:command" | "network:access" | "extension:install" | "org:change" | "execution:dispatch" | "improvement:promote" | "rollout:advance" | "memory:promote" | "knowledge:trust:modify";
export type AuthorizationAction = "invoke_model" | "invoke_tool" | "write_file" | "exec_command" | "network_access" | "install_extension" | "org_change" | "dispatch_execution" | "set_isolation_level" | "promote_improvement" | "advance_rollout" | "modify_knowledge_trust" | "promote_memory_layer";
export interface AuthorizationContext {
    readonly tenantId?: string | null;
    readonly environment?: "workspace" | "staging" | "production";
    readonly dataClassification?: "internal" | "confidential" | "regulated";
    readonly pluginTrusted?: boolean;
    readonly requiresTenantScope?: boolean;
    readonly manualTakeoverActive?: boolean;
}
export interface PrincipalAccessProfile {
    readonly principalType: PlatformPrincipalType;
    readonly roles: readonly PlatformRole[];
    readonly capabilities: readonly PlatformCapability[];
}
export interface AuthorizationContextDecision {
    readonly allowed: boolean;
    readonly requiresApproval: boolean;
    readonly reasonCode: string | null;
    readonly matchedRuleRefs: readonly string[];
    readonly constraints: Record<string, unknown>;
    readonly explainSummary: string;
}
export declare function listPlatformPrincipalTypes(): readonly PlatformPrincipalType[];
export declare function listPlatformRoles(): readonly PlatformRole[];
export declare function defaultRolesForPrincipalType(principalType: PlatformPrincipalType): readonly PlatformRole[];
export declare function capabilitiesForRole(role: PlatformRole): readonly PlatformCapability[];
export declare function inferCapabilitiesForAction(action: AuthorizationAction): readonly PlatformCapability[];
export declare function resolvePrincipalAccessProfile(input: {
    principalType: PlatformPrincipalType;
    roles?: readonly PlatformRole[];
    capabilities?: readonly PlatformCapability[];
}): PrincipalAccessProfile;
export declare function roleGrantsCapabilities(roles: readonly PlatformRole[], requiredCapabilities: readonly PlatformCapability[]): boolean;
export declare function evaluateAuthorizationContext(input: {
    principalType: PlatformPrincipalType;
    roles: readonly PlatformRole[];
    action: AuthorizationAction;
    context?: AuthorizationContext;
    riskCategory?: string;
    mode?: string;
}): AuthorizationContextDecision;
