import assert from "node:assert/strict";
import test from "node:test";

import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import { PluginSpiRegistry } from "../../../../src/domains/registry/plugin-spi-registry.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import type { PluginSandboxPolicy } from "../../../../src/domains/registry/plugin-spi.js";
import type { DomainDefinition } from "../../../../src/domains/registry/domain-model.js";

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

function makeMinimalDefinition(overrides: Partial<DomainDefinition> = {}): DomainDefinition {
  return {
    domainId: "test_domain",
    name: "Test Domain",
    description: "A test domain",
    version: 1,
    workflows: [
      {
        workflowId: "wf_test",
        name: "Test Workflow",
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
        bundleId: "default",
        tools: [
          { toolName: "bash", enabled: true, configOverrides: {} },
          { toolName: "read", enabled: true, configOverrides: {} },
        ],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["test"],
      requiredTools: ["bash"],
      optionalTools: ["read"],
      modelPreferences: { primary: "claude-4" },
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "restricted",
    },
    status: "draft",
    externalAdapters: [],
    pluginBindings: [],
    ...overrides,
  };
}

// --- knowledge namespace registration ---

test("registerKnowledgeNamespace adds namespace to domain", () => {
  const service = new DomainRegistryService();
  service.register(makeMinimalDefinition({ domainId: "ns_domain" }));
  service.registerKnowledgeNamespace("ns_domain/repo", "ns_domain");

  const entry = service.buildCapabilityEntry("ns_domain");
  assert.deepEqual(entry.knowledgeNamespaces, ["ns_domain/repo"]);
});

test("registerKnowledgeNamespace accumulates multiple namespaces", () => {
  const service = new DomainRegistryService();
  service.register(makeMinimalDefinition({ domainId: "multi_ns" }));
  service.registerKnowledgeNamespace("multi_ns/docs", "multi_ns");
  service.registerKnowledgeNamespace("multi_ns/code", "multi_ns");

  const entry = service.buildCapabilityEntry("multi_ns");
  assert.deepEqual(entry.knowledgeNamespaces, ["multi_ns/docs", "multi_ns/code"]);
});

test("registerKnowledgeNamespace creates empty set for unknown domain then access", () => {
  const service = new DomainRegistryService();
  // registering namespace for unknown domain should not throw
  service.registerKnowledgeNamespace("unknown/ns", "unknown");

  // capability entry for unknown domain throws
  assert.throws(() => service.buildCapabilityEntry("unknown"), (err: unknown) => {
    return err instanceof ValidationError && err.code === "domain_registry.domain_not_found";
  });
});

// --- capability entry building ---

test("buildCapabilityEntry returns correct structure", () => {
  const pluginRegistry = new PluginSpiRegistry();
  pluginRegistry.register({
    pluginId: "plugin.retriever",
    domainId: "cap_test",
    spiType: "retriever",
    async retrieve() { return []; },
  }, {
    pluginId: "plugin.retriever",
    name: "Test Retriever",
    version: "1.0.0",
    owner: "test",
    domainIds: ["cap_test"],
    capabilityIds: ["knowledge.search"],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  const service = new DomainRegistryService({ pluginRegistry });
  service.register(makeMinimalDefinition({
    domainId: "cap_test",
    toolBundles: [
      {
        bundleId: "default",
        tools: [
          { toolName: "bash", enabled: true, configOverrides: {} },
          { toolName: "read", enabled: false, configOverrides: {} },
        ],
      },
    ],
    pluginBindings: [
      { bindingId: "b1", domainId: "cap_test", pluginType: "retriever", pluginId: "plugin.retriever", priority: 1, enabled: true, config: {} },
    ],
  }));

  const entry = service.buildCapabilityEntry("cap_test");

  assert.equal(entry.domainId, "cap_test");
  assert.equal(entry.bundleId, "default");
  assert.deepEqual(entry.capabilityIds, ["plugin.retriever"]);
  assert.deepEqual(entry.toolNames, ["bash", "read"]);
  assert.deepEqual(entry.skillIds, ["wf_test"]);
  assert.deepEqual(entry.pluginIds, ["plugin.retriever"]);
  assert.equal(entry.defaultActivationPolicy, "registered");
  assert.equal(entry.trustTier, "restricted");
});

test("buildCapabilityEntry uses domainId as bundleId fallback when no bundles", () => {
  const service = new DomainRegistryService();
  service.register(makeMinimalDefinition({
    domainId: "no_bundle",
    toolBundles: [],
  }), { skipSmokeTest: true });

  const entry = service.buildCapabilityEntry("no_bundle");
  assert.equal(entry.bundleId, "no_bundle.default");
});

test("buildCapabilityEntry throws for unknown domain", () => {
  const service = new DomainRegistryService();
  assert.throws(() => service.buildCapabilityEntry("does_not_exist"), (err: unknown) => {
    return err instanceof ValidationError && err.code === "domain_registry.domain_not_found";
  });
});

// --- domain activation lifecycle ---

test("domain transitions from registered to active after activation", () => {
  const service = new DomainRegistryService();
  service.register(makeMinimalDefinition({
    domainId: "lifecycle",
    status: "testing",
    capabilities: {
      supportedTaskTypes: [],
      requiredTools: [],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
  }));

  const activated = service.activate("lifecycle");
  assert.equal(activated.status, "active");
});

test("active domains appear in listActive", () => {
  const service = new DomainRegistryService();
  service.register(makeMinimalDefinition({ domainId: "active_one", status: "testing", capabilities: { supportedTaskTypes: [], requiredTools: [], optionalTools: [], modelPreferences: {}, budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 }, securityLevel: "standard" } }));
  service.register(makeMinimalDefinition({ domainId: "active_two", status: "testing", capabilities: { supportedTaskTypes: [], requiredTools: [], optionalTools: [], modelPreferences: {}, budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 }, securityLevel: "standard" } }));
  service.register(makeMinimalDefinition({ domainId: "still_draft", status: "draft", capabilities: { supportedTaskTypes: [], requiredTools: [], optionalTools: [], modelPreferences: {}, budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 }, securityLevel: "standard" } }));

  service.activate("active_one");

  const active = service.listActive();
  assert.equal(active.length, 1);
  assert.equal(active[0]!.domainId, "active_one");
});

test("deprecated domains do not appear in listActive", () => {
  const service = new DomainRegistryService();
  service.register(makeMinimalDefinition({ domainId: "deprec_soon", status: "active" }));
  service.deprecate("deprec_soon");

  const active = service.listActive();
  assert.equal(active.length, 0);
});

test("deprecate preserves domain data after deprecation", () => {
  const service = new DomainRegistryService();
  service.register(makeMinimalDefinition({ domainId: "preserve", status: "active" }));

  const deprecated = service.deprecate("preserve");
  assert.equal(deprecated.status, "deprecated");
  assert.equal(deprecated.domainId, "preserve");

  const retrieved = service.get("preserve");
  assert.equal(retrieved?.status, "deprecated");
});

test("activating already active domain is rejected by lifecycle guard", () => {
  const service = new DomainRegistryService();
  service.register(makeMinimalDefinition({
    domainId: "double_active",
    status: "active",
    capabilities: {
      supportedTaskTypes: [],
      requiredTools: [],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
  }));

  assert.throws(() => service.activate("double_active"), (err: unknown) => {
    return err instanceof ValidationError && err.code === "domain_registry.invalid_activation_state";
  });
});

test("activate fails for draft domain with no workflows", () => {
  const service = new DomainRegistryService();
  service.register(makeMinimalDefinition({
    domainId: "empty_wf",
    status: "testing",
    workflows: [],
  }), { skipSmokeTest: true });

  assert.throws(() => service.activate("empty_wf"), (err: unknown) => {
    return err instanceof ValidationError && err.code === "domain_registry.smoke_test_failed";
  });
});

// --- filterAllowedTools ---

test("filterAllowedTools returns tools from enabled entries and required/optional lists", () => {
  const service = new DomainRegistryService();
  service.register(makeMinimalDefinition({ domainId: "tools_filter" }));

  const allowed = service.filterAllowedTools("tools_filter", ["bash", "read", "write", "unknown"]);
  assert.deepEqual(allowed.sort(), ["bash", "read"]);
});

test("filterAllowedTools returns empty array for unknown domain", () => {
  const service = new DomainRegistryService();
  const allowed = service.filterAllowedTools("no_such_domain", ["bash", "read"]);
  assert.deepEqual(allowed, []);
});

test("filterAllowedTools includes required tools even if not in any bundle", () => {
  const service = new DomainRegistryService();
  service.register(makeMinimalDefinition({
    domainId: "required_override",
    toolBundles: [
      { bundleId: "default", tools: [{ toolName: "bash", enabled: true, configOverrides: {} }] },
    ],
    capabilities: {
      supportedTaskTypes: [],
      requiredTools: ["bash", "extra_tool"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "restricted",
    },
  }), { skipSmokeTest: true });

  const allowed = service.filterAllowedTools("required_override", ["bash", "extra_tool", "unknown"]);
  assert.ok(allowed.includes("extra_tool"));
});

// --- getPluginBindings with priority sorting ---

test("getPluginBindings returns bindings sorted by priority descending", () => {
  const service = new DomainRegistryService({
    installedPluginIds: ["p_low", "p_high", "p_medium"],
    healthyPluginIds: ["p_low", "p_high", "p_medium"],
  });
  service.register(makeMinimalDefinition({
    domainId: "priority_sort",
    pluginBindings: [
      { bindingId: "b_low", domainId: "priority_sort", pluginType: "retriever", pluginId: "p_low", priority: 1, enabled: true, config: {} },
      { bindingId: "b_high", domainId: "priority_sort", pluginType: "retriever", pluginId: "p_high", priority: 10, enabled: true, config: {} },
      { bindingId: "b_med", domainId: "priority_sort", pluginType: "retriever", pluginId: "p_medium", priority: 5, enabled: true, config: {} },
    ],
  }));

  const bindings = service.getPluginBindings("priority_sort");
  assert.equal(bindings[0]!.pluginId, "p_high");
  assert.equal(bindings[1]!.pluginId, "p_medium");
  assert.equal(bindings[2]!.pluginId, "p_low");
});

test("getPluginBindings excludes disabled bindings", () => {
  const service = new DomainRegistryService({
    installedPluginIds: ["p_disabled", "p_enabled"],
    healthyPluginIds: ["p_disabled", "p_enabled"],
  });
  service.register(makeMinimalDefinition({
    domainId: "enabled_filter",
    pluginBindings: [
      { bindingId: "b_disabled", domainId: "enabled_filter", pluginType: "retriever", pluginId: "p_disabled", priority: 5, enabled: false, config: {} },
      { bindingId: "b_enabled", domainId: "enabled_filter", pluginType: "retriever", pluginId: "p_enabled", priority: 1, enabled: true, config: {} },
    ],
  }));

  const bindings = service.getPluginBindings("enabled_filter");
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0]!.pluginId, "p_enabled");
});

// --- resolvePlugins ---

test("resolvePlugins returns resolved plugin instances", async () => {
  let activated = false;
  const pluginRegistry = new PluginSpiRegistry();
  pluginRegistry.register({
    pluginId: "resolver_plugin",
    domainId: "resolve_test",
    spiType: "presenter",
    async formatOutput() {
      activated = true;
      return { summary: "ok", sections: [], citations: [] };
    },
  }, {
    pluginId: "resolver_plugin",
    name: "Resolver Plugin",
    version: "1.0.0",
    owner: "test",
      domainIds: ["resolve_test"],
      capabilityIds: [],
      spiTypes: ["presenter"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  const service = new DomainRegistryService({ pluginRegistry });
  service.register(makeMinimalDefinition({
    domainId: "resolve_test",
    pluginBindings: [
      { bindingId: "b1", domainId: "resolve_test", pluginType: "tool", bindingRole: "presenter", pluginId: "resolver_plugin", priority: 1, enabled: true, config: {} },
    ],
  }));

  const resolved = service.resolvePlugins("resolve_test", "presenter");
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0]!.pluginId, "resolver_plugin");
});

test("resolvePlugins returns empty array when no plugin registry", () => {
  const service = new DomainRegistryService({});
  service.register(makeMinimalDefinition({ domainId: "no_registry" }));

  const resolved = service.resolvePlugins("no_registry", "presenter");
  assert.deepEqual(resolved, []);
});

test("resolvePlugins returns empty for unknown domain", () => {
  const pluginRegistry = new PluginSpiRegistry();
  const service = new DomainRegistryService({ pluginRegistry });

  const resolved = service.resolvePlugins("unknown_domain", "retriever");
  assert.deepEqual(resolved, []);
});

// --- status reporting ---

test("get returns null for unknown domain", () => {
  const service = new DomainRegistryService();
  assert.equal(service.get("unknown"), null);
});

test("list returns all registered domains", () => {
  const service = new DomainRegistryService();
  service.register(makeMinimalDefinition({ domainId: "domain_1" }));
  service.register(makeMinimalDefinition({ domainId: "domain_2" }));

  const all = service.list();
  assert.equal(all.length, 2);
});

test("register rejects duplicate domain IDs instead of overwriting", () => {
  const service = new DomainRegistryService();
  service.register(makeMinimalDefinition({ domainId: "overwrite_me" }));

  assert.throws(() => service.register(makeMinimalDefinition({
    domainId: "overwrite_me",
    name: "Updated Name",
    description: "Updated description",
  })), /duplicate_domain/i);
});
