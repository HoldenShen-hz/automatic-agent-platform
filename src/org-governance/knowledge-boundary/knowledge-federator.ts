import { canAccessKnowledgeBoundary, type KnowledgeBoundary } from "./boundary-manager/index.js";
import { evaluateChineseWallPolicy, type ChineseWallPolicy } from "./chinese-wall-policy.js";

export interface FederatedKnowledgeSource {
  readonly sourceId: string;
  readonly boundaryId: string;
  readonly tenantId?: string | null;
  readonly orgNodeId: string;
  readonly title: string;
  readonly content: string;
  readonly tags: readonly string[];
  readonly structuredFields?: Readonly<Record<string, string>>;
}

export interface FederatedKnowledgeQuery {
  readonly requesterOrgNodeId: string;
  readonly requesterTenantId?: string | null;
  readonly query: string;
  readonly boundaryIds?: readonly string[];
  readonly transform?: CrossBoundaryTransform;
}

export interface FederatedKnowledgeResult {
  readonly sourceId: string;
  readonly boundaryId: string;
  readonly tenantId: string | null;
  readonly title: string;
  readonly excerpt: string;
  readonly matchedTags: readonly string[];
  readonly transformApplied: "none" | "summary" | "field_filter";
}

export interface CrossBoundaryTransform {
  readonly mode: "summary" | "field_filter";
  readonly allowedFieldKeys?: readonly string[];
}

export class KnowledgeFederator {
  public search(
    sources: readonly FederatedKnowledgeSource[],
    boundaries: readonly KnowledgeBoundary[],
    query: FederatedKnowledgeQuery,
    policy?: ChineseWallPolicy,
  ): FederatedKnowledgeResult[] {
    const normalizedQuery = query.query.trim().toLowerCase();
    if (normalizedQuery.length === 0) {
      return [];
    }
    return sources
      .filter((source) => query.boundaryIds == null || query.boundaryIds.includes(source.boundaryId))
      .filter((source) => {
        const boundary = boundaries.find((item) => item.boundaryId === source.boundaryId);
        if (boundary == null) {
          return false;
        }
        const boundaryTenantId = boundary.tenantId ?? null;
        const sourceTenantId = source.tenantId ?? null;
        const requesterTenantId = query.requesterTenantId ?? null;
        if (
          (boundaryTenantId != null || sourceTenantId != null || requesterTenantId != null)
          && (boundaryTenantId == null || sourceTenantId == null || requesterTenantId == null
            || boundaryTenantId !== requesterTenantId
            || sourceTenantId !== requesterTenantId)
        ) {
          return false;
        }
        if (!canAccessKnowledgeBoundary(boundary, query.requesterOrgNodeId)) {
          return false;
        }
        if (policy == null) {
          return true;
        }
        return evaluateChineseWallPolicy(policy, query.requesterOrgNodeId, boundary.ownerOrgNodeId).allowed;
      })
      .filter((source) => {
        const haystack = `${source.title} ${source.content} ${source.tags.join(" ")}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .map((source) => {
        const boundary = boundaries.find((item) => item.boundaryId === source.boundaryId)!;
        const transformed = applyCrossBoundaryTransform(
          source,
          boundary,
          query.requesterOrgNodeId,
          query.transform,
        );
        return {
          sourceId: source.sourceId,
          boundaryId: source.boundaryId,
          tenantId: boundary.tenantId ?? source.tenantId ?? null,
          title: source.title,
          excerpt: transformed.excerpt,
          matchedTags: source.tags.filter((tag) => normalizedQuery.includes(tag.toLowerCase()) || tag.toLowerCase().includes(normalizedQuery)),
          transformApplied: transformed.mode,
        };
      });
  }
}

function applyCrossBoundaryTransform(
  source: FederatedKnowledgeSource,
  boundary: KnowledgeBoundary,
  requesterOrgNodeId: string,
  transform?: CrossBoundaryTransform,
): { excerpt: string; mode: "none" | "summary" | "field_filter" } {
  if (requesterOrgNodeId === boundary.ownerOrgNodeId) {
    return { excerpt: source.content.slice(0, 180), mode: "none" };
  }
  if (transform?.mode === "field_filter" && transform.allowedFieldKeys != null && transform.allowedFieldKeys.length > 0) {
    const fields = source.structuredFields ?? {};
    const filtered = transform.allowedFieldKeys
      .filter((key) => key.length > 0 && (boundary.fieldAllowlist.length === 0 || boundary.fieldAllowlist.includes(key)))
      .map((key) => `${key}: ${fields[key] ?? "[redacted]"}`);
    return {
      excerpt: filtered.join(" | ").slice(0, 180),
      mode: "field_filter",
    };
  }
  return {
    excerpt: buildSummaryExcerpt(source.content),
    mode: "summary",
  };
}

function buildSummaryExcerpt(content: string): string {
  const normalized = content
    .replace(/\S+@\S+/g, "[redacted-email]")
    .replace(/\b\d{4,}\b/g, "[redacted-number]")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.slice(0, 180);
}
