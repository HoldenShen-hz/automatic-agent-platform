import assert from "node:assert/strict";
import test from "node:test";

import { EvalDatasetJudgeService, type EvalDatasetCase } from "../../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";

function buildDatasetCases(): EvalDatasetCase[] {
  const criticalCases: EvalDatasetCase[] = Array.from({ length: 200 }, (_, index) => ({
    caseId: `critical-${index}`,
    input: { question: `critical question ${index}` },
    expectedOutput: index === 0 ? { summary: "incident summarized", severity: "sev3" } : "ok",
    tags: ["critical"],
    priority: "critical",
    qualityCriteria: index === 0
      ? [
          { criterionId: "exact_summary", type: "exact_match", config: {}, weight: 0.6, threshold: 1 },
          { criterionId: "judge_reasonable", type: "llm_judge", config: { rubric: "answer is operationally useful" }, weight: 0.4, threshold: 0.8 },
        ]
      : [
          { criterionId: `critical_exact_${index}`, type: "exact_match", config: {}, weight: 1, threshold: 1 },
        ],
  }));
  const standardCases: EvalDatasetCase[] = Array.from({ length: 20 }, (_, index) => ({
    caseId: `standard-${index}`,
    input: { question: `standard question ${index}` },
    expectedOutput: "notify on-call",
    tags: ["regression"],
    priority: "standard",
    qualityCriteria: [
      { criterionId: `contains_next_step_${index}`, type: "contains", config: { substring: "notify on-call" }, weight: 1, threshold: 1 },
    ],
  }));
  return [...criticalCases, ...standardCases];
}

function createService(): EvalDatasetJudgeService {
  const service = new EvalDatasetJudgeService();
  service.registerDataset({
    datasetId: "dataset_prompt_release",
    name: "Prompt Release Regression",
    version: "2026.04",
    stage: "assess",
    createdBy: "quality",
    cases: buildDatasetCases(),
  });
  service.activateDataset("dataset_prompt_release");
  service.registerJudge({
    judgeId: "judge_anthropic_safety",
    provider: "anthropic",
    providerFamily: "anthropic",
    modelId: "claude-judge",
    maxCostUsd: 0.02,
  });
  return service;
}

function buildPassingResults(judgeScore = 0.91) {
  return [
    ...Array.from({ length: 200 }, (_, index) => ({
      caseId: `critical-${index}`,
      output: index === 0 ? { severity: "sev3", summary: "incident summarized" } : "ok",
      latencyMs: 80,
      costUsd: 0.004,
      ...(index === 0 ? { criterionSignals: { judge_reasonable: judgeScore } } : {}),
    })),
    ...Array.from({ length: 20 }, (_, index) => ({
      caseId: `standard-${index}`,
      output: "notify on-call and create a follow-up incident task",
      latencyMs: 60,
      costUsd: 0.002,
    })),
  ];
}

test("EvalDatasetJudgeService promotes release when dataset and cross-provider judge pass", () => {
  const service = createService();
  const report = service.evaluateDataset({
    datasetId: "dataset_prompt_release",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-release",
    results: buildPassingResults(),
  });

  assert.equal(report.gateDecision, "promote");
  assert.equal(report.passRate, 1);
  assert.equal(report.criticalPassRate, 1);
  assert.equal(report.judgeId, "judge_anthropic_safety");
  assert.ok(report.advisoryFindings.includes("judge_assigned:judge_anthropic_safety"));
});

test("EvalDatasetJudgeService rejects same-provider LLM-as-judge", () => {
  const service = createService();
  service.registerJudge({
    judgeId: "judge_openai_conflict",
    provider: "openai",
    providerFamily: "openai",
    modelId: "gpt-judge",
    maxCostUsd: 0.01,
  });

  assert.throws(
    () => service.evaluateDataset({
      datasetId: "dataset_prompt_release",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-release",
      judgeId: "judge_openai_conflict",
      results: buildPassingResults(),
    }),
    /different provider family/,
  );
});

test("EvalDatasetJudgeService turns canary regression into rollback decision", () => {
  const service = createService();
  const results = buildPassingResults(0.4);
  results[0] = {
    ...results[0]!,
    output: { summary: "wrong" },
    latencyMs: 90,
    costUsd: 0.006,
    criterionSignals: { judge_reasonable: 0.4 },
  };

  const report = service.evaluateDataset({
    datasetId: "dataset_prompt_release",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-release",
    phase: "canary",
    baseline: {
      averageLatencyMs: 50,
      averageCostUsd: 0.002,
      weightedQualityScore: 0.98,
    },
    results,
  });

  assert.equal(report.gateDecision, "rollback");
  assert.ok(report.blockingFindings.some((item) => item.startsWith("critical_case_failed")));
  assert.ok(report.blockingFindings.some((item) => item.startsWith("latency_regressed")));
  assert.ok(report.blockingFindings.some((item) => item.startsWith("cost_regressed")));
});

test("EvalDatasetJudgeService clamps out-of-range criterion signals into [0, 1]", () => {
  const service = createService();
  const report = service.evaluateDataset({
    datasetId: "dataset_prompt_release",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-release",
    results: buildPassingResults(999),
  });

  const criterion = report.caseResults[0]?.criterionResults.find((item) => item.criterionId === "judge_reasonable");
  assert.equal(criterion?.score, 1);
});

test("EvalDatasetJudgeService supports deterministic holdout evaluation subset", () => {
  const service = createService();
  const report = service.evaluateDataset({
    datasetId: "dataset_prompt_release",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-release",
    holdoutRatio: 0.5,
    results: buildPassingResults(),
  });

  assert.ok(report.caseResults.length > 0);
  assert.ok(report.caseResults.length < 220);
});
