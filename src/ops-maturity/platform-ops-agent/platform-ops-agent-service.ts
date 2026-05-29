import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { OpsCapacityPredictorService } from "./capacity-predictor/index.js";
import { ConfigOptimizerService } from "./config-optimizer/index.js";
import { DeveloperAssistantService } from "./dev-assistant/index.js";
import { OpsHealthMonitorService, summarizeOpsHealth, type OpsHealthProbe } from "./health-monitor/index.js";
import {
  DEFAULT_INCIDENT_THRESHOLDS,
  IncidentDiagnoserService,
  type IncidentThresholds,
} from "./incident-diagnoser/index.js";

export type OpsActionType = "scale_capacity" | "tune_config" | "investigate_incident" | "developer_assist" | "restart_service" | "failover";
export type OpsMaturityLevel = "observe_only" | "suggest_only" | "supervised_execution" | "trusted_automation";
export type OpsRiskLevel = "low" | "medium" | "high";
export type OpsApprovalStatus = "not_required" | "pending" | "approved";

export interface OpsDataBoundary {
  readonly allowedPayloadTypes: readonly ("platform_metrics" | "platform_logs" | "platform_config")[];
  readonly businessPayloadAllowed: boolean;
}

export interface OpsAgentDefinition {
  readonly agentId: string;
  readonly specialty: string;
  readonly allowedActionTypes: readonly OpsActionType[];
  readonly requiredApprovals: readonly string[];
  readonly maxAutonomyLevel: OpsMaturityLevel;
  readonly evidenceRequirements: readonly string[];
  readonly ops_data_boundary?: OpsDataBoundary;
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

export interface OpsSignalSnapshot {
  readonly errorRate: number;
  readonly backlog: number;
  readonly currentLoad: number;
  readonly projectedLoad: number;
  readonly panicActive: boolean;
  readonly probeStatuses: readonly OpsHealthProbe["status"][];
  readonly observedAt: string;
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
  readonly signalSnapshot: OpsSignalSnapshot;
}

export interface OpsNodeAttemptReceipt {
  readonly proposalId: string;
  readonly executed: boolean;
  readonly executedAt: string;
  readonly actionType: OpsActionType;
  readonly riskLevel: OpsRiskLevel;
  readonly reasonCodes: readonly string[];
  readonly summary: string;
  readonly blockedBy?: readonly string[];
  readonly details?: Readonly<Record<string, unknown>>;
}

/** @deprecated compatibility export; use OpsNodeAttemptReceipt */
export type OpsExecutionReceipt = OpsNodeAttemptReceipt;

export interface PlatformOpsAgentConfig {
  readonly signalThresholds?: Partial<IncidentThresholds>;
}

interface ExecutionEligibility {
  readonly executable: boolean;
  readonly blocker: string | null;
}

const DEFAULT_PLATFORM_OPS_SIGNAL_THRESHOLDS: IncidentThresholds = { ...DEFAULT_INCIDENT_THRESHOLDS };

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

function computeExecutionEligibility(
  level: OpsMaturityLevel,
  riskLevel: OpsRiskLevel,
  approvalSatisfied: boolean,
): ExecutionEligibility {
  switch (level) {
    case "observe_only":
    case "suggest_only":
      return { executable: false, blocker: "ops_agent.autonomy_limit_reached" };
    case "supervised_execution":
      if (riskLevel === "low" || approvalSatisfied) {
        return { executable: true, blocker: null };
      }
      return { executable: false, blocker: "ops_agent.autonomy_limit_reached" };
    case "trusted_automation":
      if (riskLevel === "high" && !approvalSatisfied) {
        return { executable: false, blocker: "ops_agent.autonomy_limit_reached" };
      }
      return { executable: true, blocker: null };
  }
}

export class PlatformOpsAgentService {
  private static readonly MAX_STORED_PROPOSALS = 256;
  private readonly definition: OpsAgentDefinition;
  private readonly proposals = new Map<string, OpsProposal>();
  private readonly capacityPredictor = new OpsCapacityPredictorService();
  private readonly configOptimizer = new ConfigOptimizerService();
  private readonly developerAssistant = new DeveloperAssistantService();
  private readonly healthMonitor = new OpsHealthMonitorService();
  private readonly signalThresholds: IncidentThresholds;
  private readonly incidentDiagnoser: IncidentDiagnoserService;

  public constructor(definition: OpsAgentDefinition, config: PlatformOpsAgentConfig = {}) {
    this.definition = definition;
    this.signalThresholds = {
      ...DEFAULT_PLATFORM_OPS_SIGNAL_THRESHOLDS,
      ...config.signalThresholds,
    };
    this.incidentDiagnoser = new IncidentDiagnoserService(this.signalThresholds);
  }

  public createProposal(input: OpsProposalInput): OpsProposal {
    const observedAt = input.observedAt ?? nowIso();
    const healthSnapshot = this.healthMonitor.evaluate(input.probes);
    const diagnosis = this.incidentDiagnoser.diagnose(input.errorRate, input.backlog, healthSnapshot.status);
    const incidentLevel = diagnosis.level;
    const capacityRisk = this.capacityPredictor.assessRisk(input.currentLoad, input.projectedLoad).riskLevel;
    const actionType = this.chooseActionType(input, incidentLevel, capacityRisk);
    const riskLevel = riskFromSignals(incidentLevel, capacityRisk, actionType);
    const reasonCodes = this.buildReasonCodes(input, incidentLevel, capacityRisk, actionType);
    const approvalStatus = this.computeApprovalStatus(riskLevel);
    const approvalSatisfied = this.definition.requiredApprovals.length > 0 && approvalStatus !== "pending";
    const blockedBy = this.computeBlockers(input, actionType, riskLevel, approvalSatisfied);
    const executable = blockedBy.length === 0;

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
      healthStatus: healthSnapshot.status,
      evidenceRequirements: [...this.definition.evidenceRequirements],
      observedAt,
      createdAt: nowIso(),
      signalSnapshot: {
        errorRate: input.errorRate,
        backlog: input.backlog,
        currentLoad: input.currentLoad,
        projectedLoad: input.projectedLoad,
        panicActive: input.panicActive === true,
        probeStatuses: input.probes.map((probe) => probe.status),
        observedAt,
      },
    };

    this.proposals.set(proposal.proposalId, proposal);
    this.evictOldProposals();
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
    const blockedBy = this.computeBlockersFromProposal(proposal, approvalSatisfied);
    const updated: OpsProposal = {
      ...proposal,
      approvals,
      approvalStatus: approvalSatisfied ? "approved" : "pending",
      blockedBy,
      executable: blockedBy.length === 0,
    };

    this.proposals.set(proposalId, updated);
    return updated;
  }

  public execute(proposalId: string): OpsNodeAttemptReceipt {
    const proposal = this.getProposal(proposalId);
    if (!proposal.executable) {
      return {
        proposalId,
        executed: false,
        executedAt: nowIso(),
        actionType: proposal.actionType,
        riskLevel: proposal.riskLevel,
        reasonCodes: [...proposal.reasonCodes, ...proposal.blockedBy],
        blockedBy: proposal.blockedBy,
        summary: `blocked:${proposal.blockedBy.join(",") || "unknown"}`,
      };
    }
    const actionResult = this.executeAction(proposal);
    return {
      proposalId,
      executed: true,
      executedAt: nowIso(),
      actionType: proposal.actionType,
      riskLevel: proposal.riskLevel,
      reasonCodes: [...proposal.reasonCodes, ...actionResult.reasonCodes],
      summary: actionResult.summary,
      details: actionResult.details,
    };
  }

  private chooseActionType(
    input: OpsProposalInput,
    incidentLevel: "warning" | "incident" | "critical_incident",
    capacityRisk: "low" | "medium" | "high",
  ): OpsActionType {
    const preferred = incidentLevel !== "warning"
      ? (input.errorRate >= this.signalThresholds.criticalErrorRate ? "failover" : "restart_service")
      : capacityRisk !== "low"
        ? "scale_capacity"
        : summarizeOpsHealth(input.probes) === "degraded"
          ? "tune_config"
          : "developer_assist";
    if (this.definition.allowedActionTypes.includes(preferred)) {
      return preferred;
    }
    return this.definition.allowedActionTypes[0] ?? preferred;
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
      case "restart_service":
        return `restart_service:${summarizeOpsHealth(input.probes)}`;
      case "failover":
        return `failover:${incidentLevel}:${summarizeOpsHealth(input.probes)}`;
      case "scale_capacity":
        return `capacity:${capacityRisk}: ${input.currentLoad} -> ${input.projectedLoad}`;
      case "tune_config":
        return this.configOptimizer.optimize({
          key: "worker_pool",
          currentValue: input.currentLoad,
          recommendedValue: input.projectedLoad,
          currentLoad: input.currentLoad,
          projectedLoad: input.projectedLoad,
        }).summary;
      case "developer_assist":
        return this.developerAssistant.recommend("ops_agent", [
          `health=${summarizeOpsHealth(input.probes)}`,
          `errorRate=${input.errorRate}`,
          `backlog=${input.backlog}`,
        ]).summary;
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
    if (input.errorRate >= this.signalThresholds.incidentErrorRate) {
      codes.push("ops_agent.signal.error_rate_elevated");
    }
    if (input.backlog >= this.signalThresholds.incidentBacklog) {
      codes.push("ops_agent.signal.backlog_elevated");
    }
    return codes;
  }

  private computeApprovalStatus(riskLevel: OpsRiskLevel): OpsApprovalStatus {
    if (riskLevel === "high" && this.definition.requiredApprovals.length > 0) {
      return "pending";
    }
    return "not_required";
  }

  private computeBlockers(
    input: OpsProposalInput,
    actionType: OpsActionType,
    riskLevel: OpsRiskLevel,
    approvalSatisfied: boolean,
  ): readonly string[] {
    const blockedBy: string[] = [];
    if (!this.definition.allowedActionTypes.includes(actionType)) {
      blockedBy.push("ops_agent.action_not_allowed");
    }
    if (input.panicActive) {
      blockedBy.push("ops_agent.blocked_by_panic");
    }
    const eligibility = computeExecutionEligibility(this.definition.maxAutonomyLevel, riskLevel, approvalSatisfied);
    if (eligibility.blocker != null) {
      blockedBy.push(eligibility.blocker);
    }
    return blockedBy;
  }

  private computeBlockersFromProposal(proposal: OpsProposal, approvalSatisfied: boolean): readonly string[] {
    return this.computeBlockers(
      {
        probes: proposal.signalSnapshot.probeStatuses.map((status, index) => ({
          component: `component_${index + 1}`,
          status,
          timestamp: proposal.signalSnapshot.observedAt,
        })),
        errorRate: proposal.signalSnapshot.errorRate,
        backlog: proposal.signalSnapshot.backlog,
        currentLoad: proposal.signalSnapshot.currentLoad,
        projectedLoad: proposal.signalSnapshot.projectedLoad,
        panicActive: proposal.signalSnapshot.panicActive,
        observedAt: proposal.signalSnapshot.observedAt,
      },
      proposal.actionType,
      proposal.riskLevel,
      approvalSatisfied,
    );
  }

  private executeAction(proposal: OpsProposal): {
    summary: string;
    reasonCodes: readonly string[];
    details: Readonly<Record<string, unknown>>;
  } {
    const snapshot = proposal.signalSnapshot;
    switch (proposal.actionType) {
      case "scale_capacity": {
        const assessment = this.capacityPredictor.assessRisk(snapshot.currentLoad, snapshot.projectedLoad);
        return {
          summary: `scale_capacity:${assessment.riskLevel}:buffer=${assessment.recommendedBufferPercent}`,
          reasonCodes: assessment.reasonCodes,
          details: {
            currentLoad: snapshot.currentLoad,
            projectedLoad: snapshot.projectedLoad,
            recommendedBufferPercent: assessment.recommendedBufferPercent,
            confidencePercent: assessment.confidencePercent,
          },
        };
      }
      case "tune_config": {
        const optimization = this.configOptimizer.optimize({
          key: "worker_pool",
          currentValue: snapshot.currentLoad,
          recommendedValue: snapshot.projectedLoad,
          currentLoad: snapshot.currentLoad,
          projectedLoad: snapshot.projectedLoad,
        });
        return {
          summary: optimization.summary,
          reasonCodes: optimization.reasonCodes,
          details: {
            estimatedSavings: optimization.estimatedSavings,
            savingsPercent: optimization.savingsPercent,
            urgency: optimization.urgency,
          },
        };
      }
      case "investigate_incident": {
        const diagnosis = this.incidentDiagnoser.diagnose(snapshot.errorRate, snapshot.backlog, summarizeOpsHealth(
          proposal.signalSnapshot.probeStatuses.map((status, index) => ({
            component: `component_${index + 1}`,
            status,
          })),
        ));
        return {
          summary: diagnosis.summary,
          reasonCodes: diagnosis.suspectedCauses,
          details: {
            recommendedAction: diagnosis.recommendedAction,
            suspectedCauses: diagnosis.suspectedCauses,
          },
        };
      }
      case "restart_service":
      case "failover": {
        const diagnosis = this.incidentDiagnoser.diagnose(snapshot.errorRate, snapshot.backlog, summarizeOpsHealth(
          proposal.signalSnapshot.probeStatuses.map((status, index) => ({
            component: `component_${index + 1}`,
            status,
          })),
        ));
        return {
          summary: `${proposal.actionType}:${diagnosis.recommendedAction}`,
          reasonCodes: diagnosis.suspectedCauses,
          details: {
            incidentLevel: diagnosis.level,
            recommendedAction: diagnosis.recommendedAction,
          },
        };
      }
      case "developer_assist":
      default: {
        const recommendation = this.developerAssistant.recommend("ops_agent", [
          `errorRate=${snapshot.errorRate}`,
          `backlog=${snapshot.backlog}`,
          `currentLoad=${snapshot.currentLoad}`,
          `projectedLoad=${snapshot.projectedLoad}`,
        ]);
        return {
          summary: recommendation.summary,
          reasonCodes: [`ops_agent.assist.${recommendation.severity}`],
          details: {
            checklist: recommendation.checklist,
            severity: recommendation.severity,
            findingCount: recommendation.findingCount,
          },
        };
      }
    }
  }

  private evictOldProposals(): void {
    while (this.proposals.size > PlatformOpsAgentService.MAX_STORED_PROPOSALS) {
      const oldestProposalId = this.proposals.keys().next().value;
      if (typeof oldestProposalId !== "string") {
        break;
      }
      this.proposals.delete(oldestProposalId);
    }
  }
}
