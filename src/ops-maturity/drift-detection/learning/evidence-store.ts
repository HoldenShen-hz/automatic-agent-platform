/**
 * Evidence Store
 *
 * Stores task execution evidence including traces, failures, and successes.
 * Serves as the input source for the Reflection Engine.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface EvidenceRecord {
  id: string;
  taskType: string;
  sessionId: string;
  traceId: string;
  success: boolean;
  failureMode?: string;
  failureCategory?: 'schema_error' | 'type_error' | 'unit_test_failure' | 'lint_error' | 'complex_repair_failure' | 'forbidden_path' | 'security_policy_violation';
  costUsd: number;
  latencyMs: number;
  toolCalls: number;
  repairRounds: number;
  rollback: boolean;
  acceptedByUser?: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface EvidenceStore {
  append(record: EvidenceRecord): Promise<void>;
  getById(id: string): Promise<EvidenceRecord | null>;
  listByTaskType(taskType: string, limit?: number): Promise<EvidenceRecord[]>;
  listFailures(taskType?: string, limit?: number): Promise<EvidenceRecord[]>;
  listSuccesses(taskType?: string, limit?: number): Promise<EvidenceRecord[]>;
  getRecent(limit: number): Promise<EvidenceRecord[]>;
  getStatistics(): Promise<EvidenceStatistics>;
}

export interface EvidenceStatistics {
  totalRecords: number;
  successCount: number;
  failureCount: number;
  averageCostUsd: number;
  averageLatencyMs: number;
  byTaskType: Record<string, { count: number; successCount: number; successRate: number }>;
}

export interface InMemoryEvidenceStoreOptions {
  snapshotFilePath?: string | null;
}

export class InMemoryEvidenceStore implements EvidenceStore {
  private records: EvidenceRecord[];
  private readonly snapshotFilePath: string | null;

  public constructor(options: InMemoryEvidenceStoreOptions = {}) {
    this.snapshotFilePath = normalizeSnapshotPath(options.snapshotFilePath);
    this.records = this.snapshotFilePath == null ? [] : loadSnapshotRecords(this.snapshotFilePath);
  }

  async append(record: EvidenceRecord): Promise<void> {
    this.records.push(cloneEvidenceRecord(record));
    this.persistSnapshot();
  }

  async getById(id: string): Promise<EvidenceRecord | null> {
    const record = this.records.find((r) => r.id === id);
    return record ? cloneEvidenceRecord(record) : null;
  }

  async listByTaskType(taskType: string, limit = 100): Promise<EvidenceRecord[]> {
    return this.records.filter((r) => r.taskType === taskType).slice(-limit).map(cloneEvidenceRecord);
  }

  async listFailures(taskType?: string, limit = 100): Promise<EvidenceRecord[]> {
    const filtered = taskType
      ? this.records.filter((r) => !r.success && r.taskType === taskType)
      : this.records.filter((r) => !r.success);
    return filtered.slice(-limit).map(cloneEvidenceRecord);
  }

  async listSuccesses(taskType?: string, limit = 100): Promise<EvidenceRecord[]> {
    const filtered = taskType
      ? this.records.filter((r) => r.success && r.taskType === taskType)
      : this.records.filter((r) => r.success);
    return filtered.slice(-limit).map(cloneEvidenceRecord);
  }

  async getRecent(limit = 100): Promise<EvidenceRecord[]> {
    return this.records.slice(-limit).map(cloneEvidenceRecord);
  }

  async getStatistics(): Promise<EvidenceStatistics> {
    const totalRecords = this.records.length;
    const successCount = this.records.filter((r) => r.success).length;
    const failureCount = totalRecords - successCount;

    const avgCost = totalRecords > 0
      ? this.records.reduce((sum, r) => sum + r.costUsd, 0) / totalRecords
      : 0;
    const avgLatency = totalRecords > 0
      ? this.records.reduce((sum, r) => sum + r.latencyMs, 0) / totalRecords
      : 0;

    const byTaskType: Record<string, { count: number; successCount: number; successRate: number }> = {};
    for (const record of this.records) {
      const taskStats = byTaskType[record.taskType];
      if (!taskStats) {
        byTaskType[record.taskType] = { count: 1, successCount: record.success ? 1 : 0, successRate: 0 };
      } else {
        taskStats.count++;
        if (record.success) {
          taskStats.successCount++;
        }
      }
    }

    for (const taskType of Object.keys(byTaskType)) {
      const stats = byTaskType[taskType]!;
      stats.successRate = stats.count > 0 ? stats.successCount / stats.count : 0;
    }

    return {
      totalRecords,
      successCount,
      failureCount,
      averageCostUsd: avgCost,
      averageLatencyMs: avgLatency,
      byTaskType,
    };
  }

  private persistSnapshot(): void {
    if (this.snapshotFilePath == null) {
      return;
    }
    mkdirSync(dirname(this.snapshotFilePath), { recursive: true });
    writeFileSync(
      this.snapshotFilePath,
      JSON.stringify(this.records, null, 2),
      "utf8",
    );
  }
}

function cloneEvidenceRecord(record: EvidenceRecord): EvidenceRecord {
  if (typeof structuredClone === "function") {
    return structuredClone(record);
  }
  return {
    ...record,
    ...(record.metadata != null ? { metadata: JSON.parse(JSON.stringify(record.metadata)) as Record<string, unknown> } : {}),
  };
}

function normalizeSnapshotPath(snapshotFilePath: string | null | undefined): string | null {
  if (typeof snapshotFilePath !== "string") {
    return null;
  }
  const trimmed = snapshotFilePath.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function loadSnapshotRecords(snapshotFilePath: string): EvidenceRecord[] {
  if (!existsSync(snapshotFilePath)) {
    return [];
  }
  const payload = readFileSync(snapshotFilePath, "utf8").trim();
  if (payload.length === 0) {
    return [];
  }
  const parsed = JSON.parse(payload) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`evidence_store.invalid_snapshot:${snapshotFilePath}`);
  }
  return parsed.map((record) => cloneEvidenceRecord(assertEvidenceRecord(record, snapshotFilePath)));
}

function assertEvidenceRecord(record: unknown, snapshotFilePath: string): EvidenceRecord {
  if (typeof record !== "object" || record == null) {
    throw new Error(`evidence_store.invalid_snapshot_record:${snapshotFilePath}`);
  }
  const candidate = record as Partial<EvidenceRecord>;
  if (
    typeof candidate.id !== "string"
    || typeof candidate.taskType !== "string"
    || typeof candidate.sessionId !== "string"
    || typeof candidate.traceId !== "string"
    || typeof candidate.success !== "boolean"
    || typeof candidate.costUsd !== "number"
    || typeof candidate.latencyMs !== "number"
    || typeof candidate.toolCalls !== "number"
    || typeof candidate.repairRounds !== "number"
    || typeof candidate.rollback !== "boolean"
    || typeof candidate.createdAt !== "string"
  ) {
    throw new Error(`evidence_store.invalid_snapshot_record:${snapshotFilePath}`);
  }
  return candidate as EvidenceRecord;
}
