import assert from "node:assert/strict";
import test from "node:test";

import { EvalDatasetJudgeService } from "../../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";
import { CrossProviderJudgeService } from "../../../../../src/platform/prompt-engine/eval/cross-provider-judge-service.js";

function buildDatasetCases(count = 50) {
  return Array.from({ length: count }, (_, index) => ({
    caseId: `case-${index + 1}`,
    input: { question: `status-${index + 1}` },
    expectedOutput: "ok",
    tags: [],
    priority: "standard" as const,
    qualityCriteria: [
      {
        criterionId: `judge-${index + 1}`,
        type: "llm_judge" as const,
        config: {},
        weight: 1,
        threshold: 0.8,
      },
    ],
  }));
}

function buildPassingResults(count = 50) {
  return Array.from({ length: count }, (_, index) => ({
    caseId: `case-${index + 1}`,
    output: "ok",
    criterionSignals: { [`judge-${index + 1}`]: 0.95 },
  }));
}

function createHarness(): CrossProviderJudgeService {
  const judgeService = new EvalDatasetJudgeService();
  judgeService.registerDataset({
    datasetId: "dataset-cross-provider",
    name: "Cross Provider",
    version: "1.0.0",
    stage: "assess",
    createdBy: "quality",
    cases: buildDatasetCases(),
  });
  judgeService.activateDataset("dataset-cross-provider");
  judgeService.registerJudge({
    judgeId: "judge-anthropic",
    provider: "anthropic",
    providerFamily: "anthropic",
    modelId: "claude-haiku-judge",
    maxCostUsd: 0.01,
  });
  judgeService.registerJudge({
    judgeId: "judge-openai-opus-like",
    provider: "openai",
    providerFamily: "openai",
    modelId: "gpt-opus-judge",
    maxCostUsd: 0.005,
  });
  return new CrossProviderJudgeService(judgeService);
}

test("CrossProviderJudgeService selects a different provider family for llm judge", () => {
  const service = createHarness();
  const selection = service.selectJudge({
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
  });

  assert.equal(selection.selectedJudge?.judgeId, "judge-anthropic");
  assert.equal(selection.alternativeJudges.length, 1);
});

test("CrossProviderJudgeService evaluates dataset with automatically selected judge", () => {
  const service = createHarness();
  const report = service.evaluateWithCrossProviderJudge({
    datasetId: "dataset-cross-provider",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-test",
    results: buildPassingResults(),
  });

  assert.equal(report.gateDecision, "promote");
  assert.equal(report.judgeId, "judge-anthropic");
});

test("CrossProviderJudgeService fastest strategy does not degenerate to cheapest", () => {
  const service = createHarness();
  const selection = service.selectJudge({
    candidateProvider: "google",
    candidateProviderFamily: "google",
    strategy: "fastest",
  });

  assert.equal(selection.selectedJudge?.judgeId, "judge-anthropic");
});
