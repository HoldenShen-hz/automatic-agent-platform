import { canAccessKnowledgeBoundary, type KnowledgeBoundary } from "./boundary-manager/index.js";
import { evaluateChineseWallPolicy, type ChineseWallConstraint, type ChineseWallPolicy } from "./chinese-wall-policy.js";

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

export interface FederatedSearchRequest {
  readonly requester: string;
  readonly requesterTenantId: string;
  readonly harnessRunId: string;
  readonly nodeRunId?: string | null;
  readonly requesterOrgNodeId: string;
  readonly query: string;
  readonly allowedBoundaries: readonly string[];
  readonly purpose: string;
  readonly maxSources: number;
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

export interface FederatedSearchResult {
  readonly matchedSources: readonly FederatedKnowledgeResult[];
  readonly redactedFields: readonly string[];
  readonly deniedBoundaries: readonly string[];
  readonly auditRef: string;
}

export interface CrossBoundaryTransform {
  readonly mode: "summary" | "field_filter";
  readonly allowedFieldKeys?: readonly string[];
}

export class KnowledgeFederator {
  public searchFederated(
    sources: readonly FederatedKnowledgeSource[],
    boundaries: readonly KnowledgeBoundary[],
    request: FederatedSearchRequest,
    policy?: ChineseWallPolicy,
  ): FederatedSearchResult {
    const deniedBoundaries = new Set<string>();
    const redactedFields = new Set<string>();
    const normalizedQuery = request.query.trim().toLowerCase();
    if (normalizedQuery.length === 0) {
      return {
        matchedSources: [],
        redactedFields: [],
        deniedBoundaries: [...request.allowedBoundaries],
        auditRef: `federated_search:${request.harnessRunId}:${request.nodeRunId ?? "root"}`,
      };
    }

    const matchedSources = sources
      .filter((source) => request.allowedBoundaries.includes(source.boundaryId))
      .filter((source) => {
        const boundary = boundaries.find((item) => item.boundaryId === source.boundaryId);
        if (boundary == null) {
          deniedBoundaries.add(source.boundaryId);
          return false;
        }
        const boundaryTenantId = boundary.tenantId ?? null;
        const sourceTenantId = source.tenantId ?? null;
        if (
          (boundaryTenantId != null || sourceTenantId != null)
          && (boundaryTenantId == null || sourceTenantId == null || boundaryTenantId !== request.requesterTenantId || sourceTenantId !== request.requesterTenantId)
        ) {
          deniedBoundaries.add(source.boundaryId);
          return false;
        }
        if (!canAccessKnowledgeBoundary(boundary, request.requesterOrgNodeId)) {
          deniedBoundaries.add(source.boundaryId);
          return false;
        }
        if (policy != null) {
          const chineseWallDecision = evaluateChineseWallPolicy(policy, request.requesterOrgNodeId, boundary.ownerOrgNodeId);
          if (!chineseWallDecision.allowed) {
            deniedBoundaries.add(source.boundaryId);
            collectChineseWallRedactions(chineseWallDecision.constraint, redactedFields);
            return false;
          }
        }
        return true;
      })
      .filter((source) => {
        const haystack = `${source.title} ${source.content} ${source.tags.join(" ")}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, request.maxSources)
      .map((source) => {
        const boundary = boundaries.find((item) => item.boundaryId === source.boundaryId)!;
        const transformed = applyCrossBoundaryTransform(
          source,
          boundary,
          request.requesterOrgNodeId,
          request.transform,
        );
        transformed.redactedFields.forEach((field) => redactedFields.add(field));
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

    return {
      matchedSources: [...matchedSources],
      redactedFields: [...redactedFields],
      deniedBoundaries: [...deniedBoundaries],
      auditRef: `federated_search:${request.harnessRunId}:${request.nodeRunId ?? "root"}`,
    };
  }

  public search(
    sources: readonly FederatedKnowledgeSource[],
    boundaries: readonly KnowledgeBoundary[],
    query: FederatedKnowledgeQuery,
    policy?: ChineseWallPolicy,
  ): FederatedKnowledgeResult[] {
    return this.searchFederated(
      sources,
      boundaries,
      {
        requester: query.requesterOrgNodeId,
        requesterTenantId: query.requesterTenantId ?? "",
        harnessRunId: "legacy-harness",
        nodeRunId: null,
        requesterOrgNodeId: query.requesterOrgNodeId,
        query: query.query,
        allowedBoundaries: query.boundaryIds ?? boundaries.map((boundary) => boundary.boundaryId),
        purpose: "legacy_search",
        maxSources: Number.MAX_SAFE_INTEGER,
        ...(query.transform != null && { transform: query.transform }),
      },
      policy,
    ).matchedSources as FederatedKnowledgeResult[];
  }
}

function applyCrossBoundaryTransform(
  source: FederatedKnowledgeSource,
  boundary: KnowledgeBoundary,
  requesterOrgNodeId: string,
  transform?: CrossBoundaryTransform,
): { excerpt: string; mode: "none" | "summary" | "field_filter"; redactedFields: readonly string[] } {
  if (requesterOrgNodeId === boundary.ownerOrgNodeId) {
    return { excerpt: source.content.slice(0, 180), mode: "none", redactedFields: [] };
  }
  if (transform?.mode === "field_filter" && transform.allowedFieldKeys != null && transform.allowedFieldKeys.length > 0) {
    const fields = source.structuredFields ?? {};
    const deniedFields = Object.keys(fields).filter((key) => !transform.allowedFieldKeys!.includes(key));
    const boundaryFieldAllowlist = boundary.fieldAllowlist ?? [];
    const filtered = transform.allowedFieldKeys
      .filter((key) => key.length > 0 && (boundaryFieldAllowlist.length === 0 || boundaryFieldAllowlist.includes(key)))
      .map((key) => `${key}: ${fields[key] ?? "[redacted]"}`);
    return {
      excerpt: filtered.join(" | ").slice(0, 180),
      mode: "field_filter",
      redactedFields: deniedFields,
    };
  }
  return {
    excerpt: buildSummaryExcerpt(source.content),
    mode: "summary",
    redactedFields: ["content"],
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

function collectChineseWallRedactions(
  constraint: ChineseWallConstraint | null,
  redactedFields: Set<string>,
): void {
  if (constraint == null) {
    return;
  }
  redactedFields.add("boundary");
  if (constraint.blockedGroupId != null) {
    redactedFields.add(`conflict_group:${constraint.blockedGroupId}`);
  }
}
