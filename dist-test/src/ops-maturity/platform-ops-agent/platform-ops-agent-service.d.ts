import { type OpsHealthProbe } from "./health-monitor/index.js";
export type OpsActionType = "scale_capacity" | "tune_config" | "investigate_incident" | "developer_assist";
export type OpsMaturityLevel = "observe_only" | "suggest_only" | "supervised_execution" | "trusted_automation";
export type OpsRiskLevel = "low" | "medium" | "high";
export type OpsApprovalStatus = "not_required" | "pending" | "approved";
export interface OpsAgentDefinition {
    readonly agentId: string;
    readonly specialty: string;
    readonly allowedActionTypes: readonly OpsActionType[];
    readonly requiredApprovals: readonly string[];
    readonly maxAutonomyLevel: OpsMaturityLevel;
    readonly evidenceRequirements: readonly string[];
}
export interface OpsProposalInput {
    readonly probes: readonly OpsHealthProbe[];
    readonly errorRate: number;
    readonly backlog: number;
    readonly currentLoad: number;
    readonly projectedLoad: number;
    readonly panicActive?: boolean;
    readonly observedAt?: string;
}
export interface OpsProposal {
    readonly proposalId: string;
    readonly agentId: string;
    readonly specialty: string;
    readonly actionType: OpsActionType;
    readonly riskLevel: OpsRiskLevel;
    readonly approvalStatus: OpsApprovalStatus;
    readonly approvals: readonly string[];
    readonly executable: boolean;
    readonly blockedBy: readonly string[];
    readonly summary: string;
    readonly reasonCodes: readonly string[];
    readonly incidentLevel: "warning" | "incident" | "critical_incident";
    readonly capacityRisk: "low" | "medium" | "high";
    readonly healthStatus: "healthy" | "degraded" | "failed";
    readonly evidenceRequirements: readonly string[];
    readonly observedAt: string;
    readonly createdAt: string;
}
export interface OpsExecutionReceipt {
    readonly proposalId: string;
    readonly executed: boolean;
    readonly executedAt: string;
    readonly actionType: OpsActionType;
    readonly riskLevel: OpsRiskLevel;
    readonly reasonCodes: readonly string[];
}
export declare class PlatformOpsAgentService {
    private readonly definition;
    private readonly proposals;
    private readonly capacityPredictor;
    private readonly configOptimizer;
    private readonly developerAssistant;
    private readonly healthMonitor;
    private readonly incidentDiagnoser;
    constructor(definition: OpsAgentDefinition);
    createProposal(input: OpsProposalInput): OpsProposal;
    getProposal(proposalId: string): OpsProposal;
    recordApproval(proposalId: string, approverId: string): OpsProposal;
    execute(proposalId: string): OpsExecutionReceipt;
    private chooseActionType;
    private buildSummary;
    private buildReasonCodes;
    private computeApprovalStatus;
    private computeBlockers;
}
