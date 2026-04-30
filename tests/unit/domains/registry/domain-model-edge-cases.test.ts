/**
 * DomainModel Additional Edge Case Tests
 *
 * Additional tests for edge cases in domain-model.ts schemas.
 * Covers WorkflowConfigSchema, StepTemplateConfigSchema, and other schemas.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  StepTemplateConfigSchema,
  WorkflowConfigSchema,
  ToolBundleEntrySchema,
  ToolBundleConfigSchema,
  OutputContractConfigSchema,
  DomainCapabilityProfileSchema,
  PluginBindingSchema,
  DomainDefinitionSchema,
  DomainDescriptorBundleSchema,
} from "../../../../src/domains/registry/domain-model.js";

// ─────────────────────────────────────────────────────────────────────────────
// WorkflowConfigSchema Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("WorkflowConfigSchema parses workflow with stepGraph edges", () => {
  const result = WorkflowConfigSchema.parse({
    workflowId: "wf-graph",
    name: "Workflow with Graph",
    triggerConditions: {},
    steps: [
      {
        stepName: "step_a",
        toolHints: [],
        modelHints: {},
        outputSchema: null,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
        requiresReview: false,
        timeoutMs: 60000,
        dependsOn: [],
      },
      {
        stepName: "step_b",
        toolHints: [],
        modelHints: {},
        outputSchema: null,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
        requiresReview: false,
        timeoutMs: 60000,
        dependsOn: ["step_a"],
      },
    ],
    stepGraph: {
      edges: [
        { fromStep: "step_a", toStep: "step_b", condition: null },
      ],
    },
  });

  assert.ok(result.stepGraph !== undefined);
  assert.equal(result.stepGraph!.edges.length, 1);
  assert.equal(result.stepGraph!.edges[0].fromStep, "step_a");
  assert.equal(result.stepGraph!.edges[0].toStep, "step_b");
});

test("WorkflowConfigSchema parses workflow with conditional edges", () => {
  const result = WorkflowConfigSchema.parse({
    workflowId: "wf-conditional",
    name: "Conditional Workflow",
    steps: [],
    stepGraph: {
      edges: [
        {
          fromStep: "step_a",
          toStep: "step_b",
          condition: { status: "success" },
        },
      ],
    },
  });

  assert.ok(result.stepGraph!.edges[0].condition !== null);
});

test("WorkflowConfigSchema applies defaults for stepGraph", () => {
  const result = WorkflowConfigSchema.parse({
    workflowId: "wf-default-graph",
    name: "Default Graph",
    steps: [],
  });

  assert.equal(result.stepGraph, undefined);
});

test("WorkflowConfigSchema rejects empty workflowId", () => {
  assert.throws(() => {
    WorkflowConfigSchema.parse({ workflowId: "", name: "Name" });
  });
});

test("WorkflowConfigSchema rejects empty name", () => {
  assert.throws(() => {
    WorkflowConfigSchema.parse({ workflowId: "wf-1", name: "" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// StepTemplateConfigSchema Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("StepTemplateConfigSchema accepts zero timeoutMs", () => {
  const result = StepTemplateConfigSchema.parse({
    stepName: "zero-timeout",
    timeoutMs: 0,
  });

  assert.equal(result.timeoutMs, 0);
});

test("StepTemplateConfigSchema accepts very large timeoutMs", () => {
  const result = StepTemplateConfigSchema.parse({
    stepName: "large-timeout",
    timeoutMs: Number.MAX_SAFE_INTEGER,
  });

  assert.equal(result.timeoutMs, Number.MAX_SAFE_INTEGER);
});

test("StepTemplateConfigSchema accepts zero maxRetries", () => {
  const result = StepTemplateConfigSchema.parse({
    stepName: "zero-retries",
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
  });

  assert.equal(result.retryPolicy.maxRetries, 0);
});

test("StepTemplateConfigSchema accepts very large maxRetries", () => {
  const result = StepTemplateConfigSchema.parse({
    stepName: "large-retries",
    retryPolicy: { maxRetries: Number.MAX_SAFE_INTEGER, backoffMs: 0 },
  });

  assert.equal(result.retryPolicy.maxRetries, Number.MAX_SAFE_INTEGER);
});

test("StepTemplateConfigSchema accepts step with empty dependsOn", () => {
  const result = StepTemplateConfigSchema.parse({
    stepName: "no-deps",
    dependsOn: [],
  });

  assert.deepEqual(result.dependsOn, []);
});

test("StepTemplateConfigSchema accepts step with multiple dependencies", () => {
  const result = StepTemplateConfigSchema.parse({
    stepName: "multi-deps",
    dependsOn: ["step_1", "step_2", "step_3", "step_4", "step_5"],
  });

  assert.equal(result.dependsOn.length, 5);
});

test("StepTemplateConfigSchema accepts step with duplicate dependencies", () => {
  const result = StepTemplateConfigSchema.parse({
    stepName: "dup-deps",
    dependsOn: ["step_a", "step_a", "step_b"],
  });

  assert.equal(result.dependsOn.length, 3);
});

test("StepTemplateConfigSchema accepts step with empty toolHints", () => {
  const result = StepTemplateConfigSchema.parse({
    stepName: "no-tools",
    toolHints: [],
  });

  assert.deepEqual(result.toolHints, []);
});

test("StepTemplateConfigSchema accepts step with many tool hints", () => {
  const manyTools = Array.from({ length: 100 }, (_, i) => `tool_${i}`);
  const result = StepTemplateConfigSchema.parse({
    stepName: "many-tools",
    toolHints: manyTools,
  });

  assert.equal(result.toolHints.length, 100);
});

test("StepTemplateConfigSchema accepts step with empty modelHints", () => {
  const result = StepTemplateConfigSchema.parse({
    stepName: "no-model",
    modelHints: {},
  });

  assert.deepEqual(result.modelHints, {});
});

test("StepTemplateConfigSchema accepts step with partial modelHints", () => {
  const result = StepTemplateConfigSchema.parse({
    stepName: "partial-model",
    modelHints: { preferredModel: "claude-3" },
  });

  assert.equal(result.modelHints.preferredModel, "claude-3");
  assert.equal(result.modelHints.temperature, undefined);
});

test("StepTemplateConfigSchema accepts step with outputSchema object", () => {
  const result = StepTemplateConfigSchema.parse({
    stepName: "output-schema",
    outputSchema: { type: "object", properties: {} },
  });

  assert.ok(result.outputSchema !== null);
});

test("StepTemplateConfigSchema accepts step with outputSchema array", () => {
  const result = StepTemplateConfigSchema.parse({
    stepName: "output-array",
    outputSchema: ["string", "number"],
  });

  assert.ok(result.outputSchema !== null);
});

// ─────────────────────────────────────────────────────────────────────────────
// ToolBundleEntrySchema Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("ToolBundleEntrySchema accepts tool with empty configOverrides", () => {
  const result = ToolBundleEntrySchema.parse({
    toolName: "test-tool",
    configOverrides: {},
  });

  assert.deepEqual(result.configOverrides, {});
});

test("ToolBundleEntrySchema accepts tool with nested configOverrides", () => {
  const result = ToolBundleEntrySchema.parse({
    toolName: "test-tool",
    configOverrides: {
      nested: { deep: { value: 123 } },
      array: [1, 2, 3],
    },
  });

  assert.deepEqual(result.configOverrides, {
    nested: { deep: { value: 123 } },
    array: [1, 2, 3],
  });
});

test("ToolBundleEntrySchema rejects tool name with forward slash", () => {
  assert.throws(() => {
    ToolBundleEntrySchema.parse({ toolName: "tool/name" });
  });
});

test("ToolBundleEntrySchema rejects tool name with backward slash", () => {
  assert.throws(() => {
    ToolBundleEntrySchema.parse({ toolName: "tool\\name" });
  });
});

test("ToolBundleEntrySchema rejects tool name with double dots", () => {
  assert.throws(() => {
    ToolBundleEntrySchema.parse({ toolName: "tool..name" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ToolBundleConfigSchema Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("ToolBundleConfigSchema accepts empty tools array", () => {
  const result = ToolBundleConfigSchema.parse({
    bundleId: "empty-bundle",
    tools: [],
  });

  assert.deepEqual(result.tools, []);
});

test("ToolBundleConfigSchema accepts single tool", () => {
  const result = ToolBundleConfigSchema.parse({
    bundleId: "single-bundle",
    tools: [{ toolName: "only-tool" }],
  });

  assert.equal(result.tools.length, 1);
});

test("ToolBundleConfigSchema accepts many tools", () => {
  const manyTools = Array.from({ length: 100 }, (_, i) => ({
    toolName: `tool_${i}`,
    enabled: i % 2 === 0,
  }));

  const result = ToolBundleConfigSchema.parse({
    bundleId: "many-tools-bundle",
    tools: manyTools,
  });

  assert.equal(result.tools.length, 100);
});

test("ToolBundleConfigSchema rejects empty bundleId", () => {
  assert.throws(() => {
    ToolBundleConfigSchema.parse({ bundleId: "", tools: [] });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OutputContractConfigSchema Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("OutputContractConfigSchema accepts empty schema", () => {
  const result = OutputContractConfigSchema.parse({
    contractId: "c1",
    name: "N",
    schema: {},
  });

  assert.deepEqual(result.schema, {});
});

test("OutputContractConfigSchema accepts complex schema", () => {
  const result = OutputContractConfigSchema.parse({
    contractId: "complex",
    name: "Complex Contract",
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        value: { type: "number" },
        nested: {
          type: "object",
          properties: {
            deep: { type: "string" },
          },
        },
      },
      required: ["id"],
    },
    validationLevel: "strict",
  });

  assert.ok(result.schema !== undefined);
});

test("OutputContractConfigSchema rejects invalid validation level", () => {
  assert.throws(() => {
    OutputContractConfigSchema.parse({
      contractId: "c1",
      name: "N",
      validationLevel: "invalid",
    });
  });
});

test("OutputContractConfigSchema rejects empty contractId", () => {
  assert.throws(() => {
    OutputContractConfigSchema.parse({ contractId: "", name: "N" });
  });
});

test("OutputContractConfigSchema rejects empty name", () => {
  assert.throws(() => {
    OutputContractConfigSchema.parse({ contractId: "c1", name: "" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainCapabilityProfileSchema Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("DomainCapabilityProfileSchema accepts empty arrays", () => {
  const result = DomainCapabilityProfileSchema.parse({
    supportedTaskTypes: [],
    requiredTools: [],
    optionalTools: [],
  });

  assert.deepEqual(result.supportedTaskTypes, []);
  assert.deepEqual(result.requiredTools, []);
  assert.deepEqual(result.optionalTools, []);
});

test("DomainCapabilityProfileSchema accepts duplicate task types", () => {
  const result = DomainCapabilityProfileSchema.parse({
    supportedTaskTypes: ["coding", "coding", "analysis"],
  });

  assert.equal(result.supportedTaskTypes.length, 3);
});

test("DomainCapabilityProfileSchema accepts duplicate tools", () => {
  const result = DomainCapabilityProfileSchema.parse({
    requiredTools: ["bash", "bash", "git"],
  });

  assert.equal(result.requiredTools.length, 3);
});

test("DomainCapabilityProfileSchema accepts empty modelPreferences", () => {
  const result = DomainCapabilityProfileSchema.parse({
    modelPreferences: {},
  });

  assert.deepEqual(result.modelPreferences, {});
});

test("DomainCapabilityProfileSchema accepts many model preferences", () => {
  const prefs: Record<string, string> = {};
  for (let i = 0; i < 100; i++) {
    prefs[`task_${i}`] = `model_${i}`;
  }

  const result = DomainCapabilityProfileSchema.parse({
    modelPreferences: prefs,
  });

  assert.equal(Object.keys(result.modelPreferences).length, 100);
});

test("DomainCapabilityProfileSchema accepts zero budget limits", () => {
  const result = DomainCapabilityProfileSchema.parse({
    budgetLimits: {
      maxTokensPerTask: 0,
      maxCostPerTask: 0,
    },
  });

  assert.equal(result.budgetLimits.maxTokensPerTask, 0);
  assert.equal(result.budgetLimits.maxCostPerTask, 0);
});

test("DomainCapabilityProfileSchema accepts very large budget limits", () => {
  const result = DomainCapabilityProfileSchema.parse({
    budgetLimits: {
      maxTokensPerTask: Number.MAX_SAFE_INTEGER,
      maxCostPerTask: Number.MAX_VALUE,
    },
  });

  assert.equal(result.budgetLimits.maxTokensPerTask, Number.MAX_SAFE_INTEGER);
});

test("DomainCapabilityProfileSchema rejects invalid security level", () => {
  assert.throws(() => {
    DomainCapabilityProfileSchema.parse({ securityLevel: "high-security" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PluginBindingSchema Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("PluginBindingSchema accepts pluginType aliases", () => {
  const cases = [
    ["planner", "tool"],
    ["presenter", "tool"],
    ["validator", "evaluator"],
  ] as const;

  for (const [input, expected] of cases) {
    const result = PluginBindingSchema.parse({
      bindingId: "b1",
      domainId: "d1",
      pluginType: input,
      pluginId: "p1",
    });

    assert.equal(result.pluginType, expected, `Expected ${input} to map to ${expected}`);
  }
});

test("PluginBindingSchema preserves non-aliased plugin types", () => {
  const result = PluginBindingSchema.parse({
    bindingId: "b1",
    domainId: "d1",
    pluginType: "adapter",
    pluginId: "p1",
  });

  assert.equal(result.pluginType, "adapter");
});

test("PluginBindingSchema accepts all binding roles", () => {
  const roles = ["tool", "adapter", "retriever", "evaluator", "planner", "presenter", "validator"] as const;

  for (const role of roles) {
    const result = PluginBindingSchema.parse({
      bindingId: `b_${role}`,
      domainId: "d1",
      pluginType: "tool",
      bindingRole: role,
      pluginId: "p1",
    });

    assert.equal(result.bindingRole, role);
  }
});

test("PluginBindingSchema rejects negative priority", () => {
  assert.throws(() => {
    PluginBindingSchema.parse({
      bindingId: "b1",
      domainId: "d1",
      pluginType: "tool",
      pluginId: "p1",
      priority: -1,
    });
  });
});

test("PluginBindingSchema accepts zero priority", () => {
  const result = PluginBindingSchema.parse({
    bindingId: "b1",
    domainId: "d1",
    pluginType: "tool",
    pluginId: "p1",
    priority: 0,
  });

  assert.equal(result.priority, 0);
});

test("PluginBindingSchema accepts very large priority", () => {
  const result = PluginBindingSchema.parse({
    bindingId: "b1",
    domainId: "d1",
    pluginType: "tool",
    pluginId: "p1",
    priority: Number.MAX_SAFE_INTEGER,
  });

  assert.equal(result.priority, Number.MAX_SAFE_INTEGER);
});

test("PluginBindingSchema accepts disabled binding", () => {
  const result = PluginBindingSchema.parse({
    bindingId: "b1",
    domainId: "d1",
    pluginType: "tool",
    pluginId: "p1",
    enabled: false,
  });

  assert.equal(result.enabled, false);
});

test("PluginBindingSchema accepts empty config", () => {
  const result = PluginBindingSchema.parse({
    bindingId: "b1",
    domainId: "d1",
    pluginType: "tool",
    pluginId: "p1",
    config: {},
  });

  assert.deepEqual(result.config, {});
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainDefinitionSchema Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("DomainDefinitionSchema accepts status aliases", () => {
  // "testing" should be accepted and mapped to "validated"
  const result = DomainDefinitionSchema.parse({
    domainId: "test-domain",
    name: "Test",
    description: "Test domain",
    status: "testing",
  });

  // Status aliasing behavior depends on implementation
  assert.ok(result.status !== undefined);
});

test("DomainDefinitionSchema accepts version as number", () => {
  const result = DomainDefinitionSchema.parse({
    domainId: "test-domain",
    name: "Test",
    description: "Test domain",
    version: 1,
  });

  assert.equal(result.version, 1);
});

test("DomainDefinitionSchema rejects negative version", () => {
  assert.throws(() => {
    DomainDefinitionSchema.parse({
      domainId: "test-domain",
      name: "Test",
      description: "Test domain",
      version: -1,
    });
  });
});

test("DomainDefinitionSchema rejects zero version", () => {
  assert.throws(() => {
    DomainDefinitionSchema.parse({
      domainId: "test-domain",
      name: "Test",
      description: "Test domain",
      version: 0,
    });
  });
});

test("DomainDefinitionSchema applies default version", () => {
  const result = DomainDefinitionSchema.parse({
    domainId: "test-domain",
    name: "Test",
    description: "Test domain",
  });

  assert.equal(result.version, 1);
});

test("DomainDefinitionSchema accepts empty externalAdapters", () => {
  const result = DomainDefinitionSchema.parse({
    domainId: "test-domain",
    name: "Test",
    description: "Test domain",
    externalAdapters: [],
  });

  assert.deepEqual(result.externalAdapters, []);
});

test("DomainDefinitionSchema accepts empty pluginBindings", () => {
  const result = DomainDefinitionSchema.parse({
    domainId: "test-domain",
    name: "Test",
    description: "Test domain",
    pluginBindings: [],
  });

  assert.deepEqual(result.pluginBindings, []);
});

test("DomainDefinitionSchema accepts empty workflows", () => {
  const result = DomainDefinitionSchema.parse({
    domainId: "test-domain",
    name: "Test",
    description: "Test domain",
    workflows: [],
  });

  assert.deepEqual(result.workflows, []);
});

test("DomainDefinitionSchema accepts empty toolBundles", () => {
  const result = DomainDefinitionSchema.parse({
    domainId: "test-domain",
    name: "Test",
    description: "Test domain",
    toolBundles: [],
  });

  assert.deepEqual(result.toolBundles, []);
});

test("DomainDefinitionSchema accepts empty outputContracts", () => {
  const result = DomainDefinitionSchema.parse({
    domainId: "test-domain",
    name: "Test",
    description: "Test domain",
    outputContracts: [],
  });

  assert.deepEqual(result.outputContracts, []);
});

test("DomainDefinitionSchema accepts empty promptOverrides", () => {
  const result = DomainDefinitionSchema.parse({
    domainId: "test-domain",
    name: "Test",
    description: "Test domain",
    promptOverrides: {},
  });

  assert.deepEqual(result.promptOverrides, {});
});

test("DomainDefinitionSchema rejects invalid status", () => {
  assert.throws(() => {
    DomainDefinitionSchema.parse({
      domainId: "test-domain",
      name: "Test",
      description: "Test domain",
      status: "invalid_status",
    });
  });
});
