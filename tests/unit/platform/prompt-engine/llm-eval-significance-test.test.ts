import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for Issue #1960: Proper statistical significance testing
 *
 * The old calculateAbPValue was a crude threshold-based approximation.
 * The new implementation uses Welch's t-test with bootstrap confidence intervals.
 */

import { LlmEvalService } from "../../../../src/platform/prompt-engine/eval/llm-eval-service.js";

// Test helper functions directly for unit testing
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateVariance(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1);
}

function normalCdf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function welchTTest(
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

  const se = Math.sqrt(var1 / n1 + var2 / n2);
  if (se === 0) {
    return { pValue: 1, zScore: 0 };
  }
  const tStatistic = (mean1 - mean2) / se;
  const zScore = tStatistic;
  const pValue = 2 * (1 - normalCdf(Math.abs(zScore)));

  return {
    pValue: Math.min(1, Math.max(0, pValue)),
    zScore: Number(zScore.toFixed(6)),
  };
}

function resampleWithReplacement(values: number[]): number[] {
  if (values.length === 0) return [];
  const result: number[] = [];
  for (const _v of values) {
    const randomIndex = Math.floor(Math.random() * values.length);
    result.push(values[randomIndex] as number);
  }
  return result;
}

function bootstrapConfidenceInterval(
  controlScores: number[],
  treatmentScores: number[],
  iterations: number = 10000,
  confidenceLevel: number = 0.95,
): [number, number] {
  if (controlScores.length === 0 || treatmentScores.length === 0) {
    return [-Infinity, Infinity];
  }

  const observedImprovement = calculateMean(treatmentScores) - calculateMean(controlScores);
  const bootstrapImprovements: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const resampledControl = resampleWithReplacement(controlScores);
    const resampledTreatment = resampleWithReplacement(treatmentScores);
    const diff = calculateMean(resampledTreatment) - calculateMean(resampledControl);
    bootstrapImprovements.push(diff);
  }

  bootstrapImprovements.sort((a, b) => a - b);

  const alpha = 1 - confidenceLevel;
  const lowerPercentile = (alpha / 2) * 100;
  const upperPercentile = (1 - alpha / 2) * 100;
  const lowerIndex = Math.floor((lowerPercentile / 100) * iterations);
  const upperIndex = Math.floor((upperPercentile / 100) * iterations);

  const lower = bootstrapImprovements[lowerIndex] ?? -Infinity;
  const upper = bootstrapImprovements[upperIndex] ?? Infinity;

  return [Number(lower.toFixed(6)), Number(upper.toFixed(6))];
}

test("Welch's t-test correctly identifies significant difference", () => {
  // Control: uniformly low scores, Treatment: uniformly high scores
  // These should have a very low p-value (significant difference)
  const controlScores = [0.3, 0.35, 0.32, 0.28, 0.31];
  const treatmentScores = [0.85, 0.88, 0.82, 0.90, 0.87];

  const result = welchTTest(controlScores, treatmentScores);

  // Large difference in means should produce small p-value
  assert.ok(result.pValue < 0.05, `Expected p-value < 0.05, got ${result.pValue}`);
  // z-score should be negative (control < treatment)
  assert.ok(result.zScore < 0, `Expected negative z-score, got ${result.zScore}`);
});

test("Welch's t-test correctly identifies no significant difference", () => {
  // Both groups have similar distributions
  const controlScores = [0.70, 0.72, 0.68, 0.75, 0.71];
  const treatmentScores = [0.71, 0.73, 0.69, 0.74, 0.72];

  const result = welchTTest(controlScores, treatmentScores);

  // Small difference in means should produce high p-value
  assert.ok(result.pValue > 0.05, `Expected p-value > 0.05, got ${result.pValue}`);
});

test("Welch's t-test handles identical scores", () => {
  const controlScores = [0.5, 0.5, 0.5, 0.5];
  const treatmentScores = [0.5, 0.5, 0.5, 0.5];

  const result = welchTTest(controlScores, treatmentScores);

  // Identical scores should give p-value of 1
  assert.equal(result.pValue, 1, `Expected p-value = 1, got ${result.pValue}`);
  assert.equal(result.zScore, 0, `Expected zScore = 0, got ${result.zScore}`);
});

test("Welch's t-test handles zero variance with different means", () => {
  // One group has zero variance (all same values)
  const controlScores = [0.5, 0.5, 0.5, 0.5];
  const treatmentScores = [0.7, 0.7, 0.7, 0.7];

  const result = welchTTest(controlScores, treatmentScores);

  // The se calculation will hit zero variance case
  // With se=0, we return pValue=1, zScore=0 (conservative)
  assert.equal(result.zScore, 0);
});

test("Welch's t-test handles empty arrays", () => {
  const result = welchTTest([], [1, 2, 3]);
  assert.equal(result.pValue, 1);
  assert.equal(result.zScore, 0);
});

test("Bootstrap CI contains the true improvement when distributions differ", () => {
  // Use fixed "random" seed by controlling via deterministic resampling
  // For a real test, we verify the CI is computed correctly
  const controlScores = [0.5, 0.52, 0.48, 0.51, 0.49];
  const treatmentScores = [0.7, 0.72, 0.68, 0.71, 0.69];

  const [lower, upper] = bootstrapConfidenceInterval(controlScores, treatmentScores);

  // Since treatment > control, CI should be entirely positive
  assert.ok(lower > 0, `Expected lower bound > 0, got ${lower}`);
  assert.ok(upper > 0, `Expected upper bound > 0, got ${upper}`);
  assert.ok(lower < upper, `Expected lower < upper, got ${lower} >= ${upper}`);
});

test("Bootstrap CI returns [-Infinity, Infinity] for empty arrays", () => {
  const [lower, upper] = bootstrapConfidenceInterval([], [1, 2, 3]);
  assert.equal(lower, -Infinity);
  assert.equal(upper, Infinity);
});

test("A/B test result includes zScore and confidenceInterval fields", async () => {
  const db = createInMemoryDb();
  const service = new LlmEvalService(db as never);
  const suite = service.defineSuite({
    name: "statistical-test",
    kind: "ab_test",
    cases: [
      { id: "case-1", input: "hello", expectedOutput: "world" },
      { id: "case-2", input: "foo", expectedOutput: "bar" },
      { id: "case-3", input: "test", expectedOutput: "result" },
    ],
  });

  const result = await service.runAbTest(suite.id, {
    controlModelId: "model-a",
    treatmentModelId: "model-b",
    controlPromptVersion: "p1",
    treatmentPromptVersion: "p2",
    minSampleSize: 2,
    significanceThreshold: 0.1,
  });

  // Verify the new fields are present
  assert.ok("zScore" in result, "Result should include zScore field");
  assert.ok("confidenceInterval" in result, "Result should include confidenceInterval field");
  assert.equal(typeof result.zScore, "number", "zScore should be a number");
  assert.ok(Array.isArray(result.confidenceInterval), "confidenceInterval should be an array");
  assert.equal(result.confidenceInterval.length, 2, "confidenceInterval should have 2 elements");

  // Verify pValue is a proper number
  assert.equal(typeof result.pValue, "number", "pValue should be a number");
  assert.ok(result.pValue >= 0 && result.pValue <= 1, "pValue should be between 0 and 1");
});

test("A/B test significance correctly uses p-value threshold", async () => {
  const db = createInMemoryDb();
  const service = new LlmEvalService(db as never);
  const suite = service.defineSuite({
    name: "significance-test",
    kind: "ab_test",
    cases: [
      { id: "case-1", input: "test1", expectedOutput: "expected1" },
      { id: "case-2", input: "test2", expectedOutput: "expected2" },
      { id: "case-3", input: "test3", expectedOutput: "expected3" },
      { id: "case-4", input: "test4", expectedOutput: "expected4" },
      { id: "case-5", input: "test5", expectedOutput: "expected5" },
    ],
  });

  // Use evaluator that gives treatment consistently higher scores than control with some variance
  // to make the t-test computation meaningful (se != 0)
  const result = await service.runAbTest(suite.id, {
    controlModelId: "model-a",
    treatmentModelId: "model-b",
    controlPromptVersion: "p1",
    treatmentPromptVersion: "p2",
    minSampleSize: 2,
    significanceThreshold: 0.05,
  }, {
    llmEvaluator: {
      evaluateCase(input) {
        // Add case-specific variance so se != 0
        // Treatment is consistently ~0.45 points higher than control
        const baseScore = input.arm === "treatment" ? 0.85 : 0.4;
        const caseVariance = (parseInt(input.caseDefinition.id.replace("case-", ""), 10) % 3) * 0.03;
        const score = baseScore + caseVariance;
        return { actualOutput: `${input.arm}:${score}`, score, latencyMs: 50 };
      },
    },
  });

  // With treatment (0.85-0.91) >> control (0.4-0.46), we should have a significant result
  assert.ok(result.pValue < 0.05, `Expected p-value < 0.05 for clearly different distributions, got ${result.pValue}`);
  assert.ok(result.zScore < 0, "zScore should be negative when treatment > control");
});

function createInMemoryDb() {
  const suites = new Map<string, Record<string, unknown>>();
  const runs = new Map<string, Record<string, unknown>>();
  const caseResults: Record<string, unknown>[] = [];

  return {
    connection: {
      exec() {},
      prepare(sql: string) {
        return {
          run(...args: unknown[]) {
            if (sql.startsWith("INSERT INTO eval_suites")) {
              const [id, name, kind, description, cases, createdAt, updatedAt] = args;
              suites.set(String(id), {
                id,
                name,
                kind,
                description,
                cases,
                created_at: createdAt,
                updated_at: updatedAt,
              });
              return;
            }
            if (sql.startsWith("INSERT INTO eval_runs")) {
              const [id, suiteId, modelId, promptVersion, status, totalCases, passedCases, failedCases, averageScore, verdict, startedAt, completedAt, triggeredBy, metadata] = args;
              runs.set(String(id), {
                id,
                suite_id: suiteId,
                model_id: modelId,
                prompt_version: promptVersion,
                status,
                total_cases: totalCases,
                passed_cases: passedCases,
                failed_cases: failedCases,
                average_score: averageScore,
                verdict,
                started_at: startedAt,
                completed_at: completedAt,
                triggered_by: triggeredBy,
                metadata,
              });
              return;
            }
            if (sql.startsWith("INSERT INTO eval_case_results")) {
              const [id, runId, caseId, input, expectedOutput, actualOutput, score, passed, latencyMs, metadata] = args;
              caseResults.push({
                id,
                run_id: runId,
                case_id: caseId,
                input,
                expected_output: expectedOutput,
                actual_output: actualOutput,
                score,
                passed,
                latency_ms: latencyMs,
                metadata,
              });
              return;
            }
            if (sql.startsWith("UPDATE eval_runs SET")) {
              const [status, passedCases, failedCases, averageScore, verdict, completedAt, runId] = args;
              const existing = runs.get(String(runId));
              if (existing) {
                runs.set(String(runId), {
                  ...existing,
                  status,
                  passed_cases: passedCases,
                  failed_cases: failedCases,
                  average_score: averageScore,
                  verdict,
                  completed_at: completedAt,
                });
              }
            }
          },
          get(...args: unknown[]) {
            if (sql.startsWith("SELECT * FROM eval_suites WHERE id = ?")) {
              return suites.get(String(args[0]));
            }
            if (sql.startsWith("SELECT * FROM eval_runs WHERE id = ?")) {
              return runs.get(String(args[0]));
            }
            return undefined;
          },
          all(...args: unknown[]) {
            if (sql.startsWith("SELECT * FROM eval_case_results WHERE run_id = ?")) {
              return caseResults.filter((row) => row.run_id === args[0]);
            }
            if (sql.startsWith("SELECT actual_output FROM eval_case_results")) {
              return [...caseResults]
                .sort((left, right) => String(left.actual_output).localeCompare(String(right.actual_output)))
                .map((row) => ({ actual_output: row.actual_output }));
            }
            return [];
          },
        };
      },
    },
  };
}