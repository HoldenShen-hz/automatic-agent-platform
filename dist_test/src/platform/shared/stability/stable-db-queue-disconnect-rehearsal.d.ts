/**
 * Stable DB Queue Disconnect Rehearsal
 *
 * Tests the system's behavior when the dispatch queue becomes unavailable or
 * disconnected from the authoritative database. Validates that:
 *
 * 1. Queue disconnect degrades gracefully without silently dropping tickets
 *    - Tickets remain in pending state with explicit "blocked" decision
 *    - No work is lost during queue unavailability
 *
 * 2. Missing dispatch tickets are rebuilt after queue reconnect
 *    - The repair service scans for missing tickets
 *    - Rebuilds tickets from authoritative DB truth and plan metadata
 *    - Preserves all ticket attributes (capabilities, isolation level, etc.)
 *
 * 3. Authoritative writeback failures fail closed until store recovers
 *    - Writeback rejections during DB outage are properly handled
 *    - System recovers and succeeds once the store becomes available
 *    - No silent failures or data loss
 *
 * These scenarios verify QA-76 contract requirements for queue disconnect
 * handling and database recovery behavior.
 *
 * @see execution-db-queue-disconnect-repair-service.ts for the repair logic
 * @see docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md for QA-76
 */
/** Options for running the DB queue disconnect rehearsal */
export interface StableDbQueueDisconnectRehearsalOptions {
    outputDir: string;
}
/** Result of a single queue disconnect scenario */
export interface StableDbQueueDisconnectScenarioResult {
    scenarioId: "queue_disconnect_degrades_without_silent_drop" | "missing_dispatch_ticket_rebuilt_after_queue_reconnect" | "authoritative_writeback_failure_fails_closed_until_store_recovers";
    passed: boolean;
    durationMs: number;
    summary: string;
    details: Record<string, unknown>;
}
/** Complete report from the DB queue disconnect rehearsal */
export interface StableDbQueueDisconnectRehearsalReport {
    startedAt: string;
    finishedAt: string;
    outputDir: string;
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    scenarios: StableDbQueueDisconnectScenarioResult[];
}
/**
 * Runs all DB queue disconnect rehearsal scenarios.
 *
 * Executes three scenarios sequentially:
 * 1. Queue disconnect degrades gracefully
 * 2. Missing ticket rebuild after reconnect
 * 3. Writeback failure handling
 *
 * Returns an aggregated report with results from all scenarios.
 */
export declare function runStableDbQueueDisconnectRehearsal(options: StableDbQueueDisconnectRehearsalOptions): Promise<StableDbQueueDisconnectRehearsalReport>;
/**
 * Writes the DB queue disconnect rehearsal report to a JSON file.
 */
export declare function writeStableDbQueueDisconnectRehearsalReport(path: string, report: StableDbQueueDisconnectRehearsalReport): void;
