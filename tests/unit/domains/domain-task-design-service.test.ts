import assert from "node:assert/strict";
import test from "node:test";

import { DomainTaskDesignService } from "../../../src/domains/domain-task-design-service.js";

function createDefaultOptions() {
  return {
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
      fewShotExamples: [],
      evaluators: [
        { evaluatorId: "tests_pass", metric: "tests_pass", threshold: 0.95, blocking: true },
        { evaluatorId: "docs_sync", metric: "docs_sync", threshold: 0.8, blocking: false },
      ],
      onlineMetrics: ["latency"],
      releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
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
  };
}

test("DomainTaskDesignService assembles recipe, prompt, risk, evaluation, and interaction decisions", () => {
  const service = new DomainTaskDesignService(createDefaultOptions());

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

test("DomainTaskDesignService returns null workflow and prompt when no match", () => {
  const options = createDefaultOptions();
  options.recipes = [];
  options.promptLibrary.prompts = [];

  const service = new DomainTaskDesignService(options);

  const design = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "analyze this",
    promptId: "unknown_prompt",
    riskScore: 10,
  });

  assert.equal(design.workflowId, null);
  assert.equal(design.prompt, null);
});

test("DomainTaskDesignService computes low risk for low score", () => {
  const service = new DomainTaskDesignService(createDefaultOptions());

  const design = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "analyze this",
    promptId: "prompt_release",
    riskScore: 20,
  });

  assert.equal(design.riskLevel, "low");
});

test("DomainTaskDesignService computes medium risk for medium score", () => {
  const service = new DomainTaskDesignService(createDefaultOptions());

  const design = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "analyze this",
    promptId: "prompt_release",
    riskScore: 50,
  });

  assert.equal(design.riskLevel, "medium");
});

test("DomainTaskDesignService computes high risk for high score", () => {
  const service = new DomainTaskDesignService(createDefaultOptions());

  const design = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "analyze this",
    promptId: "prompt_release",
    riskScore: 70,
  });

  assert.equal(design.riskLevel, "high");
});

test("DomainTaskDesignService returns same_domain for same domain interaction", () => {
  const service = new DomainTaskDesignService(createDefaultOptions());

  const design = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "analyze this",
    promptId: "prompt_release",
    riskScore: 20,
    targetDomainId: "coding",
  });

  assert.equal(design.interactionMode, "same_domain");
});

test("DomainTaskDesignService returns allow for cross-domain when rule allows", () => {
  const options = createDefaultOptions();
  options.interactionRules = [
    {
      sourceDomainId: "coding",
      targetDomainId: "data-engineering",
      mode: "allow",
      maxConcurrentWorkflows: 5,
      compensationRequired: false,
    },
  ];

  const service = new DomainTaskDesignService(options);

  const design = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "analyze this",
    promptId: "prompt_release",
    riskScore: 20,
    targetDomainId: "data-engineering",
  });

  assert.equal(design.interactionMode, "allow");
});

test("DomainTaskDesignService returns deny when no matching rule", () => {
  const options = createDefaultOptions();
  options.interactionRules = [
    {
      sourceDomainId: "coding",
      targetDomainId: "security",
      mode: "deny",
      maxConcurrentWorkflows: 1,
      compensationRequired: false,
    },
  ];

  const service = new DomainTaskDesignService(options);

  const design = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "analyze this",
    promptId: "prompt_release",
    riskScore: 20,
    targetDomainId: "operations", // no rule for coding -> operations
  });

  assert.equal(design.interactionMode, "deny");
});

test("DomainTaskDesignService sets reviewRequired for high risk", () => {
  const options = createDefaultOptions();
  options.riskProfile = {
    profileId: "risk_coding",
    domainId: "coding",
    defaultRiskLevel: "medium",
    dimensions: [],
  };

  const service = new DomainTaskDesignService(options);

  const design = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "analyze this",
    promptId: "prompt_release",
    riskScore: 70,
  });

  assert.equal(design.reviewRequired, true);
});

test("DomainTaskDesignService sets reviewRequired for critical risk", () => {
  const service = new DomainTaskDesignService(createDefaultOptions());

  const design = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "analyze this",
    promptId: "prompt_release",
    riskScore: 90,
  });

  assert.equal(design.reviewRequired, true);
});

test("DomainTaskDesignService sets reviewRequired for approval_required interaction mode", () => {
  const service = new DomainTaskDesignService(createDefaultOptions());

  const design = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "analyze this",
    promptId: "prompt_release",
    riskScore: 20,
    targetDomainId: "operations", // has approval_required rule
  });

  assert.equal(design.reviewRequired, true);
});

test("DomainTaskDesignService does not require review for low risk same domain", () => {
  const options = createDefaultOptions();
  options.interactionRules = [];
  options.evalFramework.evaluators = [];

  const service = new DomainTaskDesignService(options);

  const design = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "analyze this",
    promptId: "prompt_release",
    riskScore: 20,
    targetDomainId: null,
  });

  assert.equal(design.reviewRequired, false);
});

test("DomainTaskDesignService handles no interaction rules", () => {
  const options = createDefaultOptions();
  options.interactionRules = [];

  const service = new DomainTaskDesignService(options);

  const design = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "analyze this",
    promptId: "prompt_release",
    riskScore: 20,
    targetDomainId: "operations",
  });

  assert.equal(design.interactionMode, "deny"); // defaults to deny when no rule
});

test("DomainTaskDesignService includes decision summary", () => {
  const service = new DomainTaskDesignService(createDefaultOptions());

  const design = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "analyze this",
    promptId: "prompt_release",
    riskScore: 20,
  });

  assert.ok(design.decisionSummary.length > 0);
  assert.ok(design.decisionSummary.some((s) => s.startsWith("risk=")));
  assert.ok(design.decisionSummary.some((s) => s.startsWith("workflow=")));
  assert.ok(design.decisionSummary.some((s) => s.startsWith("prompt=")));
  assert.ok(design.decisionSummary.some((s) => s.startsWith("interaction=")));
});

test("DomainTaskDesignService merges additional namespace ids", () => {
  const service = new DomainTaskDesignService(createDefaultOptions());

  const design = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "analyze this",
    promptId: "prompt_release",
    riskScore: 20,
    additionalNamespaceIds: ["extra_ns_1", "extra_ns_2"],
  });

  assert.ok(design.knowledgeNamespaces.includes("extra_ns_1"));
  assert.ok(design.knowledgeNamespaces.includes("extra_ns_2"));
});

test("DomainTaskDesignService dedupes knowledge namespaces", () => {
  const service = new DomainTaskDesignService(createDefaultOptions());

  const design = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "analyze this",
    promptId: "prompt_release",
    riskScore: 20,
    additionalNamespaceIds: ["repo", "extra"],
  });

  const repoCount = design.knowledgeNamespaces.filter((ns) => ns === "repo").length;
  assert.equal(repoCount, 1);
});