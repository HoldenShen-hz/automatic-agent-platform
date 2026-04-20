import { z } from "zod";

import type { OrgNode } from "../../org-model/org-node/index.js";

export const ApprovalRouteRequestSchema = z.object({
  requesterId: z.string().min(1),
  orgNodeId: z.string().min(1),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  amountUsd: z.number().nonnegative().default(0),
});

export interface ApprovalRouteDecision {
  readonly matchedOrgNodeId: string;
  readonly approverChain: readonly string[];
  readonly delegated: boolean;
}

export type ApprovalRouteRequest = z.infer<typeof ApprovalRouteRequestSchema>;

export function resolveApprovalRoute(
  nodes: readonly OrgNode[],
  request: ApprovalRouteRequest,
  delegationMap: Readonly<Record<string, string>> = {},
): ApprovalRouteDecision {
  const matched = nodes.find((item) => item.orgNodeId === request.orgNodeId) ?? nodes[0];
  const ownerChain = matched?.ownerUserIds?.length ? matched.ownerUserIds : ["platform_admin"];
  const approverChain = ownerChain.map((item) => delegationMap[item] ?? item);
  return {
    matchedOrgNodeId: matched?.orgNodeId ?? request.orgNodeId,
    approverChain,
    delegated: approverChain.some((item, index) => item !== ownerChain[index]),
  };
}
