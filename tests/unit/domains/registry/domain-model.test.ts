import test from "node:test";
import assert from "node:assert/strict";

import {
  StepTemplateConfigSchema,
  WorkflowConfigSchema,
  ToolBundleConfigSchema,
  OutputContractConfigSchema,
  DomainCapabilityProfileSchema,
  PluginBindingSchema,
  DomainDefinitionSchema,
} from "../../../../src/domains/registry/domain-model.js";

test("StepTemplateConfigSchema parses valid config", () => {
  const input = {
    stepName: "test_step",
    toolHints: ["git", "npm"],
    modelHints: { preferredModel: "claude-3", temperature: 0.7 },
    outputSchema: { type: "object" },
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
    requiresReview: true,
    timeoutMs: 120000,
    dependsOn: ["step_1"],
  };

  const result = StepTemplateConfigSchema.parse(input);
  assert.equal(result.stepName, "test_step");
  assert.deepEqual(result.toolHints, ["git", "npm"]);
  assert.equal(result.modelHints.preferredModel, "claude-3");
  assert.equal(result.requiresReview, true);
});

test("StepTemplateConfigSchema applies defaults", () => {
  const input = { stepName: "test" };
  const result = StepTemplateConfigSchema.parse(input);
  assert.deepEqual(result.toolHints, []);
  assert.deepEqual(result.modelHints, {});
  assert.equal(result.outputSchema, null);
  assert.deepEqual(result.retryPolicy, { maxRetries: 0, backoffMs: 0 });
  assert.equal(result.requiresReview, false);
  assert.equal(result.timeoutMs, 60000);
  assert.deepEqual(result.dependsOn, []);
});

test("StepTemplateConfigSchema rejects empty stepName", () => {
  assert.throws(() => {
    StepTemplateConfigSchema.parse({ stepName: "" });
  });
});

test("StepTemplateConfigSchema rejects negative retry values", () => {
  assert.throws(() => {
    StepTemplateConfigSchema.parse({ stepName: "test", retryPolicy: { maxRetries: -1, backoffMs: 0 } });
  });
  assert.throws(() => {
    StepTemplateConfigSchema.parse({ stepName: "test", retryPolicy: { maxRetries: 0, backoffMs: -100 } });
  });
});

test("WorkflowConfigSchema parses valid config", () => {
  const input = {
    workflowId: "wf_1",
    name: "Test Workflow",
    triggerConditions: { event: "task.created" },
    steps: [],
  };

  const result = WorkflowConfigSchema.parse(input);
  assert.equal(result.workflowId, "wf_1");
  assert.equal(result.name, "Test Workflow");
});

test("WorkflowConfigSchema applies defaults", () => {
  const input = { workflowId: "wf_1", name: "Test" };
  const result = WorkflowConfigSchema.parse(input);
  assert.deepEqual(result.triggerConditions, {});
  assert.deepEqual(result.steps, []);
});

test("ToolBundleConfigSchema parses valid config", () => {
  const input = {
    bundleId: "bundle_1",
    tools: [{ toolName: "git", enabled: true, configOverrides: {} }],
  };

  const result = ToolBundleConfigSchema.parse(input);
  assert.equal(result.bundleId, "bundle_1");
  const firstTool = result.tools[0];
  assert.ok(firstTool != null);
  assert.equal(firstTool!.toolName, "git");
});

test("ToolBundleConfigSchema applies defaults for tool entries", () => {
  const input = { bundleId: "bundle_1", tools: [{ toolName: "git" }] };
  const result = ToolBundleConfigSchema.parse(input);
  const firstTool = result.tools[0];
  assert.ok(firstTool != null);
  assert.equal(firstTool!.enabled, true);
  assert.deepEqual(firstTool!.configOverrides, {});
});

test("OutputContractConfigSchema parses valid config", () => {
  const input = {
    contractId: "contract_1",
    name: "Test Contract",
    schema: { type: "object" },
    validationLevel: "strict",
  };

  const result = OutputContractConfigSchema.parse(input);
  assert.equal(result.validationLevel, "strict");
});

test("OutputContractConfigSchema accepts all validation levels", () => {
  const levels = ["strict", "lenient", "none"] as const;
  for (const level of levels) {
    const result = OutputContractConfigSchema.parse({
      contractId: "c1",
      name: "Test",
      validationLevel: level,
    });
    assert.equal(result.validationLevel, level);
  }
});

test("DomainCapabilityProfileSchema parses valid profile", () => {
  const input = {
    supportedTaskTypes: ["coding", "review"],
    requiredTools: ["git", "npm"],
    optionalTools: ["docker"],
    modelPreferences: { defaultModel: "claude-3" },
    budgetLimits: { maxTokensPerTask: 8000, maxCostPerTask: 10 },
    securityLevel: "elevated",
  };

  const result = DomainCapabilityProfileSchema.parse(input);
  assert.deepEqual(result.supportedTaskTypes, ["coding", "review"]);
  assert.equal(result.securityLevel, "elevated");
});

test("DomainCapabilityProfileSchema applies defaults", () => {
  const input = {};
  const result = DomainCapabilityProfileSchema.parse(input);
  assert.deepEqual(result.supportedTaskTypes, []);
  assert.deepEqual(result.requiredTools, []);
  assert.deepEqual(result.optionalTools, []);
  assert.deepEqual(result.modelPreferences, {});
  assert.deepEqual(result.budgetLimits, { maxTokensPerTask: 4000, maxCostPerTask: 5 });
  assert.equal(result.securityLevel, "standard");
});

test("PluginBindingSchema parses valid binding", () => {
  const input = {
    bindingId: "binding_1",
    domainId: "domain_1",
    pluginType: "retriever",
    pluginId: "plugin_1",
    priority: 5,
    enabled: true,
    config: { cacheSize: 100 },
  };

  const result = PluginBindingSchema.parse(input);
  assert.equal(result.pluginType, "retriever");
  assert.equal(result.priority, 5);
});

test("PluginBindingSchema accepts all plugin types", () => {
  const types = ["retriever", "validator", "planner", "presenter", "adapter"] as const;
  for (const type of types) {
    const result = PluginBindingSchema.parse({
      bindingId: "b1",
      domainId: "d1",
      pluginType: type,
      pluginId: "p1",
    });
    assert.equal(result.pluginType, type);
  }
});

test("PluginBindingSchema applies defaults", () => {
  const input = { bindingId: "b1", domainId: "d1", pluginType: "retriever" as const, pluginId: "p1" };
  const result = PluginBindingSchema.parse(input);
  assert.equal(result.priority, 0);
  assert.equal(result.enabled, true);
  assert.deepEqual(result.config, {});
});

test("DomainDefinitionSchema parses valid definition", () => {
  const input = {
    domainId: "domain_1",
    name: "Test Domain",
    description: "A test domain",
    version: 2,
    workflows: [],
    toolBundles: [],
    outputContracts: [],
    promptOverrides: { system: "You are helpful" },
    capabilities: { supportedTaskTypes: ["coding"] },
    status: "active",
    externalAdapters: ["adapter_1"],
    pluginBindings: [],
  };

  const result = DomainDefinitionSchema.parse(input);
  assert.equal(result.domainId, "domain_1");
  assert.equal(result.version, 2);
  assert.equal(result.status, "active");
});

test("DomainDefinitionSchema applies defaults", () => {
  const input = { domainId: "d1", name: "Test", description: "Desc", capabilities: {} };
  const result = DomainDefinitionSchema.parse(input);
  assert.equal(result.version, 1);
  assert.deepEqual(result.workflows, []);
  assert.deepEqual(result.toolBundles, []);
  assert.deepEqual(result.outputContracts, []);
  assert.deepEqual(result.promptOverrides, {});
  assert.ok(result.capabilities != null);
  assert.deepEqual(result.capabilities.supportedTaskTypes, []);
  assert.equal(result.status, "draft");
  assert.deepEqual(result.externalAdapters, []);
  assert.deepEqual(result.pluginBindings, []);
});

test("DomainDefinitionSchema accepts all status values", () => {
  const statuses = ["draft", "testing", "active", "deprecated"] as const;
  for (const status of statuses) {
    const result = DomainDefinitionSchema.parse({
      domainId: "d1",
      name: "Test",
      description: "Desc",
      capabilities: {},
      status,
    });
    assert.equal(result.status, status);
  }
});
