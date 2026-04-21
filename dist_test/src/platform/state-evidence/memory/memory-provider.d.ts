import type { RememberMemoryInput } from "./memory-service.js";
import type { FewShotExample, RecordExperienceInput } from "./experience-cache-service.js";
import type { MemoryRecallQuery } from "./memory-quality.js";
import type { MemoryRecord } from "../../contracts/types/domain.js";
export interface MemoryProviderQuery extends Omit<MemoryRecallQuery, "includeExpired" | "includeRevoked"> {
    queryText?: string | null;
    taskIntent?: string | null;
    toolNames?: readonly string[];
    includeExperienceExamples?: boolean;
    maxPromptMemories?: number;
    maxFewShotExamples?: number;
    /** Token budget for memory retrieval (default: 4096) */
    tokenBudget?: number;
}
export interface MemoryProviderInitializeResult {
    providerId: string;
    initializedAt: string;
    authoritativeSource: "builtin";
    augmentationMode: "authoritative";
}
export interface MemoryProviderPromptBlock {
    providerId: string;
    generatedAt: string;
    memoryIds: string[];
    experienceIds: string[];
    block: string;
}
export interface MemoryProviderPrefetchResult {
    providerId: string;
    requestId: string;
    generatedAt: string;
    degraded: boolean;
    queued: boolean;
    query: MemoryProviderQuery;
    memories: MemoryRecord[];
    fewShotExamples: FewShotExample[];
    experienceIds: string[];
    promptBlock: string;
}
export interface QueuedMemoryPrefetch {
    providerId: string;
    requestId: string;
    queuedAt: string;
    state: "queued" | "completed" | "failed";
}
export interface MemoryTurnSyncInput {
    memories?: readonly RememberMemoryInput[];
    experience?: RecordExperienceInput | null;
    promotionContext?: {
        projectId?: string | null;
        userId?: string | null;
    };
}
export interface MemoryTurnSyncResult {
    providerId: string;
    syncedAt: string;
    rememberedMemoryIds: string[];
    rememberedMemories?: MemoryRecord[];
    recordedExperienceId: string | null;
}
export interface MemoryProviderShutdownResult {
    providerId: string;
    shutdownAt: string;
    pendingPrefetches: number;
}
export interface MemoryProvider {
    initialize(): Promise<MemoryProviderInitializeResult>;
    systemPromptBlock(query: MemoryProviderQuery): Promise<MemoryProviderPromptBlock>;
    prefetch(query: MemoryProviderQuery): Promise<MemoryProviderPrefetchResult>;
    queuePrefetch(query: MemoryProviderQuery): Promise<QueuedMemoryPrefetch>;
    syncTurn(input: MemoryTurnSyncInput): Promise<MemoryTurnSyncResult>;
    shutdown(): Promise<MemoryProviderShutdownResult>;
}
