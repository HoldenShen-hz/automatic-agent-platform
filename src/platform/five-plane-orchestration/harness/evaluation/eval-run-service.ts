import { getConstraintOutputPolicy, type HarnessRunRuntimeState } from "../index.js";
import { TaskOutcomeGrader, type TaskOutcomeGrade } from "./task-outcome-grader.js";

export interface HarnessEvaluationReport {
  readonly runId: string;
  readonly overallPassed: boolean;
  readonly grade: TaskOutcomeGrade;
  readonly stepCount: number;
  readonly timelineEventCount: number;
}

export class EvalRunService {
  private readonly grader: TaskOutcomeGrader;

  public constructor(grader: TaskOutcomeGrader = new TaskOutcomeGrader()) {
    this.grader = grader;
  }

  public evaluate(run: HarnessRunRuntimeState): HarnessEvaluationReport {
    const grade = this.grader.grade({
      evaluatorScore: run.decision?.confidence ?? 0,
      expectedEvidenceRefs: getConstraintOutputPolicy(run.constraintPack).requiredEvidence,
      actualEvidenceRefs: this.collectActualEvidenceRefs(run),
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

  private collectActualEvidenceRefs(run: HarnessRunRuntimeState): readonly string[] {
    const stepEvidenceRefs = Array.from(
      new Set(
        run.steps.flatMap((step) => step.evidenceRefs ?? []),
      ),
    );
    return stepEvidenceRefs;
  }
}
