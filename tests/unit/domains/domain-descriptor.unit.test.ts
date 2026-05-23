import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainDescriptorOrchestrationService,
  type DomainDescriptorInput,
} from "../../../src/domains/domain-descriptor-orchestration-service.js";

function createPrompt(promptId: string, stage: "plan" | "execute" | "assess", template: string) {
  return { promptId, stage, version: "1.0", template, guardrails: [] };
}

function createRecipe(recipeId: string, triggerPhrases: string[], defaultWorkflowId: string, defaultToolBundleIds: string[]) {
  return {
    recipeId,
    name: recipeId,
    archetype: "crud_heavy" as const,
    domainId: "test-domain",
    description: `${recipeId} description`,
    riskProfileRef: "test-domain.risk",
    guardrailOverlay: {},
    triggerPhrases,
    defaultWorkflowId,
    recommendedWorkflowIds: [defaultWorkflowId],
    defaultToolBundleIds,
    defaultPromptBundleRef: "test-domain.default-prompt",
    acceptanceChecklistRef: "test-domain.acceptance",
  };
}

function createMinimalInput(overrides: Partial<DomainDescriptorInput> = {}): DomainDescriptorInput {
  return {
    domainId: "test-domain",
    displayName: "Test Domain",
    description: "A test domain",
    ownerOrgNodeId: "org.test",
    lifecycleState: "draft",
    version: 1,
    riskProfile: {
      profileId: "risk-test",
      domainId: "test-domain",
      defaultRiskLevel: "medium",
      dimensions: [],
    },
    knowledgeSchema: {
      schemaId: "knowledge-test",
      domainId: "test-domain",
      namespaceIds: [],
      freshnessWindowHours: 24,
      conflictResolution: "trust_priority",
      retentionDays: 30,
      knowledgeSources: [],
      retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
      freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
    },
    evalFramework: {
      frameworkId: "eval-test",
      domainId: "test-domain",
      fewShotExamples: [],
      evaluators: [],
      onlineMetrics: [],
      releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
    },
    promptLibrary: {
      libraryId: "prompt-test",
      domainId: "test-domain",
      prompts: [],
    },
    recipes: [],
    defaultToolBundleIds: [],
    defaultWorkflowIds: [],
    ...overrides,
  };
}

test("DomainDescriptorOrchestrationService.review returns ready when all requirements are met", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({
    defaultWorkflowIds: ["wf-1"],
    defaultToolBundleIds: ["bundle-1"],
    promptLibrary: {
      libraryId: "prompt-test",
      domainId: "test-domain",
      prompts: [createPrompt("p1", "plan", "Test")],
    },
    evalFramework: {
      frameworkId: "eval-test",
      domainId: "test-domain",
      fewShotExamples: [],
      evaluators: [{ evaluatorId: "e1", metric: "accuracy", threshold: 0.9, blocking: true }],
      onlineMetrics: [],
      releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
    },
    recipes: [createRecipe("r1", ["test"], "wf-1", ["bundle-1"])],
    knowledgeSchema: {
      schemaId: "knowledge-test",
      domainId: "test-domain",
      namespaceIds: ["ns-1"],
      freshnessWindowHours: 24,
      conflictResolution: "trust_priority",
      retentionDays: 30,
      knowledgeSources: [],
      retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
      freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
    },
  });

  const review = service.review(input);

  assert.strictEqual(review.onboardingReadiness, "ready");
  assert.deepStrictEqual(review.findings, []);
});

test("DomainDescriptorOrchestrationService.review flags missing default workflow", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({ defaultWorkflowIds: [] });

  const review = service.review(input);

  assert.ok(review.findings.includes("domain_descriptor.default_workflow_missing"));
});

test("DomainDescriptorOrchestrationService.review flags missing default tool bundle", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({ defaultToolBundleIds: [] });

  const review = service.review(input);

  assert.ok(review.findings.includes("domain_descriptor.default_tool_bundle_missing"));
});

test("DomainDescriptorOrchestrationService.review flags missing prompts", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({
    promptLibrary: {
      libraryId: "prompt-test",
      domainId: "test-domain",
      prompts: [],
    },
  });

  const review = service.review(input);

  assert.ok(review.findings.includes("domain_descriptor.prompt_stage_missing"));
});

test("DomainDescriptorOrchestrationService.review flags missing blocking evaluators", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({
    evalFramework: {
      frameworkId: "eval-test",
      domainId: "test-domain",
      fewShotExamples: [],
      evaluators: [],
      onlineMetrics: [],
      releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
    },
  });

  const review = service.review(input);

  assert.ok(review.findings.includes("domain_descriptor.blocking_evaluator_missing"));
});

test("DomainDescriptorOrchestrationService.review flags missing knowledge namespace", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({
    knowledgeSchema: {
      schemaId: "knowledge-test",
      domainId: "test-domain",
      namespaceIds: [],
      freshnessWindowHours: 24,
      conflictResolution: "trust_priority",
      retentionDays: 30,
      knowledgeSources: [],
      retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
      freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
    },
  });

  const review = service.review(input);

  assert.ok(review.findings.includes("domain_descriptor.knowledge_namespace_missing"));
});

test("DomainDescriptorOrchestrationService.review flags missing recipes", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({ recipes: [] });

  const review = service.review(input);

  assert.ok(review.findings.includes("domain_descriptor.recipe_missing"));
});

test("DomainDescriptorOrchestrationService.review flags incomplete meta model", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({ metaModelCompleteness: 75 });

  const review = service.review(input);

  assert.ok(review.findings.some((f: string) => f.includes("domain_descriptor.meta_model_incomplete")));
});

test("DomainDescriptorOrchestrationService.review flags missing meta model questions", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({
    metaModelMissingQuestionIds: ["Q5_decision_scope", "Q6_risk_hotspots"],
  });

  const review = service.review(input);

  assert.ok(review.findings.some((f: string) => f.includes("domain_descriptor.meta_model_missing:Q5")));
  assert.ok(review.findings.some((f: string) => f.includes("domain_descriptor.meta_model_missing:Q6")));
});

test("DomainDescriptorOrchestrationService.review flags high risk active domain without canary history", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({
    lifecycleState: "active",
    riskProfile: {
      profileId: "risk-test",
      domainId: "test-domain",
      defaultRiskLevel: "critical",
      dimensions: [],
    },
  });

  const review = service.review(input);

  assert.ok(review.findings.includes("domain_descriptor.high_risk_active_requires_registered_release_evidence"));
});

test("DomainDescriptorOrchestrationService.review does not flag high risk non-active domain", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({
    lifecycleState: "canary",
    riskProfile: {
      profileId: "risk-test",
      domainId: "test-domain",
      defaultRiskLevel: "critical",
      dimensions: [],
    },
  });

  const review = service.review(input);

  assert.ok(!review.findings.includes("domain_descriptor.high_risk_active_requires_registered_release_evidence"));
});

test("DomainDescriptorOrchestrationService.review determines onboardingReadiness as needs_evidence when findings contain missing", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({
    defaultWorkflowIds: [],
    recipes: [],
  });

  const review = service.review(input);

  assert.strictEqual(review.onboardingReadiness, "needs_evidence");
});

test("DomainDescriptorOrchestrationService.review determines onboardingReadiness as blocked when findings do not contain missing", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({
    lifecycleState: "active",
    defaultWorkflowIds: ["wf-1"],
    defaultToolBundleIds: ["bundle-1"],
    promptLibrary: {
      libraryId: "prompt-test",
      domainId: "test-domain",
      prompts: [createPrompt("p1", "plan", "Test")],
    },
    evalFramework: {
      frameworkId: "eval-test",
      domainId: "test-domain",
      fewShotExamples: [],
      evaluators: [{ evaluatorId: "e1", metric: "accuracy", threshold: 0.9, blocking: true }],
      onlineMetrics: [],
      releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
    },
    recipes: [createRecipe("r1", ["test"], "wf-1", ["bundle-1"])],
    knowledgeSchema: {
      schemaId: "knowledge-test",
      domainId: "test-domain",
      namespaceIds: ["ns-1"],
      freshnessWindowHours: 24,
      conflictResolution: "trust_priority",
      retentionDays: 30,
      knowledgeSources: [],
      retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
      freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
    },
    riskProfile: {
      profileId: "risk-test",
      domainId: "test-domain",
      defaultRiskLevel: "critical",
      dimensions: [],
    },
  });

  const review = service.review(input);

  assert.strictEqual(review.onboardingReadiness, "blocked");
});

test("DomainDescriptorOrchestrationService.review lists blocking evaluator IDs from eval framework", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({
    evalFramework: {
      frameworkId: "eval-test",
      domainId: "test-domain",
      fewShotExamples: [],
      evaluators: [
        { evaluatorId: "eval-1", metric: "accuracy", threshold: 0.9, blocking: true },
        { evaluatorId: "eval-2", metric: "latency", threshold: 0.8, blocking: false },
        { evaluatorId: "eval-3", metric: "safety", threshold: 0.95, blocking: true },
      ],
      onlineMetrics: [],
      releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
    },
  });

  const review = service.review(input);

  assert.deepStrictEqual(review.blockingEvaluatorIds, ["eval-1", "eval-3"]);
});

test("DomainDescriptorOrchestrationService.review lists prompt IDs and stage coverage from prompt library", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({
    promptLibrary: {
      libraryId: "prompt-test",
      domainId: "test-domain",
      prompts: [
        createPrompt("plan-prompt", "plan", "Plan"),
        createPrompt("execute-prompt", "execute", "Execute"),
        createPrompt("assess-prompt", "assess", "Assess"),
      ],
    },
  });

  const review = service.review(input);

  assert.deepStrictEqual(review.promptIds, ["plan-prompt", "execute-prompt", "assess-prompt"]);
  assert.deepStrictEqual(review.promptStageCoverage, ["plan", "execute", "assess"]);
});

test("DomainDescriptorOrchestrationService.review lists recipe IDs from recipes", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({
    recipes: [
      createRecipe("recipe-1", ["test"], "wf-1", []),
      createRecipe("recipe-2", ["run"], "wf-2", []),
    ],
  });

  const review = service.review(input);

  assert.deepStrictEqual(review.recipeIds, ["recipe-1", "recipe-2"]);
});

test("DomainDescriptorOrchestrationService.review lists default knowledge namespaces from schema", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({
    knowledgeSchema: {
      schemaId: "knowledge-test",
      domainId: "test-domain",
      namespaceIds: ["ns-alpha", "ns-beta"],
      freshnessWindowHours: 24,
      conflictResolution: "trust_priority",
      retentionDays: 30,
      knowledgeSources: [],
      retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
      freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
    },
  });

  const review = service.review(input);

  assert.deepStrictEqual(review.defaultKnowledgeNamespaces, ["ns-alpha", "ns-beta"]);
});

test("DomainDescriptorOrchestrationService.review builds cross-domain modes from interaction rules", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({
    interactionRules: [
      { sourceDomainId: "domain-a", targetDomainId: "domain-b", mode: "approval_required", maxConcurrentWorkflows: 1, compensationRequired: true },
      { sourceDomainId: "domain-a", targetDomainId: "domain-c", mode: "approval_required", maxConcurrentWorkflows: 5, compensationRequired: false },
    ],
  });

  const review = service.review(input);

  assert.strictEqual(review.crossDomainModes["domain-a->domain-b"], "approval_required");
  assert.strictEqual(review.crossDomainModes["domain-a->domain-c"], "approval_required");
});

test("DomainDescriptorOrchestrationService.review returns empty cross-domain modes when no interaction rules", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({});

  const review = service.review(input);

  assert.deepStrictEqual(review.crossDomainModes, {});
});

test("DomainDescriptorOrchestrationService.buildOnboardingChecklist returns checklist with all phases", () => {
  const service = new DomainDescriptorOrchestrationService();
  const checklist = service.buildOnboardingChecklist("test-domain");

  assert.strictEqual(checklist.domainId, "test-domain");
  assert.strictEqual(checklist.phases.length, 4);

  const phaseNames = checklist.phases.map((p: { phase: string }) => p.phase);
  assert.ok(phaseNames.includes("domain_modeling"));
  assert.ok(phaseNames.includes("pack_development"));
  assert.ok(phaseNames.includes("security_certification"));
  assert.ok(phaseNames.includes("gray_rollout"));
});

test("DomainDescriptorOrchestrationService.buildOnboardingChecklist includes required evidence for each phase", () => {
  const service = new DomainDescriptorOrchestrationService();
  const checklist = service.buildOnboardingChecklist("test-domain");

  const modelingPhase = checklist.phases.find((p: { phase: string }) => p.phase === "domain_modeling");
  assert.ok(modelingPhase);
  assert.ok(modelingPhase.requiredEvidence.includes("descriptor"));
  assert.ok(modelingPhase.requiredEvidence.includes("risk_profile"));
  assert.ok(modelingPhase.requiredEvidence.includes("knowledge_schema"));

  const devPhase = checklist.phases.find((p: { phase: string }) => p.phase === "pack_development");
  assert.ok(devPhase);
  assert.ok(devPhase.requiredEvidence.includes("domain_lint"));
  assert.ok(devPhase.requiredEvidence.includes("workflow_validation"));
  assert.ok(devPhase.requiredEvidence.includes("eval_framework"));
  assert.ok(devPhase.requiredEvidence.includes("prompt_library"));

  const securityPhase = checklist.phases.find((p: { phase: string }) => p.phase === "security_certification");
  assert.ok(securityPhase);
  assert.ok(securityPhase.requiredEvidence.includes("security_review"));
  assert.ok(securityPhase.requiredEvidence.includes("interaction_policy"));
  assert.ok(securityPhase.requiredEvidence.includes("approval_path"));

  const canaryPhase = checklist.phases.find((p: { phase: string }) => p.phase === "gray_rollout");
  assert.ok(canaryPhase);
  assert.ok(canaryPhase.requiredEvidence.includes("rollout_metrics"));
  assert.ok(canaryPhase.requiredEvidence.includes("rollback_plan"));
  assert.ok(canaryPhase.requiredEvidence.includes("operator_signoff"));
});

test("DomainDescriptorOrchestrationService.buildOnboardingChecklist always uses the provided domainId", () => {
  const service = new DomainDescriptorOrchestrationService();
  const checklist = service.buildOnboardingChecklist("my-custom-domain");

  assert.strictEqual(checklist.domainId, "my-custom-domain");
});

test("DomainDescriptorOrchestrationService.review normalizes validating lifecycle state", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({
    lifecycleState: "validating",
    defaultWorkflowIds: ["wf-1"],
    defaultToolBundleIds: ["bundle-1"],
    promptLibrary: {
      libraryId: "prompt-test",
      domainId: "test-domain",
      prompts: [createPrompt("p1", "plan", "Test")],
    },
    evalFramework: {
      frameworkId: "eval-test",
      domainId: "test-domain",
      fewShotExamples: [],
      evaluators: [{ evaluatorId: "e1", metric: "accuracy", threshold: 0.9, blocking: true }],
      onlineMetrics: [],
      releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
    },
    recipes: [createRecipe("r1", ["test"], "wf-1", ["bundle-1"])],
    knowledgeSchema: {
      schemaId: "knowledge-test",
      domainId: "test-domain",
      namespaceIds: ["ns-1"],
      freshnessWindowHours: 24,
      conflictResolution: "trust_priority",
      retentionDays: 30,
      knowledgeSources: [],
      retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
      freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
    },
  });

  const review = service.review(input);

  assert.strictEqual(review.lifecycleState, "validated");
});

test("DomainDescriptorOrchestrationService.review normalizes canary lifecycle state", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({
    lifecycleState: "canary",
    defaultWorkflowIds: ["wf-1"],
    defaultToolBundleIds: ["bundle-1"],
    promptLibrary: {
      libraryId: "prompt-test",
      domainId: "test-domain",
      prompts: [createPrompt("p1", "plan", "Test")],
    },
    evalFramework: {
      frameworkId: "eval-test",
      domainId: "test-domain",
      fewShotExamples: [],
      evaluators: [{ evaluatorId: "e1", metric: "accuracy", threshold: 0.9, blocking: true }],
      onlineMetrics: [],
      releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
    },
    recipes: [createRecipe("r1", ["test"], "wf-1", ["bundle-1"])],
    knowledgeSchema: {
      schemaId: "knowledge-test",
      domainId: "test-domain",
      namespaceIds: ["ns-1"],
      freshnessWindowHours: 24,
      conflictResolution: "trust_priority",
      retentionDays: 30,
      knowledgeSources: [],
      retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
      freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
    },
  });

  const review = service.review(input);

  assert.strictEqual(review.lifecycleState, "registered");
});

test("DomainDescriptorOrchestrationService.review includes reviewRequiredTaskTypes for high risk domains", () => {
  const service = new DomainDescriptorOrchestrationService();
  const input = createMinimalInput({
    riskProfile: {
      profileId: "risk-test",
      domainId: "test-domain",
      defaultRiskLevel: "high",
      dimensions: [],
    },
    defaultWorkflowIds: ["wf-1"],
    defaultToolBundleIds: ["bundle-1"],
    promptLibrary: {
      libraryId: "prompt-test",
      domainId: "test-domain",
      prompts: [createPrompt("p1", "plan", "Test")],
    },
    evalFramework: {
      frameworkId: "eval-test",
      domainId: "test-domain",
      fewShotExamples: [],
      evaluators: [{ evaluatorId: "e1", metric: "accuracy", threshold: 0.9, blocking: true }],
      onlineMetrics: [],
      releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
    },
    recipes: [createRecipe("r1", ["test"], "wf-1", ["bundle-1"])],
    knowledgeSchema: {
      schemaId: "knowledge-test",
      domainId: "test-domain",
      namespaceIds: ["ns-1"],
      freshnessWindowHours: 24,
      conflictResolution: "trust_priority",
      retentionDays: 30,
      knowledgeSources: [],
      retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
      freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
    },
  });

  const review = service.review(input);

  assert.ok(review.reviewRequiredTaskTypes.includes("release"));
  assert.ok(review.reviewRequiredTaskTypes.includes("production_change"));
});
