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
    readonly routingStrategy: "org_chart" | "amount_based";
}
export type ApprovalRouteRequest = z.infer<typeof ApprovalRouteRequestSchema>;
export interface AmountThresholdRule {
    readonly maxAmountUsd: number;
    readonly targetNodeTypes: readonly OrgNode["nodeType"][];
}
export interface RoutingStrategy {
    readonly strategyId: ApprovalRouteDecision["routingStrategy"];
    selectNode(nodes: readonly OrgNode[], request: ApprovalRouteRequest): OrgNode | null;
}
export declare class OrgChartRoutingStrategy implements RoutingStrategy {
    readonly strategyId: "org_chart";
    selectNode(nodes: readonly OrgNode[], request: ApprovalRouteRequest): OrgNode | null;
}
export declare class AmountBasedRoutingStrategy implements RoutingStrategy {
    private readonly rules;
    readonly strategyId: "amount_based";
    constructor(rules: readonly AmountThresholdRule[]);
    selectNode(nodes: readonly OrgNode[], request: ApprovalRouteRequest): OrgNode | null;
}
export declare function resolveAmountRoute(nodes: readonly OrgNode[], request: ApprovalRouteRequest, rules: readonly AmountThresholdRule[]): OrgNode | null;
export declare function applySodPolicy(initiatorId: string, candidateApprovers: readonly string[], nodes: readonly OrgNode[], orgNodeId: string): string[];
export declare function resolveApprovalRoute(nodes: readonly OrgNode[], request: ApprovalRouteRequest, delegationMap?: Readonly<Record<string, string>>, amountRules?: readonly AmountThresholdRule[]): ApprovalRouteDecision;
