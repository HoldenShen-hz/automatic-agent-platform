import { z } from "zod";
export const ApprovalRouteRequestSchema = z.object({
    requesterId: z.string().min(1),
    orgNodeId: z.string().min(1),
    riskLevel: z.enum(["low", "medium", "high", "critical"]),
    amountUsd: z.number().nonnegative().default(0),
});
export class OrgChartRoutingStrategy {
    strategyId = "org_chart";
    selectNode(nodes, request) {
        return nodes.find((item) => item.orgNodeId === request.orgNodeId && item.active)
            ?? nodes.find((item) => item.orgNodeId === request.orgNodeId)
            ?? nodes[0]
            ?? null;
    }
}
export class AmountBasedRoutingStrategy {
    rules;
    strategyId = "amount_based";
    constructor(rules) {
        this.rules = rules;
    }
    selectNode(nodes, request) {
        return resolveAmountRoute(nodes, request, this.rules);
    }
}
export function resolveAmountRoute(nodes, request, rules) {
    const matchedRule = rules.find((item) => request.amountUsd < item.maxAmountUsd) ?? null;
    if (!matchedRule) {
        return nodes.find((item) => item.nodeType === "company") ?? null;
    }
    return nodes.find((item) => matchedRule.targetNodeTypes.includes(item.nodeType)
        && item.active
        && (item.orgNodeId === request.orgNodeId || item.parentOrgNodeId === request.orgNodeId)) ?? nodes.find((item) => matchedRule.targetNodeTypes.includes(item.nodeType) && item.active) ?? null;
}
export function applySodPolicy(initiatorId, candidateApprovers, nodes, orgNodeId) {
    return candidateApprovers.filter((approverId) => approverId !== initiatorId);
}
export function resolveApprovalRoute(nodes, request, delegationMap = {}, amountRules = []) {
    const strategies = amountRules.length > 0
        ? [new AmountBasedRoutingStrategy(amountRules), new OrgChartRoutingStrategy()]
        : [new OrgChartRoutingStrategy()];
    const strategy = strategies.find((item) => item.selectNode(nodes, request) != null) ?? strategies[0] ?? new OrgChartRoutingStrategy();
    const matched = strategy.selectNode(nodes, request)
        ?? nodes.find((item) => item.orgNodeId === request.orgNodeId)
        ?? nodes[0];
    const ownerChain = matched?.ownerUserIds?.length ? matched.ownerUserIds : ["platform_admin"];
    const delegatedChain = ownerChain.map((item) => delegationMap[item] ?? item);
    const approverChain = applySodPolicy(request.requesterId, delegatedChain, nodes, matched?.orgNodeId ?? request.orgNodeId);
    return {
        matchedOrgNodeId: matched?.orgNodeId ?? request.orgNodeId,
        approverChain,
        delegated: delegatedChain.some((item, index) => item !== ownerChain[index]),
        routingStrategy: strategy.strategyId,
    };
}
//# sourceMappingURL=index.js.map