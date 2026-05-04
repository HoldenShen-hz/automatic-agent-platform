import { z } from "zod";

import type { KnowledgeBoundary } from "../boundary-manager/index.js";
import type { CrossBoundaryTransform } from "../knowledge-federator.js";

export const KnowledgeShareGrantSchema = z.object({
  grantId: z.string().min(1),
  boundaryId: z.string().min(1),
  requesterOrgNodeId: z.string().min(1),
  purpose: z.string().min(1),
  expiresAt: z.string().min(1),
  transformMode: z.enum(["summary", "field_filter"]).optional(),
  allowedFieldKeys: z.array(z.string()).optional(),
});

export type KnowledgeShareGrant = z.infer<typeof KnowledgeShareGrantSchema>;

export interface CrossBoundaryTransformResult {
  readonly mode: "summary" | "field_filter";
  readonly allowedFieldKeys?: readonly string[] | undefined;
}

// R3-32 FIX: evaluateKnowledgeShare returns CrossBoundaryTransform spec (not Result)
export function evaluateKnowledgeShare(
  boundary: KnowledgeBoundary,
  requesterOrgNodeId: string,
  grants: readonly KnowledgeShareGrant[],
  nowIso: string,
): CrossBoundaryTransform | null {
  const allowedOrgNodeIds = boundary.allowedOrgNodeIds ?? [];
  if (boundary.ownerOrgNodeId === requesterOrgNodeId || allowedOrgNodeIds.includes(requesterOrgNodeId)) {
    // Return CrossBoundaryTransform with only mode (allowedFieldKeys omitted when not needed)
    return { mode: "summary" };
  }
  const nowMs = Date.parse(nowIso);
  const matchingGrant = grants.find((item) =>
    item.boundaryId === boundary.boundaryId
    && item.requesterOrgNodeId === requesterOrgNodeId
    && (item.expiresAt == null || Date.parse(item.expiresAt) > nowMs));
  if (matchingGrant != null) {
    // Build CrossBoundaryTransform - use spread to conditionally include allowedFieldKeys
    const result: CrossBoundaryTransform = matchingGrant.allowedFieldKeys != null && matchingGrant.allowedFieldKeys.length > 0
      ? { mode: matchingGrant.transformMode ?? "summary", allowedFieldKeys: matchingGrant.allowedFieldKeys as readonly string[] }
      : { mode: matchingGrant.transformMode ?? "summary" };
    return result;
  }
  return null;
}
