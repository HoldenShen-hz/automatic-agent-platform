export class TaskOutcomeGrader {
    grade(input) {
        const findingCodes = [];
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
//# sourceMappingURL=task-outcome-grader.js.map