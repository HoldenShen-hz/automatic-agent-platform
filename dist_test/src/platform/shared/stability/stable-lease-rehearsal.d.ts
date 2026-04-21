/**
 * Stable lease rehearsal suite.
 *
 * This module provides scenarios that exercise the {@link ExecutionLeaseService} and
 * {@link WorkerRegistryService} to validate lease lifecycle, fencing token integrity, and
 * worker registry capacity semantics under the task-lease / fencing contract.
 *
 * **Scenarios covered:**
 * - `lease_reclaim_increments_fencing`: After a lease expires and is reclaimed, a subsequent
 *   lease grant for the same execution increments the `fencing_token`. Any writeback using the
 *   old token must be rejected.
 * - `stale_write_rejected_after_failover`: A worker acquires a lease (token=1), the lease expires,
 *   and a different worker acquires a new lease (token=2). The first worker's attempt to write
 *   with token=1 is rejected as `stale_fencing_token`.
 * - `lease_handover_preserves_lineage`: A draining worker hands an active lease to a replacement
 *   worker, producing an explicit handover lineage event while incrementing the fencing token.
 * - `worker_registry_capacity_visible`: The worker registry surfaces only workers whose
 *   capabilities and queue affinity match the dispatch criteria, and correctly identifies workers
 *   that have gone stale (missed heartbeats beyond the threshold).
 *
 * **Design contract:**
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/task_lease_and_fencing_contract.md | task_lease_and_fencing_contract.md}
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/runtime_execution_contract.md | runtime_execution_contract.md}
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/startup_consistency_and_recovery_drill_contract.md | startup_consistency_and_recovery_drill_contract.md}
 *
 * **Glossary terms:** `lease`, `fencing token`, `lease reclaim`, `lease reacquisition`,
 * `stale worker`, `worker registry`, `queue affinity`, `dispatch`, `heartbeat`
 *
 * **Architecture:** {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/architecture/00-platform-architecture.md | 01_architecture_and_technical_design.md}
 */
export interface StableLeaseRehearsalOptions {
    outputDir: string;
}
export interface StableLeaseScenarioResult {
    scenarioId: "lease_reclaim_increments_fencing" | "stale_write_rejected_after_failover" | "lease_handover_preserves_lineage" | "worker_registry_capacity_visible";
    passed: boolean;
    durationMs: number;
    summary: string;
    details: Record<string, unknown>;
}
export interface StableLeaseRehearsalReport {
    startedAt: string;
    finishedAt: string;
    outputDir: string;
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    scenarios: StableLeaseScenarioResult[];
}
export declare function runStableLeaseRehearsal(options: StableLeaseRehearsalOptions): Promise<StableLeaseRehearsalReport>;
export declare function writeStableLeaseRehearsalReport(outputFile: string, report: StableLeaseRehearsalReport): void;
