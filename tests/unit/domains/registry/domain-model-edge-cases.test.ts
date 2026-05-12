import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainCapabilityProfileSchema,
  DomainDefinitionSchema,
  OutputContractConfigSchema,
  PluginBindingSchema,
  StepTemplateConfigSchema,
  ToolBundleConfigSchema,
  ToolBundleEntrySchema,
  WorkflowConfigSchema,
} from "../../../../src/domains/registry/domain-model.js";

test("WorkflowConfigSchema preserves current step list and strips retired graph metadata", () => {
  const result = WorkflowConfigSchema.parse({
    workflowId: "wf-edge",
    name: "Workflow Edge",
    steps: [{ stepName: "step-1", dependsOn: [] }],
    stepGraph: { edges: [{ fromStep: "step-1", toStep: "step-2" }] },
  } as Record<string, unknown>);

  assert.equal(result.steps.length, 1);
  assert.equal("stepGraph" in result, false);
});

test("StepTemplateConfigSchema applies defaults and supports structured output schema", () => {
  const result = StepTemplateConfigSchema.parse({
    stepName: "structured-step",
    outputSchema: { type: "object", properties: { ok: { type: "boolean" } } },
  });

  assert.equal(result.timeoutMs, 60000);
  assert.equal(result.retryPolicy.maxRetries, 0);
  assert.deepEqual(result.toolHints, []);
  assert.ok(result.outputSchema !== null);
});

test("Tool bundle schemas preserve arbitrary registered tool names", () => {
  const entry = ToolBundleEntrySchema.parse({
    toolName: "namespace/tool.name",
    configOverrides: { mode: "safe" },
  });
  const bundle = ToolBundleConfigSchema.parse({
    bundleId: "bundle-1",
    tools: [entry],
  });

  assert.equal(entry.enabled, true);
  assert.equal(bundle.tools[0]?.toolName, "namespace/tool.name");
});

test("OutputContractConfigSchema enforces known validation levels", () => {
  const result = OutputContractConfigSchema.parse({
    contractId: "contract-1",
    name: "Contract 1",
    schema: { type: "object" },
    validationLevel: "lenient",
  });

  assert.equal(result.validationLevel, "lenient");
  assert.throws(() => {
    OutputContractConfigSchema.parse({
      contractId: "contract-2",
      name: "Contract 2",
      validationLevel: "invalid",
    });
  });
});

test("DomainCapabilityProfileSchema enforces positive budgets and valid security level", () => {
  const result = DomainCapabilityProfileSchema.parse({
    budgetLimits: { maxTokensPerTask: 9000, maxCostPerTask: 7.5 },
    securityLevel: "restricted",
  });

  assert.equal(result.budgetLimits.maxTokensPerTask, 9000);
  assert.equal(result.securityLevel, "restricted");
  assert.throws(() => DomainCapabilityProfileSchema.parse({
    budgetLimits: { maxTokensPerTask: 0, maxCostPerTask: 1 },
  }));
});

test("PluginBindingSchema keeps alias normalization and explicit roles", () => {
  const result = PluginBindingSchema.parse({
    bindingId: "binding-edge",
    domainId: "edge-domain",
    pluginType: "presenter",
    bindingRole: "presenter",
    pluginId: "plugin.presenter",
  });

  assert.equal(result.pluginType, "tool");
  assert.equal(result.bindingRole, "presenter");
});

test("DomainDefinitionSchema fills current defaults for sparse definitions", () => {
  const result = DomainDefinitionSchema.parse({
    domainId: "edge-domain",
    name: "Edge Domain",
    description: "Sparse definition",
    status: "canary",
  });

  assert.equal(result.status, "canary");
  assert.deepEqual(result.workflows, []);
  assert.deepEqual(result.toolBundles, []);
  assert.deepEqual(result.outputContracts, []);
  assert.deepEqual(result.promptOverrides, {});
});
