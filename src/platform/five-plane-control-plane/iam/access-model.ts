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

/**
 * Role hierarchy for three-layer authorization model (RBAC → Capability → Context-aware).
 * §11.2 requires hierarchical role inheritance where child roles inherit parent capabilities.
 * Inheritance chain: base → standard → operator → admin
 */
const ROLE_HIERARCHY: Record<PlatformRole, PlatformRole | null> = {
  viewer: null,                              // Base role - no inheritance
  human_operator: "viewer",                  // Inherits viewer
  approver: "viewer",                       // Inherits viewer
  worker_runtime: "viewer",                  // Inherits viewer
  plugin_runtime: "viewer",                  // Inherits viewer
  agent_runtime: "viewer",                   // Runtime agent stays below operator-grade privileges
  service_operator: "human_operator",        // Service operator inherits operator-grade privileges
  system_runtime: "service_operator",        // Inherits service_operator
  platform_admin: "system_runtime",          // Inherits system_runtime - top of hierarchy
};

/**
 * Base capabilities at RBAC Layer 1. Higher roles inherit these.
 * §11.2 requires flat capability lists to be replaced with hierarchical chain.
 */
const BASE_CAPABILITIES: readonly PlatformCapability[] = [];

/**
 * Standard operator capabilities - inherited by operator and admin roles.
 */
const STANDARD_CAPABILITIES: readonly PlatformCapability[] = [
  "model:invoke",
  "tool:invoke",
  "network:access",
];

/**
 * Extended operator capabilities - inherited by service and admin roles.
 */
const EXTENDED_CAPABILITIES: readonly PlatformCapability[] = [
  ...STANDARD_CAPABILITIES,
  "fs:write",
  "exec:command",
];

/**
 * Service operator capabilities - can act on execution/rollout paths but not org-wide admin.
 */
const SERVICE_OPERATOR_CAPABILITIES: readonly PlatformCapability[] = [
  ...EXTENDED_CAPABILITIES,
  "execution:dispatch",
  "rollout:advance",
  "knowledge:trust:modify",
];

/**
 * System runtime capabilities - broader than service operators but below full admin.
 */
const SYSTEM_RUNTIME_CAPABILITIES: readonly PlatformCapability[] = [
  ...SERVICE_OPERATOR_CAPABILITIES,
  "memory:promote",
  "knowledge:trust:modify",
];

/**
 * Admin capabilities - top-level role gets all capabilities.
 */
const ADMIN_CAPABILITIES: readonly PlatformCapability[] = [
  ...EXTENDED_CAPABILITIES,
  "extension:install",
  "org:change",
  "execution:dispatch",
  "improvement:promote",
  "rollout:advance",
  "memory:promote",
  "knowledge:trust:modify",
];

/**
 * Role capability map with hierarchical inheritance.
 * Each role's capabilities are computed by walking the inheritance chain.
 * §11.2: RBAC → Capability → Context-aware three-layer model.
 */
const ROLE_CAPABILITY_MAP: Record<PlatformRole, readonly PlatformCapability[]> = {
  viewer: BASE_CAPABILITIES,
  human_operator: EXTENDED_CAPABILITIES,
  approver: STANDARD_CAPABILITIES,
  worker_runtime: BASE_CAPABILITIES,
  plugin_runtime: ["network:access"],
  agent_runtime: STANDARD_CAPABILITIES,
  service_operator: SERVICE_OPERATOR_CAPABILITIES,
  system_runtime: SYSTEM_RUNTIME_CAPABILITIES,
  platform_admin: ADMIN_CAPABILITIES,
} as const satisfies Record<PlatformRole, readonly PlatformCapability[]>;

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
 * Walk the role inheritance chain to collect all capabilities.
 * §11.2 RBAC Layer 1: hierarchical role inheritance.
 */
export function capabilitiesForRole(role: PlatformRole): readonly PlatformCapability[] {
  const capabilities = new Set<PlatformCapability>();
  let currentRole: PlatformRole | null = role;
  while (currentRole !== null) {
    const caps = ROLE_CAPABILITY_MAP[currentRole];
    for (const cap of caps) {
      capabilities.add(cap);
    }
    currentRole = ROLE_HIERARCHY[currentRole];
  }
  return Array.from(capabilities);
}

/**
 * Get the full inheritance chain for a role (for audit/debugging).
 * §11.2 RBAC Layer 1: role hierarchy visualization.
 */
export function getRoleInheritanceChain(role: PlatformRole): readonly PlatformRole[] {
  const chain: PlatformRole[] = [];
  let current: PlatformRole | null = role;
  while (current !== null) {
    chain.push(current);
    current = ROLE_HIERARCHY[current];
  }
  return chain;
}

export function inferCapabilitiesForAction(action: AuthorizationAction): readonly PlatformCapability[] {
  return ACTION_CAPABILITY_MAP[action];
}

/**
 * Resolves principal access profile with hierarchical capability resolution.
 * §11.2: RBAC Layer 1 (role inheritance) → Capability aggregation.
 * §167-1947 SECURITY FIX: Exported for external callers (policy-engine) to validate
 * role grants. Previously roleGrantsCapabilities/inferCapabilitiesForAction were
 * defined but not called by external modules for policy decisions.
 */
export function resolvePrincipalAccessProfile(input: {
  principalType: PlatformPrincipalType;
  roles?: readonly PlatformRole[];
}): PrincipalAccessProfile {
  const roles = dedupeRoles(input.roles?.length ? input.roles : defaultRolesForPrincipalType(input.principalType));
  // Walk inheritance chain for each role to collect all inherited capabilities
  const roleCapabilities = dedupeCapabilities(roles.flatMap((role) => capabilitiesForRole(role)));
  // SECURITY FIX (§167-1941): Use ONLY role-derived capabilities (intersection), not union.
  // A viewer with BASE_CAPABILITIES=[] could otherwise claim arbitrary capabilities like exec:command.
  // Input capabilities are discarded - role capabilities are the single source of truth.
  const capabilities = dedupeCapabilities(roleCapabilities);
  return {
    principalType: input.principalType,
    roles,
    capabilities,
  };
}

/**
 * Check if roles grant required capabilities using hierarchical resolution.
 * §11.2: RBAC Layer 1 with inheritance chain.
 */
export function roleGrantsCapabilities(
  roles: readonly PlatformRole[],
  requiredCapabilities: readonly PlatformCapability[],
): boolean {
  const granted = new Set(roles.flatMap((role) => capabilitiesForRole(role)));
  for (const required of requiredCapabilities) {
    if (!granted.has(required)) return false;
  }
  return true;
}

export function evaluateAuthorizationContext(input: {
  principalType: PlatformPrincipalType;
  roles: readonly PlatformRole[];
  action: AuthorizationAction;
  context?: AuthorizationContext;
  riskCategory?: string;
  mode?: string;
}): AuthorizationContextDecision {
  const context = input.context;
  const requiredCapabilities = inferCapabilitiesForAction(input.action);
  const hasRequiredCapabilities = roleGrantsCapabilities(input.roles, requiredCapabilities);
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

  if (
    context?.environment === "production"
    && ["exec_command", "org_change", "install_extension"].includes(input.action)
    && !input.roles.some((role) => role === "platform_admin" || role === "human_operator" || role === "service_operator")
  ) {
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

  if (
    context?.dataClassification === "regulated"
    && (input.mode === "full-auto" || input.riskCategory === "sensitive_data")
  ) {
    if (!hasRequiredCapabilities) {
      return {
        allowed: false,
        requiresApproval: false,
        reasonCode: "policy.capability_required",
        matchedRuleRefs: ["context.default_deny", "capability.required"],
        constraints: { requiredCapabilities },
        explainSummary: "The principal does not hold the capabilities required for this action.",
      };
    }
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
    // SECURITY FIX: manualTakeoverActive should not bypass capability/budget/risk checks.
    // It only allows operator-grade principals to proceed to the normal authorization flow
    // without requiring approval from another human. The normal checks still apply.
    if (!input.roles.some((role) => role === "platform_admin" || role === "human_operator" || role === "service_operator")) {
      return {
        allowed: false,
        requiresApproval: false,
        reasonCode: "policy.context_manual_takeover_operator_required",
        matchedRuleRefs: ["context.manual_takeover_operator_required"],
        constraints: { requiredRoles: ["platform_admin", "human_operator", "service_operator"] },
        explainSummary: "Manual takeover is restricted to operator-grade principals.",
      };
    }
    // Fall through to normal authorization checks - do NOT bypass hasRequiredCapabilities, budget, or risk checks.
    // The manualTakeoverActive flag is recorded in constraints for audit purposes only.
  }

  if (!hasRequiredCapabilities) {
    return {
      allowed: false,
      requiresApproval: false,
      reasonCode: "policy.capability_required",
      matchedRuleRefs: ["context.default_deny", "capability.required"],
      constraints: { requiredCapabilities },
      explainSummary: "The principal does not hold the capabilities required for this action.",
    };
  }

  const manualTakeoverActive = context?.manualTakeoverActive === true;
  return {
    allowed: true,
    requiresApproval: false,
    reasonCode: null,
    matchedRuleRefs: [manualTakeoverActive ? "context.manual_takeover_active" : "context.default_allow"],
    constraints: manualTakeoverActive ? { manualTakeoverActive: true } : {},
    explainSummary: manualTakeoverActive
      ? "Operator-authorized manual takeover recorded; capability and context checks still passed."
      : "Action allowed because the principal satisfies the required capability and context checks.",
  };
}

function dedupeRoles(roles: readonly PlatformRole[]): readonly PlatformRole[] {
  const seen = new Set<PlatformRole>();
  const result: PlatformRole[] = [];
  for (const role of roles) {
    if (!seen.has(role)) {
      seen.add(role);
      result.push(role);
    }
  }
  return result;
}

function dedupeCapabilities(capabilities: readonly PlatformCapability[]): readonly PlatformCapability[] {
  const seen = new Set<PlatformCapability>();
  const result: PlatformCapability[] = [];
  for (const cap of capabilities) {
    if (!seen.has(cap)) {
      seen.add(cap);
      result.push(cap);
    }
  }
  return result;
}
