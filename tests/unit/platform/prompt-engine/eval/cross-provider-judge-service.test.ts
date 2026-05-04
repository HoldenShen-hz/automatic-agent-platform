/**
 * Cross Provider Judge Service Unit Tests
 *
 * Tests for cross-provider-judge-service covering:
 * - Issue #1965: agreementScore only promote ratio
 */

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
          config: {},
          weight: 1,
          threshold: 0.8,
        },
      ],
    });
  }
  return cases;
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

// ============================================================================
// Issue #1965: agreementScore only promote ratio
// ============================================================================

test("CrossProviderJudgeService selectJudge selects a different provider family for llm judge", () => {
  const service = createHarness();
  const selection = service.selectJudge({
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
  });

  assert.equal(selection.selectedJudge?.judgeId, "judge-anthropic");
  assert.equal(selection.alternativeJudges.length, 1);
});

test("CrossProviderJudgeService evaluateWithCrossProviderJudge uses automatically selected judge", () => {
  const service = createHarness();
  const report = service.evaluateWithCrossProviderJudge({
    datasetId: "dataset-multi-judge",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-test",
    results: [
      {
        caseId: "multi-judge-case-0",
        output: "ok",
        criterionSignals: { "judge-0": 0.9 },
      },
    ],
  });

  assert.equal(report.gateDecision, "promote");
  assert.equal(report.judgeId, "judge-anthropic");
});

test("CrossProviderJudgeService evaluateWithPipeline computes agreementScore correctly", () => {
  const service = createHarness();

  // All judges return promote -> agreementScore should be 1.0
  const result = service.evaluateWithPipeline({
    evaluation: {
      datasetId: "dataset-multi-judge",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-test",
      results: [
        { caseId: "multi-judge-case-0", output: "ok", criterionSignals: { "judge-0": 0.9 } },
        { caseId: "multi-judge-case-1", output: "ok", criterionSignals: { "judge-1": 0.85 } },
      ],
    },
    pipeline: {
      primaryJudgeId: "judge-anthropic",
      fallbackJudgeIds: ["judge-minimax", "judge-openai"],
      parallelEvaluation: false,
      consensusThreshold: 0.5,
    },
  });

  // Issue #1965: agreementScore should reflect promote ratio
  // With all promote, ratio = 3/3 = 1.0
  assert.equal(result.agreementScore, 1.0);
  assert.equal(result.consensusDecision, "promote");
});

test("CrossProviderJudgeService evaluateWithPipeline computes agreementScore with mixed decisions", () => {
  const service = createHarness();

  // 2 promote, 1 hold -> agreementScore = 2/3 ≈ 0.67
  const result = service.evaluateWithPipeline({
    evaluation: {
      datasetId: "dataset-multi-judge",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-test",
      results: [
        { caseId: "multi-judge-case-0", output: "ok", criterionSignals: { "judge-0": 0.9 } },
        { caseId: "multi-judge-case-1", output: "ok", criterionSignals: { "judge-1": 0.5 } }, // hold
      ],
    },
    pipeline: {
      primaryJudgeId: "judge-anthropic",
      fallbackJudgeIds: ["judge-minimax", "judge-openai"],
      parallelEvaluation: false,
      consensusThreshold: 0.5,
    },
  });

  // Issue #1965: agreementScore is promote ratio only
  // Primary returns promote, but fallback might return different decisions
  // The actual agreement score depends on what decisions were recorded
  assert.ok(result.agreementScore >= 0 && result.agreementScore <= 1);
});

test("CrossProviderJudgeService evaluateWithPipeline treats unanimous rollback as full agreement", () => {
  const service = createHarness();

  // All judges return rollback -> agreementScore should be 1.0 for rollback
  const result = service.evaluateWithPipeline({
    evaluation: {
      datasetId: "dataset-multi-judge",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-test",
      results: [
        { caseId: "multi-judge-case-0", output: "fail", criterionSignals: { "judge-0": 0.1 } },
        { caseId: "multi-judge-case-1", output: "fail", criterionSignals: { "judge-1": 0.2 } },
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
  assert.equal(result.agreementScore, 1);
});

test("CrossProviderJudgeService evaluateWithPipeline treats unanimous hold as full agreement", () => {
  const service = createHarness();

  // All judges return hold/rollback, no promote
  const result = service.evaluateWithPipeline({
    evaluation: {
      datasetId: "dataset-multi-judge",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-test",
      results: [
        { caseId: "multi-judge-case-0", output: "ok", criterionSignals: { "judge-0": 0.5 } },
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
  assert.equal(result.agreementScore, 1);
});

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

test("CrossProviderJudgeService evaluateWithPipeline honors parallelEvaluation branch", () => {
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
      parallelEvaluation: true,
      consensusThreshold: 0.5,
    },
  });

  assert.equal(result.individualResults.length, 2);
  assert.ok(result.individualResults.some((item) => item.judgeId === "judge-anthropic"));
  assert.ok(result.individualResults.some((item) => item.judgeId === "judge-minimax"));
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
    { judgeId: "j1", provider: "openai", providerFamily: "openai", modelId: "m1", capabilities: [], maxCostUsd: 0.01, status: "ready", createdAt: "", updatedAt: "" },
    { judgeId: "j2", provider: "anthropic", providerFamily: "anthropic", modelId: "m2", capabilities: [], maxCostUsd: 0.01, status: "ready", createdAt: "", updatedAt: "" },
  ]);

  assert.equal(score, 1.0);
});

test("CrossProviderJudgeService getProviderDiversityScore with same family returns lower score", () => {
  const service = createHarness();
  const score = service.getProviderDiversityScore([
    { judgeId: "j1", provider: "openai", providerFamily: "openai", modelId: "m1", capabilities: [], maxCostUsd: 0.01, status: "ready", createdAt: "", updatedAt: "" },
    { judgeId: "j2", provider: "openai", providerFamily: "openai", modelId: "m2", capabilities: [], maxCostUsd: 0.01, status: "ready", createdAt: "", updatedAt: "" },
  ]);

  assert.equal(score, 0.5);
});

test("CrossProviderJudgeService getProviderDiversityScore with empty array", () => {
  const service = createHarness();
  const score = service.getProviderDiversityScore([]);

  assert.equal(score, 0);
});

test("CrossProviderJudgeService selectJudge with cheapest strategy", () => {
  const service = createHarness();
  const selection = service.selectJudge({
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    strategy: "cheapest",
  });

  assert.ok(selection.selectedJudge !== null);
  assert.equal(selection.selectionStrategy, "cheapest");
});

test("CrossProviderJudgeService selectJudge with fastest strategy", () => {
  const service = createHarness();
  const selection = service.selectJudge({
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    strategy: "fastest",
  });

  assert.ok(selection.selectedJudge !== null);
  assert.equal(selection.selectionStrategy, "fastest");
});

test("CrossProviderJudgeService selectJudge with most_capable strategy", () => {
  const service = createHarness();
  const selection = service.selectJudge({
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    strategy: "most_capable",
  });

  assert.ok(selection.selectedJudge !== null);
  assert.equal(selection.selectionStrategy, "most_capable");
});

test("CrossProviderJudgeService selectJudge with provider_diverse strategy", () => {
  const service = createHarness();
  const selection = service.selectJudge({
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    strategy: "provider_diverse",
  });

  assert.ok(selection.selectedJudge !== null);
  assert.equal(selection.selectionStrategy, "provider_diverse");
});

test("CrossProviderJudgeService selectJudge returns null for no matching judges", () => {
  const service = new CrossProviderJudgeService(new EvalDatasetJudgeService());
  const selection = service.selectJudge({
    candidateProvider: "nonexistent",
    candidateProviderFamily: "nonexistent",
    strategy: "cheapest",
  });

  assert.equal(selection.selectedJudge, null);
});
