import { z } from "zod";

import type { KnowledgeBoundary } from "../boundary-manager/index.js";

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

export function evaluateKnowledgeShare(
  boundary: KnowledgeBoundary,
  requesterOrgNodeId: string,
  grants: readonly KnowledgeShareGrant[],
  nowIso: string,
): CrossBoundaryTransformResult | null {
  const allowedOrgNodeIds = boundary.allowedOrgNodeIds ?? [];
  if (boundary.ownerOrgNodeId === requesterOrgNodeId || allowedOrgNodeIds.includes(requesterOrgNodeId)) {
    return { mode: "summary", allowedFieldKeys: undefined };
  }
  // §170-1973 SECURITY FIX: Parse dates explicitly for expiry comparison.
  // While ISO 8601 strings compare correctly lexicographically, explicit Date parsing
  // makes the intent clear and handles edge cases (timezone offsets, millisecond precision).
  const nowMs = Date.parse(nowIso);
  const matchingGrant = grants.find((item) =>
    item.boundaryId === boundary.boundaryId
    && item.requesterOrgNodeId === requesterOrgNodeId
    && (item.expiresAt == null || Date.parse(item.expiresAt) > nowMs));
  if (matchingGrant != null) {
    return {
      mode: matchingGrant.transformMode ?? "summary",
      allowedFieldKeys: matchingGrant.allowedFieldKeys ?? undefined,
    };
  }
  return null;
}
