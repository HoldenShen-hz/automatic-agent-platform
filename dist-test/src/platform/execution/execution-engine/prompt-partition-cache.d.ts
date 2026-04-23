/**
 * @fileoverview Prompt Partition Cache - Caches LLM prompt prefixes for reuse.
 *
 * Separates prompts into static (system prompt) and dynamic (conversation history)
 * parts. The static prefix is expensive to process and can be cached, while the
 * dynamic part changes with each request and must be re-processed.
 *
 * Key concepts:
 * - Static prefix: System messages at the beginning (cached)
 * - Dynamic suffix: User/assistant turns (re-processed each call)
 * - Stable cache keys allow reuse across similar prompts
 *
 * @see Context Compaction Contract: docs_zh/contracts/context_compaction_and_overflow_contract.md
 */
export interface PromptPartitionMessageLike {
    role?: string | null;
    content?: unknown;
    parts?: unknown;
}
export interface PromptPartitionInput {
    model?: string | null;
    profileId?: string | null;
    domainId?: string | null;
    kvCache?: {
        enabled?: boolean;
        fixedPrefixMessageCount?: number;
        cacheKeyStrategy?: "hash_prefix" | "exact_match";
    } | null;
    messages: readonly PromptPartitionMessageLike[];
}
export interface PromptPartitionResult {
    model: string | null;
    profileId: string | null;
    domainId: string | null;
    staticMessageCount: number;
    dynamicMessageCount: number;
    stablePrefixBytes: number;
    staticDigest: string;
    dynamicDigest: string;
    staticCacheKey: string;
    dynamicCacheKey: string;
    kvCacheEnabled: boolean;
    cacheKeyStrategy: "hash_prefix" | "exact_match";
    fixedPrefixMessageCount: number;
    domainBlockMessageCount: number;
    variableMessageCount: number;
    fixedPrefixBytes: number;
    domainBlockBytes: number;
    variableSuffixBytes: number;
    fixedPrefixDigest: string;
    domainBlockDigest: string;
    variableSuffixDigest: string;
    fixedPrefixCacheKey: string;
    domainBlockCacheKey: string | null;
}
export interface PromptPartitionUsage {
    partition: PromptPartitionResult;
    firstSeenAt: string;
    lastSeenAt: string;
    reuseCount: number;
}
/**
 * Partitions a prompt into static (cacheable) and dynamic parts.
 *
 * Static messages (typically system prompts) appear at the beginning and are
 * hashed to create a stable cache key. Dynamic messages (user/assistant
 * turns) form a separate hash that changes with conversation state.
 *
 * @param input - Prompt messages with optional model/profile context
 * @returns Partition result with cache keys and byte counts
 */
export declare function partitionPromptForCache(input: PromptPartitionInput): PromptPartitionResult;
/**
 * Service for tracking prompt partition cache usage.
 *
 * Records partition results and tracks reuse counts to measure cache
 * effectiveness. Used by the context compaction service to decide
 * when to evict cache entries.
 */
export declare class PromptPartitionCacheService {
    private readonly usage;
    /**
     * Records a prompt partition and returns usage statistics.
     * Increments reuse count if this partition was seen before.
     */
    record(input: PromptPartitionInput): PromptPartitionUsage;
    /**
     * Returns usage statistics for a specific partition key.
     */
    getUsage(dynamicCacheKey: string): PromptPartitionUsage | null;
    /**
     * Lists all tracked partition usage records sorted by key.
     */
    listUsage(): PromptPartitionUsage[];
    /**
     * Clears all tracked usage statistics.
     */
    clear(): void;
}
