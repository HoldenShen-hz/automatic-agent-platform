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
import { createHash } from "node:crypto";
import { newId, nowIso } from "../../contracts/types/ids.js";
import type { AuthoritativeTaskStore } from "../truth/authoritative-task-store.js";
import {
  buildMemoryConsolidationSummary,
  hasExplicitMemoryBoundary,
} from "./memory-consolidation.js";
import { evictFromWorkingLayer } from "./memory-layer-model.js";
import {
  normalizeMemoryContent,
  stringifyStructuredMemoryContent,
  type StructuredMemoryContent,
} from "./memory-schema.js";
import {
  buildMemoryQualityReport,
  filterAndSortMemories,
  type MemoryQualityReport,
  type MemoryRecallQuery,
} from "./memory-quality.js";
import { MemoryError } from "../../contracts/errors.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

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
  // Only consolidate memories older than this timestamp
  olderThanCreatedAt?: string;
  // Minimum source memories required
  minSourceMemories?: number;
  // Maximum source memories to include
  maxSourceMemories?: number;
  // Target layer for consolidated memory (cannot be layer_3)
  targetMemoryLayer?: Exclude<MemoryRecord["memoryLayer"], "layer_3">;
  // Whether to revoke source memories after consolidation
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
export class MemoryService {
  public constructor(private readonly store: AuthoritativeTaskStore) {}

  // V-02: Limit memory content size to prevent memory exhaustion
  private static readonly MAX_CONTENT_SIZE_BYTES = 1_000_000; // 1MB

  // R8-18 FIX: Working layer LRU eviction requires ContextTruncationReport per §29.2
  // "Facts cannot be silently discarded, compression requires loss report"
  // Maximum number of records in the working (runtime/task_runtime) layer before LRU eviction
  private static readonly MAX_WORKING_MEMORY_RECORDS = 1000;

  public getStore(): AuthoritativeTaskStore {
    return this.store;
  }

  /**
   * Stores a new memory
   *
   * Content is normalized to structured format (memory.v2).
   * Memory is assigned a unique ID and stored with the current timestamp.
   *
   * @throws MemoryError if content exceeds size limit
   */
  public remember(input: RememberMemoryInput): MemoryRecord {
    // V-02: Validate content size before processing
    // R5-47 FIX: Calculate actual byte size using Buffer.byteLength() instead of
    // .length which counts UTF-16 code units. CJK characters can be 3-4 bytes each,
    // so ".length" underestimates actual memory usage and content > 1MB can pass.
    const contentText = typeof input.content === "string"
      ? input.content
      : JSON.stringify(input.content);
    const contentSizeBytes = Buffer.byteLength(contentText, "utf8");
    if (contentSizeBytes > MemoryService.MAX_CONTENT_SIZE_BYTES) {
      throw new MemoryError("memory.content_too_large", `Memory content size ${contentSizeBytes} bytes exceeds maximum of ${MemoryService.MAX_CONTENT_SIZE_BYTES} bytes`, {
        details: { contentSizeBytes, maxSize: MemoryService.MAX_CONTENT_SIZE_BYTES },
      });
    }

    // V-03: Write gate - minimum content quality check
    if (contentText.trim().length < 10) {
      throw new MemoryError("memory.content_too_short", `Memory content too short: minimum 10 characters required, got ${contentText.trim().length}`, {
        details: { contentLength: contentText.trim().length, minLength: 10 },
      });
    }

    // V-04: Deduplication - compute content hash and check for existing
    // R5-46 FIX: Use full 64-char SHA-256 hash (256 bits) to avoid collision at scale.
    // Previously truncated to 16 hex chars (64-bit) which has significant collision
    // probability with ~10K records.
    const contentHash = createHash("sha256").update(contentText).digest("hex");
    const existing = this.store.memory.findMemoryByContentHash(contentHash, input.scope);
    if (existing && existing.status === "active") {
      // Update access tracking and return existing memory
      this.store.memory.recordMemoryAccess(existing.id, nowIso());
      return {
        ...existing,
        hitCount: existing.hitCount + 1,
        lastAccessedAt: nowIso(),
      };
    }

    const createdAt = input.createdAt ?? nowIso();
    // Normalize content to structured format
    const normalizedContent = normalizeMemoryContent({
      content: input.content,
      classification: input.classification ?? "internal",
      qualityScore: input.qualityScore ?? null,
      taskId: input.taskId ?? null,
      sessionId: input.sessionId ?? null,
      agentId: input.agentId ?? null,
      executionId: input.executionId ?? null,
      observedAt: createdAt,
      defaultSource: "memory.remember",
    });

    // Build record with all fields
    const record: MemoryRecord = {
      id: newId("mem"),
      taskId: input.taskId ?? null,
      sessionId: input.sessionId ?? null,
      agentId: input.agentId ?? null,
      executionId: input.executionId ?? null,
      memoryLayer: input.memoryLayer ?? "layer_3",
      scope: input.scope,
      contentJson: stringifyStructuredMemoryContent(normalizedContent),
      classification: input.classification ?? "internal",
      sourceTrustLevel: input.sourceTrustLevel ?? "trusted",
      qualityScore: input.qualityScore ?? null,
      hitCount: 0,
      createdAt,
      lastAccessedAt: null,
      expiresAt: input.expiresAt ?? null,
      revokedAt: null,
      revocationReason: null,
      kind: input.kind ?? "general",
      status: "active",
      importanceScore: null,
      freshnessScore: null,
      contentHash,
    };

    this.store.memory.insertMemory(record);

    // R8-18 FIX: Enforce working layer capacity with ContextTruncationReport per §29.2
    // "Facts cannot be silently discarded, compression requires loss report"
    // Check if this is a working layer memory and enforce LRU eviction if over capacity
    if (record.memoryLayer === "layer_3" && (record.scope === "task_runtime" || record.scope === "runtime")) {
      const workingMemories = this.store.memory.listMemories({
        memoryLayers: ["layer_3"],
        scopes: ["task_runtime", "runtime"],
        includeExpired: false,
        includeRevoked: false,
      });

      if (workingMemories.length > MemoryService.MAX_WORKING_MEMORY_RECORDS) {
        const { evictedRecordIds, report } = evictFromWorkingLayer(
          workingMemories,
          MemoryService.MAX_WORKING_MEMORY_RECORDS,
        );

        // Revoke evicted records (they are marked as revoked, not deleted)
        for (const evictedId of evictedRecordIds) {
          this.store.memory.revokeMemory(evictedId, nowIso(), "lru_eviction:working_layer_capacity_exceeded");
        }

        // NOTE: The report is generated and available for logging/auditing per §29.2
        // In production, this should be sent to a logging/metrics system
        if (evictedRecordIds.length > 0) {
          StructuredLogger.warn("memory.working_layer_eviction", {
            report,
            evictedCount: evictedRecordIds.length,
            remainingCount: workingMemories.length - evictedRecordIds.length,
          });
        }
      }
    }

    return record;
  }

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
  public recall(query: MemoryRecallQuery = {}): MemoryRecord[] {
    const evaluatedAt = query.evaluatedAt ?? nowIso();

    // Get all memories with full filters applied
    const records = filterAndSortMemories(
      this.store.memory.listMemories({
        ...query,
        includeExpired: true,
        includeRevoked: true,
        evaluatedAt,
      }),
      query,
    );

    // Update access tracking for each returned memory
    for (const record of records) {
      this.store.memory.recordMemoryAccess(record.id, evaluatedAt);
    }

    // Return with updated hit counts
    return records.map((record) => ({
      ...record,
      hitCount: record.hitCount + 1,
      lastAccessedAt: evaluatedAt,
    }));
  }

  /**
   * Revokes a memory, marking it as invalid
   *
   * Revoked memories can still be retrieved with includeRevoked: true
   * but are excluded from normal recall by default.
   */
  public revoke(memoryId: string, reason: string, revokedAt: string = nowIso()): MemoryRecord | null {
    const existing = this.store.memory.getMemory(memoryId);
    if (existing == null) {
      return null;
    }
    this.store.memory.revokeMemory(memoryId, revokedAt, reason);
    return this.store.memory.getMemory(memoryId);
  }

  /**
   * Generates a quality report for memories matching query
   *
   * Report includes:
   * - Total/active/expired/revoked counts
   * - Average quality score
   * - Breakdown by scope, layer, and classification
   * - Recall statistics (how many have been accessed)
   */
  public getQualityReport(query: Omit<MemoryRecallQuery, "includeExpired" | "includeRevoked"> = {}): MemoryQualityReport {
    const evaluatedAt = query.evaluatedAt ?? nowIso();
    const records = this.store.memory.listMemories({
      ...query,
      includeExpired: true,
      includeRevoked: true,
      evaluatedAt,
    });
    return buildMemoryQualityReport(records, evaluatedAt);
  }

  /**
   * Records a failure as a memory
   *
   * Creates a structured memory with:
   * - workContext: "Execution {executionId} failure"
   * - topOfMind: "Task {taskId} failed"
   * - recentHistory: error message if provided
   * - facts: reasonCode and errorMessage with high confidence
   */
  public recordFailureMemory(input: FailureMemoryInput): MemoryRecord {
    const occurredAt = input.occurredAt ?? nowIso();
    return this.remember({
      taskId: input.taskId,
      executionId: input.executionId,
      agentId: input.agentId,
      scope: input.scope ?? "project",
      classification: "operational",
      sourceTrustLevel: "trusted",
      memoryLayer: "layer_3",
      createdAt: occurredAt,
      content: normalizeMemoryContent({
        content: {
          workContext: `Execution ${input.executionId} failure`,
          topOfMind: [`Task ${input.taskId} failed`],
          recentHistory: input.errorMessage != null ? [input.errorMessage] : [],
          facts: [
            {
              content: input.reasonCode,
              category: "reason_code",
              confidence: 1,
              provenanceSource: "memory.failure",
            },
            ...(input.errorMessage != null
              ? [{
                  content: input.errorMessage,
                  category: "error_message",
                  confidence: 1,
                  provenanceSource: "memory.failure",
                }]
              : []),
          ],
        },
        classification: "operational",
        qualityScore: null,
        taskId: input.taskId,
        agentId: input.agentId,
        executionId: input.executionId,
        observedAt: occurredAt,
        defaultSource: "memory.failure",
      }),
    });
  }

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
  public consolidate(input: ConsolidateMemoriesInput): ConsolidateMemoriesResult {
    // Require explicit boundary to avoid accidental consolidation
    if (!hasExplicitMemoryBoundary(input)) {
      throw new MemoryError("memory_consolidation_scope_required", "memory_consolidation_scope_required: Memory consolidation requires an explicit memory boundary", {
        details: { scopes: input.scopes },
      });
    }

    const evaluatedAt = input.evaluatedAt ?? nowIso();
    const targetMemoryLayer = input.targetMemoryLayer ?? "layer_5";
    const minSourceMemories = Math.max(2, input.minSourceMemories ?? 3);
    const maxSourceMemories = Math.max(minSourceMemories, input.maxSourceMemories ?? 8);
    const revokeSourceMemories = input.revokeSourceMemories ?? true;

    // Collect layer_3 candidates matching criteria
    const candidates = this.store.memory.listMemories({
      ...(input.taskId != null ? { taskId: input.taskId } : {}),
      ...(input.sessionId != null ? { sessionId: input.sessionId } : {}),
      ...(input.agentId != null ? { agentId: input.agentId } : {}),
      ...(input.executionId != null ? { executionId: input.executionId } : {}),
      ...(input.scopes != null ? { scopes: input.scopes } : {}),
      ...(input.classifications != null ? { classifications: input.classifications } : {}),
      ...(input.sourceTrustLevels != null ? { sourceTrustLevels: input.sourceTrustLevels } : {}),
      includeExpired: false,
      includeRevoked: false,
      memoryLayers: ["layer_3"],
      evaluatedAt,
    })
      .filter((record) => input.olderThanCreatedAt == null || record.createdAt <= input.olderThanCreatedAt)
      .slice(0, maxSourceMemories);

    // Check minimum threshold
    if (candidates.length < minSourceMemories) {
      return {
        consolidated: false,
        createdMemory: null,
        sourceMemoryIds: candidates.map((record) => record.id),
        skippedReason: "insufficient_source_memories",
      };
    }

    // All candidates must share the same scope
    const distinctScopes = Array.from(new Set(candidates.map((record) => record.scope)));
    if (distinctScopes.length !== 1) {
      throw new MemoryError("memory_consolidation_single_scope_required", "memory_consolidation_single_scope_required: Memory consolidation requires a single scope", {
        details: { distinctScopes },
      });
    }

    // Build consolidation summary from candidates
    const summary = buildMemoryConsolidationSummary(candidates, targetMemoryLayer);

    // Create consolidated memory
    const createdMemory = this.remember({
      taskId: input.taskId ?? candidates[0]?.taskId ?? null,
      sessionId: input.sessionId ?? candidates[0]?.sessionId ?? null,
      agentId: input.agentId ?? candidates[0]?.agentId ?? null,
      executionId: input.executionId ?? null,
      memoryLayer: targetMemoryLayer,
      scope: distinctScopes[0] ?? input.scopes?.[0] ?? "project",
      classification: "summary",
      sourceTrustLevel: "trusted",
      qualityScore: summary.averageQualityScore,
      createdAt: evaluatedAt,
      content: summary.structuredContent,
    });

    // Revoke source memories if requested
    if (revokeSourceMemories) {
      for (const record of candidates) {
        this.store.memory.revokeMemory(record.id, evaluatedAt, `consolidated_into:${createdMemory.id}`);
      }
    }

    return {
      consolidated: true,
      createdMemory,
      sourceMemoryIds: summary.sourceMemoryIds,
      skippedReason: null,
    };
  }
}
