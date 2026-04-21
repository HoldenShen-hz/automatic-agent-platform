import assert from "node:assert/strict";
import test from "node:test";

import { DomainDescriptorOrchestrationService } from "../../../src/domains/domain-descriptor-orchestration-service.js";
import { DomainOnboardingService } from "../../../src/domains/operations/domain-onboarding-service.js";
import { DomainRegistryService } from "../../../src/domains/registry/domain-registry-service.js";

test("integration: domain descriptor review and onboarding checklist drive activation flow", () => {
  const registry = new DomainRegistryService();
  registry.register({
    domainId: "coding",
    name: "Coding",
    description: "Software delivery",
    version: 1,
    workflows: [
      {
        workflowId: "wf_release",
        name: "Release",
        triggerConditions: {},
        steps: [
          {
            stepName: "prepare",
            toolHints: ["repo_read"],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: true,
            timeoutMs: 1000,
            dependsOn: [],
          },
        ],
      },
    ],
    toolBundles: [
      {
        bundleId: "repo_tools",
        tools: [{ toolName: "repo_read", enabled: true, configOverrides: {} }],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["implement"],
      requiredTools: ["repo_read"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
      securityLevel: "standard",
    },
    status: "testing",
    externalAdapters: [],
    pluginBindings: [],
  });

  const descriptorService = new DomainDescriptorOrchestrationService();
  const review = descriptorService.review({
    domainId: "coding",
    displayName: "Coding",
    description: "Software delivery",
    ownerOrgNodeId: "org_eng",
    lifecycleState: "canary",
    version: 1,
    riskProfile: {
      profileId: "risk_coding",
      domainId: "coding",
      defaultRiskLevel: "medium",
      dimensions: [],
    },
    knowledgeSchema: {
      schemaId: "knowledge_coding",
      domainId: "coding",
      namespaceIds: ["repo"],
      freshnessWindowHours: 24,
      conflictResolution: "trust_priority",
      retentionDays: 30,
      knowledgeSources: [],
      retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
      freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
    },
    evalFramework: {
      frameworkId: "eval_coding",
      domainId: "coding",
      fewShotExamples: [],
      evaluators: [{ evaluatorId: "tests", metric: "pass_rate", threshold: 0.95, blocking: true }],
      onlineMetrics: [],
      releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
    },
    promptLibrary: {
      libraryId: "prompt_coding",
      domainId: "coding",
      prompts: [{ promptId: "release", stage: "execute", version: "1.0", template: "Release safely", guardrails: [] }],
    },
    recipes: [{ recipeId: "release", domainId: "coding", triggerPhrases: ["release"], defaultWorkflowId: "wf_release", defaultToolBundleIds: ["repo_tools"] }],
    defaultToolBundleIds: ["repo_tools"],
    defaultWorkflowIds: ["wf_release"],
  });

  assert.equal(review.onboardingReadiness, "ready");

  const onboarding = new DomainOnboardingService(registry);
  onboarding.start("coding");
  for (const phase of descriptorService.buildOnboardingChecklist("coding").phases) {
    onboarding.advance("coding", phase.requiredEvidence.map((item) => `${phase.phase}:${item}`));
  }

  assert.equal(onboarding.get("coding").completed, true);
  assert.equal(registry.get("coding")?.status, "active");
});
