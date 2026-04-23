import type { DeploymentExecutionReportRecord, EnterpriseCapabilityReportRecord, EnterpriseGovernanceReportRecord, EnvironmentPromotionHistoryRecord, EnvironmentReadinessRecord, IncidentHandoffRecord, ReleaseBundleRecord, ReleaseExecutionReportRecord } from "../../../../contracts/types/domain.js";
import type { AuthoritativeSqlDatabase } from "../sqlite-database.js";
/**
 * Standalone repository boundary for release / deployment / environment readiness
 * and enterprise rollout evidence records.
 */
export declare class ReleaseRepository {
    private readonly db;
    constructor(db: AuthoritativeSqlDatabase);
    insertReleaseBundleRecord(record: ReleaseBundleRecord): void;
    insertReleaseExecutionReportRecord(record: ReleaseExecutionReportRecord): void;
    insertDeploymentExecutionReportRecord(record: DeploymentExecutionReportRecord): void;
    insertEnvironmentPromotionHistoryRecord(record: EnvironmentPromotionHistoryRecord): void;
    getReleaseBundleRecord(bundleId: string): ReleaseBundleRecord | null;
    listReleaseBundleRecords(options?: {
        environment?: string | null;
        limit?: number;
    }): ReleaseBundleRecord[];
    getDeploymentExecutionReportRecord(executionId: string): DeploymentExecutionReportRecord | null;
    getReleaseExecutionReportRecord(executionId: string): ReleaseExecutionReportRecord | null;
    listReleaseExecutionReportRecords(options?: {
        environment?: string | null;
        limit?: number;
    }): ReleaseExecutionReportRecord[];
    listDeploymentExecutionReportRecords(options?: {
        environment?: string | null;
        limit?: number;
    }): DeploymentExecutionReportRecord[];
    listEnvironmentPromotionHistoryRecords(options?: {
        targetEnvironment?: string | null;
        limit?: number;
    }): EnvironmentPromotionHistoryRecord[];
    upsertEnvironmentReadinessRecord(record: EnvironmentReadinessRecord): void;
    getActiveEnvironmentReadinessRecord(environment: EnvironmentReadinessRecord["environment"], componentType: EnvironmentReadinessRecord["componentType"], componentId: string): EnvironmentReadinessRecord | null;
    listEnvironmentReadinessRecords(environment?: EnvironmentReadinessRecord["environment"] | null, options?: {
        activeOnly?: boolean;
        limit?: number;
    }): EnvironmentReadinessRecord[];
    insertEnterpriseCapabilityReport(report: EnterpriseCapabilityReportRecord): void;
    insertIncidentHandoffRecord(record: IncidentHandoffRecord): void;
    insertEnterpriseGovernanceReport(report: EnterpriseGovernanceReportRecord): void;
    listEnterpriseCapabilityReports(limit?: number): EnterpriseCapabilityReportRecord[];
    listIncidentHandoffRecords(limit?: number): IncidentHandoffRecord[];
    listEnterpriseGovernanceReports(limit?: number): EnterpriseGovernanceReportRecord[];
}
