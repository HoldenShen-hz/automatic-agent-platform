import { z } from "zod";

import type { OrgNode, OrgChart } from "../org-node/index.js";

export const OrgSyncRecordSchema = z.object({
  syncId: z.string().min(1),
  providerId: z.string().min(1),
  changedNodeIds: z.array(z.string()).default([]),
  completedAt: z.string().min(1),
});

export type OrgSyncRecord = z.infer<typeof OrgSyncRecordSchema>;

export function mergeOrgNodes(existing: readonly OrgNode[], incoming: readonly OrgNode[]): OrgNode[] {
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
  nodes: readonly OrgNode[],
  syncSource: OrgChart["syncSource"],
): OrgChart {
  const root = nodes.find((n) => n.parentOrgNodeId === null);
  if (!root) {
    throw new Error("Cannot build OrgChart: no root node found");
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
export function diffOrgCharts(before: OrgChart, after: OrgChart): string[] {
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
