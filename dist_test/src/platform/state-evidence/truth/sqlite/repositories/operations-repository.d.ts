import type { AnalyticsFactRecord, ArchiveBundleRecord, DataMovementJobRecord, ReplayDatasetRecord } from "../../../../contracts/types/domain.js";
import type { AuthoritativeSqlDatabase } from "../sqlite-database.js";
import { type ActiveExecutionActivityRecord, type ActiveExecutionConflictRecord, type ActiveTaskTerminalSessionRecord, type ActiveTaskWithoutWorkflow, type ExecutionAuthoritativeView, type OrphanSessionRecord, type RuntimeRecoveryRecord, type StaleExecutionRecord, type TaskBoardItem, type TaskSnapshot, type WorkflowTerminalMismatchRecord } from "../authoritative-task-store-types.js";
import { EvolutionRepository } from "./evolution-repository.js";
/**
 * Standalone repository boundary for analytics / archive / replay / data-movement
 * records plus runtime consistency and recovery read models.
 */
export declare class OperationsRepository {
    private readonly db;
    private readonly taskRepository;
    private readonly workflowRepository;
    private readonly dispatchRepository;
    private readonly artifactRepository;
    private readonly divisionRepository;
    private readonly evolutionRepository;
    constructor(db: AuthoritativeSqlDatabase);
    insertAnalyticsFactRecord(record: AnalyticsFactRecord): void;
    listAnalyticsFactRecords(options?: {
        namespaceId?: string;
        tenantId?: string | null;
        metricName?: string;
        limit?: number;
    }): AnalyticsFactRecord[];
    insertArchiveBundleRecord(record: ArchiveBundleRecord): void;
    listArchiveBundleRecords(options?: {
        namespaceId?: string;
        tenantId?: string | null;
        bundleType?: string;
        limit?: number;
    }): ArchiveBundleRecord[];
    insertReplayDatasetRecord(record: ReplayDatasetRecord): void;
    listReplayDatasetRecords(options?: {
        namespaceId?: string;
        tenantId?: string | null;
        datasetType?: string;
        limit?: number;
    }): ReplayDatasetRecord[];
    upsertDataMovementJobRecord(record: DataMovementJobRecord): void;
    getDataMovementJobRecord(jobId: string): DataMovementJobRecord | null;
    listDataMovementJobRecords(options?: {
        tenantId?: string | null;
        status?: DataMovementJobRecord["status"];
        movementType?: DataMovementJobRecord["movementType"];
        limit?: number;
    }): DataMovementJobRecord[];
    insertPmfValidationReport(...args: Parameters<EvolutionRepository["insertPmfValidationReport"]>): void;
    listPmfValidationReports(...args: Parameters<EvolutionRepository["listPmfValidationReports"]>): import("../../../../contracts/types/domain.js").PmfValidationReportRecord[];
    getLatestPmfValidationReport(...args: Parameters<EvolutionRepository["getLatestPmfValidationReport"]>): import("../../../../contracts/types/domain.js").PmfValidationReportRecord | null;
    listTaskBoardItems(limit?: number, tenantId?: string | null): TaskBoardItem[];
    listActiveTasksWithoutWorkflow(tenantId?: string | null): ActiveTaskWithoutWorkflow[];
    listStaleExecutions(updatedBefore: string, tenantId?: string | null): StaleExecutionRecord[];
    listRecoverableExecutingRuns(now: string, tenantId?: string | null): RuntimeRecoveryRecord[];
    listBlockedRunsAwaitingApproval(tenantId?: string | null): RuntimeRecoveryRecord[];
    listStaleRuns(staleBefore: string, tenantId?: string | null): RuntimeRecoveryRecord[];
    buildRuntimeRecoveryView(taskId: string, tenantId?: string | null): RuntimeRecoveryRecord[];
    listOrphanSessions(tenantId?: string | null): OrphanSessionRecord[];
    listWorkflowTerminalMismatches(tenantId?: string | null): WorkflowTerminalMismatchRecord[];
    listActiveTasksWithTerminalSessions(tenantId?: string | null): ActiveTaskTerminalSessionRecord[];
    listActiveExecutionActivity(): ActiveExecutionActivityRecord[];
    listActiveExecutionConflicts(): ActiveExecutionConflictRecord[];
    loadTaskSnapshot(taskId: string, tenantId?: string | null): TaskSnapshot;
    loadExecutionAuthoritativeView(executionId: string, tenantId?: string | null): ExecutionAuthoritativeView | null;
    listRuntimeRecoveryRecords(whereClause: string, params?: string[]): RuntimeRecoveryRecord[];
}
