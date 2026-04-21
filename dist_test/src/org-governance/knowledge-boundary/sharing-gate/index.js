import { z } from "zod";
export const KnowledgeShareGrantSchema = z.object({
    grantId: z.string().min(1),
    boundaryId: z.string().min(1),
    requesterOrgNodeId: z.string().min(1),
    purpose: z.string().min(1),
    expiresAt: z.string().min(1),
});
export function evaluateKnowledgeShare(boundary, requesterOrgNodeId, grants, nowIso) {
    if (boundary.ownerOrgNodeId === requesterOrgNodeId || boundary.allowedOrgNodeIds.includes(requesterOrgNodeId)) {
        return true;
    }
    return grants.some((item) => item.boundaryId === boundary.boundaryId
        && item.requesterOrgNodeId === requesterOrgNodeId
        && item.expiresAt >= nowIso);
}
//# sourceMappingURL=index.js.map