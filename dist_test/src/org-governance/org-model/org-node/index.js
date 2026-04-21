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
export const OrgNodeTypeSchema = z.enum(["company", "division", "department", "team", "member"]);
export const OrgNodeSchema = z.object({
    orgNodeId: z.string().min(1),
    nodeType: OrgNodeTypeSchema,
    displayName: z.string().min(1),
    parentOrgNodeId: z.string().min(1).nullable().default(null),
    ownerUserIds: z.array(z.string()).default([]),
    active: z.boolean().default(true),
    costCenter: z.string().default(""),
    metadata: z.record(z.string()).default({}),
});
export function isLeafOrgNode(node) {
    return node.nodeType === "member";
}
/**
 * Gets the platform mapping level for an org node type.
 * Maps to architecture doc §46.2
 */
export function getPlatformMapping(nodeType) {
    const mappings = {
        company: "platform",
        division: "tenant_group",
        department: "tenant",
        team: "domain/pack_group",
        member: "principal",
    };
    return mappings[nodeType];
}
/**
 * Validates that intermediate layers are properly optional.
 * The 5-level hierarchy allows division and department to be skipped.
 */
export function validateHierarchyDepth(nodes) {
    if (nodes.length === 0) {
        return { valid: true, depth: 0 };
    }
    const root = nodes.find((n) => n.parentOrgNodeId === null);
    if (!root) {
        return { valid: false, depth: 0 };
    }
    const getMaxDepth = (nodeId) => {
        const children = nodes.filter((n) => n.parentOrgNodeId === nodeId);
        if (children.length === 0)
            return 1;
        return 1 + Math.max(...children.map((c) => getMaxDepth(c.orgNodeId)));
    };
    const depth = getMaxDepth(root.orgNodeId);
    return { valid: depth <= 5, depth };
}
/**
 * Creates a cross-org collaborator with guest role and scoped permissions.
 */
export function createCrossOrgCollaborator(input) {
    return {
        ...input,
        collaboratorId: `collab:${input.userId}:${input.targetOrgNodeId}`,
        grantedAt: new Date().toISOString(),
        active: true,
    };
}
//# sourceMappingURL=index.js.map