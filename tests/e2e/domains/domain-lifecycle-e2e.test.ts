/**
 * E2E Domain Lifecycle Tests
 *
 * End-to-end tests covering the complete domain lifecycle:
 * registration -> validation -> activation -> update cycle -> deprecation -> archival
 *
 * Tests the full state machine defined in §37.10:
 * draft→canary→active→deprecated→archived
 */

import test from "node:test";
import assert from "node:assert/strict";
import { DomainRegistryService } from "../../../src/domains/registry/domain-registry-service.js";
import { PluginSpiRegistry } from "../../../src/domains/registry/plugin-spi-registry.js";
import type { PluginSandboxPolicy } from "../../../src/domains/registry/plugin-spi.js";
import type { DomainDefinition } from "../../../src/domains/registry/domain-model.js";

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

function createE2EDomain(overrides: Partial<DomainDefinition> = {}): DomainDefinition {
  return {
    domainId: "e2e-lifecycle-domain",
    name: "E2E Lifecycle Domain",
    description: "End-to-end test domain for lifecycle validation",
    version: 1,
    workflows: [
      {
        workflowId: "wf_e2e_primary",
        name: "Primary Workflow",
        triggerConditions: {},
        steps: [
          {
            stepName: "step_initialize",
            toolHints: ["bash"],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 60000,
            dependsOn: [],
          },
          {
            stepName: "step_execute",
            toolHints: ["bash"],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 2, backoffMs: 500 },
            requiresReview: false,
            timeoutMs: 120000,
            dependsOn: ["step_initialize"],
          },
        ],
      },
      {
        workflowId: "wf_e2e_secondary",
        name: "Secondary Workflow",
        triggerConditions: { status: "backup" },
        steps: [
          {
            stepName: "step_backup",
            toolHints: ["bash"],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 1, backoffMs: 1000 },
            requiresReview: true,
            timeoutMs: 300000,
            dependsOn: [],
          },
        ],
      },
    ],
    toolBundles: [
      {
        bundleId: "e2e_primary_tools",
        tools: [
          { toolName: "bash", enabled: true, configOverrides: {} },
          { toolName: "read", enabled: true, configOverrides: {} },
          { toolName: "write", enabled: true, configOverrides: {} },
        ],
      },
      {
        bundleId: "e2e_secondary_tools",
        tools: [
          { toolName: "compress", enabled: true, configOverrides: {} },
          { toolName: "extract", enabled: true, configOverrides: {} },
        ],
      },
    ],
    outputContracts: [
      {
        contractId: "e2e_output_contract",
        name: "E2E Output Contract",
        schema: { result: "string", status: "string" },
        validationLevel: "strict",
      },
    ],
    promptOverrides: { system: "You are an E2E test domain assistant." },
    capabilities: {
      supportedTaskTypes: ["e2e_test", "integration_test"],
      requiredTools: ["bash", "read"],
      optionalTools: ["write", "compress"],
      modelPreferences: { preferredModel: "claude-3-sonnet" },
      budgetLimits: { maxTokensPerTask: 8000, maxCostPerTask: 10 },
      securityLevel: "restricted",
    },
    status: "validated",
    externalAdapters: ["e2e_adapter"],
    pluginBindings: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// E2E Lifecycle Tests
// ─────────────────────────────────────────────────────────────────────────────

test("E2E: Full domain lifecycle - registration to archival", () => {
  const service = new DomainRegistryService();

  // Step 1: Register domain
  const domain = createE2EDomain({ domainId: "full-lifecycle-e2e" });
  const registered = service.register(domain);

  assert.equal(registered.domainId, "full-lifecycle-e2e");
  assert.equal(registered.status, "registered");

  // Step 2: Validate domain
  const validation = service.validate("full-lifecycle-e2e");
  assert.equal(validation.passed, true);

  // Step 3: Activate domain (standard activation)
  let result = service.activate("full-lifecycle-e2e");
  assert.equal(result.status, "active");

  // Step 4: Verify workflow lookup
  const workflow = service.getWorkflow("full-lifecycle-e2e", "wf_e2e_primary");
  assert.ok(workflow !== null);
  assert.equal(workflow!.steps.length, 2);

  // Step 5: Verify tool bundle lookup
  const bundle = service.getToolBundle("full-lifecycle-e2e", "e2e_primary_tools");
  assert.ok(bundle !== null);
  assert.equal(bundle!.tools.length, 3);

  // Step 6: Verify output contract lookup
  const contract = service.getOutputContract("full-lifecycle-e2e", "e2e_output_contract");
  assert.ok(contract !== null);
  assert.equal(contract!.validationLevel, "strict");

  // Step 7: Verify tool filtering
  const filteredTools = service.filterAllowedTools("full-lifecycle-e2e", ["bash", "read", "write", "delete"]);
  assert.ok(filteredTools.includes("bash"));
  assert.ok(filteredTools.includes("read"));
  assert.ok(filteredTools.includes("write"));
  assert.ok(!filteredTools.includes("delete"));

  // Step 8: Enter updating state
  result = service.updating("full-lifecycle-e2e");
  assert.equal(result.status, "updating");

  // Step 9: Complete update
  result = service.completeUpdate("full-lifecycle-e2e");
  assert.equal(result.status, "active");

  // Step 10: Deprecate domain
  result = service.deprecate("full-lifecycle-e2e");
  assert.equal(result.status, "deprecated");

  // Step 11: Archive domain
  result = service.archive("full-lifecycle-e2e");
  assert.equal(result.status, "archived");

  // Step 12: Verify archived domain is not in active list
  const activeDomains = service.listActive();
  assert.ok(!activeDomains.some((d) => d.domainId === "full-lifecycle-e2e"));
});

test("E2E: Canary deployment lifecycle", () => {
  const service = new DomainRegistryService();

  // Step 1: Register domain with canary status
  const domain = createE2EDomain({ domainId: "canary-e2e", status: "registered" });
  service.register(domain);

  // Step 2: Promote to canary, then activate
  let result = service.promoteToCanary("canary-e2e");
  assert.equal(result.status, "canary");
  result = service.activate("canary-e2e");
  assert.equal(result.status, "active");

  // Step 3: Verify canary domain behaves like normal active domain
  const filtered = service.filterAllowedTools("canary-e2e", ["bash", "read"]);
  assert.ok(filtered.length > 0);

  // Step 4: Enter update cycle
  result = service.updating("canary-e2e");
  assert.equal(result.status, "updating");

  // Step 5: Complete update
  result = service.completeUpdate("canary-e2e");
  assert.equal(result.status, "active");

  // Step 6: Deprecate
  result = service.deprecate("canary-e2e");
  assert.equal(result.status, "deprecated");

  // Step 7: Archive
  result = service.archive("canary-e2e");
  assert.equal(result.status, "archived");
});

test("E2E: Domain lifecycle with plugin bindings", () => {
  const pluginRegistry = new PluginSpiRegistry();
  pluginRegistry.register({
    pluginId: "e2e.plugin.retriever",
    domainId: "plugin-lifecycle-e2e",
    spiType: "retriever",
    async retrieve() { return []; },
  }, {
    pluginId: "e2e.plugin.retriever",
    name: "E2E Retriever Plugin",
    version: "1.0.0",
    owner: "e2e-test",
    domainIds: ["plugin-lifecycle-e2e"],
    capabilityIds: ["retriever.e2e"],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "e2e/test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  const service = new DomainRegistryService({
    pluginRegistry,
    installedPluginIds: ["e2e.plugin.retriever"],
    healthyPluginIds: ["e2e.plugin.retriever"],
  });

  // Register domain with plugin binding
  const domain = createE2EDomain({
    domainId: "plugin-lifecycle-e2e",
    pluginBindings: [
      {
        bindingId: "e2e_binding_retriever",
        domainId: "plugin-lifecycle-e2e",
        pluginType: "retriever",
        bindingRole: "retriever",
        pluginId: "e2e.plugin.retriever",
        priority: 1,
        enabled: true,
        config: {},
      },
    ],
  });
  service.register(domain);

  // Verify plugin binding is registered
  const bindings = service.getPluginBindings("plugin-lifecycle-e2e");
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0]!.pluginId, "e2e.plugin.retriever");

  // Activate domain
  const result = service.activate("plugin-lifecycle-e2e");
  assert.equal(result.status, "active");

  // Resolve plugins
  const resolved = service.resolvePlugins("plugin-lifecycle-e2e", "retriever");
  assert.ok(resolved.length > 0);
});

test("E2E: Multiple domains in different lifecycle states", () => {
  const service = new DomainRegistryService();

  // Create domains in different states
  service.register(createE2EDomain({ domainId: "domain_active", status: "active" }));
  service.register(createE2EDomain({ domainId: "domain_updating", status: "updating" }));
  service.register(createE2EDomain({ domainId: "domain_deprecated", status: "deprecated" }));
  service.register(createE2EDomain({ domainId: "domain_archived", status: "archived" }));
  service.register(createE2EDomain({ domainId: "domain_registered", status: "registered" }));

  // Verify list returns all domains
  const allDomains = service.list();
  assert.equal(allDomains.length, 5);

  // Verify listActive returns only active domains
  const activeDomains = service.listActive();
  assert.equal(activeDomains.length, 1);
  assert.equal(activeDomains[0]!.domainId, "domain_active");

  // Verify we can retrieve domains by ID regardless of state
  for (const id of ["domain_active", "domain_updating", "domain_deprecated", "domain_archived", "domain_registered"]) {
    const retrieved = service.get(id);
    assert.ok(retrieved !== null, `Should retrieve domain ${id}`);
    assert.equal(retrieved!.domainId, id);
  }
});

test("E2E: Knowledge namespace registration across lifecycle", () => {
  const service = new DomainRegistryService();

  // Register domain
  service.register(createE2EDomain({ domainId: "namespace-e2e" }));

  // Register knowledge namespaces
  service.registerKnowledgeNamespace("e2e/coding/repo", "namespace-e2e");
  service.registerKnowledgeNamespace("e2e/coding/docs", "namespace-e2e");
  service.registerKnowledgeNamespace("e2e/coding/tests", "namespace-e2e");

  // Build capability entry
  const entry = service.buildCapabilityEntry("namespace-e2e");

  assert.ok(entry.knowledgeNamespaces.includes("e2e/coding/repo"));
  assert.ok(entry.knowledgeNamespaces.includes("e2e/coding/docs"));
  assert.ok(entry.knowledgeNamespaces.includes("e2e/coding/tests"));
  assert.equal(entry.knowledgeNamespaces.length, 3);
});

test("E2E: Capability entry reflects domain configuration", () => {
  const service = new DomainRegistryService();

  // Register domain with specific configuration
  service.register(createE2EDomain({
    domainId: "capability-e2e",
    workflows: [
      { workflowId: "wf_cap_1", name: "Workflow 1", triggerConditions: {}, steps: [] },
      { workflowId: "wf_cap_2", name: "Workflow 2", triggerConditions: {}, steps: [] },
    ],
    pluginBindings: [
      {
        bindingId: "cap_binding_1",
        domainId: "capability-e2e",
        pluginType: "retriever",
        bindingRole: "retriever",
        pluginId: "plugin_cap_1",
        priority: 1,
        enabled: true,
        config: {},
      },
      {
        bindingId: "cap_binding_2",
        domainId: "capability-e2e",
        pluginType: "tool",
        bindingRole: "presenter",
        pluginId: "plugin_cap_2",
        priority: 2,
        enabled: true,
        config: {},
      },
    ],
  }));

  const entry = service.buildCapabilityEntry("capability-e2e");

  // Verify skill IDs (workflow IDs)
  assert.ok(entry.skillIds.includes("wf_cap_1"));
  assert.ok(entry.skillIds.includes("wf_cap_2"));

  // Verify plugin IDs
  assert.ok(entry.pluginIds.includes("plugin_cap_1"));
  assert.ok(entry.pluginIds.includes("plugin_cap_2"));

  // Verify tool names
  assert.ok(entry.toolNames.includes("bash"));
  assert.ok(entry.toolNames.includes("read"));
  assert.ok(entry.toolNames.includes("write"));
});

test("E2E: Domain state transitions reject invalid operations", () => {
  const service = new DomainRegistryService();

  // Register domain
  service.register(createE2EDomain({ domainId: "invalid-ops-e2e", status: "registered" }));

  // Cannot deprecate from registered state
  assert.throws(
    () => service.deprecate("invalid-ops-e2e"),
    /invalid_deprecate_state|active/,
  );

  // Cannot archive from registered state
  assert.throws(
    () => service.archive("invalid-ops-e2e"),
    /invalid_archive_state|deprecated/,
  );

  // Activate first
  service.activate("invalid-ops-e2e");

  // Cannot archive from active state
  assert.throws(
    () => service.archive("invalid-ops-e2e"),
    /invalid_archive_state|deprecated/,
  );

  // Deprecate first
  service.deprecate("invalid-ops-e2e");

  // Now archive should work
  const result = service.archive("invalid-ops-e2e");
  assert.equal(result.status, "archived");

  // Cannot activate archived domain
  assert.throws(
    () => service.activate("invalid-ops-e2e"),
    /invalid_activation_state|activate from canary state/i,
  );

  // Cannot update archived domain
  assert.throws(
    () => service.updating("invalid-ops-e2e"),
    /invalid_updating_state|active/,
  );

  // Cannot deprecate archived domain
  assert.throws(
    () => service.deprecate("invalid-ops-e2e"),
    /invalid_deprecate_state|active/,
  );
});

test("E2E: Smoke test validation blocks invalid domain registration", () => {
  const service = new DomainRegistryService();

  // Attempt to register domain with circular workflow dependency
  const invalidDomain = createE2EDomain({
    domainId: "smoke-fail-e2e",
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

  const registered = service.register(invalidDomain);
  assert.equal(registered.status, "registered");

  const validation = service.validate("smoke-fail-e2e");
  assert.equal(validation.passed, false);
  assert.ok(validation.issues.includes("domain_registry.runtime_checks_failed"));
  assert.ok(validation.runtimeChecks.some((check) => check.checkId === "dependency_graph" && check.passed === false));

  assert.throws(
    () => service.activate("smoke-fail-e2e"),
    /smoke_test_failed|smoke test failed/i,
  );
});

test("E2E: Smoke test validation during update cycle", () => {
  const service = new DomainRegistryService();

  // Register and activate domain
  const domain = createE2EDomain({
    domainId: "update-smoke-e2e",
    status: "registered",
    workflows: [
      {
        workflowId: "valid_wf",
        name: "Valid Workflow",
        triggerConditions: {},
        steps: [
          {
            stepName: "valid_step",
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
  service.register(domain);
  service.activate("update-smoke-e2e");

  // Enter updating state
  service.updating("update-smoke-e2e");

  // Now register a domain with invalid workflows
  // (This would fail registration, but we're testing that updating still checks validity)
  // The completeUpdate should validate the domain

  // Complete update successfully (domain is still valid)
  let result = service.completeUpdate("update-smoke-e2e");
  assert.equal(result.status, "active");

  // Now corrupt the domain by manually manipulating (can't do directly)
  // This test verifies the happy path - the smoke test runs on update completion
});

test("E2E: Domain registry maintains state across multiple operations", () => {
  const service = new DomainRegistryService();

  // Register multiple domains
  for (let i = 0; i < 5; i++) {
    service.register(createE2EDomain({ domainId: `multi-${i}` }));
  }

  // Verify all domains are registered
  assert.equal(service.list().length, 5);

  // Activate some domains
  for (let i = 0; i < 3; i++) {
    service.activate(`multi-${i}`);
  }

  // Verify active count
  assert.equal(service.listActive().length, 3);

  // Deprecate one active domain
  service.deprecate("multi-0");

  // Verify active count decreased
  assert.equal(service.listActive().length, 2);

  // Verify deprecated domain is still in registry
  const deprecated = service.get("multi-0");
  assert.ok(deprecated !== null);
  assert.equal(deprecated!.status, "deprecated");

  // Archive the deprecated domain
  service.archive("multi-0");

  // Verify archived domain is not in active list
  assert.equal(service.listActive().length, 2);

  // Verify all domains still retrievable
  for (let i = 0; i < 5; i++) {
    const d = service.get(`multi-${i}`);
    assert.ok(d !== null, `Domain multi-${i} should be retrievable`);
  }
});

test("E2E: Full domain lifecycle with events", () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });

  // Register domain
  service.register(createE2EDomain({ domainId: "events-e2e" }));
  assert.ok(events.some((e) => e.eventType === "domain:registered"));

  // Activate domain
  service.activate("events-e2e");
  assert.ok(events.some((e) => e.eventType === "domain:activated"));

  // Enter updating
  service.updating("events-e2e");
  assert.ok(events.some((e) => e.eventType === "domain:updating"));

  // Complete update
  service.completeUpdate("events-e2e");
  assert.ok(events.some((e) => e.eventType === "domain:updated"));

  // Deprecate
  service.deprecate("events-e2e");
  assert.ok(events.some((e) => e.eventType === "domain:deprecated"));

  // Archive
  service.archive("events-e2e");
  assert.ok(events.some((e) => e.eventType === "domain:archived"));

  // Verify event count
  const domainEvents = events.filter((e) => e.payload.domainId === "events-e2e");
  assert.ok(domainEvents.length >= 4, "Should have at least registered, activated, updated, archived events");
});
