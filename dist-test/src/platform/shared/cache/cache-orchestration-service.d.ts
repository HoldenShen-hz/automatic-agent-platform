import type { CacheFacade } from "./cache-facade.js";
import { type PromptPartitionInput, type PromptPartitionResult } from "../../execution/execution-engine/prompt-partition-cache.js";
export interface CacheOrchestrationServiceOptions {
    cache?: CacheFacade;
    workspaceRoot?: string;
}
export interface PromptCacheLookup {
    partition: PromptPartitionResult;
    staticPrefixFromCache: boolean;
    dynamicPromptFromCache: boolean;
}
export interface CacheOrchestrationSummary {
    hits: number;
    misses: number;
    sets: number;
    invalidations: number;
    evictions: number;
}
export declare class CacheOrchestrationService {
    private readonly cache;
    private readonly normalizer;
    constructor(options?: CacheOrchestrationServiceOptions);
    recordPromptPartition(input: PromptPartitionInput): Promise<PromptCacheLookup>;
    getOrComputeToolResult<T>(toolName: string, args: Record<string, unknown>, compute: () => Promise<T>, tags?: readonly string[]): Promise<{
        value: T;
        fromCache: boolean;
    }>;
    getOrComputeMemoryRetrieval<T>(query: unknown, compute: () => Promise<T>, tags?: readonly string[]): Promise<{
        value: T;
        fromCache: boolean;
    }>;
    getOrComputePlannerPlan<T>(input: unknown, compute: () => Promise<T>, tags?: readonly string[]): Promise<{
        value: T;
        fromCache: boolean;
    }>;
    getMetricsSummary(): CacheOrchestrationSummary;
}
