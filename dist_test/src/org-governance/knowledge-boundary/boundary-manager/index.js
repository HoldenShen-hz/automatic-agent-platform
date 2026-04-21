import { z } from "zod";
export const KnowledgeBoundarySchema = z.object({
    boundaryId: z.string().min(1),
    ownerOrgNodeId: z.string().min(1),
    namespaceIds: z.array(z.string()).default([]),
    defaultVisibility: z.enum(["private", "shared", "public"]).default("private"),
    allowedOrgNodeIds: z.array(z.string()).default([]),
});
export function canAccessKnowledgeBoundary(boundary, requesterOrgNodeId) {
    return boundary.defaultVisibility === "public"
        || boundary.ownerOrgNodeId === requesterOrgNodeId
        || boundary.allowedOrgNodeIds.includes(requesterOrgNodeId);
}
//# sourceMappingURL=index.js.map