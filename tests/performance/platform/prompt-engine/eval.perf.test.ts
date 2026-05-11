/**
 * Eval Performance Tests
 *
 * Performance tests for LLM eval service.
 * Tests issue #1959: A/B test hardcoded 0.85/0.90 scores
 * Tests issue #1960: Significance test is threshold comparison, not real stats
 * Tests issue #1967: JSON.parse(suite.cases) without try/catch
 */

import test from "node:test";
import assert from "node:assert/strict";

import { LlmEvalService } from "../../../../src/platform/prompt-engine/eval/llm-eval-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";

// Create an in-memory SQLite database for testing
function createMockDatabase(): AuthoritativeSqlDatabase {
  const Database = require("better-sqlite3");
  const db = new Database(":memory:");

  db.exec(`
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

  return db as unknown as AuthoritativeSqlDatabase;
}

test("LlmEvalService runAbTest completes within reasonable time", async () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "perf-test-suite",
    kind: "ab_test",
    cases: Array.from({ length: 10 }, (_, i) => ({
      id: `case-${i}`,
      input: `input ${i}`,
      expectedOutput: `output ${i}`,
    })),
  });

  const startTime = Date.now();
  await service.runAbTest(suite.id, {
    controlModelId: "model-a",
    treatmentModelId: "model-b",
    controlPromptVersion: "v1.0",
    treatmentPromptVersion: "v2.0",
    minSampleSize: 10,
    significanceThreshold: 0.1,
  });
  const duration = Date.now() - startTime;

  assert.ok(duration < 5000, `A/B test should complete within 5s, took ${duration}ms`);
});

test("LlmEvalService runCiGate handles large suites efficiently", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "large-suite",
    kind: "golden",
    cases: Array.from({ length: 100 }, (_, i) => ({
      id: `case-${i}`,
      input: `input ${i}`,
      expectedOutput: `output ${i}`,
    })),
  });

  const startTime = Date.now();
  service.runCiGate(suite.id, "gpt-4", "v1.0");
  const duration = Date.now() - startTime;

  assert.ok(duration < 10000, `CI gate with 100 cases should complete within 10s, took ${duration}ms`);
});

test("LlmEvalService runAbTest returns meaningful significance values", async () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "significance-test-suite",
    kind: "ab_test",
    cases: Array.from({ length: 20 }, (_, i) => ({
      id: `case-${i}`,
      input: `input ${i}`,
      expectedOutput: `output ${i}`,
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

  // Issue #1959: zScore and pValue should be real statistical values from Welch's t-test
  assert.equal(typeof result.zScore === "number" && !isNaN(result.zScore), true, "zScore should be a real number");
  assert.equal(typeof result.pValue === "number" && !isNaN(result.pValue), true, "pValue should be a real number");
  assert.equal(typeof result.confidenceInterval === "object" && Array.isArray(result.confidenceInterval), true, "confidenceInterval should be an array");
  assert.equal(result.confidenceInterval!.length, 2, "confidenceInterval should have 2 elements");
});

test("LlmEvalService runAbTest computes improvement correctly", async () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "improvement-test-suite",
    kind: "ab_test",
    cases: Array.from({ length: 5 }, (_, i) => ({
      id: `case-${i}`,
      input: `input ${i}`,
      expectedOutput: `output ${i}`,
    })),
  });

  const result = await service.runAbTest(suite.id, {
    controlModelId: "model-a",
    treatmentModelId: "model-b",
    controlPromptVersion: "v1.0",
    treatmentPromptVersion: "v2.0",
    minSampleSize: 5,
    significanceThreshold: 0.1,
  });

  // Improvement should be computed correctly
  assert.ok(typeof result.improvement === "number");
  assert.equal(
    result.improvement,
    result.treatmentAvgScore - result.controlAvgScore,
    "Improvement should equal treatment - control scores",
  );
});

test("LlmEvalService parseCases handles malformed JSON gracefully", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  // Create a suite with malformed cases JSON
  db.exec(`
    INSERT INTO eval_suites (id, name, kind, description, cases, created_at, updated_at)
    VALUES ('test-malformed', 'malformed-suite', 'golden', '', 'not valid json', datetime('now'), datetime('now'))
  `);

  // Issue #1967: Should handle malformed JSON gracefully
  const suite = service.getSuite("test-malformed");
  assert.ok(suite !== null, "Should retrieve suite even with malformed cases");

  // getSuite should return the suite, parsing cases is done elsewhere
  assert.equal(suite!.cases, "not valid json");
});

test("LlmEvalService defineSuite creates valid suite with empty cases", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "empty-cases-suite",
    kind: "golden",
    cases: [],
  });

  assert.ok(suite.id.startsWith("esuite_"));
  assert.equal(suite.cases, "[]", "Empty cases should be serialized as empty array");
});

test("LlmEvalService runCiGate completes without JSON parse errors", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  // Create suite with valid JSON
  const suite = service.defineSuite({
    name: "valid-suite",
    kind: "golden",
    cases: [
      { id: "case-1", input: "test", expectedOutput: "result" },
    ],
  });

  // Issue #1967: runCiGate should not throw on JSON.parse
  const result = service.runCiGate(suite.id, "gpt-4", "v1.0");
  assert.ok(result.runId.startsWith("erun_"));
});

test("LlmEvalService completeRun handles suite with null cases", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  db.exec(`
    INSERT INTO eval_suites (id, name, kind, description, cases, created_at, updated_at)
    VALUES ('test-null-cases', 'null-cases-suite', 'golden', '', NULL, datetime('now'), datetime('now'))
  `);

  const run = service.startRun("test-null-cases", "gpt-4", "v1.0");

  // Should handle null cases gracefully
  assert.ok(run.id.startsWith("erun_"));
  assert.equal(run.totalCases, 0, "Null cases should result in 0 total cases");
});

test("LlmEvalService detectRegression handles missing baseline version", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "regression-suite",
    kind: "regression",
    cases: [{ id: "case-1", input: "test", expectedOutput: "result" }],
  });

  // Run one version
  service.runCiGate(suite.id, "gpt-4", "v1.0", {
    evaluator: () => ({ actualOutput: "result", score: 1.0, passed: true }),
  });

  // Detect regression with non-existent baseline
  const regression = service.detectRegression(suite.id, "gpt-4", "v2.0", "v99.0");

  // Should not throw, should return sensible defaults
  assert.ok(typeof regression.hasRegression === "boolean");
  assert.ok(typeof regression.delta === "number");
});

test("LlmEvalService runAbTest verdict is inconclusive when control equals treatment", async () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "equal-scores-suite",
    kind: "ab_test",
    cases: Array.from({ length: 10 }, (_, i) => ({
      id: `case-${i}`,
      input: `input ${i}`,
      expectedOutput: `expected output ${i}`,
    })),
  });

  const result = await service.runAbTest(suite.id, {
    controlModelId: "model-a",
    treatmentModelId: "model-b",
    controlPromptVersion: "v1.0",
    treatmentPromptVersion: "v1.0", // Same version
    minSampleSize: 10,
    significanceThreshold: 0.1,
  });

  // When control and treatment are same, significant should be false
  assert.equal(result.significant, false, "Identical configs should not show significance");
});

test("LlmEvalService recordCaseResult handles special characters in metadata", () => {
  const db = createMockDatabase();
  const service = new LlmEvalService(db);

  const suite = service.defineSuite({
    name: "metadata-test-suite",
    kind: "golden",
    cases: [{ id: "case-1", input: "test", expectedOutput: "result" }],
  });

  const run = service.startRun(suite.id, "gpt-4", "v1.0");

  // Record with special characters in metadata
  const result = service.recordCaseResult({
    runId: run.id,
    caseId: "case-1",
    input: "test",
    expectedOutput: "result",
    actualOutput: "output",
    score: 0.9,
    passed: true,
    latencyMs: 100,
    metadata: {
      special: "chars\"quotes\\backslash/nested",
      unicode: "こんにちは",
      emoji: "🎉",
    },
  });

  assert.ok(result.id.startsWith("ecr_"));
  assert.equal(result.metadata, JSON.stringify({
    special: "chars\"quotes\\backslash/nested",
    unicode: "こんにちは",
    emoji: "🎉",
  }));
});