import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";

export type EvalDatasetStage = "observe" | "assess" | "plan" | "feedback" | "deprecated";
export type EvalDatasetStatus = "draft" | "active" | "archived";
export type EvalCasePriority = "critical" | "standard";
export type QualityCriterionType =
  | "exact_match"
  | "contains"
  | "json_schema"
  | "semantic_similarity"
  | "llm_judge"
  | "custom_function";
export type EvalRunPhase = "offline" | "canary";
export type EvalDatasetGateDecision = "promote" | "hold" | "rollback";
export type JudgeProfileStatus = "ready" | "cooldown" | "disabled";

export interface EvalDatasetQualityCriterion {
  criterionId: string;
  type: QualityCriterionType;
  config: Record<string, unknown>;
  weight: number;
  threshold: number;
}

export interface EvalDatasetCase {
  caseId: string;
  input: Record<string, unknown>;
  expectedOutput?: unknown;
  qualityCriteria: EvalDatasetQualityCriterion[];
  tags: string[];
  priority: EvalCasePriority;
}

export interface EvalDatasetRecord {
  datasetId: string;
  name: string;
  version: string;
  stage: EvalDatasetStage;
  cases: EvalDatasetCase[];
  createdBy: string;
  packId: string | null;
  status: EvalDatasetStatus;
  createdAt: string;
  updatedAt: string;
}

export interface JudgeProfileRecord {
  judgeId: string;
  provider: string;
  providerFamily: string;
  modelId: string;
  capabilities: string[];
  /** R2-10: Risk levels this judge can independently evaluate */
  supportedRiskLevels: readonly ("critical" | "high" | "medium" | "low")[];
  maxCostUsd: number;
  status: JudgeProfileStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EvalCaseSubmission {
  caseId: string;
  output: unknown;
  latencyMs?: number;
  costUsd?: number;
  criterionSignals?: Record<string, number>;
  metadata?: Record<string, unknown>;
}

export interface EvalDatasetBaselineMetrics {
  passRate?: number;
  averageLatencyMs?: number;
  averageCostUsd?: number;
  weightedQualityScore?: number;
}

export interface EvalDatasetGatePolicy {
  minPassRate?: number;
  requireCriticalPass?: boolean;
  maxLatencyRegressionRatio?: number;
  maxCostRegressionRatio?: number;
  minQualityDelta?: number;
}

export interface EvalCriterionResult {
  criterionId: string;
  type: QualityCriterionType;
  score: number;
  passed: boolean;
  weight: number;
  threshold: number;
  reason: string;
}

export interface EvalDatasetCaseResult {
  caseId: string;
  passed: boolean;
  weightedQualityScore: number;
  priority: EvalCasePriority;
  latencyMs: number;
  costUsd: number;
  criterionResults: EvalCriterionResult[];
}

export interface EvalDatasetRunReport {
  runId: string;
  datasetId: string;
  candidateProvider: string;
  candidateModel: string;
  judgeId: string | null;
  phase: EvalRunPhase;
  gateDecision: EvalDatasetGateDecision;
  passRate: number;
  criticalPassRate: number;
  averageLatencyMs: number;
  averageCostUsd: number;
  weightedQualityScore: number;
  blockingFindings: string[];
  advisoryFindings: string[];
  caseResults: EvalDatasetCaseResult[];
  createdAt: string;
}

export type CustomCriterionEvaluator = (input: {
  criterion: EvalDatasetQualityCriterion;
  expectedOutput: unknown;
  output: unknown;
  criterionSignals: Record<string, number>;
  metadata: Record<string, unknown>;
}) => {
  score: number;
  passed?: boolean;
  reason?: string;
};

export interface EvalDatasetEvaluationInput {
  datasetId: string;
  candidateProvider: string;
  candidateProviderFamily?: string | undefined;
  candidateModel: string;
  results: readonly EvalCaseSubmission[];
  judgeId?: string | null | undefined;
  phase?: EvalRunPhase | undefined;
  baseline?: EvalDatasetBaselineMetrics | undefined;
  gatePolicy?: EvalDatasetGatePolicy | undefined;
}

export class EvalDatasetJudgeService {
  private readonly datasets = new Map<string, EvalDatasetRecord>();
  private readonly judges = new Map<string, JudgeProfileRecord>();
  private readonly reports = new Map<string, EvalDatasetRunReport>();

  public constructor(
    private readonly customEvaluators: Readonly<Record<string, CustomCriterionEvaluator>> = {},
  ) {}

  public registerDataset(input: {
    datasetId: string;
    name: string;
    version: string;
    stage: EvalDatasetStage;
    cases: readonly EvalDatasetCase[];
    createdBy: string;
    packId?: string | null;
    status?: EvalDatasetStatus;
  }): EvalDatasetRecord {
    const datasetId = normalizeRequired(input.datasetId, "datasetId");
    if (this.datasets.has(datasetId)) {
      throw new ValidationError(
        `eval_dataset.duplicate:${datasetId}`,
        `Evaluation dataset ${datasetId} is already registered.`,
      );
    }
    const now = nowIso();
    const cases = input.cases.map((item) => normalizeCase(item));
    ensureUniqueIds(cases.map((item) => item.caseId), "eval_dataset.case_id_duplicate", "Evaluation dataset case IDs must be unique.");

    // R2-4: Validate minimum sample sizes by risk level
    const criticalCases = cases.filter((c) => c.priority === "critical");
    const standardCases = cases.filter((c) => c.priority === "standard");
    if (criticalCases.length > 0 && criticalCases.length < 200) {
      throw new ValidationError(
        "eval_dataset.insufficient_critical_samples",
        `Evaluation dataset with critical cases requires at least 200 samples, got ${criticalCases.length}.`,
      );
    }
    if (standardCases.length > 0 && standardCases.length < 50) {
      throw new ValidationError(
        "eval_dataset.insufficient_medium_samples",
        `Evaluation dataset with standard (medium risk) cases requires at least 50 samples, got ${standardCases.length}.`,
      );
    }
    // R2-4: For datasets with both critical and standard, also enforce high ≥ 100 if any high-risk cases exist
    // Since priority only has critical/standard, we treat standard as medium; no explicit "high" exists
    // But if a dataset has > 0 critical AND > 0 standard, we require standard >= 100 for balanced coverage
    if (criticalCases.length > 0 && standardCases.length > 0 && standardCases.length < 100) {
      throw new ValidationError(
        "eval_dataset.insufficient_high_samples",
        `Evaluation dataset with both critical and standard cases requires at least 100 standard samples, got ${standardCases.length}.`,
      );
    }

    const record: EvalDatasetRecord = {
      datasetId,
      name: normalizeRequired(input.name, "name"),
      version: normalizeRequired(input.version, "version"),
      stage: input.stage,
      cases,
      createdBy: normalizeRequired(input.createdBy, "createdBy"),
      packId: normalizeOptional(input.packId ?? null),
      status: input.status ?? "draft",
      createdAt: now,
      updatedAt: now,
    };
    this.datasets.set(record.datasetId, record);
    return record;
  }

  public activateDataset(datasetId: string): EvalDatasetRecord {
    const current = this.getDatasetOrThrow(datasetId);
    const updated: EvalDatasetRecord = {
      ...current,
      status: "active",
      updatedAt: nowIso(),
    };
    this.datasets.set(datasetId, updated);
    return updated;
  }

  public getDataset(datasetId: string): EvalDatasetRecord | null {
    return this.datasets.get(datasetId) ?? null;
  }

  public listDatasets(status?: EvalDatasetStatus): EvalDatasetRecord[] {
    return [...this.datasets.values()].filter((item) => status == null || item.status === status);
  }

  public registerJudge(input: {
    judgeId: string;
    provider: string;
    providerFamily?: string;
    modelId: string;
    capabilities?: readonly string[];
    /** R2-10: Risk levels this judge can independently evaluate - must include the level being judged */
    supportedRiskLevels?: readonly ("critical" | "high" | "medium" | "low")[];
    maxCostUsd: number;
    status?: JudgeProfileStatus;
  }): JudgeProfileRecord {
    const judgeId = normalizeRequired(input.judgeId, "judgeId");
    if (this.judges.has(judgeId)) {
      throw new ValidationError(
        `eval_judge.duplicate:${judgeId}`,
        `Judge profile ${judgeId} is already registered.`,
      );
    }
    const now = nowIso();
    const record: JudgeProfileRecord = {
      judgeId,
      provider: normalizeRequired(input.provider, "provider"),
      providerFamily: normalizeRequired(input.providerFamily ?? input.provider, "providerFamily"),
      modelId: normalizeRequired(input.modelId, "modelId"),
      capabilities: dedupeStrings(input.capabilities ?? ["llm_judge"]),
      supportedRiskLevels: input.supportedRiskLevels ?? ["critical", "high", "medium", "low"],
      maxCostUsd: normalizePositiveNumber(input.maxCostUsd, "maxCostUsd"),
      status: input.status ?? "ready",
      createdAt: now,
      updatedAt: now,
    };
    this.judges.set(record.judgeId, record);
    return record;
  }

  public getJudge(judgeId: string): JudgeProfileRecord | null {
    return this.judges.get(judgeId) ?? null;
  }

  public suggestJudges(input: {
    candidateProvider: string;
    candidateProviderFamily?: string | undefined;
    requiredCapability?: string | undefined;
  }): JudgeProfileRecord[] {
    const candidateProvider = normalizeRequired(input.candidateProvider, "candidateProvider").toLowerCase();
    const candidateFamily = normalizeRequired(input.candidateProviderFamily ?? input.candidateProvider, "candidateProviderFamily").toLowerCase();
    const capability = input.requiredCapability?.trim().toLowerCase() ?? null;
    return [...this.judges.values()]
      .filter((judge) => judge.status === "ready")
      .filter((judge) => judge.provider.toLowerCase() !== candidateProvider)
      .filter((judge) => judge.providerFamily.toLowerCase() !== candidateFamily)
      .filter((judge) => capability == null || judge.capabilities.some((item) => item.toLowerCase() === capability))
      .sort((left, right) => left.maxCostUsd - right.maxCostUsd);
  }

  public evaluateDataset(input: EvalDatasetEvaluationInput): EvalDatasetRunReport {
    const dataset = this.getDatasetOrThrow(input.datasetId);
    if (dataset.status !== "active") {
      throw new ValidationError(
        `eval_dataset.inactive:${dataset.datasetId}`,
        `Evaluation dataset ${dataset.datasetId} must be active before use.`,
      );
    }

    const requiresJudge = dataset.cases.some((item) => item.qualityCriteria.some((criterion) => criterion.type === "llm_judge"));
    const selectedJudge = requiresJudge
      ? this.resolveJudge({
        judgeId: input.judgeId ?? null,
        candidateProvider: input.candidateProvider,
        candidateProviderFamily: input.candidateProviderFamily,
      })
      : null;
    const submissions = new Map(input.results.map((item) => [item.caseId, item]));
    const caseResults: EvalDatasetCaseResult[] = [];
    const blockingFindings: string[] = [];
    const advisoryFindings: string[] = [];

    for (const testCase of dataset.cases) {
      const submission = submissions.get(testCase.caseId);
      if (submission == null) {
        blockingFindings.push(`missing_case_result:${testCase.caseId}`);
        caseResults.push({
          caseId: testCase.caseId,
          passed: false,
          weightedQualityScore: 0,
          priority: testCase.priority,
          latencyMs: 0,
          costUsd: 0,
          criterionResults: [],
        });
        continue;
      }
      // R2-10: Validate judge independence - ensure judge can evaluate this risk level
      const caseRiskLevel = testCase.priority === "critical" ? "critical" : "medium";
      if (selectedJudge != null && !selectedJudge.supportedRiskLevels.includes(caseRiskLevel)) {
        throw new ValidationError(
          `eval_judge.risk_level_unsupported:${selectedJudge.judgeId}`,
          `Judge profile ${selectedJudge.judgeId} does not support ${caseRiskLevel} risk level evaluation. Supported: ${selectedJudge.supportedRiskLevels.join(", ")}`,
        );
      }

      const criterionSignals = submission.criterionSignals ?? {};
      const metadata = submission.metadata ?? {};
      const criterionResults = testCase.qualityCriteria.map((criterion) => this.evaluateCriterion({
        criterion,
        expectedOutput: testCase.expectedOutput,
        output: submission.output,
        criterionSignals,
        metadata,
        judgeId: selectedJudge?.judgeId ?? null,
      }));
      const weightedQualityScore = computeWeightedAverage(
        criterionResults.map((item) => ({ score: item.score, weight: item.weight })),
      );
      const passed = criterionResults.every((item) => item.passed);
      if (!passed) {
        advisoryFindings.push(`case_failed:${testCase.caseId}`);
      }
      caseResults.push({
        caseId: testCase.caseId,
        passed,
        weightedQualityScore,
        priority: testCase.priority,
        latencyMs: roundMetric(submission.latencyMs ?? 0),
        costUsd: roundMetric(submission.costUsd ?? 0),
        criterionResults,
      });
    }

    const passRate = computeRate(caseResults.filter((item) => item.passed).length, dataset.cases.length);
    const criticalCases = caseResults.filter((item) => item.priority === "critical");
    const criticalPassRate = criticalCases.length === 0
      ? 1
      : computeRate(criticalCases.filter((item) => item.passed).length, criticalCases.length);
    const averageLatencyMs = average(caseResults.map((item) => item.latencyMs));
    const averageCostUsd = average(caseResults.map((item) => item.costUsd));
    const weightedQualityScore = average(caseResults.map((item) => item.weightedQualityScore));
    const policy = {
      minPassRate: input.gatePolicy?.minPassRate ?? 0.95,
      requireCriticalPass: input.gatePolicy?.requireCriticalPass ?? true,
      maxLatencyRegressionRatio: input.gatePolicy?.maxLatencyRegressionRatio ?? 1.2,
      maxCostRegressionRatio: input.gatePolicy?.maxCostRegressionRatio ?? 1.5,
      minQualityDelta: input.gatePolicy?.minQualityDelta ?? -0.05,
    } satisfies Required<EvalDatasetGatePolicy>;

    if (passRate < policy.minPassRate) {
      blockingFindings.push(`pass_rate_below_threshold:${passRate}`);
    }
    // R2-12: critical_case_pass==100% is a hard gate that blocks release
    // 100% pass rate on critical cases is required for release - this is NOT advisory
    if (policy.requireCriticalPass) {
      if (criticalPassRate < 1) {
        blockingFindings.push(`critical_case_failed:${criticalPassRate}`);
      }
      // R2-12: When criticalPassRate === 1, this satisfies the hard gate - no finding needed
      // The gate passes silently when requirement is met
    }
    if (input.baseline?.averageLatencyMs != null && input.baseline.averageLatencyMs > 0) {
      const ratio = averageLatencyMs / input.baseline.averageLatencyMs;
      if (ratio > policy.maxLatencyRegressionRatio) {
        blockingFindings.push(`latency_regressed:${roundMetric(ratio)}`);
      }
    }
    if (input.baseline?.averageCostUsd != null && input.baseline.averageCostUsd > 0) {
      const ratio = averageCostUsd / input.baseline.averageCostUsd;
      if (ratio > policy.maxCostRegressionRatio) {
        blockingFindings.push(`cost_regressed:${roundMetric(ratio)}`);
      }
    }
    if (input.baseline?.weightedQualityScore != null) {
      const delta = roundMetric(weightedQualityScore - input.baseline.weightedQualityScore);
      if (delta < policy.minQualityDelta) {
        blockingFindings.push(`quality_score_regressed:${delta}`);
      }
    }
    if (selectedJudge != null) {
      advisoryFindings.push(`judge_assigned:${selectedJudge.judgeId}`);
    }

    const phase = input.phase ?? "offline";
    const report: EvalDatasetRunReport = {
      runId: newId("eval_dataset_run"),
      datasetId: dataset.datasetId,
      candidateProvider: normalizeRequired(input.candidateProvider, "candidateProvider"),
      candidateModel: normalizeRequired(input.candidateModel, "candidateModel"),
      judgeId: selectedJudge?.judgeId ?? null,
      phase,
      gateDecision: blockingFindings.length === 0 ? "promote" : phase === "canary" ? "rollback" : "hold",
      passRate,
      criticalPassRate,
      averageLatencyMs,
      averageCostUsd,
      weightedQualityScore,
      blockingFindings,
      advisoryFindings,
      caseResults,
      createdAt: nowIso(),
    };
    this.reports.set(report.runId, report);
    return report;
  }

  public listReports(datasetId?: string): EvalDatasetRunReport[] {
    return [...this.reports.values()].filter((item) => datasetId == null || item.datasetId === datasetId);
  }

  private resolveJudge(input: {
    judgeId: string | null;
    candidateProvider: string;
    candidateProviderFamily?: string | undefined;
  }): JudgeProfileRecord {
    const judge = input.judgeId == null
      ? this.suggestJudges({
        candidateProvider: input.candidateProvider,
        candidateProviderFamily: input.candidateProviderFamily,
        requiredCapability: "llm_judge",
      })[0] ?? null
      : this.getJudge(input.judgeId);
    if (judge == null) {
      throw new ValidationError(
        "eval_judge.not_available",
        "No compatible judge profile is available for llm_judge criteria.",
      );
    }
    if (judge.status !== "ready") {
      throw new ValidationError(
        `eval_judge.unavailable:${judge.judgeId}`,
        `Judge profile ${judge.judgeId} is not available.`,
      );
    }
    const candidateProvider = normalizeRequired(input.candidateProvider, "candidateProvider").toLowerCase();
    const candidateFamily = normalizeRequired(input.candidateProviderFamily ?? input.candidateProvider, "candidateProviderFamily").toLowerCase();
    if (judge.provider.toLowerCase() === candidateProvider || judge.providerFamily.toLowerCase() === candidateFamily) {
      throw new ValidationError(
        `eval_judge.provider_conflict:${judge.judgeId}`,
        "Judge LLM must use a different provider family from the evaluated candidate.",
      );
    }
    return judge;
  }

  private getDatasetOrThrow(datasetId: string): EvalDatasetRecord {
    const dataset = this.getDataset(datasetId);
    if (dataset == null) {
      throw new ValidationError(
        `eval_dataset.not_found:${datasetId}`,
        `Evaluation dataset ${datasetId} was not found.`,
      );
    }
    return dataset;
  }

  private evaluateCriterion(input: {
    criterion: EvalDatasetQualityCriterion;
    expectedOutput: unknown;
    output: unknown;
    criterionSignals: Record<string, number>;
    metadata: Record<string, unknown>;
    judgeId: string | null;
  }): EvalCriterionResult {
    const { criterion } = input;
    let score = 0;
    let reason = "criterion_failed";

    switch (criterion.type) {
      case "exact_match": {
        const matched = stableStringify(input.expectedOutput) === stableStringify(input.output);
        score = matched ? 1 : 0;
        reason = matched ? "exact_match_passed" : "exact_match_failed";
        break;
      }
      case "contains": {
        const needle = normalizeRequired(String(criterion.config.substring ?? criterion.config.needle ?? input.expectedOutput ?? ""), "substring");
        const haystack = stringifyText(input.output);
        const matched = haystack.includes(needle);
        score = matched ? 1 : 0;
        reason = matched ? "contains_passed" : "contains_failed";
        break;
      }
      case "json_schema": {
        const requiredKeys = Array.isArray(criterion.config.requiredKeys)
          ? criterion.config.requiredKeys.filter((item): item is string => typeof item === "string")
          : [];
        const output = input.output;
        const matched = isRecord(output) && requiredKeys.every((key) => key in output);
        score = matched ? 1 : 0;
        reason = matched ? "json_schema_passed" : "json_schema_failed";
        break;
      }
      case "semantic_similarity":
      case "llm_judge": {
        if (criterion.type === "llm_judge" && input.judgeId == null) {
          throw new ValidationError(
            `eval_judge.required:${criterion.criterionId}`,
            `Criterion ${criterion.criterionId} requires an assigned judge profile.`,
          );
        }
        score = roundMetric(input.criterionSignals[criterion.criterionId] ?? 0);
        reason = score >= criterion.threshold ? `${criterion.type}_passed` : `${criterion.type}_failed`;
        break;
      }
      case "custom_function": {
        const functionId = normalizeRequired(String(criterion.config.functionId ?? criterion.criterionId), "functionId");
        const evaluator = this.customEvaluators[functionId];
        if (evaluator == null) {
          throw new ValidationError(
            `eval_dataset.custom_evaluator_missing:${functionId}`,
            `Custom evaluator ${functionId} is not registered.`,
          );
        }
        const result = evaluator({
          criterion,
          expectedOutput: input.expectedOutput,
          output: input.output,
          criterionSignals: input.criterionSignals,
          metadata: input.metadata,
        });
        score = roundMetric(result.score);
        reason = result.reason?.trim() || (score >= criterion.threshold ? "custom_function_passed" : "custom_function_failed");
        return {
          criterionId: criterion.criterionId,
          type: criterion.type,
          score,
          passed: result.passed ?? score >= criterion.threshold,
          weight: criterion.weight,
          threshold: criterion.threshold,
          reason,
        };
      }
    }

    return {
      criterionId: criterion.criterionId,
      type: criterion.type,
      score,
      passed: score >= criterion.threshold,
      weight: criterion.weight,
      threshold: criterion.threshold,
      reason,
    };
  }
}

function normalizeCase(input: EvalDatasetCase): EvalDatasetCase {
  const qualityCriteria = input.qualityCriteria.map((criterion) => ({
    criterionId: normalizeRequired(criterion.criterionId, "criterionId"),
    type: criterion.type,
    config: criterion.config ?? {},
    weight: normalizePositiveNumber(criterion.weight, "weight"),
    threshold: normalizeThreshold(criterion.threshold, "threshold"),
  }));
  ensureUniqueIds(
    qualityCriteria.map((item) => item.criterionId),
    "eval_dataset.criterion_id_duplicate",
    "Evaluation case criterion IDs must be unique.",
  );
  if (qualityCriteria.length === 0) {
    throw new ValidationError(
      "eval_dataset.case_without_criteria",
      "Every evaluation case must define at least one quality criterion.",
    );
  }
  return {
    caseId: normalizeRequired(input.caseId, "caseId"),
    input: input.input ?? {},
    expectedOutput: input.expectedOutput,
    qualityCriteria,
    tags: dedupeStrings(input.tags),
    priority: input.priority,
  };
}

function ensureUniqueIds(values: readonly string[], code: string, message: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new ValidationError(code, message);
    }
    seen.add(value);
  }
}

function computeRate(passed: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return roundMetric(passed / total);
}

function computeWeightedAverage(values: readonly { score: number; weight: number }[]): number {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) {
    return 0;
  }
  return roundMetric(values.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight);
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return roundMetric(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${key}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function stringifyText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return stableStringify(value);
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new ValidationError(`eval_dataset.invalid_${field}`, `Field ${field} must be a non-empty string.`);
  }
  return normalized;
}

function normalizeOptional(value: string | null): string | null {
  if (value == null) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function normalizePositiveNumber(value: number, field: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ValidationError(`eval_dataset.invalid_${field}`, `Field ${field} must be a positive number.`);
  }
  return roundMetric(value);
}

function normalizeThreshold(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new ValidationError(`eval_dataset.invalid_${field}`, `Field ${field} must be between 0 and 1.`);
  }
  return roundMetric(value);
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter((item) => item.length > 0))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
