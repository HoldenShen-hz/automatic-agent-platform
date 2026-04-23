/**
 * Stable DB Writability Rehearsal
 *
 * Tests the system's behavior when the authoritative database transitions to
 * read-only mode or becomes unwritable. Validates fail-close behavior across
 * multiple system components:
 *
 * 1. Health and Doctor fail-close when DB is not writable
 *    - Health service reports dbWritable=false with read_only_operations_only mode
 *    - Doctor service enters fail_closed status
 *    - DB check specifically reports db_write_probe_failed
 *
 * 2. Multi-step admission rejects new work in read-only mode
 *    - New task requests are cancelled before execution
 *    - Workflow and session are also cancelled
 *    - Admission rejection event is emitted
 *    - No execution is created
 *
 * 3. Dispatch blocks claims without dropping pending tickets in read-only mode
 *    - Dispatch decisions return "blocked" with backpressure.read_only_mode
 *    - The pending ticket is preserved (not dropped or completed)
 *    - Decision event records the blocked outcome
 *
 * These scenarios verify QA-73 contract requirements for database writability
 * failure handling and system-wide fail-close behavior.
 *
 * @see docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md for QA-73
 */
/** Options for running the DB writability rehearsal */
export interface StableDbWritabilityRehearsalOptions {
    outputDir: string;
}
/** Result of a single writability scenario */
export interface StableDbWritabilityScenarioResult {
    scenarioId: "health_and_doctor_fail_close_when_db_is_not_writable" | "multi_step_admission_rejects_new_work_in_read_only_mode" | "dispatch_blocks_claims_without_dropping_pending_ticket_in_read_only_mode";
    passed: boolean;
    durationMs: number;
    summary: string;
    details: Record<string, unknown>;
}
/** Complete report from the DB writability rehearsal */
export interface StableDbWritabilityRehearsalReport {
    startedAt: string;
    finishedAt: string;
    outputDir: string;
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    scenarios: StableDbWritabilityScenarioResult[];
}
/**
 * Runs all DB writability rehearsal scenarios.
 *
 * Executes three scenarios sequentially:
 * 1. Health and Doctor fail-close behavior
 * 2. Multi-step admission rejection in read-only mode
 * 3. Dispatch blocking without dropping tickets
 *
 * Returns an aggregated report with results from all scenarios.
 */
export declare function runStableDbWritabilityRehearsal(options: StableDbWritabilityRehearsalOptions): Promise<StableDbWritabilityRehearsalReport>;
/**
 * Writes the DB writability rehearsal report to a JSON file.
 */
export declare function writeStableDbWritabilityRehearsalReport(path: string, report: StableDbWritabilityRehearsalReport): void;
