import { cloneMemoryWithLayer, DEFAULT_MEMORY_PROMOTION_RULES, mapMemoryScopeToLayer, } from "./memory-layer-model.js";
import { ProjectMemoryStore } from "./project-memory-store.js";
import { UserMemoryStore } from "./user-memory-store.js";
export class MemoryPromotionEngine {
    projectStore;
    userStore;
    rules;
    constructor(projectStore = new ProjectMemoryStore(), userStore = new UserMemoryStore(), rules = DEFAULT_MEMORY_PROMOTION_RULES) {
        this.projectStore = projectStore;
        this.userStore = userStore;
        this.rules = rules;
    }
    evaluatePromotion(memory) {
        const currentLayer = mapMemoryScopeToLayer(memory.scope);
        const matchedRule = this.rules.find((rule) => rule.from === currentLayer
            && (memory.hitCount >= rule.minHitCount)
            && ((memory.qualityScore ?? 0) >= rule.minQualityScore)
            && ((memory.importanceScore ?? 0) >= rule.minImportanceScore)) ?? null;
        return {
            memory,
            currentLayer,
            targetLayer: matchedRule?.to ?? null,
            satisfiedRule: matchedRule,
        };
    }
    promote(memories, context = {}) {
        const promoted = [];
        const rejected = [];
        const projectEntries = [];
        const userEntries = [];
        for (const memory of memories) {
            const candidate = this.evaluatePromotion(memory);
            if (!candidate.targetLayer) {
                rejected.push(candidate);
                continue;
            }
            promoted.push(candidate);
            if (candidate.targetLayer === "project" && context.projectId) {
                projectEntries.push(this.projectStore.upsert(context.projectId, cloneMemoryWithLayer(memory, "project")));
            }
            if (candidate.targetLayer === "user" && context.userId) {
                userEntries.push(this.userStore.upsert(context.userId, cloneMemoryWithLayer(memory, "user")));
            }
        }
        return {
            promoted,
            rejected,
            projectEntries,
            userEntries,
        };
    }
    listProjectMemory(projectId) {
        return this.projectStore.list(projectId);
    }
    listUserMemory(userId) {
        return this.userStore.list(userId);
    }
    getRules() {
        return this.rules;
    }
}
//# sourceMappingURL=memory-promotion-engine.js.map