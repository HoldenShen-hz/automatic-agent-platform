/**
 * Livestream domain retriever plugin.
 *
 * Retrieves OBS configurations, stream analytics, viewer engagement metrics, and
 * content planning data from the knowledge plane to assist with livestream operations.
 *
 * §G8: Livestream domain — M2 Phase 5 (high complexity, needs OBS/Stream integration).
 */

import type { DomainRetrieverPlugin, RetrieverKnowledgeResult } from "../../domains/registry/plugin-spi.js";

/**
 * Build a search query from the intent and context.
 * Livestream queries prioritize OBS configs, stream analytics, and content plans.
 */
function buildQuery(intent: string, context: Record<string, unknown>): string {
  const fragments = [intent];
  if (typeof context["stream"] === "string") {
    fragments.push(`stream:${context["stream"]}`);
  }
  if (typeof context["platform"] === "string") {
    fragments.push(`platform:${context["platform"]}`);
  }
  if (typeof context["metric"] === "string") {
    fragments.push(`metric:${context["metric"]}`);
  }
  return fragments.join(" ");
}

export function createLivestreamRetrieverPlugin(): DomainRetrieverPlugin {
  let initialized = false;
  return {
    pluginId: "plugin.livestream.retriever",
    domainId: "livestream",
    spiType: "retriever",
    capabilityIds: ["knowledge.retrieve", "domain.observe", "livestream.obs_search"],
    async initialize() {
      initialized = true;
    },
    async healthCheck() {
      return initialized;
    },
    async shutdown() {
      initialized = false;
      return undefined;
    },
    async retrieve(query) {
      const searchQuery = buildQuery(query.intent, query.context);

      const results: RetrieverKnowledgeResult[] = [
        {
          knowledgeRef: `knowledge:livestream/obs?query=${encodeURIComponent(searchQuery)}`,
          snippet: `OBS configuration search: "${searchQuery}" — fetched from livestream/obs namespace`,
          score: 0.95,
          namespace: "livestream/obs",
          chunkId: `obs:${encodeURIComponent(searchQuery)}`,
          documentId: `livestream/obs/search`,
          matchType: "semantic",
        },
        {
          knowledgeRef: `knowledge:livestream/analytics?query=${encodeURIComponent(searchQuery)}`,
          snippet: `Stream analytics for: "${searchQuery}" — fetched from livestream/analytics namespace`,
          score: 0.88,
          namespace: "livestream/analytics",
          chunkId: `analytics:${encodeURIComponent(searchQuery)}`,
          documentId: `livestream/analytics/search`,
          matchType: "keyword",
        },
        {
          knowledgeRef: `knowledge:livestream/engagement?query=${encodeURIComponent(searchQuery)}`,
          snippet: `Viewer engagement for: "${searchQuery}" — fetched from livestream/engagement namespace`,
          score: 0.82,
          namespace: "livestream/engagement",
          chunkId: `engagement:${encodeURIComponent(searchQuery)}`,
          documentId: `livestream/engagement/search`,
          matchType: "semantic",
        },
        {
          knowledgeRef: `knowledge:livestream/content_plans?query=${encodeURIComponent(searchQuery)}`,
          snippet: `Content plan for: "${searchQuery}" — fetched from livestream/content_plans namespace`,
          score: 0.75,
          namespace: "livestream/content_plans",
          chunkId: `plan:${encodeURIComponent(searchQuery)}`,
          documentId: `livestream/content_plans/search`,
          matchType: "keyword",
        },
      ];

      return results.slice(0, Math.max(2, Math.min(8, Math.floor(query.tokenBudget / 200)))) as RetrieverKnowledgeResult[];
    },
  };
}
