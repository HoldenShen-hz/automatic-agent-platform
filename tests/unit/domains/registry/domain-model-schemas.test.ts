import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainCapabilityProfileSchema,
  DomainDefinitionSchema,
  DomainManifestSchema,
  PluginBindingSchema,
  ResourceQuotaSchema,
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
  assert.equal(canary.status, "canary");
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

test("ResourceQuotaSchema applies defaults for all optional fields", () => {
  const result = ResourceQuotaSchema.parse({});

  assert.equal(result.cpuLimit, undefined);
  assert.equal(result.cpuLimitUnit, "cores");
  assert.equal(result.memoryLimit, undefined);
  assert.equal(result.memoryLimitUnit, "MB");
  assert.equal(result.concurrencyLimit, undefined);
  assert.equal(result.timeoutMs, undefined);
});

test("ResourceQuotaSchema accepts complete resource quota configuration", () => {
  const result = ResourceQuotaSchema.parse({
    cpuLimit: 4,
    cpuLimitUnit: "cores",
    memoryLimit: 8192,
    memoryLimitUnit: "MB",
    concurrencyLimit: 10,
    timeoutMs: 300000,
  });

  assert.equal(result.cpuLimit, 4);
  assert.equal(result.cpuLimitUnit, "cores");
  assert.equal(result.memoryLimit, 8192);
  assert.equal(result.memoryLimitUnit, "MB");
  assert.equal(result.concurrencyLimit, 10);
  assert.equal(result.timeoutMs, 300000);
});

test("DomainManifestSchema includes resourceQuotas field with defaults", () => {
  const result = DomainManifestSchema.parse({
    domainId: "test-domain",
    name: "Test Domain",
    description: "A test domain",
    version: "1.0.0",
    owner: "test-owner",
    publicSdkSurface: "full",
  });

  assert.equal(result.resourceQuotas.cpuLimitUnit, "cores");
  assert.equal(result.resourceQuotas.memoryLimitUnit, "MB");
  assert.equal("cpuLimit" in result.resourceQuotas, false);
  assert.equal("memoryLimit" in result.resourceQuotas, false);
  assert.equal("concurrencyLimit" in result.resourceQuotas, false);
  assert.equal("timeoutMs" in result.resourceQuotas, false);
});

test("DomainManifestSchema accepts domain with full resource quotas", () => {
  const result = DomainManifestSchema.parse({
    domainId: "test-domain",
    name: "Test Domain",
    description: "A test domain",
    version: "1.0.0",
    owner: "test-owner",
    publicSdkSurface: "full",
    resourceQuotas: {
      cpuLimit: 8,
      memoryLimit: 16384,
      concurrencyLimit: 20,
      timeoutMs: 600000,
    },
  });

  assert.equal(result.resourceQuotas.cpuLimit, 8);
  assert.equal(result.resourceQuotas.memoryLimit, 16384);
  assert.equal(result.resourceQuotas.concurrencyLimit, 20);
  assert.equal(result.resourceQuotas.timeoutMs, 600000);
});
