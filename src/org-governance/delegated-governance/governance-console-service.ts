/**
 * Self-Service Governance Console - Basic Stub
 *
 * This module provides a basic stub implementation of the self-service governance
 * console as described in architecture doc §51.
 *
 * The governance console allows organization administrators to:
 * - Delegate governance permissions to grantees within their scope
 * - Set and modify guardrails for delegated operations
 * - Review and revoke delegations
 * - Export audit trails for compliance
 *
 * Current Implementation Status: Phase 1 stub
 *
 * TODO (Phase 2):
 * - Add persistent storage for delegations
 * - Implement full audit logging for all console actions
 * - Add role-based access control for console operations
 * - Integrate with frontend dashboard for UI-based governance
 *
 * Architecture Reference: docs_en/architecture/00-platform-architecture.md §51
 */

import { z } from "zod";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import {
  GovernanceDelegationSchema,
  type GovernanceDelegation,
  type GovernancePermission,
} from "./delegation-registry/index.js";
import {
  type GovernanceOperationType,
  type GovernanceActionScope,
} from "./scope-manager/index.js";

/**
 * Console action types as defined in delegated_governance_contract.md §5
 */
export const GovernanceConsoleActionSchema = z.enum([
  "delegate",
  "override",
  "revoke",
  "review",
  "export_audit",
]);
export type GovernanceConsoleAction = z.infer<typeof GovernanceConsoleActionSchema>;

/**
 * Delegation creation request
 */
export const CreateDelegationRequestSchema = z.object({
  grantorId: z.string().min(1),
  granteeId: z.string().min(1),
  orgNodeIds: z.array(z.string()).default([]),
  domainIds: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
  expiresAt: z.string().min(1),
  revocable: z.boolean().default(true),
});
export type CreateDelegationRequest = z.infer<typeof CreateDelegationRequestSchema>;
export type CreateDelegationRequestInput = z.input<typeof CreateDelegationRequestSchema>;

/**
 * Console audit log entry
 */
export interface GovernanceConsoleAuditEntry {
  readonly action: GovernanceConsoleAction;
  readonly actorId: string;
  readonly delegationId: string | null;
  readonly timestamp: string;
  readonly details: Record<string, unknown>;
}

/**
 * SelfServiceGovernanceConsole - Basic stub service
 *
 * This is a basic stub that can be expanded later to support:
 * - Persistent storage integration
 * - Full audit trail export
 * - Role-based access control
 * - Integration with frontend dashboard
 */
export class SelfServiceGovernanceConsole {
  private readonly delegations: Map<string, GovernanceDelegation> = new Map();
  private readonly auditLog: GovernanceConsoleAuditEntry[] = [];

  /**
   * Creates a new delegation from a grantor to a grantee.
   * Per §51.1, only platform_team can create delegations at the platform level.
   */
  public createDelegation(input: CreateDelegationRequestInput): GovernanceDelegation {
    const request = CreateDelegationRequestSchema.parse(input);
    const delegation: GovernanceDelegation = {
      delegationId: newId("del"),
      grantorId: request.grantorId,
      granteeId: request.granteeId,
      orgNodeIds: request.orgNodeIds,
      domainIds: request.domainIds,
      permissions: request.permissions as GovernancePermission[],
      guardrails: [],
      expiresAt: request.expiresAt,
      revocable: request.revocable,
      status: "active",
    };

    this.delegations.set(delegation.delegationId, delegation);
    this.logAudit("delegate", request.grantorId, delegation.delegationId, { request });
    return delegation;
  }

  /**
   * Revokes an active delegation.
   */
  public revokeDelegation(
    delegationId: string,
    actorId: string,
  ): { success: boolean; error?: string } {
    const delegation = this.delegations.get(delegationId);
    if (!delegation) {
      return { success: false, error: "delegation_not_found" };
    }
    if (!delegation.revocable) {
      return { success: false, error: "delegation_not_revocable" };
    }

    delegation.status = "revoked";
    this.delegations.set(delegationId, delegation);
    this.logAudit("revoke", actorId, delegationId, {});
    return { success: true };
  }

  /**
   * Gets a delegation by ID.
   */
  public getDelegation(delegationId: string): GovernanceDelegation | null {
    return this.delegations.get(delegationId) ?? null;
  }

  /**
   * Lists all delegations for a grantee.
   */
  public listDelegationsForGrantee(granteeId: string): GovernanceDelegation[] {
    return Array.from(this.delegations.values()).filter(
      (d) => d.granteeId === granteeId && d.status === "active",
    );
  }

  /**
   * Lists all delegations within an org node.
   */
  public listDelegationsForOrgNode(orgNodeId: string): GovernanceDelegation[] {
    return Array.from(this.delegations.values()).filter(
      (d) => d.orgNodeIds.length === 0 || d.orgNodeIds.includes(orgNodeId),
    );
  }

  /**
   * Reviews a delegation - returns details for audit purposes.
   */
  public reviewDelegation(
    delegationId: string,
    actorId: string,
  ): GovernanceDelegation | null {
    const delegation = this.delegations.get(delegationId);
    if (delegation) {
      this.logAudit("review", actorId, delegationId ?? null, {});
    }
    return delegation ?? null;
  }

  /**
   * Exports audit log entries for compliance.
   * Returns entries within the optional time range.
   */
  public exportAuditLog(options?: {
    startTime?: string;
    endTime?: string;
    actorId?: string;
  }): GovernanceConsoleAuditEntry[] {
    let entries = [...this.auditLog];

    if (options?.startTime) {
      entries = entries.filter((e) => e.timestamp >= options.startTime!);
    }
    if (options?.endTime) {
      entries = entries.filter((e) => e.timestamp <= options.endTime!);
    }
    if (options?.actorId) {
      entries = entries.filter((e) => e.actorId === options.actorId);
    }

    this.logAudit("export_audit", "system", null, { filter: options });
    return entries;
  }

  /**
   * Checks if a governance action is permitted for an actor.
   * This implements §51.3 governance operation rules.
   */
  public isActionAllowed(
    actorId: string,
    actorRole: "platform_team" | "division_admin" | "department_admin" | "team_lead",
    action: GovernanceOperationType,
  ): { allowed: boolean; reason: string } {
    // platform_team can do everything
    if (actorRole === "platform_team") {
      return { allowed: true, reason: "platform_team has full权限" };
    }

    // Define allowed operations per role per §51.3
    const rolePermissions: Record<string, GovernanceOperationType[]> = {
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

    const allowed = rolePermissions[actorRole]?.includes(action) ?? false;
    return {
      allowed,
      reason: allowed ? `Role ${actorRole} permitted for ${action}` : `Role ${actorRole} not permitted for ${action}`,
    };
  }

  private logAudit(
    action: GovernanceConsoleAction,
    actorId: string,
    delegationId: string | null,
    details: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      action,
      actorId,
      delegationId,
      timestamp: nowIso(),
      details,
    });
  }
}

// Re-export types for external use
export type {
  GovernanceDelegation,
  GovernancePermission,
} from "./delegation-registry/index.js";
export type {
  GovernanceActionScope,
  GovernanceOperationType,
} from "./scope-manager/index.js";
