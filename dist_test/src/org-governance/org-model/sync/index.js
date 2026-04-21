import { z } from "zod";
export const OrgSyncRecordSchema = z.object({
    syncId: z.string().min(1),
    providerId: z.string().min(1),
    changedNodeIds: z.array(z.string()).default([]),
    completedAt: z.string().min(1),
});
export function mergeOrgNodes(existing, incoming) {
    const byId = new Map(existing.map((item) => [item.orgNodeId, item]));
    for (const node of incoming) {
        byId.set(node.orgNodeId, node);
    }
    return [...byId.values()];
}
/**
 * Builds an OrgChart from a collection of nodes.
 */
export function buildOrgChart(nodes, syncSource) {
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
export function diffOrgCharts(before, after) {
    const beforeById = new Map(before.nodes.map((n) => [n.orgNodeId, n]));
    const changed = [];
    for (const node of after.nodes) {
        const beforeNode = beforeById.get(node.orgNodeId);
        if (!beforeNode) {
            changed.push(node.orgNodeId);
        }
        else if (beforeNode.displayName !== node.displayName
            || beforeNode.parentOrgNodeId !== node.parentOrgNodeId
            || beforeNode.ownerUserIds.join(",") !== node.ownerUserIds.join(",")
            || beforeNode.active !== node.active) {
            changed.push(node.orgNodeId);
        }
    }
    return changed;
}
//# sourceMappingURL=index.js.map