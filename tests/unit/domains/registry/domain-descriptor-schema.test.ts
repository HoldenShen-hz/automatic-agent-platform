import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainDescriptorBundleSchema,
  DomainManifestSchema,
  type DomainDescriptorBundle,
} from "../../../../src/domains/registry/domain-model.js";
import {
  toResponsibilityBoundary,
  enforceResponsibilityBoundary,
  type DomainRiskSpec,
} from "../../../../src/domains/domain-specs.js";

// ─────────────────────────────────────────────────────────────────────────────
// DomainDescriptorBundleSchema Tests
// §37.2 v4.3: The 7 independent descriptors bundle
// ─────────────────────────────────────────────────────────────────────────────

test("DomainDescriptorBundleSchema parses valid bundle with all descriptors", () => {
  const bundle = DomainDescriptorBundleSchema.parse({
    core: {
      domainId: "test-domain",
      ownerOrgNodeId: "org-1",
      primaryEntities: ["entity-1", "entity-2"],
      recipeArchetype: "analytics",
      lifecycleState: "certified",
    },
    risk: {
      domainId: "test-domain",
      riskClass: "medium",
      advisoryOnly: false,
      humanAccountable: false,
      deterministicHotPathOnly: false,
      liabilityOwner: ["owner-1"],
      compensationModel: ["no_compensation"],
    },
    knowledge: {
      domainId: "test-domain",
      knowledgeSources: ["source-1"],
      accessControlPolicy: "restricted",
      freshnessPolicy: "real-time",
      conflictResolutionPolicy: "trust_priority",
    },
    eval: {
      domainId: "test-domain",
      evalBaselines: ["baseline-1"],
      criticalCases: ["case-1"],
      acceptanceThresholds: { accuracy: 0.95 },
      adversarialScenarios: ["scenario-1"],
    },
    governance: {
      domainId: "test-domain",
      hitlPolicy: "always_require",
      recertificationPolicy: "quarterly",
      waiverPolicy: "explicit_waiver_required",
      policyRefs: ["policy-1"],
    },
    interaction: {
      domainId: "test-domain",
      nlEntryPolicy: "direct_execute",
      dashboardPolicy: "simple_view",
      proactiveTriggerPolicy: "always",
      userExperiencePolicy: "developer_friendly",
    },
    executionProfile: {
      executionMode: {
        planningMode: "llm_assisted",
        hotPathMode: "llm_allowed",
        llmInHotPathAllowed: true,
        maxHotPathLatencyMs: 500,
      },
      latencyTier: "realtime",
      compiledArtifactRef: null,
    },
  });

  assert.equal(bundle.core.domainId, "test-domain");
  assert.equal(bundle.core.recipeArchetype, "analytics");
  assert.equal(bundle.risk.riskClass, "medium");
  assert.equal(bundle.knowledge.knowledgeSources.length, 1);
  assert.equal(bundle.eval.acceptanceThresholds.accuracy, 0.95);
  assert.equal(bundle.governance.hitlPolicy, "always_require");
  assert.equal(bundle.interaction.nlEntryPolicy, "direct_execute");
  assert.equal(bundle.executionProfile?.latencyTier, "realtime");
});

test("DomainDescriptorBundleSchema makes executionProfile optional", () => {
  const bundle = DomainDescriptorBundleSchema.parse({
    core: {
      domainId: "minimal-bundle",
      ownerOrgNodeId: "org-1",
      primaryEntities: [],
      recipeArchetype: "conversational",
      lifecycleState: "certified",
    },
    risk: {
      domainId: "minimal-bundle",
      riskClass: "low",
      liabilityOwner: ["owner"],
      compensationModel: ["no_compensation"],
    },
    knowledge: {
      domainId: "minimal-bundle",
    },
    eval: {
      domainId: "minimal-bundle",
    },
    governance: {
      domainId: "minimal-bundle",
    },
    interaction: {
      domainId: "minimal-bundle",
    },
  });

  assert.equal(bundle.executionProfile, undefined);
});

test("DomainDescriptorBundleSchema rejects invalid recipe archetype", () => {
  assert.throws(() => {
    DomainDescriptorBundleSchema.parse({
      core: {
        domainId: "bad-archetype",
        ownerOrgNodeId: "org-1",
        recipeArchetype: "invalid_archetype",
        lifecycleState: "certified",
      },
      risk: {
        domainId: "bad-archetype",
        riskClass: "low",
        liabilityOwner: ["owner"],
        compensationModel: ["no_compensation"],
      },
      knowledge: { domainId: "bad-archetype" },
      eval: { domainId: "bad-archetype" },
      governance: { domainId: "bad-archetype" },
      interaction: { domainId: "bad-archetype" },
    });
  }, /recipeArchetype/);
});

test("DomainDescriptorBundleSchema allows independent domainIds in descriptors (no cross-validation)", () => {
  // Note: The schema does not enforce domainId consistency across descriptors
  // Each descriptor has its own domainId field but they are not cross-validated
  const bundle = DomainDescriptorBundleSchema.parse({
    core: {
      domainId: "domain-a",
      ownerOrgNodeId: "org-1",
      recipeArchetype: "analytics",
      lifecycleState: "certified",
    },
    risk: {
      domainId: "domain-b",
      riskClass: "medium",
      liabilityOwner: ["owner"],
      compensationModel: ["no_compensation"],
    },
    knowledge: { domainId: "domain-c" },
    eval: { domainId: "domain-d" },
    governance: { domainId: "domain-e" },
    interaction: { domainId: "domain-f" },
  });

  // Each descriptor preserves its own domainId without validation
  assert.equal(bundle.core.domainId, "domain-a");
  assert.equal(bundle.risk.domainId, "domain-b");
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainManifestSchema Tests
// §37: Required for capability matrix/risk classification/schema registry reference
// ─────────────────────────────────────────────────────────────────────────────

test("DomainManifestSchema parses valid manifest", () => {
  const manifest = DomainManifestSchema.parse({
    domainId: "manifest-domain",
    name: "Manifest Domain",
    version: "1.0.0",
    owner: "team-alpha",
    description: "A domain manifest test",
    capabilityMatrix: {
      providedCapabilities: [
        {
          capabilityId: "cap-1",
          name: "Capability One",
          description: "First capability",
          inputs: { input1: "string" },
          outputs: { output1: "number" },
        },
      ],
      consumedCapabilities: ["external-cap-1"],
    },
    riskClassification: {
      riskClass: "high",
      advisoryOnly: false,
      humanAccountable: true,
      deterministicHotPathOnly: false,
    },
    schemaRegistryRef: "schema-registry/v1/manifest-domain",
    lifecycleState: "active",
    trustLevel: "trusted",
  });

  assert.equal(manifest.domainId, "manifest-domain");
  assert.equal(manifest.name, "Manifest Domain");
  assert.equal(manifest.version, "1.0.0");
  assert.equal(manifest.owner, "team-alpha");
  assert.equal(manifest.riskClassification.riskClass, "high");
  assert.equal(manifest.riskClassification.humanAccountable, true);
  assert.equal(manifest.lifecycleState, "active");
  assert.equal(manifest.trustLevel, "trusted");
  assert.equal(manifest.capabilityMatrix.providedCapabilities.length, 1);
  assert.equal(manifest.capabilityMatrix.consumedCapabilities.length, 1);
});

test("DomainManifestSchema applies all defaults", () => {
  const manifest = DomainManifestSchema.parse({
    domainId: "minimal-manifest",
    name: "Minimal Manifest",
    version: "2.0.0",
    owner: "team-beta",
    description: "Minimal test manifest",
  });

  assert.deepEqual(manifest.capabilityMatrix.providedCapabilities, []);
  assert.deepEqual(manifest.capabilityMatrix.consumedCapabilities, []);
  assert.equal(manifest.riskClassification.riskClass, "medium");
  assert.equal(manifest.riskClassification.advisoryOnly, false);
  assert.equal(manifest.riskClassification.humanAccountable, false);
  assert.equal(manifest.riskClassification.deterministicHotPathOnly, false);
  assert.equal(manifest.schemaRegistryRef, null);
  assert.equal(manifest.lifecycleState, "draft");
  assert.equal(manifest.trustLevel, "trusted");
});

test("DomainManifestSchema accepts all lifecycle states", () => {
  const states = ["draft", "canary", "active", "deprecated", "archived"] as const;
  for (const state of states) {
    const manifest = DomainManifestSchema.parse({
      domainId: `lifecycle-${state}`,
      name: `Domain ${state}`,
      version: "1.0.0",
      owner: "owner",
      description: `Testing lifecycle ${state}`,
      lifecycleState: state,
    });
    assert.equal(manifest.lifecycleState, state);
  }
});

test("DomainManifestSchema accepts all trust levels", () => {
  const levels = ["internal", "trusted", "community", "unverified"] as const;
  for (const level of levels) {
    const manifest = DomainManifestSchema.parse({
      domainId: `trust-${level}`,
      name: `Trust ${level}`,
      version: "1.0.0",
      owner: "owner",
      description: "Testing trust level",
      trustLevel: level,
    });
    assert.equal(manifest.trustLevel, level);
  }
});

test("DomainManifestSchema accepts all risk classes in riskClassification", () => {
  const classes = ["low", "medium", "high", "critical"] as const;
  for (const riskClass of classes) {
    const manifest = DomainManifestSchema.parse({
      domainId: `risk-class-${riskClass}`,
      name: `Risk Class ${riskClass}`,
      version: "1.0.0",
      owner: "owner",
      description: "Testing risk class",
      riskClassification: { riskClass },
    });
    assert.equal(manifest.riskClassification.riskClass, riskClass);
  }
});

test("DomainManifestSchema rejects empty domainId", () => {
  assert.throws(() => {
    DomainManifestSchema.parse({
      domainId: "",
      name: "Name",
      version: "1.0.0",
      owner: "owner",
      description: "desc",
    });
  }, /String must contain at least 1 character/);
});

test("DomainManifestSchema rejects empty name", () => {
  assert.throws(() => {
    DomainManifestSchema.parse({
      domainId: "valid-id",
      name: "",
      version: "1.0.0",
      owner: "owner",
      description: "desc",
    });
  }, /String must contain at least 1 character/);
});

test("DomainManifestSchema rejects empty version", () => {
  assert.throws(() => {
    DomainManifestSchema.parse({
      domainId: "valid-id",
      name: "Name",
      version: "",
      owner: "owner",
      description: "desc",
    });
  }, /String must contain at least 1 character/);
});

test("DomainManifestSchema rejects empty owner", () => {
  assert.throws(() => {
    DomainManifestSchema.parse({
      domainId: "valid-id",
      name: "Name",
      version: "1.0.0",
      owner: "",
      description: "desc",
    });
  }, /String must contain at least 1 character/);
});

test("DomainManifestSchema rejects empty description", () => {
  assert.throws(() => {
    DomainManifestSchema.parse({
      domainId: "valid-id",
      name: "Name",
      version: "1.0.0",
      owner: "owner",
      description: "",
    });
  }, /String must contain at least 1 character/);
});

test("DomainManifestSchema rejects invalid lifecycleState", () => {
  assert.throws(() => {
    DomainManifestSchema.parse({
      domainId: "invalid-lifecycle",
      name: "Name",
      version: "1.0.0",
      owner: "owner",
      description: "desc",
      lifecycleState: "invalid",
    });
  }, /lifecycleState/);
});

test("DomainManifestSchema rejects invalid trustLevel", () => {
  assert.throws(() => {
    DomainManifestSchema.parse({
      domainId: "invalid-trust",
      name: "Name",
      version: "1.0.0",
      owner: "owner",
      description: "desc",
      trustLevel: "super-secure",
    });
  }, /trustLevel/);
});

test("DomainManifestSchema capabilityMatrix defaults work", () => {
  const manifest = DomainManifestSchema.parse({
    domainId: "cap-test",
    name: "Capability Test",
    version: "1.0.0",
    owner: "owner",
    description: "Testing capability defaults",
  });

  assert.deepEqual(manifest.capabilityMatrix.providedCapabilities, []);
  assert.deepEqual(manifest.capabilityMatrix.consumedCapabilities, []);
});

test("DomainManifestSchema riskClassification defaults work", () => {
  const manifest = DomainManifestSchema.parse({
    domainId: "risk-test",
    name: "Risk Test",
    version: "1.0.0",
    owner: "owner",
    description: "Testing risk defaults",
  });

  assert.equal(manifest.riskClassification.riskClass, "medium");
  assert.equal(manifest.riskClassification.advisoryOnly, false);
  assert.equal(manifest.riskClassification.humanAccountable, false);
  assert.equal(manifest.riskClassification.deterministicHotPathOnly, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// toResponsibilityBoundary Tests
// Maps DomainRiskSpec flags to ResponsibilityBoundary
// ─────────────────────────────────────────────────────────────────────────────

test("toResponsibilityBoundary returns deterministic_hot_path_only when deterministicHotPathOnly is true", () => {
  const spec: DomainRiskSpec = {
    domainId: "test",
    riskClass: "high",
    advisoryOnly: false,
    humanAccountable: false,
    deterministicHotPathOnly: true,
    liabilityOwner: ["owner"],
    compensationModel: ["no_compensation"],
  };

  const boundary = toResponsibilityBoundary(spec);
  assert.equal(boundary, "deterministic_hot_path_only");
});

test("toResponsibilityBoundary returns human_accountable when humanAccountable is true", () => {
  const spec: DomainRiskSpec = {
    domainId: "test",
    riskClass: "high",
    advisoryOnly: false,
    humanAccountable: true,
    deterministicHotPathOnly: false,
    liabilityOwner: ["owner"],
    compensationModel: ["no_compensation"],
  };

  const boundary = toResponsibilityBoundary(spec);
  assert.equal(boundary, "human_accountable");
});

test("toResponsibilityBoundary returns advisory_only when advisoryOnly is true", () => {
  const spec: DomainRiskSpec = {
    domainId: "test",
    riskClass: "medium",
    advisoryOnly: true,
    humanAccountable: false,
    deterministicHotPathOnly: false,
    liabilityOwner: ["owner"],
    compensationModel: ["no_compensation"],
  };

  const boundary = toResponsibilityBoundary(spec);
  assert.equal(boundary, "advisory_only");
});

test("toResponsibilityBoundary returns fully_autonomous when all flags are false", () => {
  const spec: DomainRiskSpec = {
    domainId: "test",
    riskClass: "low",
    advisoryOnly: false,
    humanAccountable: false,
    deterministicHotPathOnly: false,
    liabilityOwner: ["owner"],
    compensationModel: ["no_compensation"],
  };

  const boundary = toResponsibilityBoundary(spec);
  assert.equal(boundary, "fully_autonomous");
});

test("toResponsibilityBoundary prioritizes deterministic_hot_path_only over human_accountable", () => {
  const spec: DomainRiskSpec = {
    domainId: "test",
    riskClass: "critical",
    advisoryOnly: false,
    humanAccountable: true,
    deterministicHotPathOnly: true,
    liabilityOwner: ["owner"],
    compensationModel: ["no_compensation"],
  };

  const boundary = toResponsibilityBoundary(spec);
  assert.equal(boundary, "deterministic_hot_path_only");
});

test("toResponsibilityBoundary prioritizes human_accountable over advisory_only", () => {
  const spec: DomainRiskSpec = {
    domainId: "test",
    riskClass: "high",
    advisoryOnly: true,
    humanAccountable: true,
    deterministicHotPathOnly: false,
    liabilityOwner: ["owner"],
    compensationModel: ["no_compensation"],
  };

  const boundary = toResponsibilityBoundary(spec);
  assert.equal(boundary, "human_accountable");
});

// ─────────────────────────────────────────────────────────────────────────────
// enforceResponsibilityBoundary Tests
// Enforces boundary levels at runtime
// ─────────────────────────────────────────────────────────────────────────────

test("enforceResponsibilityBoundary allows human_required for deterministic_hot_path_only", () => {
  const result = enforceResponsibilityBoundary("deterministic_hot_path_only", "human_required");
  assert.equal(result, null);
});

test("enforceResponsibilityBoundary rejects full_auto for deterministic_hot_path_only", () => {
  const result = enforceResponsibilityBoundary("deterministic_hot_path_only", "full_auto");
  assert.equal(result, "domain.responsibility_boundary.deterministic_only_violation");
});

test("enforceResponsibilityBoundary rejects llm_assisted for deterministic_hot_path_only", () => {
  const result = enforceResponsibilityBoundary("deterministic_hot_path_only", "llm_assisted");
  assert.equal(result, "domain.responsibility_boundary.deterministic_only_violation");
});

test("enforceResponsibilityBoundary allows human_required for human_accountable", () => {
  const result = enforceResponsibilityBoundary("human_accountable", "human_required");
  assert.equal(result, null);
});

test("enforceResponsibilityBoundary allows llm_assisted for human_accountable", () => {
  const result = enforceResponsibilityBoundary("human_accountable", "llm_assisted");
  assert.equal(result, null);
});

test("enforceResponsibilityBoundary rejects full_auto for human_accountable", () => {
  const result = enforceResponsibilityBoundary("human_accountable", "full_auto");
  assert.equal(result, "domain.responsibility_boundary.human_accountable_violation");
});

test("enforceResponsibilityBoundary allows all autonomy levels for advisory_only", () => {
  assert.equal(enforceResponsibilityBoundary("advisory_only", "full_auto"), null);
  assert.equal(enforceResponsibilityBoundary("advisory_only", "llm_assisted"), null);
  assert.equal(enforceResponsibilityBoundary("advisory_only", "human_required"), null);
});

test("enforceResponsibilityBoundary allows all autonomy levels for fully_autonomous", () => {
  assert.equal(enforceResponsibilityBoundary("fully_autonomous", "full_auto"), null);
  assert.equal(enforceResponsibilityBoundary("fully_autonomous", "llm_assisted"), null);
  assert.equal(enforceResponsibilityBoundary("fully_autonomous", "human_required"), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: DomainDescriptorBundleSchema with full DomainDefinition
// ─────────────────────────────────────────────────────────────────────────────

test("DomainDescriptorBundleSchema integrates with DomainDescriptorBundle type", () => {
  const bundle: DomainDescriptorBundle = {
    core: {
      domainId: "integration-test",
      ownerOrgNodeId: "org-1",
      primaryEntities: ["entity-1"],
      recipeArchetype: "analytics",
      lifecycleState: "active",
    },
    risk: {
      domainId: "integration-test",
      riskClass: "medium",
      advisoryOnly: false,
      humanAccountable: false,
      deterministicHotPathOnly: false,
      liabilityOwner: ["owner"],
      compensationModel: ["no_compensation"],
    },
    knowledge: {
      domainId: "integration-test",
      knowledgeSources: ["source-1"],
    },
    eval: {
      domainId: "integration-test",
      evalBaselines: [],
      criticalCases: [],
      acceptanceThresholds: {},
      adversarialScenarios: [],
    },
    governance: {
      domainId: "integration-test",
      policyRefs: [],
    },
    interaction: {
      domainId: "integration-test",
    },
  };

  const result = DomainDescriptorBundleSchema.parse(bundle);
  assert.equal(result.core.domainId, "integration-test");
  assert.equal(result.risk.riskClass, "medium");
});

test("DomainDescriptorBundleSchema handles all recipe archetypes", () => {
  const archetypes = [
    "crud_heavy",
    "analytics",
    "creative",
    "realtime",
    "trading",
    "compliance",
    "research",
    "adversarial",
    "moderation",
    "logistics",
    "conversational",
    "incident_ops",
  ] as const;

  for (const archetype of archetypes) {
    // Note: lifecycleState must be explicitly provided because the schema default "draft"
    // is not a valid DomainLifecycleStateSchema value (bug in source code)
    const bundle = DomainDescriptorBundleSchema.parse({
      core: {
        domainId: `archetype-${archetype}`,
        ownerOrgNodeId: "org-1",
        recipeArchetype: archetype,
        lifecycleState: "certified",
      },
      risk: {
        domainId: `archetype-${archetype}`,
        riskClass: "low",
        liabilityOwner: ["owner"],
        compensationModel: ["no_compensation"],
      },
      knowledge: { domainId: `archetype-${archetype}` },
      eval: { domainId: `archetype-${archetype}` },
      governance: { domainId: `archetype-${archetype}` },
      interaction: { domainId: `archetype-${archetype}` },
    });
    assert.equal(bundle.core.recipeArchetype, archetype);
  }
});
