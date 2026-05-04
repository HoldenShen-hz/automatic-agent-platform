import assert from "node:assert/strict";
import test from "node:test";

import { CrossProviderJudgeService } from "../../../../../src/platform/prompt-engine/eval/cross-provider-judge-service.js";
import { EvalDatasetJudgeService, type EvalDatasetCase } from "../../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";

function generateStandardCases(count: number, prefix: string): EvalDatasetCase[] {
  return Array.from({ length: count }, (_, index) => ({
    caseId: `${prefix}case-${index}`,
    input: { question: `test question ${index}` },
    expectedOutput: "ok",
    tags: [],
    priority: "standard" as const,
    qualityCriteria: [
      {
        criterionId: `judge-${index}`,
        type: "llm_judge" as const,
        config: {},
        weight: 1,
        threshold: 0.8,
      },
    ],
  }));
}

function buildResults(score: number, output = "ok") {
  return Array.from({ length: 25 }, (_, index) => ({
    caseId: `multi-judge-case-${index}`,
    output,
    criterionSignals: { [`judge-${index}`]: score },
  }));
}

function createHarness(): CrossProviderJudgeService {
  const judgeService = new EvalDatasetJudgeService();
  judgeService.registerDataset({
    datasetId: "dataset-multi-judge",
    name: "Multi Judge Dataset",
    version: "1.0.0",
    stage: "assess",
    createdBy: "quality",
    cases: generateStandardCases(25, "multi-judge-"),
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

test("CrossProviderJudgeService selectJudge picks the cheapest non-conflicting provider", () => {
  const service = createHarness();
  const selection = service.selectJudge({
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
  });

  assert.equal(selection.selectedJudge?.judgeId, "judge-minimax");
  assert.equal(selection.alternativeJudges.length, 2);
});

test("CrossProviderJudgeService evaluateWithCrossProviderJudge auto-selects a compatible judge", () => {
  const service = createHarness();
  const report = service.evaluateWithCrossProviderJudge({
    datasetId: "dataset-multi-judge",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-test",
    results: buildResults(0.95),
  });

  assert.equal(report.gateDecision, "promote");
  assert.equal(report.judgeId, "judge-minimax");
});

test("CrossProviderJudgeService evaluateWithPipeline reports unanimous promote agreement", () => {
  const service = createHarness();
  const result = service.evaluateWithPipeline({
    evaluation: {
      datasetId: "dataset-multi-judge",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-test",
      results: buildResults(0.95),
    },
    pipeline: {
      primaryJudgeId: "judge-anthropic",
      fallbackJudgeIds: ["judge-minimax"],
      parallelEvaluation: false,
      consensusThreshold: 0.5,
    },
  });

  assert.equal(result.consensusDecision, "promote");
  assert.equal(result.agreementScore, 1);
  assert.equal(result.individualResults.length, 2);
});

test("CrossProviderJudgeService evaluateWithPipeline reports unanimous hold agreement", () => {
  const service = createHarness();
  const result = service.evaluateWithPipeline({
    evaluation: {
      datasetId: "dataset-multi-judge",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-test",
      results: buildResults(0.5),
    },
    pipeline: {
      primaryJudgeId: "judge-anthropic",
      fallbackJudgeIds: ["judge-minimax"],
      parallelEvaluation: false,
      consensusThreshold: 0.5,
    },
  });

  assert.equal(result.consensusDecision, "hold");
  assert.equal(result.agreementScore, 1);
});

test("CrossProviderJudgeService evaluateWithPipeline honors the parallelEvaluation branch", () => {
  const service = createHarness();
  const result = service.evaluateWithPipeline({
    evaluation: {
      datasetId: "dataset-multi-judge",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-test",
      results: buildResults(0.95),
    },
    pipeline: {
      primaryJudgeId: "judge-anthropic",
      fallbackJudgeIds: ["judge-minimax"],
      parallelEvaluation: true,
      consensusThreshold: 0.5,
    },
  });

  assert.equal(result.individualResults.length, 2);
  assert.ok(result.individualResults.some((item) => item.judgeId === "judge-anthropic"));
  assert.ok(result.individualResults.some((item) => item.judgeId === "judge-minimax"));
});

test("CrossProviderJudgeService getProviderDiversityScore calculates expected ratios", () => {
  const service = createHarness();
  assert.equal(
    service.getProviderDiversityScore([
      { judgeId: "j1", provider: "openai", providerFamily: "openai", modelId: "m1", capabilities: [], maxCostUsd: 0.01, status: "ready", createdAt: "", updatedAt: "" },
      { judgeId: "j2", provider: "anthropic", providerFamily: "anthropic", modelId: "m2", capabilities: [], maxCostUsd: 0.01, status: "ready", createdAt: "", updatedAt: "" },
    ]),
    1,
  );
  assert.equal(
    service.getProviderDiversityScore([
      { judgeId: "j1", provider: "openai", providerFamily: "openai", modelId: "m1", capabilities: [], maxCostUsd: 0.01, status: "ready", createdAt: "", updatedAt: "" },
      { judgeId: "j2", provider: "openai", providerFamily: "openai", modelId: "m2", capabilities: [], maxCostUsd: 0.01, status: "ready", createdAt: "", updatedAt: "" },
    ]),
    0.5,
  );
});
