/**
 * Stable dispatch-reconciliation rehearsal suite.
 *
 * This module provides targeted scenarios that exercise the
 * {@link ExecutionDispatchReconciliationService} ability to detect and repair dispatch-level
 * anomalies. Dispatch reconciliation runs as a periodic scan that identifies tickets which are
 * in an inconsistent state relative to their authoritative execution lease.
 *
 * **Scenarios covered:**
 * - `orphan_claim_requeued`: A dispatch ticket was claimed by a worker, but the lease was released
 *   without a writeback. The reconciliation scan detects the `orphan_queue_claim` issue and
 *   creates a replacement ticket in `pending` state while marking the original as `expired`.
 * - `terminal_execution_ticket_cancelled`: An execution reached a terminal state (`succeeded`,
 *   `failed`, etc.) but an active dispatch ticket still points to it. Reconciliation cancels
 *   the stale ticket.
 *
 * These scenarios validate the reconciliation loop described in the execution plane contract and
 * the task-lease / fencing contract.
 *
 * **Design contract:**
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/execution_plane_contract.md | execution_plane_contract.md}
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/runtime_execution_contract.md | runtime_execution_contract.md}
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/task_lease_and_fencing_contract.md | task_lease_and_fencing_contract.md}
 *
 * **Glossary terms:** `execution ticket`, `lease`, `fencing token`, `orphan queue claim`,
 * `dispatch`, `terminal execution`, `reconciliation scan`, `reconciliation repair`
 *
 * **Architecture:** {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/architecture/00-platform-architecture.md | 01_architecture_and_technical_design.md}
 */
export interface StableDispatchReconciliationRehearsalOptions {
    outputDir: string;
}
export interface StableDispatchReconciliationScenarioResult {
    scenarioId: "orphan_claim_requeued" | "terminal_execution_ticket_cancelled";
    passed: boolean;
    durationMs: number;
    summary: string;
    details: Record<string, unknown>;
}
export interface StableDispatchReconciliationRehearsalReport {
    startedAt: string;
    finishedAt: string;
    outputDir: string;
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    scenarios: StableDispatchReconciliationScenarioResult[];
}
export declare function runStableDispatchReconciliationRehearsal(options: StableDispatchReconciliationRehearsalOptions): Promise<StableDispatchReconciliationRehearsalReport>;
export declare function writeStableDispatchReconciliationRehearsalReport(path: string, report: StableDispatchReconciliationRehearsalReport): void;
