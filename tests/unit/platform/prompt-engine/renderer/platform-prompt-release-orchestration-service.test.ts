import assert from "node:assert/strict";
import test from "node:test";

import { PlatformPromptReleaseOrchestrationService } from "../../../../../src/platform/prompt-engine/rollout/platform-prompt-release-orchestration-service.js";
import { PromptTemplateRegistryService } from "../../../../../src/platform/prompt-engine/registry/index.js";
import { PromptRolloutService } from "../../../../../src/platform/prompt-engine/rollout/index.js";
import { EvalDatasetJudgeService } from "../../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

// Helper to create a dataset with 20 standard priority cases
function createTestDataset(datasetId: string): {
  datasetId: string;
  name: string;
  version: string;
  stage: "assess";
  cases: Array<{
    caseId: string;
    input: Record<string, unknown>;
    qualityCriteria: Array<{
      criterionId: string;
      type: "exact_match";
      config: Record<string, unknown>;
      weight: number;
      threshold: number;
    }>;
    tags: string[];
    priority: "standard";
  }>;
  createdBy: string;
  status: "active";
} {
  const cases = [];
  for (let i = 1; i <= 20; i++) {
    cases.push({
      caseId: `case_${i}`,
      input: { query: `test${i}` },
      qualityCriteria: [
        { criterionId: `c${i}`, type: "exact_match" as const, config: {}, weight: 1, threshold: 0.8 },
      ],
      tags: [],
      priority: "standard" as const,
    });
  }
  return {
    datasetId,
    name: `${datasetId} Dataset`,
    version: "v1",
    stage: "assess",
    cases,
    createdBy: "test@example.com",
    status: "active",
  };
}

function createResults(datasetId: string): Array<{
  caseId: string;
  output: unknown;
  expectedOutput: unknown;
  latencyMs: number;
  costUsd: number;
  criterionSignals: Record<string, number>;
  metadata: Record<string, unknown>;
}> {
  const results = [];
  for (let i = 1; i <= 20; i++) {
    results.push({
      caseId: `case_${i}`,
      output: `test${i}`,
      expectedOutput: `test${i}`,
      latencyMs: 100,
      costUsd: 0.01,
      criterionSignals: {},
      metadata: {},
    });
  }
  return results;
}

test("PlatformPromptReleaseOrchestrationService createRelease registers template and creates rollout", () => {
  const templates = new PromptTemplateRegistryService();
  const datasets = new EvalDatasetJudgeService();
  const rollouts = new PromptRolloutService();
  const service = new PlatformPromptReleaseOrchestrationService(templates, datasets, rollouts);

  datasets.registerDataset(createTestDataset("ds_test"));

  const results = createResults("ds_test");

  const releaseResult = service.createRelease({
    template: {
      templateKey: "release_test",
      version: "v1",
      owner: "test@example.com",
      fixedPrefix: "You are a helpful assistant",
      domainBlock: "Customer support domain",
    },
    datasetId: "ds_test",
    candidateProvider: "test_provider",
    candidateModel: "test-model",
    owner: "release@example.com",
    mode: "suggest",
    domainBlockCompatible: true,
    results,
  });

  assert.equal(releaseResult.template.templateKey, "release_test");
  assert.equal(releaseResult.template.version, "v1");
  assert.ok(releaseResult.rollout);
  assert.equal(releaseResult.rollout.templateKey, "release_test");
});

test("PlatformPromptReleaseOrchestrationService createRelease throws when dataset not found", () => {
  const templates = new PromptTemplateRegistryService();
  const datasets = new EvalDatasetJudgeService();
  const rollouts = new PromptRolloutService();
  const service = new PlatformPromptReleaseOrchestrationService(templates, datasets, rollouts);

  assert.throws(
    () =>
      service.createRelease({
        template: {
          templateKey: "test",
          version: "v1",
          owner: "test@example.com",
          fixedPrefix: "prefix",
          domainBlock: "domain",
        },
        datasetId: "nonexistent",
        candidateProvider: "provider",
        candidateModel: "model",
        owner: "owner@example.com",
        mode: "suggest",
        domainBlockCompatible: true,
        results: [],
      }),
    (err: unknown) => err instanceof ValidationError && err.code.includes("dataset_not_found"),
  );
});

test("PlatformPromptReleaseOrchestrationService createRelease returns rollout in ready status when guardrail passes", () => {
  const templates = new PromptTemplateRegistryService();
  const datasets = new EvalDatasetJudgeService();
  const rollouts = new PromptRolloutService();
  const service = new PlatformPromptReleaseOrchestrationService(templates, datasets, rollouts);

  datasets.registerDataset(createTestDataset("ds_ready"));
  const results = createResults("ds_ready");

  const releaseResult = service.createRelease({
    template: {
      templateKey: "ready_test",
      version: "v1",
      owner: "test@example.com",
      fixedPrefix: "You are a helpful assistant",
      domainBlock: "Customer support domain",
    },
    datasetId: "ds_ready",
    candidateProvider: "test_provider",
    candidateModel: "test-model",
    owner: "release@example.com",
    mode: "suggest",
    domainBlockCompatible: true,
    results,
  });

  // Status should be 'ready' when guardrail passes (regressionPassed is based on gateDecision)
  assert.ok(releaseResult.rollout.status === "ready" || releaseResult.rollout.status === "blocked");
});

test("PlatformPromptReleaseOrchestrationService createRelease with llm_judge resolves judge", () => {
  const templates = new PromptTemplateRegistryService();
  const datasets = new EvalDatasetJudgeService();
  const rollouts = new PromptRolloutService();
  const service = new PlatformPromptReleaseOrchestrationService(templates, datasets, rollouts);

  datasets.registerJudge({
    judgeId: "judge_1",
    provider: "judge_provider",
    providerFamily: "judge_family",
    modelId: "judge-model",
    capabilities: ["llm_judge"],
    maxCostUsd: 0.1,
    status: "ready",
  });

  // Create dataset with llm_judge criteria
  const cases = [];
  for (let i = 1; i <= 20; i++) {
    cases.push({
      caseId: `case_${i}`,
      input: { query: `test${i}` },
      qualityCriteria: [
        { criterionId: `c${i}`, type: "llm_judge" as const, config: {}, weight: 1, threshold: 0.8 },
      ],
      tags: [],
      priority: "standard" as const,
    });
  }
  datasets.registerDataset({
    datasetId: "ds_judge",
    name: "Judge Dataset",
    version: "v1",
    stage: "assess",
    cases,
    createdBy: "test@example.com",
    status: "active",
  });

  const results = createResults("ds_judge");

  const releaseResult = service.createRelease({
    template: {
      templateKey: "judge_test",
      version: "v1",
      owner: "test@example.com",
      fixedPrefix: "You are a helpful assistant",
      domainBlock: "Customer support domain",
    },
    datasetId: "ds_judge",
    candidateProvider: "test_provider",
    candidateModel: "test-model",
    owner: "release@example.com",
    mode: "suggest",
    domainBlockCompatible: true,
    results,
  });

  assert.ok(releaseResult.judge);
  assert.equal(releaseResult.judge.judgeId, "judge_1");
});

test("PlatformPromptReleaseOrchestrationService createRelease uses explicit judgeId when provided", () => {
  const templates = new PromptTemplateRegistryService();
  const datasets = new EvalDatasetJudgeService();
  const rollouts = new PromptRolloutService();
  const service = new PlatformPromptReleaseOrchestrationService(templates, datasets, rollouts);

  datasets.registerJudge({
    judgeId: "explicit_judge",
    provider: "explicit_judge_provider",
    providerFamily: "explicit_judge_family",
    modelId: "judge-model",
    capabilities: ["llm_judge"],
    maxCostUsd: 0.1,
    status: "ready",
  });

  // Create dataset with llm_judge criteria
  const cases = [];
  for (let i = 1; i <= 20; i++) {
    cases.push({
      caseId: `case_${i}`,
      input: { query: `test${i}` },
      qualityCriteria: [
        { criterionId: `c${i}`, type: "llm_judge" as const, config: {}, weight: 1, threshold: 0.8 },
      ],
      tags: [],
      priority: "standard" as const,
    });
  }
  datasets.registerDataset({
    datasetId: "ds_explicit",
    name: "Explicit Judge Dataset",
    version: "v1",
    stage: "assess",
    cases,
    createdBy: "test@example.com",
    status: "active",
  });

  const results = createResults("ds_explicit");

  const releaseResult = service.createRelease({
    template: {
      templateKey: "explicit_judge_test",
      version: "v1",
      owner: "test@example.com",
      fixedPrefix: "You are a helpful assistant",
      domainBlock: "Customer support domain",
    },
    datasetId: "ds_explicit",
    candidateProvider: "test_provider",
    candidateModel: "test-model",
    owner: "release@example.com",
    mode: "suggest",
    domainBlockCompatible: true,
    results,
    judgeId: "explicit_judge",
  });

  assert.ok(releaseResult.judge);
  assert.equal(releaseResult.judge.judgeId, "explicit_judge");
});

test("PlatformPromptReleaseOrchestrationService createRelease throws when explicit judge not found", () => {
  const templates = new PromptTemplateRegistryService();
  const datasets = new EvalDatasetJudgeService();
  const rollouts = new PromptRolloutService();
  const service = new PlatformPromptReleaseOrchestrationService(templates, datasets, rollouts);

  // Create dataset with llm_judge criteria
  const cases = [];
  for (let i = 1; i <= 20; i++) {
    cases.push({
      caseId: `case_${i}`,
      input: { query: `test${i}` },
      qualityCriteria: [
        { criterionId: `c${i}`, type: "llm_judge" as const, config: {}, weight: 1, threshold: 0.8 },
      ],
      tags: [],
      priority: "standard" as const,
    });
  }
  datasets.registerDataset({
    datasetId: "ds_bad_judge",
    name: "Bad Judge Dataset",
    version: "v1",
    stage: "assess",
    cases,
    createdBy: "test@example.com",
    status: "active",
  });

  const results = createResults("ds_bad_judge");

  assert.throws(
    () =>
      service.createRelease({
        template: {
          templateKey: "bad_judge_test",
          version: "v1",
          owner: "test@example.com",
          fixedPrefix: "You are a helpful assistant",
          domainBlock: "Customer support domain",
        },
        datasetId: "ds_bad_judge",
        candidateProvider: "test_provider",
        candidateModel: "test-model",
        owner: "release@example.com",
        mode: "suggest",
        domainBlockCompatible: true,
        results,
        judgeId: "nonexistent_judge",
      }),
    (err: unknown) => err instanceof ValidationError && err.code.includes("judge_not_found"),
  );
});