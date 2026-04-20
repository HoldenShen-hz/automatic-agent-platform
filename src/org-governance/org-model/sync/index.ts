import { z } from "zod";

import type { OrgNode } from "../org-node/index.js";

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
