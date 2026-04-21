/**
 * Execution Outcome Evaluator
 *
 * Evaluates execution outcomes based on feedback signals and quality thresholds.
 * Quality thresholds are loaded from config/quality/default.json for runtime flexibility.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §17
 */
import { newId } from "../../contracts/types/ids.js";
/** Default quality gate config values */
const DEFAULT_QUALITY_GATE_CONFIG = {
    qualityGate: {
        defaultPassThreshold: 0.5,
        criticalPassThreshold: 0.8,
        enforcement: "blocking",
    },
    qualityScoreWeights: {
        successSignal: 0.35,
        completionOutcome: 0.45,
        failureSignal: 0.3,
        partialSignal: 0.1,
    },
    actionThresholds: {
        completeMinScore: 0.5,
        approvalRequiredScore: 0.3,
        retryMaxFailures: 3,
    },
    evidence: {
        enabled: false,
        artifactKind: "quality-evaluation",
        retentionDays: 90,
    },
};
export class ExecutionOutcomeEvaluator {
    config;
    constructor(options = {}) {
        this.config = options.config ?? DEFAULT_QUALITY_GATE_CONFIG;
    }
    evaluate(plan, feedback) {
        const failureSignals = feedback.signals.filter((signal) => signal.category === "failure" || signal.category === "timeout");
        const partialSignals = feedback.signals.filter((signal) => signal.category === "partial");
        const successSignals = feedback.signals.filter((signal) => signal.category === "success");
        const { successSignal, completionOutcome, failureSignal, partialSignal } = this.config.qualityScoreWeights;
        const successBonus = successSignals.length * successSignal;
        const completionBonus = feedback.outcome === "completed" ? completionOutcome : 0;
        const failurePenalty = failureSignals.length * failureSignal;
        const partialPenalty = partialSignals.length * partialSignal;
        const qualityScore = Math.max(0, Math.min(1, successBonus + completionBonus - failurePenalty - partialPenalty));
        const { completeMinScore, approvalRequiredScore, retryMaxFailures } = this.config.actionThresholds;
        let nextAction;
        if (feedback.outcome === "completed" && qualityScore >= completeMinScore) {
            nextAction = "complete";
        }
        else if (feedback.outcome === "repairable") {
            nextAction = "replan";
        }
        else if (failureSignals.some((signal) => String(signal.payload.reasonCode ?? "").includes("approval"))) {
            nextAction = "approve";
        }
        else if (failureSignals.length > retryMaxFailures) {
            nextAction = "escalate";
        }
        else if (failureSignals.length > 0) {
            nextAction = "retry";
        }
        else if (qualityScore < approvalRequiredScore) {
            nextAction = "escalate";
        }
        else {
            nextAction = "approve";
        }
        const passed = nextAction === "complete" && qualityScore >= this.config.qualityGate.defaultPassThreshold;
        return {
            evaluationId: newId("outcome_eval"),
            taskId: plan.taskId,
            passed,
            qualityScore: Number(qualityScore.toFixed(2)),
            nextAction,
            reasons: feedback.signals.map((signal) => `${signal.category}:${String(signal.payload.summary ?? signal.payload.reasonCode ?? signal.category)}`),
            evaluatedAt: Date.now(),
            factorBreakdown: {
                successSignals: successSignals.length,
                failureSignals: failureSignals.length,
                partialSignals: partialSignals.length,
                completionBonus: Number(completionBonus.toFixed(2)),
                failurePenalty: Number(failurePenalty.toFixed(2)),
                partialPenalty: Number(partialPenalty.toFixed(2)),
            },
        };
    }
}
//# sourceMappingURL=execution-outcome-evaluator.js.map