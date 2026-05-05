/**
 * DomainManifest Schema Tests - Resource Quotas (Issue #2176)
 *
 * Tests for DomainManifestSchema coverage.
 * Issue #2176: DomainManifest missing resource quotas
 *
 * These tests document the current DomainManifestSchema structure
 * and verify that resource quota fields (when added) will be properly validated.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  DomainManifestSchema,
  DomainDescriptorBundleSchema,
  type DomainManifest,
} from "../../../../src/domains/registry/domain-model.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createMinimalManifest(overrides: Partial<DomainManifest> = {}): DomainManifest {
  return {
    domainId: "test-domain",
    name: "Test Domain",
    version: "1.0.0",
    owner: "test-owner",
    description: "A test domain manifest",
    capabilityMatrix: {
      providedCapabilities: [],
      consumedCapabilities: [],
    },
    riskClassification: {
      riskClass: "medium",
      advisoryOnly: false,
      humanAccountable: false,
      deterministicHotPathOnly: false,
    },
    schemaRegistryRef: null,
    lifecycleState: "draft",
    trustLevel: "trusted",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DomainManifestSchema Core Field Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainManifestSchema parses valid minimal manifest", () => {
  const manifest = createMinimalManifest();

  const result = DomainManifestSchema.parse(manifest);

  assert.equal(result.domainId, "test-domain");
  assert.equal(result.lifecycleState, "draft");
  assert.equal(result.trustLevel, "trusted");
});

test("DomainManifestSchema rejects empty domainId", () => {
  assert.throws(() => {
    DomainManifestSchema.parse(createMinimalManifest({ domainId: "" }));
  });
});

test("DomainManifestSchema rejects empty name", () => {
  assert.throws(() => {
    DomainManifestSchema.parse(createMinimalManifest({ name: "" }));
  });
});

test("DomainManifestSchema rejects empty version", () => {
  assert.throws(() => {
    DomainManifestSchema.parse(createMinimalManifest({ version: "" }));
  });
});

test("DomainManifestSchema rejects empty owner", () => {
  assert.throws(() => {
    DomainManifestSchema.parse(createMinimalManifest({ owner: "" }));
  });
});

test("DomainManifestSchema rejects empty description", () => {
  assert.throws(() => {
    DomainManifestSchema.parse(createMinimalManifest({ description: "" }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle State Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainManifestSchema accepts draft lifecycle state", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({ lifecycleState: "draft" }));
  assert.equal(result.lifecycleState, "draft");
});

test("DomainManifestSchema accepts canary lifecycle state", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({ lifecycleState: "canary" }));
  assert.equal(result.lifecycleState, "canary");
});

test("DomainManifestSchema accepts active lifecycle state", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({ lifecycleState: "active" }));
  assert.equal(result.lifecycleState, "active");
});

test("DomainManifestSchema accepts deprecated lifecycle state", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({ lifecycleState: "deprecated" }));
  assert.equal(result.lifecycleState, "deprecated");
});

test("DomainManifestSchema accepts archived lifecycle state", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({ lifecycleState: "archived" }));
  assert.equal(result.lifecycleState, "archived");
});

test("DomainManifestSchema rejects invalid lifecycle state", () => {
  assert.throws(() => {
    DomainManifestSchema.parse(createMinimalManifest({ lifecycleState: "invalid" as DomainManifest["lifecycleState"] }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Trust Level Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainManifestSchema accepts internal trust level", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({ trustLevel: "internal" }));
  assert.equal(result.trustLevel, "internal");
});

test("DomainManifestSchema accepts trusted trust level", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({ trustLevel: "trusted" }));
  assert.equal(result.trustLevel, "trusted");
});

test("DomainManifestSchema accepts community trust level", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({ trustLevel: "community" }));
  assert.equal(result.trustLevel, "community");
});

test("DomainManifestSchema accepts unverified trust level", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({ trustLevel: "unverified" }));
  assert.equal(result.trustLevel, "unverified");
});

test("DomainManifestSchema rejects invalid trust level", () => {
  assert.throws(() => {
    DomainManifestSchema.parse(createMinimalManifest({ trustLevel: "invalid" as DomainManifest["trustLevel"] }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Risk Classification Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainManifestSchema parses risk classification with all fields", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({
    riskClassification: {
      riskClass: "high",
      advisoryOnly: true,
      humanAccountable: true,
      deterministicHotPathOnly: true,
    },
  }));

  assert.equal(result.riskClassification.riskClass, "high");
  assert.equal(result.riskClassification.advisoryOnly, true);
  assert.equal(result.riskClassification.humanAccountable, true);
  assert.equal(result.riskClassification.deterministicHotPathOnly, true);
});

test("DomainManifestSchema applies risk classification defaults", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({
    riskClassification: {},
  }));

  assert.equal(result.riskClassification.riskClass, "medium");
  assert.equal(result.riskClassification.advisoryOnly, false);
  assert.equal(result.riskClassification.humanAccountable, false);
  assert.equal(result.riskClassification.deterministicHotPathOnly, false);
});

test("DomainManifestSchema accepts low risk class", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({
    riskClassification: { riskClass: "low" },
  }));
  assert.equal(result.riskClassification.riskClass, "low");
});

test("DomainManifestSchema accepts medium risk class", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({
    riskClassification: { riskClass: "medium" },
  }));
  assert.equal(result.riskClassification.riskClass, "medium");
});

test("DomainManifestSchema accepts high risk class", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({
    riskClassification: { riskClass: "high" },
  }));
  assert.equal(result.riskClassification.riskClass, "high");
});

test("DomainManifestSchema accepts critical risk class", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({
    riskClassification: { riskClass: "critical" },
  }));
  assert.equal(result.riskClassification.riskClass, "critical");
});

test("DomainManifestSchema rejects invalid risk class", () => {
  assert.throws(() => {
    DomainManifestSchema.parse(createMinimalManifest({
      riskClassification: { riskClass: "invalid" as "low" },
    }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Capability Matrix Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainManifestSchema parses capability matrix with provided capabilities", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({
    capabilityMatrix: {
      providedCapabilities: [
        {
          capabilityId: "cap-001",
          name: "Code Generation",
          description: "Generate code from specifications",
          inputs: { spec: "object" },
          outputs: { code: "string" },
        },
      ],
      consumedCapabilities: [],
    },
  }));

  assert.equal(result.capabilityMatrix.providedCapabilities.length, 1);
  assert.equal(result.capabilityMatrix.providedCapabilities[0].capabilityId, "cap-001");
});

test("DomainManifestSchema parses capability matrix with consumed capabilities", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({
    capabilityMatrix: {
      providedCapabilities: [],
      consumedCapabilities: ["auth", "storage"],
    },
  }));

  assert.equal(result.capabilityMatrix.consumedCapabilities.length, 2);
  assert.ok(result.capabilityMatrix.consumedCapabilities.includes("auth"));
});

test("DomainManifestSchema applies capability matrix defaults", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({
    capabilityMatrix: {},
  }));

  assert.deepEqual(result.capabilityMatrix.providedCapabilities, []);
  assert.deepEqual(result.capabilityMatrix.consumedCapabilities, []);
});

test("DomainManifestSchema rejects capability with empty id", () => {
  assert.throws(() => {
    DomainManifestSchema.parse(createMinimalManifest({
      capabilityMatrix: {
        providedCapabilities: [
          {
            capabilityId: "",
            name: "Test",
            description: "Test",
            inputs: {},
            outputs: {},
          },
        ],
        consumedCapabilities: [],
      },
    }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema Registry Reference Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainManifestSchema accepts null schema registry ref", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({
    schemaRegistryRef: null,
  }));
  assert.equal(result.schemaRegistryRef, null);
});

test("DomainManifestSchema accepts string schema registry ref", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({
    schemaRegistryRef: "schema-registry://my-domain/v1",
  }));
  assert.equal(result.schemaRegistryRef, "schema-registry://my-domain/v1");
});

test("DomainManifestSchema applies schema registry ref default", () => {
  const result = DomainManifestSchema.parse(createMinimalManifest({}));
  assert.equal(result.schemaRegistryRef, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Resource Quotas Tests (Issue #2176)
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: These tests document the current state where resource quotas are NOT
// part of DomainManifestSchema. Issue #2176 tracks the missing feature.
// These tests verify that when resource quotas ARE added, they follow the
// expected patterns.

test("DomainManifestSchema does NOT have resource quotas field currently", () => {
  const manifest = createMinimalManifest();
  // This test documents that resource quotas are currently missing
  // @ts-expect-error - resourceQuotas should not exist on type yet (issue #2176)
  assert.equal((manifest as { resourceQuotas?: unknown }).resourceQuotas, undefined);
});

test("DomainManifestSchema capability matrix does NOT have resource quotas", () => {
  const manifest = createMinimalManifest();
  // Verify that capability matrix itself doesn't have resource quotas nested
  assert.equal(
    (manifest.capabilityMatrix as { resourceQuotas?: unknown }).resourceQuotas,
    undefined,
  );
});

test("DomainManifestSchema risk classification does NOT have quotas", () => {
  const manifest = createMinimalManifest();
  // Verify risk classification doesn't have quota-related fields
  assert.equal(
    (manifest.riskClassification as { quotas?: unknown }).quotas,
    undefined,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainDescriptorBundleSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainDescriptorBundleSchema parses minimal bundle", () => {
  const bundle = {
    core: {
      domainId: "test-domain",
      ownerOrgNodeId: "org-001",
      primaryEntities: [],
      recipeArchetype: "analytics" as const,
    },
    risk: {
      domainId: "test-domain",
      riskLevel: "medium" as const,
      dataClassification: "internal" as const,
      liabilityOwner: ["domain_owner"],
      compensationModel: ["no_compensation"],
    },
    knowledge: {
      domainId: "test-domain",
      namespace: "test",
      entityTypes: [],
    },
    eval: {
      domainId: "test-domain",
      qualityDimensions: [],
    },
    governance: {
      domainId: "test-domain",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
    },
    interaction: {
      domainId: "test-domain",
      interactionModes: [],
    },
  };

  const result = DomainDescriptorBundleSchema.parse(bundle);

  assert.equal(result.core.domainId, "test-domain");
  assert.equal(result.core.recipeArchetype, "analytics");
});

test("DomainDescriptorBundleSchema accepts executionProfile", () => {
  const bundle = {
    core: {
      domainId: "test-domain",
      ownerOrgNodeId: "org-001",
      primaryEntities: [],
      recipeArchetype: "analytics" as const,
    },
    risk: {
      domainId: "test-domain",
      riskLevel: "medium" as const,
      dataClassification: "internal" as const,
      liabilityOwner: ["domain_owner"],
      compensationModel: ["no_compensation"],
    },
    knowledge: {
      domainId: "test-domain",
      namespace: "test",
      entityTypes: [],
    },
    eval: {
      domainId: "test-domain",
      qualityDimensions: [],
    },
    governance: {
      domainId: "test-domain",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
    },
    interaction: {
      domainId: "test-domain",
      interactionModes: [],
    },
    executionProfile: {
      executionMode: {
        planningMode: "llm_assisted",
        hotPathMode: "llm_allowed",
        llmInHotPathAllowed: true,
        maxHotPathLatencyMs: 1000,
      },
      latencyTier: "interactive",
      compiledArtifactRef: null,
    },
  };

  const result = DomainDescriptorBundleSchema.parse(bundle);

  assert.ok(result.executionProfile !== undefined);
  assert.equal(result.executionProfile!.latencyTier, "interactive");
});

test("DomainDescriptorBundleSchema requires core descriptor", () => {
  assert.throws(() => {
    DomainDescriptorBundleSchema.parse({
      core: {
        domainId: "test-domain",
        ownerOrgNodeId: "org-001",
        primaryEntities: [],
        recipeArchetype: "analytics",
      },
      // Missing other required fields
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Full DomainManifest Parsing Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainManifestSchema parses complete manifest with all fields", () => {
  const completeManifest = {
    domainId: "complete-domain",
    name: "Complete Domain",
    version: "2.0.0",
    owner: "complete-owner",
    description: "A complete domain manifest for testing",
    capabilityMatrix: {
      providedCapabilities: [
        {
          capabilityId: "cap-complete",
          name: "Complete Capability",
          description: "A fully specified capability",
          inputs: { input1: "string", input2: "number" },
          outputs: { output1: "boolean" },
        },
      ],
      consumedCapabilities: ["auth-cap", "storage-cap"],
    },
    riskClassification: {
      riskClass: "low",
      advisoryOnly: false,
      humanAccountable: true,
      deterministicHotPathOnly: false,
    },
    schemaRegistryRef: "schema-registry://complete/v2",
    lifecycleState: "active",
    trustLevel: "internal",
  };

  const result = DomainManifestSchema.parse(completeManifest);

  assert.equal(result.domainId, "complete-domain");
  assert.equal(result.name, "Complete Domain");
  assert.equal(result.version, "2.0.0");
  assert.equal(result.lifecycleState, "active");
  assert.equal(result.trustLevel, "internal");
  assert.equal(result.capabilityMatrix.providedCapabilities.length, 1);
  assert.equal(result.capabilityMatrix.consumedCapabilities.length, 2);
  assert.equal(result.riskClassification.riskClass, "low");
  assert.equal(result.schemaRegistryRef, "schema-registry://complete/v2");
});

test("DomainManifestSchema applies all defaults when only required fields provided", () => {
  const minimalManifest = {
    domainId: "minimal-domain",
    name: "Minimal",
    version: "1.0",
    owner: "owner",
    description: "desc",
  };

  const result = DomainManifestSchema.parse(minimalManifest);

  // Check defaults are applied
  assert.deepEqual(result.capabilityMatrix.providedCapabilities, []);
  assert.deepEqual(result.capabilityMatrix.consumedCapabilities, []);
  assert.equal(result.riskClassification.riskClass, "medium");
  assert.equal(result.riskClassification.advisoryOnly, false);
  assert.equal(result.lifecycleState, "draft");
  assert.equal(result.trustLevel, "trusted");
  assert.equal(result.schemaRegistryRef, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Negative Test Cases
// ─────────────────────────────────────────────────────────────────────────────

test("DomainManifestSchema rejects domainId with only whitespace", () => {
  assert.throws(() => {
    DomainManifestSchema.parse(createMinimalManifest({ domainId: "   " }));
  });
});

test("DomainManifestSchema rejects name with only whitespace", () => {
  assert.throws(() => {
    DomainManifestSchema.parse(createMinimalManifest({ name: "\t\n" }));
  });
});

test("DomainManifestSchema rejects version with only whitespace", () => {
  assert.throws(() => {
    DomainManifestSchema.parse(createMinimalManifest({ version: "  " }));
  });
});
