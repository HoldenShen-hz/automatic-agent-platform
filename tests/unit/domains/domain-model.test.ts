import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainManifestSchema,
  DomainDefinitionSchema,
  DomainCapabilityProfileSchema,
  PluginBindingSchema,
  StepTemplateConfigSchema,
  WorkflowConfigSchema,
  ToolBundleConfigSchema,
  OutputContractConfigSchema,
  type DomainManifest,
  type DomainDefinition,
} from "../../../src/domains/registry/domain-model.js";

// ─────────────────────────────────────────────────────────────────────────────
// DomainManifestSchema Tests (R8-27)
// ─────────────────────────────────────────────────────────────────────────────

test("DomainManifestSchema accepts valid manifest", () => {
  const manifest = DomainManifestSchema.parse({
    domainId: "test-domain",
    name: "Test Domain",
    version: "1.0.0",
    owner: "test-owner",
    description: "A test domain",
    capabilityMatrix: {
      providedCapabilities: [
        {
          capabilityId: "cap1",
          name: "Capability 1",
          description: "Test capability",
          inputs: { param1: "string" },
          outputs: { result: "string" },
        },
      ],
      consumedCapabilities: ["external-cap"],
    },
    riskClassification: {
      riskClass: "high",
      advisoryOnly: false,
      humanAccountable: true,
      deterministicHotPathOnly: true,
    },
    schemaRegistryRef: "schema/v1",
    lifecycleState: "active",
    trustLevel: "trusted",
  });

  assert.equal(manifest.domainId, "test-domain");
  assert.equal(manifest.name, "Test Domain");
  assert.equal(manifest.version, "1.0.0");
  assert.equal(manifest.riskClassification.riskClass, "high");
  assert.equal(manifest.riskClassification.humanAccountable, true);
  assert.equal(manifest.schemaRegistryRef, "schema/v1");
});

test("DomainManifestSchema defaults riskClassification", () => {
  const manifest = DomainManifestSchema.parse({
    domainId: "minimal",
    name: "Minimal",
    version: "1.0",
    owner: "owner",
    description: "desc",
  });

  assert.equal(manifest.riskClassification.riskClass, "medium");
  assert.equal(manifest.riskClassification.advisoryOnly, false);
  assert.equal(manifest.riskClassification.humanAccountable, false);
  assert.equal(manifest.riskClassification.deterministicHotPathOnly, false);
});

test("DomainManifestSchema defaults schemaRegistryRef to null", () => {
  const manifest = DomainManifestSchema.parse({
    domainId: "minimal",
    name: "Minimal",
    version: "1.0",
    owner: "owner",
    description: "desc",
  });

  assert.equal(manifest.schemaRegistryRef, null);
});

test("DomainManifestSchema defaults lifecycleState to draft", () => {
  const manifest = DomainManifestSchema.parse({
    domainId: "minimal",
    name: "Minimal",
    version: "1.0",
    owner: "owner",
    description: "desc",
  });

  assert.equal(manifest.lifecycleState, "draft");
});

test("DomainManifestSchema defaults trustLevel to trusted", () => {
  const manifest = DomainManifestSchema.parse({
    domainId: "minimal",
    name: "Minimal",
    version: "1.0",
    owner: "owner",
    description: "desc",
  });

  assert.equal(manifest.trustLevel, "trusted");
});

test("DomainManifestSchema accepts all trust levels", () => {
  const levels = ["internal", "trusted", "community", "unverified"] as const;
  for (const level of levels) {
    const manifest = DomainManifestSchema.parse({
      domainId: `trust-${level}`,
      name: "Test",
      version: "1.0",
      owner: "owner",
      description: "desc",
      trustLevel: level,
    });
    assert.equal(manifest.trustLevel, level);
  }
});

test("DomainManifestSchema accepts empty capabilityMatrix", () => {
  const manifest = DomainManifestSchema.parse({
    domainId: "minimal",
    name: "Minimal",
    version: "1.0",
    owner: "owner",
    description: "desc",
    capabilityMatrix: {},
  });

  assert.deepEqual(manifest.capabilityMatrix.providedCapabilities, []);
  assert.deepEqual(manifest.capabilityMatrix.consumedCapabilities, []);
});

test("DomainManifestSchema rejects empty domainId", () => {
  assert.throws(() => {
    DomainManifestSchema.parse({
      domainId: "",
      name: "Test",
      version: "1.0",
      owner: "owner",
      description: "desc",
    });
  }, /domainId.*minimum/);
});

test("DomainManifestSchema rejects empty name", () => {
  assert.throws(() => {
    DomainManifestSchema.parse({
      domainId: "valid",
      name: "",
      version: "1.0",
      owner: "owner",
      description: "desc",
    });
  }, /name.*minimum/);
});

// ─────────────────────────────────────────────────────────────────────────────
// PluginBindingSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PluginBindingSchema accepts valid binding", () => {
  const binding = PluginBindingSchema.parse({
    bindingId: "b1",
    domainId: "test-domain",
    pluginType: "tool",
    pluginId: "plugin-1",
    priority: 1,
    enabled: true,
    config: { key: "value" },
  });

  assert.equal(binding.bindingId, "b1");
  assert.equal(binding.pluginType, "tool");
  assert.equal(binding.pluginId, "plugin-1");
  assert.equal(binding.priority, 1);
  assert.equal(binding.enabled, true);
});

test("PluginBindingSchema defaults priority and enabled", () => {
  const binding = PluginBindingSchema.parse({
    bindingId: "b1",
    domainId: "test-domain",
    pluginType: "tool",
    pluginId: "plugin-1",
  });

  assert.equal(binding.priority, 0);
  assert.equal(binding.enabled, true);
  assert.deepEqual(binding.config, {});
});

test("PluginBindingSchema normalizes planner plugin type to tool", () => {
  const binding = PluginBindingSchema.parse({
    bindingId: "b1",
    domainId: "test-domain",
    pluginType: "planner",
    pluginId: "planner-1",
  });

  assert.equal(binding.pluginType, "tool");
  assert.equal(binding.bindingRole, "planner");
});

test("PluginBindingSchema normalizes presenter plugin type to tool", () => {
  const binding = PluginBindingSchema.parse({
    bindingId: "b1",
    domainId: "test-domain",
    pluginType: "presenter",
    pluginId: "presenter-1",
  });

  assert.equal(binding.pluginType, "tool");
  assert.equal(binding.bindingRole, "presenter");
});

test("PluginBindingSchema normalizes validator plugin type to evaluator", () => {
  const binding = PluginBindingSchema.parse({
    bindingId: "b1",
    domainId: "test-domain",
    pluginType: "validator",
    pluginId: "validator-1",
  });

  assert.equal(binding.pluginType, "evaluator");
  assert.equal(binding.bindingRole, "validator");
});

test("PluginBindingSchema accepts all standard plugin types", () => {
  const types = ["tool", "adapter", "retriever", "evaluator"] as const;
  for (const type of types) {
    const binding = PluginBindingSchema.parse({
      bindingId: `b-${type}`,
      domainId: "test",
      pluginType: type,
      pluginId: "p1",
    });
    assert.equal(binding.pluginType, type);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// StepTemplateConfigSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("StepTemplateConfigSchema accepts valid step config", () => {
  const step = StepTemplateConfigSchema.parse({
    stepName: "myStep",
    toolHints: ["tool1", "tool2"],
    modelHints: { preferredModel: "claude-3", temperature: 0.7 },
    outputSchema: { result: "string" },
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
    requiresReview: true,
    timeoutMs: 30000,
    dependsOn: ["otherStep"],
  });

  assert.equal(step.stepName, "myStep");
  assert.deepEqual(step.toolHints, ["tool1", "tool2"]);
  assert.equal(step.modelHints.preferredModel, "claude-3");
  assert.equal(step.requiresReview, true);
  assert.equal(step.timeoutMs, 30000);
  assert.deepEqual(step.dependsOn, ["otherStep"]);
});

test("StepTemplateConfigSchema defaults optional fields", () => {
  const step = StepTemplateConfigSchema.parse({
    stepName: "minimalStep",
  });

  assert.deepEqual(step.toolHints, []);
  assert.deepEqual(step.modelHints, {});
  assert.equal(step.outputSchema, null);
  assert.equal(step.retryPolicy.maxRetries, 0);
  assert.equal(step.requiresReview, false);
  assert.equal(step.timeoutMs, 60000);
  assert.deepEqual(step.dependsOn, []);
});

test("StepTemplateConfigSchema rejects empty stepName", () => {
  assert.throws(() => {
    StepTemplateConfigSchema.parse({ stepName: "" });
  }, /stepName.*minimum/);
});

test("StepTemplateConfigSchema rejects negative maxRetries", () => {
  assert.throws(() => {
    StepTemplateConfigSchema.parse({
      stepName: "step",
      retryPolicy: { maxRetries: -1, backoffMs: 0 },
    });
  }, /maxRetries.*nonnegative/);
});

test("StepTemplateConfigSchema rejects negative backoffMs", () => {
  assert.throws(() => {
    StepTemplateConfigSchema.parse({
      stepName: "step",
      retryPolicy: { maxRetries: 0, backoffMs: -1 },
    });
  }, /backoffMs.*nonnegative/);
});

test("StepTemplateConfigSchema rejects invalid temperature", () => {
  assert.throws(() => {
    StepTemplateConfigSchema.parse({
      stepName: "step",
      modelHints: { temperature: 3.0 },
    });
  }, /temperature.*max/);
});

// ─────────────────────────────────────────────────────────────────────────────
// WorkflowConfigSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("WorkflowConfigSchema accepts valid workflow config", () => {
  const workflow = WorkflowConfigSchema.parse({
    workflowId: "wf1",
    name: "My Workflow",
    triggerConditions: { status: "active" },
    steps: [
      {
        stepName: "step1",
        toolHints: ["read"],
        modelHints: {},
        outputSchema: null,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
        requiresReview: false,
        timeoutMs: 1000,
        dependsOn: [],
      },
    ],
    stepGraph: {
      edges: [
        { fromStep: "step1", toStep: "step2", condition: null },
      ],
    },
  });

  assert.equal(workflow.workflowId, "wf1");
  assert.equal(workflow.name, "My Workflow");
  assert.deepEqual(workflow.steps, expect.any(Array));
});

test("WorkflowConfigSchema defaults triggerConditions and steps", () => {
  const workflow = WorkflowConfigSchema.parse({
    workflowId: "minimal",
    name: "Minimal Workflow",
  });

  assert.deepEqual(workflow.triggerConditions, {});
  assert.deepEqual(workflow.steps, []);
  assert.equal(workflow.stepGraph, undefined);
});

test("WorkflowConfigSchema rejects empty workflowId", () => {
  assert.throws(() => {
    WorkflowConfigSchema.parse({
      workflowId: "",
      name: "Test",
    });
  }, /workflowId.*minimum/);
});

test("WorkflowConfigSchema rejects empty name", () => {
  assert.throws(() => {
    WorkflowConfigSchema.parse({
      workflowId: "valid",
      name: "",
    });
  }, /name.*minimum/);
});

// ─────────────────────────────────────────────────────────────────────────────
// ToolBundleConfigSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ToolBundleConfigSchema accepts valid tool bundle", () => {
  const bundle = ToolBundleConfigSchema.parse({
    bundleId: "bundle1",
    tools: [
      { toolName: "read", enabled: true, configOverrides: {} },
      { toolName: "write", enabled: false, configOverrides: { mode: "append" } },
    ],
  });

  assert.equal(bundle.bundleId, "bundle1");
  assert.equal(bundle.tools.length, 2);
  assert.equal(bundle.tools[0]!.toolName, "read");
  assert.equal(bundle.tools[1]!.enabled, false);
});

test("ToolBundleConfigSchema defaults tools to empty array", () => {
  const bundle = ToolBundleConfigSchema.parse({ bundleId: "minimal" });
  assert.deepEqual(bundle.tools, []);
});

test("ToolBundleConfigSchema rejects empty bundleId", () => {
  assert.throws(() => {
    ToolBundleConfigSchema.parse({ bundleId: "" });
  }, /bundleId.*minimum/);
});

// ─────────────────────────────────────────────────────────────────────────────
// OutputContractConfigSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("OutputContractConfigSchema accepts valid contract", () => {
  const contract = OutputContractConfigSchema.parse({
    contractId: "contract1",
    name: "Output Contract",
    schema: { type: "object", properties: { result: { type: "string" } } },
    validationLevel: "strict",
  });

  assert.equal(contract.contractId, "contract1");
  assert.equal(contract.validationLevel, "strict");
});

test("OutputContractConfigSchema defaults validationLevel", () => {
  const contract = OutputContractConfigSchema.parse({
    contractId: "minimal",
    name: "Minimal",
  });

  assert.equal(contract.validationLevel, "strict");
  assert.deepEqual(contract.schema, {});
});

test("OutputContractConfigSchema accepts all validation levels", () => {
  const levels = ["strict", "lenient", "none"] as const;
  for (const level of levels) {
    const contract = OutputContractConfigSchema.parse({
      contractId: `level-${level}`,
      name: "Test",
      validationLevel: level,
    });
    assert.equal(contract.validationLevel, level);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainCapabilityProfileSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainCapabilityProfileSchema accepts valid profile", () => {
  const profile = DomainCapabilityProfileSchema.parse({
    supportedTaskTypes: ["task", "workflow"],
    requiredTools: ["read", "write"],
    optionalTools: ["bash"],
    modelPreferences: { default: "claude-3" },
    budgetLimits: { maxTokensPerTask: 8000, maxCostPerTask: 10 },
    securityLevel: "elevated",
  });

  assert.deepEqual(profile.supportedTaskTypes, ["task", "workflow"]);
  assert.deepEqual(profile.requiredTools, ["read", "write"]);
  assert.equal(profile.securityLevel, "elevated");
});

test("DomainCapabilityProfileSchema defaults all optional fields", () => {
  const profile = DomainCapabilityProfileSchema.parse({});

  assert.deepEqual(profile.supportedTaskTypes, []);
  assert.deepEqual(profile.requiredTools, []);
  assert.deepEqual(profile.optionalTools, []);
  assert.deepEqual(profile.modelPreferences, {});
  assert.equal(profile.budgetLimits.maxTokensPerTask, 4000);
  assert.equal(profile.budgetLimits.maxCostPerTask, 5);
  assert.equal(profile.securityLevel, "standard");
});

test("DomainCapabilityProfileSchema accepts all security levels", () => {
  const levels = ["standard", "elevated", "restricted"] as const;
  for (const level of levels) {
    const profile = DomainCapabilityProfileSchema.parse({ securityLevel: level });
    assert.equal(profile.securityLevel, level);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainDefinitionSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainDefinitionSchema accepts valid definition", () => {
  const definition = DomainDefinitionSchema.parse({
    domainId: "def-domain",
    name: "Definition Domain",
    description: "A domain definition",
    version: 2,
    workflows: [],
    toolBundles: [],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {},
    status: "active",
    executionProfile: {},
    externalAdapters: [],
    pluginBindings: [],
  });

  assert.equal(definition.domainId, "def-domain");
  assert.equal(definition.version, 2);
  assert.equal(definition.status, "active");
});

test("DomainDefinitionSchema defaults status to draft", () => {
  const definition = DomainDefinitionSchema.parse({
    domainId: "minimal",
    name: "Minimal",
    description: "desc",
  });

  assert.equal(definition.status, "draft");
});

test("DomainDefinitionSchema normalizes testing status to validated", () => {
  const definition = DomainDefinitionSchema.parse({
    domainId: "testing-domain",
    name: "Testing",
    description: "desc",
    status: "testing",
  });

  assert.equal(definition.status, "validated");
});

test("DomainDefinitionSchema defaults version to 1", () => {
  const definition = DomainDefinitionSchema.parse({
    domainId: "minimal",
    name: "Minimal",
    description: "desc",
  });

  assert.equal(definition.version, 1);
});

test("DomainDefinitionSchema accepts all lifecycle states as status", () => {
  const states = ["draft", "validated", "registered", "active", "updating", "deprecated", "archived"] as const;
  for (const state of states) {
    const definition = DomainDefinitionSchema.parse({
      domainId: `state-${state}`,
      name: "Test",
      description: "desc",
      status: state,
    });
    assert.equal(definition.status, state);
  }
});
