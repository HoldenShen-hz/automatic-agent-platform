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

import { ArtifactStore, type ArtifactStoreOptions } from "../../platform/state-evidence/artifacts/artifact-store.js";
import { HealthService } from "../../platform/shared/observability/health-service.js";
import { MetricsService } from "../../platform/shared/observability/metrics-service.js";
import { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { PmfValidationReportRecord } from "../../platform/contracts/types/domain.js";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { buildMarkdownReport } from "./pmf-validation/report-format.js";
import type {
  PmfMetricCheck,
  PmfValidationExportResult,
  PmfValidationReport,
  PmfValidationRunOptions,
  PmfValidationRunResult,
  PmfValidationThresholds,
  SqlFilterClause,
} from "./pmf-validation/types.js";
import {
  buildSummary,
  calculatePercentile,
  mergeThresholds,
  roundMetric,
  safeDividePercent,
  subtractDaysIso,
  validateDivisionId,
  validateProfileName,
  validateWindowDays,
} from "./pmf-validation/utils.js";

export type {
  PmfCheckStatus,
  PmfMetricCheck,
  PmfValidationExportResult,
  PmfValidationReport,
  PmfValidationRunOptions,
  PmfValidationRunResult,
  PmfValidationThresholds,
  PmfValidationWindow,
} from "./pmf-validation/types.js";
export { DEFAULT_PMF_THRESHOLDS } from "./pmf-validation/utils.js";

/**
 * PMF Validation Service
 *
 * Runs product market fit validation against configurable thresholds.
 * Collects metrics from the database within a time window, evaluates each
 * check, and produces a verdict (pass/warn/fail) with detailed reporting.
 */
export class PmfValidationService {
  private readonly healthService: HealthService;
  private readonly metricsService: MetricsService;
  private readonly artifactStore: ArtifactStore;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
    artifactStoreOptions: ArtifactStoreOptions = {},
  ) {
    this.healthService = new HealthService(db, store);
    this.metricsService = new MetricsService(db, this.healthService);
    this.artifactStore = new ArtifactStore(artifactStoreOptions);
  }

  /**
   * Runs PMF validation and persists the report to the database.
   * Does not export artifacts.
   */
  public runValidation(options: PmfValidationRunOptions = {}): PmfValidationRunResult {
    const report = this.buildReport(options);
    const record = this.toRecord(report);
    this.store.operations.insertPmfValidationReport(record);
    return { report, record };
  }

  /**
   * Runs PMF validation, persists the report, and exports JSON and Markdown artifacts.
   * Returns the report, record, and artifact references.
   */
  public exportValidation(options: PmfValidationRunOptions = {}): PmfValidationExportResult {
    const result = this.runValidation(options);
    this.ensurePmfArtifactTask(result.report.generatedAt);

    // Export as JSON artifact
    const jsonArtifact = this.artifactStore.writeJsonArtifact({
      taskId: "pmf_validation",
      executionId: null,
      stepId: null,
      kind: "pmf_validation_report",
      fileName: `pmf-validation-${result.report.profileName}-${result.report.generatedAt}.json`,
      content: result.report,
      lineage: {
        source: "pmf_validation_service",
        reportId: result.report.reportId,
        profileName: result.report.profileName,
        verdict: result.report.verdict,
        divisionId: result.report.divisionId,
      },
    });

    // Export as Markdown artifact for human review
    const markdownArtifact = this.artifactStore.writeTextArtifact({
      taskId: "pmf_validation",
      executionId: null,
      stepId: null,
      kind: "pmf_validation_report_markdown",
      fileName: `pmf-validation-${result.report.profileName}-${result.report.generatedAt}.md`,
      mimeType: "text/markdown",
      content: buildMarkdownReport(result.report),
      lineage: {
        source: "pmf_validation_service",
        reportId: result.report.reportId,
        profileName: result.report.profileName,
        verdict: result.report.verdict,
        divisionId: result.report.divisionId,
      },
    });

    // Persist artifact records
    this.store.artifact.insertArtifact(jsonArtifact.record);
    this.store.artifact.insertArtifact(markdownArtifact.record);

    return {
      ...result,
      jsonArtifact: jsonArtifact.ref,
      markdownArtifact: markdownArtifact.ref,
    };
  }

  /** Lists historical PMF validation reports, most recent first */
  public listHistory(limit = 20): PmfValidationReportRecord[] {
    return this.store.operations.listPmfValidationReports(limit);
  }

  /** Gets the most recent PMF validation report, optionally filtered by profile */
  public getLatest(profileName?: string | null): PmfValidationReportRecord | null {
    return this.store.operations.getLatestPmfValidationReport(profileName ?? null);
  }

  /**
   * Builds a complete PMF validation report.
   *
   * Queries the database for metrics within the time window, evaluates
   * each check against thresholds, and produces a verdict.
   */
  public buildReport(options: PmfValidationRunOptions = {}): PmfValidationReport {
    const generatedAt = options.evaluatedAt ?? nowIso();
    const profileName = validateProfileName(options.profileName ?? "phase3_default");
    const divisionId = validateDivisionId(options.divisionId ?? null);
    const windowDays = validateWindowDays(options.windowDays ?? 14);
    const thresholds = mergeThresholds(options.thresholds);
    const windowStart = subtractDaysIso(generatedAt, windowDays);

    // Build SQL filters for each entity type
    const taskFilters = this.buildTaskFilterClause(windowStart, generatedAt, divisionId);
    const sessionFilters = this.buildSessionFilterClause(windowStart, generatedAt, divisionId);
    const approvalFilters = this.buildApprovalFilterClause(windowStart, generatedAt, divisionId);
    const stepFilters = this.buildStepFilterClause(windowStart, generatedAt, divisionId);

    // Query task counts and costs
    const taskCounts = this.selectRow<{
      taskCount: number;
      terminalTaskCount: number;
      successfulTaskCount: number;
      divisionCount: number;
      crossDivisionTaskCount: number;
      averageSuccessfulTaskCostUsd: number | null;
    }>(
      `SELECT
         COUNT(*) AS taskCount,
         SUM(CASE WHEN status IN ('done', 'failed', 'cancelled') THEN 1 ELSE 0 END) AS terminalTaskCount,
         SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS successfulTaskCount,
         COUNT(DISTINCT division_id) AS divisionCount,
         SUM(CASE WHEN division_id IS NOT NULL THEN 1 ELSE 0 END) AS crossDivisionTaskCount,
         AVG(CASE WHEN status = 'done' THEN actual_cost_usd END) AS averageSuccessfulTaskCostUsd
       FROM tasks
       ${taskFilters.whereClause}`,
      taskFilters.parameters,
    );

    // Query session activation counts
    const sessionCounts = this.selectRow<{
      sessionCount: number;
      activationSessionCount: number;
    }>(
      `SELECT
         COUNT(*) AS sessionCount,
         SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS activationSessionCount
       FROM sessions s
       INNER JOIN tasks t ON t.id = s.task_id
       ${sessionFilters.whereClause}`,
      sessionFilters.parameters,
    );

    // Query repeat usage (root workloads with multiple tasks)
    const repeatCounts = this.selectRow<{
      rootCount: number;
      repeatedRootCount: number;
    }>(
      `SELECT
         COUNT(*) AS rootCount,
         SUM(CASE WHEN task_count >= 2 THEN 1 ELSE 0 END) AS repeatedRootCount
       FROM (
         SELECT root_id, COUNT(*) AS task_count
         FROM tasks
         ${taskFilters.whereClause}
         GROUP BY root_id
       )`,
      taskFilters.parameters,
    );

    // Query approval resolution rates
    const approvalCounts = this.selectRow<{
      approvalCount: number;
      resolvedApprovalCount: number;
    }>(
      `SELECT
         COUNT(*) AS approvalCount,
         SUM(CASE WHEN a.status != 'requested' THEN 1 ELSE 0 END) AS resolvedApprovalCount
       FROM approvals a
       ${approvalFilters.whereClause}`,
      approvalFilters.parameters,
    );

    // Query step durations for P95 calculation
    const stepRows = this.db.connection
      .prepare(
        `SELECT s.duration_ms AS durationMs
         FROM workflow_step_outputs s
         INNER JOIN tasks t ON t.id = s.task_id
         ${stepFilters.whereClause}`,
      )
      .all(...stepFilters.parameters) as Array<{ durationMs: number | null }>;

    // Calculate derived metrics
    const durations = stepRows
      .map((row) => Number(row.durationMs ?? 0))
      .filter((value) => Number.isFinite(value) && value > 0);
    const p95StepDurationMs = calculatePercentile(durations, 0.95);
    const taskSuccessRatePct = safeDividePercent(taskCounts.successfulTaskCount, taskCounts.terminalTaskCount);
    const activationRatePct = safeDividePercent(sessionCounts.activationSessionCount, sessionCounts.sessionCount);
    const repeatUsageRatePct = safeDividePercent(repeatCounts.repeatedRootCount, repeatCounts.rootCount);
    const approvalResolutionRatePct = safeDividePercent(
      approvalCounts.resolvedApprovalCount,
      approvalCounts.approvalCount,
    );
    const crossDivisionUsageRatePct = safeDividePercent(
      taskCounts.crossDivisionTaskCount,
      taskCounts.taskCount,
    );

    // Build individual check results
    const checks: PmfMetricCheck[] = [
      {
        checkId: "sample_size",
        status:
          taskCounts.taskCount >= thresholds.minTaskCount && sessionCounts.sessionCount >= thresholds.minSessionCount
            ? "pass"
            : "fail",
        detail:
          taskCounts.taskCount >= thresholds.minTaskCount && sessionCounts.sessionCount >= thresholds.minSessionCount
            ? "task and session sample sizes meet the current PMF validation baseline"
            : "task or session sample size is below the PMF validation baseline",
        observed: Math.min(taskCounts.taskCount, sessionCounts.sessionCount),
        threshold: Math.min(thresholds.minTaskCount, thresholds.minSessionCount),
        unit: "count",
      },
      this.evaluateMinimumCheck(
        "task_success_rate",
        taskSuccessRatePct,
        thresholds.minTaskSuccessRatePct,
        "pct",
        "successful terminal tasks",
      ),
      this.evaluateMinimumCheck(
        "activation_rate",
        activationRatePct,
        thresholds.minActivationRatePct,
        "pct",
        "sessions that reached a successful task outcome",
      ),
      this.evaluateMinimumCheck(
        "repeat_usage_rate",
        repeatUsageRatePct,
        thresholds.minRepeatUsageRatePct,
        "pct",
        "root workloads with at least two tasks in the validation window",
      ),
      this.evaluateMinimumCheck(
        "approval_resolution_rate",
        approvalResolutionRatePct,
        thresholds.minApprovalResolutionRatePct,
        "pct",
        "approvals resolved inside the validation window",
      ),
      this.evaluateMaximumCheck(
        "average_success_cost",
        roundMetric(taskCounts.averageSuccessfulTaskCostUsd),
        thresholds.maxAverageSuccessfulTaskCostUsd,
        "usd",
        "average actual cost for successful tasks",
      ),
      this.evaluateMaximumCheck(
        "p95_step_duration",
        p95StepDurationMs,
        thresholds.maxP95StepDurationMs,
        "ms",
        "p95 workflow step duration",
      ),
    ];

    // Determine overall verdict
    const verdict = checks.some((check) => check.status === "fail")
      ? "fail"
      : checks.some((check) => check.status === "warn")
        ? "warn"
        : "pass";

    return {
      reportId: newId("pmf_report"),
      profileName,
      generatedAt,
      window: {
        start: windowStart,
        end: generatedAt,
        days: windowDays,
      },
      divisionId,
      verdict,
      summary: buildSummary(verdict, checks),
      metrics: {
        taskCount: taskCounts.taskCount,
        terminalTaskCount: taskCounts.terminalTaskCount,
        successfulTaskCount: taskCounts.successfulTaskCount,
        activationSessionCount: sessionCounts.activationSessionCount,
        sessionCount: sessionCounts.sessionCount,
        repeatedRootCount: repeatCounts.repeatedRootCount,
        rootCount: repeatCounts.rootCount,
        approvalCount: approvalCounts.approvalCount,
        resolvedApprovalCount: approvalCounts.resolvedApprovalCount,
        averageSuccessfulTaskCostUsd: roundMetric(taskCounts.averageSuccessfulTaskCostUsd),
        p95StepDurationMs,
        divisionCount: Number(taskCounts.divisionCount ?? 0),
        crossDivisionTaskCount: taskCounts.crossDivisionTaskCount,
        taskSuccessRatePct,
        activationRatePct,
        repeatUsageRatePct,
        approvalResolutionRatePct,
        crossDivisionUsageRatePct,
      },
      checks,
      runtimeSummary: this.metricsService.buildSummary(generatedAt),
    };
  }

  /**
   * Evaluates a minimum-threshold check (value must be >= threshold to pass).
   */
  private evaluateMinimumCheck(
    checkId: Extract<PmfMetricCheck["checkId"], "task_success_rate" | "activation_rate" | "repeat_usage_rate" | "approval_resolution_rate">,
    observed: number | null,
    threshold: number,
    unit: PmfMetricCheck["unit"],
    label: string,
  ): PmfMetricCheck {
    if (observed == null) {
      return {
        checkId,
        status: "warn",
        detail: `insufficient evidence to evaluate ${label}`,
        observed,
        threshold,
        unit,
      };
    }
    return {
      checkId,
      status: observed >= threshold ? "pass" : "fail",
      detail:
        observed >= threshold
          ? `${label} meets the current threshold`
          : `${label} is below the current threshold`,
      observed,
      threshold,
      unit,
    };
  }

  /**
   * Evaluates a maximum-threshold check (value must be <= threshold to pass).
   */
  private evaluateMaximumCheck(
    checkId: Extract<PmfMetricCheck["checkId"], "average_success_cost" | "p95_step_duration">,
    observed: number | null,
    threshold: number,
    unit: PmfMetricCheck["unit"],
    label: string,
  ): PmfMetricCheck {
    if (observed == null) {
      return {
        checkId,
        status: "warn",
        detail: `insufficient evidence to evaluate ${label}`,
        observed,
        threshold,
        unit,
      };
    }
    return {
      checkId,
      status: observed <= threshold ? "pass" : "fail",
      detail:
        observed <= threshold
          ? `${label} is within the current budget`
          : `${label} exceeds the current budget`,
      observed,
      threshold,
      unit,
    };
  }

  /** Converts a report to a database record for persistence */
  private toRecord(report: PmfValidationReport): PmfValidationReportRecord {
    return {
      id: report.reportId,
      profileName: report.profileName,
      windowStart: report.window.start,
      windowEnd: report.window.end,
      divisionId: report.divisionId,
      verdict: report.verdict,
      summaryJson: JSON.stringify({
        summary: report.summary,
        verdict: report.verdict,
        metrics: {
          taskCount: report.metrics.taskCount,
          taskSuccessRatePct: report.metrics.taskSuccessRatePct,
          activationRatePct: report.metrics.activationRatePct,
          repeatUsageRatePct: report.metrics.repeatUsageRatePct,
          averageSuccessfulTaskCostUsd: report.metrics.averageSuccessfulTaskCostUsd,
          p95StepDurationMs: report.metrics.p95StepDurationMs,
        },
      }),
      reportJson: JSON.stringify(report),
      generatedAt: report.generatedAt,
    };
  }

  /**
   * Ensures a placeholder task exists for PMF validation artifacts.
   * Required because artifacts reference a task_id.
   */
  private ensurePmfArtifactTask(createdAt: string): void {
    if (this.store.task.getTask("pmf_validation") != null) {
      return;
    }
    this.store.task.insertTask({
      id: "pmf_validation",
      parentId: null,
      rootId: "pmf_validation",
      divisionId: "system",
      title: "PMF validation evidence",
      status: "done",
      source: "system",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt,
      updatedAt: createdAt,
      completedAt: createdAt,
    });
  }

  /** Builds SQL filter for task queries with optional division scope */
  private buildTaskFilterClause(
    windowStart: string,
    windowEnd: string,
    divisionId: string | null,
  ): SqlFilterClause {
    if (divisionId == null) {
      return {
        whereClause: "WHERE tasks.created_at >= ? AND tasks.created_at <= ?",
        parameters: [windowStart, windowEnd],
      };
    }
    return {
      whereClause: "WHERE tasks.created_at >= ? AND tasks.created_at <= ? AND tasks.division_id = ?",
      parameters: [windowStart, windowEnd, divisionId],
    };
  }

  /** Builds SQL filter for session queries with optional division scope */
  private buildSessionFilterClause(
    windowStart: string,
    windowEnd: string,
    divisionId: string | null,
  ): SqlFilterClause {
    if (divisionId == null) {
      return {
        whereClause: "WHERE s.created_at >= ? AND s.created_at <= ?",
        parameters: [windowStart, windowEnd],
      };
    }
    return {
      whereClause: "WHERE s.created_at >= ? AND s.created_at <= ? AND t.division_id = ?",
      parameters: [windowStart, windowEnd, divisionId],
    };
  }

  /** Builds SQL filter for approval queries with optional division scope */
  private buildApprovalFilterClause(
    windowStart: string,
    windowEnd: string,
    divisionId: string | null,
  ): SqlFilterClause {
    if (divisionId == null) {
      return {
        whereClause: "WHERE a.created_at >= ? AND a.created_at <= ?",
        parameters: [windowStart, windowEnd],
      };
    }
    return {
      whereClause:
        "INNER JOIN tasks t ON t.id = a.task_id WHERE a.created_at >= ? AND a.created_at <= ? AND t.division_id = ?",
      parameters: [windowStart, windowEnd, divisionId],
    };
  }

  /** Builds SQL filter for step duration queries with optional division scope */
  private buildStepFilterClause(
    windowStart: string,
    windowEnd: string,
    divisionId: string | null,
  ): SqlFilterClause {
    if (divisionId == null) {
      return {
        whereClause: "WHERE s.produced_at >= ? AND s.produced_at <= ?",
        parameters: [windowStart, windowEnd],
      };
    }
    return {
      whereClause: "WHERE s.produced_at >= ? AND s.produced_at <= ? AND t.division_id = ?",
      parameters: [windowStart, windowEnd, divisionId],
    };
  }

  /** Executes a SELECT query and returns the first row as the specified type */
  private selectRow<T>(sql: string, parameters: ReadonlyArray<string | number | null>): T {
    return this.db.connection.prepare(sql).get(...parameters) as T;
  }
}
