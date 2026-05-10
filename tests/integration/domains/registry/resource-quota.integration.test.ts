/**
 * Integration Test: Domain Manifest with Resource Quotas (Issue 1976)
 *
 * Tests resource quota validation in domain capabilities:
 * - Budget limits validation (maxTokensPerTask, maxCostPerTask)
 * - Resource quota pre-check in smoke tests
 * - Edge cases for quota boundaries
 */

import test from "node:test";
import assert from "node:assert/strict";
import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import { DomainSmokeTestRunner } from "../../../../src/domains/registry/domain-smoke-test.js";
import type { DomainDefinition, DomainCapabilityProfile } from "../../../../src/domains/registry/domain-model.js";
import { DomainCapabilityProfileSchema } from "../../../../src/domains/registry/domain-model.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

const defaultCapabilities = DomainCapabilityProfileSchema.parse({});

function createTestDomain(overrides: Partial<DomainDefinition> & { capabilities?: Partial<DomainCapabilityProfile> } = {}): DomainDefinition {
  const { capabilities: capOverrides, ...rest } = overrides;
  return {
    domainId: "quota-test-domain",
    name: "Quota Test Domain",
    description: "A domain for resource quota testing",
    version: 1,
    workflows: [
      {
        workflowId: "wf_quota",
        name: "Quota Workflow",
        triggerConditions: {},
        steps: [
          {
            stepName: "step_quota",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 60000,
            dependsOn: [],
          },
        ],
      },
    ],
    toolBundles: [
      {
        bundleId: "quota_tools",
        tools: [{ toolName: "calculator", enabled: true, configOverrides: {} }],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["quota"],
      requiredTools: ["calculator"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "restricted",
      ...capOverrides,
    },
    status: "registered" as DomainDefinition["status"],
    externalAdapters: [],
    pluginBindings: [],
    ...rest,
  };
}

test("resource quotas: valid budget limits pass smoke test", async () => {
  const domain = createTestDomain({
    domainId: "valid-quota-domain",
    capabilities: {
      budgetLimits: { maxTokensPerTask: 8000, maxCostPerTask: 10 },
    },
  });

  const runner = new DomainSmokeTestRunner();
  const result = runner.run(domain);

  assert.equal(result.passed, true, `Expected pass but got issues: ${result.issues.join(", ")}`);
});

test("resource quotas: maxTokensPerTask below minimum fails smoke test", async () => {
  const domain = createTestDomain({
    domainId: "low-token-quota-domain",
    capabilities: {
      budgetLimits: { maxTokensPerTask: 500, maxCostPerTask: 5 },
    },
  });

  const runner = new DomainSmokeTestRunner();
  const result = runner.run(domain);

  assert.equal(result.passed, false);
  const resourceCheck = result.runtimeChecks.find((c) => c.checkId === "resource_quota");
  assert.ok(resourceCheck, "Expected resource_quota check in runtimeChecks");
  assert.equal(resourceCheck!.passed, false);
  assert.ok(resourceCheck!.details.includes("maxTokensPerTask"));
});

test("resource quotas: maxCostPerTask below minimum fails smoke test", async () => {
  const domain = createTestDomain({
    domainId: "low-cost-quota-domain",
    capabilities: {
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 0.001 },
    },
  });

  const runner = new DomainSmokeTestRunner();
  const result = runner.run(domain);

  assert.equal(result.passed, false);
  const resourceCheck = result.runtimeChecks.find((c) => c.checkId === "resource_quota");
  assert.ok(resourceCheck, "Expected resource_quota check in runtimeChecks");
  assert.equal(resourceCheck!.passed, false);
  assert.ok(resourceCheck!.details.includes("maxCostPerTask"));
});

test("resource quotas: activation fails when smoke test fails due to invalid quotas", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({
    domainId: "quota-activation-fail",
    capabilities: {
      budgetLimits: { maxTokensPerTask: 100, maxCostPerTask: 0.001 },
    },
  });

  // Registration succeeds since register doesn't run smoke tests
  const registered = service.register(domain);
  assert.equal(registered.domainId, "quota-activation-fail");

  // But activation fails because smoke test finds invalid quotas
  assert.throws(
    () => service.activate("quota-activation-fail"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.smoke_test_failed",
  );
});

test("resource quotas: exact boundary values pass", async () => {
  const domain = createTestDomain({
    domainId: "boundary-quota-domain",
    capabilities: {
      budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 0.01 },
    },
  });

  const runner = new DomainSmokeTestRunner();
  const result = runner.run(domain);

  assert.equal(result.passed, true, `Expected pass but got issues: ${result.issues.join(", ")}`);
});

test("resource quotas: runtimeChecks includes resource_quota check", async () => {
  const domain = createTestDomain({ domainId: "quota-check-domain" });

  const runner = new DomainSmokeTestRunner();
  const result = runner.run(domain);

  const resourceCheck = result.runtimeChecks.find((c) => c.checkId === "resource_quota");
  assert.ok(resourceCheck !== undefined, "Expected resource_quota check in runtimeChecks");
  assert.equal(resourceCheck!.passed, true);
  assert.ok(resourceCheck!.details.includes("maxTokens"));
});

test("resource quotas: different security levels with valid quotas", async () => {
  const securityLevels: Array<DomainCapabilityProfile["securityLevel"]> = ["standard", "elevated", "restricted"];

  for (const level of securityLevels) {
    const domain = createTestDomain({
      domainId: `quota-security-${level}`,
      capabilities: {
        securityLevel: level,
        budgetLimits: { maxTokensPerTask: 6000, maxCostPerTask: 8 },
      },
    });

    const runner = new DomainSmokeTestRunner();
    const result = runner.run(domain);

    assert.equal(result.passed, true, `Security level ${level} should pass: ${result.issues.join(", ")}`);
  }
});