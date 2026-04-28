import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainRiskSpecSchema,
  DomainLifecycleStateSchema,
  DomainPlanningModeSchema,
  DomainHotPathModeSchema,
  DomainExecutionProfileSchema,
  DomainCoreDescriptorSchema,
  DomainKnowledgeSpecSchema,
  DomainEvalSpecSchema,
  DomainGovernanceSpecSchema,
  DomainInteractionSpecSchema,
  resolveDomainRiskSpec,
  type DomainRiskSpec,
} from "../../../src/domains/domain-specs.js";

// ─────────────────────────────────────────────────────────────────────────────
// DomainRiskSpec Tests (R8-28: advisory_only, human_accountable, deterministic_hot_path_only)
// ─────────────────────────────────────────────────────────────────────────────

test("DomainRiskSpecSchema accepts valid risk spec", () => {
  const spec = DomainRiskSpecSchema.parse({
    domainId: "test-domain",
    riskClass: "high",
    advisoryOnly: false,
    humanAccountable: true,
    deterministicHotPathOnly: true,
    liabilityOwner: ["owner1"],
    compensationModel: ["manual_repair"],
    sideEffectTypes: [],
    approvalThresholds: {},
  });

  assert.equal(spec.domainId, "test-domain");
  assert.equal(spec.riskClass, "high");
  assert.equal(spec.advisoryOnly, false);
  assert.equal(spec.humanAccountable, true);
  assert.equal(spec.deterministicHotPathOnly, true);
});

test("DomainRiskSpecSchema defaults advisoryOnly to false", () => {
  const spec = DomainRiskSpecSchema.parse({
    domainId: "minimal",
    riskClass: "medium",
    liabilityOwner: ["owner1"],
    compensationModel: ["no_compensation"],
  });

  assert.equal(spec.advisoryOnly, false);
});

test("DomainRiskSpecSchema defaults humanAccountable to false", () => {
  const spec = DomainRiskSpecSchema.parse({
    domainId: "minimal",
    riskClass: "medium",
    liabilityOwner: ["owner1"],
    compensationModel: ["no_compensation"],
  });

  assert.equal(spec.humanAccountable, false);
});

test("DomainRiskSpecSchema defaults deterministicHotPathOnly to false", () => {
  const spec = DomainRiskSpecSchema.parse({
    domainId: "minimal",
    riskClass: "medium",
    liabilityOwner: ["owner1"],
    compensationModel: ["no_compensation"],
  });

  assert.equal(spec.deterministicHotPathOnly, false);
});

test("DomainRiskSpecSchema accepts all risk classes", () => {
  const classes = ["low", "medium", "high", "critical"] as const;
  for (const rc of classes) {
    const spec = DomainRiskSpecSchema.parse({
      domainId: `domain-${rc}`,
      riskClass: rc,
      liabilityOwner: ["owner1"],
      compensationModel: ["no_compensation"],
    });
    assert.equal(spec.riskClass, rc);
  }
});

test("DomainRiskSpecSchema accepts all compensation models", () => {
  const models = ["refund", "reversal", "appeal", "manual_repair", "no_compensation"] as const;
  const spec = DomainRiskSpecSchema.parse({
    domainId: "compensation-test",
    riskClass: "medium",
    liabilityOwner: ["owner1"],
    compensationModel: models,
  });

  assert.deepEqual(spec.compensationModel, models);
});

test("DomainRiskSpecSchema rejects empty liabilityOwner", () => {
  assert.throws(() => {
    DomainRiskSpecSchema.parse({
      domainId: "bad",
      riskClass: "high",
      liabilityOwner: [],
      compensationModel: ["manual_repair"],
    });
  }, /liabilityOwner.*minimum/);
});

test("DomainRiskSpecSchema rejects empty compensationModel", () => {
  assert.throws(() => {
    DomainRiskSpecSchema.parse({
      domainId: "bad",
      riskClass: "high",
      liabilityOwner: ["owner1"],
      compensationModel: [],
    });
  }, /compensationModel.*minimum/);
});

test("DomainRiskSpecSchema rejects empty domainId", () => {
  assert.throws(() => {
    DomainRiskSpecSchema.parse({
      domainId: "",
      riskClass: "high",
      liabilityOwner: ["owner1"],
      compensationModel: ["manual_repair"],
    });
  }, /domainId.*minimum/);
});

test("DomainRiskSpecSchema rejects invalid risk class", () => {
  assert.throws(() => {
    DomainRiskSpecSchema.parse({
      domainId: "bad",
      riskClass: "invalid",
      liabilityOwner: ["owner1"],
      compensationModel: ["manual_repair"],
    });
  }, /riskClass/);
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveDomainRiskSpec Tests
// ─────────────────────────────────────────────────────────────────────────────

test("resolveDomainRiskSpec returns healthcare spec with advisoryOnly true", () => {
  const spec = resolveDomainRiskSpec("healthcare");
  assert.notEqual(spec, null);
  assert.equal(spec!.advisoryOnly, true);
  assert.equal(spec!.humanAccountable, true);
  assert.equal(spec!.deterministicHotPathOnly, true);
  assert.equal(spec!.riskClass, "critical");
});

test("resolveDomainRiskSpec returns quant-trading spec with correct flags", () => {
  const spec = resolveDomainRiskSpec("quant-trading");
  assert.notEqual(spec, null);
  assert.equal(spec!.advisoryOnly, false);
  assert.equal(spec!.humanAccountable, true);
  assert.equal(spec!.deterministicHotPathOnly, true);
  assert.equal(spec!.riskClass, "high");
});

test("resolveDomainRiskSpec returns financial-services spec", () => {
  const spec = resolveDomainRiskSpec("financial-services");
  assert.notEqual(spec, null);
  assert.equal(spec!.advisoryOnly, false);
  assert.equal(spec!.humanAccountable, true);
  assert.equal(spec!.deterministicHotPathOnly, true);
  assert.equal(spec!.riskClass, "high");
});

test("resolveDomainRiskSpec returns legal spec with advisoryOnly true", () => {
  const spec = resolveDomainRiskSpec("legal");
  assert.notEqual(spec, null);
  assert.equal(spec!.advisoryOnly, true);
  assert.equal(spec!.humanAccountable, true);
  assert.equal(spec!.deterministicHotPathOnly, true);
  assert.equal(spec!.riskClass, "critical");
});

test("resolveDomainRiskSpec is case-insensitive", () => {
  const spec1 = resolveDomainRiskSpec("HEALTHCARE");
  const spec2 = resolveDomainRiskSpec("Healthcare");
  const spec3 = resolveDomainRiskSpec("healthcare");

  assert.notEqual(spec1, null);
  assert.notEqual(spec2, null);
  assert.notEqual(spec3, null);
  assert.equal(spec1!.riskClass, spec2!.riskClass);
  assert.equal(spec2!.riskClass, spec3!.riskClass);
});

test("resolveDomainRiskSpec trims whitespace", () => {
  const spec = resolveDomainRiskSpec("  healthcare  ");
  assert.notEqual(spec, null);
  assert.equal(spec!.riskClass, "critical");
});

test("resolveDomainRiskSpec returns null for unknown domain", () => {
  const spec = resolveDomainRiskSpec("unknown-domain");
  assert.equal(spec, null);
});

test("resolveDomainRiskSpec returns null for empty string", () => {
  const spec = resolveDomainRiskSpec("");
  assert.equal(spec, null);
});

test("resolveDomainRiskSpec returns spec with default sideEffectTypes and approvalThresholds", () => {
  const spec = resolveDomainRiskSpec("healthcare");
  assert.notEqual(spec, null);
  assert.deepEqual(spec!.sideEffectTypes, []);
  assert.deepEqual(spec!.approvalThresholds, {});
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainLifecycleStateSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainLifecycleStateSchema accepts all valid states", () => {
  const states = ["draft", "validated", "registered", "active", "updating", "deprecated", "archived"] as const;
  for (const state of states) {
    const parsed = DomainLifecycleStateSchema.parse(state);
    assert.equal(parsed, state);
  }
});

test("DomainLifecycleStateSchema rejects invalid state", () => {
  assert.throws(() => {
    DomainLifecycleStateSchema.parse("invalid");
  }, /invalid/);
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainPlanningModeSchema and DomainHotPathModeSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainPlanningModeSchema accepts valid modes", () => {
  assert.equal(DomainPlanningModeSchema.parse("llm_assisted"), "llm_assisted");
  assert.equal(DomainPlanningModeSchema.parse("deterministic_only"), "deterministic_only");
});

test("DomainHotPathModeSchema accepts valid modes", () => {
  assert.equal(DomainHotPathModeSchema.parse("llm_allowed"), "llm_allowed");
  assert.equal(DomainHotPathModeSchema.parse("deterministic_only"), "deterministic_only");
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainExecutionProfileSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainExecutionProfileSchema accepts valid profile", () => {
  const profile = DomainExecutionProfileSchema.parse({
    executionMode: {
      planningMode: "llm_assisted",
      hotPathMode: "llm_allowed",
      llmInHotPathAllowed: true,
      maxHotPathLatencyMs: 500,
    },
    latencyTier: "realtime",
    compiledArtifactRef: "ref/v1",
  });

  assert.equal(profile.executionMode.planningMode, "llm_assisted");
  assert.equal(profile.executionMode.hotPathMode, "llm_allowed");
  assert.equal(profile.executionMode.llmInHotPathAllowed, true);
  assert.equal(profile.executionMode.maxHotPathLatencyMs, 500);
  assert.equal(profile.latencyTier, "realtime");
  assert.equal(profile.compiledArtifactRef, "ref/v1");
});

test("DomainExecutionProfileSchema provides defaults", () => {
  const profile = DomainExecutionProfileSchema.parse({});

  assert.equal(profile.executionMode.planningMode, "llm_assisted");
  assert.equal(profile.executionMode.hotPathMode, "llm_allowed");
  assert.equal(profile.executionMode.llmInHotPathAllowed, true);
  assert.equal(profile.executionMode.maxHotPathLatencyMs, 1000);
  assert.equal(profile.latencyTier, "interactive");
  assert.equal(profile.compiledArtifactRef, null);
});

test("DomainExecutionProfileSchema accepts all latency tiers", () => {
  const tiers = ["realtime", "near_realtime", "interactive", "batch"] as const;
  for (const tier of tiers) {
    const profile = DomainExecutionProfileSchema.parse({ latencyTier: tier });
    assert.equal(profile.latencyTier, tier);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainCoreDescriptorSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainCoreDescriptorSchema accepts valid descriptor", () => {
  const descriptor = DomainCoreDescriptorSchema.parse({
    domainId: "test",
    ownerOrgNodeId: "org1",
    primaryEntities: ["entity1"],
    recipeArchetype: "analytics",
    lifecycleState: "draft",
  });

  assert.equal(descriptor.domainId, "test");
  assert.equal(descriptor.ownerOrgNodeId, "org1");
  assert.deepEqual(descriptor.primaryEntities, ["entity1"]);
  assert.equal(descriptor.recipeArchetype, "analytics");
  assert.equal(descriptor.lifecycleState, "draft");
});

test("DomainCoreDescriptorSchema defaults primaryEntities and lifecycleState", () => {
  const descriptor = DomainCoreDescriptorSchema.parse({
    domainId: "test",
    ownerOrgNodeId: "org1",
    recipeArchetype: "analytics",
  });

  assert.deepEqual(descriptor.primaryEntities, []);
  assert.equal(descriptor.lifecycleState, "draft");
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainKnowledgeSpecSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainKnowledgeSpecSchema accepts valid spec", () => {
  const spec = DomainKnowledgeSpecSchema.parse({
    domainId: "test",
    knowledgeSources: ["source1"],
    accessControlPolicy: "restricted",
    freshnessPolicy: "real-time",
    conflictResolutionPolicy: "latest_wins",
  });

  assert.equal(spec.domainId, "test");
  assert.deepEqual(spec.knowledgeSources, ["source1"]);
  assert.equal(spec.accessControlPolicy, "restricted");
});

test("DomainKnowledgeSpecSchema defaults access control policy", () => {
  const spec = DomainKnowledgeSpecSchema.parse({
    domainId: "test",
  });

  assert.equal(spec.accessControlPolicy, "platform_default");
  assert.equal(spec.freshnessPolicy, "scheduled_refresh");
  assert.equal(spec.conflictResolutionPolicy, "trust_priority");
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainEvalSpecSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainEvalSpecSchema accepts valid spec", () => {
  const spec = DomainEvalSpecSchema.parse({
    domainId: "test",
    evalBaselines: ["baseline1"],
    criticalCases: ["case1"],
    acceptanceThresholds: { accuracy: 0.95 },
    adversarialScenarios: ["scenario1"],
  });

  assert.equal(spec.domainId, "test");
  assert.deepEqual(spec.evalBaselines, ["baseline1"]);
  assert.deepEqual(spec.acceptanceThresholds, { accuracy: 0.95 });
});

test("DomainEvalSpecSchema defaults arrays and records", () => {
  const spec = DomainEvalSpecSchema.parse({
    domainId: "test",
  });

  assert.deepEqual(spec.evalBaselines, []);
  assert.deepEqual(spec.criticalCases, []);
  assert.deepEqual(spec.acceptanceThresholds, {});
  assert.deepEqual(spec.adversarialScenarios, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainGovernanceSpecSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernanceSpecSchema accepts valid spec", () => {
  const spec = DomainGovernanceSpecSchema.parse({
    domainId: "test",
    hitlPolicy: "always_require",
    recertificationPolicy: "quarterly",
    waiverPolicy: "no_waiver",
    policyRefs: ["policy1"],
  });

  assert.equal(spec.hitlPolicy, "always_require");
  assert.equal(spec.recertificationPolicy, "quarterly");
});

test("DomainGovernanceSpecSchema defaults policies", () => {
  const spec = DomainGovernanceSpecSchema.parse({
    domainId: "test",
  });

  assert.equal(spec.hitlPolicy, "platform_default");
  assert.equal(spec.recertificationPolicy, "annual");
  assert.equal(spec.waiverPolicy, "explicit_waiver_required");
  assert.deepEqual(spec.policyRefs, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainInteractionSpecSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainInteractionSpecSchema accepts valid spec", () => {
  const spec = DomainInteractionSpecSchema.parse({
    domainId: "test",
    nlEntryPolicy: "direct_execute",
    dashboardPolicy: "simple_view",
    proactiveTriggerPolicy: "always",
    userExperiencePolicy: "developer_friendly",
  });

  assert.equal(spec.nlEntryPolicy, "direct_execute");
  assert.equal(spec.dashboardPolicy, "simple_view");
});

test("DomainInteractionSpecSchema defaults policies", () => {
  const spec = DomainInteractionSpecSchema.parse({
    domainId: "test",
  });

  assert.equal(spec.nlEntryPolicy, "clarify_before_execute");
  assert.equal(spec.dashboardPolicy, "evidence_backed");
  assert.equal(spec.proactiveTriggerPolicy, "budget_gated");
  assert.equal(spec.userExperiencePolicy, "operator_friendly");
});
