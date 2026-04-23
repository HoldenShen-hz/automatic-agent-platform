/**
 * Stable tenant-gray release rehearsal: validates scoped cohort rollout and rollback switches.
 *
 * @documentation
 * - Release lifecycle: docs_zh/contracts/release_rollout_and_rollback_contract.md
 * - Promotion criteria: docs_zh/contracts/platform_promote_criteria_contract.md
 * - Version governance: docs_zh/contracts/architecture_governance_and_versioning_contract.md
 * - Runtime execution: docs_zh/contracts/runtime_execution_contract.md
 */
import { type RuntimeVersionSnapshot } from "../../control-plane/incident-control/runtime-version-snapshot.js";
export interface StableGrayReleaseRehearsalOptions {
    outputDir: string;
}
export interface StableGrayReleaseScenarioResult {
    scenarioId: "gray_cohort_routes_only_to_canary_worker_group" | "gray_rollback_switch_restores_stable_routing";
    passed: boolean;
    durationMs: number;
    summary: string;
    details: Record<string, unknown>;
}
export declare const REQUIRED_STABLE_GRAY_RELEASE_TARGETS: readonly ["feature_flag_bundle", "gray_target_registry", "canary_workers", "rollback_switches"];
export type StableGrayReleaseTargetId = (typeof REQUIRED_STABLE_GRAY_RELEASE_TARGETS)[number];
export interface StableGrayReleaseTarget {
    targetId: StableGrayReleaseTargetId;
    owner: string;
    currentVersion: string | null;
    targetVersion: string | null;
    rolloutGuardrails: string[];
    healthValidation: string[];
}
export interface StableGrayCohortDefinition {
    cohortId: string;
    cohortKind: "division" | "tenant_group";
    targetRef: string;
    queueAffinity: string | null;
    requiredRepoVersion: string | null;
    featureFlags: string[];
}
export interface StableGrayReleasePlaybook {
    generatedAt: string;
    rolloutOwner: string;
    reportPath: string;
    playbookPath: string;
    runtimeVersionSnapshot: RuntimeVersionSnapshot;
    grayTargetKind: "division_and_partner_ring";
    cohorts: StableGrayCohortDefinition[];
    featureFlagPlan: string[];
    canaryWorkerPolicy: string[];
    healthValidation: string[];
    rollbackSwitches: string[];
    auditRequirements: string[];
    scenarioEvidence: Array<{
        scenarioId: StableGrayReleaseScenarioResult["scenarioId"];
        passed: boolean;
        summary: string;
    }>;
    targets: StableGrayReleaseTarget[];
}
export interface StableGrayReleaseRehearsalReport {
    startedAt: string;
    finishedAt: string;
    outputDir: string;
    artifacts: {
        reportPath: string;
        playbookPath: string;
    };
    playbook: StableGrayReleasePlaybook;
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    scenarios: StableGrayReleaseScenarioResult[];
}
export declare function buildStableGrayReleasePlaybook(input: {
    outputDir: string;
    reportPath: string;
    playbookPath: string;
    scenarios: StableGrayReleaseScenarioResult[];
}): StableGrayReleasePlaybook;
export declare function runStableGrayReleaseRehearsal(options: StableGrayReleaseRehearsalOptions): Promise<StableGrayReleaseRehearsalReport>;
export declare function writeStableGrayReleaseRehearsalReport(outputFile: string, report: StableGrayReleaseRehearsalReport): void;
