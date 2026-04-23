/**
 * AsyncOperationsRepository - Async data access for analytics, archives, replay, and data movement.
 *
 * This is the async PostgreSQL-compatible version of OperationsRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */
import type { AnalyticsFactRecord, ArchiveBundleRecord, DataMovementJobRecord, ReplayDatasetRecord } from "../../../contracts/types/domain.js";
import type { ExecutionAuthoritativeView } from "../sqlite/authoritative-task-store-types.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
export declare class AsyncOperationsRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    loadExecutionAuthoritativeView(executionId: string, tenantId?: string | null): Promise<ExecutionAuthoritativeView | null>;
    insertAnalyticsFactRecord(record: AnalyticsFactRecord): Promise<void>;
    listAnalyticsFactRecords(options?: {
        namespaceId?: string;
        tenantId?: string | null;
        metricName?: string;
        limit?: number;
    }): Promise<AnalyticsFactRecord[]>;
    insertArchiveBundleRecord(record: ArchiveBundleRecord): Promise<void>;
    listArchiveBundleRecords(options?: {
        namespaceId?: string;
        tenantId?: string | null;
        bundleType?: string;
        limit?: number;
    }): Promise<ArchiveBundleRecord[]>;
    insertReplayDatasetRecord(record: ReplayDatasetRecord): Promise<void>;
    listReplayDatasetRecords(options?: {
        namespaceId?: string;
        tenantId?: string | null;
        datasetType?: string;
        limit?: number;
    }): Promise<ReplayDatasetRecord[]>;
    upsertDataMovementJobRecord(record: DataMovementJobRecord): Promise<void>;
    getDataMovementJobRecord(jobId: string): Promise<DataMovementJobRecord | null>;
    listDataMovementJobRecords(options?: {
        tenantId?: string | null;
        status?: DataMovementJobRecord["status"];
        movementType?: DataMovementJobRecord["movementType"];
        limit?: number;
    }): Promise<DataMovementJobRecord[]>;
}
