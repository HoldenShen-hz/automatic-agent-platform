/**
 * Stable worker-writeback rehearsal suite.
 *
 * This module provides scenarios that exercise the
 * {@link ExecutionWorkerWritebackService} lifecycle: how workers report execution completion
 * and how the system enforces lease / fencing integrity on the writeback path.
 *
 * **Scenarios covered:**
 * - `worker_writeback_completes_execution`: A worker with a valid lease and fencing token calls
 *   `recordWriteback` with a terminal status. The writeback is accepted and the system transitions
 *   the task, workflow, session, and execution to terminal states while releasing the lease and
 *   clearing the worker's running-execution list.
 * - `duplicate_writeback_rejected`: After a successful writeback marks the execution terminal,
 *   a second writeback with the same lease/fencing is rejected with `execution_not_executing`.
 * - `stale_fencing_writeback_rejected`: The original worker lease expires, is reclaimed, and a
 *   second worker acquires a new lease with an incremented fencing token. The first worker's
 *   writeback (using the old token) is rejected with `stale_fencing_token`.
 *
 * These scenarios validate the writeback path described in the task-lease / fencing contract and
 * the execution plane contract.
 *
 * **Design contract:**
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/task_lease_and_fencing_contract.md | task_lease_and_fencing_contract.md}
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/execution_plane_contract.md | execution_plane_contract.md}
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/runtime_execution_contract.md | runtime_execution_contract.md}
 *
 * **Glossary terms:** `lease`, `fencing token`, `writeback`, `stale fencing token`, `lease reclaim`,
 * `lease reacquisition`, `worker`, `execution ticket`, `terminal status`
 *
 * **Architecture:** {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/architecture/00-platform-architecture.md | 01_architecture_and_technical_design.md}
 */
export interface StableWorkerWritebackRehearsalOptions {
    outputDir: string;
}
export interface StableWorkerWritebackScenarioResult {
    scenarioId: "worker_writeback_completes_execution" | "duplicate_writeback_rejected" | "stale_fencing_writeback_rejected";
    passed: boolean;
    durationMs: number;
    summary: string;
    details: Record<string, unknown>;
}
export interface StableWorkerWritebackRehearsalReport {
    startedAt: string;
    finishedAt: string;
    outputDir: string;
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    scenarios: StableWorkerWritebackScenarioResult[];
}
export declare function runStableWorkerWritebackRehearsal(options: StableWorkerWritebackRehearsalOptions): Promise<StableWorkerWritebackRehearsalReport>;
export declare function writeStableWorkerWritebackRehearsalReport(path: string, report: StableWorkerWritebackRehearsalReport): void;
