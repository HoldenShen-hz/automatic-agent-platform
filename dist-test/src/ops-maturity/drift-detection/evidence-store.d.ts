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
    byTaskType: Record<string, {
        count: number;
        successCount: number;
        successRate: number;
    }>;
}
export declare class InMemoryEvidenceStore implements EvidenceStore {
    private records;
    append(record: EvidenceRecord): Promise<void>;
    getById(id: string): Promise<EvidenceRecord | null>;
    listByTaskType(taskType: string, limit?: number): Promise<EvidenceRecord[]>;
    listFailures(taskType?: string, limit?: number): Promise<EvidenceRecord[]>;
    listSuccesses(taskType?: string, limit?: number): Promise<EvidenceRecord[]>;
    getRecent(limit?: number): Promise<EvidenceRecord[]>;
    getStatistics(): Promise<EvidenceStatistics>;
}
