import assert from "node:assert/strict";
import test from "node:test";

import { DomainTaskDesignService } from "../../../src/domains/domain-task-design-service.js";

test("DomainTaskDesignService assembles recipe, prompt, risk, evaluation, and interaction decisions", () => {
  const service = new DomainTaskDesignService({
    recipes: [
      {
        recipeId: "recipe_release",
        domainId: "coding",
        triggerPhrases: ["release"],
        defaultWorkflowId: "wf_release",
        defaultToolBundleIds: ["repo_tools"],
      },
    ],
    promptLibrary: {
      libraryId: "prompt_lib_coding",
      domainId: "coding",
      prompts: [
        {
          promptId: "prompt_release",
          stage: "execute",
          version: "1.0",
          template: "Release safely",
          guardrails: ["approval_required"],
        },
      ],
    },
    riskProfile: {
      profileId: "risk_coding",
      domainId: "coding",
      defaultRiskLevel: "low",
      dimensions: [],
    },
    evalFramework: {
      frameworkId: "eval_coding",
      domainId: "coding",
      evaluators: [
        { evaluatorId: "tests_pass", metric: "tests_pass", threshold: 0.95, blocking: true },
        { evaluatorId: "docs_sync", metric: "docs_sync", threshold: 0.8, blocking: false },
      ],
      onlineMetrics: ["latency"],
    },
    knowledgeSchema: {
      schemaId: "knowledge_coding",
      domainId: "coding",
      namespaceIds: ["repo", "runbook"],
      freshnessWindowHours: 24,
      conflictResolution: "trust_priority",
      retentionDays: 30,
      knowledgeSources: [],
      retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
      freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
    },
    interactionRules: [
      {
        sourceDomainId: "coding",
        targetDomainId: "operations",
        mode: "approval_required",
        maxConcurrentWorkflows: 1,
        compensationRequired: true,
      },
    ],
  });

  const design = service.design({
    domainId: "coding",
    taskType: "release",
    userInput: "prepare release package",
    promptId: "prompt_release",
    riskScore: 88,
    additionalNamespaceIds: ["change_log"],
    targetDomainId: "operations",
  });

  assert.equal(design.workflowId, "wf_release");
  assert.equal(design.prompt?.promptId, "prompt_release");
  assert.equal(design.riskLevel, "critical");
  assert.equal(design.reviewRequired, true);
  assert.deepEqual(design.blockingEvaluatorIds, ["tests_pass"]);
  assert.deepEqual(design.knowledgeNamespaces, ["repo", "runbook", "change_log"]);
  assert.equal(design.interactionMode, "approval_required");
});
