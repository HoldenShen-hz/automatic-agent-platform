import { TaskOutcomeGrader } from "./task-outcome-grader.js";
export class EvalRunService {
    grader;
    constructor(grader = new TaskOutcomeGrader()) {
        this.grader = grader;
    }
    evaluate(run) {
        const grade = this.grader.grade({
            evaluatorScore: run.decision?.confidence ?? 0,
            expectedEvidenceRefs: run.constraintPack.output_policy.requiredEvidence,
            actualEvidenceRefs: run.feedbackEnvelope?.signals ?? [],
            decisionAction: run.decision?.action ?? null,
        });
        return {
            runId: run.runId,
            overallPassed: grade.passed,
            grade,
            stepCount: run.steps.length,
            timelineEventCount: run.timeline.length,
        };
    }
}
//# sourceMappingURL=eval-run-service.js.map