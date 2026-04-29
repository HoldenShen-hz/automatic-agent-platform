import { test } from "node:test";
import assert from "node:assert/strict";
import { DomainDescriptorOrchestrationService } from "../../../src/domains/domain-descriptor-orchestration-service.js";
import type { DomainDescriptorInput } from "../../../src/domains/domain-descriptor-orchestration-service.js";

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

const service = new DomainDescriptorOrchestrationService();

// --- Domain Descriptor Creation ---

test("review returns domainId from input", () => {
  const input = createMinimalInput({ domainId: "my-domain" });
  const review = service.review(input);
  assert.strictEqual(review.domainId, "my-domain");
});

test("review returns ownerOrgNodeId from input", () => {
  const input = createMinimalInput({ ownerOrgNodeId: "org.acme" });
  const review = service.review(input);
  assert.strictEqual(review.ownerOrgNodeId, "org.acme");
});

test("review returns version from input", () => {
  const input = createMinimalInput({ version: 42 });
  const review = service.review(input);
  assert.strictEqual(review.version, undefined);
});

// --- Descriptor Validation ---

test("review returns ready when all requirements are met", () => {
  const input = createMinimalInput({
    defaultWorkflowIds: ["wf-1"],
    defaultToolBundleIds: ["bundle-1"],
    promptLibrary: {
      libraryId: "prompt-test",
      domainId: "test-domain",
      prompts: [{ promptId: "p1", stage: "plan", version: "1.0", template: "Test" }],
    },
    evalFramework: {
      frameworkId: "eval-test",
      domainId: "test-domain",
      fewShotExamples: [],
      evaluators: [{ evaluatorId: "e1", metric: "accuracy", threshold: 0.9, blocking: true }],
      onlineMetrics: [],
      releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
    },
    recipes: [{ recipeId: "r1", domainId: "test-domain", triggerPhrases: ["test"], defaultWorkflowId: "wf-1", defaultToolBundleIds: ["bundle-1"] }],
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

test("review flags missing default workflow", () => {
  const input = createMinimalInput({ defaultWorkflowIds: [] });
  const review = service.review(input);
  assert.ok(review.findings.includes("domain_descriptor.default_workflow_missing"));
});

test("review flags missing default tool bundle", () => {
  const input = createMinimalInput({ defaultToolBundleIds: [] });
  const review = service.review(input);
  assert.ok(review.findings.includes("domain_descriptor.default_tool_bundle_missing"));
});

test("review flags missing prompts", () => {
  const input = createMinimalInput({
    promptLibrary: { libraryId: "prompt-test", domainId: "test-domain", prompts: [] },
  });
  const review = service.review(input);
  assert.ok(review.findings.includes("domain_descriptor.prompt_stage_missing"));
});

test("review flags missing blocking evaluators", () => {
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

test("review flags missing knowledge namespace", () => {
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

test("review flags missing recipes", () => {
  const input = createMinimalInput({ recipes: [] });
  const review = service.review(input);
  assert.ok(review.findings.includes("domain_descriptor.recipe_missing"));
});

test("review flags incomplete meta model", () => {
  const input = createMinimalInput({ metaModelCompleteness: 75 });
  const review = service.review(input);
  assert.ok(review.findings.some((f: string) => f.includes("domain_descriptor.meta_model_incomplete")));
});

test("review flags missing meta model questions", () => {
  const input = createMinimalInput({
    metaModelMissingQuestionIds: ["Q5_decision_scope", "Q6_risk_hotspots"],
  });
  const review = service.review(input);
  assert.ok(review.findings.some((f: string) => f.includes("domain_descriptor.meta_model_missing:Q5")));
  assert.ok(review.findings.some((f: string) => f.includes("domain_descriptor.meta_model_missing:Q6")));
});

test("review flags high risk active domain without registered release evidence", () => {
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

test("review does not flag high risk non-active domain", () => {
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

test("review determines onboardingReadiness as needs_evidence when findings contain missing", () => {
  const input = createMinimalInput({ defaultWorkflowIds: [], recipes: [] });
  const review = service.review(input);
  assert.strictEqual(review.onboardingReadiness, "needs_evidence");
});

test("review determines onboardingReadiness as blocked when findings do not contain missing", () => {
  const input = createMinimalInput({
    lifecycleState: "active",
    defaultWorkflowIds: ["wf-1"],
    defaultToolBundleIds: ["bundle-1"],
    promptLibrary: {
      libraryId: "prompt-test",
      domainId: "test-domain",
      prompts: [{ promptId: "p1", stage: "plan", version: "1.0", template: "Test" }],
    },
    evalFramework: {
      frameworkId: "eval-test",
      domainId: "test-domain",
      fewShotExamples: [],
      evaluators: [{ evaluatorId: "e1", metric: "accuracy", threshold: 0.9, blocking: true }],
      onlineMetrics: [],
      releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
    },
    recipes: [{ recipeId: "r1", domainId: "test-domain", triggerPhrases: ["test"], defaultWorkflowId: "wf-1", defaultToolBundleIds: ["bundle-1"] }],
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

test("review normalizes lifecycle state aliases", () => {
  const input = createMinimalInput({ lifecycleState: "validating" });
  const review = service.review(input);
  assert.strictEqual(review.lifecycleState, "validated");
});

test("review normalizes certified to registered", () => {
  const input = createMinimalInput({ lifecycleState: "certified" });
  const review = service.review(input);
  assert.strictEqual(review.lifecycleState, "registered");
});

test("review normalizes canary to registered", () => {
  const input = createMinimalInput({ lifecycleState: "canary" });
  const review = service.review(input);
  assert.strictEqual(review.lifecycleState, "registered");
});

test("review normalizes retired to archived", () => {
  const input = createMinimalInput({ lifecycleState: "retired" });
  const review = service.review(input);
  assert.strictEqual(review.lifecycleState, "archived");
});

test("review preserves known lifecycle state", () => {
  const input = createMinimalInput({ lifecycleState: "active" });
  const review = service.review(input);
  assert.strictEqual(review.lifecycleState, "active");
});

test("review uses default metaModelCompleteness of 100 when not provided", () => {
  const input = createMinimalInput();
  const review = service.review(input);
  assert.strictEqual(review.metaModelCompleteness, 100);
});

test("review uses provided metaModelCompleteness", () => {
  const input = createMinimalInput({ metaModelCompleteness: 80 });
  const review = service.review(input);
  assert.strictEqual(review.metaModelCompleteness, 80);
});

// --- Domain Capability Registration ---

test("review lists blocking evaluator IDs from eval framework", () => {
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

test("review lists prompt IDs and stage coverage from prompt library", () => {
  const input = createMinimalInput({
    promptLibrary: {
      libraryId: "prompt-test",
      domainId: "test-domain",
      prompts: [
        { promptId: "plan-prompt", stage: "plan", version: "1.0", template: "Plan" },
        { promptId: "execute-prompt", stage: "execute", version: "1.0", template: "Execute" },
        { promptId: "assess-prompt", stage: "assess", version: "1.0", template: "Assess" },
        { promptId: "plan-prompt-2", stage: "plan", version: "1.0", template: "Plan 2" },
      ],
    },
  });
  const review = service.review(input);
  assert.deepStrictEqual(review.promptIds, ["plan-prompt", "execute-prompt", "assess-prompt", "plan-prompt-2"]);
  assert.deepStrictEqual(review.promptStageCoverage, ["plan", "execute", "assess"]);
});

test("review lists recipe IDs from recipes", () => {
  const input = createMinimalInput({
    recipes: [
      { recipeId: "recipe-1", domainId: "test-domain", triggerPhrases: ["test"], defaultWorkflowId: "wf-1", defaultToolBundleIds: [] },
      { recipeId: "recipe-2", domainId: "test-domain", triggerPhrases: ["run"], defaultWorkflowId: "wf-2", defaultToolBundleIds: [] },
    ],
  });
  const review = service.review(input);
  assert.deepStrictEqual(review.recipeIds, ["recipe-1", "recipe-2"]);
});

test("review lists default knowledge namespaces from schema", () => {
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

test("review builds cross-domain modes from interaction rules", () => {
  const input = createMinimalInput({
    interactionRules: [
      { sourceDomainId: "domain-a", targetDomainId: "domain-b", mode: "approval_required", maxConcurrentWorkflows: 1, compensationRequired: true },
      { sourceDomainId: "domain-a", targetDomainId: "domain-c", mode: "allow", maxConcurrentWorkflows: 5, compensationRequired: false },
    ],
  });
  const review = service.review(input);
  assert.strictEqual(review.crossDomainModes["domain-a->domain-b"], "approval_required");
  assert.strictEqual(review.crossDomainModes["domain-a->domain-c"], "allow");
});

test("review returns empty cross-domain modes when no interaction rules", () => {
  const input = createMinimalInput({ interactionRules: undefined });
  const review = service.review(input);
  assert.deepStrictEqual(review.crossDomainModes, {});
});

test("review identifies review required task types for coding domain with high risk", () => {
  const input = createMinimalInput({
    domainId: "coding",
    riskProfile: {
      profileId: "risk-test",
      domainId: "coding",
      defaultRiskLevel: "medium",
      dimensions: [],
    },
  });
  const review = service.review(input);
  assert.deepStrictEqual(review.reviewRequiredTaskTypes, ["implement", "release"]);
});

test("review identifies review required task types for high risk non-coding domain", () => {
  const input = createMinimalInput({
    domainId: "some-other-domain",
    riskProfile: {
      profileId: "risk-test",
      domainId: "some-other-domain",
      defaultRiskLevel: "high",
      dimensions: [],
    },
  });
  const review = service.review(input);
  assert.deepStrictEqual(review.reviewRequiredTaskTypes, ["release", "production_change"]);
});

test("review identifies review required task types for critical risk non-coding domain", () => {
  const input = createMinimalInput({
    domainId: "some-other-domain",
    riskProfile: {
      profileId: "risk-test",
      domainId: "some-other-domain",
      defaultRiskLevel: "critical",
      dimensions: [],
    },
  });
  const review = service.review(input);
  assert.deepStrictEqual(review.reviewRequiredTaskTypes, ["release", "production_change"]);
});

test("review returns empty reviewRequiredTaskTypes for low risk domain", () => {
  const input = createMinimalInput({
    domainId: "some-other-domain",
    riskProfile: {
      profileId: "risk-test",
      domainId: "some-other-domain",
      defaultRiskLevel: "low",
      dimensions: [],
    },
  });
  const review = service.review(input);
  assert.deepStrictEqual(review.reviewRequiredTaskTypes, []);
});

// --- Descriptor Versioning ---

test("buildOnboardingChecklist returns domainId", () => {
  const checklist = service.buildOnboardingChecklist("test-domain");
  assert.strictEqual(checklist.domainId, "test-domain");
});

test("buildOnboardingChecklist returns all four phases", () => {
  const checklist = service.buildOnboardingChecklist("test-domain");
  assert.strictEqual(checklist.phases.length, 4);
  const phaseNames = checklist.phases.map((p: { phase: string }) => p.phase);
  assert.ok(phaseNames.includes("domain_modeling"));
  assert.ok(phaseNames.includes("pack_development"));
  assert.ok(phaseNames.includes("security_certification"));
  assert.ok(phaseNames.includes("gray_rollout"));
});

test("buildOnboardingChecklist includes required evidence for domain_modeling phase", () => {
  const checklist = service.buildOnboardingChecklist("test-domain");
  const modelingPhase = checklist.phases.find((p: { phase: string }) => p.phase === "domain_modeling");
  assert.ok(modelingPhase);
  assert.ok(modelingPhase.requiredEvidence.includes("descriptor"));
  assert.ok(modelingPhase.requiredEvidence.includes("risk_profile"));
  assert.ok(modelingPhase.requiredEvidence.includes("knowledge_schema"));
});

test("buildOnboardingChecklist includes required evidence for pack_development phase", () => {
  const checklist = service.buildOnboardingChecklist("test-domain");
  const devPhase = checklist.phases.find((p: { phase: string }) => p.phase === "pack_development");
  assert.ok(devPhase);
  assert.ok(devPhase.requiredEvidence.includes("domain_lint"));
  assert.ok(devPhase.requiredEvidence.includes("workflow_validation"));
  assert.ok(devPhase.requiredEvidence.includes("eval_framework"));
  assert.ok(devPhase.requiredEvidence.includes("prompt_library"));
});

test("buildOnboardingChecklist includes required evidence for security_certification phase", () => {
  const checklist = service.buildOnboardingChecklist("test-domain");
  const securityPhase = checklist.phases.find((p: { phase: string }) => p.phase === "security_certification");
  assert.ok(securityPhase);
  assert.ok(securityPhase.requiredEvidence.includes("security_review"));
  assert.ok(securityPhase.requiredEvidence.includes("interaction_policy"));
  assert.ok(securityPhase.requiredEvidence.includes("approval_path"));
});

test("buildOnboardingChecklist includes required evidence for gray_rollout phase", () => {
  const checklist = service.buildOnboardingChecklist("test-domain");
  const rolloutPhase = checklist.phases.find((p: { phase: string }) => p.phase === "gray_rollout");
  assert.ok(rolloutPhase);
  assert.ok(rolloutPhase.requiredEvidence.includes("rollout_metrics"));
  assert.ok(rolloutPhase.requiredEvidence.includes("rollback_plan"));
  assert.ok(rolloutPhase.requiredEvidence.includes("operator_signoff"));
});

test("buildOnboardingChecklist preserves provided domainId", () => {
  const checklist = service.buildOnboardingChecklist("my-custom-domain");
  assert.strictEqual(checklist.domainId, "my-custom-domain");
});