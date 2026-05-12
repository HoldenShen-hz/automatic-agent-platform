import test from "node:test";
import assert from "node:assert/strict";

import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import { PluginSpiRegistry } from "../../../../src/domains/registry/plugin-spi-registry.js";
import type { PluginSandboxPolicy } from "../../../../src/domains/registry/plugin-spi.js";

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

test("DomainRegistryService registers, validates, activates, and filters tools", () => {
  const events: string[] = [];
  const pluginRegistry = new PluginSpiRegistry();
  pluginRegistry.register({
    pluginId: "plugin.coding.presenter",
    domainId: "coding",
    spiType: "presenter",
    async formatOutput() { return { summary: "ok", sections: [], citations: [] }; },
  }, {
    pluginId: "plugin.coding.presenter",
    name: "coding presenter",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: ["present.output"],
    spiTypes: ["presenter"],
    publicSdkSurface: "tests/mock",
    settingsSchema: {},
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    sandbox: makeSandboxPolicy({
      timeoutMs: 1000,
      allowedKnowledgeNamespaces: [],
    }),
  });

  const service = new DomainRegistryService({
    pluginRegistry,
    eventPublisher: {
      publish(input) {
        events.push(input.eventType);
      },
    },
  });
  service.register({
    domainId: "coding",
    name: "Coding",
    description: "Coding workflows",
    version: 1,
    workflows: [
      {
        workflowId: "wf_build",
        name: "Build",
        triggerConditions: {},
        steps: [
          {
            stepName: "read",
            toolHints: ["read"],
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
        bundleId: "coding-default",
        tools: [
          { toolName: "repo_map", enabled: true, configOverrides: {} },
          { toolName: "apply_patch", enabled: true, configOverrides: {} },
        ],
      },
    ],
    outputContracts: [
      {
        contractId: "contract.patch",
        name: "Patch Contract",
        schema: { type: "object" },
        validationLevel: "strict",
      },
    ],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["bugfix"],
      requiredTools: ["repo_map"],
      optionalTools: ["apply_patch", "read"],
      modelPreferences: { primary: "gpt-5.2" },
      budgetLimits: { maxTokensPerTask: 6000, maxCostPerTask: 4 },
      securityLevel: "standard",
    },
    status: "validated",
    externalAdapters: ["github"],
    pluginBindings: [
      {
        bindingId: "binding.presenter",
        domainId: "coding",
        pluginType: "tool",
        bindingRole: "presenter",
        pluginId: "plugin.coding.presenter",
        priority: 1,
        enabled: true,
        config: {},
      },
    ],
  });
  service.registerKnowledgeNamespace("coding/repo", "coding");

  assert.equal(service.validate("coding").passed, true);
  assert.equal(service.activate("coding").status, "active");
  assert.deepEqual(service.filterAllowedTools("coding", ["read", "bash", "apply_patch"]), ["read", "apply_patch"]);
  assert.equal(service.getWorkflow("coding", "wf_build")?.name, "Build");
  assert.equal(service.getToolBundle("coding", "coding-default")?.tools.length, 2);
  assert.equal(service.getOutputContract("coding", "contract.patch")?.validationLevel, "strict");
  assert.equal(service.resolvePlugins("coding", "presenter" as any).length, 1);
  assert.deepEqual(service.buildCapabilityEntry("coding").pluginIds, ["plugin.coding.presenter"]);
  assert.deepEqual(service.buildCapabilityEntry("coding").knowledgeNamespaces, ["coding/repo"]);
  assert.ok(events.includes("domain:registered"));
  assert.ok(events.includes("domain:activated"));
});

test("DomainRegistryService list and listActive return registered domains", () => {
  const service = new DomainRegistryService();
  service.register({
    domainId: "domain_a",
    name: "Domain A",
    description: "Test domain A",
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
      securityLevel: "standard",
    },
    status: "validated",
    externalAdapters: [],
    pluginBindings: [],
  });
  service.register({
    domainId: "domain_b",
    name: "Domain B",
    description: "Test domain B",
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
      securityLevel: "standard",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [],
  });

  const all = service.list();
  assert.equal(all.length, 2);

  const active = service.listActive();
  assert.equal(active.length, 1);
  assert.equal(active[0]?.domainId, "domain_b");
});

test("DomainRegistryService get returns null for unknown domain", () => {
  const service = new DomainRegistryService();
  assert.equal(service.get("unknown_domain"), null);
  assert.equal(service.getWorkflow("unknown_domain", "wf"), null);
  assert.equal(service.getToolBundle("unknown_domain", "bundle"), null);
  assert.equal(service.getOutputContract("unknown_domain", "contract"), null);
  assert.deepEqual(service.getPluginBindings("unknown_domain"), []);
});

test("DomainRegistryService deprecate marks domain as deprecated", () => {
  const service = new DomainRegistryService();
  service.register({
    domainId: "deprecated_domain",
    name: "Deprecated",
    description: "Will be deprecated",
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
      securityLevel: "standard",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [],
  });

  const deprecated = service.deprecate("deprecated_domain");
  assert.equal(deprecated.status, "deprecated");

  const listed = service.listActive();
  assert.equal(listed.length, 0);
});

test("DomainRegistryService filterAllowedTools returns empty for unknown domain", () => {
  const service = new DomainRegistryService();
  const filtered = service.filterAllowedTools("unknown_domain", ["read", "write"]);
  assert.deepEqual(filtered, []);
});

test("DomainRegistryService archive marks deprecated domain as archived", () => {
  const events: string[] = [];
  const service = new DomainRegistryService({
    eventPublisher: {
      publish(input) {
        events.push(input.eventType);
      },
    },
  });
  service.register({
    domainId: "archived_domain",
    name: "Archived",
    description: "Will be archived",
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
      securityLevel: "standard",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [],
  });

  const deprecated = service.deprecate("archived_domain");
  assert.equal(deprecated.status, "deprecated");

  const archived = service.archive("archived_domain");
  assert.equal(archived.status, "archived");
  assert.ok(events.includes("domain:archived"));
});

test("DomainRegistryService archive throws when domain is not deprecated", () => {
  const service = new DomainRegistryService();
  service.register({
    domainId: "active_domain",
    name: "Active",
    description: "Not deprecated",
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
      securityLevel: "standard",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [],
  });

  assert.throws(
    () => service.archive("active_domain"),
    { message: /deprecated/ },
  );
});

test("DomainRegistryService getPluginBindings filters by pluginType", () => {
  const service = new DomainRegistryService({
    installedPluginIds: ["p1", "p2", "p3", "p4"],
    healthyPluginIds: ["p1", "p2", "p3", "p4"],
  });
  service.register({
    domainId: "multi_plugin",
    name: "Multi Plugin Domain",
    description: "Has multiple plugin types",
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
      securityLevel: "standard",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [
      { bindingId: "b1", domainId: "multi_plugin", pluginType: "tool", bindingRole: "presenter", pluginId: "p1", priority: 1, enabled: true, config: {} },
      { bindingId: "b2", domainId: "multi_plugin", pluginType: "tool", bindingRole: "presenter", pluginId: "p2", priority: 2, enabled: true, config: {} },
      { bindingId: "b3", domainId: "multi_plugin", pluginType: "retriever", pluginId: "p3", priority: 1, enabled: true, config: {} },
      { bindingId: "b4", domainId: "multi_plugin", pluginType: "retriever", pluginId: "p4", priority: 1, enabled: false, config: {} },
    ],
  });

  const all = service.getPluginBindings("multi_plugin");
  assert.equal(all.length, 3); // enabled presenter (2) + enabled retriever (1), disabled excluded

  const presenters = service.getPluginBindings("multi_plugin", "presenter" as any);
  assert.equal(presenters.length, 2);

  const retrievers = service.getPluginBindings("multi_plugin", "retriever");
  assert.equal(retrievers.length, 1);
});
