import { z } from "zod";

import { ValidationError } from "../../../platform/contracts/errors.js";
import type { OrgChart } from "../org-node/index.js";

export const OrgSyncRecordSchema = z.object({
  syncId: z.string().min(1),
  providerId: z.string().min(1),
  changedNodeIds: z.array(z.string()).default([]),
  completedAt: z.string().min(1),
});

export type OrgSyncRecord = z.infer<typeof OrgSyncRecordSchema>;

export interface OrgChartNodeInput {
  readonly orgNodeId: string;
  readonly displayName: string;
  readonly parentOrgNodeId: string | null;
  readonly ownerUserIds: readonly string[];
  readonly active: boolean;
}

export interface OrgChartInput {
  readonly root: OrgChartNodeInput;
  readonly nodes: readonly OrgChartNodeInput[];
  readonly syncSource: OrgChart["syncSource"];
  readonly lastSyncedAt: string;
}

export function mergeOrgNodes<T extends OrgChartNodeInput>(existing: readonly T[], incoming: readonly T[]): T[] {
  const byId = new Map(existing.map((item) => [item.orgNodeId, item]));
  for (const node of incoming) {
    byId.set(node.orgNodeId, node);
  }
  return [...byId.values()];
}

/**
 * Builds an OrgChart from a collection of nodes.
 */
export function buildOrgChart(
  nodes: readonly OrgChartNodeInput[],
  syncSource: OrgChart["syncSource"],
): OrgChartInput {
  const root = nodes.find((n) => n.parentOrgNodeId === null);
  if (!root) {
    throw new ValidationError("org_chart.root_node_missing", "Cannot build OrgChart: no root node found");
  }
  return {
    root,
    nodes,
    syncSource,
    lastSyncedAt: new Date().toISOString(),
  };
}

/**
 * Diff two org charts and return changed node IDs.
 */
export function diffOrgCharts(before: OrgChartInput, after: OrgChartInput): string[] {
  const beforeById = new Map(before.nodes.map((n) => [n.orgNodeId, n]));
  const changed: string[] = [];

  for (const node of after.nodes) {
    const beforeNode = beforeById.get(node.orgNodeId);
    if (!beforeNode) {
      changed.push(node.orgNodeId);
    } else if (
      beforeNode.displayName !== node.displayName
      || beforeNode.parentOrgNodeId !== node.parentOrgNodeId
      || beforeNode.ownerUserIds.join(",") !== node.ownerUserIds.join(",")
      || beforeNode.active !== node.active
    ) {
      changed.push(node.orgNodeId);
    }
  }

  return changed;
}
