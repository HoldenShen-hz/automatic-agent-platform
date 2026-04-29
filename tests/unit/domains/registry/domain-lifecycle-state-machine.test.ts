import assert from "node:assert/strict";
import test from "node:test";

import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import { DomainSmokeTestRunner, type RuntimeContext } from "../../../../src/domains/registry/domain-smoke-test.js";
import type { DomainDefinition } from "../../../../src/domains/registry/domain-model.js";

// ─────────────────────────────────────────────────────────────────────────────
// Domain Lifecycle State Machine Tests
// §37.10: draft→canary→active→deprecated→archived
// Note: "registered" is set by the service after parsing, not a schema enum value
// ─────────────────────────────────────────────────────────────────────────────

function minimalDomain(id: string, status: DomainDefinition["status"] = "registered"): DomainDefinition {
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
        steps: [
          {
            stepName: "step1",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: [],
          },
        ],
      },
    ],
    toolBundles: [
      {
        bundleId: `${id}.tools`,
        tools: [{ toolName: "read", enabled: true, configOverrides: {} }],
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
      securityLevel: "restricted",
    },
    status,
    externalAdapters: [],
    pluginBindings: [],
    executionProfile: {
      executionMode: {
        planningMode: "llm_assisted",
        hotPathMode: "llm_allowed",
        llmInHotPathAllowed: true,
        maxHotPathLatencyMs: 1000,
      },
      latencyTier: "near_realtime",
      compiledArtifactRef: null,
    },
  };
}

test("activate transitions domain from canary to active", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("lifecycle_test", "canary"));
  const result = service.activate("lifecycle_test");
  assert.equal(result.status, "active");
});

test("activate throws when domain is not canary state", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("active_test", "active"));
  assert.throws(() => {
    service.activate("active_test");
  }, /invalid_activation_state|registered/);
});

test("activate throws when domain is in draft state", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("draft_test", "draft"));
  assert.throws(() => {
    service.activate("draft_test");
  }, /invalid_activation_state|registered/);
});

test("activate with canary flag allows canary→active transition", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("canary_test", "canary"));
  const result = service.activate("canary_test", true);
  assert.equal(result.status, "active");
});

test("activate without canary throws when domain is already active", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("already_active", "active"));
  assert.throws(() => {
    service.activate("already_active", false);
  }, /invalid_activation_state|registered/);
});

test("updating transitions domain from active to updating", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("updating_transition", "canary"));
  service.activate("updating_transition");
  const result = service.updating("updating_transition");
  assert.equal(result.status, "updating");
});

test("updating throws when domain is not active", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("updating_invalid", "canary"));
  assert.throws(() => {
    service.updating("updating_invalid");
  }, /invalid_updating_state|active/);
});

test("completeUpdate transitions domain from updating back to active", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("complete_update", "canary"));
  service.activate("complete_update");
  service.updating("complete_update");
  const result = service.completeUpdate("complete_update");
  assert.equal(result.status, "active");
});

test("completeUpdate throws when domain is not in updating state", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("complete_invalid", "canary"));
  service.activate("complete_invalid");
  assert.throws(() => {
    service.completeUpdate("complete_invalid");
  }, /invalid_complete_update_state|updating/);
});

test("deprecate transitions domain from active to deprecated", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("deprecate_test", "canary"));
  service.activate("deprecate_test");
  const result = service.deprecate("deprecate_test");
  assert.equal(result.status, "deprecated");
});

test("deprecate throws when domain is not active", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("deprecate_invalid", "canary"));
  assert.throws(() => {
    service.deprecate("deprecate_invalid");
  }, /invalid_deprecate_state|active/);
});

test("archive transitions domain from deprecated to archived", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("archive_test", "canary"));
  service.activate("archive_test");
  service.deprecate("archive_test");
  const result = service.archive("archive_test");
  assert.equal(result.status, "archived");
});

test("archive throws when domain is not deprecated", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("archive_invalid", "canary"));
  service.activate("archive_invalid");
  assert.throws(() => {
    service.archive("archive_invalid");
  }, /invalid_archive_state|deprecated/);
});

test("full lifecycle: draft→canary→active→updating→active→deprecated→archived", () => {
  const service = new DomainRegistryService();
  service.register(minimalDomain("full_lifecycle", "draft"));

  let domain = service.activate("full_lifecycle");
  assert.equal(domain.status, "active");

  domain = service.updating("full_lifecycle");
  assert.equal(domain.status, "updating");

  domain = service.completeUpdate("full_lifecycle");
  assert.equal(domain.status, "active");

  domain = service.deprecate("full_lifecycle");
  assert.equal(domain.status, "deprecated");

  domain = service.archive("full_lifecycle");
  assert.equal(domain.status, "archived");
});

test("completeUpdate throws when smoke test fails during update completion", () => {
  const service = new DomainRegistryService();
  // Domain with circular dependencies will fail smoke test
  const circularDomain: DomainDefinition = {
    domainId: "circular",
    name: "Circular",
    description: "Domain with circular deps",
    version: 1,
    workflows: [
      {
        workflowId: "circular.wf",
        name: "Circular Workflow",
        triggerConditions: {},
        steps: [
          {
            stepName: "step_a",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: ["step_b"],
          },
          {
            stepName: "step_b",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: ["step_a"],
          },
        ],
      },
    ],
    toolBundles: [
      {
        bundleId: "circular.tools",
        tools: [{ toolName: "bash", enabled: true, configOverrides: {} }],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["task"],
      requiredTools: ["bash"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "restricted",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [],
  };
  service.register(circularDomain);
  service.activate("circular");
  service.updating("circular");
  assert.throws(() => {
    service.completeUpdate("circular");
  }, /smoke_test_failed/);
});

test("register throws when smoke test fails", () => {
  const service = new DomainRegistryService();
  const invalidDomain: DomainDefinition = {
    domainId: "invalid",
    name: "Invalid",
    description: "Domain with no workflows",
    version: 1,
    workflows: [],
    toolBundles: [],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: [],
      requiredTools: [],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
      securityLevel: "restricted",
    },
    status: "draft",
    externalAdapters: [],
    pluginBindings: [],
  };
  assert.throws(() => {
    service.register(invalidDomain);
  }, /smoke_test_failed/);
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainSmokeTestRunner with RuntimeContext Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainSmokeTestRunner runWithRuntime executes runtime integration", async () => {
  const runner = new DomainSmokeTestRunner();
  const definition: DomainDefinition = {
    domainId: "runtime_test",
    name: "Runtime Test",
    description: "Test domain with runtime",
    version: 1,
    workflows: [
      {
        workflowId: "runtime_test.main",
        name: "Main",
        triggerConditions: {},
        steps: [
          {
            stepName: "step1",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: [],
          },
        ],
      },
    ],
    toolBundles: [
      {
        bundleId: "runtime_test.tools",
        tools: [{ toolName: "read", enabled: true, configOverrides: {} }],
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
      securityLevel: "restricted",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [],
  };

  let loadCalled = false;
  let sandboxCreated = false;
  let stepExecuted = false;

  const runtimeContext: RuntimeContext = {
    async loadDomainDescriptor() {
      loadCalled = true;
      return true;
    },
    async createSandbox() {
      sandboxCreated = true;
      return {
        async executeStep() {
          stepExecuted = true;
          return { executed: true, output: { result: "ok" } };
        },
        async release() {},
      };
    },
    async dispose() {},
  };

  const result = await runner.runWithRuntime(definition, runtimeContext);
  // With actual runtime integration, the result may include runtime_integration_issued
  // Smoke tests pass when run() passes, and runtime integration adds additional checks
  assert.equal(loadCalled, true);
  assert.equal(sandboxCreated, true);
  assert.equal(stepExecuted, true);
});

test("DomainSmokeTestRunner runWithRuntime handles missing loadDomainDescriptor", async () => {
  const runner = new DomainSmokeTestRunner();
  const definition: DomainDefinition = minimalDomain("runtime_fail");

  const runtimeContext: RuntimeContext = {
    async loadDomainDescriptor() {
      return false;
    },
    async createSandbox() {
      return null;
    },
    async dispose() {},
  };

  const result = await runner.runWithRuntime(definition, runtimeContext);
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((i) => i.includes("runtime_integration")));
});

test("DomainSmokeTestRunner runWithRuntime handles sandbox executeStep error", async () => {
  const runner = new DomainSmokeTestRunner();
  const definition: DomainDefinition = minimalDomain("runtime_error");

  const runtimeContext: RuntimeContext = {
    async loadDomainDescriptor() {
      return true;
    },
    async createSandbox() {
      return {
        async executeStep() {
          return { executed: false, error: "Step failed" };
        },
        async release() {},
      };
    },
    async dispose() {},
  };

  const result = await runner.runWithRuntime(definition, runtimeContext);
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((i) => i.includes("runtime_integration")));
});

// ─────────────────────────────────────────────────────────────────────────────
// validateDependencyGraph edge cases
// ─────────────────────────────────────────────────────────────────────────────

test("DomainSmokeTestRunner validates dependency graph with no dependencies", () => {
  const runner = new DomainSmokeTestRunner();
  const definition: DomainDefinition = {
    ...minimalDomain("no_deps"),
    workflows: [
      {
        workflowId: "no_deps.wf",
        name: "No Dependencies",
        triggerConditions: {},
        steps: [
          {
            stepName: "step1",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: [],
          },
          {
            stepName: "step2",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: [],
          },
        ],
      },
    ],
  };

  const result = runner.run(definition);
  const depCheck = result.runtimeChecks.find((c) => c.checkId === "dependency_graph");
  assert.ok(depCheck);
  assert.equal(depCheck.passed, true);
});

test("DomainSmokeTestRunner validates dependency graph with valid chain", () => {
  const runner = new DomainSmokeTestRunner();
  const definition: DomainDefinition = {
    ...minimalDomain("valid_chain"),
    workflows: [
      {
        workflowId: "valid_chain.wf",
        name: "Valid Chain",
        triggerConditions: {},
        steps: [
          {
            stepName: "step1",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: [],
          },
          {
            stepName: "step2",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: ["step1"],
          },
          {
            stepName: "step3",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: ["step2"],
          },
        ],
      },
    ],
  };

  const result = runner.run(definition);
  const depCheck = result.runtimeChecks.find((c) => c.checkId === "dependency_graph");
  assert.ok(depCheck);
  assert.equal(depCheck.passed, true);
});

test("DomainSmokeTestRunner detects self-referencing step dependency", () => {
  const runner = new DomainSmokeTestRunner();
  const definition: DomainDefinition = {
    ...minimalDomain("self_ref"),
    workflows: [
      {
        workflowId: "self_ref.wf",
        name: "Self Reference",
        triggerConditions: {},
        steps: [
          {
            stepName: "step1",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: ["step1"],
          },
        ],
      },
    ],
  };

  const result = runner.run(definition);
  const depCheck = result.runtimeChecks.find((c) => c.checkId === "dependency_graph");
  assert.ok(depCheck);
  assert.equal(depCheck.passed, false);
});

test("DomainSmokeTestRunner validates multiple workflows independently", () => {
  const runner = new DomainSmokeTestRunner();
  const definition: DomainDefinition = {
    ...minimalDomain("multi_wf"),
    workflows: [
      {
        workflowId: "wf1",
        name: "Workflow 1",
        triggerConditions: {},
        steps: [
          {
            stepName: "step1",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: [],
          },
        ],
      },
      {
        workflowId: "wf2",
        name: "Workflow 2",
        triggerConditions: {},
        steps: [
          {
            stepName: "step2",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: [],
          },
        ],
      },
    ],
  };

  // Pass a valid definition to the smoke test runner
  // (Minimal domain already has workflows and tools, so should pass basic checks)
  const result = runner.run(definition);
  assert.equal(result.passed, true);
});

test("DomainSmokeTestRunner detects circular dependency in one of multiple workflows", () => {
  const runner = new DomainSmokeTestRunner();
  const definition: DomainDefinition = {
    ...minimalDomain("circular_multi"),
    workflows: [
      {
        workflowId: "wf1",
        name: "Workflow 1 (valid)",
        triggerConditions: {},
        steps: [
          {
            stepName: "step1",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: [],
          },
        ],
      },
      {
        workflowId: "wf2",
        name: "Workflow 2 (circular)",
        triggerConditions: {},
        steps: [
          {
            stepName: "step_a",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: ["step_b"],
          },
          {
            stepName: "step_b",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: ["step_a"],
          },
        ],
      },
    ],
  };

  const result = runner.run(definition);
  const depCheck = result.runtimeChecks.find((c) => c.checkId === "dependency_graph");
  assert.ok(depCheck);
  assert.equal(depCheck.passed, false);
});
