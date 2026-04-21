/**
 * Stable backup/restore rehearsal: validates SQLite backup/restore roundtrip integrity.
 *
 * @documentation
 * - Architecture: docs_zh/architecture/00-platform-architecture.md
 * - Disaster recovery: docs_zh/contracts/remote_coordination_and_disaster_recovery_contract.md
 * - Startup & recovery drills: docs_zh/contracts/startup_consistency_and_recovery_drill_contract.md
 * - Terminology: docs_zh/governance/glossary_and_terminology.md
 */
import { type RuntimeVersionSnapshot } from "../../control-plane/incident-control/runtime-version-snapshot.js";
export interface StableBackupRestoreRehearsalOptions {
    outputDir: string;
}
export interface StableBackupRestoreScenarioResult {
    scenarioId: "sqlite_backup_restore_roundtrip";
    passed: boolean;
    durationMs: number;
    summary: string;
    details: Record<string, unknown>;
}
export interface StableDisasterRecoveryTarget {
    targetId: "runtime_sqlite" | "runtime_backup" | "restored_runtime";
    description: string;
    validationChecks: string[];
}
export interface StableDisasterRecoveryPlaybook {
    generatedAt: string;
    recoveryOwner: string;
    reportPath: string;
    playbookPath: string;
    targetRpo: string;
    targetRto: string;
    runtimeVersionSnapshot: RuntimeVersionSnapshot;
    prechecks: string[];
    restoreProcedure: string[];
    healthValidation: string[];
    auditRequirements: string[];
    targets: StableDisasterRecoveryTarget[];
}
export interface StableBackupRestoreRehearsalReport {
    startedAt: string;
    finishedAt: string;
    outputDir: string;
    artifacts: {
        reportPath: string;
        playbookPath: string;
    };
    playbook: StableDisasterRecoveryPlaybook;
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    scenarios: StableBackupRestoreScenarioResult[];
}
export declare function buildStableDisasterRecoveryPlaybook(input: {
    outputDir: string;
    reportPath: string;
    playbookPath: string;
}): StableDisasterRecoveryPlaybook;
export declare function runStableBackupRestoreRehearsal(options: StableBackupRestoreRehearsalOptions): Promise<StableBackupRestoreRehearsalReport>;
export declare function writeStableBackupRestoreRehearsalReport(outputFile: string, report: StableBackupRestoreRehearsalReport): void;
