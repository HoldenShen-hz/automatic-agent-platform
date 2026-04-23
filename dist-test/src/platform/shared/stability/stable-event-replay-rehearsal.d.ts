/**
 * Stable event replay rehearsal: verifies failed consumer acknowledgements can be replayed cleanly.
 *
 * @documentation
 * - Architecture: docs_zh/architecture/00-platform-architecture.md
 * - Event reliability: docs_zh/contracts/event_reliability_matrix_contract.md
 * - Event bus: docs_zh/contracts/event_bus_contract.md
 * - Terminology: docs_zh/governance/glossary_and_terminology.md
 */
export interface StableEventReplayRehearsalOptions {
    outputDir: string;
}
export interface StableEventReplayScenarioResult {
    scenarioId: "failed_consumer_ack_replay";
    passed: boolean;
    durationMs: number;
    summary: string;
    details: Record<string, unknown>;
}
export interface StableEventReplayRehearsalReport {
    startedAt: string;
    finishedAt: string;
    outputDir: string;
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    scenarios: StableEventReplayScenarioResult[];
}
export declare function runStableEventReplayRehearsal(options: StableEventReplayRehearsalOptions): Promise<StableEventReplayRehearsalReport>;
export declare function writeStableEventReplayRehearsalReport(outputFile: string, report: StableEventReplayRehearsalReport): void;
