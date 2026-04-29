import assert from "node:assert/strict";
import test from "node:test";

import { DomainTaskDesignService } from "../../../src/domains/domain-task-design-service.js";
import type {
  DomainTaskDesign,
  DomainTaskDesignRequest,
  DomainTaskDesignServiceOptions,
} from "../../../src/domains/domain-task-design-service.js";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makePromptTemplate(overrides = {}) {
  return {
    promptId: "prompt_test",
    stage: "execute" as const,
    version: "1.0.0",
    template: "Test template content",
    guardrails: [] as string[],
    ...overrides,
  };
}

function makeOptions(overrides: Partial<DomainTaskDesignServiceOptions> = {}) {
  return {
    recipes: [
      {
        recipeId: "recipe_crud",
        domainId: "coding",
        triggerPhrases: ["create", "update", "delete", "crud"],
        defaultWorkflowId: "wf_crud",
        defaultToolBundleIds: [],
      },
      {
        recipeId: "recipe_analytics",
        domainId: "data-engineering",
        triggerPhrases: ["analyze", "query", "report", "analytics"],
        defaultWorkflowId: "wf_analytics",
        defaultToolBundleIds: [],
      },
    ],
    promptLibrary: {
      libraryId: "lib_coding",
      domainId: "coding",
      prompts: [
        makePromptTemplate({ promptId: "prompt_v1", version: "1.0.0" }),
        makePromptTemplate({ promptId: "prompt_v2", version: "2.0.0" }),
        makePromptTemplate({ promptId: "prompt_v3", version: "3.0.0-beta" }),
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
        { evaluatorId: "blocker_1", metric: "quality", threshold: 0.9, blocking: true },
        { evaluatorId: "non_blocker_1", metric: "coverage", threshold: 0.7, blocking: false },
      ],
      onlineMetrics: [],
      releaseGates: {
        minFewShotCount: 5,
        minRegressionCaseCount: 20,
        requirePromptInjectionCoverage: true,
      },
    },
    knowledgeSchema: {
      schemaId: "ks_coding",
      domainId: "coding",
      namespaceIds: ["namespace_a", "namespace_b"],
      freshnessWindowHours: 24,
      conflictResolution: "trust_priority",
      retentionDays: 30,
      knowledgeSources: [],
      retrievalStrategy: {
        strategy: "semantic",
        maxResults: 10,
        minRelevanceScore: 0.7,
        rerankEnabled: false,
      },
      freshnessPolicy: {
        maxStalenessHours: 24,
        refreshTrigger: "scheduled",
        backgroundRefreshEnabled: true,
      },
    },
    interactionRules: [
      {
        sourceDomainId: "coding",
        targetDomainId: "operations",
        mode: "approval_required",
        maxConcurrentWorkflows: 1,
        compensationRequired: true,
      },
      {
        sourceDomainId: "coding",
        targetDomainId: "data-engineering",
        mode: "allow",
        maxConcurrentWorkflows: 5,
        compensationRequired: false,
      },
    ],
    ...overrides,
  } as DomainTaskDesignServiceOptions;
}

// ---------------------------------------------------------------------------
// 1. Task design template creation
// ---------------------------------------------------------------------------

test("design creates a DomainTaskDesign with all required fields", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "create a new feature",
    promptId: "prompt_v1",
    riskScore: 25,
  });

  assert.equal(result.domainId, "coding");
  assert.equal(result.taskType, "analyze");
  assert.equal(result.recipeId, "recipe_crud");
  assert.equal(result.workflowId, "wf_crud");
  assert.notEqual(result.prompt, null);
  assert.equal(result.prompt?.promptId, "prompt_v1");
  assert.equal(result.riskLevel, "low");
  assert.equal(result.reviewRequired, false);
  assert.deepEqual(result.blockingEvaluatorIds, ["blocker_1"]);
  assert.deepEqual(result.knowledgeNamespaces, ["namespace_a", "namespace_b"]);
  assert.equal(result.interactionMode, "same_domain");
  assert.ok(Array.isArray(result.decisionSummary));
});

test("design returns null prompt when promptId not found", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "analyze something",
    promptId: "nonexistent_prompt",
    riskScore: 20,
  });

  assert.equal(result.prompt, null);
  assert.equal(result.decisionSummary.find((s) => s.startsWith("prompt=")), "prompt=none");
});

test("design returns null recipe when no trigger phrase matches", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "do something unrelated to any trigger",
    promptId: "prompt_v1",
    riskScore: 20,
  });

  assert.equal(result.recipeId, null);
  assert.equal(result.workflowId, null);
  assert.equal(result.decisionSummary.find((s) => s.startsWith("workflow=")), "workflow=none");
});

test("design resolves recipe by trigger phrase case-insensitively", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "CREATE a new resource",
    promptId: "prompt_v1",
    riskScore: 20,
  });

  assert.equal(result.recipeId, "recipe_crud");
  assert.equal(result.workflowId, "wf_crud");
});

test("design uses default interaction rules when none provided", () => {
  const opts = makeOptions({ interactionRules: undefined });
  const service = new DomainTaskDesignService(opts);

  const result = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "analyze data",
    promptId: "prompt_v1",
    riskScore: 20,
    targetDomainId: "unknown_domain",
  });

  assert.equal(result.interactionMode, "deny");
});

// ---------------------------------------------------------------------------
// 2. Domain-specific task patterns
// ---------------------------------------------------------------------------

test("design handles coding domain analyze task type", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "analyze the codebase",
    promptId: "prompt_v1",
    riskScore: 20,
  });

  assert.equal(result.domainId, "coding");
  assert.equal(result.taskType, "analyze");
  assert.equal(result.reviewRequired, false);
});

test("design handles coding domain plan task type", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "coding",
    taskType: "plan",
    userInput: "plan the migration",
    promptId: "prompt_v1",
    riskScore: 30,
  });

  assert.equal(result.taskType, "plan");
  assert.equal(result.reviewRequired, false);
});

test("design handles coding domain implement task type (requires review)", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "coding",
    taskType: "implement",
    userInput: "implement the feature",
    promptId: "prompt_v1",
    riskScore: 40,
  });

  assert.equal(result.taskType, "implement");
  assert.equal(result.reviewRequired, true);
});

test("design handles coding domain test task type", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "coding",
    taskType: "test",
    userInput: "test the changes",
    promptId: "prompt_v1",
    riskScore: 25,
  });

  assert.equal(result.taskType, "test");
  assert.equal(result.reviewRequired, false);
});

test("design handles coding domain review task type", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "coding",
    taskType: "review",
    userInput: "review the code",
    promptId: "prompt_v1",
    riskScore: 35,
  });

  assert.equal(result.taskType, "review");
  assert.equal(result.reviewRequired, false);
});

test("design handles coding domain release task type (requires review)", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "coding",
    taskType: "release",
    userInput: "release the package",
    promptId: "prompt_v1",
    riskScore: 80,
  });

  assert.equal(result.taskType, "release");
  assert.equal(result.reviewRequired, true);
});

test("design respects domain-specific recipe for different domain", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "data-engineering",
    taskType: "analyze",
    userInput: "analyze the data warehouse",
    promptId: "prompt_v1",
    riskScore: 20,
  });

  assert.equal(result.recipeId, "recipe_analytics");
  assert.equal(result.workflowId, "wf_analytics");
});

test("design handles non-coding domain with high risk requiring review", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "finance",
    taskType: "reconcile",
    userInput: "reconcile accounts",
    promptId: "prompt_v1",
    riskScore: 75,
  });

  assert.equal(result.riskLevel, "high");
  assert.equal(result.reviewRequired, true);
});

test("design handles critical risk regardless of domain", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "marketing",
    taskType: "send_campaign",
    userInput: "send marketing email",
    promptId: "prompt_v1",
    riskScore: 90,
  });

  assert.equal(result.riskLevel, "critical");
  assert.equal(result.reviewRequired, true);
});

// ---------------------------------------------------------------------------
// 3. Task output schema validation
// ---------------------------------------------------------------------------

test("design returns valid DomainTaskDesign interface fields", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "coding",
    taskType: "implement",
    userInput: "implement feature",
    promptId: "prompt_v1",
    riskScore: 45,
  });

  // Validate all required DomainTaskDesign fields
  assert.equal(typeof result.domainId, "string");
  assert.equal(typeof result.taskType, "string");
  assert.ok(result.recipeId === null || typeof result.recipeId === "string");
  assert.ok(result.workflowId === null || typeof result.workflowId === "string");
  assert.ok(result.prompt === null || typeof result.prompt === "object");
  assert.ok(["low", "medium", "high", "critical"].includes(result.riskLevel));
  assert.equal(typeof result.reviewRequired, "boolean");
  assert.ok(Array.isArray(result.blockingEvaluatorIds));
  assert.ok(Array.isArray(result.knowledgeNamespaces));
  assert.ok(["allow", "approval_required", "deny", "same_domain"].includes(result.interactionMode));
  assert.ok(Array.isArray(result.decisionSummary));
});

test("design returns blockingEvaluatorIds containing only strings", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "coding",
    taskType: "implement",
    userInput: "implement feature",
    promptId: "prompt_v1",
    riskScore: 45,
  });

  assert.ok(result.blockingEvaluatorIds.every((id) => typeof id === "string"));
});

test("design returns knowledgeNamespaces as deduplicated string array", () => {
  const opts = makeOptions();
  opts.knowledgeSchema.namespaceIds = ["ns_1", "ns_2", "ns_1"];
  const service = new DomainTaskDesignService(opts);

  const result = service.design({
    domainId: "coding",
    taskType: "implement",
    userInput: "implement feature",
    promptId: "prompt_v1",
    riskScore: 45,
    additionalNamespaceIds: ["ns_2", "ns_3"],
  });

  assert.deepEqual(result.knowledgeNamespaces, ["ns_1", "ns_2", "ns_3"]);
});

test("design decisionSummary contains expected keys", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "coding",
    taskType: "implement",
    userInput: "implement feature",
    promptId: "prompt_v1",
    riskScore: 45,
  });

  assert.ok(result.decisionSummary.some((s) => s.startsWith("risk=")));
  assert.ok(result.decisionSummary.some((s) => s.startsWith("workflow=")));
  assert.ok(result.decisionSummary.some((s) => s.startsWith("prompt=")));
  assert.ok(result.decisionSummary.some((s) => s.startsWith("interaction=")));
});

test("design interactionMode is one of the valid modes", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const cases: Array<{ targetDomainId: string | null; expected: DomainTaskDesign["interactionMode"] }> = [
    { targetDomainId: null, expected: "same_domain" },
    { targetDomainId: "coding", expected: "same_domain" },
    { targetDomainId: "data-engineering", expected: "allow" },
    { targetDomainId: "operations", expected: "approval_required" },
    { targetDomainId: "security", expected: "deny" },
  ];

  for (const { targetDomainId, expected } of cases) {
    const result = service.design({
      domainId: "coding",
      taskType: "implement",
      userInput: "implement feature",
      promptId: "prompt_v1",
      riskScore: 45,
      targetDomainId,
    });
    assert.equal(result.interactionMode, expected, `targetDomainId=${targetDomainId}`);
  }
});

test("design correctly populates prompt template fields when resolved", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "coding",
    taskType: "implement",
    userInput: "implement feature",
    promptId: "prompt_v2",
    riskScore: 45,
  });

  assert.notEqual(result.prompt, null);
  assert.equal(result.prompt?.promptId, "prompt_v2");
  assert.equal(result.prompt?.version, "2.0.0");
  assert.equal(result.prompt?.stage, "execute");
  assert.ok(Array.isArray(result.prompt?.guardrails));
});

// ---------------------------------------------------------------------------
// 4. Task template versioning
// ---------------------------------------------------------------------------

test("design resolves prompt by exact version match", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "coding",
    taskType: "implement",
    userInput: "implement feature",
    promptId: "prompt_v2",
    riskScore: 45,
  });

  assert.equal(result.prompt?.promptId, "prompt_v2");
  assert.equal(result.prompt?.version, "2.0.0");
});

test("design resolves beta version prompt", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "coding",
    taskType: "implement",
    userInput: "implement feature",
    promptId: "prompt_v3",
    riskScore: 45,
  });

  assert.equal(result.prompt?.promptId, "prompt_v3");
  assert.equal(result.prompt?.version, "3.0.0-beta");
});

test("design returns null prompt when version not found", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "coding",
    taskType: "implement",
    userInput: "implement feature",
    promptId: "prompt_v99",
    riskScore: 45,
  });

  assert.equal(result.prompt, null);
});

test("design passes through version in decision summary", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "coding",
    taskType: "implement",
    userInput: "implement feature",
    promptId: "prompt_v2",
    riskScore: 45,
  });

  const promptLine = result.decisionSummary.find((s) => s.startsWith("prompt="));
  assert.equal(promptLine, "prompt=prompt_v2");
});

test("design returns null version string in decision summary when no prompt", () => {
  const service = new DomainTaskDesignService(makeOptions());

  const result = service.design({
    domainId: "coding",
    taskType: "implement",
    userInput: "implement feature",
    promptId: "nonexistent",
    riskScore: 45,
  });

  const promptLine = result.decisionSummary.find((s) => s.startsWith("prompt="));
  assert.equal(promptLine, "prompt=none");
});

test("design uses default options when optional fields omitted", () => {
  const minimalOptions: DomainTaskDesignServiceOptions = {
    recipes: [],
    promptLibrary: { libraryId: "lib", domainId: "coding", prompts: [] },
    riskProfile: { profileId: "rp", domainId: "coding", defaultRiskLevel: "low", dimensions: [] },
    evalFramework: {
      frameworkId: "ef",
      domainId: "coding",
      fewShotExamples: [],
      evaluators: [],
      onlineMetrics: [],
      releaseGates: { minFewShotCount: 0, minRegressionCaseCount: 0, requirePromptInjectionCoverage: false },
    },
    knowledgeSchema: {
      schemaId: "ks",
      domainId: "coding",
      namespaceIds: [],
      freshnessWindowHours: 24,
      conflictResolution: "trust_priority",
      retentionDays: 30,
      knowledgeSources: [],
    },
  };

  const service = new DomainTaskDesignService(minimalOptions);

  const result = service.design({
    domainId: "coding",
    taskType: "analyze",
    userInput: "analyze",
    promptId: "any_prompt",
    riskScore: 10,
  });

  assert.equal(result.reviewRequired, false);
  assert.deepEqual(result.blockingEvaluatorIds, []);
  assert.deepEqual(result.knowledgeNamespaces, []);
});

// ---------------------------------------------------------------------------
// Risk score boundary tests
// ---------------------------------------------------------------------------

test("design maps risk score 0-34 to low", () => {
  const service = new DomainTaskDesignService(makeOptions());

  for (const score of [0, 10, 20, 34]) {
    const result = service.design({
      domainId: "coding",
      taskType: "analyze",
      userInput: "analyze",
      promptId: "prompt_v1",
      riskScore: score,
    });
    assert.equal(result.riskLevel, "low", `score=${score}`);
  }
});

test("design maps risk score 35-64 to medium", () => {
  const service = new DomainTaskDesignService(makeOptions());

  for (const score of [35, 50, 64]) {
    const result = service.design({
      domainId: "coding",
      taskType: "analyze",
      userInput: "analyze",
      promptId: "prompt_v1",
      riskScore: score,
    });
    assert.equal(result.riskLevel, "medium", `score=${score}`);
  }
});

test("design maps risk score 65-84 to high", () => {
  const service = new DomainTaskDesignService(makeOptions());

  for (const score of [65, 70, 84]) {
    const result = service.design({
      domainId: "coding",
      taskType: "analyze",
      userInput: "analyze",
      promptId: "prompt_v1",
      riskScore: score,
    });
    assert.equal(result.riskLevel, "high", `score=${score}`);
  }
});

test("design maps risk score 85+ to critical", () => {
  const service = new DomainTaskDesignService(makeOptions());

  for (const score of [85, 90, 100]) {
    const result = service.design({
      domainId: "coding",
      taskType: "analyze",
      userInput: "analyze",
      promptId: "prompt_v1",
      riskScore: score,
    });
    assert.equal(result.riskLevel, "critical", `score=${score}`);
  }
});
