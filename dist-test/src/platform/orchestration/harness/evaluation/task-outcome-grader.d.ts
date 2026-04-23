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
export declare class TaskOutcomeGrader {
    grade(input: TaskOutcomeGradeInput): TaskOutcomeGrade;
}
