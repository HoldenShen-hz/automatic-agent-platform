/**
 * Experience Cache Service
 *
 * Provides experience caching and few-shot reuse for similar task execution.
 * Stores task execution experiences and retrieves relevant ones for new tasks
 * to be used as few-shot examples.
 *
 * Features:
 * - Experience storage with outcome tracking
 * - Similarity-based experience retrieval
 * - Few-shot example formatting
 * - Hit audit logging
 */
import type { AuthoritativeTaskStore } from "../truth/authoritative-task-store.js";
/**
 * Represents a single tool execution within an experience
 */
export interface ExperienceToolCall {
    toolName: string;
    callId: string;
    status: "succeeded" | "failed" | "blocked" | "cancelled";
    durationMs: number;
    errorCode?: string;
}
/**
 * Represents a stored task execution experience
 */
export interface ExperienceRecord {
    id: string;
    taskId: string;
    sessionId: string;
    agentId: string;
    executionId: string;
    taskContext: string;
    taskIntent: string;
    toolsUsed: readonly ExperienceToolCall[];
    outcome: "succeeded" | "failed" | "partial";
    finalErrorCode: string | null;
    qualityScore: number;
    createdAt: string;
    hitCount: number;
    lastAccessedAt: string;
}
/**
 * Input for recording a new experience
 */
export interface RecordExperienceInput {
    taskId: string;
    sessionId: string;
    agentId: string;
    executionId: string;
    taskContext: string;
    taskIntent: string;
    toolsUsed: readonly ExperienceToolCall[];
    outcome: "succeeded" | "failed" | "partial";
    finalErrorCode: string | null;
    qualityScore: number;
}
/**
 * Query for finding similar experiences
 */
export interface SimilarExperienceQuery {
    sessionId?: string;
    taskContext?: string;
    taskIntent?: string;
    toolNames?: readonly string[];
    outcome?: ExperienceRecord["outcome"];
    minQualityScore?: number;
    limit?: number;
}
/**
 * Result of retrieving similar experiences
 */
export interface SimilarExperience {
    experience: ExperienceRecord;
    similarityScore: number;
    matchedKeywords: string[];
}
/**
 * Few-shot example for injection
 */
export interface FewShotExample {
    taskContext: string;
    taskIntent: string;
    approach: string;
    toolsUsed: string[];
    outcome: "succeeded" | "failed" | "partial";
    reasoning: string | null;
}
/**
 * Result of experience retrieval
 */
export interface ExperienceRetrievalResult {
    examples: FewShotExample[];
    totalAvailable: number;
    hitAudit: ExperienceHitAudit;
}
/**
 * Audit record for cache hits
 */
export interface ExperienceHitAudit {
    sessionId: string;
    queriedAt: string;
    queryContext: string;
    hitsFound: number;
    examplesUsed: number;
    experienceIds: string[];
}
/**
 * Computes keyword-based similarity between two text strings using Jaccard index
 * @param text1 - First text string
 * @param text2 - Second text string
 * @returns Object with score (0-1) and matched keywords array
 */
export declare function computeKeywordSimilarity(text1: string, text2: string): {
    score: number;
    matchedKeywords: string[];
};
/**
 * Computes tool overlap ratio between experience tools and query tools
 * @param experienceTools - Tools used in a past experience
 * @param queryTools - Tools referenced in current query
 * @returns Overlap ratio from 0 to 1
 */
export declare function computeToolOverlap(experienceTools: readonly string[], queryTools: readonly string[]): number;
export declare class ExperienceCacheService {
    private readonly store;
    private readonly defaultMaxAgeMs;
    private readonly defaultMaxEntries;
    constructor(store: AuthoritativeTaskStore, options?: {
        maxAgeMs?: number;
        maxEntries?: number;
    });
    /**
     * Evicts stale experiences based on last-accessed time (TTL).
     *
     * Removes entries whose `last_accessed_at` is older than `maxAgeMs`.
     * Uses `last_accessed_at` rather than `created_at` so that frequently
     * accessed entries are preserved even if old.
     *
     * @returns Number of rows deleted
     */
    evictStaleExperiences(maxAgeMs?: number): number;
    /**
     * Evicts experiences by capacity, removing lowest-quality / least-recently
     * entries until the cache is within `maxEntries`.
     *
     * Ordering: quality_score ASC, last_accessed_at ASC (worst/oldest first).
     * Keeps the highest-quality, most-recently-accessed entries.
     *
     * @returns Number of rows deleted
     */
    evictByCapacity(maxEntries?: number): number;
    /**
     * Records a new task execution experience
     */
    recordExperience(input: RecordExperienceInput): ExperienceRecord;
    /**
     * Finds similar experiences based on task context and tools
     */
    findSimilarExperiences(query: SimilarExperienceQuery): SimilarExperience[];
    /**
     * Retrieves experiences and formats them as few-shot examples
     */
    retrieveForFewShot(query: SimilarExperienceQuery, sessionId: string): ExperienceRetrievalResult;
    /**
     * Increments the hit count for an experience
     */
    private incrementHitCount;
    /**
     * Gets experience statistics
     */
    getStatistics(): {
        totalExperiences: number;
        successfulExperiences: number;
        failedExperiences: number;
        averageQualityScore: number;
        totalHits: number;
    };
    /**
     * Clears all experiences (for testing)
     */
    clearAll(): void;
}
/**
 * Manager for experience cache services per session
 */
export declare class ExperienceCacheManager {
    private services;
    /**
     * Gets or creates an experience cache service for a session
     */
    getService(sessionId: string, store: AuthoritativeTaskStore): ExperienceCacheService;
    /**
     * Removes a session's cache service
     */
    removeService(sessionId: string): void;
    /**
     * Clears all session services
     */
    clearAll(): void;
}
