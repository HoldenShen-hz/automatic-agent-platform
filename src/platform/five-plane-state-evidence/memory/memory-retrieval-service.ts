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
import { nowIso } from "../../contracts/types/ids.js";
import type { AuthoritativeTaskStore } from "../truth/authoritative-task-store.js";
import type { MemoryRecallQuery } from "./memory-quality.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const memoryRetrievalLogger = new StructuredLogger({ retentionLimit: 100 });

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

interface FtsMemoryRow {
  rank: number;
  memory: MemoryRecord;
}

function readMemoryRecord(row: Record<string, unknown>): MemoryRecord {
  return {
    id: String(row.id ?? ""),
    taskId: typeof row.taskId === "string" ? row.taskId : null,
    sessionId: typeof row.sessionId === "string" ? row.sessionId : null,
    agentId: typeof row.agentId === "string" ? row.agentId : null,
    executionId: typeof row.executionId === "string" ? row.executionId : null,
    memoryLayer: String(row.memoryLayer ?? "") as MemoryRecord["memoryLayer"],
    scope: String(row.scope ?? ""),
    contentJson: String(row.contentJson ?? ""),
    classification: String(row.classification ?? ""),
    sourceTrustLevel: String(row.sourceTrustLevel ?? "") as MemoryRecord["sourceTrustLevel"],
    qualityScore: typeof row.qualityScore === "number" ? row.qualityScore : null,
    hitCount: Number(row.hitCount ?? 0),
    createdAt: String(row.createdAt ?? ""),
    lastAccessedAt: typeof row.lastAccessedAt === "string" ? row.lastAccessedAt : null,
    expiresAt: typeof row.expiresAt === "string" ? row.expiresAt : null,
    revokedAt: typeof row.revokedAt === "string" ? row.revokedAt : null,
    revocationReason: typeof row.revocationReason === "string" ? row.revocationReason : null,
    kind: String(row.kind ?? "") as MemoryRecord["kind"],
    status: String(row.status ?? "") as MemoryRecord["status"],
    importanceScore: typeof row.importanceScore === "number" ? row.importanceScore : null,
    freshnessScore: typeof row.freshnessScore === "number" ? row.freshnessScore : null,
    contentHash: typeof row.contentHash === "string" ? row.contentHash : null,
  };
}

function readFtsMemoryRows(rows: readonly Record<string, unknown>[]): FtsMemoryRow[] {
  return rows.map((row) => ({
    rank: Number(row.rank ?? 0),
    memory: readMemoryRecord(row),
  }));
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
export function buildFtsMatchQuery(rawQuery: string): string {
  const normalizedTerms = rawQuery
    .split(/[^\p{L}\p{N}_]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length > 0);

  if (normalizedTerms.length === 0) {
    return "\"\"";
  }

  return normalizedTerms
    .map((term) => `"${term.replace(/"/g, "\"\"")}"`)
    .join(" AND ");
}

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
export function extractSearchableText(contentJson: string): string {
  // If the content is a plain string (not JSON), return it directly
  const trimmed = contentJson.trim();
  if (!trimmed.startsWith("{")) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(contentJson);
    const texts: string[] = [];

    // Extract from structured memory content
    if (typeof parsed === "object" && parsed !== null) {
      // Top-level string fields
      if (parsed.workContext && typeof parsed.workContext === "string") {
        texts.push(parsed.workContext);
      }
      if (parsed.topOfMind && Array.isArray(parsed.topOfMind)) {
        texts.push(...parsed.topOfMind.filter((t: unknown) => typeof t === "string"));
      }
      if (parsed.recentHistory && Array.isArray(parsed.recentHistory)) {
        texts.push(...parsed.recentHistory.filter((t: unknown) => typeof t === "string"));
      }
      if (parsed.longTermBackground && Array.isArray(parsed.longTermBackground)) {
        texts.push(...parsed.longTermBackground.filter((t: unknown) => typeof t === "string"));
      }
      if (parsed.facts && Array.isArray(parsed.facts)) {
        for (const fact of parsed.facts) {
          if (typeof fact === "object" && fact !== null) {
            if (typeof (fact as Record<string, unknown>).content === "string") {
              texts.push((fact as Record<string, unknown>).content as string);
            }
          }
        }
      }
    }

    // If no structured content, treat the whole JSON as text
    if (texts.length === 0 && typeof parsed === "string") {
      texts.push(parsed);
    }

    return texts.join(" ");
  } catch (err) {
    memoryRetrievalLogger.warn("memory_retrieval: JSON.parse failed in extractSearchableText", { error: err instanceof Error ? err.message : String(err), contentJsonLength: contentJson.length });
    // If parsing fails, return empty string
    return "";
  }
}

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
export function createSnippet(text: string, queryTerms: string[], maxLength: number = 100): string {
  const lowerText = text.toLowerCase();
  const firstMatchIndex = queryTerms.findIndex(term => lowerText.includes(term.toLowerCase()));

  let snippet: string;
  let start = 0;
  let end = text.length;

  // No match - just truncate to maxLength
  if (firstMatchIndex === -1) {
    if (text.length <= maxLength) {
      return text;
    }
    snippet = text.slice(0, maxLength);
    return snippet + "...";
  }

  const matchTerm = queryTerms[firstMatchIndex];
  if (matchTerm === undefined) {
    if (text.length <= maxLength) {
      return text;
    }
    return text.slice(0, maxLength) + "...";
  }

  const matchIndex = lowerText.indexOf(matchTerm.toLowerCase());

  // Find a window around the match that fits within maxLength
  // Prioritize keeping the match visible
  const halfWindow = Math.floor(maxLength / 2);
  start = Math.max(0, matchIndex - halfWindow);
  end = Math.min(text.length, matchIndex + matchTerm.length + halfWindow);

  // If the window is larger than maxLength, adjust
  if (end - start > maxLength) {
    if (matchIndex - start < end - matchIndex) {
      // Match is closer to start
      end = Math.min(text.length, start + maxLength);
    } else {
      // Match is closer to end
      start = Math.max(0, end - maxLength);
    }
  }

  // Adjust to avoid cutting words at boundaries
  if (start > 0) {
    const spaceIndex = text.lastIndexOf(" ", start);
    if (spaceIndex !== -1 && spaceIndex >= start - 10) {
      start = spaceIndex + 1;
    }
  }
  if (end < text.length) {
    const spaceIndex = text.indexOf(" ", end);
    if (spaceIndex !== -1 && spaceIndex <= end + 10) {
      end = spaceIndex;
    }
  }

  snippet = text.slice(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";

  return snippet;
}

/**
 * Memory Retrieval Service
 *
 * Provides FTS5-based full-text search for memories.
 * Uses a virtual FTS5 table that is kept synchronized with the memories table.
 */
export class MemoryRetrievalService {
  private ftsInitialized: boolean = false;

  public constructor(private readonly store: AuthoritativeTaskStore) {}

  /**
   * Initializes the FTS5 virtual table for memories
   *
   * Creates the virtual table if it doesn't exist.
   * If table is empty, populates it from existing memories.
   */
  public initializeFts(): void {
    if (this.ftsInitialized) {
      return;
    }

    const count = this.store.withConnection((connection) => {
      connection.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
          memory_id,
          content,
          content_rowid UNINDEXED
        );
      `);

      const countRow = connection.prepare("SELECT COUNT(*) as count FROM memories_fts").get() as
        | { count: number }
        | undefined;
      return countRow?.count ?? 0;
    });

    // Populate FTS from existing memories if table is empty
    if (count === 0) {
      const memories = this.store.memory.listMemories({});
      for (const memory of memories) {
        const searchableText = extractSearchableText(memory.contentJson);
        if (searchableText.length > 0) {
          this.indexMemory(memory.id, searchableText);
        }
      }
    }

    this.ftsInitialized = true;
  }

  /**
   * Indexes a single memory for FTS search
   *
   * Replaces any existing index entry for this memory.
   */
  public indexMemory(memoryId: string, content: string): void {
    this.store.withConnection((connection) => {
      connection.prepare("DELETE FROM memories_fts WHERE memory_id = ?").run(memoryId);
      connection.prepare("INSERT INTO memories_fts(memory_id, content) VALUES (?, ?)").run(memoryId, content);
    });
  }

  /**
   * Indexes a memory record by extracting text from content_json
   */
  public indexMemoryRecord(memory: MemoryRecord): void {
    const searchableText = extractSearchableText(memory.contentJson);
    this.indexMemory(memory.id, searchableText);
  }

  /**
   * Removes a memory from the FTS index
   */
  public unindexMemory(memoryId: string): void {
    // Ensure FTS table exists before attempting DELETE
    this.initializeFts();
    this.store.withConnection((connection) => {
      connection.prepare("DELETE FROM memories_fts WHERE memory_id = ?").run(memoryId);
    });
  }

  /**
   * Searches memories using FTS5 query
   *
   * Uses BM25 ranking to order results by relevance.
   * Applies additional filters from memoryQuery after FTS matching.
   *
   * @param query - FTS query object with query string and pagination
   * @param memoryQuery - Additional filters to apply after FTS matching
   */
  public searchMemories(query: FtsQuery, memoryQuery: MemoryRecallQuery = {}): FtsSearchResult[] {
    this.initializeFts();

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    // Parse query terms for snippet generation
    const queryTerms = query.query
      .split(/[^\p{L}\p{N}_]+/u)
      .map((term) => term.trim())
      .filter((term) => term.length > 0);
    const ftsMatchQuery = buildFtsMatchQuery(query.query);

    // Build the FTS query with ranking using BM25
    const ftsSql = `
      SELECT
        m.id,
        m.task_id AS taskId,
        m.session_id AS sessionId,
        m.agent_id AS agentId,
        m.execution_id AS executionId,
        m.memory_layer AS memoryLayer,
        m.scope,
        m.content_json AS contentJson,
        m.classification,
        m.source_trust_level AS sourceTrustLevel,
        m.quality_score AS qualityScore,
        m.hit_count AS hitCount,
        m.created_at AS createdAt,
        m.last_accessed_at AS lastAccessedAt,
        m.expires_at AS expiresAt,
        m.revoked_at AS revokedAt,
        m.revocation_reason AS revocationReason,
        m.kind,
        m.status,
        m.importance_score AS importanceScore,
        m.freshness_score AS freshnessScore,
        m.content_hash AS contentHash,
        bm25(memories_fts) AS rank
      FROM memories m
      JOIN memories_fts ON m.id = memories_fts.memory_id
      WHERE memories_fts MATCH ?
      ORDER BY rank
      LIMIT ? OFFSET ?
    `;

    // Execute FTS query
    const rows = this.store.withConnection((connection) =>
      connection.prepare(ftsSql).all(ftsMatchQuery, String(limit), String(offset)) as Record<string, unknown>[],
    );
    const ftsRows = readFtsMemoryRows(rows);

    // Map results and generate snippets
    let results: FtsSearchResult[] = ftsRows.map(row => {
      const memory = row.memory;
      const searchableText = extractSearchableText(memory.contentJson);
      const snippet = createSnippet(searchableText, queryTerms);

      return {
        memory,
        rank: row.rank,
        snippet,
      };
    });

    // Apply additional filters from memoryQuery
    // Note: These are applied after FTS to allow FTS to use full-text ranking
    if (memoryQuery.taskId != null) {
      results = results.filter(r => r.memory.taskId === memoryQuery.taskId);
    }
    if (memoryQuery.sessionId != null) {
      results = results.filter(r => r.memory.sessionId === memoryQuery.sessionId);
    }
    if (memoryQuery.agentId != null) {
      results = results.filter(r => r.memory.agentId === memoryQuery.agentId);
    }
    if (memoryQuery.scopes != null && memoryQuery.scopes.length > 0) {
      results = results.filter(r => memoryQuery.scopes!.includes(r.memory.scope));
    }
    if (memoryQuery.memoryLayers != null && memoryQuery.memoryLayers.length > 0) {
      results = results.filter(r => memoryQuery.memoryLayers!.includes(r.memory.memoryLayer));
    }
    if (memoryQuery.classifications != null && memoryQuery.classifications.length > 0) {
      results = results.filter(r => memoryQuery.classifications!.includes(r.memory.classification));
    }

    // Apply multi-signal reranking: BM25 + recency + importance + access
    results = this.rerank(results);

    return results;
  }

  /**
   * Reranks FTS search results using multiple signals
   *
   * Combines:
   * - BM25 rank (FTS5 score)
   * - Recency score (exponential decay with 7-day half-life)
   * - Importance score (from memory record)
   * - Access score (based on hit count)
   */
  private rerank(results: FtsSearchResult[]): FtsSearchResult[] {
    const now = Date.now();
    const halfLifeMs = 7 * 24 * 60 * 60 * 1000; // 7 days

    return results
      .map((r) => {
        const bm25Score = Math.abs(r.rank); // BM25 is negative, take absolute
        const ageMs = now - new Date(r.memory.createdAt).getTime();
        const recencyScore = Math.exp(-ageMs / halfLifeMs);
        const importanceScore = r.memory.importanceScore ?? 0.5;
        const accessScore = Math.min(1.0, (r.memory.hitCount ?? 0) / 10);

        // Weights: 40% BM25, 30% recency, 20% importance, 10% access
        const combined = 0.4 * bm25Score + 0.3 * recencyScore + 0.2 * importanceScore + 0.1 * accessScore;

        return { result: r, score: combined };
      })
      .filter((r) => r.score >= 0.1) // Minimum threshold
      .sort((a, b) => b.score - a.score)
      .map((r) => r.result);
  }

  /**
   * Performs keyword search using LIKE (fallback when FTS is not available)
   *
   * This is less efficient than FTS but works without FTS5 support.
   * All terms must be found in the searchable text.
   */
  public keywordSearchMemories(keyword: string, memoryQuery: MemoryRecallQuery = {}): MemoryRecord[] {
    const evaluatedAt = memoryQuery.evaluatedAt ?? nowIso();
    const memories = this.store.memory.listMemories({ ...memoryQuery, evaluatedAt });

    const queryTerms = keyword.trim().split(/\s+/).filter(t => t.length > 0);

    return memories.filter(memory => {
      const searchableText = extractSearchableText(memory.contentJson).toLowerCase();
      return queryTerms.every(term => searchableText.includes(term.toLowerCase()));
    });
  }

  /**
   * Combined search that tries FTS first, falls back to keyword search
   *
   * Returns the method used and counts for each.
   */
  public retrieveMemories(options: MemoryRetrievalOptions, query: MemoryRecallQuery = {}): {
    results: FtsSearchResult[];
    keywordResults: MemoryRecord[];
    method: "fts" | "keyword" | "none";
    totalFts: number;
    totalKeyword: number;
  } {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    if (options.ftsQuery) {
      const ftsResults = this.searchMemories(options.ftsQuery, query);
      return {
        results: ftsResults,
        keywordResults: [],
        method: "fts",
        totalFts: ftsResults.length,
        totalKeyword: 0,
      };
    }

    if (options.keywordQuery) {
      const keywordResults = this.keywordSearchMemories(options.keywordQuery, query);
      return {
        results: [],
        keywordResults: keywordResults.slice(offset, offset + limit),
        method: "keyword",
        totalFts: 0,
        totalKeyword: keywordResults.length,
      };
    }

    return {
      results: [],
      keywordResults: [],
      method: "none",
      totalFts: 0,
      totalKeyword: 0,
    };
  }

  /**
   * Rebuilds the entire FTS index from memories table
   *
   * Use this to repair index corruption or after bulk operations.
   */
  public rebuildIndex(): void {
    this.store.withConnection((connection) => {
      connection.exec("DELETE FROM memories_fts");
    });

    // Repopulate from memories table
    const memories = this.store.memory.listMemories({});
    for (const memory of memories) {
      this.indexMemoryRecord(memory);
    }
  }
}
