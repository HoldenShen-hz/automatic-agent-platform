import type { MemoryRecord } from "../../contracts/types/domain.js";
import type { MemoryProvider, MemoryProviderQuery, MemoryTurnSyncInput, MemoryTurnSyncResult } from "./memory-provider.js";
import type { CacheOrchestrationService } from "../../shared/cache/cache-orchestration-service.js";
import { MemoryPromotionEngine, type MemoryPromotionResult } from "./memory-promotion-engine.js";
export type MemoryPlaneLayer = "runtime" | "session" | "agent" | "project" | "user" | "evolution";
export interface MemoryPlaneView {
    layers: Record<MemoryPlaneLayer, MemoryRecord[]>;
    promptBlock: string;
    fewShotExampleCount: number;
    memoryIds: string[];
    experienceIds: string[];
    fromCache: boolean;
}
export declare class MemoryPlaneService {
    private readonly provider;
    private readonly cache?;
    private readonly promotionEngine;
    constructor(provider: MemoryProvider, cache?: CacheOrchestrationService | undefined, promotionEngine?: MemoryPromotionEngine);
    buildView(query: MemoryProviderQuery): Promise<MemoryPlaneView>;
    syncTurn(input: MemoryTurnSyncInput): Promise<MemoryTurnSyncResult>;
    evaluatePromotion(memories: readonly MemoryRecord[], context?: {
        projectId?: string | null;
        userId?: string | null;
    }): MemoryPromotionResult;
}
