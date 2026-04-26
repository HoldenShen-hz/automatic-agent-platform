import { describe, it, beforeEach } from "node:test";
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

describe("DomainDescriptorOrchestrationService", () => {
  let service: DomainDescriptorOrchestrationService;

  beforeEach(() => {
    service = new DomainDescriptorOrchestrationService();
  });

  describe("review", () => {
    it("should return ready onboarding when all requirements are met", () => {
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

    it("should flag missing default workflow", () => {
      const input = createMinimalInput({
        defaultWorkflowIds: [],
      });

      const review = service.review(input);

      assert.ok(review.findings.includes("domain_descriptor.default_workflow_missing"));
    });

    it("should flag missing default tool bundle", () => {
      const input = createMinimalInput({
        defaultToolBundleIds: [],
      });

      const review = service.review(input);

      assert.ok(review.findings.includes("domain_descriptor.default_tool_bundle_missing"));
    });

    it("should flag missing prompts", () => {
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

    it("should flag missing blocking evaluators", () => {
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

    it("should flag missing knowledge namespace", () => {
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

    it("should flag missing recipes", () => {
      const input = createMinimalInput({
        recipes: [],
      });

      const review = service.review(input);

      assert.ok(review.findings.includes("domain_descriptor.recipe_missing"));
    });

    it("should flag incomplete meta model", () => {
      const input = createMinimalInput({
        metaModelCompleteness: 75,
      });

      const review = service.review(input);

      assert.ok(review.findings.some((f: string) => f.includes("domain_descriptor.meta_model_incomplete")));
    });

    it("should flag missing meta model questions", () => {
      const input = createMinimalInput({
        metaModelMissingQuestionIds: ["Q5_decision_scope", "Q6_risk_hotspots"],
      });

      const review = service.review(input);

      assert.ok(review.findings.some((f: string) => f.includes("domain_descriptor.meta_model_missing:Q5")));
      assert.ok(review.findings.some((f: string) => f.includes("domain_descriptor.meta_model_missing:Q6")));
    });

    it("should flag high risk active domain without canary history", () => {
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

      assert.ok(review.findings.includes("domain_descriptor.high_risk_active_requires_canary_history"));
    });

    it("should not flag high risk non-active domain", () => {
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

      assert.ok(!review.findings.includes("domain_descriptor.high_risk_active_requires_canary_history"));
    });

    it("should determine onboardingReadiness as needs_evidence when findings contain missing", () => {
      const input = createMinimalInput({
        defaultWorkflowIds: [],
        recipes: [],
      });

      const review = service.review(input);

      assert.strictEqual(review.onboardingReadiness, "needs_evidence");
    });

    it("should determine onboardingReadiness as blocked when findings do not contain missing", () => {
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

      assert.strictEqual(review.onboardingReadiness, "blocked");
    });

    it("should list blocking evaluator IDs from eval framework", () => {
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

    it("should list prompt IDs and stage coverage from prompt library", () => {
      const input = createMinimalInput({
        promptLibrary: {
          libraryId: "prompt-test",
          domainId: "test-domain",
          prompts: [
            { promptId: "plan-prompt", stage: "plan", version: "1.0", template: "Plan" },
            { promptId: "execute-prompt", stage: "execute", version: "1.0", template: "Execute" },
            { promptId: "assess-prompt", stage: "assess", version: "1.0", template: "Assess" },
          ],
        },
      });

      const review = service.review(input);

      assert.deepStrictEqual(review.promptIds, ["plan-prompt", "execute-prompt", "assess-prompt"]);
      assert.deepStrictEqual(review.promptStageCoverage, ["plan", "execute", "assess"]);
    });

    it("should list recipe IDs from recipes", () => {
      const input = createMinimalInput({
        recipes: [
          { recipeId: "recipe-1", domainId: "test-domain", triggerPhrases: ["test"], defaultWorkflowId: "wf-1", defaultToolBundleIds: [] },
          { recipeId: "recipe-2", domainId: "test-domain", triggerPhrases: ["run"], defaultWorkflowId: "wf-2", defaultToolBundleIds: [] },
        ],
      });

      const review = service.review(input);

      assert.deepStrictEqual(review.recipeIds, ["recipe-1", "recipe-2"]);
    });

    it("should list default knowledge namespaces from schema", () => {
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

    it("should build cross-domain modes from interaction rules", () => {
      const input = createMinimalInput({
        interactionRules: [
          { sourceDomainId: "domain-a", targetDomainId: "domain-b", mode: "approval_required", maxConcurrentWorkflows: 1, compensationRequired: true },
          { sourceDomainId: "domain-a", targetDomainId: "domain-c", mode: "supervised", maxConcurrentWorkflows: 5, compensationRequired: false },
        ],
      });

      const review = service.review(input);

      assert.strictEqual(review.crossDomainModes["domain-a->domain-b"], "approval_required");
      assert.strictEqual(review.crossDomainModes["domain-a->domain-c"], "supervised");
    });

    it("should return empty cross-domain modes when no interaction rules", () => {
      const input = createMinimalInput({
        interactionRules: undefined,
      });

      const review = service.review(input);

      assert.deepStrictEqual(review.crossDomainModes, {});
    });
  });

  describe("buildOnboardingChecklist", () => {
    it("should return checklist with all phases", () => {
      const checklist = service.buildOnboardingChecklist("test-domain");

      assert.strictEqual(checklist.domainId, "test-domain");
      assert.strictEqual(checklist.phases.length, 4);

      const phaseNames = checklist.phases.map((p: { phase: string }) => p.phase);
      assert.ok(phaseNames.includes("modeling"));
      assert.ok(phaseNames.includes("development_validation"));
      assert.ok(phaseNames.includes("security_certification"));
      assert.ok(phaseNames.includes("canary_launch"));
    });

    it("should include required evidence for each phase", () => {
      const checklist = service.buildOnboardingChecklist("test-domain");

      const modelingPhase = checklist.phases.find((p: { phase: string }) => p.phase === "modeling");
      assert.ok(modelingPhase);
      assert.ok(modelingPhase.requiredEvidence.includes("descriptor"));
      assert.ok(modelingPhase.requiredEvidence.includes("risk_profile"));
      assert.ok(modelingPhase.requiredEvidence.includes("knowledge_schema"));

      const devValidationPhase = checklist.phases.find((p: { phase: string }) => p.phase === "development_validation");
      assert.ok(devValidationPhase);
      assert.ok(devValidationPhase.requiredEvidence.includes("workflow_validation"));
      assert.ok(devValidationPhase.requiredEvidence.includes("eval_framework"));
      assert.ok(devValidationPhase.requiredEvidence.includes("prompt_library"));

      const securityPhase = checklist.phases.find((p: { phase: string }) => p.phase === "security_certification");
      assert.ok(securityPhase);
      assert.ok(securityPhase.requiredEvidence.includes("security_review"));
      assert.ok(securityPhase.requiredEvidence.includes("interaction_policy"));
      assert.ok(securityPhase.requiredEvidence.includes("approval_path"));

      const canaryPhase = checklist.phases.find((p: { phase: string }) => p.phase === "canary_launch");
      assert.ok(canaryPhase);
      assert.ok(canaryPhase.requiredEvidence.includes("canary_metrics"));
      assert.ok(canaryPhase.requiredEvidence.includes("rollback_plan"));
      assert.ok(canaryPhase.requiredEvidence.includes("operator_signoff"));
    });

    it("should always use the provided domainId", () => {
      const checklist = service.buildOnboardingChecklist("my-custom-domain");

      assert.strictEqual(checklist.domainId, "my-custom-domain");
    });
  });
});
