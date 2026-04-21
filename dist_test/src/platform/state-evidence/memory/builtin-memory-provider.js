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
import { nowIso, newId } from "../../contracts/types/ids.js";
import { parseStructuredMemoryContent } from "./memory-schema.js";
import { estimateTextTokens } from "../../model-gateway/messages/token-estimator.js";
import { ExperienceCacheService } from "./experience-cache-service.js";
import { MemoryRetrievalService } from "./memory-retrieval-service.js";
/**
 * Summarizes a memory record into a short string for display
 * Extracts key text from structured content, respecting token budget.
 *
 * @param record - Memory record to summarize
 * @param tokenBudget - Maximum tokens to spend on the summary (default 256)
 */
function summarizeMemory(record, tokenBudget = 256) {
    const structured = parseStructuredMemoryContent(record.contentJson);
    const fragments = [];
    let usedTokens = 0;
    // Helper to add a fragment if it fits in budget
    const tryAddFragment = (text) => {
        const tokens = estimateTextTokens(text);
        if (usedTokens + tokens > tokenBudget)
            return false;
        fragments.push(text);
        usedTokens += tokens;
        return true;
    };
    // Work context is primary
    if (structured.workContext) {
        tryAddFragment(structured.workContext);
    }
    // Top of mind items are secondary
    for (const item of structured.topOfMind) {
        if (!tryAddFragment(item))
            break;
    }
    // Recent history is tertiary
    for (const item of structured.recentHistory) {
        if (!tryAddFragment(item))
            break;
    }
    // Fall back to facts if nothing else available
    if (fragments.length === 0) {
        for (const fact of structured.facts) {
            if (!tryAddFragment(fact.content))
                break;
        }
    }
    const summary = fragments.join(" | ").trim();
    return summary.length > 0 ? summary : "structured memory entry";
}
/**
 * Renders memories and examples into a prompt block string
 *
 * Format:
 * Relevant memory:
 * - [scope] summary
 * ...
 *
 * Similar prior experience:
 * 1. Intent: ...
 *    Context: ...
 *    Approach: ...
 *    Tools: ...
 *    Why matched: ...
 */
function renderPromptBlock(memories, examples) {
    const lines = [];
    // Render memories section
    if (memories.length > 0) {
        lines.push("Relevant memory:");
        for (const memory of memories) {
            lines.push(`- [${memory.scope}] ${summarizeMemory(memory)}`);
        }
    }
    // Render examples section
    if (examples.length > 0) {
        if (lines.length > 0) {
            lines.push("");
        }
        lines.push("Similar prior experience:");
        examples.forEach((example, index) => {
            lines.push(`${index + 1}. Intent: ${example.taskIntent}`);
            lines.push(`   Context: ${example.taskContext}`);
            lines.push(`   Approach: ${example.approach}`);
            if (example.toolsUsed.length > 0) {
                lines.push(`   Tools: ${example.toolsUsed.join(", ")}`);
            }
            if (example.reasoning) {
                lines.push(`   Why matched: ${example.reasoning}`);
            }
        });
    }
    return lines.join("\n");
}
/**
 * Built-in Memory Provider
 *
 * Provides complete memory augmentation for prompts including:
 * - Memory retrieval via FTS search
 * - Experience-based few-shot examples
 * - Synchronous and asynchronous prefetch modes
 */
export class BuiltInMemoryProvider {
    memoryService;
    providerId;
    retrievalService;
    experienceCacheService;
    // Tracks in-flight prefetch jobs
    prefetchJobs = new Map();
    initializedAt = null;
    constructor(memoryService, options = {}) {
        this.memoryService = memoryService;
        this.providerId = options.providerId ?? "builtin-memory";
        const store = this.memoryService.getStore();
        this.retrievalService = new MemoryRetrievalService(store);
        this.experienceCacheService = new ExperienceCacheService(store);
    }
    /**
     * Initializes the provider - specifically initializes FTS indexing
     */
    async initialize() {
        if (this.initializedAt == null) {
            this.retrievalService.initializeFts();
            this.initializedAt = nowIso();
        }
        return {
            providerId: this.providerId,
            initializedAt: this.initializedAt,
            authoritativeSource: "builtin",
            augmentationMode: "authoritative",
        };
    }
    /**
     * Generates a system prompt block with memories and examples
     * Combines initialization and prefetch in one call
     */
    async systemPromptBlock(query) {
        const result = await this.prefetch(query);
        return {
            providerId: this.providerId,
            generatedAt: result.generatedAt,
            memoryIds: result.memories.map((memory) => memory.id),
            experienceIds: result.experienceIds,
            block: result.promptBlock,
        };
    }
    /**
     * Prefetches memory data for a query (synchronous)
     */
    async prefetch(query) {
        await this.initialize();
        return this.computePrefetch(query, false);
    }
    /**
     * Queues a prefetch for asynchronous processing
     * Returns immediately with a request ID to await later
     */
    async queuePrefetch(query) {
        await this.initialize();
        const requestId = newId("mpf");
        const queuedAt = nowIso();
        // Execute prefetch asynchronously
        const promise = Promise.resolve().then(async () => {
            const result = await this.computePrefetch(query, true, requestId);
            const job = this.prefetchJobs.get(requestId);
            if (job) {
                job.state = "completed";
            }
            return result;
        }).catch((error) => {
            const job = this.prefetchJobs.get(requestId);
            if (job) {
                job.state = "failed";
            }
            throw error;
        });
        // Track the job
        this.prefetchJobs.set(requestId, {
            requestId,
            queuedAt,
            state: "queued",
            promise,
        });
        return {
            providerId: this.providerId,
            requestId,
            queuedAt,
            state: "queued",
        };
    }
    /**
     * Awaits a previously queued prefetch request
     */
    async awaitQueuedPrefetch(requestId) {
        const job = this.prefetchJobs.get(requestId);
        if (job == null) {
            return null;
        }
        return job.promise;
    }
    /**
     * Synchronizes memories and experiences from a turn
     *
     * Called after turn execution to:
     * 1. Store new memories from the turn
     * 2. Index them for retrieval
     * 3. Record the experience for future few-shot use
     */
    async syncTurn(input) {
        await this.initialize();
        const syncedAt = nowIso();
        const rememberedMemoryIds = [];
        const rememberedMemories = [];
        // Store and index each memory
        for (const memoryInput of input.memories ?? []) {
            const remembered = this.memoryService.remember(memoryInput);
            rememberedMemoryIds.push(remembered.id);
            rememberedMemories.push(remembered);
            this.retrievalService.indexMemoryRecord(remembered);
        }
        // Record experience if provided
        let recordedExperienceId = null;
        if (input.experience != null) {
            const recorded = this.experienceCacheService.recordExperience(input.experience);
            recordedExperienceId = recorded.id;
        }
        return {
            providerId: this.providerId,
            syncedAt,
            rememberedMemoryIds,
            rememberedMemories,
            recordedExperienceId,
        };
    }
    /**
     * Shuts down the provider, awaiting pending prefetches
     */
    async shutdown() {
        // Wait for all pending prefetches to complete
        const jobs = Array.from(this.prefetchJobs.values());
        await Promise.allSettled(jobs.map((job) => job.promise));
        const pendingPrefetches = jobs.filter((job) => job.state === "queued").length;
        this.prefetchJobs.clear();
        return {
            providerId: this.providerId,
            shutdownAt: nowIso(),
            pendingPrefetches,
        };
    }
    /**
     * Computes prefetch result - retrieves memories and experiences
     */
    async computePrefetch(query, queued, forcedRequestId) {
        const requestId = forcedRequestId ?? newId("mpf");
        const generatedAt = nowIso();
        const memories = this.resolveMemories(query);
        const experienceResult = this.resolveExperiences(query);
        const maxFewShotExamples = Math.max(0, query.maxFewShotExamples ?? 2);
        // Use token-aware selection for memories and examples when tokenBudget is specified,
        // otherwise fall back to count-based selection via maxPromptMemories/maxFewShotExamples.
        // Allocate 70% of budget to memories, 30% to examples.
        const tokenBudget = query.tokenBudget ?? null;
        const selectedMemories = tokenBudget != null
            ? this.selectMemoriesWithinBudget(memories, Math.floor(tokenBudget * 0.7))
            : memories.slice(0, Math.max(0, query.maxPromptMemories ?? 5));
        const exampleBudget = tokenBudget != null
            ? Math.floor(tokenBudget * 0.3)
            : null;
        const selectedExamples = exampleBudget != null
            ? this.selectExamplesWithinBudget(experienceResult.examples, exampleBudget)
            : experienceResult.examples.slice(0, maxFewShotExamples);
        // Trim selected examples to maxFewShotExamples count if using token budget
        const examplesToUse = selectedExamples.slice(0, maxFewShotExamples);
        const experienceIdsToUse = experienceResult.hitAudit.experienceIds.slice(0, examplesToUse.length);
        const promptBlock = renderPromptBlock(selectedMemories, examplesToUse);
        return {
            providerId: this.providerId,
            requestId,
            generatedAt,
            degraded: false,
            queued,
            query,
            memories: selectedMemories,
            fewShotExamples: examplesToUse,
            experienceIds: experienceIdsToUse,
            promptBlock,
        };
    }
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
    selectMemoriesWithinBudget(memories, tokenBudget) {
        const selected = [];
        let usedTokens = 0;
        for (const mem of memories) {
            const summary = summarizeMemory(mem, tokenBudget - usedTokens);
            const summaryTokens = estimateTextTokens(summary);
            if (usedTokens + summaryTokens > tokenBudget) {
                break;
            }
            selected.push(mem);
            usedTokens += summaryTokens;
        }
        return selected;
    }
    /**
     * Selects few-shot examples that fit within a token budget.
     *
     * Iterates examples in order and accumulates token estimates until
     * the budget is exceeded.
     *
     * @param examples - Candidate examples (already ranked by relevance)
     * @param tokenBudget - Maximum tokens to spend on examples
     */
    selectExamplesWithinBudget(examples, tokenBudget) {
        const selected = [];
        let usedTokens = 0;
        for (const example of examples) {
            const text = [
                example.taskIntent,
                example.taskContext,
                example.approach,
                example.toolsUsed.join(" "),
                example.reasoning ?? "",
            ].join(" ");
            const tokens = estimateTextTokens(text);
            if (usedTokens + tokens > tokenBudget) {
                break;
            }
            selected.push(example);
            usedTokens += tokens;
        }
        return selected;
    }
    /**
     * Resolves memories for a query using FTS or recall
     *
     * If queryText is provided, uses FTS search.
     * Otherwise, uses standard recall with filters.
     */
    resolveMemories(query) {
        if (query.queryText && query.queryText.trim().length > 0) {
            // Build recall query from provider query
            const memoryQuery = {};
            if (query.taskId != null)
                memoryQuery.taskId = query.taskId;
            if (query.sessionId != null)
                memoryQuery.sessionId = query.sessionId;
            if (query.agentId != null)
                memoryQuery.agentId = query.agentId;
            if (query.executionId != null)
                memoryQuery.executionId = query.executionId;
            if (query.scopes != null)
                memoryQuery.scopes = query.scopes;
            if (query.memoryLayers != null)
                memoryQuery.memoryLayers = query.memoryLayers;
            if (query.classifications != null)
                memoryQuery.classifications = query.classifications;
            if (query.sourceTrustLevels != null)
                memoryQuery.sourceTrustLevels = query.sourceTrustLevels;
            if (query.minQualityScore != null)
                memoryQuery.minQualityScore = query.minQualityScore;
            if (query.limit != null)
                memoryQuery.limit = query.limit;
            if (query.evaluatedAt != null)
                memoryQuery.evaluatedAt = query.evaluatedAt;
            // Use FTS search for text queries
            return this.retrievalService
                .searchMemories({
                query: query.queryText,
                limit: query.limit ?? 8,
            }, memoryQuery)
                .map((result) => result.memory);
        }
        // Use recall without FTS for scope-only queries
        return this.memoryService.recall({
            ...query,
            includeExpired: false,
            includeRevoked: false,
        });
    }
    /**
     * Resolves similar experiences for few-shot examples
     *
     * Returns empty if:
     * - includeExperienceExamples is false
     * - No task intent or query text
     * - No session ID (required for experience lookup)
     */
    resolveExperiences(query) {
        if (query.includeExperienceExamples === false
            || (!query.taskIntent && !query.queryText)
            || query.sessionId == null) {
            return {
                examples: [],
                totalAvailable: 0,
                hitAudit: {
                    sessionId: query.sessionId ?? "unknown-session",
                    queriedAt: nowIso(),
                    queryContext: query.queryText ?? query.taskIntent ?? "",
                    hitsFound: 0,
                    examplesUsed: 0,
                    experienceIds: [],
                },
            };
        }
        // Build experience query
        const experienceQuery = {
            sessionId: query.sessionId,
            limit: Math.max(1, query.maxFewShotExamples ?? 2),
            minQualityScore: query.minQualityScore ?? 0.6,
        };
        if (query.queryText ?? query.taskIntent) {
            experienceQuery.taskContext = query.queryText ?? query.taskIntent ?? "";
        }
        if (query.taskIntent ?? query.queryText) {
            experienceQuery.taskIntent = query.taskIntent ?? query.queryText ?? "";
        }
        if (query.toolNames != null) {
            experienceQuery.toolNames = query.toolNames;
        }
        const result = this.experienceCacheService.retrieveForFewShot(experienceQuery, query.sessionId);
        // Extract examples and IDs
        const filteredExamples = [];
        const filteredExperienceIds = [];
        result.examples.forEach((example, index) => {
            const experienceId = result.hitAudit.experienceIds[index];
            if (experienceId == null) {
                return;
            }
            filteredExamples.push(example);
            filteredExperienceIds.push(experienceId);
        });
        return {
            examples: filteredExamples,
            totalAvailable: filteredExamples.length,
            hitAudit: {
                ...result.hitAudit,
                experienceIds: filteredExperienceIds,
                hitsFound: filteredExamples.length,
                examplesUsed: filteredExamples.length,
            },
        };
    }
}
//# sourceMappingURL=builtin-memory-provider.js.map