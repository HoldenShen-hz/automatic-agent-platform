import assert from "node:assert/strict";
import test from "node:test";

import { EvalDatasetJudgeService } from "../../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";

function createService(): EvalDatasetJudgeService {
  const service = new EvalDatasetJudgeService();
  service.registerDataset({
    datasetId: "dataset_prompt_release",
    name: "Prompt Release Regression",
    version: "2026.04",
    stage: "assess",
    createdBy: "quality",
    cases: [
      {
        caseId: "critical_json_shape",
        input: { question: "summarize incident" },
        expectedOutput: { summary: "incident summarized", severity: "sev3" },
        tags: ["regression", "critical"],
        priority: "critical",
        qualityCriteria: [
          {
            criterionId: "exact_summary",
            type: "exact_match",
            config: {},
            weight: 0.6,
            threshold: 1,
          },
          {
            criterionId: "judge_reasonable",
            type: "llm_judge",
            config: { rubric: "answer is operationally useful" },
            weight: 0.4,
            threshold: 0.8,
          },
        ],
      },
      {
        caseId: "standard_contains",
        input: { question: "next step" },
        expectedOutput: "notify on-call",
        tags: ["regression"],
        priority: "standard",
        qualityCriteria: [
          {
            criterionId: "contains_next_step",
            type: "contains",
            config: { substring: "notify on-call" },
            weight: 1,
            threshold: 1,
          },
        ],
      },
    ],
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

test("EvalDatasetJudgeService promotes release when dataset and cross-provider judge pass", () => {
  const service = createService();

  const report = service.evaluateDataset({
    datasetId: "dataset_prompt_release",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-release",
    results: [
      {
        caseId: "critical_json_shape",
        output: { severity: "sev3", summary: "incident summarized" },
        latencyMs: 80,
        costUsd: 0.004,
        criterionSignals: { judge_reasonable: 0.91 },
      },
      {
        caseId: "standard_contains",
        output: "notify on-call and create a follow-up incident task",
        latencyMs: 60,
        costUsd: 0.002,
      },
    ],
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
      results: [
        {
          caseId: "critical_json_shape",
          output: { severity: "sev3", summary: "incident summarized" },
          criterionSignals: { judge_reasonable: 0.9 },
        },
        {
          caseId: "standard_contains",
          output: "notify on-call",
        },
      ],
    }),
    /different provider family/,
  );
});

test("EvalDatasetJudgeService turns canary regression into rollback decision", () => {
  const service = createService();

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
    results: [
      {
        caseId: "critical_json_shape",
        output: { summary: "wrong" },
        latencyMs: 90,
        costUsd: 0.006,
        criterionSignals: { judge_reasonable: 0.4 },
      },
      {
        caseId: "standard_contains",
        output: "notify on-call",
        latencyMs: 80,
        costUsd: 0.006,
      },
    ],
  });

  assert.equal(report.gateDecision, "rollback");
  assert.ok(report.blockingFindings.some((item) => item.startsWith("critical_case_failed")));
  assert.ok(report.blockingFindings.some((item) => item.startsWith("latency_regressed")));
  assert.ok(report.blockingFindings.some((item) => item.startsWith("cost_regressed")));
});
