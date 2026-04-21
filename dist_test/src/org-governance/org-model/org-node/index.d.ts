import { z } from "zod";
/**
 * Organization node types representing the 5-level hierarchy:
 * - company: Top-level organization (maps to platform)
 * - division: Business division (maps to tenant_group for budget aggregation)
 * - department: Department (maps to tenant for isolation)
 * - team: Team (maps to domain + pack_group)
 * - member: Individual user/member (leaf node)
 *
 * As defined in architecture doc §46.1
 */
export declare const OrgNodeTypeSchema: z.ZodEnum<["company", "division", "department", "team", "member"]>;
export declare const OrgNodeSchema: z.ZodObject<{
    orgNodeId: z.ZodString;
    nodeType: z.ZodEnum<["company", "division", "department", "team", "member"]>;
    displayName: z.ZodString;
    parentOrgNodeId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    ownerUserIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    active: z.ZodDefault<z.ZodBoolean>;
    costCenter: z.ZodDefault<z.ZodString>;
    metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    active: boolean;
    metadata: Record<string, string>;
    displayName: string;
    orgNodeId: string;
    nodeType: "division" | "team" | "department" | "company" | "member";
    parentOrgNodeId: string | null;
    ownerUserIds: string[];
    costCenter: string;
}, {
    displayName: string;
    orgNodeId: string;
    nodeType: "division" | "team" | "department" | "company" | "member";
    active?: boolean | undefined;
    metadata?: Record<string, string> | undefined;
    parentOrgNodeId?: string | null | undefined;
    ownerUserIds?: string[] | undefined;
    costCenter?: string | undefined;
}>;
export type OrgNodeType = z.infer<typeof OrgNodeTypeSchema>;
export type OrgNode = z.infer<typeof OrgNodeSchema>;
/**
 * Cross-organization collaboration participant role.
 * Used for guest access and inter-organization workflows.
 */
export type CollaboratorRole = "guest" | "consultant" | "contractor" | "partner";
/**
 * Cross-organization collaboration permission scope.
 */
export interface CollaborationScope {
    readonly targetOrgNodeId: string;
    readonly allowedDomains: readonly string[];
    readonly allowedActions: readonly ("view" | "execute" | "admin")[];
    readonly expiresAt: string | null;
}
/**
 * Cross-organization collaborator record.
 * Enables guest/partner access with scoped permissions.
 */
export interface CrossOrgCollaborator {
    readonly collaboratorId: string;
    readonly userId: string;
    readonly homeOrgNodeId: string;
    readonly targetOrgNodeId: string;
    readonly role: CollaboratorRole;
    readonly scope: CollaborationScope;
    readonly grantedBy: string;
    readonly grantedAt: string;
    readonly active: boolean;
}
/**
 * Full organization chart containing all nodes and metadata.
 * As defined in architecture doc §46.1
 */
export interface OrgChart {
    readonly root: OrgNode;
    readonly nodes: readonly OrgNode[];
    readonly syncSource: "scim" | "manual" | "hr_api";
    readonly lastSyncedAt: string;
}
/**
 * Reporting chain for an employee.
 * Used for approval routing and escalation.
 */
export interface ReportingChain {
    readonly employeeId: string;
    readonly chain: readonly string[];
}
/**
 * Organization change event for automatic adaptation.
 * Maps to §46.3 org change events.
 */
export type OrgChangeEvent = {
    type: "employee_onboarding";
    userId: string;
    teamId: string;
    managerId: string;
} | {
    type: "employee_transfer";
    userId: string;
    fromTeamId: string;
    toTeamId: string;
    newManagerId: string;
} | {
    type: "employee_offboarding";
    userId: string;
    teamId: string;
} | {
    type: "department_merge";
    sourceDeptId: string;
    targetDeptId: string;
} | {
    type: "org_restructure";
    affectedNodeIds: readonly string[];
};
export declare function isLeafOrgNode(node: OrgNode): boolean;
/**
 * Gets the platform mapping level for an org node type.
 * Maps to architecture doc §46.2
 */
export declare function getPlatformMapping(nodeType: OrgNodeType): string;
/**
 * Validates that intermediate layers are properly optional.
 * The 5-level hierarchy allows division and department to be skipped.
 */
export declare function validateHierarchyDepth(nodes: readonly OrgNode[]): {
    valid: boolean;
    depth: number;
};
/**
 * Creates a cross-org collaborator with guest role and scoped permissions.
 */
export declare function createCrossOrgCollaborator(input: Omit<CrossOrgCollaborator, "collaboratorId" | "grantedAt" | "active">): CrossOrgCollaborator;
