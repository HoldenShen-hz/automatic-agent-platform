import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { predictOpsCapacityRisk } from "./capacity-predictor/index.js";
import { buildConfigOptimizationSuggestion } from "./config-optimizer/index.js";
import { summarizeDeveloperAssistSuggestion } from "./dev-assistant/index.js";
import { summarizeOpsHealth, type OpsHealthProbe } from "./health-monitor/index.js";
import { classifyOpsIncident } from "./incident-diagnoser/index.js";

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

function riskFromSignals(
  incidentLevel: "warning" | "incident" | "critical_incident",
  capacityRisk: "low" | "medium" | "high",
  actionType: OpsActionType,
): OpsRiskLevel {
  if (incidentLevel === "critical_incident" || capacityRisk === "high") {
    return "high";
  }
  if (actionType === "tune_config" || incidentLevel === "incident" || capacityRisk === "medium") {
    return "medium";
  }
  return "low";
}

function canExecuteAtLevel(level: OpsMaturityLevel, riskLevel: OpsRiskLevel): boolean {
  switch (level) {
    case "observe_only":
    case "suggest_only":
      return false;
    case "supervised_execution":
      return riskLevel === "low";
    case "trusted_automation":
      return riskLevel !== "high";
  }
}

export class PlatformOpsAgentService {
  private readonly definition: OpsAgentDefinition;
  private readonly proposals = new Map<string, OpsProposal>();

  public constructor(definition: OpsAgentDefinition) {
    this.definition = definition;
  }

  public createProposal(input: OpsProposalInput): OpsProposal {
    const observedAt = input.observedAt ?? nowIso();
    const incidentLevel = classifyOpsIncident(input.errorRate, input.backlog);
    const capacityRisk = predictOpsCapacityRisk(input.currentLoad, input.projectedLoad);
    const actionType = this.chooseActionType(input, incidentLevel, capacityRisk);
    const riskLevel = riskFromSignals(incidentLevel, capacityRisk, actionType);
    const reasonCodes = this.buildReasonCodes(input, incidentLevel, capacityRisk, actionType);
    const blockedBy = this.computeBlockers(input, actionType, riskLevel);
    const approvalStatus = this.computeApprovalStatus(riskLevel);
    const executable = blockedBy.length === 0
      && approvalStatus !== "pending"
      && canExecuteAtLevel(this.definition.maxAutonomyLevel, riskLevel);

    const proposal: OpsProposal = {
      proposalId: newId("ops_proposal"),
      agentId: this.definition.agentId,
      specialty: this.definition.specialty,
      actionType,
      riskLevel,
      approvalStatus,
      approvals: [],
      executable,
      blockedBy,
      summary: this.buildSummary(actionType, input, incidentLevel, capacityRisk),
      reasonCodes,
      incidentLevel,
      capacityRisk,
      healthStatus: summarizeOpsHealth(input.probes),
      evidenceRequirements: [...this.definition.evidenceRequirements],
      observedAt,
      createdAt: nowIso(),
    };

    this.proposals.set(proposal.proposalId, proposal);
    return proposal;
  }

  public getProposal(proposalId: string): OpsProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`ops_agent.proposal_not_found:${proposalId}`);
    }
    return proposal;
  }

  public recordApproval(proposalId: string, approverId: string): OpsProposal {
    const proposal = this.getProposal(proposalId);
    if (!this.definition.requiredApprovals.includes(approverId)) {
      throw new Error(`ops_agent.approver_not_allowed:${approverId}`);
    }

    const approvals = proposal.approvals.includes(approverId)
      ? proposal.approvals
      : [...proposal.approvals, approverId];
    const approvalSatisfied = this.definition.requiredApprovals.every((item) => approvals.includes(item));
    const updated: OpsProposal = {
      ...proposal,
      approvals,
      approvalStatus: approvalSatisfied ? "approved" : "pending",
      executable: proposal.blockedBy.length === 0
        && approvalSatisfied
        && canExecuteAtLevel(this.definition.maxAutonomyLevel, proposal.riskLevel),
    };

    this.proposals.set(proposalId, updated);
    return updated;
  }

  public execute(proposalId: string): OpsExecutionReceipt {
    const proposal = this.getProposal(proposalId);
    return {
      proposalId,
      executed: proposal.executable,
      executedAt: nowIso(),
      actionType: proposal.actionType,
      riskLevel: proposal.riskLevel,
      reasonCodes: proposal.executable ? proposal.reasonCodes : [...proposal.reasonCodes, ...proposal.blockedBy],
    };
  }

  private chooseActionType(
    input: OpsProposalInput,
    incidentLevel: "warning" | "incident" | "critical_incident",
    capacityRisk: "low" | "medium" | "high",
  ): OpsActionType {
    if (incidentLevel !== "warning") {
      return "investigate_incident";
    }
    if (capacityRisk !== "low") {
      return "scale_capacity";
    }
    if (summarizeOpsHealth(input.probes) === "degraded") {
      return "tune_config";
    }
    return "developer_assist";
  }

  private buildSummary(
    actionType: OpsActionType,
    input: OpsProposalInput,
    incidentLevel: "warning" | "incident" | "critical_incident",
    capacityRisk: "low" | "medium" | "high",
  ): string {
    switch (actionType) {
      case "investigate_incident":
        return `incident:${incidentLevel}: ${summarizeOpsHealth(input.probes)}`;
      case "scale_capacity":
        return `capacity:${capacityRisk}: ${input.currentLoad} -> ${input.projectedLoad}`;
      case "tune_config":
        return buildConfigOptimizationSuggestion("worker_pool", input.currentLoad, input.projectedLoad);
      case "developer_assist":
        return summarizeDeveloperAssistSuggestion("ops_agent", [
          `health=${summarizeOpsHealth(input.probes)}`,
          `errorRate=${input.errorRate}`,
          `backlog=${input.backlog}`,
        ]);
    }
  }

  private buildReasonCodes(
    input: OpsProposalInput,
    incidentLevel: "warning" | "incident" | "critical_incident",
    capacityRisk: "low" | "medium" | "high",
    actionType: OpsActionType,
  ): readonly string[] {
    const codes = [
      `ops_agent.health.${summarizeOpsHealth(input.probes)}`,
      `ops_agent.incident.${incidentLevel}`,
      `ops_agent.capacity.${capacityRisk}`,
      `ops_agent.action.${actionType}`,
    ];
    if (input.errorRate >= 0.05) {
      codes.push("ops_agent.signal.error_rate_elevated");
    }
    if (input.backlog >= 200) {
      codes.push("ops_agent.signal.backlog_elevated");
    }
    return codes;
  }

  private computeApprovalStatus(riskLevel: OpsRiskLevel): OpsApprovalStatus {
    if (riskLevel === "high" && this.definition.requiredApprovals.length > 0) {
      return "pending";
    }
    return this.definition.requiredApprovals.length === 0 ? "not_required" : "approved";
  }

  private computeBlockers(
    input: OpsProposalInput,
    actionType: OpsActionType,
    riskLevel: OpsRiskLevel,
  ): readonly string[] {
    const blockedBy: string[] = [];
    if (!this.definition.allowedActionTypes.includes(actionType)) {
      blockedBy.push("ops_agent.action_not_allowed");
    }
    if (input.panicActive) {
      blockedBy.push("ops_agent.blocked_by_panic");
    }
    if (!canExecuteAtLevel(this.definition.maxAutonomyLevel, riskLevel)) {
      blockedBy.push("ops_agent.autonomy_limit_reached");
    }
    return blockedBy;
  }
}
