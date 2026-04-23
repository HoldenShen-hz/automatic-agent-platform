import { newId } from "../../contracts/types/ids.js";
export class ReplanningService {
    createTrigger(taskId, reasonCode, source, summary) {
        return {
            triggerId: newId("replan_trigger"),
            taskId,
            reasonCode,
            source,
            summary,
        };
    }
    decide(plan, feedback, trigger) {
        const repairable = feedback.outcome === "repairable" || feedback.signals.some((signal) => signal.category === "correction");
        const failed = feedback.outcome === "failed" || feedback.outcome === "escalated";
        const shouldReplan = repairable || failed;
        return {
            decisionId: newId("replan_decision"),
            taskId: plan.taskId,
            shouldReplan,
            nextPlanVersion: shouldReplan ? plan.version + 1 : null,
            strategy: shouldReplan ? "replanned" : null,
            reasonCode: trigger?.reasonCode ?? (shouldReplan ? "planning.execution_deviation" : "planning.no_replan_required"),
            decidedAt: Date.now(),
        };
    }
}
//# sourceMappingURL=replanning-service.js.map