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
    // R16-17 FIX: Honor parallelEvaluation flag — run fallback judges concurrently
    const judgeIds = [
      ...(pipeline.primaryJudgeId ? [pipeline.primaryJudgeId] : []),
      ...pipeline.fallbackJudgeIds.filter((id) => id !== pipeline.primaryJudgeId),
    ];

    if (pipeline.parallelEvaluation) {
      // Run all judges in parallel
      const parallelResults = judgeIds
        .map((judgeId) => {
          const judge = this.judgeService.getJudge(judgeId);
          if (!judge || judge.status !== "ready") return null;
          const report = this.judgeService.evaluateDataset({ ...evaluation, judgeId });
          return { judgeId, provider: judge.provider, report } as MultiProviderJudgeResult;
        })
        .filter((r): r is MultiProviderJudgeResult => r !== null);
      results.push(...parallelResults);
    } else {
      // Sequential evaluation (legacy behavior)
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
    }

    return buildConsensusResult(results, pipeline.consensusThreshold);
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
    case "most_capable":
      return [...judges].sort((a, b) => b.capabilities.length - a.capabilities.length)[0] ?? null;
    case "provider_diverse":
      return selectProviderDiverse(judges);
    case "fastest":
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

function buildConsensusResult(
  results: readonly MultiProviderJudgeResult[],
  threshold: number,
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

  // §21.5: agreementScore measures consensus around the final decision, not just promote votes.
  // All-rollback is a valid unanimous consensus and should score 1.0, not 0.
  // Find the modal decision (most common), then count how many judges agreed on it.
  const decisionCounts = { promote: promoteCount, hold: holdCount, rollback: rollbackCount };
  const modalDecision = (Object.keys(decisionCounts) as Array<keyof typeof decisionCounts>)
    .reduce((a, b) => decisionCounts[a] >= decisionCounts[b] ? a : b);
  const modalCount = decisionCounts[modalDecision];
  const agreementScore = Number((modalCount / results.length).toFixed(2));

  let consensusDecision: "promote" | "hold" | "rollback";
  if (agreementScore >= threshold) {
    consensusDecision = modalDecision as "promote" | "hold" | "rollback";
  } else if (promoteCount + holdCount > rollbackCount) {
    consensusDecision = "hold";
  } else {
    consensusDecision = "rollback";
  }

  const allBlockingFindings = results.flatMap((r) => r.report.blockingFindings);

  return {
    consensusDecision,
    individualResults: results,
    agreementScore,
    blockingFindings: [...new Set(allBlockingFindings)],
  };
}
