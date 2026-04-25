import assert from "node:assert/strict";
import test from "node:test";

import { LlmEvalService, type EvalSuiteKind, type QualityVerdict, type EvalCaseDefinition } from "../../../../src/platform/prompt-engine/eval/llm-eval-service.js";

// ── Mock Database ─────────────────────────────────────────────────────────────

function createMockDb() {
  const tables: {
    eval_suites: Record<string, unknown>[];
    eval_runs: Record<string, unknown>[];
    eval_case_results: Record<string, unknown>[];
  } = {
    eval_suites: [],
    eval_runs: [],
    eval_case_results: [],
  };

  return {
    connection: {
      prepare: (sql: string) => {
        const isSuiteQuery = sql.includes("eval_suites");
        const isRunQuery = sql.includes("eval_runs");
        return {
          run(...args: unknown[]) {
            if (sql.includes("INSERT INTO eval_suites")) {
              const [id, name, kind, description, cases, createdAt, updatedAt] = args as [string, string, EvalSuiteKind, string, string, string, string];
              tables.eval_suites.push({ id, name, kind, description, cases, created_at: createdAt, updated_at: updatedAt });
            } else if (sql.includes("INSERT INTO eval_runs")) {
              const [id, suiteId, modelId, promptVersion, status, totalCases, passedCases, failedCases, averageScore, verdict, startedAt, completedAt, triggeredBy, metadata] = args as [string, string, string, string, string, number, number, number, number | null, string, string, string | null, string, string | null];
              tables.eval_runs.push({ id, suite_id: suiteId, model_id: modelId, prompt_version: promptVersion, status, total_cases: totalCases, passed_cases: passedCases, failed_cases: failedCases, average_score: averageScore, verdict, started_at: startedAt, completed_at: completedAt, triggered_by: triggeredBy, metadata });
            } else if (sql.includes("INSERT INTO eval_case_results")) {
              const [id, runId, caseId, input, expectedOutput, actualOutput, score, passed, latencyMs, metadata] = args as [string, string, string, string, string, string, number, number, number, string | null];
              tables.eval_case_results.push({ id, run_id: runId, case_id: caseId, input, expected_output: expectedOutput, actual_output: actualOutput, score, passed: Boolean(passed), latency_ms: latencyMs, metadata });
            }
          },
          get(...params: unknown[]) {
            // params[0] is the bind parameter (e.g., suiteId or runId)
            const id = params[0] as string;
            if (isSuiteQuery) {
              return tables.eval_suites.find(r => r.id === id);
            }
            if (isRunQuery) {
              return tables.eval_runs.find(r => r.id === id);
            }
            return undefined;
          },
          all(...params: unknown[]) {
            if (sql.includes("WHERE suite_id = ?")) {
              const suiteId = params[0] as string;
              return tables.eval_case_results.filter(r => r.run_id === suiteId);
            }
            if (sql.includes("eval_case_results")) return tables.eval_case_results.filter(r => r.run_id === params[0]);
            if (isRunQuery) {
              if (params.length > 0 && typeof params[0] === "string") return tables.eval_runs.filter(r => r.suite_id === params[0]);
              return tables.eval_runs.slice(0, params[0] as number ?? 50);
            }
            if (isSuiteQuery) return tables.eval_suites;
            return [];
          },
        };
      },
    },
  };
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

test("LlmEvalService.defineSuite creates a suite record", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const suite = service.defineSuite({
    name: "Test Suite",
    kind: "golden",
    description: "A test suite",
    cases: [
      { id: "case_1", input: "hello", expectedOutput: "world" },
      { id: "case_2", input: "foo", expectedOutput: "bar" },
    ],
  });

  assert.equal(suite.name, "Test Suite");
  assert.equal(suite.kind, "golden");
  assert.equal(suite.description, "A test suite");
  assert.ok(suite.id.startsWith("esuite_"));
  assert.ok(suite.cases.includes("case_1"));
});

test("LlmEvalService.defineSuite applies defaults", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const suite = service.defineSuite({
    name: "Minimal Suite",
    kind: "regression",
    cases: [{ id: "c1", input: "a", expectedOutput: "b" }],
  });

  assert.equal(suite.description, "");
  assert.ok(suite.createdAt.length > 0);
  assert.ok(suite.updatedAt.length > 0);
});

test("LlmEvalService.getSuite returns suite by ID", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const created = service.defineSuite({
    name: "Get Test",
    kind: "smoke",
    cases: [{ id: "c1", input: "x", expectedOutput: "y" }],
  });

  const found = service.getSuite(created.id);
  assert.ok(found !== null);
  assert.equal(found?.name, "Get Test");
});

test("LlmEvalService.getSuite returns null for unknown ID", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const result = service.getSuite("unknown_id");
  assert.equal(result, null);
});

test("LlmEvalService.listSuites returns all suites", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  service.defineSuite({ name: "Suite A", kind: "golden", cases: [] });
  service.defineSuite({ name: "Suite B", kind: "regression", cases: [] });

  const suites = service.listSuites();
  assert.equal(suites.length, 2);
  assert.ok(suites.some(s => s.name === "Suite A"));
  assert.ok(suites.some(s => s.name === "Suite B"));
});

test("LlmEvalService.startRun creates a new run record", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const suite = service.defineSuite({
    name: "Run Test",
    kind: "golden",
    cases: [
      { id: "case_1", input: "hello", expectedOutput: "world" },
      { id: "case_2", input: "foo", expectedOutput: "bar" },
    ],
  });

  const run = service.startRun(suite.id, "model_v1", "v1.0.0", "ci");

  assert.ok(run.id.startsWith("erun_"));
  assert.equal(run.suiteId, suite.id);
  assert.equal(run.modelId, "model_v1");
  assert.equal(run.promptVersion, "v1.0.0");
  assert.equal(run.status, "running");
  assert.equal(run.totalCases, 2);
  assert.equal(run.passedCases, 0);
  assert.equal(run.verdict, "inconclusive");
});

test("LlmEvalService.startRun defaults promptVersion to default", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const suite = service.defineSuite({
    name: "Default Version",
    kind: "golden",
    cases: [{ id: "c1", input: "a", expectedOutput: "b" }],
  });

  const run = service.startRun(suite.id, "model_x");

  assert.equal(run.promptVersion, "default");
});

test("LlmEvalService.recordCaseResult stores case result", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const suite = service.defineSuite({
    name: "Result Test",
    kind: "golden",
    cases: [{ id: "c1", input: "hello", expectedOutput: "world" }],
  });
  const run = service.startRun(suite.id, "model_v1");

  const result = service.recordCaseResult({
    runId: run.id,
    caseId: "c1",
    input: "hello",
    expectedOutput: "world",
    actualOutput: "world",
    score: 1.0,
    passed: true,
    latencyMs: 50,
  });

  assert.ok(result.id.startsWith("ecr_"));
  assert.equal(result.runId, run.id);
  assert.equal(result.caseId, "c1");
  assert.equal(result.passed, true);
});

test("LlmEvalService.recordCaseResult serializes metadata", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const suite = service.defineSuite({
    name: "Metadata Test",
    kind: "golden",
    cases: [{ id: "c1", input: "a", expectedOutput: "b" }],
  });
  const run = service.startRun(suite.id, "model_v1");

  const result = service.recordCaseResult({
    runId: run.id,
    caseId: "c1",
    input: "a",
    expectedOutput: "b",
    actualOutput: "b",
    score: 1,
    passed: true,
    latencyMs: 30,
    metadata: { key: "value", count: 42 },
  });

  assert.equal(result.metadata, '{"key":"value","count":42}');
});

test("LlmEvalService.completeRun computes verdict pass when all pass", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const suite = service.defineSuite({
    name: "Complete Pass",
    kind: "golden",
    cases: [
      { id: "c1", input: "a", expectedOutput: "b" },
      { id: "c2", input: "c", expectedOutput: "d" },
    ],
  });
  const run = service.startRun(suite.id, "model_v1");

  service.recordCaseResult({ runId: run.id, caseId: "c1", input: "a", expectedOutput: "b", actualOutput: "b", score: 1, passed: true, latencyMs: 40 });
  service.recordCaseResult({ runId: run.id, caseId: "c2", input: "c", expectedOutput: "d", actualOutput: "d", score: 1, passed: true, latencyMs: 45 });

  const completed = service.completeRun(run.id);

  assert.ok(completed !== null);
  assert.equal(completed.status, "passed");
  assert.equal(completed.passedCases, 2);
  assert.equal(completed.failedCases, 0);
  assert.equal(completed.verdict, "pass");
  assert.ok(completed.completedAt !== null);
});

test("LlmEvalService.completeRun computes verdict fail when too many fail", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const suite = service.defineSuite({
    name: "Complete Fail",
    kind: "golden",
    cases: [
      { id: "c1", input: "a", expectedOutput: "b" },
      { id: "c2", input: "c", expectedOutput: "d" },
      { id: "c3", input: "e", expectedOutput: "f" },
    ],
  });
  const run = service.startRun(suite.id, "model_v1");

  service.recordCaseResult({ runId: run.id, caseId: "c1", input: "a", expectedOutput: "b", actualOutput: "wrong", score: 0, passed: false, latencyMs: 40 });
  service.recordCaseResult({ runId: run.id, caseId: "c2", input: "c", expectedOutput: "d", actualOutput: "wrong", score: 0, passed: false, latencyMs: 45 });
  service.recordCaseResult({ runId: run.id, caseId: "c3", input: "e", expectedOutput: "f", actualOutput: "wrong", score: 0, passed: false, latencyMs: 42 });

  const completed = service.completeRun(run.id);

  assert.ok(completed !== null);
  assert.equal(completed.status, "failed");
  assert.equal(completed.verdict, "fail");
});

test("LlmEvalService.completeRun computes verdict degraded when pass rate >= 80%", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const suite = service.defineSuite({
    name: "Degraded Test",
    kind: "golden",
    cases: [
      { id: "c1", input: "a", expectedOutput: "b" },
      { id: "c2", input: "c", expectedOutput: "d" },
      { id: "c3", input: "e", expectedOutput: "f" },
      { id: "c4", input: "g", expectedOutput: "h" },
      { id: "c5", input: "i", expectedOutput: "j" },
    ],
  });
  const run = service.startRun(suite.id, "model_v1");

  // 4 pass, 1 fail = 80% pass rate
  service.recordCaseResult({ runId: run.id, caseId: "c1", input: "a", expectedOutput: "b", actualOutput: "b", score: 1, passed: true, latencyMs: 40 });
  service.recordCaseResult({ runId: run.id, caseId: "c2", input: "c", expectedOutput: "d", actualOutput: "d", score: 1, passed: true, latencyMs: 45 });
  service.recordCaseResult({ runId: run.id, caseId: "c3", input: "e", expectedOutput: "f", actualOutput: "wrong", score: 0, passed: false, latencyMs: 42 });
  service.recordCaseResult({ runId: run.id, caseId: "c4", input: "g", expectedOutput: "h", actualOutput: "h", score: 1, passed: true, latencyMs: 40 });
  service.recordCaseResult({ runId: run.id, caseId: "c5", input: "i", expectedOutput: "j", actualOutput: "j", score: 1, passed: true, latencyMs: 45 });

  const completed = service.completeRun(run.id);

  assert.ok(completed !== null);
  assert.equal(completed.status, "degraded");
  assert.equal(completed.verdict, "degraded");
});

test("LlmEvalService.completeRun returns null for empty results", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const suite = service.defineSuite({
    name: "Empty Run",
    kind: "golden",
    cases: [],
  });
  const run = service.startRun(suite.id, "model_v1");

  const result = service.completeRun(run.id);
  assert.equal(result, null);
});

test("LlmEvalService.getRun returns run by ID", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const suite = service.defineSuite({
    name: "Get Run Test",
    kind: "golden",
    cases: [{ id: "c1", input: "a", expectedOutput: "b" }],
  });
  const created = service.startRun(suite.id, "model_v1");

  const found = service.getRun(created.id);
  assert.ok(found !== null);
  assert.equal(found?.id, created.id);
});

test("LlmEvalService.listRuns returns runs optionally filtered by suite", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const suite1 = service.defineSuite({ name: "Suite 1", kind: "golden", cases: [] });
  const suite2 = service.defineSuite({ name: "Suite 2", kind: "regression", cases: [] });

  service.startRun(suite1.id, "model_a");
  service.startRun(suite1.id, "model_b");
  service.startRun(suite2.id, "model_a");

  const allRuns = service.listRuns();
  assert.ok(allRuns.length >= 3);

  const suite1Runs = service.listRuns(suite1.id);
  assert.ok(suite1Runs.every(r => r.suiteId === suite1.id));
});

test("LlmEvalService.runAbTest compares control vs treatment", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const suite = service.defineSuite({
    name: "A/B Suite",
    kind: "ab_test",
    cases: [
      { id: "c1", input: "a", expectedOutput: "b" },
      { id: "c2", input: "c", expectedOutput: "d" },
    ],
  });

  const result = service.runAbTest(suite.id, {
    controlModelId: "model_ctrl",
    treatmentModelId: "model_treat",
    controlPromptVersion: "v1",
    treatmentPromptVersion: "v2",
    minSampleSize: 2,
    significanceThreshold: 0.05,
  });

  assert.equal(result.controlRunId.length > 0, true);
  assert.equal(result.treatmentRunId.length > 0, true);
  assert.equal(result.controlAvgScore, 0.85);
  assert.equal(result.treatmentAvgScore, 0.90);
  assert.ok(result.improvement > 0);
});

test("LlmEvalService.runCiGate evaluates and returns gate result", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const suite = service.defineSuite({
    name: "CI Gate Suite",
    kind: "golden",
    cases: [
      { id: "c1", input: "hello", expectedOutput: "world" },
      { id: "c2", input: "foo", expectedOutput: "bar" },
    ],
  });

  const result = service.runCiGate(suite.id, "model_v1", "v2.0.0");

  assert.equal(result.passed, true);
  assert.equal(result.runId.length > 0, true);
  assert.ok(result.summary.includes("2/2 cases passed"));
});

test("LlmEvalService.runCiGate reports regressions", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const suite = service.defineSuite({
    name: "Regress Suite",
    kind: "golden",
    cases: [
      { id: "c1", input: "", expectedOutput: "" }, // empty expected output causes fail
      { id: "c2", input: "foo", expectedOutput: "bar" },
    ],
  });

  const result = service.runCiGate(suite.id, "model_v1", "v2.0.0");

  assert.equal(result.passed, false);
  assert.ok(result.regressions.length > 0);
  assert.ok(result.summary.includes("regression"));
});

test("LlmEvalService.runCiGate accepts custom evaluator", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const suite = service.defineSuite({
    name: "Custom Eval Suite",
    kind: "golden",
    cases: [{ id: "c1", input: "a", expectedOutput: "b" }],
  });

  const result = service.runCiGate(suite.id, "model_v1", "v1.0.0", {
    evaluator: () => ({ actualOutput: "b", score: 1, passed: true, latencyMs: 10 }),
  });

  assert.equal(result.passed, true);
  assert.equal(result.verdict, "pass");
});

test("LlmEvalService.runCiGate respects passingVerdicts option", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const suite = service.defineSuite({
    name: "Verdict Suite",
    kind: "golden",
    cases: [
      { id: "c1", input: "a", expectedOutput: "b" },
      { id: "c2", input: "c", expectedOutput: "d" },
      { id: "c3", input: "e", expectedOutput: "f" },
    ],
  });

  // 2/3 pass = degraded verdict
  const result = service.runCiGate(suite.id, "model_v1", "v1.0.0", {
    passingVerdicts: ["pass"],
  });

  assert.equal(result.passed, false);
  assert.equal(result.verdict, "degraded");
});

test("LlmEvalService.detectRegression detects score drop", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const suite = service.defineSuite({
    name: "Regression Suite",
    kind: "regression",
    cases: [
      { id: "c1", input: "a", expectedOutput: "b" },
      { id: "c2", input: "c", expectedOutput: "d" },
    ],
  });

  // Record a previous run with high score
  const prevRun = service.startRun(suite.id, "model_x", "v1.0.0", "ci");
  service.recordCaseResult({ runId: prevRun.id, caseId: "c1", input: "a", expectedOutput: "b", actualOutput: "b", score: 0.95, passed: true, latencyMs: 40 });
  service.recordCaseResult({ runId: prevRun.id, caseId: "c2", input: "c", expectedOutput: "d", actualOutput: "d", score: 0.90, passed: true, latencyMs: 45 });
  service.completeRun(prevRun.id);

  // Record a current run with lower score
  const currRun = service.startRun(suite.id, "model_x", "v2.0.0", "ci");
  service.recordCaseResult({ runId: currRun.id, caseId: "c1", input: "a", expectedOutput: "b", actualOutput: "wrong", score: 0.4, passed: false, latencyMs: 40 });
  service.recordCaseResult({ runId: currRun.id, caseId: "c2", input: "c", expectedOutput: "d", actualOutput: "d", score: 0.90, passed: true, latencyMs: 45 });
  service.completeRun(currRun.id);

  const result = service.detectRegression(suite.id, "model_x", "v2.0.0", "v1.0.0");

  assert.equal(result.hasRegression, true);
  assert.ok(result.currentScore < result.previousScore);
  assert.ok(result.delta < -0.05);
  assert.ok(result.regressedCases.length > 0);
});

test("LlmEvalService.detectRegression no regression when score improves", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const suite = service.defineSuite({
    name: "Improve Suite",
    kind: "regression",
    cases: [{ id: "c1", input: "a", expectedOutput: "b" }],
  });

  // Previous version
  const prevRun = service.startRun(suite.id, "model_y", "v1.0.0", "ci");
  service.recordCaseResult({ runId: prevRun.id, caseId: "c1", input: "a", expectedOutput: "b", actualOutput: "b", score: 0.80, passed: true, latencyMs: 50 });
  service.completeRun(prevRun.id);

  // Current version with better score
  const currRun = service.startRun(suite.id, "model_y", "v2.0.0", "ci");
  service.recordCaseResult({ runId: currRun.id, caseId: "c1", input: "a", expectedOutput: "b", actualOutput: "b", score: 0.95, passed: true, latencyMs: 50 });
  service.completeRun(currRun.id);

  const result = service.detectRegression(suite.id, "model_y", "v2.0.0", "v1.0.0");

  assert.equal(result.hasRegression, false);
  assert.ok(result.delta > 0);
});

test("LlmEvalService.detectRegression returns zero scores when no runs exist", () => {
  const db = createMockDb();
  const service = new LlmEvalService(db as never);

  const suite = service.defineSuite({
    name: "No Runs Suite",
    kind: "golden",
    cases: [],
  });

  const result = service.detectRegression(suite.id, "model_z", "v2.0.0", "v1.0.0");

  assert.equal(result.hasRegression, false);
  assert.equal(result.currentScore, 0);
  assert.equal(result.previousScore, 0);
});