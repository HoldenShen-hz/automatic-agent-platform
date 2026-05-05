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
    cases: Array.from({ length: 20 }, (_, index) => ({
      caseId: `incident_summary_${index + 1}`,
      input: { incident: `cpu high ${index + 1}` },
      expectedOutput: "incident summary",
      tags: ["ops"],
      priority: "standard" as const,
      qualityCriteria: [
        {
          criterionId: "contains_summary",
          type: "contains" as const,
          config: { substring: "incident summary" },
          weight: 0.5,
          threshold: 1,
        },
        {
          criterionId: "judge_safe",
          type: "llm_judge" as const,
          config: {},
          weight: 0.5,
          threshold: 0.8,
        },
      ],
    })),
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

test("PlatformPromptReleaseOrchestrationService keeps rollout at canary_5 when autoActivate lacks verified approval", () => {
  const service = new PlatformPromptReleaseOrchestrationService(
    new PromptTemplateRegistryService(),
    createDatasetService(),
    new PromptRolloutService(),
  );

  const result = service.createRelease({
    template: {
      templateKey: "ops_triage",
      version: 3,
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
    results: Array.from({ length: 20 }, (_, index) => ({
      caseId: `incident_summary_${index + 1}`,
      output: "incident summary with safe next steps",
      criterionSignals: { judge_safe: 0.93 },
    })),
  });

  assert.equal(result.evaluationReport.gateDecision, "promote");
  assert.equal(result.rollout.status, "canary_5");
  assert.equal(result.rollout.guardrailSummary, "shadow_guardrail_passed");
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
      version: 4,
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
    results: Array.from({ length: 20 }, (_, index) => ({
      caseId: `incident_summary_${index + 1}`,
      output: "unrelated answer",
      criterionSignals: { judge_safe: 0.3 },
    })),
  });

  assert.equal(result.evaluationReport.gateDecision, "hold");
  assert.equal(result.rollout.status, "blocked");
  assert.equal(result.rollout.guardrailSummary, "regression_gate_failed");
});

test("PlatformPromptReleaseOrchestrationService does not bypass hold gate even when autoActivate approvals are present", () => {
  const service = new PlatformPromptReleaseOrchestrationService(
    new PromptTemplateRegistryService(),
    createDatasetService(),
    new PromptRolloutService(),
  );

  const result = service.createRelease({
    template: {
      templateKey: "ops_triage",
      version: 5,
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
    domainOwnerApproval: true,
    approverUserId: "ops@example.com",
    rollbackPlanPresent: true,
    results: Array.from({ length: 20 }, (_, index) => ({
      caseId: `incident_summary_${index + 1}`,
      output: "still unrelated",
      criterionSignals: { judge_safe: 0.2 },
    })),
  });

  assert.equal(result.evaluationReport.gateDecision, "hold");
  assert.equal(result.rollout.status, "blocked");
});
