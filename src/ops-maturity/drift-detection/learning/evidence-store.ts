/**
 * Evidence Store
 *
 * Stores task execution evidence including traces, failures, and successes.
 * Serves as the input source for the Reflection Engine.
 */

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

export class InMemoryEvidenceStore implements EvidenceStore {
  private records: EvidenceRecord[] = [];

  async append(record: EvidenceRecord): Promise<void> {
    this.records.push(cloneEvidenceRecord(record));
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
}

function cloneEvidenceRecord(record: EvidenceRecord): EvidenceRecord {
  return JSON.parse(JSON.stringify(record)) as EvidenceRecord;
}
