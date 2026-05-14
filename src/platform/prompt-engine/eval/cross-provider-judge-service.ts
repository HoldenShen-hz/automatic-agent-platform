import type {
  EvalDatasetEvaluationInput,
  EvalDatasetJudgeService,
  EvalDatasetRunReport,
  JudgeProfileRecord,
} from "./eval-dataset-judge-service.js";

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

export class CrossProviderJudgeService {
  public constructor(
    private readonly judgeService: EvalDatasetJudgeService,
    private readonly defaultStrategy: JudgeSelectionStrategy = "cheapest",
  ) {}

  public selectJudge(input: {
    candidateProvider: string;
    candidateProviderFamily?: string | undefined;
    strategy?: JudgeSelectionStrategy | undefined;
  }): CrossProviderJudgeSelection {
    const strategy = input.strategy ?? this.defaultStrategy;
    const alternatives = this.judgeService.suggestJudges({
      candidateProvider: input.candidateProvider,
      candidateProviderFamily: input.candidateProviderFamily,
      requiredCapability: "llm_judge",
    });

    const selectedJudge = selectByStrategy(alternatives, strategy);

    return {
      selectedJudge,
      alternativeJudges: alternatives,
      selectionStrategy: strategy,
      candidateProvider: input.candidateProvider,
      candidateProviderFamily: input.candidateProviderFamily,
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

  public evaluateWithPipeline(input: {
    evaluation: EvalDatasetEvaluationInput;
    pipeline: EvaluationPipelineConfig;
  }): ConsensusEvaluationResult {
    const { evaluation, pipeline } = input;
    const results: MultiProviderJudgeResult[] = [];

    if (pipeline.primaryJudgeId) {
      const judge = this.judgeService.getJudge(pipeline.primaryJudgeId);
      if (judge && judge.status === "ready") {
        const report = this.judgeService.evaluateDataset({
          ...evaluation,
          judgeId: pipeline.primaryJudgeId,
        });
        results.push({
          judgeId: pipeline.primaryJudgeId,
          provider: judge.provider,
          report,
        });
      }
    }

    for (const judgeId of pipeline.fallbackJudgeIds) {
      if (judgeId === pipeline.primaryJudgeId) continue;
      const judge = this.judgeService.getJudge(judgeId);
      if (judge && judge.status === "ready") {
        const report = this.judgeService.evaluateDataset({
          ...evaluation,
          judgeId,
        });
        results.push({
          judgeId,
          provider: judge.provider,
          report,
        });
      }
    }

    return buildConsensusResult(results, pipeline.consensusThreshold, evaluation);
  }

  public suggestMultipleJudges(input: {
    candidateProvider: string;
    candidateProviderFamily?: string | undefined;
    maxJudges?: number | undefined;
    requiredCapability?: string | undefined;
  }): JudgeProfileRecord[] {
    const maxJudges = input.maxJudges ?? 3;
    const judges = this.judgeService.suggestJudges({
      candidateProvider: input.candidateProvider,
      candidateProviderFamily: input.candidateProviderFamily,
      requiredCapability: input.requiredCapability,
    });
    return judges.slice(0, maxJudges);
  }

  public getProviderDiversityScore(judges: readonly JudgeProfileRecord[]): number {
    const providerFamilies = new Set(judges.map((j) => j.providerFamily.toLowerCase()));
    return Number((providerFamilies.size / Math.max(judges.length, 1)).toFixed(2));
  }
}

function selectByStrategy(
  judges: JudgeProfileRecord[],
  strategy: JudgeSelectionStrategy,
): JudgeProfileRecord | null {
  if (judges.length === 0) return null;

  switch (strategy) {
    case "cheapest":
      return [...judges].sort((a, b) => a.maxCostUsd - b.maxCostUsd)[0] ?? null;
    case "fastest":
      return [...judges].sort((a, b) => estimateLatencyRank(a) - estimateLatencyRank(b) || a.maxCostUsd - b.maxCostUsd)[0] ?? null;
    case "most_capable":
      return [...judges].sort((a, b) => b.capabilities.length - a.capabilities.length)[0] ?? null;
    case "provider_diverse":
      return selectProviderDiverse(judges);
    default:
      return judges[0] ?? null;
  }
}

function selectProviderDiverse(judges: JudgeProfileRecord[]): JudgeProfileRecord | null {
  const byFamily = new Map<string, JudgeProfileRecord[]>();
  for (const judge of judges) {
    const family = judge.providerFamily.toLowerCase();
    const existing = byFamily.get(family) ?? [];
    existing.push(judge);
    byFamily.set(family, existing);
  }

  if (byFamily.size <= 1) {
    return judges[0] ?? null;
  }

  const representatives: JudgeProfileRecord[] = [];
  for (const familyJudges of byFamily.values()) {
    const first = familyJudges[0];
    if (first !== undefined) {
      representatives.push(first);
    }
  }

  return representatives.sort((a, b) => a.maxCostUsd - b.maxCostUsd)[0] ?? null;
}

function estimateLatencyRank(judge: JudgeProfileRecord): number {
  const modelId = judge.modelId.toLowerCase();
  let rank = 100;

  if (/(haiku|mini|flash|turbo|instant|fast)/.test(modelId)) {
    rank -= 35;
  }
  if (/(sonnet|pro|large|max|reasoning|opus|thinking)/.test(modelId)) {
    rank += 30;
  }
  if (judge.capabilities.length > 2) {
    rank += 5;
  }
  if (judge.providerFamily.toLowerCase() === "anthropic" && modelId.includes("haiku")) {
    rank -= 10;
  }

  return rank;
}

function buildConsensusResult(
  results: readonly MultiProviderJudgeResult[],
  threshold: number,
  evaluation?: EvalDatasetEvaluationInput,
): ConsensusEvaluationResult {
  if (results.length === 0) {
    return {
      consensusDecision: "hold",
      individualResults: [],
      agreementScore: 0,
      blockingFindings: ["no_judges_available"],
    };
  }

  const promoteCount = results.filter((r) => r.report.gateDecision === "promote").length;
  const holdCount = results.filter((r) => r.report.gateDecision === "hold").length;
  const rollbackCount = results.filter((r) => r.report.gateDecision === "rollback").length;
  if (results.length > 0 && promoteCount === 0 && rollbackCount === 0 && holdCount === results.length) {
    const signalValues = (evaluation?.results ?? []).flatMap((result) => Object.values(result.criterionSignals ?? {}));
    const averageSignal = signalValues.length > 0
      ? signalValues.reduce((sum, value) => sum + Number(value), 0) / signalValues.length
      : 0.5;
    if (averageSignal < 0.3) {
      return {
        consensusDecision: "rollback",
        individualResults: results,
        agreementScore: 1,
        blockingFindings: [...new Set(results.flatMap((r) => r.report.blockingFindings))],
      };
    }
    return {
      consensusDecision: "hold",
      individualResults: results,
      agreementScore: 0,
      blockingFindings: [...new Set(results.flatMap((r) => r.report.blockingFindings))],
    };
  }

  let consensusDecision: "promote" | "hold" | "rollback";
  if (promoteCount > rollbackCount && promoteCount >= holdCount) {
    consensusDecision = "promote";
  } else if (rollbackCount > promoteCount && rollbackCount >= holdCount) {
    consensusDecision = "rollback";
  } else if (promoteCount === rollbackCount && rollbackCount === holdCount) {
    consensusDecision = "hold";
  } else if (promoteCount > rollbackCount && promoteCount === holdCount) {
    consensusDecision = "hold";
  } else if (rollbackCount > promoteCount && rollbackCount === holdCount) {
    consensusDecision = "hold";
  } else if (rollbackCount > promoteCount) {
    consensusDecision = "rollback";
  } else if (promoteCount > rollbackCount) {
    consensusDecision = "promote";
  } else {
    consensusDecision = "hold";
  }

  const majorityCount =
    consensusDecision === "promote"
      ? promoteCount
      : consensusDecision === "rollback"
        ? rollbackCount
        : holdCount;
  const agreementScore = Number((majorityCount / results.length).toFixed(2));

  const allBlockingFindings = results.flatMap((r) => r.report.blockingFindings);

  return {
    consensusDecision,
    individualResults: results,
    agreementScore,
    blockingFindings: [...new Set(allBlockingFindings)],
  };
}
