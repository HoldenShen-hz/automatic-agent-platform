import assert from "node:assert/strict";
import test from "node:test";

import { DomainCapabilityProfileSchema, type DomainDefinition } from "../../../../src/domains/registry/domain-model.js";
import { DomainSmokeTestRunner } from "../../../../src/domains/registry/domain-smoke-test.js";

function createDomain(overrides: Partial<DomainDefinition> = {}): DomainDefinition {
  return {
    domainId: "quota-domain",
    name: "Quota Domain",
    description: "Current quota checks live in capabilities + smoke tests.",
    version: 1,
    workflows: [
      {
        workflowId: "quota.main",
        name: "Quota Main",
        triggerConditions: {},
        steps: [{ stepName: "step-1", dependsOn: [] }],
      },
    ],
    toolBundles: [
      {
        bundleId: "quota.tools",
        tools: [{ toolName: "read" }],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["analysis"],
      requiredTools: ["read"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 1 },
      securityLevel: "standard",
    },
    status: "registered",
    externalAdapters: [],
    pluginBindings: [],
    ...overrides,
  };
}

test("DomainCapabilityProfileSchema rejects zero resource quotas", () => {
  assert.throws(() => {
    DomainCapabilityProfileSchema.parse({
      budgetLimits: {
        maxTokensPerTask: 0,
        maxCostPerTask: 0,
      },
    });
  });
});

test("DomainSmokeTestRunner flags token quota below minimum", () => {
  const runner = new DomainSmokeTestRunner();
  const result = runner.run(createDomain({
    capabilities: {
      supportedTaskTypes: ["analysis"],
      requiredTools: ["read"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 999, maxCostPerTask: 1 },
      securityLevel: "standard",
    },
  }));

  assert.equal(result.passed, false);
  assert.ok(result.issues.includes("domain_registry.runtime_checks_failed"));
  assert.equal(result.runtimeChecks.find((check) => check.checkId === "resource_quota")?.passed, false);
});

test("DomainSmokeTestRunner flags insufficient cost quota", () => {
  const runner = new DomainSmokeTestRunner();
  const result = runner.run(createDomain({
    capabilities: {
      supportedTaskTypes: ["analysis"],
      requiredTools: ["read"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 0.009 },
      securityLevel: "standard",
    },
  }));

  assert.equal(result.runtimeChecks.find((check) => check.checkId === "resource_quota")?.passed, false);
});

test("DomainSmokeTestRunner enforces restricted-tool sandbox compatibility", () => {
  const runner = new DomainSmokeTestRunner();
  const result = runner.run(createDomain({
    toolBundles: [
      {
        bundleId: "quota.tools",
        tools: [{ toolName: "bash" }],
      },
    ],
    capabilities: {
      supportedTaskTypes: ["analysis"],
      requiredTools: ["bash"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 1 },
      securityLevel: "standard",
    },
  }));

  assert.equal(result.runtimeChecks.find((check) => check.checkId === "sandbox_compatibility")?.passed, false);
});

test("DomainSmokeTestRunner passes valid current quota configuration", () => {
  const runner = new DomainSmokeTestRunner();
  const result = runner.run(createDomain());

  assert.equal(result.passed, true);
  assert.equal(result.runtimeChecks.find((check) => check.checkId === "resource_quota")?.passed, true);
});
