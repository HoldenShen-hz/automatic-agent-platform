/**
 * Stable maintenance rehearsal: validates graceful drain and controlled lease handover.
 *
 * @documentation
 * - Runtime execution: docs_zh/contracts/runtime_execution_contract.md
 * - Lease and fencing: docs_zh/contracts/task_lease_and_fencing_contract.md
 * - Release lifecycle: docs_zh/contracts/release_rollout_and_rollback_contract.md
 * - Remote coordination: docs_zh/contracts/remote_coordination_and_disaster_recovery_contract.md
 */
import { type RuntimeVersionSnapshot } from "../../control-plane/incident-control/runtime-version-snapshot.js";
export interface StableMaintenanceRehearsalOptions {
    outputDir: string;
}
export interface StableMaintenanceScenarioResult {
    scenarioId: "draining_worker_rejects_new_dispatches" | "step_boundary_handover_preserves_execution_lineage";
    passed: boolean;
    durationMs: number;
    summary: string;
    details: Record<string, unknown>;
}
export declare const REQUIRED_STABLE_MAINTENANCE_TARGETS: readonly ["maintenance_window", "worker_pool", "active_leases", "dispatch_policy"];
export type StableMaintenanceTargetId = (typeof REQUIRED_STABLE_MAINTENANCE_TARGETS)[number];
export interface StableMaintenanceTarget {
    targetId: StableMaintenanceTargetId;
    owner: string;
    currentVersion: string | null;
    targetVersion: string | null;
    guardrails: string[];
    healthValidation: string[];
}
export interface StableMaintenancePlaybook {
    generatedAt: string;
    maintenanceOwner: string;
    reportPath: string;
    playbookPath: string;
    runtimeVersionSnapshot: RuntimeVersionSnapshot;
    maintenanceWindow: string;
    drainPolicy: string[];
    replacementReadinessChecks: string[];
    handoverProcedure: string[];
    healthValidation: string[];
    rollbackTriggers: string[];
    auditRequirements: string[];
    scenarioEvidence: Array<{
        scenarioId: StableMaintenanceScenarioResult["scenarioId"];
        passed: boolean;
        summary: string;
    }>;
    targets: StableMaintenanceTarget[];
}
export interface StableMaintenanceRehearsalReport {
    startedAt: string;
    finishedAt: string;
    outputDir: string;
    artifacts: {
        reportPath: string;
        playbookPath: string;
    };
    playbook: StableMaintenancePlaybook;
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    scenarios: StableMaintenanceScenarioResult[];
}
export declare function buildStableMaintenancePlaybook(input: {
    outputDir: string;
    reportPath: string;
    playbookPath: string;
    scenarios: StableMaintenanceScenarioResult[];
}): StableMaintenancePlaybook;
export declare function runStableMaintenanceRehearsal(options: StableMaintenanceRehearsalOptions): Promise<StableMaintenanceRehearsalReport>;
export declare function writeStableMaintenanceRehearsalReport(outputFile: string, report: StableMaintenanceRehearsalReport): void;
