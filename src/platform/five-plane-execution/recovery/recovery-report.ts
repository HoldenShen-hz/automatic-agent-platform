/**
 * Recovery Report
 *
 * Captures the outcome of a recovery attempt, including the action taken,
 * success/failure status, and any errors encountered.
 */

import type { RecoverySuggestedAction } from "./runtime-recovery-service.js";

/**
 * Recovery report status.
 */
export type RecoveryReportStatus = "success" | "failure" | "skipped" | "escalated";

/**
 * Recovery report for a single recovery attempt.
 */
export interface RecoveryReport {
  /** Unique identifier for this recovery attempt */
  readonly reportId: string;
  /** The execution this report is for */
  readonly executionId: string;
  /** The task this execution belongs to */
  readonly taskId: string;
  /** The recovery action that was taken */
  readonly action: RecoverySuggestedAction;
  /** Current phase in the recovery cadence */
  readonly phase: string;
  /** Attempt number within this phase */
  readonly attemptNumber: number;
  /** Overall attempt number across all phases */
  readonly overallAttemptNumber: number;
  /** Status of the recovery attempt */
  readonly status: RecoveryReportStatus;
  /** Error code if the recovery failed */
  readonly errorCode: string | null;
  /** Human-readable error message if the recovery failed */
  readonly errorMessage: string | null;
  /** Whether the execution was successfully recovered */
  readonly recovered: boolean;
  /** Timestamp when the recovery was attempted */
  readonly attemptedAt: string;
  /** Timestamp when the recovery completed */
  readonly completedAt: string | null;
  /** Duration of the recovery attempt in milliseconds */
  readonly durationMs: number | null;
}

/**
 * Summary of recovery activity across multiple reports.
 */
export interface RecoveryReportSummary {
  /** Total number of recovery attempts */
  readonly totalAttempts: number;
  /** Number of successful recoveries */
  readonly successfulRecoveries: number;
  /** Number of failed recoveries */
  readonly failedRecoveries: number;
  /** Number of skipped recoveries */
  readonly skippedRecoveries: number;
  /** Number of escalated recoveries */
  readonly escalatedRecoveries: number;
  /** Average duration of recovery attempts in milliseconds */
  readonly averageDurationMs: number | null;
}

/**
 * Creates a recovery report from a recovery attempt.
 */
export function createRecoveryReport(input: {
  readonly reportId: string;
  readonly executionId: string;
  readonly taskId: string;
  readonly action: RecoverySuggestedAction;
  readonly phase: string;
  readonly attemptNumber: number;
  readonly overallAttemptNumber: number;
  readonly status: RecoveryReportStatus;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly recovered: boolean;
  readonly attemptedAt: string;
  readonly completedAt: string | null;
}): RecoveryReport {
  const durationMs = input.completedAt != null
    ? new Date(input.completedAt).getTime() - new Date(input.attemptedAt).getTime()
    : null;

  return {
    reportId: input.reportId,
    executionId: input.executionId,
    taskId: input.taskId,
    action: input.action,
    phase: input.phase,
    attemptNumber: input.attemptNumber,
    overallAttemptNumber: input.overallAttemptNumber,
    status: input.status,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    recovered: input.recovered,
    attemptedAt: input.attemptedAt,
    completedAt: input.completedAt,
    durationMs,
  };
}

/**
 * Summarizes a collection of recovery reports.
 */
export function summarizeRecoveryReports(reports: readonly RecoveryReport[]): RecoveryReportSummary {
  if (reports.length === 0) {
    return {
      totalAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      skippedRecoveries: 0,
      escalatedRecoveries: 0,
      averageDurationMs: null,
    };
  }

  let successfulRecoveries = 0;
  let failedRecoveries = 0;
  let skippedRecoveries = 0;
  let escalatedRecoveries = 0;
  let totalDurationMs = 0;
  let countWithDuration = 0;

  for (const report of reports) {
    switch (report.status) {
      case "success":
        successfulRecoveries++;
        break;
      case "failure":
        failedRecoveries++;
        break;
      case "skipped":
        skippedRecoveries++;
        break;
      case "escalated":
        escalatedRecoveries++;
        break;
    }

    if (report.durationMs != null) {
      totalDurationMs += report.durationMs;
      countWithDuration++;
    }
  }

  return {
    totalAttempts: reports.length,
    successfulRecoveries,
    failedRecoveries,
    skippedRecoveries,
    escalatedRecoveries,
    averageDurationMs: countWithDuration > 0 ? totalDurationMs / countWithDuration : null,
  };
}