import { z } from "zod";

export const RESEARCH_QUALITY_DIMENSIONS = [
  "claimFaithfulness",
  "evidencePrecision",
  "methodUnderstanding",
  "experimentReliability",
  "selfResearchRelevance",
  "actionability",
  "riskAwareness",
  "noveltyDetection",
  "contradictionHandling",
] as const;

export type ResearchQualityDimension =
  (typeof RESEARCH_QUALITY_DIMENSIONS)[number];

export const ResearchQualityRubricSchema = z.object(
  Object.fromEntries(
    RESEARCH_QUALITY_DIMENSIONS.map((dimension) => [
      dimension,
      z.number().int().min(0).max(5),
    ]),
  ) as Record<ResearchQualityDimension, z.ZodNumber>,
);

export type ResearchQualityRubric = z.infer<typeof ResearchQualityRubricSchema>;

export const ResearchGoldenCaseSchema = z
  .object({
    caseId: z.string().min(1),
    paperRef: z.string().min(1),
    claimEvidenceRefs: z.array(z.string().min(1)).min(1),
    expertLabels: z.array(z.string().min(1)).min(1),
    benchmarkVersion: z.string().min(1),
  })
  .strict();

export type ResearchGoldenCase = z.infer<typeof ResearchGoldenCaseSchema>;

export interface ResearchQualityScore {
  readonly weightedScore: number;
  readonly normalizedScore: number;
  readonly passed: boolean;
  readonly dimensions: ResearchQualityRubric;
}

export interface ReviewerScorecard {
  readonly reviewerId: string;
  readonly caseId: string;
  readonly score: ResearchQualityRubric;
}

export interface ReviewerAgreementReport {
  readonly comparisonCount: number;
  readonly meanAbsoluteDelta: number;
  readonly agreementRatio: number;
  readonly passed: boolean;
}

export interface ReviewerDriftReport {
  readonly previousAverage: number;
  readonly currentAverage: number;
  readonly delta: number;
  readonly passed: boolean;
}

export function scoreResearchRubric(
  input: unknown,
  threshold = 0.8,
): ResearchQualityScore {
  const dimensions = ResearchQualityRubricSchema.parse(input);
  const weightedScore = RESEARCH_QUALITY_DIMENSIONS.reduce(
    (total, dimension) => total + dimensions[dimension],
    0,
  );
  const normalizedScore =
    weightedScore / (RESEARCH_QUALITY_DIMENSIONS.length * 5);
  return {
    weightedScore,
    normalizedScore,
    passed: normalizedScore >= threshold,
    dimensions,
  };
}

export function validateResearchGoldenSet(
  input: unknown,
): ResearchGoldenCase[] {
  return z.array(ResearchGoldenCaseSchema).min(1).parse(input);
}

export function buildReviewerAgreementReport(
  scorecards: readonly ReviewerScorecard[],
  maxMeanAbsoluteDelta = 0.75,
): ReviewerAgreementReport {
  const pairs: number[] = [];
  const byCase = new Map<string, ReviewerScorecard[]>();
  for (const scorecard of scorecards) {
    const existing = byCase.get(scorecard.caseId) ?? [];
    existing.push(scorecard);
    byCase.set(scorecard.caseId, existing);
  }
  for (const caseScorecards of byCase.values()) {
    for (let left = 0; left < caseScorecards.length; left += 1) {
      for (let right = left + 1; right < caseScorecards.length; right += 1) {
        pairs.push(
          meanDimensionDelta(caseScorecards[left]!, caseScorecards[right]!),
        );
      }
    }
  }
  const meanAbsoluteDelta =
    pairs.length === 0 ? Number.POSITIVE_INFINITY : average(pairs);
  const agreementRatio =
    pairs.length === 0
      ? 0
      : pairs.filter((delta) => delta <= maxMeanAbsoluteDelta).length /
        pairs.length;
  return {
    comparisonCount: pairs.length,
    meanAbsoluteDelta,
    agreementRatio,
    passed: pairs.length > 0 && meanAbsoluteDelta <= maxMeanAbsoluteDelta,
  };
}

export function buildReviewerDriftReport(
  previousScores: readonly ResearchQualityRubric[],
  currentScores: readonly ResearchQualityRubric[],
  maxDrift = 0.1,
): ReviewerDriftReport {
  const previousAverage = averageNormalizedScore(previousScores);
  const currentAverage = averageNormalizedScore(currentScores);
  const delta = Math.abs(currentAverage - previousAverage);
  return {
    previousAverage,
    currentAverage,
    delta,
    passed: delta <= maxDrift,
  };
}

function averageNormalizedScore(
  scores: readonly ResearchQualityRubric[],
): number {
  if (scores.length === 0) {
    return 0;
  }
  return (
    scores.reduce(
      (total, score) => total + scoreResearchRubric(score, 0).normalizedScore,
      0,
    ) / scores.length
  );
}

function meanDimensionDelta(
  left: ReviewerScorecard,
  right: ReviewerScorecard,
): number {
  return (
    RESEARCH_QUALITY_DIMENSIONS.reduce(
      (total, dimension) =>
        total + Math.abs(left.score[dimension] - right.score[dimension]),
      0,
    ) / RESEARCH_QUALITY_DIMENSIONS.length
  );
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}
