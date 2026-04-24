import type {
  DomainUIConfig,
  FeatureGuardContext,
  FieldVisibilityPolicy,
  RedactionLevel,
  RedactionRule,
  RouteGuardChain,
  RouteGuardResult,
} from "@aa/shared-types";

export function createFeatureGuardContext(overrides: Partial<FeatureGuardContext> = {}): FeatureGuardContext {
  return {
    authenticated: true,
    tenantId: "tenant-default",
    domainId: "platform",
    permissions: ["authenticated"],
    roles: ["operator"],
    featureFlags: {},
    featureVisibility: {},
    mode: "enterprise",
    ...overrides,
  };
}

export interface RouteGuardChainOptions {
  readonly requiredRoles?: readonly string[];
  readonly allowedDomains?: readonly string[];
  readonly featureFlag?: string;
  readonly featureId?: string;
  readonly requireEnterpriseMode?: boolean;
}

function allowedResult(evaluatedLayers: readonly string[]): RouteGuardResult {
  return { allowed: true, reason: null, evaluatedLayers };
}

function deniedResult(reason: string, evaluatedLayers: readonly string[]): RouteGuardResult {
  return { allowed: false, reason, evaluatedLayers };
}

export function createRouteGuardChain(
  permission: string,
  featureFlag?: string,
  options: RouteGuardChainOptions = {},
): RouteGuardChain {
  const resolvedFeatureFlag = options.featureFlag ?? featureFlag;
  const requiredRoles = options.requiredRoles ?? [];
  const allowedDomains = options.allowedDomains ?? [];
  const featureId = options.featureId ?? resolvedFeatureFlag ?? permission;

  return {
    id: `guard:${permission}${resolvedFeatureFlag ? `:${resolvedFeatureFlag}` : ""}`,
    evaluate(context): RouteGuardResult {
      const evaluatedLayers: string[] = [];

      evaluatedLayers.push("auth");
      if (!context.authenticated) {
        return deniedResult("auth.required", evaluatedLayers);
      }

      evaluatedLayers.push("role");
      if (requiredRoles.length > 0 && !requiredRoles.some((role) => context.roles.includes(role))) {
        return deniedResult(`role.missing:${requiredRoles.join("|")}`, evaluatedLayers);
      }

      evaluatedLayers.push("permission");
      if (context.tenantId == null) {
        return deniedResult("tenant.required", evaluatedLayers);
      }
      if (!context.permissions.includes(permission)) {
        return deniedResult(`permission.missing:${permission}`, evaluatedLayers);
      }

      evaluatedLayers.push("feature-flag");
      if (resolvedFeatureFlag != null && context.featureFlags[resolvedFeatureFlag] === false) {
        return deniedResult(`feature.disabled:${resolvedFeatureFlag}`, evaluatedLayers);
      }

      evaluatedLayers.push("domain");
      if (context.featureVisibility[featureId] === false) {
        return deniedResult(`feature.hidden:${featureId}`, evaluatedLayers);
      }
      if (allowedDomains.length > 0 && (context.domainId == null || !allowedDomains.includes(context.domainId))) {
        return deniedResult(`domain.unauthorized:${context.domainId ?? "none"}`, evaluatedLayers);
      }
      if (options.requireEnterpriseMode === true && context.mode !== "enterprise") {
        return deniedResult("mode.enterprise_required", evaluatedLayers);
      }

      return allowedResult(evaluatedLayers);
    },
  };
}

export function createDomainUiConfig(domainId: string, overrides: Partial<DomainUIConfig> = {}): DomainUIConfig {
  return {
    domainId,
    featureVisibility: {},
    actionPolicy: {},
    defaultDrillDepth: 2,
    glossaryOverrides: {},
    slotRegistry: [],
    ...overrides,
  };
}

export function applyRedaction(policy: FieldVisibilityPolicy, fieldPath: string, roleLevel: string, value: unknown): unknown {
  const matched = policy.rules.find((rule) => matchesRule(rule, fieldPath, roleLevel));
  const level = matched?.redactionLevel ?? policy.defaultLevel;
  if (level === "hidden") {
    return undefined;
  }
  if (level === "redacted") {
    return matched?.redactionMask ?? "[REDACTED]";
  }
  if (level === "summary") {
    return matched?.summaryTemplate ?? summarizeValue(value);
  }
  return value;
}

function matchesRule(rule: RedactionRule, fieldPath: string, roleLevel: string): boolean {
  return fieldPath.includes(rule.fieldPattern) && rule.roleLevel === roleLevel;
}

function summarizeValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `${value.length} items`;
  }
  if (typeof value === "string") {
    return value.length > 24 ? `${value.slice(0, 24)}...` : value;
  }
  if (value != null && typeof value === "object") {
    return `object:${Object.keys(value).length}`;
  }
  return String(value ?? "");
}

export function selectRedactionLevel(policy: FieldVisibilityPolicy, fieldPath: string, roleLevel: string): RedactionLevel {
  return policy.rules.find((rule) => matchesRule(rule, fieldPath, roleLevel))?.redactionLevel ?? policy.defaultLevel;
}
