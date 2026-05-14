/**
 * Evidence Service
 *
 * Manages evidence records for the learning pipeline.
 * Provides storage, querying, and integration with the learning system.
 *
 * ## Evidence Lifecycle
 *
 * 1. record() - Store evidence record
 * 2. query() - Retrieve evidence records by criteria
 * 3. integrateWithLearning() - Feed evidence into learning pipeline
 *
 * ## Evidence Categories
 *
 * Evidence is categorized by type:
 * - validation: Validation results
 * - feedback: User/system feedback signals
 * - performance: Execution performance metrics
 * - quality: Quality evaluation results
 * - promotion: Knowledge promotion events
 */

import { newId, nowIso } from "../../contracts/types/ids.js";

/**
 * Evidence record categories
 */
export type EvidenceCategory =
  | "validation"
  | "feedback"
  | "performance"
  | "quality"
  | "promotion"
  | "learning_signal";

/**
 * Evidence record status
 */
export type EvidenceStatus = "recorded" | "processed" | "integrated" | "archived";

/**
 * Evidence record interface
 */
export interface EvidenceRecord {
  id: string;
  category: EvidenceCategory;
  sourceRef: string;
  content: Record<string, unknown>;
  status: EvidenceStatus;
  recordedAt: string;
  processedAt: string | null;
  integratedAt: string | null;
  metadata: EvidenceMetadata;
}

/**
 * Metadata attached to an evidence record
 */
export interface EvidenceMetadata {
  tenantId?: string;
  domainId?: string;
  taskId?: string;
  executionId?: string;
  agentId?: string;
  sessionId?: string;
  trustLevel?: string;
  qualityScore?: number | null;
  usefulnessScore?: number | null;
  tags?: string[];
  correlationId?: string;
}

/**
 * Query options for evidence records
 */
export interface EvidenceQuery {
  category?: EvidenceCategory;
  sourceRef?: string;
  status?: EvidenceStatus;
  tenantId?: string;
  domainId?: string;
  taskId?: string;
  executionId?: string;
  agentId?: string;
  sessionId?: string;
  recordedAfter?: string;
  recordedBefore?: string;
  limit?: number;
  offset?: number;
}

/**
 * Learning pipeline integration result
 */
export interface LearningIntegrationResult {
  integrated: boolean;
  evidenceIds: string[];
  learningSignals: LearningSignal[];
  errors: string[];
}

/**
 * Learning signal derived from evidence
 */
export interface LearningSignal {
  signalId: string;
  evidenceId: string;
  signalType: "quality_improvement" | "pattern_detected" | "anomaly_detected" | "feedback_received";
  score: number;
  payload: Record<string, unknown>;
  generatedAt: string;
}

/**
 * EvidenceService configuration
 */
export interface EvidenceServiceConfig {
  maxRecords?: number;
  retentionDays?: number;
  integrationEnabled?: boolean;
}

/**
 * Evidence Service
 *
 * Manages evidence records with integration into the learning pipeline.
 */
export class EvidenceService {
  private readonly records: Map<string, EvidenceRecord> = new Map();
  private readonly CATEGORY_INDEX = new Map<EvidenceCategory, Set<string>>();
  private readonly SOURCE_REF_INDEX = new Map<string, Set<string>>();
  private readonly TENANT_INDEX = new Map<string, Set<string>>();
  private readonly STATUS_INDEX = new Map<EvidenceStatus, Set<string>>();

  private readonly maxRecords: number;
  private readonly retentionDays: number;
  private readonly integrationEnabled: boolean;

  public constructor(config: EvidenceServiceConfig = {}) {
    this.maxRecords = config.maxRecords ?? 10000;
    this.retentionDays = config.retentionDays ?? 90;
    this.integrationEnabled = config.integrationEnabled ?? true;

    // Initialize category index
    for (const category of ["validation", "feedback", "performance", "quality", "promotion", "learning_signal"] as EvidenceCategory[]) {
      this.CATEGORY_INDEX.set(category, new Set());
    }
    for (const status of ["recorded", "processed", "integrated", "archived"] as EvidenceStatus[]) {
      this.STATUS_INDEX.set(status, new Set());
    }
  }

  /**
   * R20-13 FIX: Stores an evidence record.
   *
   * @param category - The evidence category
   * @param sourceRef - Reference to the source (e.g., "memory:abc123", "task:xyz789")
   * @param content - The evidence content
   * @param metadata - Optional metadata
   * @returns The stored evidence record
   */
  public record(
    category: EvidenceCategory,
    sourceRef: string,
    content: Record<string, unknown>,
    metadata: EvidenceMetadata = {},
  ): EvidenceRecord {
    const now = nowIso();

    const record: EvidenceRecord = {
      id: newId("ev"),
      category,
      sourceRef,
      content,
      status: "recorded",
      recordedAt: now,
      processedAt: null,
      integratedAt: null,
      metadata,
    };

    // Store record
    this.records.set(record.id, record);

    // Update indexes
    this.CATEGORY_INDEX.get(category)!.add(record.id);
    this.STATUS_INDEX.get("recorded")!.add(record.id);

    if (sourceRef) {
      const sourceSet = this.SOURCE_REF_INDEX.get(sourceRef) ?? new Set();
      sourceSet.add(record.id);
      this.SOURCE_REF_INDEX.set(sourceRef, sourceSet);
    }

    if (metadata.tenantId) {
      const tenantSet = this.TENANT_INDEX.get(metadata.tenantId) ?? new Set();
      tenantSet.add(record.id);
      this.TENANT_INDEX.set(metadata.tenantId, tenantSet);
    }

    // Evict old records if over capacity
    this.evictOldRecords();

    // Auto-process if integration is enabled
    if (this.integrationEnabled && record.status === "recorded") {
      this.processRecord(record.id);
    }

    return record;
  }

  /**
   * R20-14 FIX: Queries evidence records by criteria.
   *
   * @param query - Query criteria
   * @returns Matching evidence records
   */
  public query(query: EvidenceQuery): EvidenceRecord[] {
    this.evictOldRecords();

    let candidateIds: Set<string> | null = null;

    // Build candidate set from indexes
    if (query.category) {
      const categoryIds = this.CATEGORY_INDEX.get(query.category);
      if (categoryIds) {
        candidateIds = candidateIds ? this.intersectSets(candidateIds, categoryIds) : new Set(categoryIds);
      }
    }

    if (query.status) {
      const statusIds = this.STATUS_INDEX.get(query.status);
      if (statusIds) {
        candidateIds = candidateIds ? this.intersectSets(candidateIds, statusIds) : new Set(statusIds);
      }
    }

    if (query.sourceRef) {
      const sourceIds = this.SOURCE_REF_INDEX.get(query.sourceRef);
      if (sourceIds) {
        candidateIds = candidateIds ? this.intersectSets(candidateIds, sourceIds) : new Set(sourceIds);
      }
    }

    if (query.tenantId) {
      const tenantIds = this.TENANT_INDEX.get(query.tenantId);
      if (tenantIds) {
        candidateIds = candidateIds ? this.intersectSets(candidateIds, tenantIds) : new Set(tenantIds);
      }
    }

    // If no indexes used, start with all records
    if (candidateIds === null) {
      candidateIds = new Set(this.records.keys());
    }

    // Apply filters
    const results: EvidenceRecord[] = [];
    for (const id of candidateIds) {
      const record = this.records.get(id);
      if (!record) continue;

      // Apply additional filters
      if (query.taskId && record.metadata.taskId !== query.taskId) continue;
      if (query.executionId && record.metadata.executionId !== query.executionId) continue;
      if (query.agentId && record.metadata.agentId !== query.agentId) continue;
      if (query.sessionId && record.metadata.sessionId !== query.sessionId) continue;
      if (query.domainId && record.metadata.domainId !== query.domainId) continue;

      if (query.recordedAfter && record.recordedAt < query.recordedAfter) continue;
      if (query.recordedBefore && record.recordedAt > query.recordedBefore) continue;

      results.push(record);
    }

    // Sort by recordedAt descending
    results.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

    // Apply pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  /**
   * R20-15 FIX: Integrates evidence records with the learning pipeline.
   *
   * Converts evidence into learning signals that can be used
   * to improve memory promotion, trust levels, and quality.
   *
   * @param evidenceIds - IDs of evidence to integrate
   * @returns Integration result with learning signals
   */
  public integrateWithLearning(evidenceIds?: string[]): LearningIntegrationResult {
    this.evictOldRecords();

    const signals: LearningSignal[] = [];
    const errors: string[] = [];
    const toIntegrate = evidenceIds ?? this.query({ status: "processed" }).map(r => r.id);

    for (const id of toIntegrate) {
      const record = this.records.get(id);
      if (!record) {
        errors.push(`Evidence record not found: ${id}`);
        continue;
      }

      try {
        // Generate learning signals based on evidence category
        const categorySignals = this.generateLearningSignals(record);
        signals.push(...categorySignals);

        // Update record status
        record.status = "integrated";
        record.integratedAt = nowIso();
        this.STATUS_INDEX.get("recorded")!.delete(id);
        this.STATUS_INDEX.get("integrated")!.add(id);
      } catch (err) {
        errors.push(`Failed to integrate ${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      integrated: errors.length === 0,
      evidenceIds: toIntegrate,
      learningSignals: signals,
      errors,
    };
  }

  /**
   * Gets an evidence record by ID
   */
  public get(id: string): EvidenceRecord | null {
    this.evictOldRecords();
    return this.records.get(id) ?? null;
  }

  /**
   * Lists evidence records by category
   */
  public listByCategory(category: EvidenceCategory): EvidenceRecord[] {
    return this.query({ category });
  }

  /**
   * Updates evidence record status
   */
  public updateStatus(id: string, status: EvidenceStatus): boolean {
    this.evictOldRecords();

    const record = this.records.get(id);
    if (!record) return false;

    const oldStatus = record.status;
    record.status = status;

    if (status === "processed" && !record.processedAt) {
      record.processedAt = nowIso();
    }

    // Update status index
    this.STATUS_INDEX.get(oldStatus)?.delete(id);
    this.STATUS_INDEX.get(status)?.add(id);

    return true;
  }

  /**
   * Processes a recorded evidence record
   */
  private processRecord(id: string): void {
    const record = this.records.get(id);
    if (!record || record.status !== "recorded") return;

    record.status = "processed";
    record.processedAt = nowIso();

    this.STATUS_INDEX.get("recorded")!.delete(id);
    this.STATUS_INDEX.get("processed")!.add(id);
  }

  /**
   * Generates learning signals from an evidence record
   */
  private generateLearningSignals(record: EvidenceRecord): LearningSignal[] {
    const signals: LearningSignal[] = [];

    switch (record.category) {
      case "quality":
        // Quality evidence generates quality improvement signals
        if (record.metadata.qualityScore != null) {
          signals.push({
            signalId: newId("lsig"),
            evidenceId: record.id,
            signalType: "quality_improvement",
            score: record.metadata.qualityScore,
            payload: record.content,
            generatedAt: nowIso(),
          });
        }
        break;

      case "feedback":
        // Feedback evidence generates feedback received signals
        signals.push({
          signalId: newId("lsig"),
          evidenceId: record.id,
          signalType: "feedback_received",
          score: record.metadata.usefulnessScore ?? 0.5,
          payload: record.content,
          generatedAt: nowIso(),
        });
        break;

      case "validation":
        // Validation evidence can detect patterns
        if (record.content.passed === false) {
          signals.push({
            signalId: newId("lsig"),
            evidenceId: record.id,
            signalType: "anomaly_detected",
            score: 0.7,
            payload: { reason: "validation_failed", ...record.content },
            generatedAt: nowIso(),
          });
        }
        break;

      case "promotion":
        // Promotion evidence indicates pattern success
        if (record.content.promoted === true) {
          signals.push({
            signalId: newId("lsig"),
            evidenceId: record.id,
            signalType: "pattern_detected",
            score: 0.8,
            payload: record.content,
            generatedAt: nowIso(),
          });
        }
        break;

      case "performance":
      case "learning_signal":
      default:
        // Other categories generate generic signals
        if (Object.keys(record.content).length > 0) {
          signals.push({
            signalId: newId("lsig"),
            evidenceId: record.id,
            signalType: "pattern_detected",
            score: 0.5,
            payload: record.content,
            generatedAt: nowIso(),
          });
        }
        break;
    }

    return signals;
  }

  /**
   * Evicts old records to maintain capacity
   */
  private evictOldRecords(): void {
    if (this.records.size <= this.maxRecords) return;

    // Calculate retention threshold
    const threshold = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);

    // Find old records to evict
    const toEvict: string[] = [];
    for (const [id, record] of this.records) {
      if (record.status === "archived") continue; // Keep archived
      const recordedAt = new Date(record.recordedAt).getTime();
      if (recordedAt < threshold) {
        toEvict.push(id);
      }
    }

    // If still over capacity, evict oldest records
    if (this.records.size - toEvict.length > this.maxRecords) {
      const sorted = [...this.records.entries()]
        .filter(([id]) => !toEvict.includes(id))
        .sort((a, b) => a[1].recordedAt.localeCompare(b[1].recordedAt));

      const toRemove = this.records.size - this.maxRecords;
      for (let i = 0; i < toRemove && i < sorted.length; i++) {
        toEvict.push(sorted[i]![0]);
      }
    }

    // Evict records
    for (const id of toEvict) {
      const record = this.records.get(id);
      if (record) {
        this.removeFromIndexes(id, record);
        this.records.delete(id);
      }
    }
  }

  /**
   * Removes a record from all indexes
   */
  private removeFromIndexes(id: string, record: EvidenceRecord): void {
    this.CATEGORY_INDEX.get(record.category)?.delete(id);
    this.STATUS_INDEX.get(record.status)?.delete(id);
    this.SOURCE_REF_INDEX.get(record.sourceRef)?.delete(id);
    if (record.metadata.tenantId) {
      this.TENANT_INDEX.get(record.metadata.tenantId)?.delete(id);
    }
  }

  /**
   * Intersects two sets
   */
  private intersectSets(a: Set<string>, b: Set<string>): Set<string> {
    const result = new Set<string>();
    for (const id of a) {
      if (b.has(id)) result.add(id);
    }
    return result;
  }

  /**
   * Gets evidence statistics
   */
  public getStats(): {
    total: number;
    byCategory: Record<EvidenceCategory, number>;
    byStatus: Record<EvidenceStatus, number>;
  } {
    const byCategory: Record<EvidenceCategory, number> = {
      validation: 0,
      feedback: 0,
      performance: 0,
      quality: 0,
      promotion: 0,
      learning_signal: 0,
    };
    const byStatus: Record<EvidenceStatus, number> = {
      recorded: 0,
      processed: 0,
      integrated: 0,
      archived: 0,
    };

    for (const record of this.records.values()) {
      byCategory[record.category]++;
      byStatus[record.status]++;
    }

    return {
      total: this.records.size,
      byCategory,
      byStatus,
    };
  }
}
