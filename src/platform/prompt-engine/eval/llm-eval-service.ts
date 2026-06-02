/**
 * LLM Continuous Evaluation & Prompt Regression CI Service
 *
 * Provides:
 * - Golden task evaluation suite management
 * - Prompt regression detection across versions
 * - A/B evaluation framework with statistical comparison
 * - CI gate integration for prompt/model changes
 * - Quality scoring and auto-degradation decisions
 *
 * @see docs_zh/contracts/prompt_model_policy_governance_contract.md
 */

import { createHash } from "node:crypto";

import { newId, nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import type { EvalSqlDatabase } from "./eval-storage-port.js";
import type {
  AbTestCaseEvaluation,
  AbTestConfig,
  AbTestOptions,
  AbTestResult,
  CiGateOptions,
  CiGateResult,
  EvalCaseDefinition,
  EvalCaseEvaluation,
  EvalCaseEvaluator,
  EvalCaseEvaluatorInput,
  EvalCaseResult,
  EvalRunRecord,
  EvalStatus,
  EvalStructuredOutput,
  EvalSuiteKind,
  EvalSuiteRecord,
  LlmEvaluationClient,
  QualityVerdict,
} from "./llm-eval-types.js";
export { LLM_EVAL_DDL } from "./prompt-model-policy-governance-schema.js";
export type {
  AbTestCaseEvaluation,
  AbTestCaseEvaluatorInput,
  AbTestConfig,
  AbTestOptions,
  AbTestResult,
  CiGateOptions,
  CiGateResult,
  EvalCaseDefinition,
  EvalCaseEvaluation,
  EvalCaseEvaluator,
  EvalCaseEvaluatorInput,
  EvalCaseResult,
  EvalRunRecord,
  EvalStatus,
  EvalStructuredOutput,
  EvalSuiteKind,
  EvalSuiteRecord,
  LlmEvaluationClient,
  QualityVerdict,
} from "./llm-eval-types.js";

type RawRow = Record<string, unknown>;
const logger = new StructuredLogger({ retentionLimit: 100 });
const SUITE_CASES_ENVELOPE_VERSION = "suite-cases/v1";

interface PersistedSuiteCasesEnvelope {
  version: string;
  frozenHash: string;
  cases: EvalCaseDefinition[];
}

const PROVIDER_FAMILY_TOKEN_REGISTRY = {
  anthropic: ["claude", "anthropic"],
  openai: ["gpt", "openai"],
  google: ["gemini", "google"],
  meta: ["llama", "meta"],
  mistral: ["mistral"],
  minimax: ["minimax"],
} as const;

function inferProviderFamilyFromModel(modelId: string): string {
  const normalized = modelId.trim().toLowerCase();
  const tokenSet = new Set(normalized.split(/[^a-z0-9]+/).filter((token) => token.length > 0));
  const matchedFamilies = Object.entries(PROVIDER_FAMILY_TOKEN_REGISTRY)
    .filter(([, tokens]) => tokens.some((token) => tokenSet.has(token)))
    .map(([family]) => family)
    .sort();
  if (matchedFamilies.length === 1) {
    return matchedFamilies[0]!;
  }
  if (matchedFamilies.length > 1) {
    return `ambiguous:${matchedFamilies.join(",")}`;
  }
  return `unknown:${normalized}`;
}

// ── Service ────────────────────────────────────────────────────────────

/**
 * Service for LLM evaluation including suite management, run execution,
 * A/B testing, and CI gate evaluation for prompt/model releases.
 */
export class LlmEvalService {
  constructor(private readonly db: EvalSqlDatabase) {}

  // ── Suite Management ───────────────────────────────────────────────

  /**
   * Defines a new evaluation suite with test cases.
   */
  defineSuite(input: {
    name: string;
    kind: EvalSuiteKind;
    description?: string;
    cases: EvalCaseDefinition[];
  }): EvalSuiteRecord {
    const now = nowIso();
    const casesEnvelope = buildSuiteCasesEnvelope(input.cases);
    const suite: EvalSuiteRecord = {
      id: newId("esuite"),
      name: input.name,
      kind: input.kind,
      description: input.description ?? "",
      cases: JSON.stringify(casesEnvelope),
      createdAt: now,
      updatedAt: now,
    };

    this.db.connection
      .prepare(`INSERT INTO eval_suites (id, name, kind, description, cases, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(suite.id, suite.name, suite.kind, suite.description, suite.cases, suite.createdAt, suite.updatedAt);

    return suite;
  }

  /**
   * Retrieves a suite by ID.
   */
  getSuite(suiteId: string): EvalSuiteRecord | null {
    const row = this.db.connection.prepare(`SELECT * FROM eval_suites WHERE id = ?`).get(suiteId) as RawRow | undefined;
    return row ? this.mapSuite(row) : null;
  }

  /**
   * Lists all evaluation suites.
   */
  listSuites(): EvalSuiteRecord[] {
    return (this.db.connection.prepare(`SELECT * FROM eval_suites ORDER BY name`).all() as RawRow[]).map((r) => this.mapSuite(r));
  }

  // ── Eval Runs ──────────────────────────────────────────────────────

  /**
   * Starts a new evaluation run for a suite with a specific model and prompt version.
   */
  startRun(suiteId: string, modelId: string, promptVersion: string, triggeredBy: string = "ci"): EvalRunRecord {
    const suite = this.getSuite(suiteId);
    const casesEnvelope = suite ? this.parseSuiteCasesEnvelope(suite) : null;
    const cases = casesEnvelope?.cases ?? [];
    const now = nowIso();
    const normalizedPromptVersion = normalizePromptVersion(promptVersion);

    const run: EvalRunRecord = {
      id: newId("erun"),
      suiteId,
      modelId,
      promptVersion: normalizedPromptVersion,
      status: "running",
      totalCases: cases.length,
      passedCases: 0,
      failedCases: 0,
      averageScore: null,
      verdict: "inconclusive",
      startedAt: now,
      completedAt: null,
      triggeredBy,
      metadata: JSON.stringify({
        suiteCasesFrozenHash: casesEnvelope?.frozenHash ?? null,
        suiteCasesVersion: casesEnvelope?.version ?? null,
      }),
    };

    this.db.connection
      .prepare(`INSERT INTO eval_runs (id, suite_id, model_id, prompt_version, status, total_cases, passed_cases, failed_cases, average_score, verdict, started_at, completed_at, triggered_by, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(run.id, run.suiteId, run.modelId, run.promptVersion, run.status, run.totalCases, run.passedCases, run.failedCases, run.averageScore, run.verdict, run.startedAt, run.completedAt, run.triggeredBy, run.metadata);

    return run;
  }

  /**
   * Records the result of a single test case evaluation.
   */
  recordCaseResult(input: {
    runId: string;
    caseId: string;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    score: number;
    passed: boolean;
    latencyMs: number;
    metadata?: Record<string, unknown>;
  }): EvalCaseResult {
    const result: EvalCaseResult = {
      id: newId("ecr"),
      runId: input.runId,
      caseId: input.caseId,
      input: input.input,
      expectedOutput: input.expectedOutput,
      actualOutput: input.actualOutput,
      score: input.score,
      passed: input.passed,
      latencyMs: input.latencyMs,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    };

    this.db.connection
      .prepare(`INSERT INTO eval_case_results (id, run_id, case_id, input, expected_output, actual_output, score, passed, latency_ms, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(result.id, result.runId, result.caseId, result.input, result.expectedOutput, result.actualOutput, result.score, result.passed ? 1 : 0, result.latencyMs, result.metadata);

    return result;
  }

  /**
   * Completes an evaluation run, computing aggregate scores and verdict.
   */
  completeRun(runId: string): EvalRunRecord | null {
    const run = this.getRun(runId);
    if (run == null) {
      return null;
    }
    const results = this.db.connection
      .prepare(`SELECT * FROM eval_case_results WHERE run_id = ?`)
      .all(runId) as RawRow[];

    if (results.length === 0) return null;

    const passed = results.filter((r) => Boolean(r.passed)).length;
    const failed = results.length - passed;
    const scores = results.map((r) => Number(r.score));
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const suite = this.getSuite(run.suiteId);
    const criticalCaseIds = new Set(
      (suite == null ? [] : this.parseCases(suite))
        .filter((item) => item.priority === "critical")
        .map((item) => item.id),
    );
    const hasCriticalFailure = results.some((row) =>
      criticalCaseIds.has(String(row.case_id ?? "")) && !Boolean(row.passed),
    );
    const passRate = passed / results.length;

    let verdict: QualityVerdict;
    // R16-16 fix: §17.3 requires critical cases to pass 100%; degraded/pass
    // verdicts are only available when no critical case failed.
    if (hasCriticalFailure) verdict = "fail";
    else if (failed === 0) verdict = "pass";
    else if (passRate >= 0.95) verdict = "pass";
    else if (passRate >= 0.80) verdict = "degraded";
    else verdict = "fail";

    const status: EvalStatus = verdict === "pass" ? "passed" : (verdict === "degraded" ? "degraded" : "failed");
    const now = nowIso();

    this.db.connection
      .prepare(`UPDATE eval_runs SET status = ?, passed_cases = ?, failed_cases = ?, average_score = ?, verdict = ?, completed_at = ? WHERE id = ?`)
      .run(status, passed, failed, avgScore, verdict, now, runId);

    return this.getRun(runId);
  }

  /**
   * Retrieves an evaluation run by ID.
   */
  getRun(runId: string): EvalRunRecord | null {
    const row = this.db.connection.prepare(`SELECT * FROM eval_runs WHERE id = ?`).get(runId) as RawRow | undefined;
    return row ? this.mapRun(row) : null;
  }

  /**
   * Lists evaluation runs, optionally filtered by suite.
   */
  listRuns(suiteId?: string, limit: number = 50): EvalRunRecord[] {
    if (suiteId) {
      return (this.db.connection.prepare(`SELECT * FROM eval_runs WHERE suite_id = ? ORDER BY started_at DESC LIMIT ?`).all(suiteId, limit) as RawRow[]).map((r) => this.mapRun(r));
    }
    return (this.db.connection.prepare(`SELECT * FROM eval_runs ORDER BY started_at DESC LIMIT ?`).all(limit) as RawRow[]).map((r) => this.mapRun(r));
  }

  // ── A/B Testing ────────────────────────────────────────────────────

  /**
   * Runs an A/B test comparing two model/prompt combinations.
   *
   * Executes the same evaluation suite against control and treatment configurations,
   * then computes statistical significance of the difference in scores.
   *
   * R8-08 FIX: When llmClient is provided in options, uses real LLM evaluation
   * instead of deterministic scoring for authentic A/B test results.
   */
  async runAbTest(
    suiteId: string,
    config: AbTestConfig,
    options: AbTestOptions = {},
  ): Promise<AbTestResult> {
    // R16-17 fix: Validate judge independence per §17.5 - control and treatment
    // must not come from the same model or provider family.
    if (config.controlModelId === config.treatmentModelId) {
      throw new Error("ab_test.judge_independence_required: control and treatment must use different models per §17.5");
    }
    const controlFamily = inferProviderFamilyFromModel(config.controlModelId);
    const treatmentFamily = inferProviderFamilyFromModel(config.treatmentModelId);
    if (controlFamily.startsWith("ambiguous:") || treatmentFamily.startsWith("ambiguous:")) {
      throw new Error("ab_test.judge_independence_required: provider family inference is ambiguous; use explicitly registered model IDs per §17.5");
    }
    if (controlFamily === treatmentFamily) {
      throw new Error("ab_test.judge_independence_required: control and treatment must use different provider families per §17.5");
    }
    const controlRun = this.startRun(suiteId, config.controlModelId, config.controlPromptVersion, "ab_test");
    const treatmentRun = this.startRun(suiteId, config.treatmentModelId, config.treatmentPromptVersion, "ab_test");

    const suite = this.getSuite(suiteId);
    const cases = suite ? this.parseCases(suite) : [];
    const passThreshold = config.passThreshold ?? 0.8;

    // Use real LLM evaluation if client is provided, otherwise use deterministic fallback
    const useRealLlм = options.llmClient != null;
    const evaluator = options.llmEvaluator ?? createDeterministicAbEvaluator();

    // Collect individual scores for statistical testing (Welch's t-test and bootstrap CI)
    const controlScores: number[] = [];
    const treatmentScores: number[] = [];

    for (const c of cases) {
      let controlEvaluation: AbTestCaseEvaluation;
      let treatmentEvaluation: AbTestCaseEvaluation;

      if (useRealLlм) {
        // R8-08 FIX: Real LLM evaluation
        const [controlResult, treatmentResult] = await Promise.all([
          options.llmClient!.evaluate({
            modelId: config.controlModelId,
            promptVersion: config.controlPromptVersion,
            input: c.input,
            expectedOutput: c.expectedOutput,
          }),
          options.llmClient!.evaluate({
            modelId: config.treatmentModelId,
            promptVersion: config.treatmentPromptVersion,
            input: c.input,
            expectedOutput: c.expectedOutput,
          }),
        ]);
        controlEvaluation = {
          actualOutput: controlResult.actualOutput,
          score: controlResult.score,
          latencyMs: controlResult.latencyMs,
        };
        treatmentEvaluation = {
          actualOutput: treatmentResult.actualOutput,
          score: treatmentResult.score,
          latencyMs: treatmentResult.latencyMs,
        };
      } else {
        // Fallback to deterministic evaluation
        controlEvaluation = await evaluator.evaluateCase({
          suite: suite ?? controlRunSuiteFallback(suiteId),
          caseDefinition: c,
          modelId: config.controlModelId,
          promptVersion: config.controlPromptVersion,
          arm: "control",
          expectedOutput: c.expectedOutput,
        });
        treatmentEvaluation = await evaluator.evaluateCase({
          suite: suite ?? controlRunSuiteFallback(suiteId),
          caseDefinition: c,
          modelId: config.treatmentModelId,
          promptVersion: config.treatmentPromptVersion,
          arm: "treatment",
          expectedOutput: c.expectedOutput,
        });
      }

      this.recordCaseResult({
        runId: controlRun.id,
        caseId: c.id,
        input: c.input,
        expectedOutput: c.expectedOutput,
        actualOutput: serializeEvalOutput(controlEvaluation.actualOutput),
        score: clampScore(controlEvaluation.score),
        passed: clampScore(controlEvaluation.score) >= passThreshold,
        latencyMs: controlEvaluation.latencyMs ?? deterministicLatency(`${c.id}:control`),
      });
      this.recordCaseResult({
        runId: treatmentRun.id,
        caseId: c.id,
        input: c.input,
        expectedOutput: c.expectedOutput,
        actualOutput: serializeEvalOutput(treatmentEvaluation.actualOutput),
        score: clampScore(treatmentEvaluation.score),
        passed: clampScore(treatmentEvaluation.score) >= passThreshold,
        latencyMs: treatmentEvaluation.latencyMs ?? deterministicLatency(`${c.id}:treatment`),
      });

      // Collect individual scores for statistical testing
      controlScores.push(clampScore(controlEvaluation.score));
      treatmentScores.push(clampScore(treatmentEvaluation.score));
    }

    const controlCompleted = this.completeRun(controlRun.id);
    const treatmentCompleted = this.completeRun(treatmentRun.id);

    const controlAvg = controlCompleted?.averageScore ?? 0;
    const treatmentAvg = treatmentCompleted?.averageScore ?? 0;
    const improvement = controlAvg > 0 ? (treatmentAvg - controlAvg) / controlAvg : 0;

    // Issue #1959 FIX: Use proper Welch's t-test for statistical significance
    // The old calculateAbPValue was a crude approximation using fixed thresholds.
    // Now we use actual Welch's t-test with individual scores.
    const { pValue, zScore } = calculateWelchTTtest(controlScores, treatmentScores);

    // Issue #1959 FIX: Bootstrap confidence interval for improvement ratio
    // Uses 10,000 resampling iterations for reliable CI estimation.
    const confidenceInterval = bootstrapConfidenceInterval(controlScores, treatmentScores);

    const significant =
      Math.abs(improvement) >= config.significanceThreshold &&
      cases.length >= config.minSampleSize &&
      pValue <= 0.05;

    return {
      controlRunId: controlRun.id,
      treatmentRunId: treatmentRun.id,
      controlAvgScore: controlAvg,
      treatmentAvgScore: treatmentAvg,
      improvement,
      pValue,
      zScore,
      confidenceInterval,
      significant,
      verdict: significant && improvement > 0 ? "pass" : (significant && improvement < 0 ? "fail" : "inconclusive"),
      // R23-47 fix: Indicate when mock scores were used
      mockEvaluation: !useRealLlм,
    };
  }

  // ── CI Gate ───────────────────────────────────────────────────────

  /**
   * Runs a CI gate evaluation for a prompt/model release.
   *
   * Executes the evaluation suite and determines whether the release
   * passes the quality gate based on pass rate and regression detection.
   */
  runCiGate(
    suiteId: string,
    modelId: string,
    promptVersion: string,
    options: CiGateOptions = {},
  ): CiGateResult {
    const run = this.startRun(suiteId, modelId, promptVersion, "ci_gate");
    const suite = this.getSuite(suiteId);
    const cases = suite ? this.parseCases(suite) : [];
    const evaluator = options.evaluator ?? createDeterministicCiEvaluator();
    const passingVerdicts = options.passingVerdicts ?? ["pass", "degraded"];
    const improvementScoreThreshold = options.improvementScoreThreshold ?? 0.95;

    const regressions: string[] = [];
    const improvements: string[] = [];

    // Deterministic evaluation suitable for reproducible CI gating.
    for (const c of cases) {
      const evaluation = evaluator({
        suite: suite ?? {
          id: suiteId,
          name: "",
          kind: "golden",
          description: "",
          cases: "[]",
          createdAt: "",
          updatedAt: "",
        },
        caseDefinition: c,
        modelId,
        promptVersion,
      });
      const actualOutput = serializeEvalOutput(evaluation.actualOutput);
      const latencyMs = evaluation.latencyMs ?? deterministicLatency(c.id);

      const resultInput = {
        runId: run.id,
        caseId: c.id,
        input: c.input,
        expectedOutput: c.expectedOutput,
        actualOutput,
        score: evaluation.score,
        passed: evaluation.passed,
        latencyMs,
      } as {
        runId: string;
        caseId: string;
        input: string;
        expectedOutput: string;
        actualOutput: string;
        score: number;
        passed: boolean;
        latencyMs: number;
        metadata?: Record<string, unknown>;
      };
      if (evaluation.metadata != null) {
        resultInput.metadata = evaluation.metadata;
      }

      this.recordCaseResult(resultInput);
      if (!evaluation.passed) {
        regressions.push(c.id);
      } else if (evaluation.score >= improvementScoreThreshold) {
        improvements.push(c.id);
      }
    }

    const completed = this.completeRun(run.id);
    const verdict = completed?.verdict ?? "inconclusive";
    const baselinePromptVersion = options.baselinePromptVersion ?? null;
    let regressionSummary = "";
    let baselineRegression = null as ReturnType<LlmEvalService["detectRegression"]> | null;
    if (baselinePromptVersion != null) {
      baselineRegression = this.detectRegression(
        suiteId,
        modelId,
        promptVersion,
        baselinePromptVersion,
      );
      if (!baselineRegression.baselineCompatible) {
        regressions.push("baseline_fingerprint_mismatch");
        regressionSummary = `, baseline ${baselinePromptVersion} is incompatible with current suite fingerprint`;
      } else if (baselineRegression.hasRegression) {
        regressions.push(...baselineRegression.regressedCases);
        regressionSummary = `, regression delta vs ${baselinePromptVersion}: ${baselineRegression.delta.toFixed(2)}`;
      } else {
        regressionSummary = `, baseline delta vs ${baselinePromptVersion}: ${baselineRegression.delta.toFixed(2)}`;
      }
    }
    const uniqueRegressions = [...new Set(regressions)];
    const uniqueImprovements = [...new Set(improvements)];
    const passed = passingVerdicts.includes(verdict)
      && !(baselineRegression?.hasRegression ?? false);

    // R2-10: Enforce independence for high-risk evaluations per §21.7
    let independenceViolation: string | null = null;
    if (options.enforceIndependenceForHighRisk && cases.some((c) => c.priority === "critical" || c.priority === "high")) {
      if (!options.independentJudgeId) {
        independenceViolation = "high_risk_evaluation_requires_independent_judge";
      }
    }

    const gatePassed = passingVerdicts.includes(verdict)
      && !(baselineRegression?.hasRegression ?? false)
      && independenceViolation == null;

    const result: CiGateResult = {
      passed: gatePassed,
      runId: run.id,
      verdict: independenceViolation != null ? "inconclusive" as const : verdict,
      regressions: uniqueRegressions,
      improvements: uniqueImprovements,
      summary: `${completed?.passedCases ?? 0}/${completed?.totalCases ?? 0} cases passed, verdict: ${verdict}${regressionSummary}${independenceViolation != null ? ", independence violation: " + independenceViolation : ""}`,
      ...(independenceViolation != null ? { independenceViolation: independenceViolation ?? undefined } : {}),
    };
    return result;
  }

  // ── Prompt Regression Detection ────────────────────────────────────

  /**
   * Detects regression between two prompt versions by comparing scores.
   *
   * Compares the average score of the current version against the previous
   * version to identify if quality has degraded.
   */
  detectRegression(suiteId: string, modelId: string, currentVersion: string, previousVersion: string): {
    hasRegression: boolean;
    currentScore: number;
    previousScore: number;
    delta: number;
    regressedCases: string[];
    baselineCompatible: boolean;
  } {
    const currentRuns = this.db.connection
      .prepare(`SELECT * FROM eval_runs WHERE suite_id = ? AND model_id = ? AND prompt_version = ? AND status IN ('passed', 'degraded', 'failed') ORDER BY completed_at DESC LIMIT 1`)
      .all(suiteId, modelId, currentVersion) as RawRow[];

    const previousRuns = this.db.connection
      .prepare(`SELECT * FROM eval_runs WHERE suite_id = ? AND model_id = ? AND prompt_version = ? AND status IN ('passed', 'degraded', 'failed') ORDER BY completed_at DESC LIMIT 1`)
      .all(suiteId, modelId, previousVersion) as RawRow[];

    const currentRun = currentRuns[0];
    const previousRun = previousRuns[0];
    const currentMetadata = parseRunMetadata(currentRun?.metadata);
    const previousMetadata = parseRunMetadata(previousRun?.metadata);
    const baselineCompatible =
      currentRun == null
      || previousRun == null
      || (
        currentMetadata.suiteCasesFrozenHash != null
        && previousMetadata.suiteCasesFrozenHash != null
        && currentMetadata.suiteCasesFrozenHash === previousMetadata.suiteCasesFrozenHash
        && currentMetadata.suiteCasesVersion === previousMetadata.suiteCasesVersion
      );
    const currentScore = currentRun ? Number(currentRun.average_score ?? 0) : 0;
    const previousScore = previousRun ? Number(previousRun.average_score ?? 0) : 0;
    const delta = currentScore - previousScore;
    const regressionThreshold = this.resolveRegressionThreshold(suiteId);

    const regressedCases: string[] = [];
    if (currentRun) {
      const failedCases = this.db.connection
        .prepare(`SELECT case_id FROM eval_case_results WHERE run_id = ? AND passed = 0`)
        .all(String(currentRun.id)) as RawRow[];
      for (const c of failedCases) regressedCases.push(String(c.case_id));
    }

    return {
      hasRegression: !baselineCompatible || delta < regressionThreshold,
      currentScore,
      previousScore,
      delta,
      regressedCases,
      baselineCompatible,
    };
  }

  // ── Mappers ───────────────────────────────────────────────────────

  private mapSuite(row: RawRow): EvalSuiteRecord {
    return {
      id: String(row.id),
      name: String(row.name ?? ""),
      kind: String(row.kind ?? "golden") as EvalSuiteKind,
      description: String(row.description ?? ""),
      cases: String(row.cases ?? "[]"),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
    };
  }

  private mapRun(row: RawRow): EvalRunRecord {
    return {
      id: String(row.id),
      suiteId: String(row.suite_id ?? ""),
      modelId: String(row.model_id ?? ""),
      promptVersion: String(row.prompt_version ?? "default"),
      status: String(row.status ?? "pending") as EvalStatus,
      totalCases: Number(row.total_cases ?? 0),
      passedCases: Number(row.passed_cases ?? 0),
      failedCases: Number(row.failed_cases ?? 0),
      averageScore: row.average_score != null ? Number(row.average_score) : null,
      verdict: String(row.verdict ?? "inconclusive") as QualityVerdict,
      startedAt: String(row.started_at ?? ""),
      completedAt: row.completed_at != null ? String(row.completed_at) : null,
      triggeredBy: String(row.triggered_by ?? "ci"),
      metadata: row.metadata != null ? String(row.metadata) : null,
    };
  }

  private parseCases(suite: EvalSuiteRecord): EvalCaseDefinition[] {
    try {
      return this.parseSuiteCasesEnvelope(suite)?.cases ?? [];
    } catch (error) {
      logger.warn("llm_eval_service.parse_cases_failed", {
        suiteId: suite.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private parseSuiteCasesEnvelope(suite: EvalSuiteRecord): PersistedSuiteCasesEnvelope | null {
    return parseSuiteCasesEnvelope(suite.id, suite.cases);
  }

  private resolveRegressionThreshold(suiteId: string): number {
    const suite = this.getSuite(suiteId);
    const cases = suite == null ? [] : this.parseCases(suite);
    if (cases.some((item) => item.priority === "critical")) {
      return -0.01;
    }
    if (cases.some((item) => item.priority === "high")) {
      return -0.03;
    }
    return -0.05;
  }
}

/**
 * Creates a deterministic evaluator that returns the expected output as actual output.
 * Used for CI gating where reproducibility is important.
 */
function createDeterministicCiEvaluator(): EvalCaseEvaluator {
  return ({ caseDefinition }) => {
    return {
      actualOutput: `unevaluated:${caseDefinition.id}`,
      score: 0,
      passed: false,
      latencyMs: deterministicLatency(caseDefinition.id),
      metadata: { reasonCode: "ci_evaluator_missing" },
    };
  };
}

function createDeterministicAbEvaluator(): NonNullable<AbTestOptions["llmEvaluator"]> {
  return {
    evaluateCase(input) {
      const actualOutput = `${input.arm}:${input.modelId}:${input.promptVersion}:${input.expectedOutput}`;
      const score = deterministicAbScore(`${input.arm}:${input.modelId}:${input.promptVersion}:${input.caseDefinition.id}`);
      return {
        actualOutput,
        score,
        latencyMs: deterministicLatency(`${input.arm}:${input.caseDefinition.id}`),
      };
    },
  };
}

function controlRunSuiteFallback(suiteId: string): EvalSuiteRecord {
  return {
    id: suiteId,
    name: "",
    kind: "ab_test",
    description: "",
    cases: "[]",
    createdAt: "",
    updatedAt: "",
  };
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(1, Number(score.toFixed(6))));
}

function deterministicAbScore(seed: string): number {
  return clampScore(0.35 + deterministicUnitInterval(seed) * 0.3);
}

/**
 * Calculates mean of an array of numbers.
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculates sample variance of an array of numbers.
 */
function calculateVariance(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1);
}

/**
 * Issue #1959 FIX: Welch's t-test for comparing two independent sample means.
 *
 * This replaces the old `calculateAbPValue` which used a crude approximation
 * based on fixed 0.85/0.90 thresholds that made the statistical test meaningless.
 *
 * Welch's t-test does not assume equal variances and is appropriate for A/B testing
 * where control and treatment may have different variance characteristics.
 *
 * @param controlScores - Array of individual scores from control group
 * @param treatmentScores - Array of individual scores from treatment group
 * @returns Object containing pValue (two-tailed) and zScore (legacy field carrying the t-statistic)
 */
function calculateWelchTTtest(
  controlScores: number[],
  treatmentScores: number[],
): { pValue: number; zScore: number } {
  const n1 = controlScores.length;
  const n2 = treatmentScores.length;

  if (n1 === 0 || n2 === 0) {
    return { pValue: 1, zScore: 0 };
  }

  const mean1 = calculateMean(controlScores);
  const mean2 = calculateMean(treatmentScores);
  const var1 = calculateVariance(controlScores);
  const var2 = calculateVariance(treatmentScores);

  // Welch's t-statistic
  const se = Math.sqrt(var1 / n1 + var2 / n2);
  if (se === 0) {
    // Both groups have zero variance and identical means
    return { pValue: 1, zScore: 0 };
  }
  const tStatistic = (mean1 - mean2) / se;

  // Welch-Satterthwaite degrees of freedom
  const v1 = var1 / n1;
  const v2 = var2 / n2;
  const dfDenominator = Math.pow(v1, 2) / (n1 - 1) + Math.pow(v2, 2) / (n2 - 1);
  const df = dfDenominator === 0 ? Number.POSITIVE_INFINITY : Math.pow(v1 + v2, 2) / dfDenominator;
  const pValue = 2 * (1 - studentTCdf(Math.abs(tStatistic), df));

  return {
    pValue: Math.min(1, Math.max(0, pValue)),
    zScore: Number(tStatistic.toFixed(6)),
  };
}

/**
 * Standard normal cumulative distribution function.
 * Uses the error function (erf) approximation.
 */
function normalCdf(x: number): number {
  // Constants for Abramowitz and Stegun approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1 + sign * y);
}

/**
 * Issue #1959 FIX: Bootstrap confidence interval for improvement ratio.
 *
 * Uses non-parametric bootstrap resampling (10,000 iterations) to compute
 * a 95% confidence interval for the improvement ratio.
 *
 * This provides a more robust estimate than relying on a single p-value
 * and helps identify when results are genuinely significant vs. borderline.
 *
 * @param controlScores - Array of individual scores from control group
 * @param treatmentScores - Array of individual scores from treatment group
 * @returns Pair [lower, upper] representing 95% bootstrap CI
 */
function bootstrapConfidenceInterval(
  controlScores: number[],
  treatmentScores: number[],
  iterations: number = 10000,
  confidenceLevel: number = 0.95,
): [number, number] {
  if (controlScores.length === 0 || treatmentScores.length === 0) {
    return [0, 0];
  }

  const observedImprovement = calculateMean(treatmentScores) - calculateMean(controlScores);
  const bootstrapImprovements: number[] = [];
  const sampleIterations = Math.max(100, Math.trunc(iterations));

  for (let i = 0; i < sampleIterations; i++) {
    const resampledControl = resampleWithReplacement(controlScores);
    const resampledTreatment = resampleWithReplacement(treatmentScores);
    const diff = calculateMean(resampledTreatment) - calculateMean(resampledControl);
    bootstrapImprovements.push(diff);
  }

  bootstrapImprovements.sort((a, b) => a - b);

  const alpha = 1 - confidenceLevel;
  const maxIndex = bootstrapImprovements.length - 1;
  const lowerIndex = clampIndex(Math.floor((alpha / 2) * maxIndex), maxIndex);
  const upperIndex = clampIndex(Math.ceil((1 - alpha / 2) * maxIndex), maxIndex);
  const lower = bootstrapImprovements[lowerIndex] ?? observedImprovement;
  const upper = bootstrapImprovements[upperIndex] ?? observedImprovement;

  return [Number(lower.toFixed(6)), Number(upper.toFixed(6))];
}

/**
 * Resamples an array with replacement (bootstrap resampling).
 */
function resampleWithReplacement(values: number[]): number[] {
  if (values.length === 0) return [];
  const result: number[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const randomIndex = Math.floor(Math.random() * values.length);
    result.push(values[randomIndex] as number);
  }
  return result;
}

/**
 * Serializes evaluation output to string format.
 */
function serializeEvalOutput(output: EvalStructuredOutput): string {
  return typeof output === "string"
    ? output
    : JSON.stringify(output);
}

/**
 * Generates a deterministic latency value based on case ID.
 * Ensures consistent latency values for testing reproducibility.
 */
function deterministicLatency(seed: string): number {
  const checksum = [...seed].reduce((total, char) => total + char.charCodeAt(0), 0);
  return 40 + (checksum % 60);
}

function normalizePromptVersion(promptVersion: string): string {
  const normalized = promptVersion.trim();
  if (normalized.length === 0 || normalized === "default") {
    throw new Error("eval_run.prompt_version_required: promptVersion must be explicitly versioned and cannot use the default placeholder.");
  }
  return normalized;
}

function buildSuiteCasesEnvelope(cases: readonly EvalCaseDefinition[]): PersistedSuiteCasesEnvelope {
  const frozenHash = hashCaseDefinitions(cases);
  return {
    version: `${SUITE_CASES_ENVELOPE_VERSION}:${frozenHash.slice(0, 12)}`,
    frozenHash,
    cases: [...cases],
  };
}

function parseSuiteCasesEnvelope(suiteId: string, serializedCases: string): PersistedSuiteCasesEnvelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serializedCases);
  } catch (error) {
    logger.warn("llm_eval_service.parse_cases_failed", {
      suiteId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
  if (Array.isArray(parsed)) {
    return buildSuiteCasesEnvelope(parsed as EvalCaseDefinition[]);
  }
  if (isRecord(parsed) && Array.isArray(parsed.cases) && typeof parsed.frozenHash === "string" && typeof parsed.version === "string") {
    const cases = parsed.cases as EvalCaseDefinition[];
    const actualHash = hashCaseDefinitions(cases);
    if (actualHash !== parsed.frozenHash) {
      throw new Error(`eval_suite.case_fingerprint_mismatch:${suiteId}`);
    }
    return {
      version: String(parsed.version),
      frozenHash: String(parsed.frozenHash),
      cases,
    };
  }
  return null;
}

function hashCaseDefinitions(cases: readonly EvalCaseDefinition[]): string {
  return `sha256:${createHash("sha256").update(stableSerialize(cases)).digest("hex")}`;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function parseRunMetadata(raw: unknown): {
  suiteCasesFrozenHash: string | null;
  suiteCasesVersion: string | null;
} {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { suiteCasesFrozenHash: null, suiteCasesVersion: null };
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      suiteCasesFrozenHash: typeof parsed.suiteCasesFrozenHash === "string" ? parsed.suiteCasesFrozenHash : null,
      suiteCasesVersion: typeof parsed.suiteCasesVersion === "string" ? parsed.suiteCasesVersion : null,
    };
  } catch {
    return { suiteCasesFrozenHash: null, suiteCasesVersion: null };
  }
}

function deterministicUnitInterval(seed: string): number {
  const digest = createHash("sha256").update(seed).digest();
  return digest.readUInt32BE(0) / 0xffffffff;
}

function clampIndex(index: number, maxIndex: number): number {
  return Math.max(0, Math.min(maxIndex, index));
}

function studentTCdf(tValue: number, degreesOfFreedom: number): number {
  if (!Number.isFinite(degreesOfFreedom) || degreesOfFreedom <= 0) {
    return normalCdf(tValue);
  }
  const x = degreesOfFreedom / (degreesOfFreedom + tValue * tValue);
  const incompleteBeta = regularizedIncompleteBeta(x, degreesOfFreedom / 2, 0.5);
  return 1 - 0.5 * incompleteBeta;
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) {
    return 0;
  }
  if (x >= 1) {
    return 1;
  }
  const lnBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lnBeta) / a;
  if (x < (a + 1) / (a + b + 2)) {
    return front * betaContinuedFraction(x, a, b);
  }
  return 1 - (Math.exp(b * Math.log(1 - x) + a * Math.log(x) - lnBeta) / b) * betaContinuedFraction(1 - x, b, a);
}

function betaContinuedFraction(x: number, a: number, b: number): number {
  const maxIterations = 200;
  const epsilon = 3e-7;
  const fpMin = 1e-30;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < fpMin) {
    d = fpMin;
  }
  d = 1 / d;
  let fraction = d;
  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const evenIndex = iteration * 2;
    let numerator = (iteration * (b - iteration) * x) / ((a + evenIndex - 1) * (a + evenIndex));
    d = 1 + numerator * d;
    if (Math.abs(d) < fpMin) {
      d = fpMin;
    }
    c = 1 + numerator / c;
    if (Math.abs(c) < fpMin) {
      c = fpMin;
    }
    d = 1 / d;
    fraction *= d * c;

    numerator = (-(a + iteration) * (a + b + iteration) * x) / ((a + evenIndex) * (a + evenIndex + 1));
    d = 1 + numerator * d;
    if (Math.abs(d) < fpMin) {
      d = fpMin;
    }
    c = 1 + numerator / c;
    if (Math.abs(c) < fpMin) {
      c = fpMin;
    }
    d = 1 / d;
    const delta = d * c;
    fraction *= delta;
    if (Math.abs(delta - 1) < epsilon) {
      break;
    }
  }
  return fraction;
}

function logGamma(value: number): number {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];
  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  }
  let series = 0.9999999999998099;
  const shifted = value - 1;
  for (let index = 0; index < coefficients.length; index += 1) {
    series += coefficients[index]! / (shifted + index + 1);
  }
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(series);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
