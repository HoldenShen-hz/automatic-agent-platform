/**
 * Stable Acceptance Line
 *
 * Converts stable evidence artifacts into a machine-readable QA-64 acceptance
 * report. The acceptance line is intentionally truthful: unless evidence
 * covers a full 14-day soak window, the acceptance line remains partial
 * even if shorter smoke/24h/72h evidence bundles are otherwise healthy.
 *
 * The acceptance line evaluates:
 * - long_run_evidence: Soak duration coverage (requires 14 days for full pass)
 * - manual_db_repair_free: No database manual intervention signals
 * - orphan_queue_free: No orphan queue claims detected
 * - zombie_lock_free: No zombie or expired file locks detected
 * - recovery_success_rate: Automatic recovery success rate
 * - latency_budget_p95: P95 latency within acceptable bounds per latency band
 *
 * @see stable-evidence-bundle.ts for the evidence bundle consumed here
 * @see docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md for QA-64
 */

import type { DoctorReport } from "../five-plane-control-plane/incident-control/doctor-service.js";
import type { RepairExecutionResult } from "../five-plane-execution/recovery/runtime-repair-service.js";
import type { RepairAction, StartupConsistencyReport } from "../five-plane-execution/startup/startup-consistency-checker.js";
import {
  SINGLE_TASK_GOLDEN_TASKS,
  type GoldenTaskCase,
  type GoldenTaskLatencyBand,
} from "./golden-task-runner.js";
import type { StableSoakReport } from "./stable-runtime-soak-runner.js";
import type { StableValidationReport, StableValidationRun } from "./stable-runtime-validator.js";

/**
 * Required duration for full acceptance (14 days in milliseconds).
 * Full acceptance requires evidence covering this entire duration.
 */
export const STABLE_ACCEPTANCE_REQUIRED_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * P95 latency budgets by task latency band.
 * Interactive tasks should complete in 30 seconds P95.
 * Extended tasks should complete in 2 minutes P95.
 */
export const STABLE_ACCEPTANCE_P95_BUDGET_MS: Record<"interactive" | "extended", number> = {
  interactive: 30_000,
  extended: 120_000,
};

/** Criterion IDs evaluated by the acceptance line */
export type StableAcceptanceCriterionId =
  | "long_run_evidence"
  | "manual_db_repair_free"
  | "orphan_queue_free"
  | "zombie_lock_free"
  | "recovery_success_rate"
  | "latency_budget_p95";

/** A single acceptance criterion evaluation */
export interface StableAcceptanceCriterion {
  criterionId: StableAcceptanceCriterionId;
  status: "pass" | "partial" | "fail";
  detail: string;
  metrics: Record<string, number | string | boolean | null>;
}

/** Latency budget status for a specific latency band */
export interface StableAcceptanceLatencyBudgetStatus {
  latencyBand: "interactive" | "extended";
  budgetMs: number;
  sampleCount: number;
  p95DurationMs: number | null;
  maxDurationMs: number | null;
  status: "pass" | "partial" | "fail";
}

/** Complete acceptance line evaluation report */
export interface StableAcceptanceLineReport {
  evaluatedAt: string;
  status: "pass" | "partial" | "fail";
  profileName: string;
  /** Notes about the truthfulness of the acceptance claim */
  truthNotes: string[];
  criteria: StableAcceptanceCriterion[];
  observed: {
    soakDurationMs: number;
    requiredDurationMs: number;
    longRunCoveragePct: number;
    manualDbRepairSignalCount: number;
    orphanQueueClaimCount: number;
    zombieLockCount: number;
    recoveryAttemptCount: number;
    recoverySucceededCount: number;
    recoverySuccessRatePct: number;
  };
  latencyBudget: StableAcceptanceLatencyBudgetStatus[];
}

/** Options for building an acceptance line report */
export interface StableAcceptanceLineOptions {
  profileName: string;
  validationReport: StableValidationReport;
  soakReport: StableSoakReport;
  doctorReport: Pick<DoctorReport, "status" | "lockSummary" | "eventBacklogSummary">;
  repairReport: {
    before: Pick<StartupConsistencyReport, "status" | "findings" | "repairActions">;
    applied: readonly RepairExecutionResult[];
    after: Pick<StartupConsistencyReport, "status" | "findings" | "repairActions">;
  };
  cases?: GoldenTaskCase[];
}

/** Rounds a metric to 2 decimal places */
function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Formats duration in milliseconds as hours */
function formatDurationHours(durationMs: number): string {
  return `${roundMetric(durationMs / (60 * 60 * 1000))}h`;
}

/** Calculates a percentile from a set of values */
function calculatePercentile(values: readonly number[], percentile: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * percentile) - 1);
  return roundMetric(sorted[index] ?? sorted[sorted.length - 1] ?? 0);
}

/** Flattens validation runs from a validation report */
function flattenValidationRuns(report: StableValidationReport): StableValidationRun[] {
  return report.runs;
}

/** Flattens validation runs from a soak report */
function flattenSoakRuns(report: StableSoakReport): StableValidationRun[] {
  return report.cycles.flatMap((cycle) => cycle.report.runs);
}

/** Finds a repair result matching a specific action */
function findAppliedRepairResult(
  applied: readonly RepairExecutionResult[],
  action: RepairAction,
): RepairExecutionResult | undefined {
  return applied.find((result) => result.action === action.action && result.targetId === action.targetId);
}

/** Builds latency budget statuses for each latency band */
function buildLatencyBudgetStatuses(
  runs: readonly StableValidationRun[],
  cases: readonly GoldenTaskCase[],
): StableAcceptanceLatencyBudgetStatus[] {
  const caseLatencyBands = new Map(cases.map((testCase) => [testCase.id, testCase.metadata.latencyBand]));

  return (Object.entries(STABLE_ACCEPTANCE_P95_BUDGET_MS) as Array<[GoldenTaskLatencyBand, number]>).map(
    ([latencyBand, budgetMs]) => {
      const matchingRuns = runs.filter((run) => caseLatencyBands.get(run.caseId) === latencyBand);
      const durations = matchingRuns.map((run) => run.durationMs);
      const p95DurationMs = calculatePercentile(durations, 0.95);
      const maxDurationMs = durations.length > 0 ? roundMetric(Math.max(...durations)) : null;

      return {
        latencyBand,
        budgetMs,
        sampleCount: durations.length,
        p95DurationMs,
        maxDurationMs,
        status:
          durations.length === 0
            ? "partial"
            : (p95DurationMs ?? Number.POSITIVE_INFINITY) <= budgetMs
              ? "pass"
              : "fail",
      };
    },
  );
}

/**
 * Builds a QA-64 stable acceptance line report from evidence.
 *
 * Evaluates all acceptance criteria against the provided evidence
 * including validation runs, soak reports, doctor health checks, and
 * repair results. Produces truth notes explaining limitations of
 * partial acceptance claims.
 *
 * @param options - Acceptance line evaluation options
 * @returns Complete acceptance line report
 */
export function buildStableAcceptanceLineReport(
  options: StableAcceptanceLineOptions,
): StableAcceptanceLineReport {
  const cases = options.cases ?? SINGLE_TASK_GOLDEN_TASKS;

  // Flatten all runs from validation and soak
  const validationRuns = flattenValidationRuns(options.validationReport);
  const soakRuns = flattenSoakRuns(options.soakReport);
  const allRuns = [...validationRuns, ...soakRuns];

  // Compute latency budget status
  const latencyBudget = buildLatencyBudgetStatuses(allRuns, cases);
  const soakDurationMs = options.soakReport.wallClockDurationMs;
  const longRunCoveragePct = roundMetric((soakDurationMs / STABLE_ACCEPTANCE_REQUIRED_DURATION_MS) * 100);
  const hasValidationFailures =
    options.validationReport.failedRuns > 0
    || options.validationReport.integrityFailures > 0
    || options.validationReport.backupFailures > 0;
  const hasSoakFailures =
    options.soakReport.failedRuns > 0
    || options.soakReport.integrityFailures > 0
    || options.soakReport.backupFailures > 0;

  // Count orphan queue claims from repair findings
  const orphanQueueClaimCount = options.repairReport.before.findings.filter(
    (finding) => finding.code === "orphan_queue_claim",
  ).length;

  // Count zombie/expired locks from repair findings and doctor lock summary
  const zombieLockCount = Math.max(
    options.repairReport.before.findings.filter((finding) => finding.code === "expired_file_lock").length,
    options.doctorReport.lockSummary.expiredLockCount,
  );

  // Count database manual intervention signals
  const manualDbRepairSignalCount =
    options.repairReport.before.repairActions.filter(
      (action) => action.action === "manual_intervention_required" && action.targetType === "database",
    ).length +
    options.repairReport.before.findings.filter((finding) => finding.entityType === "database").length;

  // Compute automatic recovery statistics
  const automaticRecoveryActions = options.repairReport.before.repairActions.filter(
    (action) => action.action !== "manual_intervention_required",
  );
  const recoverySucceededCount = automaticRecoveryActions.filter((action) =>
    findAppliedRepairResult(options.repairReport.applied, action)?.applied === true,
  ).length;
  const recoveryAttemptCount = automaticRecoveryActions.length;
  const recoverySuccessRatePct =
    recoveryAttemptCount === 0 ? 100 : roundMetric((recoverySucceededCount / recoveryAttemptCount) * 100);

  // Build all criteria
  const criteria: StableAcceptanceCriterion[] = [
    {
      criterionId: "long_run_evidence",
      status:
        hasValidationFailures || hasSoakFailures
          ? "fail"
          : soakDurationMs >= STABLE_ACCEPTANCE_REQUIRED_DURATION_MS
            ? "pass"
            : "partial",
      detail:
        hasValidationFailures || hasSoakFailures
          ? `stable evidence is not clean: validationFailedRuns=${options.validationReport.failedRuns}, validationIntegrityFailures=${options.validationReport.integrityFailures}, validationBackupFailures=${options.validationReport.backupFailures}, soakFailedRuns=${options.soakReport.failedRuns}, soakIntegrityFailures=${options.soakReport.integrityFailures}, soakBackupFailures=${options.soakReport.backupFailures}`
          : soakDurationMs >= STABLE_ACCEPTANCE_REQUIRED_DURATION_MS
            ? `observed soak duration ${formatDurationHours(soakDurationMs)} meets the 14-day acceptance line`
            : `observed soak duration ${formatDurationHours(soakDurationMs)} is below the 14-day acceptance line (${formatDurationHours(STABLE_ACCEPTANCE_REQUIRED_DURATION_MS)})`,
      metrics: {
        soakDurationMs,
        requiredDurationMs: STABLE_ACCEPTANCE_REQUIRED_DURATION_MS,
        longRunCoveragePct,
        validationFailedRuns: options.validationReport.failedRuns,
        validationIntegrityFailures: options.validationReport.integrityFailures,
        validationBackupFailures: options.validationReport.backupFailures,
        failedRuns: options.soakReport.failedRuns,
        integrityFailures: options.soakReport.integrityFailures,
        backupFailures: options.soakReport.backupFailures,
      },
    },
    {
      criterionId: "manual_db_repair_free",
      status:
        manualDbRepairSignalCount === 0
          ? "pass"
          : manualDbRepairSignalCount === 1
            ? "partial"
            : "fail",
      detail:
        manualDbRepairSignalCount === 0
          ? "no database manual intervention signal was recorded in the acceptance evidence"
          : `database-side repair required manual intervention signals: ${manualDbRepairSignalCount}`,
      metrics: {
        manualDbRepairSignalCount,
      },
    },
    {
      criterionId: "orphan_queue_free",
      status: orphanQueueClaimCount === 0 ? "pass" : "fail",
      detail:
        orphanQueueClaimCount === 0
          ? "no orphan queue claim was detected during acceptance evidence collection"
          : `orphan queue claims detected before repair: ${orphanQueueClaimCount}`,
      metrics: {
        orphanQueueClaimCount,
        claimedBacklogSize: options.doctorReport.eventBacklogSummary.claimedBacklogSize,
      },
    },
    {
      criterionId: "zombie_lock_free",
      status: zombieLockCount === 0 ? "pass" : "fail",
      detail:
        zombieLockCount === 0
          ? "no zombie lock or expired file lock was detected"
          : `zombie lock signals detected: ${zombieLockCount}`,
      metrics: {
        zombieLockCount,
        totalLocks: options.doctorReport.lockSummary.totalLocks,
        expiredLockCount: options.doctorReport.lockSummary.expiredLockCount,
      },
    },
    {
      criterionId: "recovery_success_rate",
      status:
        recoverySuccessRatePct === 100 && options.repairReport.after.status === "pass"
          ? "pass"
          : "fail",
      detail:
        recoverySuccessRatePct === 100 && options.repairReport.after.status === "pass"
          ? "automatic recovery success rate is 100% and post-repair consistency passed"
          : `automatic recovery success rate is ${recoverySuccessRatePct}% with post-repair status ${options.repairReport.after.status}`,
      metrics: {
        recoveryAttemptCount,
        recoverySucceededCount,
        recoverySuccessRatePct,
        repairAfterPass: options.repairReport.after.status === "pass",
      },
    },
    {
      criterionId: "latency_budget_p95",
      status: latencyBudget.some((item) => item.status === "fail")
        ? "fail"
        : latencyBudget.some((item) => item.status === "partial")
          ? "partial"
          : "pass",
      detail: latencyBudget
        .map((item) =>
          item.sampleCount === 0
            ? `${item.latencyBand}:no_samples`
            : `${item.latencyBand}:p95=${item.p95DurationMs}ms/budget=${item.budgetMs}ms`,
        )
        .join(", "),
      metrics: {
        interactiveP95Ms: latencyBudget.find((item) => item.latencyBand === "interactive")?.p95DurationMs ?? null,
        interactiveBudgetMs: STABLE_ACCEPTANCE_P95_BUDGET_MS.interactive,
        extendedP95Ms: latencyBudget.find((item) => item.latencyBand === "extended")?.p95DurationMs ?? null,
        extendedBudgetMs: STABLE_ACCEPTANCE_P95_BUDGET_MS.extended,
      },
    },
  ];

  // Build truth notes explaining acceptance claim limitations
  const hasFail = criteria.some((criterion) => criterion.status === "fail");
  const hasPartial = criteria.some((criterion) => criterion.status === "partial");
  const truthNotes: string[] = [];
  if (soakDurationMs < STABLE_ACCEPTANCE_REQUIRED_DURATION_MS) {
    truthNotes.push(
      `Current evidence covers ${formatDurationHours(soakDurationMs)} of soak duration; this does not truthfully prove a full 14-day continuous run.`,
    );
  }
  if (options.profileName === "smoke") {
    truthNotes.push("Smoke evidence only proves short-run readiness and must not be treated as long-run acceptance.");
  }

  return {
    evaluatedAt: new Date().toISOString(),
    status: hasFail ? "fail" : hasPartial ? "partial" : "pass",
    profileName: options.profileName,
    truthNotes,
    criteria,
    observed: {
      soakDurationMs,
      requiredDurationMs: STABLE_ACCEPTANCE_REQUIRED_DURATION_MS,
      longRunCoveragePct,
      manualDbRepairSignalCount,
      orphanQueueClaimCount,
      zombieLockCount,
      recoveryAttemptCount,
      recoverySucceededCount,
      recoverySuccessRatePct,
    },
    latencyBudget,
  };
}
