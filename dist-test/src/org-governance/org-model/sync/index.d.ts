import { z } from "zod";
import type { OrgNode, OrgChart } from "../org-node/index.js";
export declare const OrgSyncRecordSchema: z.ZodObject<{
    syncId: z.ZodString;
    providerId: z.ZodString;
    changedNodeIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    completedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    completedAt: string;
    providerId: string;
    syncId: string;
    changedNodeIds: string[];
}, {
    completedAt: string;
    providerId: string;
    syncId: string;
    changedNodeIds?: string[] | undefined;
}>;
export type OrgSyncRecord = z.infer<typeof OrgSyncRecordSchema>;
export declare function mergeOrgNodes(existing: readonly OrgNode[], incoming: readonly OrgNode[]): OrgNode[];
/**
 * Builds an OrgChart from a collection of nodes.
 */
export declare function buildOrgChart(nodes: readonly OrgNode[], syncSource: OrgChart["syncSource"]): OrgChart;
/**
 * Diff two org charts and return changed node IDs.
 */
export declare function diffOrgCharts(before: OrgChart, after: OrgChart): string[];
