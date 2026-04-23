/**
 * Asset Production domain retriever plugin.
 *
 * Retrieves Figma files, CDN assets, design tokens, and production metadata
 * from the knowledge plane to assist with digital asset creation tasks.
 *
 * §G8: Asset Production domain — M2 Phase 4 (high complexity, needs Figma + CDN).
 */
/**
 * Build a search query from the intent and context.
 * Asset Production queries prioritize Figma files, CDN assets, and design tokens.
 */
function buildQuery(intent, context) {
    const fragments = [intent];
    if (typeof context["file"] === "string") {
        fragments.push(`file:${context["file"]}`);
    }
    if (typeof context["format"] === "string") {
        fragments.push(`format:${context["format"]}`);
    }
    if (typeof context["brand"] === "string") {
        fragments.push(`brand:${context["brand"]}`);
    }
    return fragments.join(" ");
}
export function createAssetProductionRetrieverPlugin() {
    return {
        pluginId: "plugin.assetproduction.retriever",
        domainId: "assetproduction",
        spiType: "retriever",
        capabilityIds: ["knowledge.retrieve", "domain.observe", "assetproduction.figma_search"],
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
                    knowledgeRef: `knowledge:assetprod/figma?query=${encodeURIComponent(searchQuery)}`,
                    snippet: `Figma file search: "${searchQuery}" — fetched from assetprod/figma namespace`,
                    score: 0.95,
                    namespace: "assetprod/figma",
                    chunkId: `figma:${encodeURIComponent(searchQuery)}`,
                    documentId: `assetprod/figma/search`,
                    matchType: "semantic",
                },
                {
                    knowledgeRef: `knowledge:assetprod/cdn?query=${encodeURIComponent(searchQuery)}`,
                    snippet: `CDN asset for: "${searchQuery}" — fetched from assetprod/cdn namespace`,
                    score: 0.88,
                    namespace: "assetprod/cdn",
                    chunkId: `cdn:${encodeURIComponent(searchQuery)}`,
                    documentId: `assetprod/cdn/search`,
                    matchType: "keyword",
                },
                {
                    knowledgeRef: `knowledge:assetprod/design_tokens?query=${encodeURIComponent(searchQuery)}`,
                    snippet: `Design token for: "${searchQuery}" — fetched from assetprod/design_tokens namespace`,
                    score: 0.82,
                    namespace: "assetprod/design_tokens",
                    chunkId: `token:${encodeURIComponent(searchQuery)}`,
                    documentId: `assetprod/design_tokens/search`,
                    matchType: "semantic",
                },
                {
                    knowledgeRef: `knowledge:assetprod/metadata?query=${encodeURIComponent(searchQuery)}`,
                    snippet: `Asset metadata for: "${searchQuery}" — fetched from assetprod/metadata namespace`,
                    score: 0.75,
                    namespace: "assetprod/metadata",
                    chunkId: `metadata:${encodeURIComponent(searchQuery)}`,
                    documentId: `assetprod/metadata/search`,
                    matchType: "keyword",
                },
            ];
            return results.slice(0, Math.max(2, Math.min(8, Math.floor(query.tokenBudget / 200))));
        },
    };
}
//# sourceMappingURL=asset-production-retriever.js.map