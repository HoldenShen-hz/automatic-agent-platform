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
import type { DoctorReport } from "../../control-plane/incident-control/doctor-service.js";
import type { RepairExecutionResult } from "../../execution/recovery/runtime-repair-service-root.js";
import type { StartupConsistencyReport } from "../../execution/startup/startup-consistency-checker.js";
import { type GoldenTaskCase } from "./golden-task-runner.js";
import type { StableSoakReport } from "./stable-runtime-soak-runner.js";
import type { StableValidationReport } from "./stable-runtime-validator.js";
/**
 * Required duration for full acceptance (14 days in milliseconds).
 * Full acceptance requires evidence covering this entire duration.
 */
export declare const STABLE_ACCEPTANCE_REQUIRED_DURATION_MS: number;
/**
 * P95 latency budgets by task latency band.
 * Interactive tasks should complete in 30 seconds P95.
 * Extended tasks should complete in 2 minutes P95.
 */
export declare const STABLE_ACCEPTANCE_P95_BUDGET_MS: Record<"interactive" | "extended", number>;
/** Criterion IDs evaluated by the acceptance line */
export type StableAcceptanceCriterionId = "long_run_evidence" | "manual_db_repair_free" | "orphan_queue_free" | "zombie_lock_free" | "recovery_success_rate" | "latency_budget_p95";
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
export declare function buildStableAcceptanceLineReport(options: StableAcceptanceLineOptions): StableAcceptanceLineReport;
