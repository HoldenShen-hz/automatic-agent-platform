/**
 * Stable Queue Delivery Rehearsal
 *
 * Tests the system's behavior around queue delivery scenarios, focusing on
 * ticket replay after delivery loss and duplicate delivery prevention:
 *
 * 1. Queue replay rebuilds dispatchable ticket after delivery is lost
 *    - A ticket is dispatched and lease is released without writeback
 *    - Reconciliation detects orphan queue claim
 *    - Replacement ticket is created and can be redispatched
 *    - Original ticket is marked as expired
 *
 * 2. Duplicate delivery is blocked and reconciled
 *    - First dispatch creates a valid claim with lease
 *    - Second dispatch for same execution is blocked (worker at capacity)
 *    - Writeback completes normally
 *    - Reconciliation cancels the stale duplicate ticket
 *
 * These scenarios verify the dispatch reconciliation contract requirements
 * for handling delivery anomalies and maintaining queue integrity.
 *
 * @see ExecutionDispatchReconciliationService for the repair logic
 * @see docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md
 */
/** Options for running the queue delivery rehearsal */
export interface StableQueueDeliveryRehearsalOptions {
    outputDir: string;
}
/** Result of a single queue delivery scenario */
export interface StableQueueDeliveryScenarioResult {
    scenarioId: "queue_replay_rebuilds_dispatchable_ticket" | "duplicate_delivery_blocked_and_reconciled";
    passed: boolean;
    durationMs: number;
    summary: string;
    details: Record<string, unknown>;
}
/** Complete report from the queue delivery rehearsal */
export interface StableQueueDeliveryRehearsalReport {
    startedAt: string;
    finishedAt: string;
    outputDir: string;
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    scenarios: StableQueueDeliveryScenarioResult[];
}
/**
 * Runs all queue delivery rehearsal scenarios.
 *
 * Executes two scenarios sequentially:
 * 1. Queue replay rebuilds ticket after delivery loss
 * 2. Duplicate delivery is blocked and reconciled
 */
export declare function runStableQueueDeliveryRehearsal(options: StableQueueDeliveryRehearsalOptions): Promise<StableQueueDeliveryRehearsalReport>;
/**
 * Writes the queue delivery rehearsal report to a JSON file.
 */
export declare function writeStableQueueDeliveryRehearsalReport(outputFile: string, report: StableQueueDeliveryRehearsalReport): void;
