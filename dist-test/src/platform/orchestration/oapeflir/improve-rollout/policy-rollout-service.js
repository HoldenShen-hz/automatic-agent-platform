import { AutoRollbackService } from "./auto-rollback-service.js";
import { GuardrailEvaluator } from "./guardrail-evaluator.js";
import { RolloutStateMachine } from "./rollout/rollout-state-machine.js";
import { rolloutFreezeManager } from "../../../shared/observability/rollout-freeze-manager.js";
const PROGRESSIVE_STATUSES = new Set([
    "canary_5",
    "partial_25",
    "partial_50",
    "partial_75",
    "stable",
]);
export class PolicyRolloutService {
    stateMachine = new RolloutStateMachine();
    guardrails = new GuardrailEvaluator();
    autoRollback;
    constructor(autoRollback = new AutoRollbackService()) {
        this.autoRollback = autoRollback;
    }
    decide(candidate, strategyVersion) {
        // Check if rollouts are frozen due to error budget exhaustion
        if (rolloutFreezeManager.isFrozen()) {
            return {
                allowed: false,
                releaseLevel: "suggest",
                reasonCode: "rollout.frozen_error_budget",
                reasonCodes: ["rollout.frozen_error_budget: rollouts are frozen due to error budget exhaustion"],
            };
        }
        const guardrailDecision = this.guardrails.evaluate(candidate, strategyVersion);
        if (!guardrailDecision.allowed) {
            return {
                allowed: false,
                releaseLevel: "suggest",
                reasonCode: guardrailDecision.reasonCodes[0] ?? "improvement.guardrail_blocked",
                reasonCodes: guardrailDecision.reasonCodes,
            };
        }
        if (candidate.status !== "approved" && strategyVersion.releaseLevel === "shadow") {
            return {
                allowed: false,
                releaseLevel: "suggest",
                reasonCode: "improvement.candidate_not_approved",
                reasonCodes: ["improvement.candidate_not_approved"],
            };
        }
        return {
            allowed: true,
            releaseLevel: strategyVersion.releaseLevel,
            reasonCode: `improvement.${strategyVersion.releaseLevel}`,
            reasonCodes: [`improvement.${strategyVersion.releaseLevel}`],
        };
    }
    start(candidate, strategyVersion, approvedBy) {
        const decision = this.decide(candidate, strategyVersion);
        if (!decision.allowed) {
            return null;
        }
        return this.stateMachine.transition(candidate, decision.releaseLevel, {
            approvedBy,
            strategyVersionId: strategyVersion.strategyVersionId,
            guardrailReasonCodes: decision.reasonCodes,
        });
    }
    promote(candidate, current, targetStatus, metrics, approvedBy) {
        const metricsGate = this.evaluateMetricsGate(current, targetStatus, metrics);
        if (!metricsGate.allowed) {
            if (metricsGate.rollback && metrics) {
                return this.rollback(candidate, current, metrics, approvedBy);
            }
            throw new Error(metricsGate.reasonCodes[0] ?? `Invalid rollout promotion: ${current.status} -> ${targetStatus}`);
        }
        return this.stateMachine.transition(candidate, inferLevelFromStatus(targetStatus), {
            currentStatus: current.status,
            targetStatus,
            approvedBy,
            strategyVersionId: current.strategyVersionId,
            guardrailReasonCodes: metricsGate.reasonCodes,
        });
    }
    rollback(candidate, current, metrics, approvedBy) {
        const rollbackDecision = this.autoRollback.evaluate(current, metrics);
        return this.stateMachine.transition(candidate, "off", {
            currentStatus: current.status,
            targetStatus: "rolled_back",
            approvedBy,
            strategyVersionId: current.strategyVersionId,
            guardrailReasonCodes: rollbackDecision.reasonCodes,
        });
    }
    evaluateMetricsGate(current, targetStatus, metrics) {
        if (!PROGRESSIVE_STATUSES.has(targetStatus) || current.status === "shadow") {
            return { allowed: true, rollback: false, reasonCodes: [] };
        }
        if (!metrics) {
            return {
                allowed: false,
                rollback: false,
                reasonCodes: ["rollout.metrics_required"],
            };
        }
        const rollbackDecision = this.autoRollback.evaluate(current, metrics);
        if (rollbackDecision.rollback) {
            return {
                allowed: false,
                rollback: true,
                reasonCodes: rollbackDecision.reasonCodes,
            };
        }
        return {
            allowed: true,
            rollback: false,
            reasonCodes: ["rollout.metrics_gate_passed"],
        };
    }
}
function inferLevelFromStatus(status) {
    switch (status) {
        case "draft":
        case "rejected":
        case "rolled_back":
        case "paused":
            return "off";
        case "pending_approval":
            return "suggest";
        case "shadow":
            return "shadow";
        case "canary_5":
            return "canary_5";
        case "partial_25":
            return "partial_25";
        case "partial_50":
            return "partial_50";
        case "partial_75":
            return "partial_75";
        case "stable":
            return "stable";
    }
}
//# sourceMappingURL=policy-rollout-service.js.map