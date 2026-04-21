/**
 * PMF Validation Service
 *
 * Evaluates Product Market Fit (PMF) by validating a set of engagement and quality
 * metrics against configurable thresholds. Runs within a configurable time window
 * (default 14 days) and produces a verdict (pass/warn/fail) along with detailed
 * metric checks.
 *
 * PMF validation evaluates:
 * - sample_size: Minimum task and session counts to ensure statistical significance
 * - task_success_rate: Percentage of terminal tasks that completed successfully
 * - activation_rate: Percentage of sessions that reached a successful task outcome
 * - repeat_usage_rate: Percentage of root workloads with multiple tasks (stickiness)
 * - approval_resolution_rate: Percentage of approvals resolved within the window
 * - average_success_cost: Cost efficiency of successful tasks
 * - p95_step_duration: P95 workflow step duration as a latency proxy
 *
 * Each check is evaluated against threshold values and returns pass/warn/fail status.
 * The overall verdict is fail if any check fails, warn if any check warns, otherwise pass.
 *
 * Reports are persisted to the database and exported as JSON and Markdown artifacts.
 *
 * @see docs_zh/contracts/billing_contract.md for related billing and validation contracts
 */
import { type ArtifactStoreOptions } from "../../platform/state-evidence/artifacts/artifact-store.js";
import { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { PmfValidationReportRecord } from "../../platform/contracts/types/domain.js";
import type { PmfValidationExportResult, PmfValidationReport, PmfValidationRunOptions, PmfValidationRunResult } from "./pmf-validation/types.js";
export type { PmfCheckStatus, PmfMetricCheck, PmfValidationExportResult, PmfValidationReport, PmfValidationRunOptions, PmfValidationRunResult, PmfValidationThresholds, PmfValidationWindow, } from "./pmf-validation/types.js";
export { DEFAULT_PMF_THRESHOLDS } from "./pmf-validation/utils.js";
/**
 * PMF Validation Service
 *
 * Runs product market fit validation against configurable thresholds.
 * Collects metrics from the database within a time window, evaluates each
 * check, and produces a verdict (pass/warn/fail) with detailed reporting.
 */
export declare class PmfValidationService {
    private readonly db;
    private readonly store;
    private readonly healthService;
    private readonly metricsService;
    private readonly artifactStore;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, artifactStoreOptions?: ArtifactStoreOptions);
    /**
     * Runs PMF validation and persists the report to the database.
     * Does not export artifacts.
     */
    runValidation(options?: PmfValidationRunOptions): PmfValidationRunResult;
    /**
     * Runs PMF validation, persists the report, and exports JSON and Markdown artifacts.
     * Returns the report, record, and artifact references.
     */
    exportValidation(options?: PmfValidationRunOptions): PmfValidationExportResult;
    /** Lists historical PMF validation reports, most recent first */
    listHistory(limit?: number): PmfValidationReportRecord[];
    /** Gets the most recent PMF validation report, optionally filtered by profile */
    getLatest(profileName?: string | null): PmfValidationReportRecord | null;
    /**
     * Builds a complete PMF validation report.
     *
     * Queries the database for metrics within the time window, evaluates
     * each check against thresholds, and produces a verdict.
     */
    buildReport(options?: PmfValidationRunOptions): PmfValidationReport;
    /**
     * Evaluates a minimum-threshold check (value must be >= threshold to pass).
     */
    private evaluateMinimumCheck;
    /**
     * Evaluates a maximum-threshold check (value must be <= threshold to pass).
     */
    private evaluateMaximumCheck;
    /** Converts a report to a database record for persistence */
    private toRecord;
    /**
     * Ensures a placeholder task exists for PMF validation artifacts.
     * Required because artifacts reference a task_id.
     */
    private ensurePmfArtifactTask;
    /** Builds SQL filter for task queries with optional division scope */
    private buildTaskFilterClause;
    /** Builds SQL filter for session queries with optional division scope */
    private buildSessionFilterClause;
    /** Builds SQL filter for approval queries with optional division scope */
    private buildApprovalFilterClause;
    /** Builds SQL filter for step duration queries with optional division scope */
    private buildStepFilterClause;
    /** Executes a SELECT query and returns the first row as the specified type */
    private selectRow;
}
