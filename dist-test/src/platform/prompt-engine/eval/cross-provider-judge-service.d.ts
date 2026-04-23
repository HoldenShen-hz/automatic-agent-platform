import type { EvalDatasetEvaluationInput, EvalDatasetJudgeService, EvalDatasetRunReport, JudgeProfileRecord } from "./eval-dataset-judge-service.js";
export type JudgeSelectionStrategy = "cheapest" | "fastest" | "most_capable" | "provider_diverse";
export interface CrossProviderJudgeSelection {
    readonly selectedJudge: JudgeProfileRecord | null;
    readonly alternativeJudges: readonly JudgeProfileRecord[];
    readonly selectionStrategy: JudgeSelectionStrategy;
    readonly candidateProvider: string;
    readonly candidateProviderFamily: string | undefined;
}
export interface EvaluationPipelineConfig {
    readonly primaryJudgeId: string | null;
    readonly fallbackJudgeIds: readonly string[];
    readonly parallelEvaluation: boolean;
    readonly consensusThreshold: number;
}
export interface MultiProviderJudgeResult {
    readonly judgeId: string;
    readonly provider: string;
    readonly report: EvalDatasetRunReport;
}
export interface ConsensusEvaluationResult {
    readonly consensusDecision: "promote" | "hold" | "rollback";
    readonly individualResults: readonly MultiProviderJudgeResult[];
    readonly agreementScore: number;
    readonly blockingFindings: readonly string[];
}
export declare class CrossProviderJudgeService {
    private readonly judgeService;
    private readonly defaultStrategy;
    constructor(judgeService: EvalDatasetJudgeService, defaultStrategy?: JudgeSelectionStrategy);
    selectJudge(input: {
        candidateProvider: string;
        candidateProviderFamily?: string | undefined;
        strategy?: JudgeSelectionStrategy | undefined;
    }): CrossProviderJudgeSelection;
    evaluateWithCrossProviderJudge(input: EvalDatasetEvaluationInput): EvalDatasetRunReport;
    evaluateWithPipeline(input: {
        evaluation: EvalDatasetEvaluationInput;
        pipeline: EvaluationPipelineConfig;
    }): ConsensusEvaluationResult;
    suggestMultipleJudges(input: {
        candidateProvider: string;
        candidateProviderFamily?: string | undefined;
        maxJudges?: number | undefined;
        requiredCapability?: string | undefined;
    }): JudgeProfileRecord[];
    getProviderDiversityScore(judges: readonly JudgeProfileRecord[]): number;
}
