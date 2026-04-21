import type { KnowledgeBoundary } from "./boundary-manager/index.js";
import { evaluateChineseWallPolicy, type ChineseWallPolicy } from "./chinese-wall-policy.js";

export interface FederatedKnowledgeSource {
  readonly sourceId: string;
  readonly boundaryId: string;
  readonly orgNodeId: string;
  readonly title: string;
  readonly content: string;
  readonly tags: readonly string[];
}

export interface FederatedKnowledgeQuery {
  readonly requesterOrgNodeId: string;
  readonly query: string;
  readonly boundaryIds?: readonly string[];
}

export interface FederatedKnowledgeResult {
  readonly sourceId: string;
  readonly boundaryId: string;
  readonly title: string;
  readonly excerpt: string;
  readonly matchedTags: readonly string[];
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
        if (boundary.defaultVisibility !== "public"
          && boundary.ownerOrgNodeId !== query.requesterOrgNodeId
          && !boundary.allowedOrgNodeIds.includes(query.requesterOrgNodeId)) {
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
      .map((source) => ({
        sourceId: source.sourceId,
        boundaryId: source.boundaryId,
        title: source.title,
        excerpt: source.content.slice(0, 180),
        matchedTags: source.tags.filter((tag) => normalizedQuery.includes(tag.toLowerCase()) || tag.toLowerCase().includes(normalizedQuery)),
      }));
  }
}
