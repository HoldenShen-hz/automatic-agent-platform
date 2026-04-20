import assert from "node:assert/strict";
import test from "node:test";

import { DomainTaskDesignService } from "../../../src/domains/domain-task-design-service.js";

test("integration: domain support modules flow into a single domain task design decision", () => {
  const service = new DomainTaskDesignService({
    recipes: [
      {
        recipeId: "recipe_bugfix",
        domainId: "coding",
        triggerPhrases: ["bug"],
        defaultWorkflowId: "wf_bugfix",
        defaultToolBundleIds: ["repo_tools", "test_tools"],
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
      evaluators: [
        { evaluatorId: "tests_pass", metric: "tests_pass", threshold: 0.9, blocking: true },
      ],
      onlineMetrics: [],
    },
    knowledgeSchema: {
      schemaId: "knowledge_coding",
      domainId: "coding",
      namespaceIds: ["repo"],
      freshnessWindowHours: 24,
      conflictResolution: "trust_priority",
      retentionDays: 30,
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
