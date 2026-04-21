import type { MemoryRecord } from "../../contracts/types/domain.js";
import { type LayerPromotionRule, type MemoryPromotionCandidate } from "./memory-layer-model.js";
import { ProjectMemoryStore, type ProjectMemoryEntry } from "./project-memory-store.js";
import { UserMemoryStore, type UserMemoryEntry } from "./user-memory-store.js";
export interface MemoryPromotionResult {
    promoted: MemoryPromotionCandidate[];
    rejected: MemoryPromotionCandidate[];
    projectEntries: ProjectMemoryEntry[];
    userEntries: UserMemoryEntry[];
}
export declare class MemoryPromotionEngine {
    private readonly projectStore;
    private readonly userStore;
    private readonly rules;
    constructor(projectStore?: ProjectMemoryStore, userStore?: UserMemoryStore, rules?: readonly LayerPromotionRule[]);
    evaluatePromotion(memory: MemoryRecord): MemoryPromotionCandidate;
    promote(memories: readonly MemoryRecord[], context?: {
        projectId?: string | null;
        userId?: string | null;
    }): MemoryPromotionResult;
    listProjectMemory(projectId: string): ProjectMemoryEntry[];
    listUserMemory(userId: string): UserMemoryEntry[];
    getRules(): readonly LayerPromotionRule[];
}
