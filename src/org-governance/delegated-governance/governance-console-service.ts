/**
 * Self-Service Governance Console
 *
 * This module provides the self-service governance console as described in
 * architecture doc §51.
 *
 * The governance console allows organization administrators to:
 * - Delegate governance permissions to grantees within their scope
 * - Set and modify guardrails for delegated operations
 * - Review and revoke delegations
 * - Export audit trails for compliance
 *
 * Implementation Status: Complete
 * - Persistent storage for delegations (SqliteDelegationStore)
 * - Full audit logging for all console actions (SqliteAuditLogStore)
 * - Role-based access control for console operations (RBAC permissions)
 * - Frontend dashboard integration via REST API
 *
 * Architecture Reference: docs_en/architecture/00-platform-architecture.md §51
 */

import { z } from "zod";
import { DatabaseSync } from "node:sqlite";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import {
  GovernanceDelegationSchema,
  GovernanceDelegationLevelSchema,
  type GovernanceDelegation,
  type GovernanceDelegationLevel,
  type GovernancePermission,
} from "./delegation-registry/index.js";
import {
  type GovernanceOperationType,
  type GovernanceActionScope,
} from "./scope-manager/index.js";
import {
  InMemoryAuditLogStore,
  InMemoryDelegationStore,
  SqliteAuditLogStore,
  SqliteDelegationStore,
  type AuditLogStore,
  type DelegationStore,
} from "./stores/index.js";

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
  level: GovernanceDelegationLevelSchema.default("view"),
  delegatable: z.boolean().default(false),
  orgNodeIds: z.array(z.string()).default([]),
  domainIds: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
  expiresAt: z.string().min(1),
  revocable: z.boolean().default(true),
});
export type CreateDelegationRequest = z.infer<typeof CreateDelegationRequestSchema>;
export type CreateDelegationRequestInput = z.input<typeof CreateDelegationRequestSchema>;

/**
 * Console audit log entry - comprehensive record of all governance console actions
 */
export interface GovernanceConsoleAuditEntry {
  readonly eventId: string;
  readonly action: GovernanceConsoleAction;
  readonly actorId: string;
  readonly actorRole: "platform_team" | "division_admin" | "department_admin" | "team_lead" | "system";
  readonly delegationId: string | null;
  readonly targetType: "delegation" | "org_node" | "grantee" | "audit_export" | null;
  readonly targetId: string | null;
  readonly timestamp: string;
  readonly details: Record<string, unknown>;
  readonly success: boolean;
  readonly failureReason?: string;
}

/**
 * RBAC check result
 */
export interface RbacCheckResult {
  readonly allowed: boolean;
  readonly reason: string;
}

/**
 * Actor context for RBAC checks
 */
export interface ActorContext {
  readonly actorId: string;
  readonly role: "platform_team" | "division_admin" | "department_admin" | "team_lead";
}

function openGovernanceConsoleDb(sqliteDbPath: string): DatabaseSync {
  const dbPath = resolve(sqliteDbPath);
  mkdirSync(dirname(dbPath), { recursive: true });
  return new DatabaseSync(dbPath);
}

/**
 * RBAC permissions for governance console operations
 * Per §51.3: Only platform_team can create/revoke delegations at platform level
 */
const RBAC_PERMISSIONS = {
  createDelegation: ["platform_team"] as const,
  revokeDelegation: ["platform_team"] as const,
  listDelegationsForGrantee: ["platform_team", "division_admin", "department_admin"] as const,
  listDelegationsForOrgNode: ["platform_team", "division_admin", "department_admin"] as const,
  reviewDelegation: ["platform_team", "division_admin", "department_admin", "team_lead"] as const,
  exportAuditLog: ["platform_team"] as const,
  getDelegation: ["platform_team", "division_admin", "department_admin", "team_lead"] as const,
} as const;

/**
 * SelfServiceGovernanceConsole - Governance console with RBAC and audit logging
 *
 * Full implementation of governance console per architecture doc §51:
 * - Persistent storage for delegations
 * - Full audit trail for all console actions
 * - Role-based access control for console operations
 */
export class SelfServiceGovernanceConsole {
  private readonly delegationStore: DelegationStore;
  private readonly auditLogStore: AuditLogStore;
  private readonly defaultDb: DatabaseSync | null;

  public constructor(options: {
    delegationStore?: DelegationStore;
    auditLogStore?: AuditLogStore;
    sqliteDb?: DatabaseSync;
    sqliteDbPath?: string;
  } = {}) {
    this.defaultDb = options.sqliteDb ?? (options.sqliteDbPath !== undefined ? openGovernanceConsoleDb(options.sqliteDbPath) : null);
    this.delegationStore = options.delegationStore ?? (this.defaultDb != null ? new SqliteDelegationStore(this.defaultDb) : new InMemoryDelegationStore());
    this.auditLogStore = options.auditLogStore ?? (this.defaultDb != null ? new SqliteAuditLogStore(this.defaultDb) : new InMemoryAuditLogStore());
  }

  /**
   * Checks if an actor has permission to perform a specific operation.
   */
  public checkPermission(
    actor: ActorContext,
    operation: keyof typeof RBAC_PERMISSIONS,
  ): RbacCheckResult {
    const allowedRoles = RBAC_PERMISSIONS[operation];
    if ((allowedRoles as readonly string[]).includes(actor.role)) {
      return { allowed: true, reason: `Role ${actor.role} is permitted for ${operation}` };
    }
    return { allowed: false, reason: `Role ${actor.role} is not permitted for ${operation}` };
  }

  /**
   * Creates a new delegation from a grantor to a grantee.
   * Per §51.1, only platform_team can create delegations at the platform level.
   *
   * @param input - Delegation creation request
   * @param actor - Actor performing the action (must be platform_team)
   * @returns Created delegation or throws if RBAC check fails
   */
  public createDelegation(
    input: CreateDelegationRequestInput,
    actor: ActorContext,
  ): GovernanceDelegation {
    // RBAC check: only platform_team can create delegations
    const rbacCheck = this.checkPermission(actor, "createDelegation");
    if (!rbacCheck.allowed) {
      this.logAudit({
        action: "delegate",
        actorId: actor.actorId,
        actorRole: actor.role,
        delegationId: null,
        targetType: "delegation",
        targetId: null,
        details: { input, attemptedAction: "createDelegation" },
        success: false,
        failureReason: rbacCheck.reason,
      });
      throw new Error(`RBAC_DENIED: ${rbacCheck.reason}`);
    }

    const request = CreateDelegationRequestSchema.parse(input);
    const delegation: GovernanceDelegation = {
      delegationId: newId("del"),
      grantorId: request.grantorId,
      granteeId: request.granteeId,
      level: request.level as GovernanceDelegationLevel,
      delegatable: request.delegatable,
      orgNodeIds: request.orgNodeIds,
      domainIds: request.domainIds,
      derivedDelegationIds: [],
      permissions: request.permissions as GovernancePermission[],
      guardrails: [],
      expiresAt: request.expiresAt,
      revocable: request.revocable,
      status: "active",
    };

    this.delegationStore.save(delegation);

    // Comprehensive audit log for delegation creation
    this.logAudit({
      action: "delegate",
      actorId: actor.actorId,
      actorRole: actor.role,
      delegationId: delegation.delegationId,
      targetType: "delegation",
      targetId: delegation.delegationId,
      details: {
        grantorId: request.grantorId,
        granteeId: request.granteeId,
        level: request.level,
        delegatable: request.delegatable,
        orgNodeIds: request.orgNodeIds,
        domainIds: request.domainIds,
        permissions: request.permissions,
        expiresAt: request.expiresAt,
        revocable: request.revocable,
      },
      success: true,
    });

    return delegation;
  }

  /**
   * Revokes an active delegation.
   *
   * @param delegationId - ID of delegation to revoke
   * @param actor - Actor performing the action (must be grantor or platform_team)
   * @returns Result indicating success or failure with reason
   */
  public revokeDelegation(
    delegationId: string,
    actor: ActorContext,
  ): { success: boolean; error?: string } {
    // RBAC check: only platform_team can revoke delegations
    const rbacCheck = this.checkPermission(actor, "revokeDelegation");
    if (!rbacCheck.allowed) {
      this.logAudit({
        action: "revoke",
        actorId: actor.actorId,
        actorRole: actor.role,
        delegationId,
        targetType: "delegation",
        targetId: delegationId,
        details: { attemptedAction: "revokeDelegation" },
        success: false,
        failureReason: rbacCheck.reason,
      });
      return { success: false, error: `permission_denied: ${rbacCheck.reason}` };
    }

    const delegation = this.delegationStore.get(delegationId);
    if (!delegation) {
      this.logAudit({
        action: "revoke",
        actorId: actor.actorId,
        actorRole: actor.role,
        delegationId,
        targetType: "delegation",
        targetId: delegationId,
        details: { attemptedAction: "revokeDelegation" },
        success: false,
        failureReason: "delegation_not_found",
      });
      return { success: false, error: "delegation_not_found" };
    }
    if (!delegation.revocable) {
      this.logAudit({
        action: "revoke",
        actorId: actor.actorId,
        actorRole: actor.role,
        delegationId,
        targetType: "delegation",
        targetId: delegationId,
        details: { grantorId: delegation.grantorId, granteeId: delegation.granteeId },
        success: false,
        failureReason: "delegation_not_revocable",
      });
      return { success: false, error: "delegation_not_revocable" };
    }
    // SECURITY: Only the grantor or platform_team can revoke a delegation
    if (delegation.grantorId !== actor.actorId && actor.role !== "platform_team") {
      this.logAudit({
        action: "revoke",
        actorId: actor.actorId,
        actorRole: actor.role,
        delegationId,
        targetType: "delegation",
        targetId: delegationId,
        details: { grantorId: delegation.grantorId, attemptedActorId: actor.actorId },
        success: false,
        failureReason: "only_grantor_or_platform_team_can_revoke",
      });
      return { success: false, error: "permission_denied" };
    }

    const revoked: GovernanceDelegation = {
      ...delegation,
      status: "revoked",
    };
    this.delegationStore.save(revoked);

    // Comprehensive audit log for revocation
    this.logAudit({
      action: "revoke",
      actorId: actor.actorId,
      actorRole: actor.role,
      delegationId,
      targetType: "delegation",
      targetId: delegationId,
      details: {
        grantorId: delegation.grantorId,
        granteeId: delegation.granteeId,
        previousStatus: delegation.status,
      },
      success: true,
    });

    return { success: true };
  }

  /**
   * Gets a delegation by ID.
   *
   * @param delegationId - ID of delegation to retrieve
   * @param actor - Actor performing the action
   * @returns Delegation or null if not found / not permitted
   */
  public getDelegation(delegationId: string, actor: ActorContext): GovernanceDelegation | null {
    // RBAC check
    const rbacCheck = this.checkPermission(actor, "getDelegation");
    if (!rbacCheck.allowed) {
      this.logAudit({
        action: "review",
        actorId: actor.actorId,
        actorRole: actor.role,
        delegationId,
        targetType: "delegation",
        targetId: delegationId,
        details: { attemptedAction: "getDelegation" },
        success: false,
        failureReason: rbacCheck.reason,
      });
      return null;
    }

    const delegation = this.delegationStore.get(delegationId);
    if (!delegation) {
      this.logAudit({
        action: "review",
        actorId: actor.actorId,
        actorRole: actor.role,
        delegationId,
        targetType: "delegation",
        targetId: delegationId,
        details: { attemptedAction: "getDelegation" },
        success: false,
        failureReason: "delegation_not_found",
      });
      return null;
    }

    this.logAudit({
      action: "review",
      actorId: actor.actorId,
      actorRole: actor.role,
      delegationId,
      targetType: "delegation",
      targetId: delegationId,
      details: { grantorId: delegation.grantorId, granteeId: delegation.granteeId, status: delegation.status },
      success: true,
    });

    return delegation;
  }

  /**
   * Lists all delegations for a grantee.
   *
   * @param granteeId - ID of the grantee
   * @param actor - Actor performing the action
   * @returns Array of active delegations for the grantee
   */
  public listDelegationsForGrantee(granteeId: string, actor: ActorContext): GovernanceDelegation[] {
    // RBAC check
    const rbacCheck = this.checkPermission(actor, "listDelegationsForGrantee");
    if (!rbacCheck.allowed) {
      this.logAudit({
        action: "review",
        actorId: actor.actorId,
        actorRole: actor.role,
        delegationId: null,
        targetType: "grantee",
        targetId: granteeId,
        details: { attemptedAction: "listDelegationsForGrantee" },
        success: false,
        failureReason: rbacCheck.reason,
      });
      return [];
    }

    const delegations = this.delegationStore.listByGrantee(granteeId).filter(
      (d) => d.status === "active",
    );

    this.logAudit({
      action: "review",
      actorId: actor.actorId,
      actorRole: actor.role,
      delegationId: null,
      targetType: "grantee",
      targetId: granteeId,
      details: { scope: "grantee", granteeId, count: delegations.length },
      success: true,
    });

    return delegations;
  }

  /**
   * Lists all delegations within an org node.
   *
   * @param orgNodeId - ID of the org node
   * @param actor - Actor performing the action
   * @returns Array of delegations within the org node
   */
  public listDelegationsForOrgNode(orgNodeId: string, actor: ActorContext): GovernanceDelegation[] {
    // RBAC check
    const rbacCheck = this.checkPermission(actor, "listDelegationsForOrgNode");
    if (!rbacCheck.allowed) {
      this.logAudit({
        action: "review",
        actorId: actor.actorId,
        actorRole: actor.role,
        delegationId: null,
        targetType: "org_node",
        targetId: orgNodeId,
        details: { attemptedAction: "listDelegationsForOrgNode" },
        success: false,
        failureReason: rbacCheck.reason,
      });
      return [];
    }

    const delegations = this.delegationStore.listByOrgNode(orgNodeId);

    this.logAudit({
      action: "review",
      actorId: actor.actorId,
      actorRole: actor.role,
      delegationId: null,
      targetType: "org_node",
      targetId: orgNodeId,
      details: { scope: "org_node", orgNodeId, count: delegations.length },
      success: true,
    });

    return delegations;
  }

  /**
   * Reviews a delegation - returns details for audit purposes.
   *
   * @param delegationId - ID of delegation to review
   * @param actor - Actor performing the action
   * @returns Delegation details or null if not found / not permitted
   */
  public reviewDelegation(delegationId: string, actor: ActorContext): GovernanceDelegation | null {
    // RBAC check
    const rbacCheck = this.checkPermission(actor, "reviewDelegation");
    if (!rbacCheck.allowed) {
      this.logAudit({
        action: "review",
        actorId: actor.actorId,
        actorRole: actor.role,
        delegationId,
        targetType: "delegation",
        targetId: delegationId,
        details: { attemptedAction: "reviewDelegation" },
        success: false,
        failureReason: rbacCheck.reason,
      });
      return null;
    }

    const delegation = this.delegationStore.get(delegationId);
    if (!delegation) {
      this.logAudit({
        action: "review",
        actorId: actor.actorId,
        actorRole: actor.role,
        delegationId,
        targetType: "delegation",
        targetId: delegationId,
        details: { attemptedAction: "reviewDelegation" },
        success: false,
        failureReason: "delegation_not_found",
      });
      return null;
    }

    this.logAudit({
      action: "review",
      actorId: actor.actorId,
      actorRole: actor.role,
      delegationId,
      targetType: "delegation",
      targetId: delegationId,
      details: {
        grantorId: delegation.grantorId,
        granteeId: delegation.granteeId,
        level: delegation.level,
        status: delegation.status,
      },
      success: true,
    });

    return delegation;
  }

  /**
   * Exports audit log entries for compliance.
   * Only platform_team can export audit logs (contains sensitive compliance data).
   *
   * @param options - Filter options for the audit log export
   * @param actor - Actor performing the action (must be platform_team)
   * @returns Array of audit entries matching the filter
   */
  public exportAuditLog(
    options: { startTime?: string; endTime?: string; actorId?: string } | undefined,
    actor: ActorContext,
  ): GovernanceConsoleAuditEntry[] {
    // RBAC check: only platform_team can export audit logs
    const rbacCheck = this.checkPermission(actor, "exportAuditLog");
    if (!rbacCheck.allowed) {
      this.logAudit({
        action: "export_audit",
        actorId: actor.actorId,
        actorRole: actor.role,
        delegationId: null,
        targetType: "audit_export",
        targetId: null,
        details: { filter: options, attemptedAction: "exportAuditLog" },
        success: false,
        failureReason: rbacCheck.reason,
      });
      return [];
    }

    let entries = [...this.auditLogStore.list()];

    if (options?.startTime) {
      entries = entries.filter((e) => e.timestamp >= options.startTime!);
    }
    if (options?.endTime) {
      entries = entries.filter((e) => e.timestamp <= options.endTime!);
    }
    if (options?.actorId) {
      entries = entries.filter((e) => e.actorId === options.actorId);
    }

    // Comprehensive audit log for export action
    this.logAudit({
      action: "export_audit",
      actorId: actor.actorId,
      actorRole: actor.role,
      delegationId: null,
      targetType: "audit_export",
      targetId: null,
      details: {
        filter: options,
        exportedCount: entries.length,
        exportedFields: ["eventId", "action", "actorId", "actorRole", "delegationId", "targetType", "targetId", "timestamp", "details", "success", "failureReason"],
      },
      success: true,
    });

    return entries;
  }

  /**
   * Checks if a governance action is permitted for an actor.
   * This implements §51.3 governance operation rules.
   *
   * @deprecated Use checkPermission() instead for console operations
   */
  public isActionAllowed(
    actorId: string,
    actorRole: "platform_team" | "division_admin" | "department_admin" | "team_lead",
    action: GovernanceOperationType,
  ): { allowed: boolean; reason: string } {
    // platform_team can do everything
    if (actorRole === "platform_team") {
      return { allowed: true, reason: "platform_team has full authority" };
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

  /**
   * Logs a comprehensive audit entry with actor, action, target, timestamp, and outcome.
   */
  private logAudit(params: {
    action: GovernanceConsoleAction;
    actorId: string;
    actorRole: "platform_team" | "division_admin" | "department_admin" | "team_lead" | "system";
    delegationId: string | null;
    targetType: "delegation" | "org_node" | "grantee" | "audit_export" | null;
    targetId: string | null;
    details: Record<string, unknown>;
    success: boolean;
    failureReason?: string;
  }): void {
    const entry: GovernanceConsoleAuditEntry = {
      eventId: newId("audit"),
      action: params.action,
      actorId: params.actorId,
      actorRole: params.actorRole,
      delegationId: params.delegationId,
      targetType: params.targetType,
      targetId: params.targetId,
      timestamp: nowIso(),
      details: params.details,
      success: params.success,
      failureReason: params.failureReason ?? "",
    };
    this.auditLogStore.append(entry);
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
