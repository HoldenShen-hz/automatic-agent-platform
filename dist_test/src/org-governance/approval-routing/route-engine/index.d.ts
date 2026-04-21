import { z } from "zod";
import type { OrgNode } from "../../org-model/org-node/index.js";
export declare const ApprovalRouteRequestSchema: z.ZodObject<{
    requesterId: z.ZodString;
    orgNodeId: z.ZodString;
    riskLevel: z.ZodEnum<["low", "medium", "high", "critical"]>;
    amountUsd: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    riskLevel: "low" | "high" | "medium" | "critical";
    amountUsd: number;
    orgNodeId: string;
    requesterId: string;
}, {
    riskLevel: "low" | "high" | "medium" | "critical";
    orgNodeId: string;
    requesterId: string;
    amountUsd?: number | undefined;
}>;
export interface ApprovalRouteDecision {
    readonly matchedOrgNodeId: string;
    readonly approverChain: readonly string[];
    readonly delegated: boolean;
}
export type ApprovalRouteRequest = z.infer<typeof ApprovalRouteRequestSchema>;
export declare function resolveApprovalRoute(nodes: readonly OrgNode[], request: ApprovalRouteRequest, delegationMap?: Readonly<Record<string, string>>): ApprovalRouteDecision;
