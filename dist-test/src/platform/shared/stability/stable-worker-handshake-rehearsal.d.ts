/**
 * Stable Worker Handshake Rehearsal Module
 *
 * This module validates the worker handshake protocol - the mechanism by which
 * workers claim execution leases and maintain them through heartbeat signals.
 * It tests three critical scenarios:
 *
 * 1. Worker Claim: Verifies that when a worker claims an execution:
 *    - The ticket is consumed
 *    - The execution transitions to "executing" status
 *    - The worker's running executions list is updated
 *
 * 2. Heartbeat Renewal: Verifies that worker heartbeats:
 *    - Are accepted by the handshake service
 *    - Update the lease's lastHeartbeatAt timestamp
 *    - Are persisted as heartbeat snapshots in storage
 *
 * 3. Stale Fencing Rejection: Verifies that after a lease expires and is
 *    re-acquired by another party (with a new fencing token), the original
 *    worker cannot continue with heartbeats using the stale token.
 *
 * These tests ensure the integrity of the worker-to-execution ownership protocol.
 *
 * @see {@link docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md}
 *   Quality engineering contract defining handshake and lease lifecycle tests
 * @see {@link docs_zh/architecture/00-platform-architecture.md}
 *   Architecture document for worker handshake protocol design
 * @see {@link docs_zh/governance/glossary_and_terminology.md}
 *   Glossary defining handshake, lease, fencing token, and heartbeat terminology
 */
/**
 * Options for the worker handshake rehearsal test runner.
 */
export interface StableWorkerHandshakeRehearsalOptions {
    /** Directory where test databases and reports will be written */
    outputDir: string;
}
/**
 * Result of a single worker handshake scenario test.
 */
export interface StableWorkerHandshakeScenarioResult {
    /** Unique identifier for the scenario tested */
    scenarioId: "worker_claim_consumes_ticket" | "worker_heartbeat_renews_lease" | "stale_fencing_handshake_rejected";
    /** Whether the scenario passed all assertions */
    passed: boolean;
    /** Time taken to run the scenario in milliseconds */
    durationMs: number;
    /** Human-readable summary of what was tested and the outcome */
    summary: string;
    /** Detailed results and state snapshots from the scenario */
    details: Record<string, unknown>;
}
/**
 * Aggregated report from all worker handshake rehearsal scenarios.
 */
export interface StableWorkerHandshakeRehearsalReport {
    /** ISO timestamp when the rehearsal started */
    startedAt: string;
    /** ISO timestamp when the rehearsal finished */
    finishedAt: string;
    /** Directory containing all generated artifacts */
    outputDir: string;
    /** Total number of scenarios run */
    totalScenarios: number;
    /** Number of scenarios that passed */
    passedScenarios: number;
    /** Number of scenarios that failed */
    failedScenarios: number;
    /** Individual results for each scenario */
    scenarios: StableWorkerHandshakeScenarioResult[];
}
/**
 * Runs all worker handshake rehearsal scenarios and produces an aggregated report.
 *
 * Executes three scenarios:
 * 1. Worker claim - verifies ticket consumption and execution state transition
 * 2. Heartbeat renewal - verifies lease renewal and liveness recording
 * 3. Stale fencing - verifies that stale workers are rejected after failover
 *
 * @param options - Rehearsal options including output directory
 * @returns Aggregated report with all scenario results
 */
export declare function runStableWorkerHandshakeRehearsal(options: StableWorkerHandshakeRehearsalOptions): Promise<StableWorkerHandshakeRehearsalReport>;
/**
 * Writes the worker handshake rehearsal report to a JSON file.
 *
 * @param outputFile - Path where the report JSON should be written
 * @param report - The report data to serialize and write
 */
export declare function writeStableWorkerHandshakeRehearsalReport(outputFile: string, report: StableWorkerHandshakeRehearsalReport): void;
