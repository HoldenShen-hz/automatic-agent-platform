import type { ImprovementProposal } from "./proposal-engine.js";

export interface EvaluationReport {
  proposalId: string;
  benchmarkCases: number;
  successRateBefore: number;
  successRateAfter: number;
  regressionRate: number;
  avgCostDelta: number;
  avgLatencyDelta: number;
  safetyViolations: number;
  decision: "promote" | "reject" | "needs_revision";
  createdAt: string;
  evaluationVersion: string;
  benchmarkSetId: string;
  baselineSnapshotRef: string;
  lockedCaseIds: readonly string[];
}

export interface BenchmarkResult {
  testCaseId: string;
  success: boolean;
  costUsd: number;
  latencyMs: number;
  violations: string[];
}

export interface BenchmarkRunner {
  evaluate(proposal: ImprovementProposal): Promise<EvaluationReport>;
  runBenchmarks(proposal: ImprovementProposal): Promise<BenchmarkResult[]>;
}

export interface BenchmarkCase {
  id: string;
  taskType: string;
  input: Record<string, unknown>;
  expectedOutput?: unknown;
  critical?: boolean;
  evalVersion?: string;
}

export interface BaselineMetrics {
  successRate: number;
  avgCostUsd: number;
  avgLatencyMs: number;
}

export interface LockedBaselineCase {
  successRate: number;
  avgCost: number;
  avgLatencyMs: number;
  sampleCount: number;
  snapshotRef?: string;
}

export interface ProposalExecutor {
  execute(
    proposal: ImprovementProposal,
    input: Record<string, unknown>,
  ): Promise<{
    success: boolean;
    costUsd: number;
    latencyMs: number;
    output?: unknown;
    violations: string[];
  }>;
}

export type ResolvedRisk = "low" | "medium" | "high";

export interface BenchmarkRunnerConfig {
  baseline?: BaselineMetrics;
  minSampleSize?: number;
  evaluationVersion?: string;
  benchmarkSetId?: string;
  proposalExecutor?: ProposalExecutor;
  benchmarkCases?: readonly BenchmarkCase[];
}

const DEFAULT_EVALUATION_VERSION = "eval-v1";
const DEFAULT_BENCHMARK_SET_ID = "benchmark-set/default";
const DEFAULT_BASELINE: BaselineMetrics = {
  successRate: 0.85,
  avgCostUsd: 0.25,
  avgLatencyMs: 4500,
};

export class SimpleBenchmarkRunner implements BenchmarkRunner {
  private benchmarkCases: BenchmarkCase[] = [];
  private globalBaselineMetrics: BaselineMetrics | null;
  private readonly minSampleSize: number;
  private evaluationVersion: string;
  private benchmarkSetId: string;
  private proposalExecutor: ProposalExecutor | null;
  private readonly baselineByCaseId = new Map<string, LockedBaselineCase>();

  public constructor(configOrCases: BenchmarkRunnerConfig | readonly BenchmarkCase[] = {}) {
    if (Array.isArray(configOrCases)) {
      this.benchmarkCases = [...configOrCases];
      this.globalBaselineMetrics = null;
      this.minSampleSize = 3;
      this.evaluationVersion = DEFAULT_EVALUATION_VERSION;
      this.benchmarkSetId = DEFAULT_BENCHMARK_SET_ID;
      this.proposalExecutor = null;
      return;
    }

    const config = configOrCases as BenchmarkRunnerConfig;

    this.benchmarkCases = [...(config.benchmarkCases ?? [])];
    this.globalBaselineMetrics = config.baseline ?? null;
    this.minSampleSize = config.minSampleSize ?? 3;
    this.evaluationVersion = config.evaluationVersion ?? DEFAULT_EVALUATION_VERSION;
    this.benchmarkSetId = config.benchmarkSetId ?? DEFAULT_BENCHMARK_SET_ID;
    this.proposalExecutor = config.proposalExecutor ?? null;
  }

  public addBenchmarkCase(benchmarkCase: BenchmarkCase): void {
    this.benchmarkCases.push(benchmarkCase);
  }

  public setProposalExecutor(executor: ProposalExecutor): void {
    this.proposalExecutor = executor;
  }

  public setEvaluationVersion(version: string): void {
    this.evaluationVersion = version;
  }

  public setBenchmarkSetId(benchmarkSetId: string): void {
    this.benchmarkSetId = benchmarkSetId;
  }

  public setBaseline(baseline: BaselineMetrics): void;
  public setBaseline(caseId: string, baseline: LockedBaselineCase): void;
  public setBaseline(caseIdOrBaseline: string | BaselineMetrics, baseline?: LockedBaselineCase): void {
    if (typeof caseIdOrBaseline === "string") {
      if (!baseline) {
        throw new Error("benchmark_runner.baseline_missing");
      }
      this.baselineByCaseId.set(caseIdOrBaseline, baseline);
      return;
    }
    this.globalBaselineMetrics = caseIdOrBaseline;
  }

  public resolveRisk(proposal: ImprovementProposal): ResolvedRisk {
    const kind = proposal.kind;
    const target = proposal.target.toLowerCase();
    const rationale = proposal.rationale.toLowerCase();
    const securityKeywords = ["security", "auth", "permission", "access_control", "validation", "forbidden"];

    if (kind === "prompt_patch" || kind === "threshold_tuning") {
      return "high";
    }
    if (securityKeywords.some((kw) => target.includes(kw) || rationale.includes(kw))) {
      return "high";
    }
    if (kind === "workflow_template") {
      return "medium";
    }
    return "low";
  }

  public async evaluate(proposal: ImprovementProposal): Promise<EvaluationReport> {
    const relevantCases = this.benchmarkCases.filter((c) => this.isRelevantCase(c, proposal));
    if (relevantCases.length === 0) {
      return {
        proposalId: proposal.id,
        benchmarkCases: 0,
        successRateBefore: 0,
        successRateAfter: 0,
        regressionRate: 0,
        avgCostDelta: 0,
        avgLatencyDelta: 0,
        safetyViolations: 0,
        decision: "needs_revision",
        createdAt: new Date().toISOString(),
        evaluationVersion: this.evaluationVersion,
        benchmarkSetId: this.benchmarkSetId,
        baselineSnapshotRef: "baseline:none",
        lockedCaseIds: [],
      };
    }

    const lockedBaselines = relevantCases.map((testCase) => {
      const baseline = this.baselineByCaseId.get(testCase.id);
      if (baseline) {
        return { caseId: testCase.id, baseline };
      }
      if (this.globalBaselineMetrics) {
        return {
          caseId: testCase.id,
          baseline: {
            successRate: this.globalBaselineMetrics.successRate,
            avgCost: this.globalBaselineMetrics.avgCostUsd,
            avgLatencyMs: this.globalBaselineMetrics.avgLatencyMs,
            sampleCount: this.minSampleSize,
            snapshotRef: "baseline:global",
          },
        };
      }
      throw new Error(`benchmark_runner.baseline_required:${testCase.id}`);
    });

    const results = await this.runBenchmarks(proposal);
    const benchmarkCases = results.length;
    const successCount = results.filter((r) => r.success).length;
    const successRateAfter = benchmarkCases > 0 ? successCount / benchmarkCases : 0;
    const baselineWeight = lockedBaselines.reduce((sum, entry) => sum + Math.max(entry.baseline.sampleCount, 1), 0);
    const successRateBefore = weightedPercentile(
      lockedBaselines.map((entry) => ({
        value: entry.baseline.successRate,
        weight: Math.max(entry.baseline.sampleCount, 1),
      })),
      0.5,
    );
    const avgCostBefore = baselineWeight > 0
      ? lockedBaselines.reduce(
        (sum, entry) => sum + (entry.baseline.avgCost * Math.max(entry.baseline.sampleCount, 1)),
        0,
      ) / baselineWeight
      : DEFAULT_BASELINE.avgCostUsd;
    const avgLatencyBefore = baselineWeight > 0
      ? lockedBaselines.reduce(
        (sum, entry) => sum + (entry.baseline.avgLatencyMs * Math.max(entry.baseline.sampleCount, 1)),
        0,
      ) / baselineWeight
      : DEFAULT_BASELINE.avgLatencyMs;
    const avgCostAfter = benchmarkCases > 0
      ? results.reduce((sum, r) => sum + r.costUsd, 0) / benchmarkCases
      : avgCostBefore;
    const avgLatencyAfter = benchmarkCases > 0
      ? results.reduce((sum, r) => sum + r.latencyMs, 0) / benchmarkCases
      : avgLatencyBefore;
    const avgCostDelta = avgCostBefore === 0 ? 0 : (avgCostAfter - avgCostBefore) / avgCostBefore;
    const avgLatencyDelta = avgLatencyBefore === 0 ? 0 : (avgLatencyAfter - avgLatencyBefore) / avgLatencyBefore;
    const safetyViolations = results.reduce((sum, r) => sum + r.violations.length, 0);
    const regressionRate = Math.max(0, successRateBefore - successRateAfter);

    let decision: EvaluationReport["decision"] = "promote";
    if (regressionRate > 0.05) {
      decision = "reject";
    } else if (safetyViolations > 0 || successRateAfter < successRateBefore) {
      decision = "needs_revision";
    }

    const lockedCaseIds = relevantCases.map((testCase) => testCase.id);
    const baselineSnapshotRef = lockedBaselines
      .map(({ caseId, baseline }) => baseline.snapshotRef ?? `baseline:${caseId}`)
      .join(",");

    return {
      proposalId: proposal.id,
      benchmarkCases,
      successRateBefore,
      successRateAfter,
      regressionRate,
      avgCostDelta,
      avgLatencyDelta,
      safetyViolations,
      decision,
      createdAt: new Date().toISOString(),
      evaluationVersion: this.evaluationVersion,
      benchmarkSetId: this.benchmarkSetId,
      baselineSnapshotRef,
      lockedCaseIds,
    };
  }

  public async runBenchmarks(proposal: ImprovementProposal): Promise<BenchmarkResult[]> {
    const relevantCases = this.benchmarkCases.filter((c) => this.isRelevantCase(c, proposal));
    if (relevantCases.length === 0) {
      return [];
    }
    if (!this.proposalExecutor) {
      throw new Error("ProposalExecutor required for benchmark execution");
    }

    const results: BenchmarkResult[] = [];
    for (const testCase of relevantCases) {
      const execution = await this.proposalExecutor.execute(proposal, {
        ...testCase.input,
        testCaseId: testCase.id,
        expectedOutput: testCase.expectedOutput,
        evalVersion: testCase.evalVersion ?? this.evaluationVersion,
      });
      results.push({
        testCaseId: testCase.id,
        success: execution.success,
        costUsd: execution.costUsd,
        latencyMs: execution.latencyMs,
        violations: execution.violations,
      });
    }
    return results;
  }

  private isRelevantCase(testCase: BenchmarkCase, proposal: ImprovementProposal): boolean {
    const target = proposal.target.toLowerCase();
    const kind = proposal.kind.toLowerCase();
    if (kind.includes("tool") && testCase.taskType.includes("tool")) return true;
    if (kind.includes("skill") && testCase.taskType.includes("skill")) return true;
    if (kind.includes("workflow") && testCase.taskType.includes("workflow")) return true;
    return target.includes(testCase.taskType.toLowerCase()) || this.benchmarkCases.length === 1;
  }
}

function weightedPercentile(samples: readonly { value: number; weight: number }[], percentile: number): number {
  if (samples.length === 0) {
    return 0;
  }
  const normalizedPercentile = Math.min(Math.max(percentile, 0), 1);
  const ordered = [...samples]
    .filter((sample) => Number.isFinite(sample.value) && Number.isFinite(sample.weight) && sample.weight > 0)
    .sort((a, b) => a.value - b.value);
  const totalWeight = ordered.reduce((sum, sample) => sum + sample.weight, 0);
  if (ordered.length === 0 || totalWeight <= 0) {
    return 0;
  }
  const threshold = totalWeight * normalizedPercentile;
  let cumulative = 0;
  for (const sample of ordered) {
    cumulative += sample.weight;
    if (cumulative >= threshold) {
      return sample.value;
    }
  }
  return ordered.at(-1)?.value ?? 0;
}
