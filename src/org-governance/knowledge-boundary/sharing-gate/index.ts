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

export interface KnowledgeShareDecision {
  readonly allowed: boolean;
  readonly reason: string;
  readonly matchedGrantId: string | null;
  readonly evaluatedAt: string;
}

export function evaluateKnowledgeShare(
  boundary: KnowledgeBoundary,
  requesterOrgNodeId: string,
  grants: readonly KnowledgeShareGrant[],
  nowIso: string,
): KnowledgeShareDecision {
  const allowedOrgNodeIds = boundary.allowedOrgNodeIds ?? [];
  if (boundary.ownerOrgNodeId === requesterOrgNodeId || allowedOrgNodeIds.includes(requesterOrgNodeId)) {
    return {
      allowed: true,
      reason: "owner_or_allowed_org_node",
      matchedGrantId: null,
      evaluatedAt: nowIso,
    };
  }
  const matchedGrant = grants.find((item) =>
    item.boundaryId === boundary.boundaryId
    && ((item as { requesterOrgNodeId?: string }).requesterOrgNodeId ?? (item as { grantedToOrgNodeId?: string }).grantedToOrgNodeId) === requesterOrgNodeId
    && (!item.expiresAt || new Date(item.expiresAt) >= new Date(nowIso)));
  if (matchedGrant) {
    return {
      allowed: true,
      reason: "active_grant",
      matchedGrantId: matchedGrant.grantId,
      evaluatedAt: nowIso,
    };
  }
  return {
    allowed: false,
    reason: "no_matching_grant_or_not_allowed",
    matchedGrantId: null,
    evaluatedAt: nowIso,
  };
}
