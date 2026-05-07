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

import { newId, nowIso } from "../../contracts/types/ids.js";
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

interface StoredExperience {
  id: string;
  task_id: string;
  session_id: string;
  agent_id: string;
  execution_id: string;
  task_context: string;
  task_intent: string;
  tools_used_json: string;
  outcome: string;
  final_error_code: string | null;
  quality_score: number;
  created_at: string;
  hit_count: number;
  last_accessed_at: string;
}

/**
 * Computes keyword-based similarity between two text strings using Jaccard index
 * @param text1 - First text string
 * @param text2 - Second text string
 * @returns Object with score (0-1) and matched keywords array
 */
export function computeKeywordSimilarity(text1: string, text2: string): { score: number; matchedKeywords: string[] } {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter((w) => w.length > 2));

  words1.delete("the");
  words1.delete("and");
  words1.delete("for");
  words1.delete("are");
  words1.delete("but");
  words1.delete("not");
  words1.delete("you");
  words1.delete("all");
  words1.delete("can");
  words1.delete("her");
  words1.delete("was");
  words1.delete("one");
  words1.delete("our");
  words1.delete("out");
  words1.delete("this");
  words1.delete("that");
  words1.delete("with");
  words1.delete("have");
  words1.delete("from");
  words1.delete("they");
  words1.delete("will");
  words1.delete("would");
  words1.delete("there");
  words1.delete("their");
  words1.delete("what");
  words1.delete("been");

  const matchedKeywords: string[] = [];
  for (const word of words1) {
    if (words2.has(word)) {
      matchedKeywords.push(word);
    }
  }

  if (words1.size === 0 || words2.size === 0) {
    return { score: 0, matchedKeywords: [] };
  }

  const intersection = matchedKeywords.length;
  const union = new Set([...words1, ...words2]).size;
  const jaccardSimilarity = union > 0 ? intersection / union : 0;

  // Also compute length-based similarity
  const lengthSimilarity = 1 - Math.min(Math.abs(text1.length - text2.length) / Math.max(text1.length, text2.length), 1);

  // Combined score: Jaccard + length similarity weighted
  const combinedScore = jaccardSimilarity * 0.7 + lengthSimilarity * 0.3;
  return { score: combinedScore, matchedKeywords };
}

/**
 * Computes tool overlap ratio between experience tools and query tools
 * @param experienceTools - Tools used in a past experience
 * @param queryTools - Tools referenced in current query
 * @returns Overlap ratio from 0 to 1
 */
export function computeToolOverlap(experienceTools: readonly string[], queryTools: readonly string[]): number {
  if (experienceTools.length === 0 || queryTools.length === 0) {
    return 0;
  }
  const expSet = new Set(experienceTools);
  const querySet = new Set(queryTools);
  let overlap = 0;
  for (const tool of querySet) {
    if (expSet.has(tool)) {
      overlap++;
    }
  }
  return overlap / querySet.size;
}

function formatToolsUsed(tools: readonly ExperienceToolCall[]): string {
  const toolNames = tools.map((t) => t.toolName);
  const successCount = tools.filter((t) => t.status === "succeeded").length;
  return `${toolNames.join(" → ")} (${successCount}/${tools.length} succeeded)`;
}

export class ExperienceCacheService {
  private readonly defaultMaxAgeMs: number;
  private readonly defaultMaxEntries: number;

  public constructor(
    private readonly store: AuthoritativeTaskStore,
    options: {
      maxAgeMs?: number;
      maxEntries?: number;
    } = {},
  ) {
    this.defaultMaxAgeMs = options.maxAgeMs ?? 7 * 24 * 60 * 60 * 1000; // 7 days default
    this.defaultMaxEntries = options.maxEntries ?? 1000; // 1000 entries default
  }

  /**
   * Evicts stale experiences based on last-accessed time (TTL).
   *
   * Removes entries whose `last_accessed_at` is older than `maxAgeMs`.
   * Uses `last_accessed_at` rather than `created_at` so that frequently
   * accessed entries are preserved even if old.
   *
   * @returns Number of rows deleted
   */
  public evictStaleExperiences(maxAgeMs: number = this.defaultMaxAgeMs): number {
    const cutoff = Date.now() - maxAgeMs;
    const cutoffIso = new Date(cutoff).toISOString();
    let deleted = 0;
    this.store.withConnection((connection) => {
      deleted = Number(connection.prepare(
        `DELETE FROM experience_cache WHERE last_accessed_at < ? AND last_accessed_at IS NOT NULL`,
      ).run(cutoffIso).changes);
    });
    return deleted;
  }

  /**
   * Evicts experiences by capacity, removing lowest-quality / least-recently
   * entries until the cache is within `maxEntries`.
   *
   * Ordering: quality_score ASC, last_accessed_at ASC (worst/oldest first).
   * Keeps the highest-quality, most-recently-accessed entries.
   *
   * @returns Number of rows deleted
   */
  public evictByCapacity(maxEntries: number = this.defaultMaxEntries): number {
    let deleted = 0;
    this.store.withConnection((connection) => {
      deleted = Number(connection.prepare(`
        DELETE FROM experience_cache WHERE id IN (
          SELECT id FROM experience_cache
          ORDER BY quality_score ASC, last_accessed_at ASC
          LIMIT MAX(0, (SELECT COUNT(*) FROM experience_cache) - ?)
        )
      `).run(maxEntries).changes);
    });
    return deleted;
  }

  /**
   * Records a new task execution experience
   */
  public recordExperience(input: RecordExperienceInput): ExperienceRecord {
    const id = newId("exp");
    const createdAt = nowIso();
    const toolsUsedJson = JSON.stringify(input.toolsUsed);

    this.store.withConnection((connection) => {
      connection.prepare(`
        INSERT INTO experience_cache (
          id, task_id, session_id, agent_id, execution_id,
          task_context, task_intent, tools_used_json,
          outcome, final_error_code, quality_score,
          created_at, hit_count, last_accessed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(
        id,
        input.taskId,
        input.sessionId,
        input.agentId,
        input.executionId,
        input.taskContext,
        input.taskIntent,
        toolsUsedJson,
        input.outcome,
        input.finalErrorCode ?? null,
        input.qualityScore,
        createdAt,
        0, // hit_count - literal 0 for new record
        createdAt, // last_accessed_at - same as created_at for new record
      );
    });

    return {
      id,
      taskId: input.taskId,
      sessionId: input.sessionId,
      agentId: input.agentId,
      executionId: input.executionId,
      taskContext: input.taskContext,
      taskIntent: input.taskIntent,
      toolsUsed: input.toolsUsed,
      outcome: input.outcome,
      finalErrorCode: input.finalErrorCode,
      qualityScore: input.qualityScore,
      createdAt,
      hitCount: 0,
      lastAccessedAt: createdAt,
    };
  }

  /**
   * Finds similar experiences based on task context and tools
   */
  public findSimilarExperiences(query: SimilarExperienceQuery): SimilarExperience[] {
    const limit = query.limit ?? 5;

    // Get all experiences that match basic criteria
    let sql = "SELECT * FROM experience_cache WHERE 1=1";
    const params: unknown[] = [];

    if (query.minQualityScore != null) {
      sql += " AND quality_score >= ?";
      params.push(query.minQualityScore);
    }

    if (query.sessionId != null) {
      sql += " AND session_id = ?";
      params.push(query.sessionId);
    }

    if (query.outcome != null) {
      sql += " AND outcome = ?";
      params.push(query.outcome);
    }

    sql += " ORDER BY quality_score DESC, created_at DESC LIMIT 500";

    const rows = this.store.withConnection((connection) =>
      connection.prepare(sql).all(...params as (string | number | null)[]) as unknown as StoredExperience[],
    );
    const experiences: ExperienceRecord[] = rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      sessionId: row.session_id,
      agentId: row.agent_id,
      executionId: row.execution_id,
      taskContext: row.task_context,
      taskIntent: row.task_intent,
      toolsUsed: JSON.parse(row.tools_used_json) as ExperienceToolCall[],
      outcome: row.outcome as ExperienceRecord["outcome"],
      finalErrorCode: row.final_error_code ?? null,
      qualityScore: row.quality_score,
      createdAt: row.created_at,
      hitCount: row.hit_count,
      lastAccessedAt: row.last_accessed_at,
    }));

    // Score each experience based on similarity
    const scoredExperiences: SimilarExperience[] = [];

    for (const exp of experiences) {
      let similarityScore = 0;
      const allMatchedKeywords: string[] = [];

      // Context similarity
      if (query.taskContext) {
        const contextSim = computeKeywordSimilarity(exp.taskContext, query.taskContext);
        similarityScore += contextSim.score * 0.5;
        allMatchedKeywords.push(...contextSim.matchedKeywords);
      }

      // Intent similarity
      if (query.taskIntent) {
        const intentSim = computeKeywordSimilarity(exp.taskIntent, query.taskIntent);
        similarityScore += intentSim.score * 0.3;
        allMatchedKeywords.push(...intentSim.matchedKeywords);
      }

      // Tool overlap
      if (query.toolNames && query.toolNames.length > 0) {
        const expToolNames = exp.toolsUsed.map((t) => t.toolName);
        const toolOverlap = computeToolOverlap(expToolNames, query.toolNames);
        similarityScore += toolOverlap * 0.2;
      }

      if (similarityScore > 0.1) {
        // Dedupe keywords
        const uniqueKeywords = [...new Set(allMatchedKeywords)];
        scoredExperiences.push({
          experience: exp,
          similarityScore,
          matchedKeywords: uniqueKeywords,
        });
      }
    }

    // Sort by similarity score descending
    scoredExperiences.sort((a, b) => b.similarityScore - a.similarityScore);

    return scoredExperiences.slice(0, limit);
  }

  /**
   * Retrieves experiences and formats them as few-shot examples
   */
  public retrieveForFewShot(query: SimilarExperienceQuery, sessionId: string): ExperienceRetrievalResult {
    const similarExperiences = this.findSimilarExperiences(query);

    // Update hit counts and record audit
    const now = nowIso();
    const experienceIds: string[] = [];

    for (const sim of similarExperiences) {
      experienceIds.push(sim.experience.id);
      this.incrementHitCount(sim.experience.id);
    }

    // Format as few-shot examples
    const examples: FewShotExample[] = similarExperiences.map((sim) => {
      const exp = sim.experience;
      const succeededTools = exp.toolsUsed.filter((t) => t.status === "succeeded").map((t) => t.toolName);
      let approach = `Used ${formatToolsUsed(exp.toolsUsed)}.`;
      if (exp.outcome === "succeeded") {
        approach += " Task completed successfully.";
      } else if (exp.outcome === "failed") {
        approach += ` Failed with error: ${exp.finalErrorCode ?? "unknown"}.`;
      } else {
        approach += " Partially completed.";
      }

      return {
        taskContext: exp.taskContext,
        taskIntent: exp.taskIntent,
        approach,
        toolsUsed: succeededTools,
        outcome: exp.outcome,
        reasoning: sim.matchedKeywords.length > 0
          ? `Matched keywords: ${sim.matchedKeywords.join(", ")}.`
          : null,
      };
    });

    const hitAudit: ExperienceHitAudit = {
      sessionId,
      queriedAt: now,
      queryContext: query.taskContext ?? query.taskIntent ?? "",
      hitsFound: similarExperiences.length,
      examplesUsed: examples.length,
      experienceIds,
    };

    return {
      examples,
      totalAvailable: similarExperiences.length,
      hitAudit,
    };
  }

  /**
   * Increments the hit count for an experience
   */
  private incrementHitCount(experienceId: string): void {
    const now = nowIso();

    this.store.withConnection((connection) => {
      connection.prepare(`
        UPDATE experience_cache
        SET hit_count = hit_count + 1, last_accessed_at = ?
        WHERE id = ?
      `).run(now, experienceId);
    });
  }

  /**
   * Gets experience statistics
   */
  public getStatistics(): {
    totalExperiences: number;
    successfulExperiences: number;
    failedExperiences: number;
    averageQualityScore: number;
    totalHits: number;
  } {
    const stats = this.store.withConnection((connection) =>
      connection.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN outcome = 'succeeded' THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN outcome = 'failed' THEN 1 ELSE 0 END) as failed,
          AVG(quality_score) as avg_quality,
          SUM(hit_count) as total_hits
        FROM experience_cache
      `).get() as { total: number; successful: number; failed: number; avg_quality: number; total_hits: number },
    );

    return {
      totalExperiences: stats.total,
      successfulExperiences: stats.successful,
      failedExperiences: stats.failed,
      averageQualityScore: stats.avg_quality ?? 0,
      totalHits: stats.total_hits,
    };
  }

  /**
   * Clears all experiences (for testing)
   */
  public clearAll(): void {
    this.store.withConnection((connection) => {
      connection.exec("DELETE FROM experience_cache");
    });
  }
}

/**
 * Manager for experience cache services per session
 */
export class ExperienceCacheManager {
  private services: Map<string, ExperienceCacheService> = new Map();

  /**
   * Gets or creates an experience cache service for a session
   */
  public getService(sessionId: string, store: AuthoritativeTaskStore): ExperienceCacheService {
    let service = this.services.get(sessionId);
    if (!service) {
      service = new ExperienceCacheService(store);
      this.services.set(sessionId, service);
    }
    return service;
  }

  /**
   * Removes a session's cache service
   */
  public removeService(sessionId: string): void {
    this.services.delete(sessionId);
  }

  /**
   * Clears all session services
   */
  public clearAll(): void {
    this.services.clear();
  }
}
