import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainCapabilityProfileSchema,
  ResourceQuotaSchema,
  DomainManifestSchema,
  type DomainDefinition,
  type ResourceQuota,
} from "../../../../src/domains/registry/domain-model.js";
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
        steps: [{
          stepName: "step-1",
          toolHints: [],
          modelHints: {},
          outputSchema: null,
          retryPolicy: { maxRetries: 0, backoffMs: 0 },
          requiresReview: false,
          timeoutMs: 60000,
          dependsOn: [],
        }],
      },
    ],
    toolBundles: [
      {
        bundleId: "quota.tools",
        tools: [{ toolName: "read", enabled: true, configOverrides: {} }],
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
        tools: [{ toolName: "bash", enabled: true, configOverrides: {} }],
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

test("ResourceQuotaSchema parses valid quota with all fields", () => {
  const result = ResourceQuotaSchema.parse({
    cpuLimit: 4,
    cpuLimitUnit: "cores",
    memoryLimit: 8192,
    memoryLimitUnit: "MB",
    concurrencyLimit: 100,
    timeoutMs: 300000,
  });
  assert.equal(result.cpuLimit, 4);
  assert.equal(result.cpuLimitUnit, "cores");
  assert.equal(result.memoryLimit, 8192);
  assert.equal(result.concurrencyLimit, 100);
  assert.equal(result.timeoutMs, 300000);
});

test("ResourceQuotaSchema applies defaults when empty", () => {
  const result = ResourceQuotaSchema.parse({});
  assert.equal(result.cpuLimit, undefined);
  assert.equal(result.cpuLimitUnit, "cores");
  assert.equal(result.memoryLimit, undefined);
  assert.equal(result.memoryLimitUnit, "MB");
  assert.equal(result.concurrencyLimit, undefined);
});

test("ResourceQuotaSchema rejects negative cpuLimit", () => {
  assert.throws(() => {
    ResourceQuotaSchema.parse({ cpuLimit: -1 });
  });
});

test("ResourceQuotaSchema rejects negative memoryLimit", () => {
  assert.throws(() => {
    ResourceQuotaSchema.parse({ memoryLimit: -512 });
  });
});

test("ResourceQuotaSchema rejects non-positive concurrencyLimit", () => {
  assert.throws(() => {
    ResourceQuotaSchema.parse({ concurrencyLimit: 0 });
  });
  assert.throws(() => {
    ResourceQuotaSchema.parse({ concurrencyLimit: -5 });
  });
});

test("ResourceQuotaSchema rejects non-positive timeoutMs", () => {
  assert.throws(() => {
    ResourceQuotaSchema.parse({ timeoutMs: 0 });
  });
  assert.throws(() => {
    ResourceQuotaSchema.parse({ timeoutMs: -1000 });
  });
});

test("DomainManifestSchema includes resourceQuotas field", () => {
  const manifest = {
    domainId: "test-domain",
    name: "Test Domain",
    description: "A test domain",
    version: "1.0.0",
    owner: "test-owner",
    lifecycleState: "active",
    capabilityIds: [],
    requiredPlugins: [],
    securityLevel: "standard",
    trustTier: "internal",
    publicSdkSurface: "full",
    settingsSchema: {},
    tags: [],
    resourceQuotas: {
      cpuLimit: 8,
      cpuLimitUnit: "cores",
      memoryLimit: 16384,
      memoryLimitUnit: "MB",
      concurrencyLimit: 200,
      timeoutMs: 600000,
    },
  };
  const result = DomainManifestSchema.parse(manifest);
  assert.equal(result.domainId, "test-domain");
  assert.equal(result.resourceQuotas.cpuLimit, 8);
  assert.equal(result.resourceQuotas.concurrencyLimit, 200);
});

test("DomainManifestSchema applies defaults for resourceQuotas", () => {
  const manifest = {
    domainId: "minimal-domain",
    name: "Minimal Domain",
    description: "A minimal domain",
    version: "1.0.0",
    owner: "owner",
    lifecycleState: "draft",
    capabilityIds: [],
    requiredPlugins: [],
    securityLevel: "standard",
    trustTier: "internal",
    publicSdkSurface: "full",
    settingsSchema: {},
    tags: [],
  };
  const result = DomainManifestSchema.parse(manifest);
  assert.deepEqual(result.resourceQuotas.cpuLimitUnit, "cores");
  assert.deepEqual(result.resourceQuotas.memoryLimitUnit, "MB");
});

test("DomainManifestSchema rejects invalid resourceQuotas values", () => {
  assert.throws(() => {
    DomainManifestSchema.parse({
      domainId: "bad-domain",
      name: "Bad Domain",
      description: "Domain with invalid quotas",
      version: "1.0.0",
      owner: "owner",
      lifecycleState: "draft",
      capabilityIds: [],
      requiredPlugins: [],
      securityLevel: "standard",
      trustTier: "internal",
      publicSdkSurface: "full",
      settingsSchema: {},
      tags: [],
      resourceQuotas: {
        cpuLimit: -2,
      },
    });
  });
});
