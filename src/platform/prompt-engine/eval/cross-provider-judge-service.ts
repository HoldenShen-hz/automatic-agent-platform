import type {
  EvalDatasetEvaluationInput,
  EvalDatasetJudgeService,
  EvalDatasetRunReport,
  JudgeProfileRecord,
} from "./eval-dataset-judge-service.js";

export interface CrossProviderJudgeSelection {
  readonly selectedJudge: JudgeProfileRecord | null;
  readonly alternativeJudges: readonly JudgeProfileRecord[];
}

export class CrossProviderJudgeService {
  public constructor(private readonly judgeService: EvalDatasetJudgeService) {}

  public selectJudge(input: {
    candidateProvider: string;
    candidateProviderFamily?: string | undefined;
  }): CrossProviderJudgeSelection {
    const alternatives = this.judgeService.suggestJudges({
      candidateProvider: input.candidateProvider,
      candidateProviderFamily: input.candidateProviderFamily,
      requiredCapability: "llm_judge",
    });
    return {
      selectedJudge: alternatives[0] ?? null,
      alternativeJudges: alternatives,
    };
  }

  public evaluateWithCrossProviderJudge(input: EvalDatasetEvaluationInput): EvalDatasetRunReport {
    const selection = this.selectJudge({
      candidateProvider: input.candidateProvider,
      candidateProviderFamily: input.candidateProviderFamily,
    });
    return this.judgeService.evaluateDataset({
      ...input,
      judgeId: input.judgeId ?? selection.selectedJudge?.judgeId ?? null,
    });
  }
}
