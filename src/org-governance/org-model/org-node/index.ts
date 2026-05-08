import { z } from "zod";

/**
 * Canonical organization node types representing the 4-level hierarchy:
 * - company: Top-level legal/entity root
 * - division: Business division (maps to tenant_group for budget aggregation)
 * - department: Department (maps to tenant for isolation)
 * - team: Team (maps to domain + pack_group)
 *
 * Individual people are not org nodes; they are principals assigned to nodes.
 * Legacy payloads may still use orgNodeId/nodeType/displayName naming, which is
 * normalized into the canonical nodeId/type/name fields by OrgNodeSchema.
 */
export const OrgNodeTypeSchema = z.enum(["company", "division", "department", "team"]);

export const LegalEntityBoundarySchema = z.object({
  boundaryId: z.string().min(1),
  legalEntityId: z.string().min(1),
  jurisdictionCountry: z.string().min(2),
  dataResidencyRegion: z.string().min(1),
  crossBorderTransferPolicy: z.enum(["deny", "approval_required", "allow"]).default("approval_required"),
  crossEntityApprovalRoles: z.array(z.string().min(1)).default(["legal_reviewer", "compliance_officer"]),
  restrictedDataClasses: z.array(z.string().min(1)).default([]),
});

const LegacyOrgNodeInputSchema = z.object({
  nodeId: z.string().min(1).optional(),
  orgNodeId: z.string().min(1).optional(),
  type: OrgNodeTypeSchema.optional(),
  nodeType: OrgNodeTypeSchema.optional(),
  name: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  parentNodeId: z.string().min(1).nullable().optional(),
  parentOrgNodeId: z.string().min(1).nullable().optional(),
  ownerUserIds: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  costCenter: z.string().default(""),
  metadata: z.record(z.string()).default({}),
  legalEntityBoundary: LegalEntityBoundarySchema.optional(),
});

export const OrgNodeSchema = LegacyOrgNodeInputSchema.superRefine((input, ctx) => {
  if ((input.nodeId ?? input.orgNodeId) == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["nodeId"],
      message: "nodeId or orgNodeId is required",
    });
  }
  if ((input.type ?? input.nodeType) == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["type"],
      message: "type or nodeType is required",
    });
  }
  if ((input.name ?? input.displayName) == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["name"],
      message: "name or displayName is required",
    });
  }
}).transform((input) => {
  const nodeId = input.nodeId ?? input.orgNodeId!;
  const type = input.type ?? input.nodeType!;
  const name = input.name ?? input.displayName!;
  const parentNodeId = input.parentNodeId ?? input.parentOrgNodeId ?? null;
  return {
    nodeId,
    type,
    name,
    parentNodeId,
    orgNodeId: nodeId,
    nodeType: type,
    displayName: name,
    parentOrgNodeId: parentNodeId,
    ownerUserIds: input.ownerUserIds,
    active: input.active,
    costCenter: input.costCenter,
    metadata: input.metadata,
    legalEntityBoundary: input.legalEntityBoundary ?? null,
  };
});

export type OrgNodeType = z.infer<typeof OrgNodeTypeSchema>;
export type LegalEntityBoundary = z.infer<typeof LegalEntityBoundarySchema>;
export interface OrgNode {
  readonly orgNodeId: string;
  readonly nodeType: OrgNodeType;
  readonly displayName: string;
  readonly parentOrgNodeId: string | null;
  readonly ownerUserIds: readonly string[];
  readonly active: boolean;
  readonly costCenter: string;
  readonly metadata: Readonly<Record<string, string>>;
  readonly legalEntityBoundary?: LegalEntityBoundary | null;
  readonly nodeId?: string;
  readonly type?: OrgNodeType;
  readonly name?: string;
  readonly parentNodeId?: string | null;
}
export type NormalizedOrgNode = z.output<typeof OrgNodeSchema>;

export interface OrgPrincipalAssignment {
  readonly principalId: string;
  readonly userId: string;
  readonly homeNodeId: string;
  readonly managerUserId: string | null;
  readonly active: boolean;
}

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
  readonly principalAssignments?: readonly OrgPrincipalAssignment[];
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
export type OrgChangeEvent =
  | { type: "employee_onboarding"; userId: string; teamId: string; managerId: string | null }
  | { type: "employee_transfer"; userId: string; fromTeamId: string; toTeamId: string; newManagerId: string | null }
  | { type: "employee_offboarding"; userId: string; teamId: string; legalEntityBoundaryId: string | null }
  | { type: "department_merge"; sourceDeptId: string; targetDeptId: string; conflictBoundaryIds: readonly string[] }
  | { type: "org_restructure"; affectedNodeIds: readonly string[] };

export function isLeafOrgNode(node: OrgNode): boolean {
  return node.nodeType === "team";
}

/**
 * Gets the platform mapping level for an org node type.
 * Maps to architecture doc §46.2
 */
export function getPlatformMapping(nodeType: OrgNodeType): string {
  const mappings: Record<OrgNodeType, string> = {
    company: "platform",
    division: "tenant_group",
    department: "tenant",
    team: "domain/pack_group",
  };
  return mappings[nodeType];
}

/**
 * Validates that intermediate layers are properly optional.
 * The 4-level hierarchy allows division and department to be skipped.
 */
export function validateHierarchyDepth(nodes: readonly OrgNode[]): { valid: boolean; depth: number } {
  if (nodes.length === 0) {
    return { valid: true, depth: 0 };
  }

  const root = nodes.find((n) => n.parentOrgNodeId === null);
  if (!root) {
    return { valid: false, depth: 0 };
  }

  const getMaxDepth = (nodeId: string): number => {
    const children = nodes.filter((n) => n.parentOrgNodeId === nodeId);
    if (children.length === 0) return 1;
    return 1 + Math.max(...children.map((c) => getMaxDepth(c.orgNodeId)));
  };

  const depth = getMaxDepth(root.orgNodeId);
  return { valid: depth <= 4, depth };
}

/**
 * Creates a cross-org collaborator with guest role and scoped permissions.
 */
export function createCrossOrgCollaborator(
  input: Omit<CrossOrgCollaborator, "collaboratorId" | "grantedAt" | "active">,
): CrossOrgCollaborator {
  return {
    ...input,
    collaboratorId: `collab:${input.userId}:${input.targetOrgNodeId}`,
    grantedAt: new Date().toISOString(),
    active: true,
  };
}

export function requiresLegalEntityApproval(
  sourceBoundary: LegalEntityBoundary | null | undefined,
  targetBoundary: LegalEntityBoundary | null | undefined,
): boolean {
  if (sourceBoundary == null || targetBoundary == null) {
    return false;
  }
  if (sourceBoundary.legalEntityId !== targetBoundary.legalEntityId) {
    return true;
  }
  if (sourceBoundary.jurisdictionCountry !== targetBoundary.jurisdictionCountry) {
    return true;
  }
  return sourceBoundary.dataResidencyRegion !== targetBoundary.dataResidencyRegion;
}

export function getLegalEntityApprovalRoles(
  sourceBoundary: LegalEntityBoundary | null | undefined,
  targetBoundary: LegalEntityBoundary | null | undefined,
): readonly string[] {
  if (!requiresLegalEntityApproval(sourceBoundary, targetBoundary)) {
    return [];
  }
  const roles = new Set([
    ...(sourceBoundary?.crossEntityApprovalRoles ?? []),
    ...(targetBoundary?.crossEntityApprovalRoles ?? []),
  ]);
  return [...roles];
}
