import assert from "node:assert/strict";
import test from "node:test";

import { DomainTaskDesignService } from "../../../src/domains/domain-task-design-service.js";

test("integration: domain support modules flow into a single domain task design decision", () => {
  const service = new DomainTaskDesignService({
    recipes: [
      {
        recipeId: "recipe_bugfix",
        name: "Bugfix Recipe",
        domainId: "coding",
        triggerPhrases: ["bug"],
        archetype: "incident_ops",
        risk_profile_ref: "risk_coding",
        guardrail_overlay: "standard",
        default_prompt_bundle_ref: "prompt_bugfix",
        acceptance_checklist_ref: "check_bugfix",
        defaultWorkflowId: "wf_bugfix",
        defaultToolBundleIds: ["repo_tools", "test_tools"],
        riskLevel: "low",
        recommended_workflow_ids: [],
        requiredApproval: false,
      },
    ],
    promptLibrary: {
      libraryId: "prompt_lib",
      domainId: "coding",
      prompts: [
        {
          promptId: "prompt_bugfix",
          stage: "execute",
          version: "1",
          template: "Fix bug carefully",
          guardrails: ["tests_required"],
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
      fewShotExamples: [],
      evaluators: [
        { evaluatorId: "tests_pass", metric: "tests_pass", threshold: 0.9, blocking: true },
      ],
      onlineMetrics: [],
      releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
    },
    knowledgeSchema: {
      schemaId: "knowledge_coding",
      domainId: "coding",
      namespaceIds: ["repo"],
      freshnessWindowHours: 24,
      conflictResolution: "trust_priority",
      retentionDays: 30,
      knowledgeSources: [],
      retrievalStrategy: { strategy: "semantic" as const, maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
      freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled" as const, backgroundRefreshEnabled: true },
    },
  });

  const design = service.design({
    domainId: "coding",
    taskType: "implement",
    userInput: "fix bug in release flow",
    promptId: "prompt_bugfix",
    riskScore: 70,
  });

  assert.equal(design.workflowId, "wf_bugfix");
  assert.equal(design.prompt?.promptId, "prompt_bugfix");
  assert.equal(design.reviewRequired, true);
});
