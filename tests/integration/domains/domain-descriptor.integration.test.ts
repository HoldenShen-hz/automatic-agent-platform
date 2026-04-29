import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
import {
  bootstrapVerticalDomainBaselines,
  getVerticalDomainBaseline,
} from "../../../src/domains/domain-baseline-catalog.js";
import {
  DomainDescriptorOrchestrationService,
} from "../../../src/domains/domain-descriptor-orchestration-service.js";

test.beforeEach(async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
});

test.afterEach(async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
});

test("integration: DomainDescriptorOrchestrationService.review works with real coding baseline", () => {
  const bootstrapped = bootstrapVerticalDomainBaselines();
  const codingBaseline = getVerticalDomainBaseline("coding");

  const service = new DomainDescriptorOrchestrationService();
  const review = service.review({
    domainId: codingBaseline.domainId,
    displayName: codingBaseline.displayName,
    description: codingBaseline.definition.description,
    ownerOrgNodeId: codingBaseline.ownerOrgNodeId,
    lifecycleState: "canary",
    version: codingBaseline.definition.version,
    riskProfile: codingBaseline.riskProfile,
    knowledgeSchema: codingBaseline.knowledgeSchema,
    evalFramework: codingBaseline.evalFramework,
    promptLibrary: codingBaseline.promptLibrary,
    recipes: codingBaseline.recipes,
    interactionRules: codingBaseline.interactionRules,
    defaultToolBundleIds: codingBaseline.definition.toolBundles.map((b) => b.bundleId),
    defaultWorkflowIds: codingBaseline.definition.workflows.map((w) => w.workflowId),
    metaModelCompleteness: codingBaseline.metaModelValidation.completeness,
    metaModelMissingQuestionIds: codingBaseline.metaModelValidation.missingQuestionIds,
  });

  assert.equal(review.domainId, codingBaseline.domainId);
  assert.equal(review.onboardingReadiness, "ready");
  assert.ok(review.findings.length === 0);
  assert.ok(review.blockingEvaluatorIds.length > 0);
});

test("integration: DomainDescriptorOrchestrationService.review works with real healthcare baseline", () => {
  const bootstrapped = bootstrapVerticalDomainBaselines();
  const healthcareBaseline = getVerticalDomainBaseline("healthcare");

  const service = new DomainDescriptorOrchestrationService();
  const review = service.review({
    domainId: healthcareBaseline.domainId,
    displayName: healthcareBaseline.displayName,
    description: healthcareBaseline.definition.description,
    ownerOrgNodeId: healthcareBaseline.ownerOrgNodeId,
    lifecycleState: "canary",
    version: healthcareBaseline.definition.version,
    riskProfile: healthcareBaseline.riskProfile,
    knowledgeSchema: healthcareBaseline.knowledgeSchema,
    evalFramework: healthcareBaseline.evalFramework,
    promptLibrary: healthcareBaseline.promptLibrary,
    recipes: healthcareBaseline.recipes,
    interactionRules: healthcareBaseline.interactionRules,
    defaultToolBundleIds: healthcareBaseline.definition.toolBundles.map((b) => b.bundleId),
    defaultWorkflowIds: healthcareBaseline.definition.workflows.map((w) => w.workflowId),
    metaModelCompleteness: healthcareBaseline.metaModelValidation.completeness,
    metaModelMissingQuestionIds: healthcareBaseline.metaModelValidation.missingQuestionIds,
  });

  assert.equal(review.domainId, healthcareBaseline.domainId);
  assert.equal(review.lifecycleState, "registered");
  assert.equal(review.onboardingReadiness, "ready");
});

test("integration: DomainDescriptorOrchestrationService.review works with real quant-trading baseline", () => {
  const bootstrapped = bootstrapVerticalDomainBaselines();
  const quantBaseline = getVerticalDomainBaseline("quant-trading");

  const service = new DomainDescriptorOrchestrationService();
  const review = service.review({
    domainId: quantBaseline.domainId,
    displayName: quantBaseline.displayName,
    description: quantBaseline.definition.description,
    ownerOrgNodeId: quantBaseline.ownerOrgNodeId,
    lifecycleState: "canary",
    version: quantBaseline.definition.version,
    riskProfile: quantBaseline.riskProfile,
    knowledgeSchema: quantBaseline.knowledgeSchema,
    evalFramework: quantBaseline.evalFramework,
    promptLibrary: quantBaseline.promptLibrary,
    recipes: quantBaseline.recipes,
    interactionRules: quantBaseline.interactionRules,
    defaultToolBundleIds: quantBaseline.definition.toolBundles.map((b) => b.bundleId),
    defaultWorkflowIds: quantBaseline.definition.workflows.map((w) => w.workflowId),
    metaModelCompleteness: quantBaseline.metaModelValidation.completeness,
    metaModelMissingQuestionIds: quantBaseline.metaModelValidation.missingQuestionIds,
  });

  assert.equal(review.domainId, quantBaseline.domainId);
  assert.ok(review.reviewRequiredTaskTypes.includes("release"));
  assert.ok(review.reviewRequiredTaskTypes.includes("production_change"));
});

test("integration: DomainDescriptorOrchestrationService.buildOnboardingChecklist for marketing baseline", () => {
  const bootstrapped = bootstrapVerticalDomainBaselines();
  const marketingBaseline = getVerticalDomainBaseline("marketing");

  const service = new DomainDescriptorOrchestrationService();
  const checklist = service.buildOnboardingChecklist(marketingBaseline.domainId);

  assert.equal(checklist.domainId, marketingBaseline.domainId);
  assert.equal(checklist.phases.length, 4);
  assert.deepEqual(
    checklist.phases.map((p: { phase: string }) => p.phase),
    ["domain_modeling", "pack_development", "security_certification", "gray_rollout"],
  );
});

test("integration: DomainDescriptorOrchestrationService builds cross-domain modes from real interaction rules", () => {
  const bootstrapped = bootstrapVerticalDomainBaselines();
  const ecommerceBaseline = getVerticalDomainBaseline("ecommerce");

  const service = new DomainDescriptorOrchestrationService();
  const review = service.review({
    domainId: ecommerceBaseline.domainId,
    displayName: ecommerceBaseline.displayName,
    description: ecommerceBaseline.definition.description,
    ownerOrgNodeId: ecommerceBaseline.ownerOrgNodeId,
    lifecycleState: "canary",
    version: ecommerceBaseline.definition.version,
    riskProfile: ecommerceBaseline.riskProfile,
    knowledgeSchema: ecommerceBaseline.knowledgeSchema,
    evalFramework: ecommerceBaseline.evalFramework,
    promptLibrary: ecommerceBaseline.promptLibrary,
    recipes: ecommerceBaseline.recipes,
    interactionRules: ecommerceBaseline.interactionRules,
    defaultToolBundleIds: ecommerceBaseline.definition.toolBundles.map((b) => b.bundleId),
    defaultWorkflowIds: ecommerceBaseline.definition.workflows.map((w) => w.workflowId),
    metaModelCompleteness: ecommerceBaseline.metaModelValidation.completeness,
    metaModelMissingQuestionIds: ecommerceBaseline.metaModelValidation.missingQuestionIds,
  });

  assert.ok(review.crossDomainModes[`${ecommerceBaseline.domainId}->${ecommerceBaseline.domainId}`]);
});

test("integration: all bootstrapped baselines produce ready onboarding reviews", () => {
  const bootstrapped = bootstrapVerticalDomainBaselines();

  const service = new DomainDescriptorOrchestrationService();

  for (const baseline of bootstrapped.baselines) {
    const review = service.review({
      domainId: baseline.domainId,
      displayName: baseline.displayName,
      description: baseline.definition.description,
      ownerOrgNodeId: baseline.ownerOrgNodeId,
      lifecycleState: "canary",
      version: baseline.definition.version,
      riskProfile: baseline.riskProfile,
      knowledgeSchema: baseline.knowledgeSchema,
      evalFramework: baseline.evalFramework,
      promptLibrary: baseline.promptLibrary,
      recipes: baseline.recipes,
      interactionRules: baseline.interactionRules,
      defaultToolBundleIds: baseline.definition.toolBundles.map((b) => b.bundleId),
      defaultWorkflowIds: baseline.definition.workflows.map((w) => w.workflowId),
      metaModelCompleteness: baseline.metaModelValidation.completeness,
      metaModelMissingQuestionIds: baseline.metaModelValidation.missingQuestionIds,
    });

    assert.equal(
      review.onboardingReadiness,
      "ready",
      `Domain ${baseline.domainId} should have ready onboarding readiness, but got: ${review.findings.join(", ")}`,
    );
  }
});

test("integration: all bootstrapped baselines have correct prompt stage coverage", () => {
  const bootstrapped = bootstrapVerticalDomainBaselines();

  const service = new DomainDescriptorOrchestrationService();

  for (const baseline of bootstrapped.baselines) {
    const review = service.review({
      domainId: baseline.domainId,
      displayName: baseline.displayName,
      description: baseline.definition.description,
      ownerOrgNodeId: baseline.ownerOrgNodeId,
      lifecycleState: "canary",
      version: baseline.definition.version,
      riskProfile: baseline.riskProfile,
      knowledgeSchema: baseline.knowledgeSchema,
      evalFramework: baseline.evalFramework,
      promptLibrary: baseline.promptLibrary,
      recipes: baseline.recipes,
      interactionRules: baseline.interactionRules,
      defaultToolBundleIds: baseline.definition.toolBundles.map((b) => b.bundleId),
      defaultWorkflowIds: baseline.definition.workflows.map((w) => w.workflowId),
      metaModelCompleteness: baseline.metaModelValidation.completeness,
      metaModelMissingQuestionIds: baseline.metaModelValidation.missingQuestionIds,
    });

    assert.ok(
      review.promptStageCoverage.length > 0,
      `Domain ${baseline.domainId} should have prompt stage coverage`,
    );
    assert.ok(review.promptIds.length > 0, `Domain ${baseline.domainId} should have prompt IDs`);
  }
});

test("integration: all bootstrapped baselines have blocking evaluators", () => {
  const bootstrapped = bootstrapVerticalDomainBaselines();

  const service = new DomainDescriptorOrchestrationService();

  for (const baseline of bootstrapped.baselines) {
    const review = service.review({
      domainId: baseline.domainId,
      displayName: baseline.displayName,
      description: baseline.definition.description,
      ownerOrgNodeId: baseline.ownerOrgNodeId,
      lifecycleState: "canary",
      version: baseline.definition.version,
      riskProfile: baseline.riskProfile,
      knowledgeSchema: baseline.knowledgeSchema,
      evalFramework: baseline.evalFramework,
      promptLibrary: baseline.promptLibrary,
      recipes: baseline.recipes,
      interactionRules: baseline.interactionRules,
      defaultToolBundleIds: baseline.definition.toolBundles.map((b) => b.bundleId),
      defaultWorkflowIds: baseline.definition.workflows.map((w) => w.workflowId),
      metaModelCompleteness: baseline.metaModelValidation.completeness,
      metaModelMissingQuestionIds: baseline.metaModelValidation.missingQuestionIds,
    });

    assert.ok(
      review.blockingEvaluatorIds.length > 0,
      `Domain ${baseline.domainId} should have blocking evaluators`,
    );
  }
});
