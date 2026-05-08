import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  StepTemplateConfigSchema,
  WorkflowConfigSchema,
  ToolBundleEntrySchema,
  ToolBundleConfigSchema,
  OutputContractConfigSchema,
  DomainCapabilityProfileSchema,
  PluginBindingSchema,
  DomainDefinitionSchema,
} from "../../../../src/domains/registry/domain-model.js";

test("StepTemplateConfigSchema parses valid config", () => {
  const result = StepTemplateConfigSchema.parse({
    stepName: "execute-code",
    toolHints: ["bash", "node"],
    modelHints: { preferredModel: "claude-3", temperature: 0.7 },
    outputSchema: { type: "object" },
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
    requiresReview: false,
    timeoutMs: 60000,
    dependsOn: [],
  });
  assert.equal(result.stepName, "execute-code");
  assert.deepEqual(result.toolHints, ["bash", "node"]);
});

test("StepTemplateConfigSchema applies defaults", () => {
  const result = StepTemplateConfigSchema.parse({ stepName: "test-step" });
  assert.deepEqual(result.toolHints, []);
  assert.deepEqual(result.modelHints, {});
  assert.deepEqual(result.outputSchema, null);
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

test("StepTemplateConfigSchema rejects negative timeoutMs", () => {
  assert.throws(() => {
    StepTemplateConfigSchema.parse({ stepName: "test", timeoutMs: -1 });
  });
});

test("StepTemplateConfigSchema rejects invalid temperature", () => {
  assert.throws(() => {
    StepTemplateConfigSchema.parse({ stepName: "test", modelHints: { temperature: 5 } });
  });
});

test("WorkflowConfigSchema parses valid workflow", () => {
  const result = WorkflowConfigSchema.parse({
    workflowId: "wf-001",
    name: "Test Workflow",
    triggerConditions: { status: "active" },
    steps: [],
  });
  assert.equal(result.workflowId, "wf-001");
  assert.equal(result.name, "Test Workflow");
});

test("WorkflowConfigSchema applies defaults", () => {
  const result = WorkflowConfigSchema.parse({ workflowId: "wf-1", name: "Name" });
  assert.deepEqual(result.triggerConditions, {});
  assert.deepEqual(result.steps, []);
});

test("WorkflowConfigSchema rejects empty workflowId", () => {
  assert.throws(() => {
    WorkflowConfigSchema.parse({ workflowId: "", name: "Name" });
  });
});

test("ToolBundleEntrySchema parses valid entry", () => {
  const result = ToolBundleEntrySchema.parse({
    toolName: "bash-exec",
    enabled: true,
    configOverrides: { shell: "/bin/bash" },
  });
  assert.equal(result.toolName, "bash-exec");
  assert.equal(result.enabled, true);
});

test("ToolBundleEntrySchema applies defaults", () => {
  const result = ToolBundleEntrySchema.parse({ toolName: "test-tool" });
  assert.equal(result.enabled, true);
  assert.deepEqual(result.configOverrides, {});
});

test("ToolBundleConfigSchema parses valid bundle", () => {
  const result = ToolBundleConfigSchema.parse({
    bundleId: "bundle-001",
    tools: [
      { toolName: "tool-a", enabled: true },
      { toolName: "tool-b", enabled: false },
    ],
  });
  assert.equal(result.bundleId, "bundle-001");
  assert.equal(result.tools.length, 2);
});

test("ToolBundleConfigSchema applies defaults to tools", () => {
  const result = ToolBundleConfigSchema.parse({ bundleId: "b1", tools: [{ toolName: "t1" }] });
  assert.equal(result.tools[0].enabled, true);
  assert.deepEqual(result.tools[0].configOverrides, {});
});

test("OutputContractConfigSchema parses valid contract", () => {
  const result = OutputContractConfigSchema.parse({
    contractId: "contract-001",
    name: "Output Contract",
    schema: { fields: ["a", "b"] },
    validationLevel: "strict",
  });
  assert.equal(result.contractId, "contract-001");
  assert.equal(result.validationLevel, "strict");
});

test("OutputContractConfigSchema allows lenient validation level", () => {
  const result = OutputContractConfigSchema.parse({
    contractId: "c1",
    name: "N",
    validationLevel: "lenient",
  });
  assert.equal(result.validationLevel, "lenient");
});

test("OutputContractConfigSchema allows none validation level", () => {
  const result = OutputContractConfigSchema.parse({
    contractId: "c1",
    name: "N",
    validationLevel: "none",
  });
  assert.equal(result.validationLevel, "none");
});

test("OutputContractConfigSchema rejects invalid validation level", () => {
  assert.throws(() => {
    OutputContractConfigSchema.parse({ contractId: "c1", name: "N", validationLevel: "strictt" });
  });
});

test("DomainCapabilityProfileSchema parses valid profile", () => {
  const result = DomainCapabilityProfileSchema.parse({
    supportedTaskTypes: ["coding", "analysis"],
    requiredTools: ["bash", "editor"],
    optionalTools: ["git"],
    modelPreferences: { default: "claude-3" },
    budgetLimits: { maxTokensPerTask: 8000, maxCostPerTask: 10 },
    securityLevel: "elevated",
  });
  assert.deepEqual(result.supportedTaskTypes, ["coding", "analysis"]);
  assert.equal(result.securityLevel, "elevated");
});

test("DomainCapabilityProfileSchema applies defaults", () => {
  const result = DomainCapabilityProfileSchema.parse({});
  assert.deepEqual(result.supportedTaskTypes, []);
  assert.deepEqual(result.requiredTools, []);
  assert.deepEqual(result.optionalTools, []);
  assert.deepEqual(result.modelPreferences, {});
  assert.deepEqual(result.budgetLimits, { maxTokensPerTask: 4000, maxCostPerTask: 5 });
  assert.equal(result.securityLevel, "standard");
});

test("DomainCapabilityProfileSchema rejects invalid security level", () => {
  assert.throws(() => {
    DomainCapabilityProfileSchema.parse({ securityLevel: "high" });
  });
});

test("PluginBindingSchema parses valid binding", () => {
  const result = PluginBindingSchema.parse({
    bindingId: "bind-001",
    domainId: "domain-a",
    pluginType: "retriever",
    pluginId: "plugin-1",
    priority: 10,
    enabled: true,
    config: { key: "value" },
  });
  assert.equal(result.bindingId, "bind-001");
  assert.equal(result.pluginType, "retriever");
  assert.equal(result.priority, 10);
});

test("PluginBindingSchema accepts all plugin types", () => {
  const cases = [
    ["retriever", "retriever"],
    ["validator", "evaluator"],
    ["planner", "tool"],
    ["presenter", "tool"],
    ["adapter", "adapter"],
  ] as const;
  for (const [type, expected] of cases) {
    const result = PluginBindingSchema.parse({
      bindingId: "b1",
      domainId: "d1",
      pluginType: type,
      pluginId: "p1",
    });
    assert.equal(result.pluginType, expected);
  }
});

test("PluginBindingSchema applies defaults", () => {
  const result = PluginBindingSchema.parse({
    bindingId: "b1",
    domainId: "d1",
    pluginType: "retriever",
    pluginId: "p1",
  });
  assert.equal(result.priority, 0);
  assert.equal(result.enabled, true);
  assert.deepEqual(result.config, {});
});

test("DomainDefinitionSchema parses valid definition", () => {
  const result = DomainDefinitionSchema.parse({
    domainId: "domain-001",
    name: "Test Domain",
    description: "A test domain",
    version: 1,
    workflows: [],
    toolBundles: [],
    outputContracts: [],
    promptOverrides: {},
    capabilities: { supportedTaskTypes: ["test"] },
    status: "active",
    externalAdapters: [],
    pluginBindings: [],
  });
  assert.equal(result.domainId, "domain-001");
  assert.equal(result.status, "active");
  assert.equal(result.version, 1);
});

test("DomainDefinitionSchema parses the quant-trading domain config", () => {
  const raw = readFileSync("config/domains/quant-trading.json", "utf8");
  const result = DomainDefinitionSchema.parse(JSON.parse(raw));

  assert.equal(result.domainId, "quant-trading");
  assert.equal(result.status, "active");
  assert.equal(result.capabilities.securityLevel, "restricted");
  assert.equal(result.workflows[0]?.workflowId, "quant-trading.primary");
});

test("DomainDefinitionSchema rejects empty domainId", () => {
  assert.throws(() => {
    DomainDefinitionSchema.parse({ domainId: "", name: "N", description: "D" });
  });
});

test("DomainDefinitionSchema rejects negative version", () => {
  assert.throws(() => {
    DomainDefinitionSchema.parse({ domainId: "d1", name: "N", description: "D", version: 0 });
  });
});

test("StepTemplateConfigSchema rejects negative maxRetries", () => {
  assert.throws(() => {
    StepTemplateConfigSchema.parse({
      stepName: "s1",
      retryPolicy: { maxRetries: -1, backoffMs: 100 },
    });
  });
});
