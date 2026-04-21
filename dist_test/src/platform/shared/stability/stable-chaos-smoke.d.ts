/**
 * Stable chaos smoke test suite for runtime integrity and recovery scenarios.
 *
 * This module provides end-to-end "smoke tests" that verify the system's ability to detect
 * and repair inconsistent runtime state under adversarial conditions. Each scenario seeds a
 * specific broken state (stale execution, orphan session, orphan queue claim, duplicate approval,
 * missing ack) and validates that the startup consistency checker and runtime repair service
 * restore the system to a clean state.
 *
 * **Chaos scenarios covered:**
 * - `stale_execution_repair`: Detects executions stuck in `executing` beyond the stale threshold
 *   and requeues them into a safe `pending` state.
 * - `orphan_session_cleanup`: Detects sessions that outlive their parent task and closes them.
 * - `orphan_queue_claim_reconciled_via_runtime_repair`: Detects dispatch tickets whose authoritative
 *   lease was released without a corresponding writeback and replaces them with new pending tickets.
 * - `duplicate_approval_response_idempotent`: Verifies that applying the same approval decision twice
 *   does not double-advance the approval state machine.
 * - `missing_ack_rebuild_and_replay`: Detects event-consumer ack gaps and rebuilds the missing rows.
 *
 * **Design contract:**
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md | quality_engineering_and_chaos_testing_contract.md}
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/startup_consistency_and_recovery_drill_contract.md | startup_consistency_and_recovery_drill_contract.md}
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/runtime_execution_contract.md | runtime_execution_contract.md}
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/task_lease_and_fencing_contract.md | task_lease_and_fencing_contract.md}
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/approval_and_hitl_contract.md | approval_and_hitl_contract.md}
 *
 * **Glossary terms:** `task`, `execution`, `session`, `lease`, `fencing token`, `execution ticket`,
 * `orphan queue claim`, `stale execution`, `startup consistency checker`, `runtime repair service`
 *
 * **Architecture:** {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/architecture/00-platform-architecture.md | 01_architecture_and_technical_design.md}
 */
export interface StableChaosSmokeOptions {
    outputDir: string;
}
export interface StableChaosScenarioResult {
    scenarioId: string;
    passed: boolean;
    durationMs: number;
    summary: string;
    details: Record<string, unknown>;
}
export interface StableChaosSmokeReport {
    startedAt: string;
    finishedAt: string;
    outputDir: string;
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    scenarios: StableChaosScenarioResult[];
}
export declare function runStableChaosSmoke(options: StableChaosSmokeOptions): Promise<StableChaosSmokeReport>;
export declare function writeStableChaosSmokeReport(outputFile: string, report: StableChaosSmokeReport): void;
