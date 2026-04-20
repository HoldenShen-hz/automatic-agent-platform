import { z } from "zod";

import type { KnowledgeBoundary } from "../boundary-manager/index.js";

export const KnowledgeShareGrantSchema = z.object({
  grantId: z.string().min(1),
  boundaryId: z.string().min(1),
  requesterOrgNodeId: z.string().min(1),
  purpose: z.string().min(1),
  expiresAt: z.string().min(1),
});

export type KnowledgeShareGrant = z.infer<typeof KnowledgeShareGrantSchema>;

export function evaluateKnowledgeShare(
  boundary: KnowledgeBoundary,
  requesterOrgNodeId: string,
  grants: readonly KnowledgeShareGrant[],
  nowIso: string,
): boolean {
  if (boundary.ownerOrgNodeId === requesterOrgNodeId || boundary.allowedOrgNodeIds.includes(requesterOrgNodeId)) {
    return true;
  }
  return grants.some((item) =>
    item.boundaryId === boundary.boundaryId
    && item.requesterOrgNodeId === requesterOrgNodeId
    && item.expiresAt >= nowIso);
}
