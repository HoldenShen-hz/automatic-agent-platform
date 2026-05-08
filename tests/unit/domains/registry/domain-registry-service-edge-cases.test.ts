/**
 * DomainRegistryService Edge Cases and Additional Coverage Tests
 *
 * Additional tests for edge cases not covered in the main domain-registry-service.test.ts
 * Covers: plugin binding filtering, tool filtering, knowledge namespaces, capability building.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import { DomainRegistryService as BaseDomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import type { DomainDefinition, PluginBinding } from "../../../../src/domains/registry/domain-model.js";

class DomainRegistryService extends BaseDomainRegistryService {
  public constructor(options: ConstructorParameters<typeof BaseDomainRegistryService>[0] = {}) {
    super({
      installedPluginIds: ["plugin-retriever-1", "plugin-adapter-1", "plugin-tool-1"],
      healthyPluginIds: ["plugin-retriever-1", "plugin-adapter-1", "plugin-tool-1"],
      ...options,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createTestDomain(overrides: Partial<DomainDefinition> = {}): DomainDefinition {
  const domainId = overrides.domainId ?? "test-domain";
  return {
    domainId,
    name: "Test Domain",
    description: "A test domain for registry service testing",
    version: 1,
    workflows: [
      {
        workflowId: "wf_main",
        name: "Main Workflow",
        triggerConditions: {},
        steps: [
          {
            stepName: "step_one",
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
        bundleId: "default_tools",
        tools: [
          { toolName: "bash", enabled: true, configOverrides: {} },
          { toolName: "read", enabled: true, configOverrides: {} },
          { toolName: "write", enabled: false, configOverrides: {} },
        ],
      },
    ],
    outputContracts: [
      {
        contractId: "output-contract-1",
        name: "Output Contract 1",
        schema: {},
        validationLevel: "strict",
      },
    ],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["test", "coding"],
      requiredTools: ["bash"],
      optionalTools: ["read"],
      modelPreferences: { default: "claude-3" },
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "restricted",
    },
    executionProfile: {
      executionMode: {
        planningMode: "llm_assisted",
        hotPathMode: "llm_allowed",
        llmInHotPathAllowed: true,
        maxHotPathLatencyMs: 1000,
      },
      latencyTier: "interactive",
      compiledArtifactRef: null,
    },
    status: "validated",
    externalAdapters: [],
    pluginBindings: [
      {
        bindingId: "binding-1",
        domainId,
        pluginType: "retriever",
        pluginId: "plugin-retriever-1",
        priority: 10,
        enabled: true,
        config: {},
      },
      {
        bindingId: "binding-2",
        domainId,
        pluginType: "adapter",
        pluginId: "plugin-adapter-1",
        priority: 5,
        enabled: true,
        config: {},
      },
      {
        bindingId: "binding-3",
        domainId,
        pluginType: "tool",
        pluginId: "plugin-tool-1",
        priority: 1,
        enabled: false,
        config: {},
      },
    ],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin Binding Filtering Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getPluginBindings returns only enabled bindings", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const bindings = service.getPluginBindings("test-domain");

  // binding-3 is disabled
  assert.ok(!bindings.some((b) => b.bindingId === "binding-3"));
  // binding-1 and binding-2 are enabled
  assert.ok(bindings.length >= 2);
});

test("getPluginBindings filters by pluginType retriever", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const retrieverBindings = service.getPluginBindings("test-domain", "retriever");

  assert.ok(retrieverBindings.every((b) => b.pluginType === "retriever" || b.pluginId === "plugin-retriever-1"));
});

test("getPluginBindings filters by pluginType adapter", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const adapterBindings = service.getPluginBindings("test-domain", "adapter");

  assert.ok(adapterBindings.every((b) => b.pluginType === "adapter" || b.bindingId === "binding-2"));
});

test("getPluginBindings returns empty for unknown domain", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const bindings = service.getPluginBindings("unknown-domain");

  assert.deepEqual(bindings, []);
});

test("getPluginBindings sorts by priority descending", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const bindings = service.getPluginBindings("test-domain");

  if (bindings.length >= 2) {
    for (let i = 1; i < bindings.length; i++) {
      assert.ok(bindings[i - 1].priority >= bindings[i].priority);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool Filtering Tests
// ─────────────────────────────────────────────────────────────────────────────

test("filterAllowedTools returns enabled tools from bundles", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const allowedTools = service.filterAllowedTools("test-domain", ["bash", "read", "write", "delete"]);

  assert.ok(allowedTools.includes("bash"));
  assert.ok(allowedTools.includes("read"));
  assert.ok(!allowedTools.includes("write")); // disabled
  assert.ok(!allowedTools.includes("delete")); // not in bundle
});

test("filterAllowedTools includes required tools even if not in bundle", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({
    status: "registered",
    capabilities: {
      supportedTaskTypes: ["test", "coding"],
      requiredTools: ["bash", "custom-tool"],
      optionalTools: ["read"],
      modelPreferences: { default: "claude-3" },
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "restricted",
    },
  }));

  const allowedTools = service.filterAllowedTools("test-domain", ["bash", "custom-tool"]);

  assert.ok(allowedTools.includes("bash"));
  assert.ok(allowedTools.includes("custom-tool")); // required tool
});

test("filterAllowedTools includes optional tools", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const allowedTools = service.filterAllowedTools("test-domain", ["bash", "read"]);

  assert.ok(allowedTools.includes("bash"));
  assert.ok(allowedTools.includes("read")); // optional tool
});

test("filterAllowedTools returns empty array for unknown domain", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const allowedTools = service.filterAllowedTools("unknown-domain", ["bash"]);

  assert.deepEqual(allowedTools, []);
});

test("filterAllowedTools returns empty array when no tools match", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const allowedTools = service.filterAllowedTools("test-domain", ["nonexistent-tool"]);

  assert.deepEqual(allowedTools, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Lookup Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getWorkflow returns workflow configuration", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const workflow = service.getWorkflow("test-domain", "wf_main");

  assert.ok(workflow !== null);
  assert.equal(workflow!.workflowId, "wf_main");
  assert.equal(workflow!.name, "Main Workflow");
  assert.equal(workflow!.steps.length, 1);
});

test("getWorkflow returns null for unknown workflow", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const workflow = service.getWorkflow("test-domain", "nonexistent_workflow");

  assert.equal(workflow, null);
});

test("getWorkflow returns null for unknown domain", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const workflow = service.getWorkflow("unknown-domain", "wf_main");

  assert.equal(workflow, null);
});

test("getWorkflow returns null for domain with no workflows", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ status: "registered", workflows: [] }));

  const workflow = service.getWorkflow("test-domain", "wf_main");

  assert.equal(workflow, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool Bundle Lookup Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getToolBundle returns tool bundle configuration", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const bundle = service.getToolBundle("test-domain", "default_tools");

  assert.ok(bundle !== null);
  assert.equal(bundle!.bundleId, "default_tools");
  assert.equal(bundle!.tools.length, 3);
});

test("getToolBundle returns null for unknown bundle", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const bundle = service.getToolBundle("test-domain", "nonexistent_bundle");

  assert.equal(bundle, null);
});

test("getToolBundle returns null for unknown domain", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const bundle = service.getToolBundle("unknown-domain", "default_tools");

  assert.equal(bundle, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Output Contract Lookup Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getOutputContract returns output contract configuration", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const contract = service.getOutputContract("test-domain", "output-contract-1");

  assert.ok(contract !== null);
  assert.equal(contract!.contractId, "output-contract-1");
  assert.equal(contract!.validationLevel, "strict");
});

test("getOutputContract returns null for unknown contract", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const contract = service.getOutputContract("test-domain", "nonexistent_contract");

  assert.equal(contract, null);
});

test("getOutputContract returns null for unknown domain", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const contract = service.getOutputContract("unknown-domain", "output-contract-1");

  assert.equal(contract, null);
});

test("getOutputContract returns null for domain with no contracts", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ status: "registered", outputContracts: [] }));

  const contract = service.getOutputContract("test-domain", "output-contract-1");

  assert.equal(contract, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Capability Entry Building Tests
// ─────────────────────────────────────────────────────────────────────────────

test("buildCapabilityEntry returns complete capability summary", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const entry = service.buildCapabilityEntry("test-domain");

  assert.equal(entry.domainId, "test-domain");
  assert.ok(entry.toolNames.includes("bash"));
  assert.ok(entry.skillIds.includes("wf_main"));
  assert.ok(entry.pluginIds.includes("plugin-retriever-1"));
  assert.ok(entry.pluginIds.includes("plugin-adapter-1"));
});

test("buildCapabilityEntry includes bundleId from first tool bundle", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const entry = service.buildCapabilityEntry("test-domain");

  assert.equal(entry.bundleId, "default_tools");
});

test("buildCapabilityEntry returns default bundleId when no bundles", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ status: "registered", toolBundles: [] }));

  const entry = service.buildCapabilityEntry("test-domain");

  assert.equal(entry.bundleId, "test-domain.default");
});

test("buildCapabilityEntry includes knowledge namespaces", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());
  service.registerKnowledgeNamespace("ns1", "test-domain");
  service.registerKnowledgeNamespace("ns2", "test-domain");

  const entry = service.buildCapabilityEntry("test-domain");

  assert.ok(entry.knowledgeNamespaces.includes("ns1"));
  assert.ok(entry.knowledgeNamespaces.includes("ns2"));
});

test("buildCapabilityEntry throws for unknown domain", () => {
  const service = new DomainRegistryService();

  assert.throws(
    () => service.buildCapabilityEntry("unknown-domain"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.domain_not_found",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge Namespace Registration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("registerKnowledgeNamespace tracks multiple namespaces per domain", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  service.registerKnowledgeNamespace("namespace-1", "test-domain");
  service.registerKnowledgeNamespace("namespace-2", "test-domain");
  service.registerKnowledgeNamespace("namespace-3", "test-domain");

  const entry = service.buildCapabilityEntry("test-domain");

  assert.equal(entry.knowledgeNamespaces.length, 3);
  assert.ok(entry.knowledgeNamespaces.includes("namespace-1"));
  assert.ok(entry.knowledgeNamespaces.includes("namespace-2"));
  assert.ok(entry.knowledgeNamespaces.includes("namespace-3"));
});

test("registerKnowledgeNamespace allows same namespace for different domains", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "domain-a" }));
  service.register(createTestDomain({ domainId: "domain-b" }));

  service.registerKnowledgeNamespace("shared-namespace", "domain-a");
  service.registerKnowledgeNamespace("shared-namespace", "domain-b");

  const entryA = service.buildCapabilityEntry("domain-a");
  const entryB = service.buildCapabilityEntry("domain-b");

  assert.ok(entryA.knowledgeNamespaces.includes("shared-namespace"));
  assert.ok(entryB.knowledgeNamespaces.includes("shared-namespace"));
});

// ─────────────────────────────────────────────────────────────────────────────
// List Operations Tests
// ─────────────────────────────────────────────────────────────────────────────

test("list returns all registered domains", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "domain-1" }));
  service.register(createTestDomain({ domainId: "domain-2" }));
  service.register(createTestDomain({ domainId: "domain-3" }));

  const domains = service.list();

  assert.equal(domains.length, 3);
  assert.ok(domains.some((d) => d.domainId === "domain-1"));
  assert.ok(domains.some((d) => d.domainId === "domain-2"));
  assert.ok(domains.some((d) => d.domainId === "domain-3"));
});

test("listActive returns only active domains", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "active-1", status: "active" }));
  service.register(createTestDomain({ domainId: "active-2", status: "active" }));
  service.register(createTestDomain({ domainId: "registered-1", status: "registered" }));

  const activeDomains = service.listActive();

  assert.equal(activeDomains.length, 2);
  assert.ok(activeDomains.every((d) => d.status === "active"));
  assert.ok(activeDomains.some((d) => d.domainId === "active-1"));
  assert.ok(activeDomains.some((d) => d.domainId === "active-2"));
});

test("listActive excludes deprecated domains", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "active-domain", status: "active" }));
  service.register(createTestDomain({ domainId: "deprecated-domain", status: "deprecated" }));

  const activeDomains = service.listActive();

  assert.ok(!activeDomains.some((d) => d.domainId === "deprecated-domain"));
});

test("listActive excludes archived domains", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "active-domain", status: "active" }));
  service.register(createTestDomain({ domainId: "archived-domain", status: "archived" }));

  const activeDomains = service.listActive();

  assert.ok(!activeDomains.some((d) => d.domainId === "archived-domain"));
});

test("list returns empty array when no domains registered", () => {
  const service = new DomainRegistryService();

  const domains = service.list();

  assert.deepEqual(domains, []);
});

test("listActive returns empty array when no active domains", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain({ domainId: "deprecated", status: "deprecated" }));

  const activeDomains = service.listActive();

  assert.deepEqual(activeDomains, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// Get Operations Tests
// ─────────────────────────────────────────────────────────────────────────────

test("get returns registered domain", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const domain = service.get("test-domain");

  assert.ok(domain !== null);
  assert.equal(domain!.domainId, "test-domain");
});

test("get returns null for unknown domain", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const domain = service.get("unknown-domain");

  assert.equal(domain, null);
});

test("get returns null when no domains registered", () => {
  const service = new DomainRegistryService();

  const domain = service.get("any-domain");

  assert.equal(domain, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Event Publishing Tests
// ─────────────────────────────────────────────────────────────────────────────

test("register publishes domain:registered event", () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });

  service.register(createTestDomain());

  assert.ok(events.some((e) => e.eventType === "domain:registered"));
  const event = events.find((e) => e.eventType === "domain:registered")!;
  assert.equal(event.payload.domainId, "test-domain");
});

test("activate publishes domain:activated event", () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });
  service.register(createTestDomain({ status: "registered" }));

  service.activate("test-domain", true);

  assert.ok(events.some((e) => e.eventType === "domain:activated"));
});

test("deprecate does not publish event (no explicit deprecate event)", () => {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input as { eventType: string; payload: Record<string, unknown> });
      },
    },
  });
  service.register(createTestDomain({ status: "active" }));

  service.deprecate("test-domain");

  // No event should be published for deprecate
  assert.ok(!events.some((e) => e.eventType === "domain:deprecated"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Smoke Test Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("validate returns passed for valid domain", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const result = service.validate("test-domain");

  assert.equal(result.passed, true);
  assert.deepEqual(result.issues, []);
});

test("validate returns failed for unknown domain", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  assert.throws(
    () => service.validate("unknown-domain"),
    (err: unknown) => err instanceof ValidationError,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Plugin Resolution Tests
// ─────────────────────────────────────────────────────────────────────────────

test("resolvePlugins returns empty array when no plugin registry", () => {
  const service = new DomainRegistryService();
  service.register(createTestDomain());

  const plugins = service.resolvePlugins("test-domain", "retriever");

  assert.deepEqual(plugins, []);
});

test("resolvePlugins returns empty array for unknown plugin type", () => {
  const service = new DomainRegistryService({ pluginRegistry: undefined });
  service.register(createTestDomain());

  const plugins = service.resolvePlugins("test-domain", "evaluator");

  assert.deepEqual(plugins, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling Tests
// ─────────────────────────────────────────────────────────────────────────────

test("activate throws ValidationError for unknown domain", () => {
  const service = new DomainRegistryService();

  assert.throws(
    () => service.activate("unknown-domain", false),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.domain_not_found",
  );
});

test("deprecate throws ValidationError for unknown domain", () => {
  const service = new DomainRegistryService();

  assert.throws(
    () => service.deprecate("unknown-domain"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.domain_not_found",
  );
});

test("updating throws ValidationError for unknown domain", () => {
  const service = new DomainRegistryService();

  assert.throws(
    () => service.updating("unknown-domain"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.domain_not_found",
  );
});

test("completeUpdate throws ValidationError for unknown domain", () => {
  const service = new DomainRegistryService();

  assert.throws(
    () => service.completeUpdate("unknown-domain"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.domain_not_found",
  );
});

test("archive throws ValidationError for unknown domain", () => {
  const service = new DomainRegistryService();

  assert.throws(
    () => service.archive("unknown-domain"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.domain_not_found",
  );
});

test("validate throws ValidationError for unknown domain", () => {
  const service = new DomainRegistryService();

  assert.throws(
    () => service.validate("unknown-domain"),
    (err: unknown) => err instanceof ValidationError && err.code === "domain_registry.domain_not_found",
  );
});
