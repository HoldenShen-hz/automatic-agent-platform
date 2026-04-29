/**
 * Golden Test: Domain Spec Schema Output
 *
 * Verifies domain-specs.ts produces correct domain definition structure
 * for domain registration, risk specs, and governance policies.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  DomainLifecycleStateSchema,
  DomainPlanningModeSchema,
  DomainHotPathModeSchema,
  DomainExecutionProfileSchema,
  DomainCoreDescriptorSchema,
  DomainRiskSpecSchema,
  DomainKnowledgeSpecSchema,
  DomainEvalSpecSchema,
  DomainGovernanceSpecSchema,
  DomainInteractionSpecSchema,
  toResponsibilityBoundary,
  enforceResponsibilityBoundary,
  resolveDomainRiskSpec,
  type DomainRiskSpec,
  type DomainLifecycleState,
} from "../../src/domains/domain-specs.js";
import { assertGolden } from "../helpers/golden.js";

test("golden: DomainLifecycleState enum values are valid", () => {
  const validStates: DomainLifecycleState[] = [
    "validating",
    "certified",
    "canary",
    "active",
    "deprecated",
    "retired",
  ];

  for (const state of validStates) {
    const result = DomainLifecycleStateSchema.safeParse(state);
    assert.equal(result.success, true, `State ${state} should be valid`);
  }

  const invalidState = DomainLifecycleStateSchema.safeParse("invalid_state");
  assert.equal(invalidState.success, false, "Invalid state should fail");

  assertGolden("domain-lifecycle-state-enum-v1", {
    validStates,
    totalStates: validStates.length,
  });
});

test("golden: DomainPlanningMode and DomainHotPathMode enums are valid", () => {
  const planningModes = ["llm_assisted", "deterministic_only"];
  const hotPathModes = ["deterministic_only", "llm_allowed"];

  for (const mode of planningModes) {
    const result = DomainPlanningModeSchema.safeParse(mode);
    assert.equal(result.success, true, `Planning mode ${mode} should be valid`);
  }

  for (const mode of hotPathModes) {
    const result = DomainHotPathModeSchema.safeParse(mode);
    assert.equal(result.success, true, `Hot path mode ${mode} should be valid`);
  }

  assertGolden("domain-mode-enums-v1", {
    planningModes,
    hotPathModes,
  });
});

test("golden: DomainExecutionProfile schema produces correct structure", () => {
  const validProfile = {
    executionMode: {
      planningMode: "llm_assisted",
      hotPathMode: "llm_allowed",
      llmInHotPathAllowed: true,
      maxHotPathLatencyMs: 500,
    },
    latencyTier: "interactive",
    compiledArtifactRef: "artifact://compiled/domain-profile",
  };

  const parsed = DomainExecutionProfileSchema.parse(validProfile);

  assert.equal(parsed.executionMode.planningMode, "llm_assisted");
  assert.equal(parsed.executionMode.hotPathMode, "llm_allowed");
  assert.equal(parsed.executionMode.llmInHotPathAllowed, true);
  assert.equal(parsed.executionMode.maxHotPathLatencyMs, 500);
  assert.equal(parsed.latencyTier, "interactive");
  assert.equal(parsed.compiledArtifactRef, "artifact://compiled/domain-profile");

  assertGolden("domain-execution-profile-v1", {
    planningMode: parsed.executionMode.planningMode,
    hotPathMode: parsed.executionMode.hotPathMode,
    llmInHotPathAllowed: parsed.executionMode.llmInHotPathAllowed,
    maxHotPathLatencyMs: parsed.executionMode.maxHotPathLatencyMs,
    latencyTier: parsed.latencyTier,
  });
});

test("golden: DomainExecutionProfile defaults are applied", () => {
  const minimalProfile = {};

  const parsed = DomainExecutionProfileSchema.parse(minimalProfile);

  assert.equal(parsed.executionMode.planningMode, "llm_assisted");
  assert.equal(parsed.executionMode.hotPathMode, "llm_allowed");
  assert.equal(parsed.executionMode.llmInHotPathAllowed, true);
  assert.equal(parsed.executionMode.maxHotPathLatencyMs, 1000);
  assert.equal(parsed.latencyTier, "interactive");
  assert.equal(parsed.compiledArtifactRef, null);

  assertGolden("domain-execution-profile-defaults-v1", {
    planningMode: parsed.executionMode.planningMode,
    hotPathMode: parsed.executionMode.hotPathMode,
    llmInHotPathAllowed: parsed.executionMode.llmInHotPathAllowed,
    maxHotPathLatencyMs: parsed.executionMode.maxHotPathLatencyMs,
    latencyTier: parsed.latencyTier,
    compiledArtifactRef: parsed.compiledArtifactRef,
  });
});

test("golden: DomainCoreDescriptor schema produces correct structure", () => {
  const validDescriptor = {
    domainId: "healthcare",
    ownerOrgNodeId: "org_healthcare",
    primaryEntities: ["patient", "diagnosis", "treatment"],
    recipeArchetype: "compliance",
    lifecycleState: "certified",
  };

  const parsed = DomainCoreDescriptorSchema.parse(validDescriptor);

  assert.equal(parsed.domainId, "healthcare");
  assert.equal(parsed.ownerOrgNodeId, "org_healthcare");
  assert.deepEqual(parsed.primaryEntities, ["patient", "diagnosis", "treatment"]);
  assert.equal(parsed.recipeArchetype, "compliance");
  assert.equal(parsed.lifecycleState, "certified");

  assertGolden("domain-core-descriptor-v1", {
    domainId: parsed.domainId,
    ownerOrgNodeId: parsed.ownerOrgNodeId,
    primaryEntityCount: parsed.primaryEntities.length,
    recipeArchetype: parsed.recipeArchetype,
    lifecycleState: parsed.lifecycleState,
  });
});

test("golden: DomainRiskSpec schema produces correct structure", () => {
  const validRiskSpec = {
    domainId: "financial-services",
    riskClass: "high",
    advisoryOnly: false,
    humanAccountable: true,
    deterministicHotPathOnly: true,
    allowedCapabilityOverrides: ["override_1", "override_2"],
    requiredApprovalPolicies: ["policy_1"],
    liabilityOwner: ["financial-services-owners"],
    compensationModel: ["reversal", "manual_repair"],
    sideEffectTypes: ["payment", "transfer"],
    approvalThresholds: { errorRate: 0.01, latencyP99: 200 },
  };

  const parsed = DomainRiskSpecSchema.parse(validRiskSpec);

  assert.equal(parsed.domainId, "financial-services");
  assert.equal(parsed.riskClass, "high");
  assert.equal(parsed.advisoryOnly, false);
  assert.equal(parsed.humanAccountable, true);
  assert.equal(parsed.deterministicHotPathOnly, true);
  assert.deepEqual(parsed.allowedCapabilityOverrides, ["override_1", "override_2"]);
  assert.deepEqual(parsed.requiredApprovalPolicies, ["policy_1"]);
  assert.deepEqual(parsed.liabilityOwner, ["financial-services-owners"]);
  assert.deepEqual(parsed.compensationModel, ["reversal", "manual_repair"]);
  assert.deepEqual(parsed.sideEffectTypes, ["payment", "transfer"]);
  assert.deepEqual(parsed.approvalThresholds, { errorRate: 0.01, latencyP99: 200 });

  assertGolden("domain-risk-spec-v1", {
    domainId: parsed.domainId,
    riskClass: parsed.riskClass,
    humanAccountable: parsed.humanAccountable,
    deterministicHotPathOnly: parsed.deterministicHotPathOnly,
    liabilityOwnerCount: parsed.liabilityOwner.length,
    compensationModelCount: parsed.compensationModel.length,
  });
});

test("golden: DomainRiskSpec liabilityOwner and compensationModel are required", () => {
  // Missing liabilityOwner should fail
  const missingLiability = {
    domainId: "test",
    riskClass: "medium",
    compensationModel: ["refund"],
  };

  const result1 = DomainRiskSpecSchema.safeParse(missingLiability);
  assert.equal(result1.success, false, "Missing liabilityOwner should fail");

  // Missing compensationModel should fail
  const missingCompensation = {
    domainId: "test",
    riskClass: "medium",
    liabilityOwner: ["test-owners"],
  };

  const result2 = DomainRiskSpecSchema.safeParse(missingCompensation);
  assert.equal(result2.success, false, "Missing compensationModel should fail");

  assertGolden("domain-risk-spec-required-fields-v1", {
    missingLiabilityFails: !result1.success,
    missingCompensationFails: !result2.success,
  });
});

test("golden: DomainKnowledgeSpec schema produces correct structure", () => {
  const validKnowledgeSpec = {
    domainId: "legal",
    knowledgeSources: ["source_1", "source_2"],
    accessControlPolicy: "restricted",
    freshnessPolicy: "real_time",
    conflictResolutionPolicy: "priority_based",
  };

  const parsed = DomainKnowledgeSpecSchema.parse(validKnowledgeSpec);

  assert.equal(parsed.domainId, "legal");
  assert.deepEqual(parsed.knowledgeSources, ["source_1", "source_2"]);
  assert.equal(parsed.accessControlPolicy, "restricted");
  assert.equal(parsed.freshnessPolicy, "real_time");
  assert.equal(parsed.conflictResolutionPolicy, "priority_based");

  assertGolden("domain-knowledge-spec-v1", {
    domainId: parsed.domainId,
    knowledgeSourceCount: parsed.knowledgeSources.length,
    accessControlPolicy: parsed.accessControlPolicy,
    freshnessPolicy: parsed.freshnessPolicy,
  });
});

test("golden: DomainKnowledgeSpec defaults are applied", () => {
  const minimalSpec = { domainId: "test" };

  const parsed = DomainKnowledgeSpecSchema.parse(minimalSpec);

  assert.deepEqual(parsed.knowledgeSources, []);
  assert.equal(parsed.accessControlPolicy, "platform_default");
  assert.equal(parsed.freshnessPolicy, "scheduled_refresh");
  assert.equal(parsed.conflictResolutionPolicy, "trust_priority");

  assertGolden("domain-knowledge-spec-defaults-v1", {
    domainId: parsed.domainId,
    knowledgeSourceCount: parsed.knowledgeSources.length,
    accessControlPolicy: parsed.accessControlPolicy,
    freshnessPolicy: parsed.freshnessPolicy,
  });
});

test("golden: DomainEvalSpec schema produces correct structure", () => {
  const validEvalSpec = {
    domainId: "ecommerce",
    evalBaselines: ["baseline_1", "baseline_2"],
    criticalCases: ["case_1", "case_2", "case_3"],
    acceptanceThresholds: { accuracy: 0.95, latency: 100 },
    adversarialScenarios: ["scenario_1", "scenario_2"],
  };

  const parsed = DomainEvalSpecSchema.parse(validEvalSpec);

  assert.equal(parsed.domainId, "ecommerce");
  assert.deepEqual(parsed.evalBaselines, ["baseline_1", "baseline_2"]);
  assert.deepEqual(parsed.criticalCases, ["case_1", "case_2", "case_3"]);
  assert.deepEqual(parsed.acceptanceThresholds, { accuracy: 0.95, latency: 100 });
  assert.deepEqual(parsed.adversarialScenarios, ["scenario_1", "scenario_2"]);

  assertGolden("domain-eval-spec-v1", {
    domainId: parsed.domainId,
    baselineCount: parsed.evalBaselines.length,
    criticalCaseCount: parsed.criticalCases.length,
    adversarialScenarioCount: parsed.adversarialScenarios.length,
  });
});

test("golden: DomainGovernanceSpec schema produces correct structure", () => {
  const validGovernanceSpec = {
    domainId: "government",
    hitlPolicy: "always_require_human",
    recertificationPolicy: "quarterly",
    waiverPolicy: "no_waivers",
    policyRefs: ["policy_gov_001", "policy_gov_002"],
  };

  const parsed = DomainGovernanceSpecSchema.parse(validGovernanceSpec);

  assert.equal(parsed.domainId, "government");
  assert.equal(parsed.hitlPolicy, "always_require_human");
  assert.equal(parsed.recertificationPolicy, "quarterly");
  assert.equal(parsed.waiverPolicy, "no_waivers");
  assert.deepEqual(parsed.policyRefs, ["policy_gov_001", "policy_gov_002"]);

  assertGolden("domain-governance-spec-v1", {
    domainId: parsed.domainId,
    hitlPolicy: parsed.hitlPolicy,
    recertificationPolicy: parsed.recertificationPolicy,
    waiverPolicy: parsed.waiverPolicy,
    policyRefCount: parsed.policyRefs.length,
  });
});

test("golden: DomainInteractionSpec schema produces correct structure", () => {
  const validInteractionSpec = {
    domainId: "customer-service",
    nlEntryPolicy: "confirm_before_act",
    dashboardPolicy: "full_visibility",
    proactiveTriggerPolicy: "always",
    userExperiencePolicy: "conversational",
  };

  const parsed = DomainInteractionSpecSchema.parse(validInteractionSpec);

  assert.equal(parsed.domainId, "customer-service");
  assert.equal(parsed.nlEntryPolicy, "confirm_before_act");
  assert.equal(parsed.dashboardPolicy, "full_visibility");
  assert.equal(parsed.proactiveTriggerPolicy, "always");
  assert.equal(parsed.userExperiencePolicy, "conversational");

  assertGolden("domain-interaction-spec-v1", {
    domainId: parsed.domainId,
    nlEntryPolicy: parsed.nlEntryPolicy,
    dashboardPolicy: parsed.dashboardPolicy,
    proactiveTriggerPolicy: parsed.proactiveTriggerPolicy,
  });
});

test("golden: toResponsibilityBoundary maps risk flags correctly", () => {
  // deterministicHotPathOnly -> deterministic_hot_path_only
  const spec1: DomainRiskSpec = {
    domainId: "test1",
    riskClass: "high",
    advisoryOnly: false,
    humanAccountable: false,
    deterministicHotPathOnly: true,
    liabilityOwner: ["test"],
    compensationModel: ["manual_repair"],
  };
  assert.equal(toResponsibilityBoundary(spec1), "deterministic_hot_path_only");

  // humanAccountable -> human_accountable
  const spec2: DomainRiskSpec = {
    domainId: "test2",
    riskClass: "high",
    advisoryOnly: false,
    humanAccountable: true,
    deterministicHotPathOnly: false,
    liabilityOwner: ["test"],
    compensationModel: ["manual_repair"],
  };
  assert.equal(toResponsibilityBoundary(spec2), "human_accountable");

  // advisoryOnly -> advisory_only
  const spec3: DomainRiskSpec = {
    domainId: "test3",
    riskClass: "medium",
    advisoryOnly: true,
    humanAccountable: false,
    deterministicHotPathOnly: false,
    liabilityOwner: ["test"],
    compensationModel: ["no_compensation"],
  };
  assert.equal(toResponsibilityBoundary(spec3), "advisory_only");

  // none -> fully_autonomous
  const spec4: DomainRiskSpec = {
    domainId: "test4",
    riskClass: "low",
    advisoryOnly: false,
    humanAccountable: false,
    deterministicHotPathOnly: false,
    liabilityOwner: ["test"],
    compensationModel: ["refund"],
  };
  assert.equal(toResponsibilityBoundary(spec4), "fully_autonomous");

  assertGolden("to-responsibility-boundary-v1", {
    deterministicOnly: toResponsibilityBoundary(spec1),
    humanAccountable: toResponsibilityBoundary(spec2),
    advisoryOnly: toResponsibilityBoundary(spec3),
    fullyAutonomous: toResponsibilityBoundary(spec4),
  });
});

test("golden: enforceResponsibilityBoundary validates autonomy levels", () => {
  // deterministic_hot_path_only allows only human_required
  const result1 = enforceResponsibilityBoundary("deterministic_hot_path_only", "human_required");
  assert.equal(result1, null, "human_required should be allowed");

  const result2 = enforceResponsibilityBoundary("deterministic_hot_path_only", "full_auto");
  assert.equal(result2, "domain.responsibility_boundary.deterministic_only_violation");

  const result3 = enforceResponsibilityBoundary("deterministic_hot_path_only", "llm_assisted");
  assert.equal(result3, "domain.responsibility_boundary.deterministic_only_violation");

  // human_accountable allows human_required and llm_assisted, blocks full_auto
  const result4 = enforceResponsibilityBoundary("human_accountable", "full_auto");
  assert.equal(result4, "domain.responsibility_boundary.human_accountable_violation");

  const result5 = enforceResponsibilityBoundary("human_accountable", "llm_assisted");
  assert.equal(result5, null);

  // advisory_only and fully_autonomous allow all
  const result6 = enforceResponsibilityBoundary("advisory_only", "full_auto");
  assert.equal(result6, null);

  const result7 = enforceResponsibilityBoundary("fully_autonomous", "full_auto");
  assert.equal(result7, null);

  assertGolden("enforce-responsibility-boundary-v1", {
    deterministicAllowsHumanRequired: result1 === null,
    deterministicBlocksFullAuto: result2 !== null,
    deterministicBlocksLlmAssisted: result3 !== null,
    humanAccountableBlocksFullAuto: result4 !== null,
    humanAccountableAllowsLlmAssisted: result5 === null,
    advisoryAllowsFullAuto: result6 === null,
    fullyAllowsFullAuto: result7 === null,
  });
});

test("golden: resolveDomainRiskSpec returns predefined risk specs", () => {
  // Healthcare domain
  const healthcareSpec = resolveDomainRiskSpec("healthcare");
  assert.ok(healthcareSpec !== null, "Healthcare spec should exist");
  if (healthcareSpec) {
    assert.equal(healthcareSpec.riskClass, "critical");
    assert.equal(healthcareSpec.advisoryOnly, true);
    assert.equal(healthcareSpec.humanAccountable, true);
    assert.equal(healthcareSpec.deterministicHotPathOnly, true);
  }

  // Quant trading domain
  const quantSpec = resolveDomainRiskSpec("quant-trading");
  assert.ok(quantSpec !== null, "Quant trading spec should exist");
  if (quantSpec) {
    assert.equal(quantSpec.riskClass, "high");
    assert.equal(quantSpec.humanAccountable, true);
  }

  // Financial services domain
  const financialSpec = resolveDomainRiskSpec("financial-services");
  assert.ok(financialSpec !== null, "Financial services spec should exist");
  if (financialSpec) {
    assert.equal(financialSpec.riskClass, "high");
    assert.equal(financialSpec.deterministicHotPathOnly, true);
  }

  // Legal domain
  const legalSpec = resolveDomainRiskSpec("legal");
  assert.ok(legalSpec !== null, "Legal spec should exist");
  if (legalSpec) {
    assert.equal(legalSpec.riskClass, "critical");
    assert.equal(legalSpec.advisoryOnly, true);
  }

  // Unknown domain returns null
  const unknownSpec = resolveDomainRiskSpec("unknown-domain");
  assert.equal(unknownSpec, null, "Unknown domain should return null");

  assertGolden("resolve-domain-risk-spec-v1", {
    healthcareRiskClass: healthcareSpec?.riskClass,
    healthcareAdvisoryOnly: healthcareSpec?.advisoryOnly,
    quantRiskClass: quantSpec?.riskClass,
    financialRiskClass: financialSpec?.riskClass,
    legalRiskClass: legalSpec?.riskClass,
    unknownIsNull: unknownSpec === null,
  });
});

test("golden: resolveDomainRiskSpec normalizes domain ID", () => {
  // Whitespace normalization
  const spec1 = resolveDomainRiskSpec("  healthcare  ");
  assert.ok(spec1 !== null);

  // Case normalization
  const spec2 = resolveDomainRiskSpec("HEALTHCARE");
  assert.ok(spec2 !== null);

  // Both normalization
  const spec3 = resolveDomainRiskSpec("  QUANT-TRADING  ");
  assert.ok(spec3 !== null);

  assertGolden("resolve-domain-risk-spec-normalization-v1", {
    whitespaceNormalized: spec1 !== null,
    caseNormalized: spec2 !== null,
    bothNormalized: spec3 !== null,
  });
});

test("golden: DomainRiskSpec riskClass enum values are valid", () => {
  const validClasses = ["low", "medium", "high", "critical"] as const;

  for (const riskClass of validClasses) {
    const spec = {
      domainId: "test",
      riskClass,
      liabilityOwner: ["test"],
      compensationModel: ["refund"],
    };
    const parsed = DomainRiskSpecSchema.parse(spec);
    assert.equal(parsed.riskClass, riskClass);
  }

  assertGolden("domain-risk-class-enum-v1", {
    validClasses,
    totalClasses: validClasses.length,
  });
});