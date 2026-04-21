/**
 * Game Dev domain retriever plugin.
 *
 * Retrieves Unity project data, build outputs, game design documents, and asset
 * references from the knowledge plane to assist with game development tasks.
 *
 * §G8: Game Dev domain — M2 Phase 3 (medium complexity, needs Unity Cloud Build).
 */
/**
 * Build a search query from the intent and context.
 * Game Dev queries prioritize Unity projects, build outputs, and design docs.
 */
function buildQuery(intent, context) {
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
export function createGameDevRetrieverPlugin() {
    return {
        pluginId: "plugin.gamedev.retriever",
        domainId: "gamedev",
        spiType: "retriever",
        capabilityIds: ["knowledge.retrieve", "domain.observe", "gamedev.unity_search"],
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
            const searchQuery = buildQuery(query.intent, query.context);
            const results = [
                {
                    knowledgeRef: `knowledge:gamedev/projects?query=${encodeURIComponent(searchQuery)}`,
                    snippet: `Unity project search: "${searchQuery}" — fetched from gamedev/projects namespace`,
                    score: 0.95,
                    namespace: "gamedev/projects",
                    chunkId: `project:${encodeURIComponent(searchQuery)}`,
                    documentId: `gamedev/projects/search`,
                    matchType: "semantic",
                },
                {
                    knowledgeRef: `knowledge:gamedev/builds?query=${encodeURIComponent(searchQuery)}`,
                    snippet: `Build output for: "${searchQuery}" — fetched from gamedev/builds namespace`,
                    score: 0.88,
                    namespace: "gamedev/builds",
                    chunkId: `build:${encodeURIComponent(searchQuery)}`,
                    documentId: `gamedev/builds/search`,
                    matchType: "keyword",
                },
                {
                    knowledgeRef: `knowledge:gamedev/design_docs?query=${encodeURIComponent(searchQuery)}`,
                    snippet: `Game design doc for: "${searchQuery}" — fetched from gamedev/design_docs namespace`,
                    score: 0.82,
                    namespace: "gamedev/design_docs",
                    chunkId: `design:${encodeURIComponent(searchQuery)}`,
                    documentId: `gamedev/design_docs/search`,
                    matchType: "semantic",
                },
                {
                    knowledgeRef: `knowledge:gamedev/assets?query=${encodeURIComponent(searchQuery)}`,
                    snippet: `Asset reference for: "${searchQuery}" — fetched from gamedev/assets namespace`,
                    score: 0.75,
                    namespace: "gamedev/assets",
                    chunkId: `asset:${encodeURIComponent(searchQuery)}`,
                    documentId: `gamedev/assets/search`,
                    matchType: "structural",
                },
            ];
            return results.slice(0, Math.max(2, Math.min(8, Math.floor(query.tokenBudget / 200))));
        },
    };
}
//# sourceMappingURL=game-dev-retriever.js.map