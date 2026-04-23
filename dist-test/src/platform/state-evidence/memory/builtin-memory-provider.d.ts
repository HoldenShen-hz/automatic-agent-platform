/**
 * Built-in Memory Provider
 *
 * Default memory provider implementation that combines:
 * - MemoryService for storage and recall
 * - MemoryRetrievalService for FTS-based search
 * - ExperienceCacheService for few-shot example retrieval
 *
 * ## Memory Augmentation Flow
 *
 * 1. Query comes in with task context and intent
 * 2. Memories are retrieved via FTS search or recall
 * 3. Similar experiences are found via ExperienceCacheService
 * 4. Both are rendered into a prompt block for injection
 *
 * ## Prompt Block Format
 *
 * Memories are summarized and formatted with scope labels.
 * Experiences are formatted as few-shot examples with:
 * - Intent: What the task was trying to achieve
 * - Context: Background information
 * - Approach: How tools were used and outcome
 * - Why matched: Keywords that caused the match
 */
import type { MemoryService } from "./memory-service.js";
import type { MemoryProvider, MemoryProviderInitializeResult, MemoryProviderPrefetchResult, MemoryProviderPromptBlock, MemoryProviderQuery, MemoryProviderShutdownResult, MemoryTurnSyncInput, MemoryTurnSyncResult, QueuedMemoryPrefetch } from "./memory-provider.js";
export interface BuiltInMemoryProviderOptions {
    providerId?: string;
}
/**
 * Built-in Memory Provider
 *
 * Provides complete memory augmentation for prompts including:
 * - Memory retrieval via FTS search
 * - Experience-based few-shot examples
 * - Synchronous and asynchronous prefetch modes
 */
export declare class BuiltInMemoryProvider implements MemoryProvider {
    private readonly memoryService;
    private readonly providerId;
    private readonly retrievalService;
    private readonly experienceCacheService;
    private readonly prefetchJobs;
    private initializedAt;
    constructor(memoryService: MemoryService, options?: BuiltInMemoryProviderOptions);
    /**
     * Initializes the provider - specifically initializes FTS indexing
     */
    initialize(): Promise<MemoryProviderInitializeResult>;
    /**
     * Generates a system prompt block with memories and examples
     * Combines initialization and prefetch in one call
     */
    systemPromptBlock(query: MemoryProviderQuery): Promise<MemoryProviderPromptBlock>;
    /**
     * Prefetches memory data for a query (synchronous)
     */
    prefetch(query: MemoryProviderQuery): Promise<MemoryProviderPrefetchResult>;
    /**
     * Queues a prefetch for asynchronous processing
     * Returns immediately with a request ID to await later
     */
    queuePrefetch(query: MemoryProviderQuery): Promise<QueuedMemoryPrefetch>;
    /**
     * Awaits a previously queued prefetch request
     */
    awaitQueuedPrefetch(requestId: string): Promise<MemoryProviderPrefetchResult | null>;
    /**
     * Synchronizes memories and experiences from a turn
     *
     * Called after turn execution to:
     * 1. Store new memories from the turn
     * 2. Index them for retrieval
     * 3. Record the experience for future few-shot use
     */
    syncTurn(input: MemoryTurnSyncInput): Promise<MemoryTurnSyncResult>;
    /**
     * Shuts down the provider, awaiting pending prefetches
     */
    shutdown(): Promise<MemoryProviderShutdownResult>;
    /**
     * Computes prefetch result - retrieves memories and experiences
     */
    private computePrefetch;
    /**
     * Selects memories that fit within a token budget.
     *
     * Iterates memories in order (highest ranked first) and accumulates
     * token estimates until the budget is exceeded. Uses `summarizeMemory`
     * to produce the text that would actually appear in the prompt,
     * giving an accurate token estimate.
     *
     * @param memories - Candidate memories (already ranked by retrieval)
     * @param tokenBudget - Maximum tokens to spend on memories
     */
    private selectMemoriesWithinBudget;
    /**
     * Selects few-shot examples that fit within a token budget.
     *
     * Iterates examples in order and accumulates token estimates until
     * the budget is exceeded.
     *
     * @param examples - Candidate examples (already ranked by relevance)
     * @param tokenBudget - Maximum tokens to spend on examples
     */
    private selectExamplesWithinBudget;
    /**
     * Resolves memories for a query using FTS or recall
     *
     * If queryText is provided, uses FTS search.
     * Otherwise, uses standard recall with filters.
     */
    private resolveMemories;
    /**
     * Resolves similar experiences for few-shot examples
     *
     * Returns empty if:
     * - includeExperienceExamples is false
     * - No task intent or query text
     * - No session ID (required for experience lookup)
     */
    private resolveExperiences;
}
