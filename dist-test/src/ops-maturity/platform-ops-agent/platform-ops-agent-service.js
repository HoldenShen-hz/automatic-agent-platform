import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { OpsCapacityPredictorService } from "./capacity-predictor/index.js";
import { ConfigOptimizerService } from "./config-optimizer/index.js";
import { DeveloperAssistantService } from "./dev-assistant/index.js";
import { OpsHealthMonitorService, summarizeOpsHealth } from "./health-monitor/index.js";
import { IncidentDiagnoserService } from "./incident-diagnoser/index.js";
function riskFromSignals(incidentLevel, capacityRisk, actionType) {
    if (incidentLevel === "critical_incident" || capacityRisk === "high") {
        return "high";
    }
    if (actionType === "tune_config" || incidentLevel === "incident" || capacityRisk === "medium") {
        return "medium";
    }
    return "low";
}
function canExecuteAtLevel(level, riskLevel, approvalSatisfied = false) {
    switch (level) {
        case "observe_only":
        case "suggest_only":
            return false;
        case "supervised_execution":
            return riskLevel === "low" || approvalSatisfied;
        case "trusted_automation":
            return riskLevel !== "high";
    }
}
export class PlatformOpsAgentService {
    definition;
    proposals = new Map();
    capacityPredictor = new OpsCapacityPredictorService();
    configOptimizer = new ConfigOptimizerService();
    developerAssistant = new DeveloperAssistantService();
    healthMonitor = new OpsHealthMonitorService();
    incidentDiagnoser = new IncidentDiagnoserService();
    constructor(definition) {
        this.definition = definition;
    }
    createProposal(input) {
        const observedAt = input.observedAt ?? nowIso();
        const healthSnapshot = this.healthMonitor.evaluate(input.probes);
        const diagnosis = this.incidentDiagnoser.diagnose(input.errorRate, input.backlog, healthSnapshot.status);
        const incidentLevel = diagnosis.level;
        const capacityRisk = this.capacityPredictor.assessRisk(input.currentLoad, input.projectedLoad).riskLevel;
        const actionType = this.chooseActionType(input, incidentLevel, capacityRisk);
        const riskLevel = riskFromSignals(incidentLevel, capacityRisk, actionType);
        const reasonCodes = this.buildReasonCodes(input, incidentLevel, capacityRisk, actionType);
        const blockedBy = this.computeBlockers(input, actionType, riskLevel);
        const approvalStatus = this.computeApprovalStatus(riskLevel);
        const executable = blockedBy.length === 0
            && approvalStatus !== "pending"
            && canExecuteAtLevel(this.definition.maxAutonomyLevel, riskLevel);
        const proposal = {
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
        };
        this.proposals.set(proposal.proposalId, proposal);
        return proposal;
    }
    getProposal(proposalId) {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) {
            throw new Error(`ops_agent.proposal_not_found:${proposalId}`);
        }
        return proposal;
    }
    recordApproval(proposalId, approverId) {
        const proposal = this.getProposal(proposalId);
        if (!this.definition.requiredApprovals.includes(approverId)) {
            throw new Error(`ops_agent.approver_not_allowed:${approverId}`);
        }
        const approvals = proposal.approvals.includes(approverId)
            ? proposal.approvals
            : [...proposal.approvals, approverId];
        const approvalSatisfied = this.definition.requiredApprovals.every((item) => approvals.includes(item));
        const updated = {
            ...proposal,
            approvals,
            approvalStatus: approvalSatisfied ? "approved" : "pending",
            executable: proposal.blockedBy.filter((item) => !approvalSatisfied || item !== "ops_agent.autonomy_limit_reached").length === 0
                && approvalSatisfied
                && canExecuteAtLevel(this.definition.maxAutonomyLevel, proposal.riskLevel, approvalSatisfied),
        };
        this.proposals.set(proposalId, updated);
        return updated;
    }
    execute(proposalId) {
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
    chooseActionType(input, incidentLevel, capacityRisk) {
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
    buildSummary(actionType, input, incidentLevel, capacityRisk) {
        switch (actionType) {
            case "investigate_incident":
                return `incident:${incidentLevel}: ${summarizeOpsHealth(input.probes)}`;
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
    buildReasonCodes(input, incidentLevel, capacityRisk, actionType) {
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
    computeApprovalStatus(riskLevel) {
        if (riskLevel === "high" && this.definition.requiredApprovals.length > 0) {
            return "pending";
        }
        return this.definition.requiredApprovals.length === 0 ? "not_required" : "approved";
    }
    computeBlockers(input, actionType, riskLevel) {
        const blockedBy = [];
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
//# sourceMappingURL=platform-ops-agent-service.js.map