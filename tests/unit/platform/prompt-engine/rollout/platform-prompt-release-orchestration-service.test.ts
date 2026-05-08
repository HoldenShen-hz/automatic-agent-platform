import assert from "node:assert/strict";
import test from "node:test";

import { EvalDatasetJudgeService } from "../../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";
import { PromptTemplateRegistryService } from "../../../../../src/platform/prompt-engine/registry/index.js";
import { PromptRolloutService } from "../../../../../src/platform/prompt-engine/rollout/index.js";
import { PlatformPromptReleaseOrchestrationService } from "../../../../../src/platform/prompt-engine/rollout/platform-prompt-release-orchestration-service.js";

function createDatasetService(): EvalDatasetJudgeService {
  const datasets = new EvalDatasetJudgeService();
  datasets.registerDataset({
    datasetId: "dataset_ops_release",
    name: "Ops Prompt Release",
    version: "1",
    stage: "assess",
    createdBy: "quality",
    cases: [
      {
        caseId: "incident_summary",
        input: { incident: "cpu high" },
        expectedOutput: "incident summary",
        tags: ["ops"],
        priority: "critical",
        qualityCriteria: [
          {
            criterionId: "contains_summary",
            type: "contains",
            config: { substring: "incident summary" },
            weight: 0.5,
            threshold: 1,
          },
          {
            criterionId: "judge_safe",
            type: "llm_judge",
            config: {},
            weight: 0.5,
            threshold: 0.8,
          },
        ],
      },
    ],
  });
  datasets.activateDataset("dataset_ops_release");
  datasets.registerJudge({
    judgeId: "judge_vertex_ops",
    provider: "google",
    providerFamily: "google",
    modelId: "gemini-judge",
    maxCostUsd: 0.02,
  });
  return datasets;
}

test("PlatformPromptReleaseOrchestrationService activates rollout after dataset gate passes", () => {
  const service = new PlatformPromptReleaseOrchestrationService(
    new PromptTemplateRegistryService(),
    createDatasetService(),
    new PromptRolloutService(),
  );

  const result = service.createRelease({
    template: {
      templateKey: "ops_triage",
      version: "v3",
      owner: "ops@example.com",
      fixedPrefix: "System guardrails",
      domainBlock: "Operations domain",
      variableSuffixTemplate: "Incident: {{incident}}",
      variableSpecs: [{ key: "incident", required: true }],
    },
    datasetId: "dataset_ops_release",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-release",
    owner: "ops@example.com",
    mode: "shadow",
    domainBlockCompatible: true,
    autoActivate: true,
    results: [
      {
        caseId: "incident_summary",
        output: "incident summary with safe next steps",
        criterionSignals: { judge_safe: 0.93 },
      },
    ],
  });

  assert.equal(result.evaluationReport.gateDecision, "promote");
  assert.equal(result.rollout.status, "active");
  assert.equal(result.rollout.regressionSuiteId, result.evaluationReport.runId);
  assert.equal(result.judge?.judgeId, "judge_vertex_ops");
});

test("PlatformPromptReleaseOrchestrationService keeps rollout blocked when gate holds", () => {
  const service = new PlatformPromptReleaseOrchestrationService(
    new PromptTemplateRegistryService(),
    createDatasetService(),
    new PromptRolloutService(),
  );

  const result = service.createRelease({
    template: {
      templateKey: "ops_triage",
      version: "v4",
      owner: "ops@example.com",
      fixedPrefix: "System guardrails",
      domainBlock: "Operations domain",
    },
    datasetId: "dataset_ops_release",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-release",
    owner: "ops@example.com",
    mode: "shadow",
    domainBlockCompatible: true,
    autoActivate: true,
    results: [
      {
        caseId: "incident_summary",
        output: "unrelated answer",
        criterionSignals: { judge_safe: 0.3 },
      },
    ],
  });

  assert.equal(result.evaluationReport.gateDecision, "hold");
  assert.equal(result.rollout.status, "blocked");
  assert.equal(result.rollout.guardrailSummary, "regression_gate_failed");
});
