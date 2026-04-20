import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { predictOpsCapacityRisk } from "./capacity-predictor/index.js";
import { buildConfigOptimizationSuggestion } from "./config-optimizer/index.js";
import { summarizeDeveloperAssistSuggestion } from "./dev-assistant/index.js";
import { summarizeOpsHealth, type OpsHealthProbe } from "./health-monitor/index.js";
import { classifyOpsIncident } from "./incident-diagnoser/index.js";

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

interface StoredProposal {
  proposal: OpsActionProposal;
  approvals: Set<string>;
}

function riskFromSignals(
  incidentLevel: "warning" | "incident" | "critical_incident",
  capacityRisk: "low" | "medium" | "high",
  configTarget?: OpsSignalInput["configTarget"],
): OpsRiskLevel {
  if (incidentLevel === "critical_incident" || capacityRisk === "high") {
    return "high";
  }
  if (
    incidentLevel === "incident"
    || capacityRisk === "medium"
    || (configTarget != null && Math.abs(configTarget.recommendedValue - configTarget.currentValue) >= 2)
  ) {
    return "medium";
  }
  return "low";
}

function canAutonomouslyExecute(level: OpsMaturityLevel, riskLevel: OpsRiskLevel): boolean {
  if (level === "trusted_automation") {
    return riskLevel !== "high";
  }
  if (level === "supervised_execution") {
    return riskLevel === "low";
  }
  return false;
}

export class PlatformOpsAgentService {
  private readonly proposals = new Map<string, StoredProposal>();

  public constructor(private readonly definition: PlatformOpsAgentDefinition) {}

  public createProposal(input: OpsSignalInput): OpsActionProposal {
    const observedAt = input.observedAt ?? nowIso();
    const incidentLevel = classifyOpsIncident(input.errorRate, input.backlog);
    const capacityRisk = predictOpsCapacityRisk(input.currentLoad, input.projectedLoad);
    const actionType = this.chooseActionType(input, incidentLevel, capacityRisk);
    const riskLevel = riskFromSignals(incidentLevel, capacityRisk, input.configTarget);
    const targetComponent = input.probes[0]?.component ?? "platform";
    const summary = this.buildSummary(actionType, input, incidentLevel, capacityRisk);
    const blockedBy = this.evaluateGuardrails(actionType, input.panicActive ?? false);
    const approvalsSatisfied = this.definition.requiredApprovals.length === 0;
    const executable = blockedBy.length === 0
      && approvalsSatisfied
      && canAutonomouslyExecute(this.definition.maxAutonomyLevel, riskLevel);
    const proposal: OpsActionProposal = {
      proposalId: newId("ops_proposal"),
      agentId: this.definition.agentId,
      actionType,
      targetComponent,
      summary,
      maturityLevel: this.definition.maxAutonomyLevel,
      riskLevel,
      incidentLevel,
      evidenceIds: this.buildEvidenceIds(input),
      approvalStatus: riskLevel === "high" || this.definition.requiredApprovals.length > 0 ? "pending" : "not_required",
      executable,
      blockedBy,
      createdAt: observedAt,
    };
    this.proposals.set(proposal.proposalId, {
      proposal,
      approvals: new Set<string>(),
    });
    return proposal;
  }

  public recordApproval(proposalId: string, approverId: string): OpsActionProposal {
    const stored = this.requireProposal(proposalId);
    stored.approvals.add(approverId);
    const allApprovalsSatisfied = this.definition.requiredApprovals.every((required) => stored.approvals.has(required));
    const executable = stored.proposal.blockedBy.length === 0
      && allApprovalsSatisfied
      && this.definition.maxAutonomyLevel !== "observe_only"
      && this.definition.maxAutonomyLevel !== "suggest_only";
    const updated: OpsActionProposal = {
      ...stored.proposal,
      approvalStatus: allApprovalsSatisfied ? "approved" : "pending",
      executable,
    };
    this.proposals.set(proposalId, {
      proposal: updated,
      approvals: stored.approvals,
    });
    return updated;
  }

  public execute(proposalId: string, executedAt = nowIso()): OpsExecutionReceipt {
    const stored = this.requireProposal(proposalId);
    if (!stored.proposal.executable) {
      return {
        proposalId,
        executed: false,
        executedAt: null,
        reasonCodes: stored.proposal.blockedBy.length > 0
          ? stored.proposal.blockedBy
          : [`ops_agent.approval_${stored.proposal.approvalStatus}`],
      };
    }
    return {
      proposalId,
      executed: true,
      executedAt,
      reasonCodes: ["ops_agent.executed"],
    };
  }

  public getProposal(proposalId: string): OpsActionProposal | null {
    return this.proposals.get(proposalId)?.proposal ?? null;
  }

  private chooseActionType(
    input: OpsSignalInput,
    incidentLevel: OpsActionProposal["incidentLevel"],
    capacityRisk: "low" | "medium" | "high",
  ): OpsActionType {
    if (incidentLevel !== "warning") {
      return "investigate_incident";
    }
    if (capacityRisk !== "low") {
      return "scale_capacity";
    }
    if (input.configTarget != null && input.configTarget.currentValue !== input.configTarget.recommendedValue) {
      return "tune_config";
    }
    return "developer_assist";
  }

  private buildSummary(
    actionType: OpsActionType,
    input: OpsSignalInput,
    incidentLevel: OpsActionProposal["incidentLevel"],
    capacityRisk: "low" | "medium" | "high",
  ): string {
    if (actionType === "investigate_incident") {
      return summarizeDeveloperAssistSuggestion(
        `incident:${incidentLevel}`,
        [
          `health=${summarizeOpsHealth(input.probes)}`,
          `error_rate=${input.errorRate.toFixed(3)}`,
          `backlog=${input.backlog}`,
        ],
      );
    }
    if (actionType === "scale_capacity") {
      return `capacity:${capacityRisk}: ${input.currentLoad} -> ${input.projectedLoad}`;
    }
    if (actionType === "tune_config" && input.configTarget != null) {
      return buildConfigOptimizationSuggestion(
        input.configTarget.key,
        input.configTarget.currentValue,
        input.configTarget.recommendedValue,
      );
    }
    return summarizeDeveloperAssistSuggestion("ops_assist", input.findings ?? ["review diagnostics"]);
  }

  private buildEvidenceIds(input: OpsSignalInput): string[] {
    const baseEvidence = [
      ...this.definition.evidenceRequirements,
      ...input.probes.map((probe) => `probe:${probe.component}:${probe.status}`),
      `metric:error_rate:${input.errorRate.toFixed(3)}`,
      `metric:backlog:${input.backlog}`,
      `metric:projected_load:${input.projectedLoad}`,
    ];
    if (input.configTarget != null) {
      baseEvidence.push(`config:${input.configTarget.key}:${input.configTarget.currentValue}->${input.configTarget.recommendedValue}`);
    }
    return [...new Set(baseEvidence)];
  }

  private evaluateGuardrails(actionType: OpsActionType, panicActive: boolean): string[] {
    const blockedBy: string[] = [];
    if (!this.definition.allowedActionTypes.includes(actionType)) {
      blockedBy.push("ops_agent.action_not_allowed");
    }
    if (panicActive) {
      blockedBy.push("ops_agent.blocked_by_panic");
    }
    if (this.definition.maxAutonomyLevel === "observe_only") {
      blockedBy.push("ops_agent.observe_only");
    }
    return blockedBy;
  }

  private requireProposal(proposalId: string): StoredProposal {
    const stored = this.proposals.get(proposalId);
    if (stored == null) {
      throw new Error(`ops_agent.proposal_not_found:${proposalId}`);
    }
    return stored;
  }
}
