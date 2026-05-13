import assert from "node:assert/strict";
import test from "node:test";

import { EvalDatasetJudgeService } from "../../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";
import type {
  EvalCaseSubmission,
  EvalDatasetCase,
} from "../../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";

const primaryCriticalCaseId = "critical_json_shape";
const primaryStandardCaseId = "standard_contains";

function createReleaseDatasetCases(): EvalDatasetCase[] {
  const cases: EvalDatasetCase[] = [
    {
      caseId: primaryCriticalCaseId,
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
      caseId: primaryStandardCaseId,
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
  ];

  for (let i = 1; i < 200; i++) {
    cases.push({
      caseId: `critical_filler_${i}`,
      input: { question: `critical filler ${i}` },
      expectedOutput: "ok",
      tags: ["regression"],
      priority: "critical",
      qualityCriteria: [
        {
          criterionId: `critical_filler_match_${i}`,
          type: "exact_match",
          config: {},
          weight: 1,
          threshold: 1,
        },
      ],
    });
  }

  for (let i = 1; i < 100; i++) {
    cases.push({
      caseId: `standard_filler_${i}`,
      input: { question: `standard filler ${i}` },
      expectedOutput: "ok",
      tags: ["regression"],
      priority: "standard",
      qualityCriteria: [
        {
          criterionId: `standard_filler_match_${i}`,
          type: "exact_match",
          config: {},
          weight: 1,
          threshold: 1,
        },
      ],
    });
  }

  return cases;
}

function createReleaseResults(input?: {
  defaultLatencyMs?: number;
  defaultCostUsd?: number;
  criticalOverride?: Partial<EvalCaseSubmission>;
  standardOverride?: Partial<EvalCaseSubmission>;
}): EvalCaseSubmission[] {
  const defaultLatencyMs = input?.defaultLatencyMs ?? 0;
  const defaultCostUsd = input?.defaultCostUsd ?? 0;
  const results: EvalCaseSubmission[] = [
    {
      caseId: primaryCriticalCaseId,
      output: { severity: "sev3", summary: "incident summarized" },
      latencyMs: defaultLatencyMs,
      costUsd: defaultCostUsd,
      criterionSignals: { judge_reasonable: 0.91 },
      ...input?.criticalOverride,
    },
    {
      caseId: primaryStandardCaseId,
      output: "notify on-call and create a follow-up incident task",
      latencyMs: defaultLatencyMs,
      costUsd: defaultCostUsd,
      ...input?.standardOverride,
    },
  ];

  for (let i = 1; i < 200; i++) {
    results.push({
      caseId: `critical_filler_${i}`,
      output: "ok",
      latencyMs: defaultLatencyMs,
      costUsd: defaultCostUsd,
    });
  }

  for (let i = 1; i < 100; i++) {
    results.push({
      caseId: `standard_filler_${i}`,
      output: "ok",
      latencyMs: defaultLatencyMs,
      costUsd: defaultCostUsd,
    });
  }

  return results;
}

function createService(): EvalDatasetJudgeService {
  const service = new EvalDatasetJudgeService();
  service.registerDataset({
    datasetId: "dataset_prompt_release",
    name: "Prompt Release Regression",
    version: "2026.04",
    stage: "assess",
    createdBy: "quality",
    cases: createReleaseDatasetCases(),
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
    results: createReleaseResults(),
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
      results: createReleaseResults(),
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
    results: createReleaseResults({
      defaultLatencyMs: 80,
      defaultCostUsd: 0.006,
      criticalOverride: {
        output: { summary: "wrong" },
        criterionSignals: { judge_reasonable: 0.4 },
      },
    }),
  });

  assert.equal(report.gateDecision, "rollback");
  assert.ok(report.blockingFindings.some((item) => item.startsWith("critical_case_failed")));
  assert.ok(report.blockingFindings.some((item) => item.startsWith("latency_regressed")));
  assert.ok(report.blockingFindings.some((item) => item.startsWith("cost_regressed")));
});
