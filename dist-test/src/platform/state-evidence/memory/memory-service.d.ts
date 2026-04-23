/**
 * Memory Service
 *
 * Core service for storing, retrieving, and managing memories.
 *
 * ## Memory Lifecycle
 *
 * 1. remember() - Store new memory with structured content
 * 2. recall() - Retrieve memories matching query criteria
 * 3. revoke() - Invalidate a memory with a reason
 *
 * ## Memory Layers
 *
 * Memories are categorized into layers:
 * - layer_3: Short-term, operational memories
 * - layer_4: Medium-term, consolidated memories
 * - layer_5: Long-term, summary memories
 *
 * ## Consolidation
 *
 * Multiple layer_3 memories can be consolidated into a single
 * layer_4/5 memory via consolidate(), which:
 * - Summarizes content from source memories
 * - Creates a new memory with aggregated provenance
 * - Optionally revokes the source memories
 */
import type { MemoryKind, MemoryRecord, MemorySourceTrustLevel } from "../../contracts/types/domain.js";
import type { AuthoritativeTaskStore } from "../truth/authoritative-task-store.js";
import { type StructuredMemoryContent } from "./memory-schema.js";
import { type MemoryQualityReport, type MemoryRecallQuery } from "./memory-quality.js";
/**
 * Input for creating a memory via remember()
 */
export interface RememberMemoryInput {
    taskId?: string | null;
    sessionId?: string | null;
    agentId?: string | null;
    executionId?: string | null;
    memoryLayer?: MemoryRecord["memoryLayer"];
    scope: string;
    content: string | Record<string, unknown> | StructuredMemoryContent;
    classification?: string;
    sourceTrustLevel?: MemorySourceTrustLevel;
    qualityScore?: number | null;
    kind?: MemoryKind;
    createdAt?: string;
    expiresAt?: string | null;
}
/**
 * Input for recording a failure as a memory
 */
export interface FailureMemoryInput {
    taskId: string;
    executionId: string;
    agentId: string | null;
    reasonCode: string;
    errorMessage: string | null;
    occurredAt?: string;
    scope?: string;
}
/**
 * Input for consolidating multiple memories into a higher layer
 */
export interface ConsolidateMemoriesInput {
    taskId?: string;
    sessionId?: string;
    agentId?: string;
    executionId?: string;
    scopes?: string[];
    classifications?: string[];
    sourceTrustLevels?: MemorySourceTrustLevel[];
    evaluatedAt?: string;
    olderThanCreatedAt?: string;
    minSourceMemories?: number;
    maxSourceMemories?: number;
    targetMemoryLayer?: Exclude<MemoryRecord["memoryLayer"], "layer_3">;
    revokeSourceMemories?: boolean;
}
/**
 * Result of a consolidation operation
 */
export interface ConsolidateMemoriesResult {
    consolidated: boolean;
    createdMemory: MemoryRecord | null;
    sourceMemoryIds: string[];
    skippedReason: "insufficient_source_memories" | null;
}
/**
 * Memory Service - manages memory storage, retrieval, and consolidation
 */
export declare class MemoryService {
    private readonly store;
    constructor(store: AuthoritativeTaskStore);
    private static readonly MAX_CONTENT_SIZE_BYTES;
    getStore(): AuthoritativeTaskStore;
    /**
     * Stores a new memory
     *
     * Content is normalized to structured format (memory.v2).
     * Memory is assigned a unique ID and stored with the current timestamp.
     *
     * @throws MemoryError if content exceeds size limit
     */
    remember(input: RememberMemoryInput): MemoryRecord;
    /**
     * Recalls memories matching query criteria
     *
     * Memories are filtered by:
     * - taskId, sessionId, agentId, executionId (scope)
     * - scopes, memoryLayers, classifications
     * - sourceTrustLevels
     * - minQualityScore
     * - includeExpired, includeRevoked flags
     *
     * Results are sorted by createdAt descending.
     * Hit count and lastAccessedAt are updated for returned memories.
     */
    recall(query?: MemoryRecallQuery): MemoryRecord[];
    /**
     * Revokes a memory, marking it as invalid
     *
     * Revoked memories can still be retrieved with includeRevoked: true
     * but are excluded from normal recall by default.
     */
    revoke(memoryId: string, reason: string, revokedAt?: string): MemoryRecord | null;
    /**
     * Generates a quality report for memories matching query
     *
     * Report includes:
     * - Total/active/expired/revoked counts
     * - Average quality score
     * - Breakdown by scope, layer, and classification
     * - Recall statistics (how many have been accessed)
     */
    getQualityReport(query?: Omit<MemoryRecallQuery, "includeExpired" | "includeRevoked">): MemoryQualityReport;
    /**
     * Records a failure as a memory
     *
     * Creates a structured memory with:
     * - workContext: "Execution {executionId} failure"
     * - topOfMind: "Task {taskId} failed"
     * - recentHistory: error message if provided
     * - facts: reasonCode and errorMessage with high confidence
     */
    recordFailureMemory(input: FailureMemoryInput): MemoryRecord;
    /**
     * Consolidates multiple memories into a higher layer memory
     *
     * Requirements:
     * - Must have explicit memory boundary (taskId, sessionId, etc.)
     * - Must have at least minSourceMemories (default: 3)
     * - All source memories must have the same scope
     *
     * Process:
     * 1. Collect candidate memories from layer_3
     * 2. Build consolidation summary (dedupe facts, aggregate provenance)
     * 3. Create new memory in target layer
     * 4. Optionally revoke source memories
     */
    consolidate(input: ConsolidateMemoriesInput): ConsolidateMemoriesResult;
}
