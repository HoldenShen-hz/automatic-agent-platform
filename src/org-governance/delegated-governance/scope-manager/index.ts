import type {
  GovernanceDelegation,
  GovernancePermission,
  Guardrail,
} from "../delegation-registry/index.js";

export interface GovernanceActionScope {
  readonly orgNodeId: string;
  readonly domainId?: string;
  readonly capability: string;
  readonly permission?: GovernancePermission;
}

export interface GovernanceOperationContext {
  readonly actorId: string;
  readonly actorRole: "platform_team" | "division_admin" | "department_admin" | "team_lead";
  readonly orgNodeId: string;
  readonly domainId?: string;
}

/**
 * Validates if a governance scope matches a delegation.
 */
export function matchesGovernanceScope(
  delegation: GovernanceDelegation,
  scope: GovernanceActionScope,
): boolean {
  const orgAllowed = delegation.orgNodeIds.length === 0 || delegation.orgNodeIds.includes(scope.orgNodeId);
  const domainAllowed = delegation.domainIds.length === 0 || scope.domainId == null || delegation.domainIds.includes(scope.domainId);
  const capabilityAllowed = delegation.permissions.length === 0 ||
    (scope.permission != null && delegation.permissions.includes(scope.permission));
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
  switch (guardrail.type) {
    case "max_risk_level": {
      const maxRisk = guardrail.value as string;
      const attemptedRisk = attemptedValue as string;
      const riskOrder = ["low", "medium", "high", "critical"];
      const maxIndex = riskOrder.indexOf(maxRisk);
      const attemptIndex = riskOrder.indexOf(attemptedRisk);
      if (attemptIndex > maxIndex) {
        return { allowed: false, reason: `Risk level ${attemptedRisk} exceeds max ${maxRisk}` };
      }
      return { allowed: true, reason: "Within risk guardrail" };
    }
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
      if (attemptedThreshold < minThreshold) {
        return { allowed: false, reason: `Eval threshold ${attemptedThreshold} below minimum ${minThreshold}` };
      }
      return { allowed: true, reason: "Above eval threshold" };
    }
    default:
      return { allowed: true, reason: "Unknown guardrail type" };
  }
}

/**
 * Operation type for self-service governance as defined in §51.3.
 */
export type GovernanceOperationType =
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
      "domain_onboarding",
      "modify_approval_rules",
      "publish_pack",
      "adjust_agent_autonomy",
      "create_trigger",
      "modify_global_guardrails",
      "cross_domain_strategy",
    ],
    division_admin: [
      "domain_onboarding",
      "modify_approval_rules",
      "publish_pack",
      "adjust_agent_autonomy",
      "create_trigger",
    ],
    department_admin: [
      "domain_onboarding",
      "modify_approval_rules",
      "publish_pack",
      "adjust_agent_autonomy",
      "create_trigger",
    ],
    team_lead: [],
  };

  return allowedByRole[role]?.includes(operation) ?? false;
}
