import { MemoryPromotionEngine } from "./memory-promotion-engine.js";
function toLayer(scope) {
    switch (scope) {
        case "task_runtime":
            return "runtime";
        case "session":
            return "session";
        case "agent":
            return "agent";
        case "workspace":
        case "project":
            return "project";
        case "user":
            return "user";
        case "experience":
        case "evolution":
            return "evolution";
        default:
            return "project";
    }
}
function emptyLayers() {
    return {
        runtime: [],
        session: [],
        agent: [],
        project: [],
        user: [],
        evolution: [],
    };
}
export class MemoryPlaneService {
    provider;
    cache;
    promotionEngine;
    constructor(provider, cache, promotionEngine = new MemoryPromotionEngine()) {
        this.provider = provider;
        this.cache = cache;
        this.promotionEngine = promotionEngine;
    }
    async buildView(query) {
        const tags = [
            ...(query.sessionId != null ? [`session:${query.sessionId}`] : []),
            ...(query.agentId != null ? [`agent:${query.agentId}`] : []),
            ...(query.queryText != null ? [`memory-query:${query.queryText}`] : []),
        ];
        const loader = async () => this.provider.prefetch(query);
        const wrapped = this.cache == null
            ? { value: await loader(), fromCache: false }
            : await this.cache.getOrComputeMemoryRetrieval(query, loader, tags);
        const layers = emptyLayers();
        for (const memory of wrapped.value.memories) {
            layers[toLayer(memory.scope)].push(memory);
        }
        return {
            layers,
            promptBlock: wrapped.value.promptBlock,
            fewShotExampleCount: wrapped.value.fewShotExamples.length,
            memoryIds: wrapped.value.memories.map((memory) => memory.id),
            experienceIds: wrapped.value.experienceIds,
            fromCache: wrapped.fromCache,
        };
    }
    async syncTurn(input) {
        const result = await this.provider.syncTurn(input);
        const rememberedMemories = result.rememberedMemories ?? [];
        if (rememberedMemories.length === 0) {
            return result;
        }
        this.promotionEngine.promote(rememberedMemories, input.promotionContext ?? {});
        return result;
    }
    evaluatePromotion(memories, context = {}) {
        return this.promotionEngine.promote(memories, context);
    }
}
//# sourceMappingURL=memory-plane-service.js.map