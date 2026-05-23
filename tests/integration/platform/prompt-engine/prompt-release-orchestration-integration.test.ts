import assert from "node:assert/strict";
import test from "node:test";

import { EvalDatasetJudgeService, type EvalDatasetCase } from "../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";
import { PromptTemplateRegistryService } from "../../../../src/platform/prompt-engine/registry/index.js";
import { PromptRolloutService } from "../../../../src/platform/prompt-engine/rollout/index.js";
import { PlatformPromptReleaseOrchestrationService } from "../../../../src/platform/prompt-engine/rollout/platform-prompt-release-orchestration-service.js";

test("integration: platform prompt release uses dataset gate, judge assignment, and rollout activation", () => {
  const datasets = new EvalDatasetJudgeService();
  const cases: EvalDatasetCase[] = [
    {
      caseId: "safe_answer",
      input: { request: "describe rollback" },
      expectedOutput: "rollback plan",
      tags: ["release", "safety"],
      priority: "standard",
      qualityCriteria: [
        {
          criterionId: "contains_rollback",
          type: "contains",
          config: { substring: "rollback plan" },
          weight: 0.4,
          threshold: 1,
        },
        {
          criterionId: "judge_safety",
          type: "llm_judge",
          config: { rubric: "safe operational answer" },
          weight: 0.6,
          threshold: 0.85,
        },
      ],
    },
    ...Array.from({ length: 49 }, (_, i): EvalDatasetCase => ({
      caseId: `case_${i + 2}`,
      input: { request: `test request ${i + 2}` },
      expectedOutput: `expected output ${i + 2}`,
      tags: ["release", "safety"],
      priority: "standard",
      qualityCriteria: [
        {
          criterionId: `contains_rollback_${i + 2}`,
          type: "contains",
          config: { substring: "test" },
          weight: 0.4,
          threshold: 1,
        },
        {
          criterionId: `judge_safety_${i + 2}`,
          type: "llm_judge",
          config: { rubric: "safe operational answer" },
          weight: 0.6,
          threshold: 0.85,
        },
      ],
    })),
  ];
  datasets.registerDataset({
    datasetId: "dataset_release_readiness",
    name: "Release Readiness",
    version: "2026.04",
    stage: "assess",
    createdBy: "quality",
    cases,
  });
  datasets.activateDataset("dataset_release_readiness");
  datasets.registerJudge({
    judgeId: "judge_anthropic_release",
    provider: "anthropic",
    providerFamily: "anthropic",
    modelId: "claude-judge",
    maxCostUsd: 0.03,
  });

  const service = new PlatformPromptReleaseOrchestrationService(
    new PromptTemplateRegistryService(),
    datasets,
    new PromptRolloutService(),
  );
  const result = service.createRelease({
    template: {
      templateKey: "release_operator",
      version: "v2",
      owner: "release@example.com",
      fixedPrefix: "Never skip safety gates",
      domainBlock: "Release operations",
      variableSuffixTemplate: "Task: {{task}}",
      variableSpecs: [{ key: "task", required: true }],
    },
    datasetId: "dataset_release_readiness",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-release",
    owner: "release@example.com",
    mode: "L2_shadow",
    domainBlockCompatible: true,
    autoActivate: true,
    domainOwnerApproval: true,
    rollbackPlanPresent: true,
    results: [
      {
        caseId: "safe_answer",
        output: "rollback plan with audit evidence and manual approval",
        latencyMs: 90,
        costUsd: 0.004,
        criterionSignals: { judge_safety: 0.92, contains_rollback: 1 },
      },
      ...Array.from({ length: 49 }, (_, i) => ({
        caseId: `case_${i + 2}`,
        output: `test output ${i + 2}`,
        latencyMs: 100 + i,
        costUsd: 0.005,
        criterionSignals: {
          [`contains_rollback_${i + 2}`]: 1,
          [`judge_safety_${i + 2}`]: 0.9,
        },
      })),
    ],
  });

  assert.equal(result.evaluationReport.gateDecision, "promote");
  assert.equal(result.evaluationReport.judgeId, "judge_anthropic_release");
  assert.equal(result.rollout.status, "stable");
  assert.equal(datasets.listReports("dataset_release_readiness").length, 1);
});
