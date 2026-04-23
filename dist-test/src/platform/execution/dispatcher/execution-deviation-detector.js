import { newId } from "../../contracts/types/ids.js";
export class ExecutionDeviationDetector {
    detect(plan, feedback) {
        const deviations = [];
        if (feedback.outcome === "repairable" || feedback.outcome === "failed" || feedback.outcome === "escalated") {
            deviations.push({
                deviationId: newId("deviation"),
                taskId: plan.taskId,
                severity: feedback.outcome === "repairable" ? "high" : "critical",
                reasonCode: `execution.${feedback.outcome}`,
                summary: `Execution outcome drifted to ${feedback.outcome}`,
                detectedAt: Date.now(),
            });
        }
        if (feedback.signals.some((signal) => signal.category === "timeout")) {
            deviations.push({
                deviationId: newId("deviation"),
                taskId: plan.taskId,
                severity: "high",
                reasonCode: "execution.timeout",
                summary: "Execution exceeded expected timing budget.",
                detectedAt: Date.now(),
            });
        }
        return deviations;
    }
}
//# sourceMappingURL=execution-deviation-detector.js.map