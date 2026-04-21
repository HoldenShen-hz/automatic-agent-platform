/**
 * Stable Concurrency Rehearsal Module
 *
 * This module validates concurrency control mechanisms in the runtime system.
 * It tests two critical scenarios:
 *
 * 1. Expired Lock Release: Verifies that file locks that have exceeded their
 *    expiration time are properly detected and released by the repair service.
 *    This prevents resource leaks from orphaned locks.
 *
 * 2. Active Execution Conflict (Fail-Closed): Verifies that when multiple
 *    executions exist for the same task in conflicting states (e.g., one
 *    executing, another in prechecking), the system fails closed and requires
 *    manual intervention rather than attempting automatic resolution.
 *
 * These tests ensure the system's concurrency safety guarantees.
 *
 * @see {@link docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md}
 *   Quality engineering contract defining concurrency and fail-closed behavior tests
 * @see {@link docs_zh/contracts/file_lock_contract.md}
 *   File lock contract defining lock lifecycle and expiration semantics
 * @see {@link docs_zh/architecture/00-platform-architecture.md}
 *   Architecture document for concurrency control design
 * @see {@link docs_zh/governance/glossary_and_terminology.md}
 *   Glossary defining concurrency-related terminology (locks, leases, fencing)
 */
/**
 * Options for the concurrency rehearsal test runner.
 */
export interface StableConcurrencyRehearsalOptions {
    /** Directory where test databases and reports will be written */
    outputDir: string;
}
/**
 * Result of a single concurrency scenario test.
 */
export interface StableConcurrencyScenarioResult {
    /** Unique identifier for the scenario tested */
    scenarioId: "expired_lock_released" | "active_execution_conflict_fail_closed" | "competing_write_transactions_fail_closed";
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
 * Aggregated report from all concurrency rehearsal scenarios.
 */
export interface StableConcurrencyRehearsalReport {
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
    scenarios: StableConcurrencyScenarioResult[];
}
/**
 * Runs all concurrency rehearsal scenarios and produces an aggregated report.
 *
 * Executes three scenarios:
 * 1. Expired lock release - verifies stale locks are cleaned up
 * 2. Active execution conflict - verifies fail-closed behavior
 * 3. Competing write transactions - verifies SQLite write contention fails closed with a stable error
 *
 * @param options - Rehearsal options including output directory
 * @returns Aggregated report with all scenario results
 */
export declare function runStableConcurrencyRehearsal(options: StableConcurrencyRehearsalOptions): Promise<StableConcurrencyRehearsalReport>;
/**
 * Writes the concurrency rehearsal report to a JSON file.
 *
 * @param outputFile - Path where the report JSON should be written
 * @param report - The report data to serialize and write
 */
export declare function writeStableConcurrencyRehearsalReport(outputFile: string, report: StableConcurrencyRehearsalReport): void;
