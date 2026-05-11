import { nowIso } from "../../platform/contracts/types/ids.js";
import {
  listActiveGovernanceDelegations,
  type GovernanceDelegation,
  type Guardrail,
} from "./delegation-registry/index.js";
import {
  evaluateGuardrail,
  matchesGovernanceScope,
  type GovernanceActionScope,
  type GovernanceOperationContext,
  isOperationAllowedByRole,
  type GovernanceOperationType,
} from "./scope-manager/index.js";

export interface GovernancePermission {
  readonly type: string;
}

export interface DelegationResolution {
  readonly allowed: boolean;
  readonly delegationId: string | null;
  readonly reasonCodes: readonly string[];
  readonly violatedGuardrails?: readonly string[];
}

export interface GuardrailCheckResult {
  readonly allowed: boolean;
  readonly violatedGuardrails: readonly string[];
  readonly reasons: readonly string[];
}

const GOVERNANCE_PERMISSIONS = new Set([
  "manage_domains",
  "manage_packs",
  "manage_prompts",
  "manage_triggers",
  "manage_approvals",
  "manage_budgets",
  "manage_knowledge",
  "view_audit",
  "manage_agents",
  "manage_eval",
]);

/**
 * Computes the intersection of two permission arrays.
 * Returns only permissions that exist in both arrays.
 */
export function intersectPermissions(
  granted: readonly string[],
  available: readonly string[],
): string[] {
  if (granted.length === 0 || available.length === 0) return [];
  const availableSet = new Set(available);
  return granted.filter((p) => availableSet.has(p));
}

export class DelegatedGovernanceService {
  private readonly delegations: readonly GovernanceDelegation[];

  public constructor(delegations: readonly GovernanceDelegation[]) {
    this.delegations = delegations;
  }

  /**
   * Resolves whether a grantee has permission for a governance action scope.
   * When grantorPermissions is provided, the grantee's effective permissions are
   * limited to the intersection of granted permissions and grantor's actual permissions.
   * This ensures grantees cannot exceed the grantor's authority.
   */
  public resolve(
    granteeId: string,
    scope: GovernanceActionScope,
    now = nowIso(),
    grantorPermissions?: readonly string[],
  ): DelegationResolution {
    const active = listActiveGovernanceDelegations(this.delegations, now)
      .filter((item) => item.granteeId === granteeId);
    const matched = active.find((item) => matchesGovernanceScope(item, scope)) ?? null;

    if (matched == null) {
      return {
        allowed: false,
        delegationId: null,
        reasonCodes: ["delegated_governance.scope_not_granted"],
      };
    }

    // If grantor's permissions are provided, compute intersection to prevent
    // grantee from gaining permissions beyond what grantor actually has
    if (grantorPermissions != null && grantorPermissions.length > 0) {
      const grantedPerms = matched.permissions ?? [];
      const effectivePerms = intersectPermissions(grantedPerms, grantorPermissions);

      // Check if the requested permission is in the effective permissions
      const requestedPerm = scope.permission;
      if (requestedPerm != null && !effectivePerms.includes(requestedPerm)) {
        return {
          allowed: false,
          delegationId: matched.delegationId,
          reasonCodes: ["delegated_governance.permission_exceeds_grantor_authority"],
        };
      }
    }

    return {
      allowed: true,
      delegationId: matched.delegationId,
      reasonCodes: ["delegated_governance.scope_granted"],
    };
  }

  /**
   * Checks if an operation is allowed for the given context, considering guardrails.
   * Implements §51.2 governance inheritance and override rules.
   */
  public checkOperation(
    ctx: GovernanceOperationContext,
    operation: GovernanceOperationType,
    attemptedValue?: unknown,
  ): GuardrailCheckResult {
    // First check if operation is allowed by role per §51.3
    const roleAllowed = isOperationAllowedByRole(operation, ctx.actorRole);
    if (!roleAllowed) {
      return {
        allowed: false,
        violatedGuardrails: ["role_guardrail"],
        reasons: [`Operation ${operation} not permitted for role ${ctx.actorRole}`],
      };
    }

    // Platform team guardrails apply to all roles - collect all applicable guardrails
    const allGuardrails: Guardrail[] = [];
    const applicableOrgNodeIds = new Set([ctx.orgNodeId, ...(ctx.orgLineageNodeIds ?? [])]);
    for (const delegation of this.delegations) {
      if (delegation.status !== "active") continue;

      const orgNodeIds = delegation.orgNodeIds ?? [];
      const domainIds = delegation.domainIds ?? [];
      const orgMatch = orgNodeIds.length === 0 || orgNodeIds.some((orgNodeId) => applicableOrgNodeIds.has(orgNodeId));
      const domainMatch = domainIds.length === 0 || (ctx.domainId != null && domainIds.includes(ctx.domainId));

      if (orgMatch && domainMatch) {
        allGuardrails.push(...(delegation.guardrails ?? []));
      }
    }

    // Evaluate each guardrail
    const violatedGuardrails: string[] = [];
    const reasons: string[] = [];

    for (const guardrail of allGuardrails) {
      if (attemptedValue === undefined) {
        violatedGuardrails.push(guardrail.guardrailId);
        reasons.push(`Guardrail ${guardrail.guardrailId} requires an attempted value`);
        continue;
      }

      const result = evaluateGuardrail(guardrail, attemptedValue);
      if (!result.allowed) {
        violatedGuardrails.push(guardrail.guardrailId);
        reasons.push(result.reason);
      }
    }

    return {
      allowed: violatedGuardrails.length === 0,
      violatedGuardrails,
      reasons,
    };
  }

  /**
   * Gets all guardrails applicable to an org node / domain.
   */
  public getApplicableGuardrails(
    orgNodeId: string,
    domainId?: string,
  ): Guardrail[] {
    const guardrails: Guardrail[] = [];

    for (const delegation of this.delegations) {
      if (delegation.status !== "active") continue;

      const orgNodeIds = delegation.orgNodeIds ?? [];
      const domainIds = delegation.domainIds ?? [];
      const orgMatch = orgNodeIds.length === 0 || orgNodeIds.includes(orgNodeId);
      const domainMatch = domainIds.length === 0 || (domainId != null && domainIds.includes(domainId));

      if (orgMatch && domainMatch) {
        guardrails.push(...(delegation.guardrails ?? []));
      }
    }

    return guardrails;
  }

  /**
   * Lists all active delegations for a grantee.
   */
  public listDelegationsForGrantee(
    granteeId: string,
    now = nowIso(),
  ): GovernanceDelegation[] {
    return listActiveGovernanceDelegations(this.delegations, now)
      .filter((item) => item.granteeId === granteeId);
  }

  /**
   * Validates governance inheritance rules per §51.2.
   * Returns true if the action is valid given the hierarchy.
   */
  public validateInheritanceRule(
    parentRole: GovernanceOperationContext["actorRole"],
    childRole: GovernanceOperationContext["actorRole"],
    action: "tighten" | "loosen" | "append" | "delete",
  ): { allowed: boolean; reason: string } {
    // Hierarchy: platform_team > division_admin > department_admin > team_lead
    const hierarchy: GovernanceOperationContext["actorRole"][] = [
      "platform_team",
      "division_admin",
      "department_admin",
      "team_lead",
    ];

    const parentIndex = hierarchy.indexOf(parentRole);
    const childIndex = hierarchy.indexOf(childRole);

    // Child cannot perform actions reserved for parent
    if (childIndex < parentIndex) {
      return { allowed: false, reason: "Insufficient role level" };
    }

    switch (action) {
      case "tighten":
        // Anyone can tighten (lower risk, lower budget)
        return { allowed: true, reason: "Tightening allowed" };

      case "loosen":
        // Only parent can loosen (higher risk, higher budget)
        if (childIndex > parentIndex) {
          return { allowed: false, reason: "Lower roles cannot loosen restrictions" };
        }
        return { allowed: true, reason: "Loosening allowed for parent role" };

      case "append":
        // Anyone can append constraints
        return { allowed: true, reason: "Appending constraints allowed" };

      case "delete":
        // Only the role that set it can delete (must check grantorId)
        if (childIndex > parentIndex) {
          return { allowed: false, reason: "Cannot delete parent role constraints" };
        }
        return { allowed: true, reason: "Delete subject to ownership check" };

      default:
        return { allowed: false, reason: "Unknown action" };
    }
  }
}
