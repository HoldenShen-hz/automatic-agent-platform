/**
 * Growth domain retriever plugin.
 *
 * Retrieves growth playbooks, campaign data, customer analytics, and A/B test results
 * from the knowledge plane to assist with marketing and growth tasks.
 *
 * §G8: Growth domain — M2 Phase 2 (medium complexity, needs Ad Platforms + CRM).
 */

import type { DomainRetrieverPlugin, RetrieverKnowledgeResult } from "../../domains/registry/plugin-spi.js";

/**
 * Build a search query from the intent and context.
 * Growth queries prioritize playbooks, campaign metrics, and customer data.
 */
function buildQuery(intent: string, context: Record<string, unknown>): string {
  const fragments = [intent];
  if (typeof context["campaign"] === "string") {
    fragments.push(`campaign:${context["campaign"]}`);
  }
  if (typeof context["metric"] === "string") {
    fragments.push(`metric:${context["metric"]}`);
  }
  return fragments.join(" ");
}

export function createGrowthRetrieverPlugin(): DomainRetrieverPlugin {
  let initialized = false;
  return {
    pluginId: "plugin.growth.retriever",
    domainId: "growth",
    spiType: "retriever",
    capabilityIds: ["knowledge.retrieve", "domain.observe", "growth.playbook_search"],
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

      // Return structured results targeting growth knowledge namespaces.
      // In production these would be resolved by the KnowledgePlaneQueryService.
      const results: RetrieverKnowledgeResult[] = [
        {
          knowledgeRef: `knowledge:growth/playbooks?query=${encodeURIComponent(searchQuery)}` as string,
          snippet: `Growth playbook search: "${searchQuery}" — fetched from growth/playbooks namespace`,
          score: 0.95,
          namespace: "growth/playbooks",
          chunkId: `playbook:${encodeURIComponent(searchQuery)}`,
          documentId: `growth/playbooks/search`,
          matchType: "semantic",
        },
        {
          knowledgeRef: `knowledge:growth/campaigns?query=${encodeURIComponent(searchQuery)}` as string,
          snippet: `Campaign data for: "${searchQuery}" — fetched from growth/campaigns namespace`,
          score: 0.88,
          namespace: "growth/campaigns",
          chunkId: `campaign:${encodeURIComponent(searchQuery)}`,
          documentId: `growth/campaigns/search`,
          matchType: "keyword",
        },
        {
          knowledgeRef: `knowledge:growth/ab_tests?query=${encodeURIComponent(searchQuery)}` as string,
          snippet: `A/B test results for: "${searchQuery}" — fetched from growth/ab_tests namespace`,
          score: 0.82,
          namespace: "growth/ab_tests",
          chunkId: `abtest:${encodeURIComponent(searchQuery)}`,
          documentId: `growth/ab_tests/search`,
          matchType: "semantic",
        },
      ];

      return results.slice(0, Math.max(2, Math.min(8, Math.floor(query.tokenBudget / 200)))) as RetrieverKnowledgeResult[];
    },
  };
}
