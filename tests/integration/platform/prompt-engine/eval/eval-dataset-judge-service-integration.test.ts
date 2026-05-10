import assert from "node:assert/strict";
import test from "node:test";

import { EvalDatasetJudgeService } from "../../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";
import type { EvalDatasetCase, EvalCasePriority } from "../../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";

function generateCasesByPriority(
  priority: EvalCasePriority,
  count: number,
  prefix: string,
  criterionType: "exact_match" | "contains" | "json_schema" | "llm_judge" = "exact_match",
): EvalDatasetCase[] {
  const cases: EvalDatasetCase[] = [];
  for (let i = 0; i < count; i++) {
    const caseId = `${prefix}${priority}-${i}`;
    let config: Record<string, unknown> = {};
    let expectedOutput: unknown = "ok";
    let criterionId = `crit-${priority}-${i}`;

    switch (criterionType) {
      case "contains":
        config = { substring: "ok" };
        break;
      case "json_schema":
        config = { requiredKeys: ["status"] };
        expectedOutput = { status: "ok" };
        break;
      case "llm_judge":
        criterionId = `llm-${criterionId}`;
        break;
    }

    cases.push({
      caseId,
      input: { prompt: `test ${i}` },
      expectedOutput,
      tags: [priority],
      priority,
      qualityCriteria: [
        {
          criterionId,
          type: criterionType,
          config,
          weight: 1,
          threshold: criterionType === "llm_judge" ? 0.8 : 1,
        },
      ],
    });
  }
  return cases;
}

function createIntegrationDataset(service: EvalDatasetJudgeService): void {
  const cases: EvalDatasetCase[] = [
    ...generateCasesByPriority("critical", 200, "int-", "exact_match"),
    ...generateCasesByPriority("critical", 100, "int-", "contains"),
    ...generateCasesByPriority("standard", 20, "int-", "llm_judge"),
  ];

  service.registerDataset({
    datasetId: "integration-ds",
    name: "Integration Dataset",
    version: "1.0.0",
    stage: "assess",
    createdBy: "integration-test",
    cases,
  });
  service.activateDataset("integration-ds");
}

function createSmallDataset(service: EvalDatasetJudgeService, datasetId: string): void {
  const cases: EvalDatasetCase[] = [
    ...generateCasesByPriority("standard", 20, `${datasetId}-`, "exact_match"),
  ];

  service.registerDataset({
    datasetId,
    name: `Small Dataset ${datasetId}`,
    version: "1.0.0",
    stage: "assess",
    createdBy: "integration-test",
    cases,
  });
  service.activateDataset(datasetId);
}

test("EvalDatasetJudgeService integration: full evaluation pipeline", () => {
  const service = new EvalDatasetJudgeService();
  createIntegrationDataset(service);
  service.registerJudge({
    judgeId: "judge-int",
    provider: "anthropic",
    providerFamily: "anthropic",
    modelId: "claude-int",
    maxCostUsd: 0.01,
  });

  // Create results for all critical cases with passing output
  const criticalResults = Array.from({ length: 200 }, (_, i) => ({
    caseId: `int-critical-${i}`,
    output: "ok",
    latencyMs: 100,
    costUsd: 0.001,
  }));
  const highResults = Array.from({ length: 100 }, (_, i) => ({
    caseId: `int-high-${i}`,
    output: "ok",
    latencyMs: 90,
    costUsd: 0.0009,
  }));
  const mediumResults = Array.from({ length: 50 }, (_, i) => ({
    caseId: `int-medium-${i}`,
    output: { status: "ok" },
    latencyMs: 80,
    costUsd: 0.0008,
  }));
  const standardResults = Array.from({ length: 20 }, (_, i) => ({
    caseId: `int-standard-${i}`,
    output: "ok",
    criterionSignals: { [`llm-crit-int-standard-${i}`]: 0.85 },
    latencyMs: 70,
    costUsd: 0.0007,
  }));

  const report = service.evaluateDataset({
    datasetId: "integration-ds",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-integration",
    phase: "offline",
    results: [...criticalResults, ...highResults, ...mediumResults, ...standardResults],
  });

  assert.ok(report.runId.startsWith("eval_dataset_run_"));
  assert.ok(report.caseResults.length > 0);
  assert.equal(report.datasetId, "integration-ds");
  assert.equal(report.candidateProvider, "openai");
});

test("EvalDatasetJudgeService integration: multiple evaluations accumulate reports", () => {
  const service = new EvalDatasetJudgeService();
  createSmallDataset(service, "multi-eval-ds");

  service.evaluateDataset({
    datasetId: "multi-eval-ds",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-v1",
    results: [
      { caseId: "multi-eval-ds-standard-0", output: "wrong" },
    ],
  });

  service.evaluateDataset({
    datasetId: "multi-eval-ds",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-v2",
    results: [
      { caseId: "multi-eval-ds-standard-0", output: "ok" },
    ],
  });

  const reports = service.listReports("multi-eval-ds");
  assert.equal(reports.length, 2);
  assert.notEqual(reports[0]!.candidateModel, reports[1]!.candidateModel);
});

test("EvalDatasetJudgeService integration: custom criterion evaluator via constructor", () => {
  const customEval = {
    custom_score: ({ criterion, output }: { criterion: { criterionId: string; type: string; config: Record<string, unknown>; weight: number; threshold: number }; expectedOutput: unknown; output: unknown; criterionSignals: Record<string, number>; metadata: Record<string, unknown> }) => ({
      score: output === "custom-pass" ? 1.0 : 0.0,
      passed: output === "custom-pass",
      reason: "custom_function_used",
    }),
  };

  const service = new EvalDatasetJudgeService(customEval);
  // Use standard priority to avoid large case requirements
  const cases: EvalDatasetCase[] = generateCasesByPriority("standard", 20, "custom-", "exact_match");
  const firstCase = cases[0]!;
  firstCase.qualityCriteria[0] = {
    criterionId: "custom_score",
    type: "custom_function",
    config: { functionId: "custom_score" },
    weight: 1,
    threshold: 0.8,
  };

  service.registerDataset({
    datasetId: "custom-eval-ds",
    name: "Custom Eval Dataset",
    version: "1.0.0",
    stage: "assess",
    createdBy: "custom-test",
    cases,
  });
  service.activateDataset("custom-eval-ds");

  // Provide results for all 20 cases so no missing_case_result blocking findings
  const allResults = Array.from({ length: 20 }, (_, i) => ({
    caseId: `custom-standard-${i}`,
    output: i === 0 ? "custom-pass" : "wrong",
  }));

  const report = service.evaluateDataset({
    datasetId: "custom-eval-ds",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "custom-model",
    results: allResults,
  });

  assert.equal(report.caseResults[0]?.criterionResults[0]?.score, 1.0);
  assert.equal(report.caseResults[0]?.criterionResults[0]?.reason, "custom_function_used");
});

test("EvalDatasetJudgeService integration: evaluation with baseline regression detection", () => {
  const service = new EvalDatasetJudgeService();
  createSmallDataset(service, "regression-ds");

  // Provide results for all 20 cases - some will fail which reduces weighted quality score
  const allResults = Array.from({ length: 20 }, (_, i) => ({
    caseId: `regression-ds-standard-${i}`,
    output: i < 18 ? "ok" : "wrong", // 2 failures out of 20
    latencyMs: 150,
    costUsd: 0.003,
  }));

  const report = service.evaluateDataset({
    datasetId: "regression-ds",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-regressed",
    baseline: {
      averageLatencyMs: 50,
      averageCostUsd: 0.0005,
      weightedQualityScore: 1.0,
    },
    results: allResults,
  });

  assert.ok(report.blockingFindings.some((f) => f.startsWith("latency_regressed")));
  assert.ok(report.blockingFindings.some((f) => f.startsWith("cost_regressed")));
  assert.ok(report.blockingFindings.some((f) => f.startsWith("quality_score_regressed")));
});

test("EvalDatasetJudgeService integration: canary phase with blocking rollback", () => {
  const service = new EvalDatasetJudgeService();
  createSmallDataset(service, "canary-ds");

  const report = service.evaluateDataset({
    datasetId: "canary-ds",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-canary",
    phase: "canary",
    results: [
      { caseId: "canary-ds-standard-0", output: "wrong" },
    ],
  });

  assert.equal(report.gateDecision, "rollback");
  assert.equal(report.phase, "canary");
});