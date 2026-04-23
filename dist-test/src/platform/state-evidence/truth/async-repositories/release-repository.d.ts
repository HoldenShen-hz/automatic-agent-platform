/**
 * AsyncReleaseRepository - Async data access for release bundles, deployment execution reports, and environment readiness.
 */
import type { DeploymentExecutionReportRecord, EnterpriseCapabilityReportRecord, EnterpriseGovernanceReportRecord, EnvironmentPromotionHistoryRecord, IncidentHandoffRecord, ReleaseBundleRecord, ReleaseExecutionReportRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
export declare class AsyncReleaseRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    insertReleaseBundleRecord(record: ReleaseBundleRecord): Promise<void>;
    insertReleaseExecutionReportRecord(record: ReleaseExecutionReportRecord): Promise<void>;
    insertDeploymentExecutionReportRecord(record: DeploymentExecutionReportRecord): Promise<void>;
    insertEnvironmentPromotionHistoryRecord(record: EnvironmentPromotionHistoryRecord): Promise<void>;
    getReleaseBundleRecord(bundleId: string): Promise<ReleaseBundleRecord | null>;
    listReleaseBundleRecords(options?: {
        environment?: string | null;
        limit?: number;
    }): Promise<ReleaseBundleRecord[]>;
    insertEnterpriseCapabilityReport(report: EnterpriseCapabilityReportRecord): Promise<void>;
    insertIncidentHandoffRecord(record: IncidentHandoffRecord): Promise<void>;
    insertEnterpriseGovernanceReport(report: EnterpriseGovernanceReportRecord): Promise<void>;
    listEnterpriseCapabilityReports(limit?: number): Promise<EnterpriseCapabilityReportRecord[]>;
    listIncidentHandoffRecords(limit?: number): Promise<IncidentHandoffRecord[]>;
    listEnterpriseGovernanceReports(limit?: number): Promise<EnterpriseGovernanceReportRecord[]>;
}
