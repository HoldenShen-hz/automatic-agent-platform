/**
 * Stable cross-division recovery drill: validates stale, blocked, and dead-letter recovery per division.
 *
 * @documentation
 * - Architecture: docs_zh/architecture/00-platform-architecture.md
 * - Startup & recovery drills: docs_zh/contracts/startup_consistency_and_recovery_drill_contract.md
 * - Disaster recovery: docs_zh/contracts/remote_coordination_and_disaster_recovery_contract.md
 * - Division definitions: docs_zh/contracts/division_definition_contract.md
 * - Terminology: docs_zh/governance/glossary_and_terminology.md
 */
export interface StableCrossDivisionRecoveryDrillOptions {
    outputDir: string;
}
export interface StableCrossDivisionRecoveryScenarioResult {
    scenarioId: "cross_division_overview" | "cross_division_replay_matrix";
    passed: boolean;
    durationMs: number;
    summary: string;
    details: Record<string, unknown>;
}
export interface StableCrossDivisionRecoveryDrillReport {
    startedAt: string;
    finishedAt: string;
    outputDir: string;
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    scenarios: StableCrossDivisionRecoveryScenarioResult[];
}
export declare function runStableCrossDivisionRecoveryDrill(options: StableCrossDivisionRecoveryDrillOptions): Promise<StableCrossDivisionRecoveryDrillReport>;
export declare function writeStableCrossDivisionRecoveryDrillReport(outputFile: string, report: StableCrossDivisionRecoveryDrillReport): void;
