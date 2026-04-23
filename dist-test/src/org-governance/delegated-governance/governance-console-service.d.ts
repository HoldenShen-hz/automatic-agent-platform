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
import { type GovernanceDelegation } from "./delegation-registry/index.js";
import { type GovernanceOperationType } from "./scope-manager/index.js";
/**
 * Console action types as defined in delegated_governance_contract.md §5
 */
export declare const GovernanceConsoleActionSchema: z.ZodEnum<["delegate", "override", "revoke", "review", "export_audit"]>;
export type GovernanceConsoleAction = z.infer<typeof GovernanceConsoleActionSchema>;
/**
 * Delegation creation request
 */
export declare const CreateDelegationRequestSchema: z.ZodObject<{
    grantorId: z.ZodString;
    granteeId: z.ZodString;
    orgNodeIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    domainIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    permissions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    expiresAt: z.ZodString;
    revocable: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    expiresAt: string;
    domainIds: string[];
    permissions: string[];
    grantorId: string;
    granteeId: string;
    orgNodeIds: string[];
    revocable: boolean;
}, {
    expiresAt: string;
    grantorId: string;
    granteeId: string;
    domainIds?: string[] | undefined;
    permissions?: string[] | undefined;
    orgNodeIds?: string[] | undefined;
    revocable?: boolean | undefined;
}>;
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
export declare class SelfServiceGovernanceConsole {
    private readonly delegations;
    private readonly auditLog;
    /**
     * Creates a new delegation from a grantor to a grantee.
     * Per §51.1, only platform_team can create delegations at the platform level.
     */
    createDelegation(input: CreateDelegationRequestInput): GovernanceDelegation;
    /**
     * Revokes an active delegation.
     */
    revokeDelegation(delegationId: string, actorId: string): {
        success: boolean;
        error?: string;
    };
    /**
     * Gets a delegation by ID.
     */
    getDelegation(delegationId: string): GovernanceDelegation | null;
    /**
     * Lists all delegations for a grantee.
     */
    listDelegationsForGrantee(granteeId: string): GovernanceDelegation[];
    /**
     * Lists all delegations within an org node.
     */
    listDelegationsForOrgNode(orgNodeId: string): GovernanceDelegation[];
    /**
     * Reviews a delegation - returns details for audit purposes.
     */
    reviewDelegation(delegationId: string, actorId: string): GovernanceDelegation | null;
    /**
     * Exports audit log entries for compliance.
     * Returns entries within the optional time range.
     */
    exportAuditLog(options?: {
        startTime?: string;
        endTime?: string;
        actorId?: string;
    }): GovernanceConsoleAuditEntry[];
    /**
     * Checks if a governance action is permitted for an actor.
     * This implements §51.3 governance operation rules.
     */
    isActionAllowed(actorId: string, actorRole: "platform_team" | "division_admin" | "department_admin" | "team_lead", action: GovernanceOperationType): {
        allowed: boolean;
        reason: string;
    };
    private logAudit;
}
export type { GovernanceDelegation, GovernancePermission, } from "./delegation-registry/index.js";
export type { GovernanceActionScope, GovernanceOperationType, } from "./scope-manager/index.js";
