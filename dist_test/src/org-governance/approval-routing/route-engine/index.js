import { z } from "zod";
export const ApprovalRouteRequestSchema = z.object({
    requesterId: z.string().min(1),
    orgNodeId: z.string().min(1),
    riskLevel: z.enum(["low", "medium", "high", "critical"]),
    amountUsd: z.number().nonnegative().default(0),
});
export function resolveApprovalRoute(nodes, request, delegationMap = {}) {
    const matched = nodes.find((item) => item.orgNodeId === request.orgNodeId) ?? nodes[0];
    const ownerChain = matched?.ownerUserIds?.length ? matched.ownerUserIds : ["platform_admin"];
    const approverChain = ownerChain.map((item) => delegationMap[item] ?? item);
    return {
        matchedOrgNodeId: matched?.orgNodeId ?? request.orgNodeId,
        approverChain,
        delegated: approverChain.some((item, index) => item !== ownerChain[index]),
    };
}
//# sourceMappingURL=index.js.map