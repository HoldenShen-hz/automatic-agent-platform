/**
 * Stable rolling upgrade rehearsal: validates repo-version-aware dispatch and step-boundary handover.
 *
 * @documentation
 * - Architecture: docs_zh/architecture/00-platform-architecture.md
 * - Version governance: docs_zh/contracts/architecture_governance_and_versioning_contract.md
 * - Runtime execution: docs_zh/contracts/runtime_execution_contract.md
 * - Lease and fencing: docs_zh/contracts/task_lease_and_fencing_contract.md
 */
import { type RuntimeVersionSnapshot } from "../../control-plane/incident-control/runtime-version-snapshot.js";
export interface StableRollingUpgradeRehearsalOptions {
    outputDir: string;
}
export interface StableRollingUpgradeScenarioResult {
    scenarioId: "repo_version_canary_routes_to_upgraded_worker" | "lease_handover_supports_step_boundary_upgrade";
    passed: boolean;
    durationMs: number;
    summary: string;
    details: Record<string, unknown>;
}
export declare const REQUIRED_STABLE_ROLLING_UPGRADE_TARGETS: readonly ["coordinator_release", "worker_pool", "active_leases", "dispatch_policy"];
export type StableRollingUpgradeTargetId = (typeof REQUIRED_STABLE_ROLLING_UPGRADE_TARGETS)[number];
export interface StableRollingUpgradeTarget {
    targetId: StableRollingUpgradeTargetId;
    owner: string;
    currentVersion: string | null;
    targetVersion: string | null;
    rolloutGuardrails: string[];
    healthValidation: string[];
}
export interface StableRollingUpgradePlaybook {
    generatedAt: string;
    upgradeOwner: string;
    reportPath: string;
    playbookPath: string;
    runtimeVersionSnapshot: RuntimeVersionSnapshot;
    compatibilityWindow: string;
    canaryStrategy: string[];
    prechecks: string[];
    rolloutProcedure: string[];
    healthValidation: string[];
    rollbackTriggers: string[];
    auditRequirements: string[];
    scenarioEvidence: Array<{
        scenarioId: StableRollingUpgradeScenarioResult["scenarioId"];
        passed: boolean;
        summary: string;
    }>;
    targets: StableRollingUpgradeTarget[];
}
export interface StableRollingUpgradeRehearsalReport {
    startedAt: string;
    finishedAt: string;
    outputDir: string;
    artifacts: {
        reportPath: string;
        playbookPath: string;
    };
    playbook: StableRollingUpgradePlaybook;
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    scenarios: StableRollingUpgradeScenarioResult[];
}
export declare function buildStableRollingUpgradePlaybook(input: {
    outputDir: string;
    reportPath: string;
    playbookPath: string;
    scenarios: StableRollingUpgradeScenarioResult[];
}): StableRollingUpgradePlaybook;
export declare function runStableRollingUpgradeRehearsal(options: StableRollingUpgradeRehearsalOptions): Promise<StableRollingUpgradeRehearsalReport>;
export declare function writeStableRollingUpgradeRehearsalReport(outputFile: string, report: StableRollingUpgradeRehearsalReport): void;
