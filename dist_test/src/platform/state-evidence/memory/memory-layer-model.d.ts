import type { MemoryRecord } from "../../contracts/types/domain.js";
export type HierarchicalMemoryLayer = "runtime" | "session" | "agent" | "project" | "user" | "evolution";
export interface LayerPromotionRule {
    from: HierarchicalMemoryLayer;
    to: HierarchicalMemoryLayer;
    minHitCount: number;
    minQualityScore: number;
    minImportanceScore: number;
}
export interface MemoryPromotionCandidate {
    memory: MemoryRecord;
    currentLayer: HierarchicalMemoryLayer;
    targetLayer: HierarchicalMemoryLayer | null;
    satisfiedRule: LayerPromotionRule | null;
}
export declare const DEFAULT_MEMORY_PROMOTION_RULES: readonly LayerPromotionRule[];
export declare function mapMemoryScopeToLayer(scope: string): HierarchicalMemoryLayer;
export declare function cloneMemoryWithLayer(memory: MemoryRecord, layer: HierarchicalMemoryLayer): MemoryRecord;
