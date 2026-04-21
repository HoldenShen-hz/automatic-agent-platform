export type StartupConsistencyCheckId = "migration_version" | "workflow_alignment" | "step_index" | "stale_execution" | "orphan_session" | "stale_file_lock" | "tier1_ack_backlog" | "execution_owner_conflict" | "oapeflir_stage" | "rollout_consistency";
export type ConsistencySeverity = "info" | "p2" | "p1" | "p0";
export type RepairActionType = "requeue_execution" | "release_stale_lock" | "rebuild_ack" | "close_orphan_session" | "manual_intervention_required";
export type RecoveryDisposition = "resume" | "retry" | "dead_letter" | "manual_handoff";
export interface StartupConsistencyFinding {
    checkId: StartupConsistencyCheckId;
    severity: ConsistencySeverity;
    entityRef: string;
    summary: string;
    recoverable: boolean;
    suggestedRepairAction: RepairActionType;
}
export interface StartupConsistencyReport {
    reportId: string;
    generatedAt: string;
    status: "open_for_traffic" | "repair_required" | "fail_closed";
    findings: StartupConsistencyFinding[];
    counts: Record<ConsistencySeverity, number>;
}
export interface RecoveryCandidate {
    candidateId: string;
    entityRef: string;
    checkId: StartupConsistencyCheckId;
    severity: ConsistencySeverity;
    suggestedRepairAction: RepairActionType;
    disposition: RecoveryDisposition;
    requiresManualApproval: boolean;
}
export interface RepairAction {
    actionId: string;
    candidateId: string;
    actionType: RepairActionType;
    entityRef: string;
    status: "planned" | "blocked" | "applied";
    reasonCode: string;
    createdAt: string;
}
export interface RecoveryDrillResult {
    drillId: string;
    scenario: string;
    status: "passed" | "failed";
    candidateCount: number;
    repairActions: RepairAction[];
    assertions: Array<{
        assertion: string;
        passed: boolean;
    }>;
    completedAt: string;
}
export declare class ReplayRepairControlService {
    buildStartupConsistencyReport(input: {
        reportId?: string;
        findings: StartupConsistencyFinding[];
        generatedAt?: string;
    }): StartupConsistencyReport;
    listRecoveryCandidates(report: StartupConsistencyReport): RecoveryCandidate[];
    planRepairActions(candidates: RecoveryCandidate[]): RepairAction[];
    assertCanOpenForTraffic(report: StartupConsistencyReport): void;
    runRecoveryDrill(input: {
        scenario: string;
        findings: StartupConsistencyFinding[];
    }): RecoveryDrillResult;
}
