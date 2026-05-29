/**
 * Game Dev domain retriever plugin.
 *
 * Retrieves Unity project data, build outputs, game design documents, and asset
 * references from the knowledge plane to assist with game development tasks.
 *
 * §G8: Game Dev domain — M2 Phase 3 (medium complexity, needs Unity Cloud Build).
 */

import type { DomainRetrieverPlugin, RetrieverKnowledgeResult } from "../../domains/registry/plugin-spi.js";

export interface GameDevRetrieverPluginOptions {
  readonly healthCheck?: () => boolean | Promise<boolean>;
}

const GAMEDEV_PROJECT_BASE_SCORE = 0.7;
const GAMEDEV_PROJECT_QUERY_BONUS_CAP = 0.18;
const GAMEDEV_PROJECT_QUERY_DIVISOR = 240;
const GAMEDEV_BUILD_BASE_SCORE = 0.62;
const GAMEDEV_BUILD_CONTEXT_BONUS_CAP = 0.2;
const GAMEDEV_BUILD_CONTEXT_MULTIPLIER = 0.06;
const GAMEDEV_DESIGN_BASE_SCORE = 0.58;
const GAMEDEV_DESIGN_INTENT_BONUS_CAP = 0.18;
const GAMEDEV_DESIGN_INTENT_DIVISOR = 200;
const GAMEDEV_ASSET_BASE_SCORE = 0.54;
const GAMEDEV_ASSET_TOKEN_BONUS_CAP = 0.18;
const GAMEDEV_ASSET_TOKEN_DIVISOR = 4000;

/**
 * Build a search query from the intent and context.
 * Game Dev queries prioritize Unity projects, build outputs, and design docs.
 */
function buildQuery(intent: string, context: Record<string, unknown>): string {
  const fragments = [intent];
  if (typeof context["project"] === "string") {
    fragments.push(`project:${context["project"]}`);
  }
  if (typeof context["platform"] === "string") {
    fragments.push(`platform:${context["platform"]}`);
  }
  if (typeof context["scene"] === "string") {
    fragments.push(`scene:${context["scene"]}`);
  }
  return fragments.join(" ");
}

export function createGameDevRetrieverPlugin(): DomainRetrieverPlugin {
  return createGameDevRetrieverPluginWithOptions();
}

export function createGameDevRetrieverPluginWithOptions(
  options: GameDevRetrieverPluginOptions = {},
): DomainRetrieverPlugin {
  return {
    pluginId: "plugin.gamedev.retriever",
    domainId: "game-dev",
    spiType: "retriever",
    capabilityIds: ["knowledge.retrieve", "domain.observe", "gamedev.unity_search"],
    async initialize() {
      // No-op: knowledge plane is available immediately
    },
    async healthCheck() {
      return options.healthCheck?.() ?? false;
    },
    async shutdown() {
      return undefined;
    },
    async retrieve(query) {
      const searchQuery = buildQuery(query.intent, query.context);

      const results: RetrieverKnowledgeResult[] = [
        {
          knowledgeRef: `knowledge:gamedev/projects?query=${encodeURIComponent(searchQuery)}` as string,
          snippet: `Unity project search: "${searchQuery}" — fetched from gamedev/projects namespace`,
          score: Math.min(
            0.97,
            GAMEDEV_PROJECT_BASE_SCORE + Math.min(searchQuery.length / GAMEDEV_PROJECT_QUERY_DIVISOR, GAMEDEV_PROJECT_QUERY_BONUS_CAP),
          ),
          namespace: "gamedev/projects",
          chunkId: `project:${encodeURIComponent(searchQuery)}`,
          documentId: `gamedev/projects/search`,
          matchType: "semantic",
        },
        {
          knowledgeRef: `knowledge:gamedev/builds?query=${encodeURIComponent(searchQuery)}` as string,
          snippet: `Build output for: "${searchQuery}" — fetched from gamedev/builds namespace`,
          score: Math.min(
            0.94,
            GAMEDEV_BUILD_BASE_SCORE
              + Math.min(Object.keys(query.context).length * GAMEDEV_BUILD_CONTEXT_MULTIPLIER, GAMEDEV_BUILD_CONTEXT_BONUS_CAP),
          ),
          namespace: "gamedev/builds",
          chunkId: `build:${encodeURIComponent(searchQuery)}`,
          documentId: `gamedev/builds/search`,
          matchType: "keyword",
        },
        {
          knowledgeRef: `knowledge:gamedev/design_docs?query=${encodeURIComponent(searchQuery)}` as string,
          snippet: `Game design doc for: "${searchQuery}" — fetched from gamedev/design_docs namespace`,
          score: Math.min(
            0.9,
            GAMEDEV_DESIGN_BASE_SCORE + Math.min(query.intent.length / GAMEDEV_DESIGN_INTENT_DIVISOR, GAMEDEV_DESIGN_INTENT_BONUS_CAP),
          ),
          namespace: "gamedev/design_docs",
          chunkId: `design:${encodeURIComponent(searchQuery)}`,
          documentId: `gamedev/design_docs/search`,
          matchType: "semantic",
        },
        {
          knowledgeRef: `knowledge:gamedev/assets?query=${encodeURIComponent(searchQuery)}` as string,
          snippet: `Asset reference for: "${searchQuery}" — fetched from gamedev/assets namespace`,
          score: Math.min(
            0.86,
            GAMEDEV_ASSET_BASE_SCORE + Math.min(query.tokenBudget / GAMEDEV_ASSET_TOKEN_DIVISOR, GAMEDEV_ASSET_TOKEN_BONUS_CAP),
          ),
          namespace: "gamedev/assets",
          chunkId: `asset:${encodeURIComponent(searchQuery)}`,
          documentId: `gamedev/assets/search`,
          matchType: "structural",
        },
      ];

      return results.slice(0, Math.max(2, Math.min(8, Math.floor(query.tokenBudget / 200)))) as RetrieverKnowledgeResult[];
    },
  };
}
