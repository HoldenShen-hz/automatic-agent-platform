export type PlatformPrincipalType = "user" | "agent" | "system" | "service" | "worker" | "plugin";

export type PlatformRole =
  | "viewer"
  | "human_operator"
  | "approver"
  | "platform_admin"
  | "agent_runtime"
  | "service_operator"
  | "worker_runtime"
  | "plugin_runtime"
  | "system_runtime";

export type PlatformCapability =
  | "model:invoke"
  | "tool:invoke"
  | "fs:write"
  | "exec:command"
  | "network:access"
  | "extension:install"
  | "org:change"
  | "execution:dispatch"
  | "improvement:promote"
  | "rollout:advance"
  | "memory:promote"
  | "knowledge:trust:modify";

export type AuthorizationAction =
  | "invoke_model"
  | "invoke_tool"
  | "write_file"
  | "exec_command"
  | "network_access"
  | "install_extension"
  | "org_change"
  | "dispatch_execution"
  | "set_isolation_level"
  | "promote_improvement"
  | "advance_rollout"
  | "modify_knowledge_trust"
  | "promote_memory_layer";

export interface AuthorizationContext {
  readonly tenantId?: string | null;
  readonly environment?: "workspace" | "staging" | "production";
  readonly dataClassification?: "internal" | "confidential" | "regulated";
  readonly pluginTrusted?: boolean;
  readonly requiresTenantScope?: boolean;
  readonly manualTakeoverActive?: boolean;
  readonly principalId?: string | null;
  readonly timeOfDay?: "business_hours" | "off_hours";
  readonly riskLevel?: "low" | "medium" | "high";
  /** Original principal when performing on-behalf-of/impersonation */
  readonly originalPrincipal?: {
    readonly type: PlatformPrincipalType;
    readonly roles: readonly PlatformRole[];
    readonly tenantId?: string | null;
  };
}

export type AuthorizationEvaluationLayer = "rbac" | "capability" | "context_aware";

export interface PrincipalAccessProfile {
  readonly principalType: PlatformPrincipalType;
  readonly roles: readonly PlatformRole[];
  readonly capabilities: readonly PlatformCapability[];
  readonly evaluatedContext: AuthorizationContext | null;
}

export interface AuthorizationContextDecision {
  readonly allowed: boolean;
  readonly requiresApproval: boolean;
  readonly reasonCode: string | null;
  readonly matchedRuleRefs: readonly string[];
  readonly constraints: Record<string, unknown>;
  readonly explainSummary: string;
  readonly evaluatedLayers: readonly AuthorizationEvaluationLayer[];
  readonly deniedBy: AuthorizationEvaluationLayer | null;
}

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
    "network:access",
  ],
  service_operator: [
    "model:invoke",
    "tool:invoke",
    "exec:command",
    "network:access",
    "extension:install",
    "org:change",
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
} as const satisfies Record<PlatformRole, readonly PlatformCapability[]>;

/**
 * R10-01: Role inheritance hierarchy.
 * Roles can inherit capabilities from parent roles.
 * Inheritance chain: role -> parent -> grandparent -> ... -> base role (with empty capabilities)
 */
const ROLE_INHERITANCE_HIERARCHY: Record<PlatformRole, PlatformRole | null> = {
  viewer: null,                           // Base role, no parent
  human_operator: "viewer",               // Inherits from viewer
  approver: "viewer",                    // Inherits from viewer
  platform_admin: null,                   // Top-level admin, no parent needed (has all)
  agent_runtime: null,                    // Base agent role
  service_operator: null,                 // Base service role
  worker_runtime: null,                  // Base worker role
  plugin_runtime: null,                   // Base plugin role
  system_runtime: null,                   // Base system role
};

const DEFAULT_ROLES_BY_PRINCIPAL = {
  user: ["viewer"],
  agent: ["agent_runtime"],
  system: ["system_runtime"],
  service: ["service_operator"],
  worker: ["worker_runtime"],
  plugin: ["plugin_runtime"],
} as const satisfies Record<PlatformPrincipalType, readonly PlatformRole[]>;

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
} as const satisfies Record<AuthorizationAction, readonly PlatformCapability[]>;

const PRODUCTION_OPERATOR_REQUIRED_ACTIONS = new Set<AuthorizationAction>([
  "exec_command",
  "org_change",
  "install_extension",
  "dispatch_execution",
  "set_isolation_level",
  "advance_rollout",
  "promote_improvement",
  "modify_knowledge_trust",
  "promote_memory_layer",
]);

export function listPlatformPrincipalTypes(): readonly PlatformPrincipalType[] {
  return ["user", "agent", "system", "service", "worker", "plugin"];
}

export function listPlatformRoles(): readonly PlatformRole[] {
  return Object.keys(ROLE_CAPABILITY_MAP) as PlatformRole[];
}

export function defaultRolesForPrincipalType(principalType: PlatformPrincipalType): readonly PlatformRole[] {
  return DEFAULT_ROLES_BY_PRINCIPAL[principalType];
}

/**
 * R10-01: Resolves capabilities for a role, including inherited capabilities from parent roles.
 */
export function capabilitiesForRole(role: PlatformRole): readonly PlatformCapability[] {
  // Collect capabilities from inheritance chain
  const capabilities = new Set<PlatformCapability>();
  let currentRole: PlatformRole | null = role;

  while (currentRole !== null) {
    const roleCaps = ROLE_CAPABILITY_MAP[currentRole];
    for (const cap of roleCaps) {
      capabilities.add(cap);
    }
    currentRole = ROLE_INHERITANCE_HIERARCHY[currentRole];
  }

  return [...capabilities];
}

export function inferCapabilitiesForAction(action: AuthorizationAction): readonly PlatformCapability[] {
  return ACTION_CAPABILITY_MAP[action];
}

/**
 * R10-01: Resolves principal access profile with hierarchical role inheritance.
 */
export function resolvePrincipalAccessProfile(input: {
  principalType: PlatformPrincipalType;
  roles?: readonly PlatformRole[];
  capabilities?: readonly PlatformCapability[];
  context?: AuthorizationContext;
}): PrincipalAccessProfile {
  const roles = dedupeRoles(input.roles?.length ? input.roles : defaultRolesForPrincipalType(input.principalType));
  const roleCapabilities = dedupeCapabilities(roles.flatMap((role) => capabilitiesForRole(role)));
  const requestedCapabilities = input.capabilities?.length
    ? dedupeCapabilities(input.capabilities.filter((capability) => roleCapabilities.includes(capability)))
    : roleCapabilities;
  return Object.freeze({
    principalType: input.principalType,
    roles: Object.freeze([...roles]),
    capabilities: Object.freeze([...requestedCapabilities]),
    evaluatedContext: input.context ?? null,
  });
}

/**
 * R10-01: Checks if the given roles grant the required capabilities, considering hierarchical inheritance.
 */
export function roleGrantsCapabilities(
  roles: readonly PlatformRole[],
  requiredCapabilities: readonly PlatformCapability[],
): boolean {
  // R10-01: Use hierarchical capabilitiesForRole to resolve inherited capabilities
  const granted = new Set(roles.flatMap((role) => capabilitiesForRole(role)));
  return requiredCapabilities.every((capability) => granted.has(capability));
}

export function evaluateAuthorizationContext(input: {
  principalType: PlatformPrincipalType;
  roles: readonly PlatformRole[];
  action: AuthorizationAction;
  principalTenantId?: string | null;
  context?: AuthorizationContext;
  riskCategory?: string;
  mode?: string;
}): AuthorizationContextDecision {
  const context = input.context;
  const allLayers = Object.freeze<AuthorizationEvaluationLayer[]>(["rbac", "capability", "context_aware"]);
  const rbacOnly = Object.freeze<AuthorizationEvaluationLayer[]>(["rbac"]);

  function deny(
    deniedBy: AuthorizationEvaluationLayer,
    evaluatedLayers: readonly AuthorizationEvaluationLayer[],
    reasonCode: string,
    matchedRuleRefs: readonly string[],
    constraints: Record<string, unknown>,
    explainSummary: string,
  ): AuthorizationContextDecision {
    return {
      allowed: false,
      requiresApproval: false,
      reasonCode,
      matchedRuleRefs,
      constraints,
      explainSummary,
      evaluatedLayers,
      deniedBy,
    };
  }

  function allow(
    evaluatedLayers: readonly AuthorizationEvaluationLayer[],
    input: {
      requiresApproval?: boolean;
      reasonCode?: string | null;
      matchedRuleRefs: readonly string[];
      constraints: Record<string, unknown>;
      explainSummary: string;
    },
  ): AuthorizationContextDecision {
    return {
      allowed: true,
      requiresApproval: input.requiresApproval ?? false,
      reasonCode: input.reasonCode ?? null,
      matchedRuleRefs: input.matchedRuleRefs,
      constraints: input.constraints,
      explainSummary: input.explainSummary,
      evaluatedLayers,
      deniedBy: null,
    };
  }

  const scopedTenantId = context?.tenantId ?? null;
  const originalPrincipalTenantId = context?.originalPrincipal?.tenantId ?? null;
  const principalTenantId = originalPrincipalTenantId ?? input.principalTenantId ?? null;
  const tenantScopeRequired = context?.requiresTenantScope === true
    || scopedTenantId != null
    || originalPrincipalTenantId != null
    || context?.manualTakeoverActive === true;

  // N-0075: Tenant validation for impersonation/on-behalf-of
  if (tenantScopeRequired) {
    if (scopedTenantId == null || scopedTenantId.length === 0) {
      return deny(
        "context_aware",
        allLayers,
        "policy.context_tenant_scope_required",
        ["context.tenant_scope_required"],
        { tenantScopeRequired: true },
        "Context-aware authorization requires a tenant scope for this action.",
      );
    }
    if (principalTenantId == null || principalTenantId.length === 0) {
      return deny(
        "context_aware",
        allLayers,
        "policy.context_principal_tenant_required",
        ["context.principal_tenant_required"],
        {
          tenantScopeRequired: true,
          requestedTenant: scopedTenantId,
          originalPrincipal: context?.originalPrincipal ?? null,
        },
        "Tenant-scoped authorization requires the principal tenant to be known.",
      );
    }
    if (principalTenantId !== scopedTenantId) {
      return deny(
        "context_aware",
        allLayers,
        "policy.context_tenant_mismatch",
        ["context.tenant_mismatch"],
        {
          tenantScopeRequired: true,
          requestedTenant: scopedTenantId,
          principalTenantId,
          originalPrincipal: context?.originalPrincipal ?? null,
        },
        "On-behalf-of authorization failed: original principal tenant does not match target tenant.",
      );
    }
  }

  if (
    context?.environment === "production"
    && PRODUCTION_OPERATOR_REQUIRED_ACTIONS.has(input.action)
    && !input.roles.some((role) => role === "platform_admin" || role === "human_operator" || role === "service_operator")
  ) {
    return deny(
      "context_aware",
      allLayers,
      "policy.context_production_operator_required",
      ["context.production_operator_required"],
      {
        environment: "production",
        requiredRoles: ["platform_admin", "human_operator", "service_operator"],
        action: input.action,
      },
      "Production-scoped execution requires an operator-grade principal role.",
    );
  }

  if (
    context?.manualTakeoverActive === true
    && (
      scopedTenantId == null
      || originalPrincipalTenantId == null
      || originalPrincipalTenantId !== scopedTenantId
    )
  ) {
    if (context.tenantId == null || context.tenantId.length === 0) {
      return deny(
        "context_aware",
        allLayers,
        "policy.context_manual_takeover_tenant_required",
        ["context.manual_takeover_tenant_required"],
        {
          manualTakeoverActive: true,
          requestedTenant: scopedTenantId,
          originalPrincipal: context.originalPrincipal ?? null,
        },
        "Manual takeover requires a verified original-principal tenant scope.",
      );
    }
  }

  const requiredCapabilities = inferCapabilitiesForAction(input.action);
  if (!roleGrantsCapabilities(input.roles, requiredCapabilities)) {
    return deny(
      "rbac",
      rbacOnly,
      "policy.capability_not_granted",
      ["role.capability_required"],
      {
        requiredCapabilities: [...requiredCapabilities],
        grantedRoles: [...input.roles],
      },
      `Role(s) ${input.roles.join(", ")} do not grant required capability(ies) for action ${input.action}.`,
    );
  }

  if (input.principalType === "plugin" && input.action === "network_access" && context?.pluginTrusted !== true) {
    return deny(
      "context_aware",
      allLayers,
      "policy.context_plugin_trust_required",
      ["context.plugin_trust_required"],
      { pluginTrusted: false },
      "Plugin network access requires a trusted plugin context.",
    );
  }

  if (
    context?.dataClassification === "regulated"
    && (input.mode === "full-auto" || input.riskCategory === "sensitive_data")
  ) {
    return allow(allLayers, {
      requiresApproval: true,
      reasonCode: "policy.context_regulated_data_requires_approval",
      matchedRuleRefs: ["context.regulated_data_requires_approval"],
      constraints: { dataClassification: "regulated" },
      explainSummary: "Regulated data access requires approval in the current execution context.",
    });
  }

  if (context?.manualTakeoverActive === true) {
    const operatorRoles: readonly PlatformRole[] = ["platform_admin", "human_operator", "service_operator"];
    if (!input.roles.some((role) => operatorRoles.includes(role))) {
      return deny(
        "context_aware",
        allLayers,
        "policy.context_manual_takeover_operator_required",
        ["context.manual_takeover_operator_required"],
        {
          manualTakeoverActive: true,
          requiredRoles: [...operatorRoles],
          originalPrincipal: context.originalPrincipal ?? null,
        },
        "Manual takeover execution requires an operator-grade principal role.",
      );
    }
    return allow(allLayers, {
      matchedRuleRefs: ["context.manual_takeover_active"],
      constraints: {
        manualTakeoverActive: true,
        originalPrincipal: context.originalPrincipal ?? null,
      },
      explainSummary: "Manual takeover context recorded for audit and downstream controls.",
    });
  }

  return allow(allLayers, {
    matchedRuleRefs: ["context.default_allow"],
    constraints: {},
    explainSummary: "Context-aware authorization allowed this action after capability and context checks passed.",
  });
}

function dedupeRoles(roles: readonly PlatformRole[]): readonly PlatformRole[] {
  return [...new Set(roles)];
}

function dedupeCapabilities(capabilities: readonly PlatformCapability[]): readonly PlatformCapability[] {
  return [...new Set(capabilities)];
}
