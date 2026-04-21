import type { EvalCaseSubmission, EvalDatasetBaselineMetrics, EvalDatasetGatePolicy, EvalDatasetJudgeService, EvalDatasetRunReport, EvalRunPhase, JudgeProfileRecord } from "../eval/eval-dataset-judge-service.js";
import type { PromptTemplateRegistrationInput, PromptTemplateRecord, PromptTemplateRegistryService } from "../registry/index.js";
import type { PromptRolloutMode, PromptRolloutRecord, PromptRolloutService } from "./index.js";
export interface PlatformPromptReleaseInput {
    template: PromptTemplateRegistrationInput;
    datasetId: string;
    candidateProvider: string;
    candidateProviderFamily?: string | undefined;
    candidateModel: string;
    owner: string;
    mode: PromptRolloutMode;
    domainBlockCompatible: boolean;
    results: readonly EvalCaseSubmission[];
    judgeId?: string | null | undefined;
    phase?: EvalRunPhase | undefined;
    baseline?: EvalDatasetBaselineMetrics | undefined;
    gatePolicy?: EvalDatasetGatePolicy | undefined;
    autoActivate?: boolean | undefined;
}
export interface PlatformPromptReleaseResult {
    template: PromptTemplateRecord;
    evaluationReport: EvalDatasetRunReport;
    judge: JudgeProfileRecord | null;
    rollout: PromptRolloutRecord;
}
export declare class PlatformPromptReleaseOrchestrationService {
    private readonly templates;
    private readonly datasets;
    private readonly rollouts;
    constructor(templates: PromptTemplateRegistryService, datasets: EvalDatasetJudgeService, rollouts: PromptRolloutService);
    createRelease(input: PlatformPromptReleaseInput): PlatformPromptReleaseResult;
    private resolveJudge;
}
