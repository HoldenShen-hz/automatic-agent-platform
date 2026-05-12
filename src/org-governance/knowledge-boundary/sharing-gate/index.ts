import { z } from "zod";

import type { KnowledgeBoundary } from "../boundary-manager/index.js";

export const KnowledgeShareGrantSchema = z.object({
  grantId: z.string().min(1),
  boundaryId: z.string().min(1),
  requesterOrgNodeId: z.string().min(1),
  purpose: z.string().min(1),
  expiresAt: z.string().optional().nullable(),
  transformMode: z.enum(["summary", "field_filter"]).optional(),
  allowedFieldKeys: z.array(z.string().min(1)).optional(),
});

export type KnowledgeShareGrant = z.infer<typeof KnowledgeShareGrantSchema>;

export interface KnowledgeShareDecision {
  readonly mode: "summary" | "field_filter";
  readonly allowedFieldKeys?: readonly string[];
  readonly allowed?: boolean;
  readonly reason?: string;
  readonly matchedGrantId?: string | null;
  readonly evaluatedAt?: string;
}

function buildKnowledgeShareDecision(input: {
  mode: KnowledgeShareDecision["mode"];
  allowedFieldKeys?: readonly string[];
  reason: string;
  matchedGrantId: string | null;
  evaluatedAt: string;
}): KnowledgeShareDecision {
  const visibleDecision: KnowledgeShareDecision = {
    mode: input.mode,
    ...(input.allowedFieldKeys != null ? { allowedFieldKeys: [...input.allowedFieldKeys] } : {}),
  };
  Object.defineProperties(visibleDecision, {
    allowed: {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    },
    reason: {
      value: input.reason,
      enumerable: false,
      configurable: false,
      writable: false,
    },
    matchedGrantId: {
      value: input.matchedGrantId,
      enumerable: false,
      configurable: false,
      writable: false,
    },
    evaluatedAt: {
      value: input.evaluatedAt,
      enumerable: false,
      configurable: false,
      writable: false,
    },
  });
  return visibleDecision;
}

function grantIsActive(grant: KnowledgeShareGrant, nowIso: string): boolean {
  if (!grant.expiresAt) {
    return true;
  }
  const expiryMs = Date.parse(grant.expiresAt);
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(expiryMs) || !Number.isFinite(nowMs)) {
    return false;
  }
  return expiryMs > nowMs;
}

export function evaluateKnowledgeShare(
  boundary: KnowledgeBoundary,
  requesterOrgNodeId: string,
  grants: readonly KnowledgeShareGrant[],
  nowIso: string,
): KnowledgeShareDecision | null {
  const allowedOrgNodeIds = boundary.allowedOrgNodeIds ?? [];
  if (boundary.ownerOrgNodeId === requesterOrgNodeId || allowedOrgNodeIds.includes(requesterOrgNodeId)) {
    return buildKnowledgeShareDecision({
      mode: "summary",
      reason: "owner_or_allowed_org_node",
      matchedGrantId: null,
      evaluatedAt: nowIso,
    });
  }
  const matchedGrant = grants.find((item) =>
    item.boundaryId === boundary.boundaryId
    && ((item as { requesterOrgNodeId?: string }).requesterOrgNodeId ?? (item as { grantedToOrgNodeId?: string }).grantedToOrgNodeId) === requesterOrgNodeId
    && grantIsActive(item, nowIso));
  if (matchedGrant) {
    return buildKnowledgeShareDecision({
      mode: matchedGrant.transformMode ?? "summary",
      ...(matchedGrant.transformMode === "field_filter" ? { allowedFieldKeys: matchedGrant.allowedFieldKeys ?? [] } : {}),
      reason: "active_grant",
      matchedGrantId: matchedGrant.grantId,
      evaluatedAt: nowIso,
    });
  }
  return null;
}
