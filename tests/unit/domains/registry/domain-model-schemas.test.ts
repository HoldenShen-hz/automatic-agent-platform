/**
 * Domain Model Schema Tests - Additional Coverage
 *
 * Tests for schemas not covered in domain-model.test.ts:
 * - DomainDescriptorBundleSchema
 * - DomainManifestSchema
 * - Status alias normalization (testing -> validated)
 * - Plugin type/role alias normalization
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  DomainDescriptorBundleSchema,
  DomainManifestSchema,
  DomainDefinitionSchema,
} from "../../../../src/domains/registry/domain-model.js";

// ─────────────────────────────────────────────────────────────────────────────
// DomainDescriptorBundleSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainDescriptorBundleSchema parses valid bundle", () => {
  const result = DomainDescriptorBundleSchema.parse({
    core: {
      domainId: "test-domain",
      name: "Test Domain",
      description: "A test domain",
      domainType: "operational",
      version: "1.0.0",
    },
    risk: {
      riskClass: "medium",
    },
    knowledge: {},
    eval: {},
    governance: {},
    interaction: {},
    executionProfile: {},
  });

  assert.equal(result.core.domainId, "test-domain");
  assert.equal(result.risk.riskClass, "medium");
});

test("DomainDescriptorBundleSchema allows optional executionProfile", () => {
  const result = DomainDescriptorBundleSchema.parse({
    core: {
      domainId: "test-domain",
      name: "Test Domain",
      description: "A test domain",
      domainType: "operational",
      version: "1.0.0",
    },
    risk: {},
    knowledge: {},
    eval: {},
    governance: {},
    interaction: {},
  });

  assert.equal(result.executionProfile, undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainManifestSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainManifestSchema parses valid manifest", () => {
  const result = DomainManifestSchema.parse({
    domainId: "manifest-domain",
    name: "Manifest Domain",
    version: "1.0.0",
    owner: "test-owner",
    description: "A manifest test domain",
    capabilityMatrix: {
      providedCapabilities: [
        {
          capabilityId: "cap-1",
          name: "Test Capability",
          description: "A test capability",
          inputs: { key: "value" },
          outputs: { result: "output" },
        },
      ],
      consumedCapabilities: ["external-cap"],
    },
    riskClassification: {
      riskClass: "high",
      advisoryOnly: false,
      humanAccountable: true,
      deterministicHotPathOnly: false,
    },
    schemaRegistryRef: "registry://test-schema",
    lifecycleState: "active",
    trustLevel: "internal",
  });

  assert.equal(result.domainId, "manifest-domain");
  assert.equal(result.lifecycleState, "active");
  assert.equal(result.trustLevel, "internal");
  assert.equal(result.capabilityMatrix.providedCapabilities.length, 1);
  assert.equal(result.riskClassification.riskClass, "high");
});

test("DomainManifestSchema applies defaults for optional fields", () => {
  const result = DomainManifestSchema.parse({
    domainId: "minimal-domain",
    name: "Minimal Domain",
    version: "1.0.0",
    owner: "owner",
    description: "A minimal domain",
  });

  assert.deepEqual(result.capabilityMatrix, { providedCapabilities: [], consumedCapabilities: [] });
  assert.equal(result.riskClassification.riskClass, "medium");
  assert.equal(result.riskClassification.advisoryOnly, false);
  assert.equal(result.riskClassification.humanAccountable, false);
  assert.equal(result.riskClassification.deterministicHotPathOnly, false);
  assert.equal(result.schemaRegistryRef, null);
  assert.equal(result.lifecycleState, "draft");
  assert.equal(result.trustLevel, "trusted");
});

test("DomainManifestSchema rejects invalid riskClass", () => {
  assert.throws(() => {
    DomainManifestSchema.parse({
      domainId: "d1",
      name: "N",
      version: "1.0.0",
      owner: "O",
      description: "D",
      riskClassification: { riskClass: "invalid" },
    });
  });
});

test("DomainManifestSchema rejects invalid lifecycleState", () => {
  assert.throws(() => {
    DomainManifestSchema.parse({
      domainId: "d1",
      name: "N",
      version: "1.0.0",
      owner: "O",
      description: "D",
      lifecycleState: "invalid_state",
    });
  });
});

test("DomainManifestSchema rejects invalid trustLevel", () => {
  assert.throws(() => {
    DomainManifestSchema.parse({
      domainId: "d1",
      name: "N",
      version: "1.0.0",
      owner: "O",
      description: "D",
      trustLevel: "super_trusted",
    });
  });
});

test("DomainManifestSchema accepts all valid lifecycle states", () => {
  const states = ["draft", "canary", "active", "deprecated", "archived"] as const;
  for (const state of states) {
    const result = DomainManifestSchema.parse({
      domainId: "d1",
      name: "N",
      version: "1.0.0",
      owner: "O",
      description: "D",
      lifecycleState: state,
    });
    assert.equal(result.lifecycleState, state);
  }
});

test("DomainManifestSchema accepts all valid risk classes", () => {
  const riskClasses = ["low", "medium", "high", "critical"] as const;
  for (const riskClass of riskClasses) {
    const result = DomainManifestSchema.parse({
      domainId: "d1",
      name: "N",
      version: "1.0.0",
      owner: "O",
      description: "D",
      riskClassification: { riskClass },
    });
    assert.equal(result.riskClassification.riskClass, riskClass);
  }
});

test("DomainManifestSchema accepts all valid trust levels", () => {
  const levels = ["internal", "trusted", "community", "unverified"] as const;
  for (const level of levels) {
    const result = DomainManifestSchema.parse({
      domainId: "d1",
      name: "N",
      version: "1.0.0",
      owner: "O",
      description: "D",
      trustLevel: level,
    });
    assert.equal(result.trustLevel, level);
  }
});

test("DomainManifestSchema parses capability matrix with empty arrays", () => {
  const result = DomainManifestSchema.parse({
    domainId: "d1",
    name: "N",
    version: "1.0.0",
    owner: "O",
    description: "D",
    capabilityMatrix: {
      providedCapabilities: [],
      consumedCapabilities: [],
    },
  });

  assert.equal(result.capabilityMatrix.providedCapabilities.length, 0);
  assert.equal(result.capabilityMatrix.consumedCapabilities.length, 0);
});

test("DomainManifestSchema rejects empty domainId", () => {
  assert.throws(() => {
    DomainManifestSchema.parse({
      domainId: "",
      name: "N",
      version: "1.0.0",
      owner: "O",
      description: "D",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainDefinitionSchema Status Alias Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainDefinitionSchema normalizes testing status to validated", () => {
  const result = DomainDefinitionSchema.parse({
    domainId: "status-alias-domain",
    name: "Status Alias Domain",
    description: "Testing status alias",
    version: 1,
    workflows: [],
    toolBundles: [],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {},
    status: "testing",
    externalAdapters: [],
    pluginBindings: [],
  });

  // testing should be normalized to validated
  assert.equal(result.status, "validated");
});

test("DomainDefinitionSchema preserves other statuses", () => {
  const states = ["draft", "canary", "active", "deprecated", "archived"] as const;
  for (const state of states) {
    const result = DomainDefinitionSchema.parse({
      domainId: "d1",
      name: "N",
      description: "D",
      version: 1,
      workflows: [],
      toolBundles: [],
      outputContracts: [],
      promptOverrides: {},
      capabilities: {},
      status,
      externalAdapters: [],
      pluginBindings: [],
    });
    assert.equal(result.status, state);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Plugin Binding Type Alias Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainDefinitionSchema normalizes planner pluginType to tool", () => {
  const result = DomainDefinitionSchema.parse({
    domainId: "plugin-alias-domain",
    name: "Plugin Alias Domain",
    description: "Testing plugin type alias",
    version: 1,
    workflows: [],
    toolBundles: [],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {},
    pluginBindings: [
      {
        bindingId: "b1",
        domainId: "plugin-alias-domain",
        pluginType: "planner",
        pluginId: "planner-plugin",
      },
    ],
    externalAdapters: [],
  });

  // planner should be normalized to tool
  assert.equal(result.pluginBindings[0]!.pluginType, "tool");
});

test("DomainDefinitionSchema normalizes presenter pluginType to tool", () => {
  const result = DomainDefinitionSchema.parse({
    domainId: "plugin-alias-domain",
    name: "Plugin Alias Domain",
    description: "Testing presenter alias",
    version: 1,
    workflows: [],
    toolBundles: [],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {},
    pluginBindings: [
      {
        bindingId: "b1",
        domainId: "plugin-alias-domain",
        pluginType: "presenter",
        pluginId: "presenter-plugin",
      },
    ],
    externalAdapters: [],
  });

  // presenter should be normalized to tool
  assert.equal(result.pluginBindings[0]!.pluginType, "tool");
});

test("DomainDefinitionSchema normalizes validator pluginType to evaluator", () => {
  const result = DomainDefinitionSchema.parse({
    domainId: "plugin-alias-domain",
    name: "Plugin Alias Domain",
    description: "Testing validator alias",
    version: 1,
    workflows: [],
    toolBundles: [],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {},
    pluginBindings: [
      {
        bindingId: "b1",
        domainId: "plugin-alias-domain",
        pluginType: "validator",
        pluginId: "validator-plugin",
      },
    ],
    externalAdapters: [],
  });

  // validator should be normalized to evaluator
  assert.equal(result.pluginBindings[0]!.pluginType, "evaluator");
});

test("DomainDefinitionSchema preserves standard plugin types", () => {
  const standardTypes = ["tool", "adapter", "retriever", "evaluator"] as const;
  for (const type of standardTypes) {
    const result = DomainDefinitionSchema.parse({
      domainId: "d1",
      name: "N",
      description: "D",
      version: 1,
      workflows: [],
      toolBundles: [],
      outputContracts: [],
      promptOverrides: {},
      capabilities: {},
      pluginBindings: [
        {
          bindingId: "b1",
          domainId: "d1",
          pluginType: type,
          pluginId: "plugin-1",
        },
      ],
      externalAdapters: [],
    });
    assert.equal(result.pluginBindings[0]!.pluginType, type);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// WorkflowConfigSchema Non-Linear Steps Tests
// ─────────────────────────────────────────────────────────────────────────────

test("WorkflowConfigSchema supports stepGraph for explicit DAG", () => {
  const result = DomainDefinitionSchema.parse({
    domainId: "dag-domain",
    name: "DAG Domain",
    description: "Testing step graph",
    version: 1,
    workflows: [
      {
        workflowId: "dag-workflow",
        name: "DAG Workflow",
        steps: [
          { stepName: "start", toolHints: [], modelHints: {}, outputSchema: null, retryPolicy: { maxRetries: 0, backoffMs: 0 }, requiresReview: false, timeoutMs: 60000, dependsOn: [] },
          { stepName: "process", toolHints: [], modelHints: {}, outputSchema: null, retryPolicy: { maxRetries: 0, backoffMs: 0 }, requiresReview: false, timeoutMs: 60000, dependsOn: ["start"] },
          { stepName: "end", toolHints: [], modelHints: {}, outputSchema: null, retryPolicy: { maxRetries: 0, backoffMs: 0 }, requiresReview: false, timeoutMs: 60000, dependsOn: ["process"] },
        ],
        stepGraph: {
          edges: [
            { fromStep: "start", toStep: "process", condition: null },
            { fromStep: "process", toStep: "end", condition: null },
          ],
        },
      },
    ],
    toolBundles: [],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {},
    externalAdapters: [],
    pluginBindings: [],
  });

  assert.equal(result.workflows[0]!.steps.length, 3);
  assert.equal(result.workflows[0]!.stepGraph?.edges.length, 2);
});

test("WorkflowConfigSchema allows steps without stepGraph (implicit linear)", () => {
  const result = DomainDefinitionSchema.parse({
    domainId: "linear-domain",
    name: "Linear Domain",
    description: "Testing linear steps",
    version: 1,
    workflows: [
      {
        workflowId: "linear-workflow",
        name: "Linear Workflow",
        steps: [
          { stepName: "step1", toolHints: [], modelHints: {}, outputSchema: null, retryPolicy: { maxRetries: 0, backoffMs: 0 }, requiresReview: false, timeoutMs: 60000, dependsOn: [] },
          { stepName: "step2", toolHints: [], modelHints: {}, outputSchema: null, retryPolicy: { maxRetries: 0, backoffMs: 0 }, requiresReview: false, timeoutMs: 60000, dependsOn: ["step1"] },
        ],
      },
    ],
    toolBundles: [],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {},
    externalAdapters: [],
    pluginBindings: [],
  });

  assert.equal(result.workflows[0]!.steps.length, 2);
  assert.equal(result.workflows[0]!.stepGraph, undefined);
});
