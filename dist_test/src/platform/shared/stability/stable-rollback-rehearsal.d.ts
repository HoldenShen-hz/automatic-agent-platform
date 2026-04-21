/**
 * Stable rollback rehearsal: validates runtime repair and manual takeover rollback paths.
 *
 * @documentation
 * - Architecture: docs_zh/architecture/00-platform-architecture.md
 * - Release lifecycle: docs_zh/contracts/release_rollout_and_rollback_contract.md
 * - Startup & recovery drills: docs_zh/contracts/startup_consistency_and_recovery_drill_contract.md
 * - Terminology: docs_zh/governance/glossary_and_terminology.md
 */
import { type RuntimeVersionSnapshot } from "../../control-plane/incident-control/runtime-version-snapshot.js";
export interface StableRollbackRehearsalOptions {
    outputDir: string;
}
export interface StableRollbackScenarioResult {
    scenarioId: "runtime_repair_rehearsal" | "manual_takeover_rehearsal";
    passed: boolean;
    durationMs: number;
    summary: string;
    details: Record<string, unknown>;
}
export declare const REQUIRED_STABLE_ROLLBACK_TARGETS: readonly ["application_binary", "config_bundle", "feature_flag", "worker_version", "prompt_bundle"];
export type StableRollbackTargetId = (typeof REQUIRED_STABLE_ROLLBACK_TARGETS)[number];
export interface StableRollbackEntryPoint {
    entryPointId: "stable_rollback_cli" | "runtime_repair_service" | "human_takeover_service";
    description: string;
    command: string | null;
}
export interface StableRollbackTarget {
    targetId: StableRollbackTargetId;
    currentVersion: string | null;
    rollbackOwner: string;
    rollbackTrigger: string;
    entryPointId: StableRollbackEntryPoint["entryPointId"];
    rollbackSteps: string[];
    healthValidation: string[];
    auditRequirements: string[];
}
export interface StableRollbackPlaybook {
    generatedAt: string;
    rollbackOwner: string;
    reportPath: string;
    playbookPath: string;
    runtimeVersionSnapshot: RuntimeVersionSnapshot;
    prechecks: string[];
    healthValidation: string[];
    auditRequirements: string[];
    rollbackEntryPoints: StableRollbackEntryPoint[];
    scenarioEvidence: Array<{
        scenarioId: StableRollbackScenarioResult["scenarioId"];
        passed: boolean;
        summary: string;
    }>;
    targets: StableRollbackTarget[];
}
export interface StableRollbackRehearsalReport {
    startedAt: string;
    finishedAt: string;
    outputDir: string;
    artifacts: {
        reportPath: string;
        playbookPath: string;
    };
    playbook: StableRollbackPlaybook;
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    scenarios: StableRollbackScenarioResult[];
}
export declare function buildStableRollbackPlaybook(input: {
    outputDir: string;
    reportPath: string;
    playbookPath: string;
    scenarios: StableRollbackScenarioResult[];
}): StableRollbackPlaybook;
export declare function runStableRollbackRehearsal(options: StableRollbackRehearsalOptions): Promise<StableRollbackRehearsalReport>;
export declare function writeStableRollbackRehearsalReport(outputFile: string, report: StableRollbackRehearsalReport): void;
