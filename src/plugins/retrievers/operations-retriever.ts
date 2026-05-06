/**
 * Operations domain retriever plugin.
 *
 * Retrieves runbooks, incident records, and monitoring dashboards from the knowledge plane
 * to assist with operational tasks.
 *
 * §G8: Operations domain — M2 Phase 1 (simplest domain, uses existing GitHub adapter).
 */

import type { DomainRetrieverPlugin, PluginLifecycleContext, RetrieverKnowledgeResult } from "../../domains/registry/plugin-spi.js";

/**
 * Build a search query from the intent and context.
 * Operations queries prioritize runbooks and incident records.
 */
function buildQuery(intent: string, context: Record<string, unknown>): string {
  const fragments = [intent];
  if (typeof context["system"] === "string") {
    fragments.push(`system:${context["system"]}`);
  }
  if (typeof context["component"] === "string") {
    fragments.push(`component:${context["component"]}`);
  }
  return fragments.join(" ");
}

export function createOperationsRetrieverPlugin(): DomainRetrieverPlugin {
  return {
    pluginId: "plugin.operations.retriever",
    domainId: "operations",
    spiType: "retriever",
    capabilityIds: ["knowledge.retrieve", "domain.observe", "ops.runbook_search"],
    async onLoad(_context: PluginLifecycleContext): Promise<void> {
      // Plugin is being loaded
    },
    async onActivate(_context: PluginLifecycleContext): Promise<void> {
      // Plugin is being activated
    },
    async onDeactivate(_context: PluginLifecycleContext): Promise<void> {
      // Plugin is being deactivated
    },
    async onUnload(_context: PluginLifecycleContext): Promise<void> {
      // Plugin is being unloaded
    },
    async initialize() {
      // No-op: knowledge plane is available immediately
    },
    async healthCheck() {
      return true;
    },
    async shutdown() {
      return undefined;
    },
    async retrieve(query) {
      // Build a query string targeting operational knowledge
      const searchQuery = buildQuery(query.intent, query.context);

      // In a real implementation this would query the KnowledgePlaneService.
      // For now we return a structured result that the KnowledgePlaneQueryService can resolve.
      const results: RetrieverKnowledgeResult[] = [
        {
          knowledgeRef: `knowledge:ops/runbooks?query=${encodeURIComponent(searchQuery)}` as string,
          snippet: `Runbook search: "${searchQuery}" — fetched from operations/runbooks namespace`,
          score: 0.95,
          namespace: "operations/runbooks",
          chunkId: `runbook:${encodeURIComponent(searchQuery)}`,
          documentId: `ops/runbooks/search`,
          matchType: "semantic",
        },
        {
          knowledgeRef: `knowledge:ops/incidents?query=${encodeURIComponent(searchQuery)}` as string,
          snippet: `Incident records matching: "${searchQuery}" — fetched from operations/incidents namespace`,
          score: 0.85,
          namespace: "operations/incidents",
          chunkId: `incident:${encodeURIComponent(searchQuery)}`,
          documentId: `ops/incidents/search`,
          matchType: "keyword",
        },
      ];

      return results.slice(0, Math.max(2, Math.min(8, Math.floor(query.tokenBudget / 200)))) as RetrieverKnowledgeResult[];
    },
  };
}
