/**
 * Integration Test: Domain Registration and Onboarding Flow
 *
 * Tests the complete domain lifecycle from registration through
 * onboarding phases to activation using createIntegrationContext().
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import { DomainOnboardingService } from "../../../../src/domains/operations/index.js";
import { DomainDescriptorOrchestrationService } from "../../../../src/domains/domain-descriptor-orchestration-service.js";

function registerTestDomain(
  registry: DomainRegistryService,
  domainId: string,
  status: "draft" | "testing" | "active" = "testing",
): void {
  registry.register({
    domainId,
    name: `${domainId} domain`,
    description: `Test domain for ${domainId}`,
    version: 1,
    workflows: [
      {
        workflowId: `${domainId}_wf`,
        name: `${domainId} workflow`,
        triggerConditions: {},
        steps: [
          {
            stepName: "execute",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 60000,
            dependsOn: [],
          },
        ],
      },
    ],
    toolBundles: [
      {
        bundleId: `${domainId}_tools`,
        tools: [],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["implement"],
      requiredTools: [],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
      securityLevel: "standard",
    },
    status,
    externalAdapters: [],
    pluginBindings: [],
  });
}

test("DomainRegistration: register stores domain and can be retrieved", () => {
  const ctx = createIntegrationContext("aa-domain-reg-");
  try {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_retrieve");

    const domain = registry.get("test_retrieve");
    assert.ok(domain !== null);
    assert.equal(domain?.domainId, "test_retrieve");
    assert.equal(domain?.name, "test_retrieve domain");
  } finally {
    ctx.cleanup();
  }
});

test("DomainRegistration: list returns all registered domains", () => {
  const ctx = createIntegrationContext("aa-domain-list-");
  try {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "domain_list_a");
    registerTestDomain(registry, "domain_list_b");
    registerTestDomain(registry, "domain_list_c");

    const domains = registry.list();
    assert.equal(domains.length, 3);
  } finally {
    ctx.cleanup();
  }
});

test("DomainRegistration: listActive returns only active domains", () => {
  const ctx = createIntegrationContext("aa-domain-active-");
  try {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "draft_domain", "draft");
    registerTestDomain(registry, "testing_domain", "testing");
    registerTestDomain(registry, "active_domain", "active");

    const activeDomains = registry.listActive();
    assert.equal(activeDomains.length, 1);
    assert.equal(activeDomains[0]?.domainId, "active_domain");
  } finally {
    ctx.cleanup();
  }
});

test("DomainRegistration: activate runs smoke test before activation", () => {
  const ctx = createIntegrationContext("aa-domain-activate-");
  try {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_activate", "testing");

    const activated = registry.activate("test_activate");
    assert.equal(activated.status, "active");

    const domain = registry.get("test_activate");
    assert.equal(domain?.status, "active");
  } finally {
    ctx.cleanup();
  }
});

test("DomainRegistration: deprecate marks domain as deprecated", () => {
  const ctx = createIntegrationContext("aa-domain-deprecate-");
  try {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_deprecate", "active");

    const deprecated = registry.deprecate("test_deprecate");
    assert.equal(deprecated.status, "deprecated");

    const domain = registry.get("test_deprecate");
    assert.equal(domain?.status, "deprecated");
  } finally {
    ctx.cleanup();
  }
});

test("DomainRegistration: getWorkflow returns workflow config", () => {
  const ctx = createIntegrationContext("aa-domain-workflow-");
  try {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_workflow");

    const workflow = registry.getWorkflow("test_workflow", "test_workflow_wf");
    assert.ok(workflow !== null);
    assert.equal(workflow?.workflowId, "test_workflow_wf");
  } finally {
    ctx.cleanup();
  }
});

test("DomainRegistration: getToolBundle returns tool bundle config", () => {
  const ctx = createIntegrationContext("aa-domain-tools-");
  try {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_bundle");

    const bundle = registry.getToolBundle("test_bundle", "test_bundle_tools");
    assert.ok(bundle !== null);
    assert.equal(bundle?.bundleId, "test_bundle_tools");
  } finally {
    ctx.cleanup();
  }
});

test("DomainRegistration: filterAllowedTools returns enabled and required tools", () => {
  const ctx = createIntegrationContext("aa-domain-filter-tools-");
  try {
    const registry = new DomainRegistryService();
    registry.register({
      domainId: "test_filter",
      name: "Test Filter",
      description: "Test domain",
      version: 1,
      workflows: [],
      toolBundles: [
        {
          bundleId: "filter_tools",
          tools: [
            { toolName: "bash", enabled: true, configOverrides: {} },
            { toolName: "read", enabled: true, configOverrides: {} },
            { toolName: "edit", enabled: false, configOverrides: {} },
          ],
        },
      ],
      outputContracts: [],
      promptOverrides: {},
      capabilities: {
        supportedTaskTypes: ["implement"],
        requiredTools: ["repo_read"],
        optionalTools: ["bash"],
        modelPreferences: {},
        budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
        securityLevel: "standard",
      },
      status: "testing",
      externalAdapters: [],
      pluginBindings: [],
    });

    const allowed = registry.filterAllowedTools("test_filter", ["bash", "edit", "write", "repo_read"]);
    assert.ok(allowed.includes("bash"));
    assert.ok(allowed.includes("repo_read"));
    assert.ok(!allowed.includes("edit"));
    assert.ok(!allowed.includes("write"));
  } finally {
    ctx.cleanup();
  }
});

test("DomainOnboarding: start creates session with domain_modeling phase", () => {
  const ctx = createIntegrationContext("aa-onboard-start-");
  try {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_start");

    const onboarding = new DomainOnboardingService(registry);
    const session = onboarding.start("test_start");

    assert.equal(session.domainId, "test_start");
    assert.equal(session.activePhase, "domain_modeling");
    assert.equal(session.completed, false);
  } finally {
    ctx.cleanup();
  }
});

test("DomainOnboarding: advance through all phases completes onboarding", () => {
  const ctx = createIntegrationContext("aa-onboard-advance-");
  try {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_advance");

    const onboarding = new DomainOnboardingService(registry);
    onboarding.start("test_advance");

    onboarding.advance("test_advance", ["modeling_evidence"]);
    onboarding.advance("test_advance", ["validation_evidence"]);
    onboarding.advance("test_advance", ["security_evidence"]);
    const session = onboarding.advance("test_advance", ["canary_evidence"]);

    assert.equal(session.completed, true);
    assert.equal(session.activatedDomainStatus, "active");
  } finally {
    ctx.cleanup();
  }
});

test("DomainOnboarding: block marks current phase as blocked", () => {
  const ctx = createIntegrationContext("aa-onboard-block-");
  try {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_block");

    const onboarding = new DomainOnboardingService(registry);
    onboarding.start("test_block");

    const session = onboarding.block("test_block", "block_reason");

    assert.equal(session.activePhase, null);
    const modelingRecord = session.records.find((r) => r.phase === "domain_modeling");
    assert.equal(modelingRecord?.status, "blocked");
  } finally {
    ctx.cleanup();
  }
});

test("DomainOnboarding: rollback restores to earlier phase", () => {
  const ctx = createIntegrationContext("aa-onboard-rollback-");
  try {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_rollback", "active");

    const onboarding = new DomainOnboardingService(registry);
    onboarding.start("test_rollback");
    onboarding.advance("test_rollback", ["modeling_evidence"]);

    const session = onboarding.rollback("test_rollback", "domain_modeling", "rollback_cp", "test rollback");

    assert.equal(session.activePhase, "domain_modeling");
    assert.ok(session.rollbackHistory.length === 1);
    assert.equal(session.rollbackHistory[0]?.reason, "test rollback");
  } finally {
    ctx.cleanup();
  }
});

test("DomainOnboarding: list returns all sessions", () => {
  const ctx = createIntegrationContext("aa-onboard-list-");
  try {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "domain_list_a");
    registerTestDomain(registry, "domain_list_b");

    const onboarding = new DomainOnboardingService(registry);
    onboarding.start("domain_list_a");
    onboarding.start("domain_list_b");

    const sessions = onboarding.list();
    assert.equal(sessions.length, 2);
  } finally {
    ctx.cleanup();
  }
});

test("DomainDescriptor: review produces onboardingReadiness", () => {
  const ctx = createIntegrationContext("aa-descriptor-review-");
  try {
    const descriptorService = new DomainDescriptorOrchestrationService();

    const review = descriptorService.review({
      domainId: "test_review",
      displayName: "Test Review",
      description: "Test domain descriptor review",
      ownerOrgNodeId: "org_test",
      lifecycleState: "certified",
      version: 1,
      riskProfile: {
        profileId: "risk_test",
        domainId: "test_review",
        defaultRiskLevel: "medium",
        dimensions: [],
      },
      knowledgeSchema: {
        schemaId: "knowledge_test",
        domainId: "test_review",
        namespaceIds: ["ns_test"],
        freshnessWindowHours: 24,
        conflictResolution: "trust_priority",
        retentionDays: 30,
        knowledgeSources: [],
        retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
        freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
      },
      evalFramework: {
        frameworkId: "eval_test",
        domainId: "test_review",
        fewShotExamples: [],
        evaluators: [{ evaluatorId: "test_eval", metric: "pass_rate", threshold: 0.9, blocking: true }],
        onlineMetrics: [],
        releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 10, requirePromptInjectionCoverage: false },
      },
      promptLibrary: {
        libraryId: "prompt_test",
        domainId: "test_review",
        prompts: [{ promptId: "test_prompt", stage: "execute", version: "1.0", template: "Test", guardrails: [] }],
      },
      recipes: [{ recipeId: "test_recipe", name: "Test Recipe", domainId: "test_review", archetype: "analytics", risk_profile_ref: "risk_test", guardrail_overlay: "standard", default_prompt_bundle_ref: "prompt_test", acceptance_checklist_ref: "check_test", triggerPhrases: ["test"], defaultWorkflowId: "wf_test", defaultToolBundleIds: ["tools_test"], riskLevel: "medium", recommended_workflow_ids: [], requiredApproval: false }],
      defaultToolBundleIds: ["tools_test"],
      defaultWorkflowIds: ["wf_test"],
    });

    assert.ok(review.onboardingReadiness === "ready" || review.onboardingReadiness === "needs_evidence");
    assert.ok(review.blockingEvaluatorIds.length >= 0);
    assert.ok(review.promptIds.length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("DomainDescriptor: buildOnboardingChecklist returns all phases", () => {
  const ctx = createIntegrationContext("aa-descriptor-checklist-");
  try {
    const descriptorService = new DomainDescriptorOrchestrationService();

    const checklist = descriptorService.buildOnboardingChecklist("test_checklist");

    assert.equal(checklist.domainId, "test_checklist");
    assert.equal(checklist.phases.length, 4);
    assert.equal(checklist.phases[0]?.phase, "domain_modeling");
    assert.equal(checklist.phases[1]?.phase, "pack_development");
    assert.equal(checklist.phases[2]?.phase, "security_certification");
    assert.equal(checklist.phases[3]?.phase, "gray_rollout");
  } finally {
    ctx.cleanup();
  }
});

test("FullFlow: domain registration -> onboarding -> activation", () => {
  const ctx = createIntegrationContext("aa-full-flow-");
  try {
    const registry = new DomainRegistryService();
    const descriptorService = new DomainDescriptorOrchestrationService();
    const onboarding = new DomainOnboardingService(registry);

    // Register domain
    registerTestDomain(registry, "full_flow_domain", "testing");
    assert.ok(registry.get("full_flow_domain") !== null);

    // Start onboarding
    const session1 = onboarding.start("full_flow_domain");
    assert.equal(session1.activePhase, "domain_modeling");

    // Advance through phases using checklist
    for (const phase of descriptorService.buildOnboardingChecklist("full_flow_domain").phases) {
      onboarding.advance("full_flow_domain", phase.requiredEvidence.map((e) => `${phase.phase}:${e}`));
    }

    const finalSession = onboarding.get("full_flow_domain");
    assert.equal(finalSession.completed, true);

    const domain = registry.get("full_flow_domain");
    assert.equal(domain?.status, "active");
  } finally {
    ctx.cleanup();
  }
});
