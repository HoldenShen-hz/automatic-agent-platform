import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
import { DomainOnboardingService, type DomainOnboardingPhase } from "../../../src/domains/operations/index.js";
import { DomainRegistryService } from "../../../src/domains/registry/domain-registry-service.js";
import { DomainDescriptorOrchestrationService } from "../../../src/domains/domain-descriptor-orchestration-service.js";
import {
  bootstrapVerticalDomainBaselines,
  getVerticalDomainBaseline,
} from "../../../src/domains/domain-baseline-catalog.js";
import type { DomainDefinition } from "../../../src/domains/registry/domain-model.js";

type TestDomainStatus = DomainDefinition["status"] | "testing";

function registerTestDomain(
  registry: DomainRegistryService,
  domainId: string,
  displayName: string,
  status: TestDomainStatus = "testing",
): void {
  registry.register({
    domainId,
    name: displayName,
    description: `Test domain for ${domainId}`,
    version: 1,
    workflows: [
      {
        workflowId: `${domainId}_wf`,
        name: `${displayName} workflow`,
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
    status: status === "testing" ? "validated" : status,
    externalAdapters: [],
    pluginBindings: [],
  });
}

test.beforeEach(async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
});

test.afterEach(async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
});

test("integration: DomainOnboardingService works with real domain baselines", () => {
  const bootstrapped = bootstrapVerticalDomainBaselines();
  const codingBaseline = getVerticalDomainBaseline("coding");

  const service = new DomainOnboardingService(bootstrapped.domainRegistry);
  const session = service.start(codingBaseline.domainId);

  assert.equal(session.domainId, codingBaseline.domainId);
  assert.equal(session.activePhase, "domain_modeling");
  assert.equal(session.completed, false);
});

test("integration: DomainOnboardingService.block creates blocked session with evidence", () => {
  const bootstrapped = bootstrapVerticalDomainBaselines();
  const ecommerceBaseline = getVerticalDomainBaseline("ecommerce");

  const service = new DomainOnboardingService(bootstrapped.domainRegistry);
  service.start(ecommerceBaseline.domainId);

  const session = service.block(ecommerceBaseline.domainId, "security_concern_artifact");

  assert.equal(session.activePhase, null);
  const modelingRecord = session.records.find((r) => r.phase === "domain_modeling");
  assert.equal(modelingRecord?.status, "blocked");
  assert.ok(modelingRecord?.evidenceArtifactIds.includes("security_concern_artifact"));
});

test("integration: DomainOnboardingService.rollback restores to earlier phase with checkpoint", () => {
  const bootstrapped = bootstrapVerticalDomainBaselines();
  const quantBaseline = getVerticalDomainBaseline("quant-trading");

  const service = new DomainOnboardingService(bootstrapped.domainRegistry);
  service.start(quantBaseline.domainId);

  service.advance(quantBaseline.domainId, ["modeling_evidence"]);
  service.advance(quantBaseline.domainId, ["pack_development_evidence"]);

  const session = service.rollback(
    quantBaseline.domainId,
    "domain_modeling",
    "rollback_checkpoint_artifact",
    "pack development not ready",
  );

  assert.equal(session.activePhase, "domain_modeling");
  assert.ok(session.rollbackHistory.some((r) => r.checkpointArtifactId === "rollback_checkpoint_artifact"));
});

test("integration: DomainOnboardingService.list returns all onboarding sessions", () => {
  const bootstrapped = bootstrapVerticalDomainBaselines();

  const service = new DomainOnboardingService(bootstrapped.domainRegistry);
  service.start("coding");
  service.start("ecommerce");
  service.start("healthcare");

  const sessions = service.list();

  assert.ok(sessions.length >= 3);
  assert.ok(sessions.some((s) => s.domainId === "coding"));
  assert.ok(sessions.some((s) => s.domainId === "ecommerce"));
  assert.ok(sessions.some((s) => s.domainId === "healthcare"));
});

test("integration: DomainOnboardingService works with DomainDescriptorOrchestrationService", () => {
  const bootstrapped = bootstrapVerticalDomainBaselines();
  const legalBaseline = getVerticalDomainBaseline("legal");

  const descriptorService = new DomainDescriptorOrchestrationService();
  const onboardingService = new DomainOnboardingService(bootstrapped.domainRegistry);

  const review = descriptorService.review({
    domainId: legalBaseline.domainId,
    displayName: legalBaseline.displayName,
    description: legalBaseline.definition.description,
    ownerOrgNodeId: legalBaseline.ownerOrgNodeId,
    lifecycleState: "canary",
    version: legalBaseline.definition.version,
    riskProfile: legalBaseline.riskProfile,
    knowledgeSchema: legalBaseline.knowledgeSchema,
    evalFramework: legalBaseline.evalFramework,
    promptLibrary: legalBaseline.promptLibrary,
    recipes: legalBaseline.recipes,
    interactionRules: legalBaseline.interactionRules,
    defaultToolBundleIds: legalBaseline.definition.toolBundles.map((b) => b.bundleId),
    defaultWorkflowIds: legalBaseline.definition.workflows.map((w) => w.workflowId),
    metaModelCompleteness: legalBaseline.metaModelValidation.completeness,
    metaModelMissingQuestionIds: legalBaseline.metaModelValidation.missingQuestionIds,
  });

  onboardingService.start(legalBaseline.domainId);

  assert.equal(review.onboardingReadiness, "ready");
  const session = onboardingService.get(legalBaseline.domainId);
  assert.equal(session.activePhase, "domain_modeling");
});

test("integration: onboarding checklist built from real domain descriptor", () => {
  const bootstrapped = bootstrapVerticalDomainBaselines();
  const marketingBaseline = getVerticalDomainBaseline("marketing");

  const descriptorService = new DomainDescriptorOrchestrationService();
  const onboardingService = new DomainOnboardingService(bootstrapped.domainRegistry);

  const checklist = descriptorService.buildOnboardingChecklist(marketingBaseline.domainId);
  onboardingService.start(marketingBaseline.domainId);

  assert.equal(checklist.domainId, marketingBaseline.domainId);
  assert.equal(checklist.phases.length, 4);
  const phases = checklist.phases.map((p: { phase: string }) => p.phase);
  assert.deepEqual(phases, ["domain_modeling", "pack_development", "security_certification", "gray_rollout"]);
});

test("integration: DomainOnboardingService advances through phases with fresh domain", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "test_fresh_domain", "Test Fresh Domain", "testing");

  const service = new DomainOnboardingService(registry);
  service.start("test_fresh_domain");

  let session = service.advance("test_fresh_domain", ["modeling_evidence"]);
  assert.equal(session.activePhase, "pack_development");

  session = service.advance("test_fresh_domain", ["validation_evidence"]);
  assert.equal(session.activePhase, "security_certification");

  session = service.advance("test_fresh_domain", ["security_evidence"]);
  assert.equal(session.activePhase, "gray_rollout");

  session = service.advance("test_fresh_domain", ["canary_evidence"]);
  assert.equal(session.completed, true);
});
