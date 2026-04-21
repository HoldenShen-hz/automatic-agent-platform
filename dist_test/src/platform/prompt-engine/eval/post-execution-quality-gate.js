export class PostExecutionQualityGate {
    decide(evaluation) {
        if (evaluation.nextAction === "complete" && evaluation.passed) {
            return {
                accepted: true,
                releaseStage: "released",
                reasonCodes: ["quality.accepted"],
            };
        }
        if (evaluation.nextAction === "approve") {
            return {
                accepted: false,
                releaseStage: "approval",
                reasonCodes: ["quality.approval_required"],
            };
        }
        if (evaluation.nextAction === "retry" || evaluation.nextAction === "replan") {
            return {
                accepted: false,
                releaseStage: "repair",
                reasonCodes: ["quality.repair_required"],
            };
        }
        return {
            accepted: false,
            releaseStage: "blocked",
            reasonCodes: ["quality.blocked"],
        };
    }
}
//# sourceMappingURL=post-execution-quality-gate.js.map