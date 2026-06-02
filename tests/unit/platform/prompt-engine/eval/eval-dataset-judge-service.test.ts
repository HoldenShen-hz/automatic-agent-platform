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
  const service = new EvalDatasetJudgeService({
    judge_reasonable: ({ criterionSignals }) => ({
      score: criterionSignals.judge_reasonable ?? 0,
      reason: (criterionSignals.judge_reasonable ?? 0) >= 0.8 ? "llm_judge_passed" : "llm_judge_failed",
    }),
  });
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

test("EvalDatasetJudgeService supports deterministic report IDs and timestamps for replay", () => {
  const service = new EvalDatasetJudgeService(
    {
      judge_reasonable: ({ criterionSignals }) => ({
        score: criterionSignals.judge_reasonable ?? 0,
      }),
    },
    {
      idFactory: (prefix) => `${prefix}_fixed`,
      now: () => "2026-06-02T00:00:00.000Z",
    },
  );
  service.registerDataset({
    datasetId: "dataset_replay",
    name: "Replay Dataset",
    version: "2026.06",
    stage: "assess",
    createdBy: "quality",
    cases: createReleaseDatasetCases(),
  });
  service.activateDataset("dataset_replay");
  service.registerJudge({
    judgeId: "judge_fixed",
    provider: "anthropic",
    providerFamily: "anthropic",
    modelId: "claude-judge",
    maxCostUsd: 0.02,
  });

  const report = service.evaluateDataset({
    datasetId: "dataset_replay",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-release",
    results: createReleaseResults(),
  });

  assert.equal(report.runId, "eval_dataset_run_fixed");
  assert.equal(report.createdAt, "2026-06-02T00:00:00.000Z");
});

test("EvalDatasetJudgeService only enforces independent judge for critical cases", () => {
  const service = new EvalDatasetJudgeService();
  service.registerDataset({
    datasetId: "dataset_standard_only",
    name: "Standard Only",
    version: "2026.06",
    stage: "assess",
    createdBy: "quality",
    sampleRequirements: { standard: 1 },
    cases: [{
      caseId: "standard-only-1",
      input: { question: "next step" },
      expectedOutput: "notify",
      tags: ["regression"],
      priority: "standard",
      qualityCriteria: [{
        criterionId: "contains_next_step",
        type: "contains",
        config: { substring: "notify" },
        weight: 1,
        threshold: 1,
      }],
    }],
  });
  service.activateDataset("dataset_standard_only");

  const report = service.evaluateDataset({
    datasetId: "dataset_standard_only",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-release",
    enforceIndependenceForHighRisk: true,
    results: [{ caseId: "standard-only-1", output: "notify the team" }],
  });

  assert.equal(report.gateDecision, "promote");
  assert.equal(report.blockingFindings.includes("independence_violation:high_risk_evaluation_requires_independent_judge"), false);
});

test("EvalDatasetJudgeService requires a registered evaluator for llm_judge criteria", () => {
  const service = new EvalDatasetJudgeService();
  service.registerDataset({
    datasetId: "dataset_missing_llm_judge",
    name: "Missing LLM Judge Evaluator",
    version: "2026.06",
    stage: "assess",
    createdBy: "quality",
    sampleRequirements: { standard: 1 },
    cases: [{
      caseId: "missing-judge-1",
      input: { question: "assess" },
      expectedOutput: "approved",
      tags: ["regression"],
      priority: "standard",
      qualityCriteria: [{
        criterionId: "judge_missing",
        type: "llm_judge",
        config: {},
        weight: 1,
        threshold: 0.8,
      }],
    }],
  });
  service.activateDataset("dataset_missing_llm_judge");
  service.registerJudge({
    judgeId: "judge_anthropic_only",
    provider: "anthropic",
    providerFamily: "anthropic",
    modelId: "claude-judge",
    maxCostUsd: 0.01,
  });

  assert.throws(
    () =>
      service.evaluateDataset({
        datasetId: "dataset_missing_llm_judge",
        candidateProvider: "openai",
        candidateProviderFamily: "openai",
        candidateModel: "gpt-release",
        judgeId: "judge_anthropic_only",
        results: [{
          caseId: "missing-judge-1",
          output: "approved",
          criterionSignals: { judge_missing: 1 },
        }],
      }),
    /LLM judge evaluator judge_missing is not registered/,
  );
});

test("EvalDatasetJudgeService contains criteria require an explicit configured substring", () => {
  const service = new EvalDatasetJudgeService();
  service.registerDataset({
    datasetId: "dataset_missing_contains_substring",
    name: "Missing Contains Needle",
    version: "2026.06",
    stage: "assess",
    createdBy: "quality",
    sampleRequirements: { standard: 1 },
    cases: [{
      caseId: "contains-1",
      input: { question: "next step" },
      expectedOutput: "notify on-call",
      tags: ["regression"],
      priority: "standard",
      qualityCriteria: [{
        criterionId: "contains_missing",
        type: "contains",
        config: {},
        weight: 1,
        threshold: 1,
      }],
    }],
  });
  service.activateDataset("dataset_missing_contains_substring");

  assert.throws(
    () =>
      service.evaluateDataset({
        datasetId: "dataset_missing_contains_substring",
        candidateProvider: "openai",
        candidateProviderFamily: "openai",
        candidateModel: "gpt-release",
        results: [{ caseId: "contains-1", output: "notify on-call immediately" }],
      }),
    /substring/,
  );
});

test("EvalDatasetJudgeService exact_match stays deterministic for complex values and distinguishes undefined from missing keys", () => {
  const service = new EvalDatasetJudgeService();
  const timestamp = new Date("2026-06-02T00:00:00.000Z");
  service.registerDataset({
    datasetId: "dataset_complex_exact_match",
    name: "Complex Exact Match",
    version: "2026.06",
    stage: "assess",
    createdBy: "quality",
    sampleRequirements: { standard: 1 },
    cases: [{
      caseId: "complex-1",
      input: { question: "serialize" },
      expectedOutput: {
        count: 2n,
        metadata: new Map([["b", 2], ["a", 1]]),
        optional: undefined,
        tags: new Set(["beta", "alpha"]),
        when: timestamp,
      },
      tags: ["regression"],
      priority: "standard",
      qualityCriteria: [{
        criterionId: "complex_exact",
        type: "exact_match",
        config: {},
        weight: 1,
        threshold: 1,
      }],
    }],
  });
  service.activateDataset("dataset_complex_exact_match");

  const passingReport = service.evaluateDataset({
    datasetId: "dataset_complex_exact_match",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-release",
    results: [{
      caseId: "complex-1",
      output: {
        count: 2n,
        metadata: new Map([["a", 1], ["b", 2]]),
        optional: undefined,
        tags: new Set(["alpha", "beta"]),
        when: new Date("2026-06-02T00:00:00.000Z"),
      },
    }],
  });

  assert.equal(passingReport.caseResults[0]?.criterionResults[0]?.passed, true);

  const failingReport = service.evaluateDataset({
    datasetId: "dataset_complex_exact_match",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-release",
    results: [{
      caseId: "complex-1",
      output: {
        count: 2n,
        metadata: new Map([["a", 1], ["b", 2]]),
        tags: new Set(["alpha", "beta"]),
        when: new Date("2026-06-02T00:00:00.000Z"),
      },
    }],
  });

  assert.equal(failingReport.caseResults[0]?.criterionResults[0]?.passed, false);
});
