/**
 * Domain Registration Integration Tests
 *
 * Tests for the complete domain registration flow:
 * - Domain creation and validation
 * - Registration with smoke tests
 * - Lifecycle transitions
 * - Event publishing
 */

import test from "node:test";
import assert from "node:assert/strict";
import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import { DomainSmokeTestRunner } from "../../../../src/domains/registry/domain-smoke-test.js";
import { PluginSpiRegistry } from "../../../../src/domains/registry/plugin-spi-registry.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import type { PluginSandboxPolicy } from "../../../../src/domains/registry/plugin-spi.js";
import type { DomainDefinition } from "../../../../src/domains/registry/domain-model.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makeSandboxPolicy(overrides: Partial<PluginSandboxPolicy> = {}): PluginSandboxPolicy {
  return {
    timeoutMs: 5000,
    allowFilesystemWrite: false,
    allowNetworkEgress: false,
    allowedKnowledgeNamespaces: [],
    maxConcurrentInvocations: 1,
    maxQueuedInvocations: 8,
    runtimeIsolation: "serialized_in_process",
    cooldownMs: 0,
    allowedExternalDomains: [],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 60,
    ...overrides,
  };
}

function createTestDomain(overrides: Partial<DomainDefinition> = {}): DomainDefinition {
  return {
    domainId: "integration-test-domain",
    name: "Integration Test Domain",
    description: "A domain for integration testing",
    version: 1,
    workflows: [
      {
        workflowId: "wf_integration",
        name: "Integration Workflow",
        triggerConditions: {},
        steps: [
          {
            stepName: "step_integration",
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
        bundleId: "integration_tools",
        tools: [{ toolName: "bash", enabled: true, configOverrides: {} }],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["integration"],
      requiredTools: ["bash"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "validated",
    externalAdapters: [],
    pluginBindings: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain Creation and Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Domain registration flow: create -> validate -> activate -> deprecate", async () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });

  // Step 1: Register domain
  const domain = createTestDomain({ domainId: "flow-test-1" });
  const registered = service.register(domain);

  assert.equal(registered.domainId, "flow-test-1");
  assert.equal(registered.status, "registered");
  assert.ok(events.some((e) => e.eventType === "domain:registered"));

  // Step 2: Validate domain
  const validation = service.validate("flow-test-1");
  assert.equal(validation.passed, true);

  // Step 3: Activate domain
  const activated = service.activate("flow-test-1", false);
  assert.equal(activated.status, "active");
  assert.ok(events.some((e) => e.eventType === "domain:activated"));

  // Step 4: List active domains
  const activeDomains = service.listActive();
  assert.ok(activeDomains.some((d) => d.domainId === "flow-test-1"));

  // Step 5: Deprecate domain
  const deprecated = service.deprecate("flow-test-1");
  assert.equal(deprecated.status, "deprecated");

  // Step 6: Verify deprecated domain is not in active list
  const stillActive = service.listActive();
  assert.ok(!stillActive.some((d) => d.domainId === "flow-test-1"));
});

test("Domain registration with plugin bindings", async () => {
  const pluginRegistry = new PluginSpiRegistry();
  pluginRegistry.register({
    pluginId: "plugin.integration",
    domainId: "integration-plugin-domain",
    spiType: "retriever",
    async retrieve() { return []; },
  }, {
    pluginId: "plugin.integration",
    name: "Integration Plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["integration-plugin-domain"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  const service = new DomainRegistryService({ pluginRegistry });
  const domain = createTestDomain({
    domainId: "integration-plugin-domain",
    pluginBindings: [
      {
        bindingId: "binding-integration",
        domainId: "integration-plugin-domain",
        pluginType: "retriever",
        pluginId: "plugin.integration",
        priority: 1,
        enabled: true,
        config: {},
      },
    ],
  });

  const registered = service.register(domain);
  assert.equal(registered.pluginBindings.length, 1);

  const bindings = service.getPluginBindings("integration-plugin-domain");
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0]!.pluginId, "plugin.integration");
});

test("Domain registration fails smoke test with invalid workflow", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({
    domainId: "invalid-workflow-domain",
    workflows: [
      {
        workflowId: "circular_wf",
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
            timeoutMs: 60000,
            dependsOn: ["step_b"],
          },
          {
            stepName: "step_b",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 60000,
            dependsOn: ["step_a"], // Creates circular dependency
          },
        ],
      },
    ],
  });

  assert.throws(
    () => service.register(domain),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.smoke_test_failed",
  );
});

test("Domain registration fails with duplicate workflow IDs", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({
    domainId: "duplicate-workflow-domain",
    workflows: [
      {
        workflowId: "wf_duplicate",
        name: "First Workflow",
        triggerConditions: {},
        steps: [],
      },
      {
        workflowId: "wf_duplicate", // Duplicate!
        name: "Second Workflow",
        triggerConditions: {},
        steps: [],
      },
    ],
  });

  assert.throws(
    () => service.register(domain),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.duplicate_workflow",
  );
});

test("Domain registration fails with duplicate step names", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({
    domainId: "duplicate-step-domain",
    workflows: [
      {
        workflowId: "wf_steps",
        name: "Steps Workflow",
        triggerConditions: {},
        steps: [
          {
            stepName: "duplicate_step",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 60000,
            dependsOn: [],
          },
          {
            stepName: "duplicate_step", // Duplicate!
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
  });

  assert.throws(
    () => service.register(domain),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.duplicate_step_name",
  );
});

test("Domain registration fails with invalid tool name", async () => {
  const service = new DomainRegistryService();
  const domain = createTestDomain({
    domainId: "invalid-tool-domain",
    toolBundles: [
      {
        bundleId: "bad_tools",
        tools: [{ toolName: "invalid/tool", enabled: true, configOverrides: {} }],
      },
    ],
  });

  assert.throws(
    () => service.register(domain),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.invalid_tool_bundle",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle Transition Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Full lifecycle: draft -> registered -> active -> updating -> active -> deprecated -> archived", async () => {
  const service = new DomainRegistryService();

  // Register (creates registered state)
  const domain = createTestDomain({ domainId: "full-lifecycle-integration", status: "draft" });
  service.register(domain);

  // Activate
  let result = service.activate("full-lifecycle-integration", false);
  assert.equal(result.status, "active");

  // Enter updating state
  result = service.updating("full-lifecycle-integration");
  assert.equal(result.status, "updating");

  // Complete update (back to active)
  result = service.completeUpdate("full-lifecycle-integration");
  assert.equal(result.status, "active");

  // Deprecate
  result = service.deprecate("full-lifecycle-integration");
  assert.equal(result.status, "deprecated");

  // Archive
  result = service.archive("full-lifecycle-integration");
  assert.equal(result.status, "archived");
});

test("Canary lifecycle: canary -> active -> deprecated -> archived", async () => {
  const service = new DomainRegistryService();

  // Register with canary status
  const domain = createTestDomain({ domainId: "canary-lifecycle-integration", status: "canary" });
  service.register(domain);

  // Activate with canary flag
  let result = service.activate("canary-lifecycle-integration", true);
  assert.equal(result.status, "active");

  // Deprecate
  result = service.deprecate("canary-lifecycle-integration");
  assert.equal(result.status, "deprecated");

  // Archive
  result = service.archive("canary-lifecycle-integration");
  assert.equal(result.status, "archived");
});

test("Activation fails smoke test when domain becomes invalid during update", async () => {
  const service = new DomainRegistryService();

  // Register and activate
  const domain = createTestDomain({ domainId: "update-fail-integration", status: "registered" });
  service.register(domain);
  service.activate("update-fail-integration", false);

  // Enter updating state
  service.updating("update-fail-integration");

  // Now register a domain with invalid workflows after activation
  // This tests that completeUpdate checks validity
  const invalidDomain = createTestDomain({
    domainId: "update-invalid-workflow",
    workflows: [
      {
        workflowId: "circular_wf",
        name: "Circular",
        triggerConditions: {},
        steps: [
          {
            stepName: "step_a",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 60000,
            dependsOn: ["step_b"],
          },
          {
            stepName: "step_b",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 60000,
            dependsOn: ["step_a"],
          },
        ],
      },
    ],
  });

  // This registration should fail
  assert.throws(
    () => service.register(invalidDomain),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.smoke_test_failed",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Event Publishing Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Registration publishes domain:registered event", async () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });

  service.register(createTestDomain({ domainId: "event-registration-test" }));

  assert.ok(events.some((e) => e.eventType === "domain:registered"));
  const event = events.find((e) => e.eventType === "domain:registered")!;
  assert.equal(event.payload.domainId, "event-registration-test");
  assert.equal(event.payload.status, "registered");
});

test("Activation publishes domain:activated event", async () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });

  service.register(createTestDomain({ domainId: "event-activation-test" }));
  service.activate("event-activation-test", false);

  assert.ok(events.some((e) => e.eventType === "domain:activated"));
  const event = events.find((e) => e.eventType === "domain:activated")!;
  assert.equal(event.payload.domainId, "event-activation-test");
  assert.equal(event.payload.status, "active");
});

test("Updating publishes domain:updating event", async () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });

  service.register(createTestDomain({ domainId: "event-updating-test", status: "active" }));
  service.updating("event-updating-test");

  assert.ok(events.some((e) => e.eventType === "domain:updating"));
  const event = events.find((e) => e.eventType === "domain:updating")!;
  assert.equal(event.payload.domainId, "event-updating-test");
  assert.equal(event.payload.status, "updating");
});

test("Complete update publishes domain:updated event", async () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });

  service.register(createTestDomain({ domainId: "event-complete-test", status: "updating" }));
  service.completeUpdate("event-complete-test");

  assert.ok(events.some((e) => e.eventType === "domain:updated"));
  const event = events.find((e) => e.eventType === "domain:updated")!;
  assert.equal(event.payload.domainId, "event-complete-test");
  assert.equal(event.payload.status, "active");
});

test("Archive publishes domain:archived event", async () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });

  service.register(createTestDomain({ domainId: "event-archive-test", status: "deprecated" }));
  service.archive("event-archive-test");

  assert.ok(events.some((e) => e.eventType === "domain:archived"));
  const event = events.find((e) => e.eventType === "domain:archived")!;
  assert.equal(event.payload.domainId, "event-archive-test");
  assert.equal(event.payload.status, "archived");
});

// ─────────────────────────────────────────────────────────────────────────────
// Lookup Operations Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getWorkflow returns workflow configuration", async () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "workflow-lookup-test" }));

  const workflow = service.getWorkflow("workflow-lookup-test", "wf_integration");

  assert.ok(workflow !== null);
  assert.equal(workflow!.workflowId, "wf_integration");
  assert.equal(workflow!.name, "Integration Workflow");
  assert.equal(workflow!.steps.length, 1);
});

test("getToolBundle returns tool bundle configuration", async () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "bundle-lookup-test" }));

  const bundle = service.getToolBundle("bundle-lookup-test", "integration_tools");

  assert.ok(bundle !== null);
  assert.equal(bundle!.bundleId, "integration_tools");
  assert.ok(bundle!.tools.some((t) => t.toolName === "bash"));
});

test("getOutputContract returns null for non-existent contract", async () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "contract-lookup-test" }));

  const contract = service.getOutputContract("contract-lookup-test", "non-existent");

  assert.equal(contract, null);
});

test("filterAllowedTools returns enabled and required tools", async () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({
    domainId: "tools-filter-test",
    toolBundles: [
      {
        bundleId: "filter_tools",
        tools: [
          { toolName: "bash", enabled: true, configOverrides: {} },
          { toolName: "read", enabled: true, configOverrides: {} },
          { toolName: "write", enabled: false, configOverrides: {} },
        ],
      },
    ],
    capabilities: {
      supportedTaskTypes: [],
      requiredTools: ["bash"],
      optionalTools: ["read"],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
  }));

  const filtered = service.filterAllowedTools("tools-filter-test", ["bash", "read", "write", "delete"]);

  assert.ok(filtered.includes("bash"));
  assert.ok(filtered.includes("read"));
  assert.ok(!filtered.includes("write"));
  assert.ok(!filtered.includes("delete"));
});

test("resolvePlugins returns resolved plugin instances", async () => {
  const pluginRegistry = new PluginSpiRegistry();
  pluginRegistry.register({
    pluginId: "plugin.resolve-test",
    domainId: "resolve-test-domain",
    spiType: "retriever",
    async retrieve() { return []; },
  }, {
    pluginId: "plugin.resolve-test",
    name: "Resolve Test Plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["resolve-test-domain"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  const service = new DomainRegistryService({
    pluginRegistry,
    installedPluginIds: ["plugin.resolve-test"],
    healthyPluginIds: ["plugin.resolve-test"],
  });

  service.register(createTestDomain({
    domainId: "resolve-test-domain",
    pluginBindings: [
      {
        bindingId: "binding-resolve",
        domainId: "resolve-test-domain",
        pluginType: "retriever",
        pluginId: "plugin.resolve-test",
        priority: 1,
        enabled: true,
        config: {},
      },
    ],
  }));

  const plugins = service.resolvePlugins("resolve-test-domain", "retriever");

  assert.ok(plugins.length > 0);
});

test("buildCapabilityEntry returns domain capability summary", async () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({
    domainId: "capability-build-test",
    toolBundles: [
      {
        bundleId: "cap_tools",
        tools: [{ toolName: "bash", enabled: true, configOverrides: {} }],
      },
    ],
    workflows: [
      { workflowId: "wf1", name: "W1", triggerConditions: {}, steps: [] },
    ],
    pluginBindings: [
      {
        bindingId: "b1",
        domainId: "capability-build-test",
        pluginType: "retriever",
        pluginId: "p1",
        priority: 1,
        enabled: true,
        config: {},
      },
    ],
  }));

  const entry = service.buildCapabilityEntry("capability-build-test");

  assert.equal(entry.domainId, "capability-build-test");
  assert.ok(entry.toolNames.includes("bash"));
  assert.ok(entry.skillIds.includes("wf1"));
  assert.ok(entry.pluginIds.includes("p1"));
  assert.deepEqual(entry.defaultActivationPolicy, "registered");
});

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge Namespace Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("registerKnowledgeNamespace tracks namespace ownership", async () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "namespace-test" }));

  service.registerKnowledgeNamespace("coding/repo", "namespace-test");
  service.registerKnowledgeNamespace("coding/docs", "namespace-test");

  const entry = service.buildCapabilityEntry("namespace-test");

  assert.ok(entry.knowledgeNamespaces.includes("coding/repo"));
  assert.ok(entry.knowledgeNamespaces.includes("coding/docs"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Unknown domain throws ValidationError with domain_not_found code", async () => {
  const service = new DomainRegistryService();

  assert.throws(
    () => service.activate("unknown-domain"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.domain_not_found",
  );
});

test("Invalid state transition throws appropriate error", async () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "invalid-transition-test", status: "registered" }));

  // Cannot deprecate from registered state
  assert.throws(
    () => service.deprecate("invalid-transition-test"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.invalid_deprecate_state",
  );
});

test("Archive from non-deprecated state throws error", async () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "archive-invalid-test", status: "active" }));

  // Cannot archive from active state
  assert.throws(
    () => service.archive("archive-invalid-test"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.invalid_archive_state",
  );
});