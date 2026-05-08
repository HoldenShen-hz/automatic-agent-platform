import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainCapabilityProfileSchema,
  DomainDefinitionSchema,
  PluginBindingSchema,
  WorkflowConfigSchema,
} from "../../../../src/domains/registry/domain-model.js";

test("DomainDefinitionSchema normalizes legacy testing and canary states", () => {
  const testing = DomainDefinitionSchema.parse({
    domainId: "testing-domain",
    name: "Testing Domain",
    description: "Legacy testing alias coverage.",
    status: "testing",
  });
  const canary = DomainDefinitionSchema.parse({
    domainId: "canary-domain",
    name: "Canary Domain",
    description: "Legacy canary alias coverage.",
    status: "canary",
  });

  assert.equal(testing.status, "validated");
  assert.equal(canary.status, "registered");
});

test("PluginBindingSchema keeps current alias mapping explicit", () => {
  const planner = PluginBindingSchema.parse({
    bindingId: "binding-1",
    domainId: "coding",
    pluginType: "planner",
    bindingRole: "planner",
    pluginId: "plugin.planner",
  });
  const validator = PluginBindingSchema.parse({
    bindingId: "binding-2",
    domainId: "coding",
    pluginType: "validator",
    pluginId: "plugin.validator",
  });

  assert.equal(planner.pluginType, "tool");
  assert.equal(planner.bindingRole, "planner");
  assert.equal(validator.pluginType, "evaluator");
});

test("WorkflowConfigSchema strips retired graph fields and preserves declared steps", () => {
  const result = WorkflowConfigSchema.parse({
    workflowId: "wf-current",
    name: "Current Workflow",
    steps: [
      {
        stepName: "collect",
        dependsOn: [],
      },
    ],
    stepGraph: {
      edges: [{ fromStep: "collect", toStep: "done" }],
    },
  } as Record<string, unknown>);

  assert.equal(result.workflowId, "wf-current");
  assert.equal(result.steps.length, 1);
  assert.equal("stepGraph" in result, false);
});

test("DomainCapabilityProfileSchema applies operational defaults", () => {
  const result = DomainCapabilityProfileSchema.parse({});

  assert.deepEqual(result.supportedTaskTypes, []);
  assert.equal(result.securityLevel, "standard");
  assert.equal(result.budgetLimits.maxTokensPerTask, 4000);
  assert.equal(result.budgetLimits.maxCostPerTask, 5);
});
