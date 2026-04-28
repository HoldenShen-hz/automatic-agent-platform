export interface TaskOutcomeGradeInput {
  readonly evaluatorScore: number;
  readonly expectedEvidenceRefs: readonly string[];
  readonly actualEvidenceRefs: readonly string[];
  readonly decisionAction: string | null;
}

export interface TaskOutcomeGrade {
  readonly score: number;
  readonly passed: boolean;
  readonly findingCodes: readonly string[];
}

export class TaskOutcomeGrader {
  public grade(input: TaskOutcomeGradeInput): TaskOutcomeGrade {
    const findingCodes: string[] = [];
    const missingEvidence = input.expectedEvidenceRefs.filter((ref) => !input.actualEvidenceRefs.includes(ref));

    if (missingEvidence.length > 0) {
      findingCodes.push(...missingEvidence.map((ref) => `harness.eval.missing_evidence:${ref}`));
    }
    if (input.decisionAction !== "accept") {
      findingCodes.push(`harness.eval.non_accept_decision:${input.decisionAction ?? "none"}`);
    }

    const passed = findingCodes.length === 0 && input.evaluatorScore >= 0.75;
    return {
      score: Number(input.evaluatorScore.toFixed(4)),
      passed,
      findingCodes,
    };
  }
}
