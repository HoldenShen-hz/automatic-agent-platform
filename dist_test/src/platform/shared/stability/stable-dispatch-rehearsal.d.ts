/**
 * Stable Dispatch Rehearsal Module
 *
 * This module validates the execution dispatch service behavior through
 * scenario-based testing. It verifies that the dispatcher correctly:
 * - Selects capable workers based on required capabilities
 * - Respects dispatch_after timing constraints
 * - Handles capability gaps by leaving tickets pending
 *
 * Each scenario is measured for duration and produces detailed results
 * for post-analysis of dispatch decisions.
 *
 * @see {@link docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md}
 *   Quality engineering contract defining dispatch and capability-based routing tests
 * @see {@link docs_zh/architecture/00-platform-architecture.md}
 *   Main architecture document for dispatch service design
 * @see {@link docs_zh/governance/glossary_and_terminology.md}
 *   Glossary defining dispatch-related terminology (tickets, leases, capabilities)
 */
/**
 * Options for the dispatch rehearsal test runner.
 */
export interface StableDispatchRehearsalOptions {
    /** Directory where test databases and reports will be written */
    outputDir: string;
}
/**
 * Result of a single dispatch scenario test.
 */
export interface StableDispatchScenarioResult {
    /** Unique identifier for the scenario tested */
    scenarioId: "dispatch_claims_capable_worker" | "dispatch_balances_affinity_against_hotspot_load" | "dispatch_respects_dispatch_after" | "dispatch_reports_no_worker_for_capability_gap";
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
 * Aggregated report from all dispatch rehearsal scenarios.
 */
export interface StableDispatchRehearsalReport {
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
    scenarios: StableDispatchScenarioResult[];
}
/**
 * Runs all dispatch rehearsal scenarios and produces an aggregated report.
 *
 * Executes three scenarios:
 * 1. Capable worker dispatch - verifies correct worker selection
 * 2. Affinity load balancing - verifies hot affinity workers do not monopolize healthy capacity
 * 3. Dispatch after timing - verifies dispatch_after constraint
 * 4. Capability gap - verifies proper handling when no worker matches
 *
 * @param options - Rehearsal options including output directory
 * @returns Aggregated report with all scenario results
 */
export declare function runStableDispatchRehearsal(options: StableDispatchRehearsalOptions): Promise<StableDispatchRehearsalReport>;
/**
 * Writes the dispatch rehearsal report to a JSON file.
 *
 * @param outputFile - Path where the report JSON should be written
 * @param report - The report data to serialize and write
 */
export declare function writeStableDispatchRehearsalReport(outputFile: string, report: StableDispatchRehearsalReport): void;
