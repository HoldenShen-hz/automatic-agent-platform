import assert from "node:assert/strict";
import test from "node:test";

import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import { DomainSmokeTestRunner } from "../../../../src/domains/registry/domain-smoke-test.js";
import type { DomainDefinition } from "../../../../src/domains/registry/domain-model.js";

function minimalDomain(
  id: string,
  status: DomainDefinition["status"] = "draft",
  overrides: Partial<DomainDefinition> = {},
): DomainDefinition {
  return {
    domainId: id,
    name: `Domain ${id}`,
    description: `Test domain ${id}`,
    version: 1,
    workflows: [
      {
        workflowId: `${id}.main`,
        name: "Main",
        triggerConditions: {},
        steps: [{ stepName: "step-1", dependsOn: [] }],
      },
    ],
    toolBundles: [
      {
        bundleId: `${id}.tools`,
        tools: [{ toolName: "read" }],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["task"],
      requiredTools: ["read"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status,
    externalAdapters: [],
    pluginBindings: [],
    ...overrides,
  };
}

test("register normalizes draft and canary into registered", () => {
  const service = new DomainRegistryService();

  const draft = service.register(minimalDomain("draft-domain", "draft"));
  const canary = service.register(minimalDomain("canary-domain", "canary"));

  assert.equal(draft.status, "registered");
  assert.equal(canary.status, "registered");
});

test("activate transitions registered domain to active", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("activate-me", "registered"));

  const result = service.activate("activate-me");

  assert.equal(result.status, "active");
});

test("updating and completeUpdate round-trip active domain through updating", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("update-cycle", "active"));

  const updating = service.updating("update-cycle");
  const completed = service.completeUpdate("update-cycle");

  assert.equal(updating.status, "updating");
  assert.equal(completed.status, "active");
});

test("deprecate and archive follow current lifecycle guards", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("archive-cycle", "active"));

  const deprecated = service.deprecate("archive-cycle");
  const archived = service.archive("archive-cycle");

  assert.equal(deprecated.status, "deprecated");
  assert.equal(archived.status, "archived");
});

test("invalid transitions throw validation errors", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("invalid-active", "active"));
  service.register(minimalDomain("invalid-registered", "registered"));
  service.register(minimalDomain("invalid-deprecated", "deprecated"));

  assert.throws(() => service.activate("invalid-active"), /activate from registered state/i);
  assert.throws(() => service.updating("invalid-registered"), /enter updating from active state/i);
  assert.throws(() => service.completeUpdate("invalid-active"), /complete update from updating state/i);
  assert.throws(() => service.archive("invalid-active"), /archive from deprecated state/i);
  assert.throws(() => service.activate("invalid-deprecated"), /activate from registered state/i);
});

test("completeUpdate fails when smoke validation detects circular dependencies", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("circular", "updating", {
    workflows: [
      {
        workflowId: "circular.main",
        name: "Circular",
        triggerConditions: {},
        steps: [
          { stepName: "step-a", dependsOn: ["step-b"] },
          { stepName: "step-b", dependsOn: ["step-a"] },
        ],
      },
    ],
  }));

  assert.throws(() => service.completeUpdate("circular"), /smoke test failed during update completion/i);
});

test("DomainSmokeTestRunner reports current runtime checks", () => {
  const runner = new DomainSmokeTestRunner();
  const result = runner.run(minimalDomain("runner-check"));

  assert.equal(result.passed, true);
  assert.deepEqual(
    result.runtimeChecks.map((check) => check.checkId),
    ["dependency_graph", "sandbox_compatibility", "resource_quota", "execution_profile"],
  );
});

test("DomainSmokeTestRunner detects self dependency and missing required tools", () => {
  const runner = new DomainSmokeTestRunner();
  const result = runner.run(minimalDomain("runner-fail", "registered", {
    workflows: [
      {
        workflowId: "runner-fail.main",
        name: "Self Ref",
        triggerConditions: {},
        steps: [{ stepName: "step-1", dependsOn: ["step-1"] }],
      },
    ],
    toolBundles: [
      {
        bundleId: "runner-fail.tools",
        tools: [{ toolName: "read" }],
      },
    ],
    capabilities: {
      supportedTaskTypes: ["task"],
      requiredTools: ["bash"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "restricted",
    },
  }));

  assert.equal(result.passed, false);
  assert.ok(result.issues.includes("domain_registry.missing_required_tools"));
  assert.equal(result.runtimeChecks.find((check) => check.checkId === "dependency_graph")?.passed, false);
});
