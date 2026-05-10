import assert from "node:assert/strict";
import test from "node:test";

import { EvalDatasetJudgeService } from "../../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";
import { CrossProviderJudgeService } from "../../../../../src/platform/prompt-engine/eval/cross-provider-judge-service.js";
import { JudgeProviderRegistryService } from "../../../../../src/platform/prompt-engine/eval/judge-provider-registry-service.js";
import type { EvalDatasetCase, EvalCasePriority } from "../../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";

function generateStandardCases(count: number, prefix: string): EvalDatasetCase[] {
  const cases: EvalDatasetCase[] = [];
  for (let i = 0; i < count; i++) {
    cases.push({
      caseId: `${prefix}case-${i}`,
      input: { query: `test query ${i}` },
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

function createFullHarness() {
  const judgeService = new EvalDatasetJudgeService();
  const registry = new JudgeProviderRegistryService();
  const crossProvider = new CrossProviderJudgeService(judgeService);

  registry.registerDefaults();

  judgeService.registerDataset({
    datasetId: "cross-int-ds",
    name: "Cross Provider Integration",
    version: "1.0.0",
    stage: "assess",
    createdBy: "integration",
    cases: generateStandardCases(25, "cpi-"),
  });
  judgeService.activateDataset("cross-int-ds");

  judgeService.registerJudge({
    judgeId: "judge.anthropic.int",
    provider: "anthropic",
    providerFamily: "anthropic",
    modelId: "claude-sonnet",
    maxCostUsd: 0.01,
    status: "ready",
  });

  judgeService.registerJudge({
    judgeId: "judge.minimax.int",
    provider: "minimax",
    providerFamily: "minimax",
    modelId: "m1",
    maxCostUsd: 0.005,
    status: "ready",
  });

  return { judgeService, registry, crossProvider };
}

test("CrossProviderJudgeService integration: full multi-judge pipeline", () => {
  const { crossProvider } = createFullHarness();

  const selection = crossProvider.selectJudge({
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    strategy: "cheapest",
  });

  assert.ok(selection.selectedJudge);
  assert.equal(selection.candidateProvider, "openai");

  const report = crossProvider.evaluateWithCrossProviderJudge({
    datasetId: "cross-int-ds",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-4",
    results: [
      { caseId: "cpi-case-0", output: "ok", criterionSignals: { "judge-0": 0.9 } },
      { caseId: "cpi-case-1", output: "ok", criterionSignals: { "judge-1": 0.8 } },
      { caseId: "cpi-case-2", output: "ok", criterionSignals: { "judge-2": 0.85 } },
      { caseId: "cpi-case-3", output: "ok", criterionSignals: { "judge-3": 0.9 } },
      { caseId: "cpi-case-4", output: "ok", criterionSignals: { "judge-4": 0.88 } },
      { caseId: "cpi-case-5", output: "ok", criterionSignals: { "judge-5": 0.92 } },
      { caseId: "cpi-case-6", output: "ok", criterionSignals: { "judge-6": 0.87 } },
      { caseId: "cpi-case-7", output: "ok", criterionSignals: { "judge-7": 0.91 } },
      { caseId: "cpi-case-8", output: "ok", criterionSignals: { "judge-8": 0.89 } },
      { caseId: "cpi-case-9", output: "ok", criterionSignals: { "judge-9": 0.9 } },
      { caseId: "cpi-case-10", output: "ok", criterionSignals: { "judge-10": 0.88 } },
      { caseId: "cpi-case-11", output: "ok", criterionSignals: { "judge-11": 0.86 } },
      { caseId: "cpi-case-12", output: "ok", criterionSignals: { "judge-12": 0.9 } },
      { caseId: "cpi-case-13", output: "ok", criterionSignals: { "judge-13": 0.87 } },
      { caseId: "cpi-case-14", output: "ok", criterionSignals: { "judge-14": 0.91 } },
      { caseId: "cpi-case-15", output: "ok", criterionSignals: { "judge-15": 0.89 } },
      { caseId: "cpi-case-16", output: "ok", criterionSignals: { "judge-16": 0.9 } },
      { caseId: "cpi-case-17", output: "ok", criterionSignals: { "judge-17": 0.88 } },
      { caseId: "cpi-case-18", output: "ok", criterionSignals: { "judge-18": 0.92 } },
      { caseId: "cpi-case-19", output: "ok", criterionSignals: { "judge-19": 0.87 } },
      { caseId: "cpi-case-20", output: "ok", criterionSignals: { "judge-20": 0.91 } },
      { caseId: "cpi-case-21", output: "ok", criterionSignals: { "judge-21": 0.89 } },
      { caseId: "cpi-case-22", output: "ok", criterionSignals: { "judge-22": 0.9 } },
      { caseId: "cpi-case-23", output: "ok", criterionSignals: { "judge-23": 0.88 } },
      { caseId: "cpi-case-24", output: "ok", criterionSignals: { "judge-24": 0.87 } },
    ],
  });

  assert.equal(report.gateDecision, "promote");
  assert.ok(report.judgeId);
});

test("CrossProviderJudgeService integration: pipeline with multiple judges", () => {
  const { crossProvider } = createFullHarness();

  const pipelineResult = crossProvider.evaluateWithPipeline({
    evaluation: {
      datasetId: "cross-int-ds",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-4",
      results: [
        { caseId: "cpi-case-0", output: "ok", criterionSignals: { "judge-0": 0.9 } },
        { caseId: "cpi-case-1", output: "ok", criterionSignals: { "judge-1": 0.8 } },
        { caseId: "cpi-case-2", output: "ok", criterionSignals: { "judge-2": 0.85 } },
        { caseId: "cpi-case-3", output: "ok", criterionSignals: { "judge-3": 0.9 } },
        { caseId: "cpi-case-4", output: "ok", criterionSignals: { "judge-4": 0.88 } },
        { caseId: "cpi-case-5", output: "ok", criterionSignals: { "judge-5": 0.92 } },
        { caseId: "cpi-case-6", output: "ok", criterionSignals: { "judge-6": 0.87 } },
        { caseId: "cpi-case-7", output: "ok", criterionSignals: { "judge-7": 0.91 } },
        { caseId: "cpi-case-8", output: "ok", criterionSignals: { "judge-8": 0.89 } },
        { caseId: "cpi-case-9", output: "ok", criterionSignals: { "judge-9": 0.9 } },
        { caseId: "cpi-case-10", output: "ok", criterionSignals: { "judge-10": 0.88 } },
        { caseId: "cpi-case-11", output: "ok", criterionSignals: { "judge-11": 0.86 } },
        { caseId: "cpi-case-12", output: "ok", criterionSignals: { "judge-12": 0.9 } },
        { caseId: "cpi-case-13", output: "ok", criterionSignals: { "judge-13": 0.87 } },
        { caseId: "cpi-case-14", output: "ok", criterionSignals: { "judge-14": 0.91 } },
        { caseId: "cpi-case-15", output: "ok", criterionSignals: { "judge-15": 0.89 } },
        { caseId: "cpi-case-16", output: "ok", criterionSignals: { "judge-16": 0.9 } },
        { caseId: "cpi-case-17", output: "ok", criterionSignals: { "judge-17": 0.88 } },
        { caseId: "cpi-case-18", output: "ok", criterionSignals: { "judge-18": 0.92 } },
        { caseId: "cpi-case-19", output: "ok", criterionSignals: { "judge-19": 0.87 } },
        { caseId: "cpi-case-20", output: "ok", criterionSignals: { "judge-20": 0.91 } },
        { caseId: "cpi-case-21", output: "ok", criterionSignals: { "judge-21": 0.89 } },
        { caseId: "cpi-case-22", output: "ok", criterionSignals: { "judge-22": 0.9 } },
        { caseId: "cpi-case-23", output: "ok", criterionSignals: { "judge-23": 0.88 } },
        { caseId: "cpi-case-24", output: "ok", criterionSignals: { "judge-24": 0.87 } },
      ],
    },
    pipeline: {
      primaryJudgeId: "judge.anthropic.int",
      fallbackJudgeIds: ["judge.minimax.int"],
      parallelEvaluation: true,
      consensusThreshold: 0.5,
    },
  });

  assert.equal(pipelineResult.individualResults.length, 2);
  assert.equal(pipelineResult.consensusDecision, "promote");
});

test("CrossProviderJudgeService integration: suggestMultipleJudges with different strategies", () => {
  const { crossProvider } = createFullHarness();

  const cheapest = crossProvider.suggestMultipleJudges({
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    maxJudges: 2,
  });

  assert.ok(cheapest.length <= 2);

  const diverse = crossProvider.selectJudge({
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    strategy: "provider_diverse",
  });

  assert.ok(diverse.selectedJudge !== null || diverse.alternativeJudges.length === 0);
});

test("CrossProviderJudgeService integration: provider diversity scoring", () => {
  const { crossProvider, judgeService } = createFullHarness();

  judgeService.registerJudge({
    judgeId: "judge.google",
    provider: "google",
    providerFamily: "google",
    modelId: "gemini",
    maxCostUsd: 0.008,
    status: "ready",
  });

  const judges = judgeService.suggestJudges({
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
  });

  const diversityScore = crossProvider.getProviderDiversityScore(judges);
  assert.ok(diversityScore >= 0 && diversityScore <= 1);
});

test("JudgeProviderRegistryService integration: sync with EvalDatasetJudgeService judges", () => {
  const { judgeService, registry } = createFullHarness();

  const profile = {
    judgeId: "sync.int.judge",
    provider: "syncprov",
    providerFamily: "syncfam",
    modelId: "sync-model",
    capabilities: ["llm_judge", "policy_audit"],
    supportedRiskLevels: ["critical", "high", "medium", "low"] as const,
    maxCostUsd: 0.12,
    status: "ready" as const,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const descriptor = registry.syncJudgeProfile(profile, {
    trustScore: 0.88,
    latencyTier: "low" as const,
    isolationLevel: "cross_family_preferred" as const,
  });

  assert.equal(descriptor.providerId, "sync.int.judge");
  assert.equal(descriptor.trustScore, 0.88);
  assert.deepEqual(descriptor.supportedCapabilities, ["llm_judge", "policy_audit"]);

  const selected = registry.selectDescriptor({
    capability: "policy_audit",
    candidateProviderFamily: "openai",
  });

  assert.ok(selected);
  assert.equal(selected!.providerId, "sync.int.judge");
});

test("CrossProviderJudgeService integration: evaluateWithPipeline with no ready judges returns hold", () => {
  const judgeService = new EvalDatasetJudgeService();
  const crossProvider = new CrossProviderJudgeService(judgeService);

  judgeService.registerDataset({
    datasetId: "empty-judge-ds",
    name: "Empty Judge Dataset",
    version: "1.0.0",
    stage: "assess",
    createdBy: "test",
    cases: generateStandardCases(25, "ej-"),
  });
  judgeService.activateDataset("empty-judge-ds");

  const result = crossProvider.evaluateWithPipeline({
    evaluation: {
      datasetId: "empty-judge-ds",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-test",
      results: [{ caseId: "ej-case-0", output: "ok", criterionSignals: { "judge-0": 0.9 } }],
    },
    pipeline: {
      primaryJudgeId: "nonexistent-judge",
      fallbackJudgeIds: [],
      parallelEvaluation: false,
      consensusThreshold: 0.5,
    },
  });

  assert.equal(result.consensusDecision, "hold");
  assert.ok(result.blockingFindings.includes("no_judges_available"));
});