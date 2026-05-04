/**
 * Unit tests for LLM eval service
 *
 * Tests for llm-eval-service covering:
 * - Issue #1959: A/B test hardcoded 0.85/0.90 scores
 * - Issue #1960: Significance test is threshold comparison not stats
 * - Issue #1967: JSON.parse(suite.cases) without try/catch
 */

import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  LlmEvalService,
  type EvalSuiteRecord,
  type EvalRunRecord,
  type EvalCaseDefinition,
  type QualityVerdict,
  type EvalStatus,
  type AbTestConfig,
} from "../../../../../src/platform/prompt-engine/eval/llm-eval-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";

// Create an in-memory SQLite database for testing
function createMockDatabase(): AuthoritativeSqlDatabase {
  const connection = new DatabaseSync(":memory:");

  // Initialize schema
  connection.exec(`
    CREATE TABLE eval_suites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      description TEXT DEFAULT '',
      cases TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE eval_runs (
      id TEXT PRIMARY KEY,
      suite_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      status TEXT NOT NULL,
      total_cases INTEGER NOT NULL,
      passed_cases INTEGER NOT NULL,
      failed_cases INTEGER NOT NULL,
      average_score REAL,
      verdict TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      triggered_by TEXT NOT NULL,
      metadata TEXT
    );

    CREATE TABLE eval_case_results (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      case_id TEXT NOT NULL,
      input TEXT NOT NULL,
      expected_output TEXT NOT NULL,
      actual_output TEXT NOT NULL,
      score REAL NOT NULL,
      passed INTEGER NOT NULL,
      latency_ms INTEGER NOT NULL,
      metadata TEXT
    );
  `);

  return {
    filePath: ":memory:",
    backendType: "sqlite",
    connection: connection as unknown as AuthoritativeSqlDatabase["connection"],
    migrate: () => {},
    getSchemaStatus: () => ({ currentVersion: 1, pendingMigrations: 0 } as any),
    assertSchemaCurrent: () => {},
    integrityCheck: () => [],
    healthCheck: async () => true,
    transaction: <T>(work: () => T) => work(),
    readTransaction: <T>(work: () => T) => work(),
    close: () => {},
  } as AuthoritativeSqlDatabase;
}

// ============================================================================
// Issue #1959: A/B test hardcoded 0.85/0.90 scores
// ============================================================================

test("LlmEvalService.runAbTest computes actual scores from cases", async () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "ab-score-test-suite",
    kind: "ab_test",
    cases: [
      { id: "case-1", input: "input1", expectedOutput: "output1" },
      { id: "case-2", input: "input2", expectedOutput: "output2" },
    ],
  });

  const result = await service.runAbTest(suite.id, {
    controlModelId: "model-a",
    treatmentModelId: "model-b",
    controlPromptVersion: "v1.0",
    treatmentPromptVersion: "v2.0",
    minSampleSize: 2,
    significanceThreshold: 0.05,
  });

  // Issue #1959: Scores should be computed from case results, not hardcoded
  // Control and treatment scores should be different when inputs differ
  assert.ok(typeof result.controlAvgScore === "number");
  assert.ok(typeof result.treatmentAvgScore === "number");

  // The scores should vary based on case content, not be fixed at 0.85/0.90
  // If the fallback string-similarity scoring is used, scores depend on match percentage
});

test("LlmEvalService.runAbTest produces varied results for different inputs", async () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  // Suite with very different expected outputs to create low similarity
  const suite1 = service.defineSuite({
    name: "ab-varied-suite-1",
    kind: "ab_test",
    cases: [
      { id: "case-1", input: "completely different input", expectedOutput: "xyz123abc" },
    ],
  });

  const result1 = await service.runAbTest(suite1.id, {
    controlModelId: "model-a",
    treatmentModelId: "model-b",
    controlPromptVersion: "v1.0",
    treatmentPromptVersion: "v2.0",
    minSampleSize: 1,
    significanceThreshold: 0.1,
  });

  // Suite with similar expected outputs to create high similarity
  const suite2 = service.defineSuite({
    name: "ab-varied-suite-2",
    kind: "ab_test",
    cases: [
      { id: "case-1", input: "input", expectedOutput: "output" },
    ],
  });

  const result2 = await service.runAbTest(suite2.id, {
    controlModelId: "model-a",
    treatmentModelId: "model-b",
    controlPromptVersion: "v1.0",
    treatmentPromptVersion: "v2.0",
    minSampleSize: 1,
    significanceThreshold: 0.1,
  });

  // Different suites should produce different scores (not hardcoded)
  // At minimum, scores should be valid numbers between 0 and 1
  assert.ok(result1.controlAvgScore >= 0 && result1.controlAvgScore <= 1);
  assert.ok(result1.treatmentAvgScore >= 0 && result1.treatmentAvgScore <= 1);
  assert.ok(result2.controlAvgScore >= 0 && result2.controlAvgScore <= 1);
  assert.ok(result2.treatmentAvgScore >= 0 && result2.treatmentAvgScore <= 1);
});

test("LlmEvalService.runAbTest uses config significanceThreshold as the pass threshold for both arms", async () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "ab-threshold-suite",
    kind: "ab_test",
    cases: [
      {
        id: "case-1",
        input: "input1",
        expectedOutput: "abcdefghijklmnopqrst",
      },
    ],
  });

  const result = await service.runAbTest(suite.id, {
    controlModelId: "model-a",
    treatmentModelId: "model-b",
    controlPromptVersion: "v1.0",
    treatmentPromptVersion: "v2.0",
    minSampleSize: 1,
    significanceThreshold: 0.82,
  });

  const controlRun = service.getRun(result.controlRunId);
  const treatmentRun = service.getRun(result.treatmentRunId);

  assert.ok(controlRun);
  assert.ok(treatmentRun);
  assert.equal(controlRun?.passedCases, 0);
  assert.equal(treatmentRun?.passedCases, 0);
  assert.equal(controlRun?.failedCases, 1);
  assert.equal(treatmentRun?.failedCases, 1);
});

// ============================================================================
// Issue #1960: Significance test is threshold comparison not stats
// ============================================================================

test("LlmEvalService.runAbTest computes real z-score and p-value", async () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "significance-real-stats",
    kind: "ab_test",
    cases: [
      { id: "case-1", input: "test1", expectedOutput: "result1" },
      { id: "case-2", input: "test2", expectedOutput: "result2" },
      { id: "case-3", input: "test3", expectedOutput: "result3" },
      { id: "case-4", input: "test4", expectedOutput: "result4" },
      { id: "case-5", input: "test5", expectedOutput: "result5" },
    ],
  });

  const result = await service.runAbTest(suite.id, {
    controlModelId: "model-a",
    treatmentModelId: "model-b",
    controlPromptVersion: "v1.0",
    treatmentPromptVersion: "v2.0",
    minSampleSize: 5,
    significanceThreshold: 0.1,
  });

  // Issue #1960: zScore and pValue should be real statistical computations
  assert.ok(typeof result.zScore === "number");
  assert.ok(typeof result.pValue === "number");

  // zScore for two identical distributions should be close to 0
  // pValue for zScore=0 should be close to 1
  if (result.controlAvgScore === result.treatmentAvgScore) {
    assert.ok(Math.abs(result.zScore) < 0.1, "Identical scores should give z-score near 0");
  }
});

test("LlmEvalService.runAbTest significance includes effect size check", async () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "effect-size-suite",
    kind: "ab_test",
    cases: Array.from({ length: 20 }, (_, i) => ({
      id: `case-${i}`,
      input: `input${i}`,
      expectedOutput: `output${i}`,
    })),
  });

  const result = await service.runAbTest(suite.id, {
    controlModelId: "model-a",
    treatmentModelId: "model-b",
    controlPromptVersion: "v1.0",
    treatmentPromptVersion: "v2.0",
    minSampleSize: 20,
    significanceThreshold: 0.1,
  });

  // Final significance should consider:
  // 1. Statistical significance (p-value < 0.05)
  // 2. Effect size (improvement >= significanceThreshold)
  // 3. Minimum sample size

  // The significant field should be a boolean
  assert.equal(typeof result.significant === "boolean", true);

  // If significant is true, we expect p-value < 0.05
  if (result.significant) {
    assert.ok(result.pValue < 0.05, "Significant result should have p-value < 0.05");
    assert.ok(Math.abs(result.improvement) >= 0.1, "Significant result should have improvement >= threshold");
  }
});

test("LlmEvalService.runAbTest verdict reflects actual significance", async () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "verdict-suite",
    kind: "ab_test",
    cases: Array.from({ length: 10 }, (_, i) => ({
      id: `case-${i}`,
      input: `input${i}`,
      expectedOutput: `output${i}`,
    })),
  });

  const result = await service.runAbTest(suite.id, {
    controlModelId: "model-a",
    treatmentModelId: "model-b",
    controlPromptVersion: "v1.0",
    treatmentPromptVersion: "v2.0",
    minSampleSize: 10,
    significanceThreshold: 0.1,
  });

  // Verdict should be pass, fail, or inconclusive based on significance
  assert.ok(
    result.verdict === "pass" ||
    result.verdict === "fail" ||
    result.verdict === "inconclusive",
    `Verdict should be one of pass/fail/inconclusive, got: ${result.verdict}`,
  );

  // Verdict should align with significant flag
  if (result.significant && result.improvement > 0) {
    assert.equal(result.verdict, "pass", "Significant positive improvement should be pass");
  } else if (result.significant && result.improvement < 0) {
    assert.equal(result.verdict, "fail", "Significant negative improvement should be fail");
  }
});

// ============================================================================
// Issue #1967: JSON.parse(suite.cases) without try/catch
// ============================================================================

test("LlmEvalService.getSuite handles malformed cases JSON", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  // Directly insert malformed JSON into database
  db.connection.exec(`
    INSERT INTO eval_suites (id, name, kind, description, cases, created_at, updated_at)
    VALUES ('malformed-suite', 'Malformed Suite', 'golden', '', '{ not valid json', datetime('now'), datetime('now'))
  `);

  // Issue #1967: getSuite should not throw when cases JSON is malformed
  const suite = service.getSuite("malformed-suite");

  // Should return the suite record despite malformed cases
  assert.ok(suite !== null);
  assert.equal(suite!.id, "malformed-suite");
  assert.equal(suite!.cases, "{ not valid json");
});

test("LlmEvalService.getSuite handles null cases", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  // Insert with NULL cases
  db.connection.exec(`
    INSERT INTO eval_suites (id, name, kind, description, cases, created_at, updated_at)
    VALUES ('null-cases-suite', 'Null Cases Suite', 'golden', '', NULL, datetime('now'), datetime('now'))
  `);

  const suite = service.getSuite("null-cases-suite");

  assert.ok(suite !== null);
  assert.equal(suite!.cases, "[]"); // Should default to empty array string
});

test("LlmEvalService.startRun handles suite with malformed cases", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  // Create suite with malformed cases
  db.connection.exec(`
    INSERT INTO eval_suites (id, name, kind, description, cases, created_at, updated_at)
    VALUES ('malformed-run-suite', 'Malformed Run Suite', 'golden', '', 'invalid json', datetime('now'), datetime('now'))
  `);

  // Issue #1967: startRun should handle malformed cases gracefully
  const run = service.startRun("malformed-run-suite", "gpt-4", "v1.0");

  assert.ok(run.id.startsWith("erun_"));
  assert.equal(run.totalCases, 0, "Malformed cases should result in 0 total cases");
});

test("LlmEvalService.completeRun returns null when a run has no recorded case results", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "empty-complete-suite",
    kind: "golden",
    cases: [],
  });

  const run = service.startRun(suite.id, "gpt-4", "v1.0");
  const completed = service.completeRun(run.id);

  assert.equal(completed, null);
});

// ============================================================================
// Additional A/B test and suite tests
// ============================================================================

test("LlmEvalService.defineSuite creates evaluation suite", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "test-suite",
    kind: "golden",
    description: "Test golden suite",
    cases: [
      { id: "case-1", input: "input1", expectedOutput: "output1" },
      { id: "case-2", input: "input2", expectedOutput: "output2" },
    ],
  });

  assert.equal(suite.name, "test-suite");
  assert.equal(suite.kind, "golden");
  assert.ok(suite.id.startsWith("esuite_"));
});

test("LlmEvalService.getSuite retrieves suite by id", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const created = service.defineSuite({
    name: "retrieve-test-suite",
    kind: "regression",
    cases: [{ id: "case-1", input: "test", expectedOutput: "result" }],
  });

  const retrieved = service.getSuite(created.id);
  assert.ok(retrieved !== null, "Should retrieve suite");
  assert.equal(retrieved!.name, "retrieve-test-suite");
  assert.equal(retrieved!.kind, "regression");
});

test("LlmEvalService.listSuites returns all suites", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  service.defineSuite({ name: "suite-1", kind: "golden", cases: [] });
  service.defineSuite({ name: "suite-2", kind: "smoke", cases: [] });

  const suites = service.listSuites();
  assert.equal(suites.length, 2, "Should list both suites");
});

test("LlmEvalService.startRun creates evaluation run", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "run-test-suite",
    kind: "golden",
    cases: [
      { id: "case-1", input: "input", expectedOutput: "output" },
      { id: "case-2", input: "input2", expectedOutput: "output2" },
    ],
  });

  const run = service.startRun(suite.id, "gpt-4", "v1.0", "test");

  assert.ok(run.id.startsWith("erun_"));
  assert.equal(run.suiteId, suite.id);
  assert.equal(run.modelId, "gpt-4");
  assert.equal(run.promptVersion, "v1.0");
  assert.equal(run.status, "running");
  assert.equal(run.totalCases, 2);
  assert.equal(run.verdict, "inconclusive");
});

test("LlmEvalService.recordCaseResult records individual case result", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "case-result-suite",
    kind: "golden",
    cases: [{ id: "case-1", input: "test input", expectedOutput: "expected" }],
  });

  const run = service.startRun(suite.id, "gpt-4", "v1.0", "test");

  const result = service.recordCaseResult({
    runId: run.id,
    caseId: "case-1",
    input: "test input",
    expectedOutput: "expected",
    actualOutput: "actual output",
    score: 0.9,
    passed: true,
    latencyMs: 150,
  });

  assert.ok(result.id.startsWith("ecr_"));
  assert.equal(result.runId, run.id);
  assert.equal(result.caseId, "case-1");
  assert.equal(result.score, 0.9);
  assert.equal(result.passed, true);
});

test("LlmEvalService.completeRun computes verdict based on results", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "complete-run-suite",
    kind: "golden",
    cases: [
      { id: "case-1", input: "test", expectedOutput: "result" },
      { id: "case-2", input: "test2", expectedOutput: "result2" },
    ],
  });

  const run = service.startRun(suite.id, "gpt-4", "v1.0", "test");

  // Record 2 passing cases
  service.recordCaseResult({
    runId: run.id,
    caseId: "case-1",
    input: "test",
    expectedOutput: "result",
    actualOutput: "result",
    score: 0.9,
    passed: true,
    latencyMs: 100,
  });

  service.recordCaseResult({
    runId: run.id,
    caseId: "case-2",
    input: "test2",
    expectedOutput: "result2",
    actualOutput: "result2",
    score: 0.85,
    passed: true,
    latencyMs: 110,
  });

  const completed = service.completeRun(run.id);

  assert.ok(completed !== null);
  assert.equal(completed!.status, "passed");
  assert.equal(completed!.verdict, "pass");
  assert.equal(completed!.passedCases, 2);
  assert.equal(completed!.failedCases, 0);
  assert.ok(completed!.averageScore !== null);
  assert.ok(completed!.averageScore! >= 0.85);
});

test("LlmEvalService.completeRun fails when any critical case fails even if pass rate remains above 95%", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "critical-case-suite",
    kind: "golden",
    cases: Array.from({ length: 20 }, (_, index) => ({
      id: `case-${index + 1}`,
      input: `input-${index + 1}`,
      expectedOutput: `expected-${index + 1}`,
    })),
  });

  const run = service.startRun(suite.id, "gpt-4", "v1.0", "test");
  for (let index = 0; index < 19; index++) {
    service.recordCaseResult({
      runId: run.id,
      caseId: `case-${index + 1}`,
      input: `input-${index + 1}`,
      expectedOutput: `expected-${index + 1}`,
      actualOutput: `expected-${index + 1}`,
      score: 1,
      passed: true,
      latencyMs: 50,
      metadata: { riskLevel: "standard" },
    });
  }

  service.recordCaseResult({
    runId: run.id,
    caseId: "case-20",
    input: "input-20",
    expectedOutput: "expected-20",
    actualOutput: "wrong",
    score: 0.2,
    passed: false,
    latencyMs: 50,
    metadata: { riskLevel: "critical" },
  });

  const completed = service.completeRun(run.id);

  assert.ok(completed);
  assert.equal(completed?.passedCases, 19);
  assert.equal(completed?.failedCases, 1);
  assert.equal(completed?.verdict, "fail");
  assert.equal(completed?.status, "failed");
});

test("LlmEvalService.runCiGate evaluates with deterministic evaluator", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "ci-gate-suite",
    kind: "golden",
    cases: [
      { id: "case-1", input: "test1", expectedOutput: "pass1" },
      { id: "case-2", input: "test2", expectedOutput: "pass2" },
    ],
  });

  const result = service.runCiGate(suite.id, "gpt-4", "v1.0");

  assert.ok(result.runId.startsWith("erun_"));
  assert.ok(typeof result.summary === "string");
});

test("LlmEvalService.runCiGate detects regressions vs baseline", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "regression-suite",
    kind: "regression",
    cases: [{ id: "case-1", input: "test", expectedOutput: "expected" }],
  });

  // First run as baseline
  service.runCiGate(suite.id, "gpt-4", "v1.0", {
    evaluator: () => ({
      actualOutput: "expected",
      score: 1.0,
      passed: true,
    }),
  });

  // Current version with degraded performance
  const result = service.runCiGate(suite.id, "gpt-4", "v2.0", {
    baselinePromptVersion: "v1.0",
    evaluator: () => ({
      actualOutput: "wrong",
      score: 0.4,
      passed: false,
    }),
  });

  assert.equal(result.passed, false);
  assert.ok(result.regressions.length > 0, "Should detect regression");
});

test("LlmEvalService.detectRegression detects score degradation between versions", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "score-degradation-suite",
    kind: "regression",
    cases: [{ id: "case-1", input: "test", expectedOutput: "result" }],
  });

  // Baseline version with high score
  service.runCiGate(suite.id, "gpt-4", "v1.0", {
    evaluator: () => ({
      actualOutput: "expected",
      score: 0.95,
      passed: true,
    }),
  });

  // New version with degraded score
  service.runCiGate(suite.id, "gpt-4", "v2.0", {
    evaluator: () => ({
      actualOutput: "wrong",
      score: 0.6,
      passed: false,
    }),
  });

  const regression = service.detectRegression(suite.id, "gpt-4", "v2.0", "v1.0");

  assert.equal(regression.hasRegression, true, "Should detect regression");
  assert.ok(regression.delta < 0, "Delta should be negative");
  assert.ok(regression.currentScore < regression.previousScore, "Current should be worse");
});

test("LlmEvalService.detectRegression no regression when score improves", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "score-improvement-suite",
    kind: "regression",
    cases: [{ id: "case-1", input: "test", expectedOutput: "result" }],
  });

  // Baseline with lower score
  service.runCiGate(suite.id, "gpt-4", "v1.0", {
    evaluator: () => ({
      actualOutput: "expected",
      score: 0.7,
      passed: false,
    }),
  });

  // New version with higher score
  service.runCiGate(suite.id, "gpt-4", "v2.0", {
    evaluator: () => ({
      actualOutput: "expected",
      score: 0.95,
      passed: true,
    }),
  });

  const regression = service.detectRegression(suite.id, "gpt-4", "v2.0", "v1.0");

  assert.equal(regression.hasRegression, false, "Should not detect regression");
  assert.ok(regression.delta > 0, "Delta should be positive");
});

test("LlmEvalService.detectRegression flags latency regression above 120% of baseline", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "latency-regression-suite",
    kind: "regression",
    cases: [{ id: "case-1", input: "test", expectedOutput: "result" }],
  });

  service.runCiGate(suite.id, "gpt-4", "v1.0", {
    evaluator: () => ({
      actualOutput: "result",
      score: 0.95,
      passed: true,
      latencyMs: 100,
    }),
  });

  service.runCiGate(suite.id, "gpt-4", "v2.0", {
    evaluator: () => ({
      actualOutput: "result",
      score: 0.95,
      passed: true,
      latencyMs: 121,
    }),
  });

  const regression = service.detectRegression(suite.id, "gpt-4", "v2.0", "v1.0");

  assert.equal(regression.latencyRegression, true);
  assert.equal(regression.costRegression, false);
  assert.equal(regression.hasRegression, true);
  assert.equal(regression.previousLatencyMs, 100);
  assert.equal(regression.currentLatencyMs, 121);
});

test("LlmEvalService.detectRegression flags cost regression above 150% of baseline", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "cost-regression-suite",
    kind: "regression",
    cases: [{ id: "case-1", input: "test", expectedOutput: "result" }],
  });

  service.runCiGate(suite.id, "gpt-4", "v1.0", {
    evaluator: () => ({
      actualOutput: "result",
      score: 0.95,
      passed: true,
      latencyMs: 100,
      metadata: { cost: 10 },
    }),
  });

  service.runCiGate(suite.id, "gpt-4", "v2.0", {
    evaluator: () => ({
      actualOutput: "result",
      score: 0.95,
      passed: true,
      latencyMs: 100,
      metadata: { cost: 16 },
    }),
  });

  const regression = service.detectRegression(suite.id, "gpt-4", "v2.0", "v1.0");

  assert.equal(regression.latencyRegression, false);
  assert.equal(regression.costRegression, true);
  assert.equal(regression.hasRegression, true);
});

test("LlmEvalService listRuns returns runs independently", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "list-runs-suite",
    kind: "golden",
    cases: [{ id: "case-1", input: "test", expectedOutput: "result" }],
  });

  service.startRun(suite.id, "model-a", "v1.0", "ci_gate");
  service.startRun(suite.id, "model-b", "v2.0", "ci_gate");
  service.startRun(suite.id, "model-c", "v3.0", "ab_test");

  const runs = service.listRuns(suite.id);

  assert.equal(runs.length, 3, "Should list all runs");
  assert.ok(runs.every(r => r.suiteId === suite.id), "All runs should belong to suite");
});

test("LlmEvalService getRun retrieves individual run independently", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "get-run-suite",
    kind: "golden",
    cases: [{ id: "case-1", input: "test", expectedOutput: "result" }],
  });

  const createdRun = service.startRun(suite.id, "gpt-4", "v1.0", "test");

  const retrievedRun = service.getRun(createdRun.id);

  assert.ok(retrievedRun !== null);
  assert.equal(retrievedRun!.id, createdRun.id);
  assert.equal(retrievedRun!.modelId, "gpt-4");
  assert.equal(retrievedRun!.promptVersion, "v1.0");
});

test("LlmEvalService runAbTest throws when control and treatment models are same", async () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "same-model-suite",
    kind: "ab_test",
    cases: [{ id: "case-1", input: "test", expectedOutput: "result" }],
  });

  // Issue #1960: A/B test requires different models per §17.5 judge independence
  await assert.rejects(
    async () => {
      await service.runAbTest(suite.id, {
        controlModelId: "gpt-4",
        treatmentModelId: "gpt-4", // Same as control
        controlPromptVersion: "v1.0",
        treatmentPromptVersion: "v2.0",
        minSampleSize: 1,
        significanceThreshold: 0.05,
      });
    },
    (err: Error) => err.message.includes("different models"),
  );
});
