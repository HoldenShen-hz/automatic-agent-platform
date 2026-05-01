import type {
  GovernanceDelegation,
  GovernancePermission,
  Guardrail,
} from "../delegation-registry/index.js";

export interface GovernanceActionScope {
  readonly orgNodeId: string;
  readonly domainId?: string;
  readonly capability?: string;
  readonly action?: string;
  readonly permission?: GovernancePermission;
}

export interface GovernanceOperationContext {
  readonly actorId?: string;
  readonly actorRole: "platform_team" | "division_admin" | "department_admin" | "team_lead";
  readonly orgNodeId: string;
  readonly domainId?: string;
}

/**
 * R34-36 FIX #1977: Delegation must not grant permissions beyond grantor's scope.
 * Grantee's level cannot exceed grantor's level, and specific permissions are
 * already restricted by the delegation's grantor-permission intersection.
 *
 * Validates if a governance scope matches a delegation.
 */
export function matchesGovernanceScope(
  delegation: GovernanceDelegation,
  scope: GovernanceActionScope,
): boolean {
  const orgNodeIds = delegation.orgNodeIds ?? [];
  const domainIds = delegation.domainIds ?? [];
  const permissions = delegation.permissions ?? [];
  const level = delegation.level ?? "view";

  // R34-36 FIX #1977: Level hierarchy - super_admin > admin > operate > view
  // Higher levels include all lower level permissions
  const levelHierarchy = ["view", "operate", "admin", "super_admin"] as const;
  const levelIndex = levelHierarchy.indexOf(level as typeof levelHierarchy[number]);

  // Level check: if level is view/operate, cannot perform admin-level actions
  // Admin and super_admin can perform any action
  if (scope.requiredLevel !== undefined) {
    const requiredIndex = levelHierarchy.indexOf(scope.requiredLevel as typeof levelHierarchy[number]);
    // If delegation level is lower than required, deny
    if (levelIndex < requiredIndex) {
      return false;
    }
  }

  const orgAllowed = orgNodeIds.length === 0 || orgNodeIds.includes(scope.orgNodeId);
  const domainAllowed = domainIds.length === 0 || scope.domainId == null || domainIds.includes(scope.domainId);
  const capabilityAllowed = permissions.length === 0 ||
    (scope.permission != null && permissions.includes(scope.permission));
  return orgAllowed && domainAllowed && capabilityAllowed;
}

/**
 * Checks if a guardrail allows an operation.
 * Platform team guardrails cannot be overridden.
 */
export function evaluateGuardrail(
  guardrail: Guardrail,
  attemptedValue: unknown,
): { allowed: boolean; reason: string } {
  const guardrailType: string | undefined = guardrail.type ?? (guardrail as { guardrailType?: string }).guardrailType;
  switch (guardrailType) {
    case "max_risk_level": {
      const maxRisk = guardrail.value as string;
      const attemptedRisk = attemptedValue as string;
      const riskOrder = ["low", "medium", "high", "critical"];
      const maxIndex = riskOrder.indexOf(maxRisk);
      const attemptIndex = riskOrder.indexOf(attemptedRisk);
      if (maxIndex < 0 || attemptIndex < 0) {
        return {
          allowed: false,
          reason: `Unrecognized risk level guardrail payload: max=${maxRisk}, attempted=${attemptedRisk}`,
        };
      }
      if (attemptIndex > maxIndex) {
        return { allowed: false, reason: `Risk level ${attemptedRisk} exceeds max ${maxRisk}` };
      }
      return { allowed: true, reason: "Within risk guardrail" };
    }
    case "budget_limit":
    case "max_budget": {
      const maxBudget = guardrail.value as number;
      const attemptedBudget = attemptedValue as number;
      if (attemptedBudget > maxBudget) {
        return { allowed: false, reason: `Budget ${attemptedBudget} exceeds max ${maxBudget}` };
      }
      return { allowed: true, reason: "Within budget guardrail" };
    }
    case "forbidden_tools": {
      const forbidden = guardrail.value as string[];
      const attempted = attemptedValue as string;
      if (forbidden.includes(attempted)) {
        return { allowed: false, reason: `Tool ${attempted} is forbidden` };
      }
      return { allowed: true, reason: "Tool not forbidden" };
    }
    case "mandatory_approval": {
      return { allowed: true, reason: "Approval required for this operation" };
    }
    case "min_eval_threshold": {
      const minThreshold = guardrail.value as number;
      const attemptedThreshold = attemptedValue as number;
      if (!Number.isFinite(minThreshold) || !Number.isFinite(attemptedThreshold)) {
        return {
          allowed: false,
          reason: `Invalid eval threshold guardrail payload: min=${String(minThreshold)}, attempted=${String(attemptedThreshold)}`,
        };
      }
      if (attemptedThreshold < minThreshold) {
        return { allowed: false, reason: `Eval threshold ${attemptedThreshold} below minimum ${minThreshold}` };
      }
      return { allowed: true, reason: "Above eval threshold" };
    }
    default:
      return {
        allowed: false,
        reason: `Unknown guardrail type ${guardrailType ?? "undefined"} denied by default`,
      };
  }
}

/**
 * Operation type for self-service governance as defined in §51.3.
 */
export type GovernanceOperationType =
  | "approve_task"
  | "approve_budget_increase"
  | "domain_onboarding"
  | "modify_approval_rules"
  | "publish_pack"
  | "adjust_agent_autonomy"
  | "create_trigger"
  | "modify_global_guardrails"
  | "cross_domain_strategy";

/**
 * Checks if an operation is allowed based on §51.3 table.
 */
export function isOperationAllowedByRole(
  operation: GovernanceOperationType,
  role: GovernanceActionScope["orgNodeId"] extends string ? "platform_team" | "division_admin" | "department_admin" | "team_lead" : never,
): boolean {
  const allowedByRole: Record<string, GovernanceOperationType[]> = {
    platform_team: [
      "approve_task",
      "approve_budget_increase",
      "domain_onboarding",
      "modify_approval_rules",
      "publish_pack",
      "adjust_agent_autonomy",
      "create_trigger",
      "modify_global_guardrails",
      "cross_domain_strategy",
    ],
    division_admin: [
      "approve_task",
      "approve_budget_increase",
      "domain_onboarding",
      "modify_approval_rules",
      "publish_pack",
      "adjust_agent_autonomy",
      "create_trigger",
    ],
    department_admin: [
      "approve_task",
      "domain_onboarding",
      "modify_approval_rules",
      "publish_pack",
      "adjust_agent_autonomy",
      "create_trigger",
    ],
    team_lead: [
      "approve_task",
      "create_trigger",
    ],
  };

  return allowedByRole[role]?.includes(operation) ?? false;
}
