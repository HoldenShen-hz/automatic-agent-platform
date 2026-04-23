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
    permissions: ["authenticated"],
    featureFlags: {},
    mode: "enterprise",
    ...overrides,
  };
}

export function createRouteGuardChain(permission: string, featureFlag?: string): RouteGuardChain {
  return {
    id: `guard:${permission}${featureFlag ? `:${featureFlag}` : ""}`,
    evaluate(context): RouteGuardResult {
      if (!context.authenticated) {
        return { allowed: false, reason: "auth.required" };
      }
      if (context.tenantId == null) {
        return { allowed: false, reason: "tenant.required" };
      }
      if (!context.permissions.includes(permission)) {
        return { allowed: false, reason: `permission.missing:${permission}` };
      }
      if (featureFlag != null && context.featureFlags[featureFlag] === false) {
        return { allowed: false, reason: `feature.disabled:${featureFlag}` };
      }
      return { allowed: true, reason: null };
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
