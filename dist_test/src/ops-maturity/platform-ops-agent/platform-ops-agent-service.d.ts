import { type OpsHealthProbe } from "./health-monitor/index.js";
export type OpsActionType = "scale_capacity" | "tune_config" | "investigate_incident" | "developer_assist";
export type OpsMaturityLevel = "observe_only" | "suggest_only" | "supervised_execution" | "trusted_automation";
export type OpsRiskLevel = "low" | "medium" | "high";
export interface PlatformOpsAgentDefinition {
    readonly agentId: string;
    readonly specialty: string;
    readonly allowedActionTypes: readonly OpsActionType[];
    readonly requiredApprovals: readonly string[];
    readonly maxAutonomyLevel: OpsMaturityLevel;
    readonly evidenceRequirements: readonly string[];
}
export interface OpsSignalInput {
    readonly probes: readonly OpsHealthProbe[];
    readonly errorRate: number;
    readonly backlog: number;
    readonly currentLoad: number;
    readonly projectedLoad: number;
    readonly configTarget?: {
        readonly key: string;
        readonly currentValue: number;
        readonly recommendedValue: number;
    };
    readonly findings?: readonly string[];
    readonly panicActive?: boolean;
    readonly observedAt?: string;
}
export interface OpsActionProposal {
    readonly proposalId: string;
    readonly agentId: string;
    readonly actionType: OpsActionType;
    readonly targetComponent: string;
    readonly summary: string;
    readonly maturityLevel: OpsMaturityLevel;
    readonly riskLevel: OpsRiskLevel;
    readonly incidentLevel: "warning" | "incident" | "critical_incident";
    readonly evidenceIds: readonly string[];
    readonly approvalStatus: "not_required" | "pending" | "approved" | "rejected";
    readonly executable: boolean;
    readonly blockedBy: readonly string[];
    readonly createdAt: string;
}
export interface OpsExecutionReceipt {
    readonly proposalId: string;
    readonly executed: boolean;
    readonly executedAt: string | null;
    readonly reasonCodes: readonly string[];
}
export declare class PlatformOpsAgentService {
    private readonly definition;
    private readonly proposals;
    constructor(definition: PlatformOpsAgentDefinition);
    createProposal(input: OpsSignalInput): OpsActionProposal;
    recordApproval(proposalId: string, approverId: string): OpsActionProposal;
    execute(proposalId: string, executedAt?: string): OpsExecutionReceipt;
    getProposal(proposalId: string): OpsActionProposal | null;
    private chooseActionType;
    private buildSummary;
    private buildEvidenceIds;
    private evaluateGuardrails;
    private requireProposal;
}
