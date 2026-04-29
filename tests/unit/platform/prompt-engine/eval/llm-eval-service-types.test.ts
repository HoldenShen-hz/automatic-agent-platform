import assert from "node:assert/strict";
import test from "node:test";

import type {
  EvalStatus,
  EvalSuiteKind,
  QualityVerdict,
  EvalStructuredOutput,
  EvalSuiteRecord,
  EvalRunRecord,
  EvalCaseDefinition,
  EvalCaseResult,
  AbTestConfig,
  AbTestResult,
  CiGateResult,
  EvalCaseEvaluation,
  EvalCaseEvaluatorInput,
} from "../../../../../src/platform/prompt-engine/eval/llm-eval-service.js";

test("EvalStatus accepts all valid values", () => {
  const statuses: EvalStatus[] = ["pending", "running", "passed", "failed", "degraded"];
  assert.equal(statuses.length, 5);
});

test("EvalSuiteKind accepts all valid values", () => {
  const kinds: EvalSuiteKind[] = ["golden", "regression", "ab_test", "smoke"];
  assert.equal(kinds.length, 4);
});

test("QualityVerdict accepts all valid values", () => {
  const verdicts: QualityVerdict[] = ["pass", "fail", "degraded", "inconclusive"];
  assert.equal(verdicts.length, 4);
});

test("EvalStructuredOutput accepts string", () => {
  const output: EvalStructuredOutput = "hello";
  assert.equal(output, "hello");
});

test("EvalStructuredOutput accepts number", () => {
  const output: EvalStructuredOutput = 42.5;
  assert.equal(output, 42.5);
});

test("EvalStructuredOutput accepts boolean", () => {
  const output: EvalStructuredOutput = true;
  assert.equal(output, true);
});

test("EvalStructuredOutput accepts null", () => {
  const output: EvalStructuredOutput = null;
  assert.equal(output, null);
});

test("EvalStructuredOutput accepts Record", () => {
  const output: EvalStructuredOutput = { key: "value", num: 123 };
  assert.deepEqual(output, { key: "value", num: 123 });
});

test("EvalStructuredOutput accepts Array", () => {
  const output: EvalStructuredOutput = ["a", "b", 3];
  assert.deepEqual(output, ["a", "b", 3]);
});

test("EvalSuiteRecord structure is correct", () => {
  const record: EvalSuiteRecord = {
    id: "suite_123",
    name: "Golden Test Suite",
    kind: "golden",
    description: "Golden tests for core functionality",
    cases: '[{"id":"case_1","input":"hello","expectedOutput":"world"}]',
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.id, "suite_123");
  assert.equal(record.name, "Golden Test Suite");
  assert.equal(record.kind, "golden");
});

test("EvalSuiteRecord allows minimal definition", () => {
  const record: EvalSuiteRecord = {
    id: "suite_minimal",
    name: "Minimal Suite",
    kind: "smoke",
    description: "",
    cases: "[]",
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.id, "suite_minimal");
  assert.equal(record.description, "");
});

test("EvalRunRecord structure is correct", () => {
  const record: EvalRunRecord = {
    id: "run_123",
    suiteId: "suite_456",
    modelId: "claude-3-5-sonnet",
    promptVersion: "v1.0.0",
    status: "passed",
    totalCases: 10,
    passedCases: 9,
    failedCases: 1,
    averageScore: 0.9,
    verdict: "pass",
    startedAt: "2026-04-14T00:00:00.000Z",
    completedAt: "2026-04-14T00:05:00.000Z",
    triggeredBy: "ci",
    metadata: '{"branch":"main"}',
  };
  assert.equal(record.status, "passed");
  assert.equal(record.averageScore, 0.9);
  assert.equal(record.verdict, "pass");
});

test("EvalRunRecord allows null averageScore and completedAt", () => {
  const record: EvalRunRecord = {
    id: "run_pending",
    suiteId: "suite_456",
    modelId: "claude-3-5-sonnet",
    promptVersion: "v1.0.0",
    status: "running",
    totalCases: 10,
    passedCases: 0,
    failedCases: 0,
    averageScore: null,
    verdict: "inconclusive",
    startedAt: "2026-04-14T00:00:00.000Z",
    completedAt: null,
    triggeredBy: "manual",
    metadata: null,
  };
  assert.equal(record.averageScore, null);
  assert.equal(record.completedAt, null);
  assert.equal(record.metadata, null);
});

test("EvalCaseDefinition structure is correct", () => {
  const def: EvalCaseDefinition = {
    id: "case_123",
    input: "What is 2+2?",
    expectedOutput: "4",
    tags: ["math", "basic"],
  };
  assert.equal(def.input, "What is 2+2?");
  assert.equal(def.expectedOutput, "4");
  assert.deepEqual(def.tags, ["math", "basic"]);
});

test("EvalCaseDefinition allows optional tags", () => {
  const def: EvalCaseDefinition = {
    id: "case_456",
    input: "Hello",
    expectedOutput: "Hello",
  };
  assert.equal(def.tags, undefined);
});

test("EvalCaseResult structure is correct", () => {
  const result: EvalCaseResult = {
    id: "result_123",
    runId: "run_456",
    caseId: "case_789",
    input: "What is 2+2?",
    expectedOutput: "4",
    actualOutput: "4",
    score: 1.0,
    passed: true,
    latencyMs: 150,
    metadata: '{"model":"claude-3-5-sonnet"}',
  };
  assert.equal(result.passed, true);
  assert.equal(result.score, 1.0);
});

test("EvalCaseResult allows null metadata", () => {
  const result: EvalCaseResult = {
    id: "result_minimal",
    runId: "run_456",
    caseId: "case_789",
    input: "input",
    expectedOutput: "expected",
    actualOutput: "actual",
    score: 0.5,
    passed: false,
    latencyMs: 100,
    metadata: null,
  };
  assert.equal(result.metadata, null);
});

test("AbTestConfig structure is correct", () => {
  const config: AbTestConfig = {
    controlModelId: "claude-3-5-sonnet",
    treatmentModelId: "claude-4-sonnet",
    controlPromptVersion: "v1.0.0",
    treatmentPromptVersion: "v1.1.0",
    minSampleSize: 100,
    significanceThreshold: 0.05,
  };
  assert.equal(config.controlModelId, "claude-3-5-sonnet");
  assert.equal(config.significanceThreshold, 0.05);
});

test("AbTestResult structure is correct", () => {
  const result: AbTestResult = {
    controlRunId: "run_ctrl",
    treatmentRunId: "run_treat",
    controlAvgScore: 0.85,
    treatmentAvgScore: 0.87,
    improvement: 0.02,
    significant: true,
    verdict: "pass",
    zScore: 1.96,
    pValue: 0.05,
  };
  assert.equal(result.improvement, 0.02);
  assert.equal(result.significant, true);
});

test("CiGateResult structure is correct", () => {
  const result: CiGateResult = {
    passed: true,
    runId: "run_123",
    verdict: "pass",
    regressions: [],
    improvements: ["response_latency_p50_ms decreased by 15%"],
    summary: "All checks passed",
  };
  assert.equal(result.passed, true);
  assert.equal(result.improvements.length, 1);
});

test("CiGateResult allows regressions", () => {
  const result: CiGateResult = {
    passed: false,
    runId: "run_456",
    verdict: "degraded",
    regressions: ["accuracy decreased by 5%"],
    improvements: [],
    summary: "Regression detected",
  };
  assert.equal(result.passed, false);
  assert.equal(result.regressions.length, 1);
});

test("EvalCaseEvaluation structure is correct", () => {
  const evaluation: EvalCaseEvaluation = {
    actualOutput: "Hello, world!",
    score: 1.0,
    passed: true,
    latencyMs: 200,
    metadata: { model: "claude-3-5-sonnet" },
  };
  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.latencyMs, 200);
});

test("EvalCaseEvaluation allows optional fields", () => {
  const evaluation: EvalCaseEvaluation = {
    actualOutput: { result: true },
    score: 0.5,
    passed: false,
  };
  assert.equal(evaluation.latencyMs, undefined);
  assert.equal(evaluation.metadata, undefined);
});

test("EvalCaseEvaluatorInput structure is correct", () => {
  const input: EvalCaseEvaluatorInput = {
    suite: {
      id: "suite_123",
      name: "Test Suite",
      kind: "golden",
      description: "desc",
      cases: "[]",
      createdAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-14T00:00:00.000Z",
    },
    caseDefinition: {
      id: "case_1",
      input: "test input",
      expectedOutput: "test output",
    },
    modelId: "claude-3-5-sonnet",
    promptVersion: "v1.0.0",
  };
  assert.equal(input.modelId, "claude-3-5-sonnet");
  assert.equal(input.suite.kind, "golden");
});
