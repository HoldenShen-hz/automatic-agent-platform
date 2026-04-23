/**
 * Memory Retrieval Service
 *
 * Provides full-text search capabilities for memories using SQLite FTS5.
 * Supports keyword-based retrieval with ranking and filtering.
 *
 * This service extends the base MemoryService with FTS5-powered search
 * for content matching and retrieval.
 *
 * ## FTS5 Virtual Table
 *
 * Uses a virtual FTS5 table (memories_fts) that stores:
 * - memory_id: Reference to the memory record
 * - content: Extracted searchable text from the memory
 * - content_rowid: Row ID for efficient JOINs
 *
 * ## Search Methods
 *
 * 1. searchMemories() - FTS5 query with BM25 ranking
 * 2. keywordSearchMemories() - LIKE-based fallback search
 * 3. retrieveMemories() - Combined, tries FTS first then falls back
 */
import type { MemoryRecord } from "../../contracts/types/domain.js";
import type { AuthoritativeTaskStore } from "../truth/authoritative-task-store.js";
import type { MemoryRecallQuery } from "./memory-quality.js";
export interface FtsQuery {
    query: string;
    limit?: number;
    offset?: number;
}
export interface FtsSearchResult {
    memory: MemoryRecord;
    rank: number;
    snippet: string | null;
}
export interface MemoryRetrievalOptions {
    ftsQuery?: FtsQuery | null;
    keywordQuery?: string | null;
    limit?: number;
    offset?: number;
}
/**
 * Builds an FTS5 MATCH query from raw text
 *
 * Converts a raw query string into an FTS5 query by:
 * 1. Tokenizing on non-alphanumeric characters
 * 2. Wrapping each term in quotes for exact phrase matching
 * 3. Joining with AND for all terms (all must match)
 *
 * Example: "hello world" -> `"hello" AND "world"`
 */
export declare function buildFtsMatchQuery(rawQuery: string): string;
/**
 * Extracts searchable text from a memory record's content_json
 *
 * For structured memory content (memory.v2), extracts:
 * - workContext
 * - topOfMind items
 * - recentHistory items
 * - longTermBackground items
 * - Fact contents
 *
 * For plain string content, returns the content directly.
 */
export declare function extractSearchableText(contentJson: string): string;
/**
 * Creates a highlight snippet for FTS results
 *
 * Extracts a window of text around the first matching term,
 * adjusted to avoid cutting words at boundaries.
 *
 * @param text - Full text to extract snippet from
 * @param queryTerms - Terms that matched (for finding highlight location)
 * @param maxLength - Maximum snippet length (default: 100)
 */
export declare function createSnippet(text: string, queryTerms: string[], maxLength?: number): string;
/**
 * Memory Retrieval Service
 *
 * Provides FTS5-based full-text search for memories.
 * Uses a virtual FTS5 table that is kept synchronized with the memories table.
 */
export declare class MemoryRetrievalService {
    private readonly store;
    private ftsInitialized;
    constructor(store: AuthoritativeTaskStore);
    /**
     * Initializes the FTS5 virtual table for memories
     *
     * Creates the virtual table if it doesn't exist.
     * If table is empty, populates it from existing memories.
     */
    initializeFts(): void;
    /**
     * Indexes a single memory for FTS search
     *
     * Replaces any existing index entry for this memory.
     */
    indexMemory(memoryId: string, content: string): void;
    /**
     * Indexes a memory record by extracting text from content_json
     */
    indexMemoryRecord(memory: MemoryRecord): void;
    /**
     * Removes a memory from the FTS index
     */
    unindexMemory(memoryId: string): void;
    /**
     * Searches memories using FTS5 query
     *
     * Uses BM25 ranking to order results by relevance.
     * Applies additional filters from memoryQuery after FTS matching.
     *
     * @param query - FTS query object with query string and pagination
     * @param memoryQuery - Additional filters to apply after FTS matching
     */
    searchMemories(query: FtsQuery, memoryQuery?: MemoryRecallQuery): FtsSearchResult[];
    /**
     * Reranks FTS search results using multiple signals
     *
     * Combines:
     * - BM25 rank (FTS5 score)
     * - Recency score (exponential decay with 7-day half-life)
     * - Importance score (from memory record)
     * - Access score (based on hit count)
     */
    private rerank;
    /**
     * Performs keyword search using LIKE (fallback when FTS is not available)
     *
     * This is less efficient than FTS but works without FTS5 support.
     * All terms must be found in the searchable text.
     */
    keywordSearchMemories(keyword: string, memoryQuery?: MemoryRecallQuery): MemoryRecord[];
    /**
     * Combined search that tries FTS first, falls back to keyword search
     *
     * Returns the method used and counts for each.
     */
    retrieveMemories(options: MemoryRetrievalOptions, query?: MemoryRecallQuery): {
        results: FtsSearchResult[];
        keywordResults: MemoryRecord[];
        method: "fts" | "keyword" | "none";
        totalFts: number;
        totalKeyword: number;
    };
    /**
     * Rebuilds the entire FTS index from memories table
     *
     * Use this to repair index corruption or after bulk operations.
     */
    rebuildIndex(): void;
}
