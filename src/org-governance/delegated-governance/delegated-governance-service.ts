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

export class DelegatedGovernanceService {
  private readonly delegations: readonly GovernanceDelegation[];

  public constructor(delegations: readonly GovernanceDelegation[]) {
    this.delegations = delegations;
  }

  /**
   * Resolves whether a grantee has permission for a governance action scope.
   */
  public resolve(
    granteeId: string,
    scope: GovernanceActionScope,
    now = nowIso(),
  ): DelegationResolution {
    const active = listActiveGovernanceDelegations(this.delegations, now)
      .filter((item) => item.granteeId === granteeId);
    const matched = active.find((item) => matchesGovernanceScope(item, scope)) ?? null;
    return {
      allowed: matched != null,
      delegationId: matched?.delegationId ?? null,
      reasonCodes: matched == null
        ? ["delegated_governance.scope_not_granted"]
        : ["delegated_governance.scope_granted"],
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

    // Platform team guardrails apply to all roles - but division/dept admin guardrails
    // apply only to their respective scopes. Collect all applicable guardrails.
    const allGuardrails: Guardrail[] = [];
    for (const delegation of this.delegations) {
      if (delegation.status !== "active") continue;

      const orgNodeIds = delegation.orgNodeIds ?? [];
      const domainIds = delegation.domainIds ?? [];
      const orgMatch = orgNodeIds.length === 0 || orgNodeIds.includes(ctx.orgNodeId);
      const domainMatch = domainIds.length === 0 || (ctx.domainId != null && domainIds.includes(ctx.domainId));

      if (orgMatch && domainMatch) {
        allGuardrails.push(...(delegation.guardrails ?? []));
      }
    }

    // R21-1 FIX: If no attemptedValue is provided but guardrails exist,
    // the operation must be denied since we cannot validate constraints without a value.
    // Previously, undefined attemptedValue would pass through evaluateGuardrail which may
    // return allowed:true for undefined values, bypassing all guardrail constraints.
    if (attemptedValue === undefined && allGuardrails.length > 0) {
      return {
        allowed: false,
        violatedGuardrails: allGuardrails.map((g) => g.guardrailId),
        reasons: ["Operation requires a value to evaluate guardrail constraints"],
      };
    }

    // Evaluate each guardrail
    const violatedGuardrails: string[] = [];
    const reasons: string[] = [];

    for (const guardrail of allGuardrails) {
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

    // R34-36 FIX #1982: Unrecognized roles (index -1) cannot perform any inheritance action
    if (parentIndex < 0 || childIndex < 0) {
      return { allowed: false, reason: "Unrecognized role in hierarchy" };
    }

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
        // Lower roles must not delete higher-level constraints.
        // Deletion is only allowed when acting on constraints owned at the same role level.
        if (childIndex !== parentIndex) {
          return { allowed: false, reason: "Cannot delete parent role constraints" };
        }
        return { allowed: true, reason: "Delete allowed for same role level" };

      default:
        return { allowed: false, reason: "Unknown action" };
    }
  }
}
