import { type TaskSituation, type UnifiedAssessment } from "./types/index.js";
export interface AssessmentServiceOptions {
    highRiskTools?: readonly string[];
}
export declare class AssessmentService {
    private readonly highRiskTools;
    constructor(options?: AssessmentServiceOptions);
    assess(input: TaskSituation): UnifiedAssessment;
    private deriveComplexity;
}
