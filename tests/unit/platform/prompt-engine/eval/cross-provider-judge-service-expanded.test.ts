import assert from "node:assert/strict";
import test from "node:test";

import { EvalDatasetJudgeService } from "../../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";
import { CrossProviderJudgeService } from "../../../../../src/platform/prompt-engine/eval/cross-provider-judge-service.js";
import type { EvalDatasetCase } from "../../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";

function generateStandardCases(count: number, prefix: string): EvalDatasetCase[] {
  const cases: EvalDatasetCase[] = [];
  for (let i = 0; i < count; i++) {
    cases.push({
      caseId: `${prefix}case-${i}`,
      input: { question: `test question ${i}` },
      expectedOutput: "ok",
      tags: [],
      priority: "standard",
      qualityCriteria: [
        {
          criterionId: `judge-${i}`,
          type: "llm_judge" as const,
          config: { judgeEvaluatorId: "judge_default" },
          weight: 1,
          threshold: 0.8,
        },
      ],
    });
  }
  return cases;
}

function createHarness(): CrossProviderJudgeService {
  const judgeService = new EvalDatasetJudgeService({
    judge_default: ({ criterion, criterionSignals }) => ({
      score: criterionSignals[criterion.criterionId] ?? 0,
    }),
  });
  judgeService.registerDataset({
    datasetId: "dataset-multi-judge",
    name: "Multi Judge Dataset",
    version: "1.0.0",
    stage: "assess",
    createdBy: "quality",
    cases: generateStandardCases(50, "multi-judge-"),
  });
  judgeService.activateDataset("dataset-multi-judge");
  judgeService.registerJudge({
    judgeId: "judge-anthropic",
    provider: "anthropic",
    providerFamily: "anthropic",
    modelId: "claude-judge",
    maxCostUsd: 0.01,
  });
  judgeService.registerJudge({
    judgeId: "judge-minimax",
    provider: "minimax",
    providerFamily: "minimax",
    modelId: "m1-judge",
    maxCostUsd: 0.005,
  });
  judgeService.registerJudge({
    judgeId: "judge-openai",
    provider: "openai",
    providerFamily: "openai",
    modelId: "gpt-judge",
    maxCostUsd: 0.008,
  });
  return new CrossProviderJudgeService(judgeService);
}

test("CrossProviderJudgeService evaluateWithPipeline runs primary judge", () => {
  const service = createHarness();
  const result = service.evaluateWithPipeline({
    evaluation: {
      datasetId: "dataset-multi-judge",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-test",
      results: [
        { caseId: "multi-judge-case-0", output: "ok", criterionSignals: { "judge-0": 0.9 } },
        { caseId: "multi-judge-case-1", output: "ok", criterionSignals: { "judge-1": 0.8 } },
      ],
    },
    pipeline: {
      primaryJudgeId: "judge-anthropic",
      fallbackJudgeIds: [],
      parallelEvaluation: false,
      consensusThreshold: 0.5,
    },
  });

  assert.equal(result.individualResults.length, 1);
  assert.equal(result.individualResults[0]?.judgeId, "judge-anthropic");
  assert.equal(result.consensusDecision, "hold");
  assert.ok(result.blockingFindings.includes("insufficient_judge_quorum:1/2"));
});

test("CrossProviderJudgeService evaluateWithPipeline includes fallback judges", () => {
  const service = createHarness();
  const result = service.evaluateWithPipeline({
    evaluation: {
      datasetId: "dataset-multi-judge",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-test",
      results: [
        { caseId: "multi-judge-case-0", output: "ok", criterionSignals: { "judge-0": 0.9 } },
        { caseId: "multi-judge-case-1", output: "ok", criterionSignals: { "judge-1": 0.8 } },
      ],
    },
    pipeline: {
      primaryJudgeId: "judge-anthropic",
      fallbackJudgeIds: ["judge-minimax"],
      parallelEvaluation: false,
      consensusThreshold: 0.5,
    },
  });

  assert.equal(result.individualResults.length, 2);
  const judgeIds = result.individualResults.map((r) => r.judgeId);
  assert.ok(judgeIds.includes("judge-anthropic"));
  assert.ok(judgeIds.includes("judge-minimax"));
});

test("CrossProviderJudgeService evaluateWithPipeline skips non-ready judges", () => {
  const service = createHarness();
  const result = service.evaluateWithPipeline({
    evaluation: {
      datasetId: "dataset-multi-judge",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-test",
      results: [
        { caseId: "multi-judge-case-0", output: "ok", criterionSignals: { "judge-0": 0.9 } },
        { caseId: "multi-judge-case-1", output: "ok", criterionSignals: { "judge-1": 0.8 } },
      ],
    },
    pipeline: {
      primaryJudgeId: "nonexistent-judge",
      fallbackJudgeIds: ["judge-anthropic"],
      parallelEvaluation: false,
      consensusThreshold: 0.5,
    },
  });

  assert.equal(result.individualResults.length, 1);
  assert.equal(result.individualResults[0]?.judgeId, "judge-anthropic");
});

test("CrossProviderJudgeService evaluateWithPipeline builds consensus decision hold when judges disagree", () => {
  const service = createHarness();
  const result = service.evaluateWithPipeline({
    evaluation: {
      datasetId: "dataset-multi-judge",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-test",
      results: [
        { caseId: "multi-judge-case-0", output: "wrong", criterionSignals: { "judge-0": 0.1 } },
        { caseId: "multi-judge-case-1", output: "bad", criterionSignals: { "judge-1": 0.1 } },
      ],
    },
    pipeline: {
      primaryJudgeId: "judge-anthropic",
      fallbackJudgeIds: ["judge-minimax"],
      parallelEvaluation: false,
      consensusThreshold: 0.5,
    },
  });

  assert.equal(result.consensusDecision, "hold");
  // Both judges vote hold, so agreementScore is 2/2 = 1.0
  assert.equal(result.agreementScore, 1.0);
});

test("CrossProviderJudgeService evaluateWithPipeline returns hold on empty results", () => {
  const service = createHarness();
  const result = service.evaluateWithPipeline({
    evaluation: {
      datasetId: "dataset-multi-judge",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-test",
      results: [],
    },
    pipeline: {
      primaryJudgeId: "nonexistent",
      fallbackJudgeIds: [],
      parallelEvaluation: false,
      consensusThreshold: 0.5,
    },
  });

  assert.equal(result.consensusDecision, "hold");
  assert.equal(result.individualResults.length, 0);
  assert.ok(result.blockingFindings.includes("no_judges_available"));
});

test("CrossProviderJudgeService evaluateWithPipeline does not let a single judge promote on its own", () => {
  const service = createHarness();
  const result = service.evaluateWithPipeline({
    evaluation: {
      datasetId: "dataset-multi-judge",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-test",
      results: [
        { caseId: "multi-judge-case-0", output: "ok", criterionSignals: { "judge-0": 0.9 } },
        { caseId: "multi-judge-case-1", output: "ok", criterionSignals: { "judge-1": 0.9 } },
      ],
    },
    pipeline: {
      primaryJudgeId: "judge-anthropic",
      fallbackJudgeIds: [],
      parallelEvaluation: false,
      consensusThreshold: 0.5,
    },
  });

  assert.equal(result.consensusDecision, "hold");
  assert.ok(result.blockingFindings.includes("insufficient_judge_quorum:1/2"));
});

test("CrossProviderJudgeService suggestMultipleJudges returns up to maxJudges", () => {
  const service = createHarness();
  const judges = service.suggestMultipleJudges({
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    maxJudges: 2,
  });

  assert.ok(judges.length <= 2);
});

test("CrossProviderJudgeService suggestMultipleJudges defaults to 3", () => {
  const service = createHarness();
  const judges = service.suggestMultipleJudges({
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
  });

  assert.ok(judges.length <= 3);
});

test("CrossProviderJudgeService getProviderDiversityScore calculates correct score", () => {
  const service = createHarness();
  const score = service.getProviderDiversityScore([
    { judgeId: "j1", provider: "openai", providerFamily: "openai", modelId: "m1", capabilities: [], supportedRiskLevels: ["critical", "high", "medium", "low"], maxCostUsd: 0.01, status: "ready", createdAt: "", updatedAt: "" },
    { judgeId: "j2", provider: "anthropic", providerFamily: "anthropic", modelId: "m2", capabilities: [], supportedRiskLevels: ["critical", "high", "medium", "low"], maxCostUsd: 0.01, status: "ready", createdAt: "", updatedAt: "" },
  ]);

  assert.equal(score, 1.0);
});

test("CrossProviderJudgeService getProviderDiversityScore with same family returns lower score", () => {
  const service = createHarness();
  const score = service.getProviderDiversityScore([
    { judgeId: "j1", provider: "openai", providerFamily: "openai", modelId: "m1", capabilities: [], supportedRiskLevels: ["critical", "high", "medium", "low"], maxCostUsd: 0.01, status: "ready", createdAt: "", updatedAt: "" },
    { judgeId: "j2", provider: "openai", providerFamily: "openai", modelId: "m2", capabilities: [], supportedRiskLevels: ["critical", "high", "medium", "low"], maxCostUsd: 0.01, status: "ready", createdAt: "", updatedAt: "" },
  ]);

  assert.equal(score, 0.5);
});

test("CrossProviderJudgeService getProviderDiversityScore with empty array", () => {
  const service = createHarness();
  const score = service.getProviderDiversityScore([]);

  assert.equal(score, 0);
});

test("CrossProviderJudgeService evaluateWithPipeline unanimous rollback gives agreementScore 1.0", () => {
  const service = createHarness();
  const result = service.evaluateWithPipeline({
    evaluation: {
      datasetId: "dataset-multi-judge",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-test",
      phase: "canary",
      results: [
        { caseId: "multi-judge-case-0", output: "bad", criterionSignals: { "judge-0": 0.1 } },
        { caseId: "multi-judge-case-1", output: "bad", criterionSignals: { "judge-1": 0.1 } },
      ],
    },
    pipeline: {
      primaryJudgeId: "judge-anthropic",
      fallbackJudgeIds: ["judge-minimax"],
      parallelEvaluation: false,
      consensusThreshold: 0.5,
    },
  });

  assert.equal(result.consensusDecision, "rollback");
  assert.equal(result.agreementScore, 1.0);
});

test("CrossProviderJudgeService evaluateWithPipeline unanimous promote gives agreementScore 1.0", () => {
  const service = createHarness();
  // Need 50 cases for pass rate to reach 95%
  const result = service.evaluateWithPipeline({
    evaluation: {
      datasetId: "dataset-multi-judge",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-test",
      results: Array.from({ length: 50 }, (_, i) => ({
        caseId: "multi-judge-case-" + i,
        output: "ok",
        criterionSignals: { ["judge-" + i]: 0.95 },
      })),
    },
    pipeline: {
      primaryJudgeId: "judge-anthropic",
      fallbackJudgeIds: ["judge-minimax"],
      parallelEvaluation: false,
      consensusThreshold: 0.5,
    },
  });

  assert.equal(result.consensusDecision, "promote");
  assert.equal(result.agreementScore, 1.0);
});

test("CrossProviderJudgeService evaluateWithPipeline unanimous hold gives agreementScore 1.0", () => {
  const service = createHarness();
  const result = service.evaluateWithPipeline({
    evaluation: {
      datasetId: "dataset-multi-judge",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-test",
      results: [
        { caseId: "multi-judge-case-0", output: "uncertain", criterionSignals: { "judge-0": 0.5 } },
        { caseId: "multi-judge-case-1", output: "uncertain", criterionSignals: { "judge-1": 0.5 } },
      ],
    },
    pipeline: {
      primaryJudgeId: "judge-anthropic",
      fallbackJudgeIds: ["judge-minimax"],
      parallelEvaluation: false,
      consensusThreshold: 0.5,
    },
  });

  assert.equal(result.consensusDecision, "hold");
  assert.equal(result.agreementScore, 1.0);
});

test("CrossProviderJudgeService evaluateWithPipeline rollback majority wins over promote minority", () => {
  const service = createHarness();
  // With 2 judges in pipeline, both voting rollback means unanimous = 1.0
  const result = service.evaluateWithPipeline({
    evaluation: {
      datasetId: "dataset-multi-judge",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-test",
      phase: "canary",
      results: [
        { caseId: "case-0", output: "bad", criterionSignals: { "judge-0": 0.1 } },
        { caseId: "case-1", output: "bad", criterionSignals: { "judge-1": 0.1 } },
        { caseId: "case-2", output: "ok", criterionSignals: { "judge-2": 0.9 } },
      ],
    },
    pipeline: {
      primaryJudgeId: "judge-anthropic",
      fallbackJudgeIds: ["judge-minimax"],
      parallelEvaluation: false,
      consensusThreshold: 0.5,
    },
  });

  assert.equal(result.consensusDecision, "rollback");
  // With 2 judges both voting rollback, agreementScore = 2/2 = 1.0
  assert.equal(result.agreementScore, 1.0);
});
