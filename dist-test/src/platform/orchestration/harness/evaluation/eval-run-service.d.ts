import type { HarnessRun } from "../index.js";
import { TaskOutcomeGrader, type TaskOutcomeGrade } from "./task-outcome-grader.js";
export interface HarnessEvaluationReport {
    readonly runId: string;
    readonly overallPassed: boolean;
    readonly grade: TaskOutcomeGrade;
    readonly stepCount: number;
    readonly timelineEventCount: number;
}
export declare class EvalRunService {
    private readonly grader;
    constructor(grader?: TaskOutcomeGrader);
    evaluate(run: HarnessRun): HarnessEvaluationReport;
}
