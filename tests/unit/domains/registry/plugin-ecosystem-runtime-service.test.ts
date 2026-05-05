import assert from "node:assert/strict";
import test from "node:test";

import { PluginEcosystemRuntimeService } from "../../../../src/domains/registry/plugin-ecosystem-runtime-service.js";
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

// ─────────────────────────────────────────────────────────────────────────────
// PluginEcosystemRuntimeService.buildPlan
// ─────────────────────────────────────────────────────────────────────────────

test("PluginEcosystemRuntimeService.buildPlan creates plan for active domain", () => {
  const domainService = new DomainRegistryService();
  const pluginRegistry = new PluginSpiRegistry();
  const connectors = {
    getManifest: () => null,
    listBindings: () => [],
  };

  domainService.register({
    domainId: "coding",
    name: "Coding Domain",
    description: "Coding workflows",
    version: 1,
    workflows: [],
    toolBundles: [],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["code_generation"],
      requiredTools: [],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [],
  });

  const service = new PluginEcosystemRuntimeService(domainService, pluginRegistry, connectors as never);
  const plan = service.buildPlan({
    domainId: "coding",
    tenantId: "tenant_1",
    environment: "dev",
  });

  assert.equal(plan.domainId, "coding");
  assert.equal(plan.tenantId, "tenant_1");
  assert.equal(plan.environment, "dev");
  assert.equal(plan.ready, true); // Domain is active with no issues
  assert.deepEqual(plan.findings, []);
});

test("PluginEcosystemRuntimeService.buildPlan throws for unknown domain", () => {
  const domainService = new DomainRegistryService();
  const pluginRegistry = new PluginSpiRegistry();
  const connectors = {
    getManifest: () => null,
    listBindings: () => [],
  };

  const service = new PluginEcosystemRuntimeService(domainService, pluginRegistry, connectors as never);

  assert.throws(
    () => service.buildPlan({
      domainId: "unknown_domain",
      tenantId: "tenant_1",
      environment: "dev",
    }),
    /Domain is not registered\./,
  );
});

test("PluginEcosystemRuntimeService.buildPlan marks plan not ready when domain not active", () => {
  const domainService = new DomainRegistryService();
  const pluginRegistry = new PluginSpiRegistry();
  const connectors = {
    getManifest: () => null,
    listBindings: () => [],
  };

  domainService.register({
    domainId: "draft_domain",
    name: "Draft Domain",
    description: "Not yet active",
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
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "draft", // Not active
    externalAdapters: [],
    pluginBindings: [],
  });

  const service = new PluginEcosystemRuntimeService(domainService, pluginRegistry, connectors as never);
  const plan = service.buildPlan({
    domainId: "draft_domain",
    tenantId: "tenant_1",
    environment: "dev",
  });

  assert.equal(plan.ready, false);
  assert.deepEqual(plan.findings, []);
});

test("PluginEcosystemRuntimeService.buildPlan includes plugin targets", () => {
  const pluginRegistry = new PluginSpiRegistry();
  const domainService = new DomainRegistryService({ pluginRegistry });
  const connectors = {
    getManifest: () => null,
    listBindings: () => [],
  };

  pluginRegistry.register({
    pluginId: "plugin.retriever",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      return [];
    },
  }, {
    pluginId: "plugin.retriever",
    name: "retriever plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  domainService.register({
    domainId: "coding",
    name: "Coding",
    description: "Coding domain",
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
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [
      {
        bindingId: "binding_retriever",
        domainId: "coding",
        pluginType: "retriever",
        pluginId: "plugin.retriever",
        priority: 1,
        enabled: true,
        config: {},
      },
    ],
  });

  const service = new PluginEcosystemRuntimeService(domainService, pluginRegistry, connectors as never);
  const plan = service.buildPlan({
    domainId: "coding",
    tenantId: "tenant_1",
    environment: "dev",
  });

  assert.equal(plan.pluginTargets.length, 1);
  assert.equal(plan.pluginTargets[0]?.pluginId, "plugin.retriever");
  assert.equal(plan.pluginTargets[0]?.healthy, false);
});

test("PluginEcosystemRuntimeService.buildPlan marks plan not ready when plugin is only registered", () => {
  const pluginRegistry = new PluginSpiRegistry();
  const domainService = new DomainRegistryService({ pluginRegistry });
  const connectors = {
    getManifest: () => null,
    listBindings: () => [],
  };

  pluginRegistry.register({
    pluginId: "plugin.registered_only",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      return [];
    },
  }, {
    pluginId: "plugin.registered_only",
    name: "registered only plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  domainService.register({
    domainId: "coding",
    name: "Coding",
    description: "Coding domain",
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
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [
      {
        bindingId: "binding_registered_only",
        domainId: "coding",
        pluginType: "retriever",
        pluginId: "plugin.registered_only",
        priority: 1,
        enabled: true,
        config: {},
      },
    ],
  });

  const service = new PluginEcosystemRuntimeService(domainService, pluginRegistry, connectors as never);
  const plan = service.buildPlan({
    domainId: "coding",
    tenantId: "tenant_1",
    environment: "dev",
  });

  assert.equal(plan.ready, false);
  assert.ok(plan.findings.includes("plugin not ready: plugin.registered_only"));
});

test("PluginEcosystemRuntimeService.buildPlan includes connector targets", () => {
  const domainService = new DomainRegistryService();
  const pluginRegistry = new PluginSpiRegistry();
  const connectors = {
    getManifest: () => ({ lifecycleState: "verified" }),
    listBindings: () => [{ connectorId: "conn_1", tenantId: "tenant_1", environment: "dev" as const, bound: true }],
  };

  domainService.register({
    domainId: "coding",
    name: "Coding",
    description: "Coding domain",
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
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [],
  });

  const service = new PluginEcosystemRuntimeService(domainService, pluginRegistry, connectors as never);
  const plan = service.buildPlan({
    domainId: "coding",
    tenantId: "tenant_1",
    environment: "dev",
    connectorIds: ["conn_1"],
  });

  assert.equal(plan.connectorTargets.length, 1);
  assert.equal(plan.connectorTargets[0]?.connectorId, "conn_1");
  assert.equal(plan.connectorTargets[0]?.bound, true);
});

test("PluginEcosystemRuntimeService.buildPlan adds finding for unbound connector", () => {
  const domainService = new DomainRegistryService();
  const pluginRegistry = new PluginSpiRegistry();
  const connectors = {
    getManifest: () => ({ lifecycleState: "verified" }),
    listBindings: () => [], // Not bound
  };

  domainService.register({
    domainId: "coding",
    name: "Coding",
    description: "Coding domain",
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
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [],
  });

  const service = new PluginEcosystemRuntimeService(domainService, pluginRegistry, connectors as never);
  const plan = service.buildPlan({
    domainId: "coding",
    tenantId: "tenant_1",
    environment: "dev",
    connectorIds: ["conn_unbound"],
  });

  assert.ok(plan.findings.some((f) => f.includes("connector not bound")));
});

test("PluginEcosystemRuntimeService.buildPlan adds finding for non-prod-ready connector in prod", () => {
  const domainService = new DomainRegistryService();
  const pluginRegistry = new PluginSpiRegistry();
  const connectors = {
    getManifest: () => ({ lifecycleState: "testing" }), // Not verified or enabled
    listBindings: () => [{ connectorId: "conn_1", tenantId: "tenant_1", environment: "prod" as const, bound: true }],
  };

  domainService.register({
    domainId: "coding",
    name: "Coding",
    description: "Coding domain",
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
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [],
  });

  const service = new PluginEcosystemRuntimeService(domainService, pluginRegistry, connectors as never);
  const plan = service.buildPlan({
    domainId: "coding",
    tenantId: "tenant_1",
    environment: "prod",
    connectorIds: ["conn_1"],
  });

  assert.ok(plan.findings.some((f) => f.includes("connector not prod-ready")));
});

test("PluginEcosystemRuntimeService.buildPlan does not check prod readiness in dev environment", () => {
  const domainService = new DomainRegistryService();
  const pluginRegistry = new PluginSpiRegistry();
  const connectors = {
    getManifest: () => ({ lifecycleState: "testing" }),
    listBindings: () => [{ connectorId: "conn_1", tenantId: "tenant_1", environment: "dev" as const, bound: true }],
  };

  domainService.register({
    domainId: "coding",
    name: "Coding",
    description: "Coding domain",
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
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [],
  });

  const service = new PluginEcosystemRuntimeService(domainService, pluginRegistry, connectors as never);
  const plan = service.buildPlan({
    domainId: "coding",
    tenantId: "tenant_1",
    environment: "dev",
    connectorIds: ["conn_1"],
  });

  assert.ok(!plan.findings.some((f) => f.includes("prod-ready")));
});

// ─────────────────────────────────────────────────────────────────────────────
// PluginEcosystemRuntimeService.activateRuntime
// ─────────────────────────────────────────────────────────────────────────────

test("PluginEcosystemRuntimeService.activateRuntime activates plugins", async () => {
  const pluginRegistry = new PluginSpiRegistry();
  const domainService = new DomainRegistryService({ pluginRegistry });
  const connectors = {
    getManifest: () => null,
    listBindings: () => [],
  };

  pluginRegistry.register({
    pluginId: "plugin.activate_test",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      return [];
    },
  }, {
    pluginId: "plugin.activate_test",
    name: "activate test plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  domainService.register({
    domainId: "coding",
    name: "Coding",
    description: "Coding domain",
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
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [
      {
        bindingId: "binding_activate",
        domainId: "coding",
        pluginType: "retriever",
        pluginId: "plugin.activate_test",
        priority: 1,
        enabled: true,
        config: {},
      },
    ],
  });

  const service = new PluginEcosystemRuntimeService(domainService, pluginRegistry, connectors as never);
  const activation = await service.activateRuntime({
    domainId: "coding",
    tenantId: "tenant_1",
    environment: "dev",
  });

  assert.equal(activation.activatedPluginIds.length, 1);
  assert.equal(activation.activatedPluginIds[0], "plugin.activate_test");
});

test("PluginEcosystemRuntimeService.activateRuntime auto-binds connectors when requested", async () => {
  const domainService = new DomainRegistryService();
  const pluginRegistry = new PluginSpiRegistry();
  const connectors = {
    getManifest: () => ({ lifecycleState: "verified" }),
    listBindings: () => [],
    bind: (connectorId: string, tenantId: string, environment: string) => ({
      connectorId,
      tenantId,
      environment: environment as "dev" | "staging" | "prod",
      bound: true,
    }),
  };

  domainService.register({
    domainId: "coding",
    name: "Coding",
    description: "Coding domain",
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
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [],
  });

  const service = new PluginEcosystemRuntimeService(domainService, pluginRegistry, connectors as never);
  const activation = await service.activateRuntime({
    domainId: "coding",
    tenantId: "tenant_1",
    environment: "dev",
    connectorIds: ["conn_new"],
    autoBindConnectors: true,
  });

  assert.equal(activation.connectorBindings.length, 1);
  assert.equal(activation.connectorBindings[0]?.connectorId, "conn_new");
});

test("PluginEcosystemRuntimeService.activateRuntime reuses existing bindings when autoBindConnectors is true", async () => {
  const domainService = new DomainRegistryService();
  const pluginRegistry = new PluginSpiRegistry();
  const existingBinding = {
    connectorId: "conn_existing",
    tenantId: "tenant_1",
    environment: "dev" as const,
    bound: true,
  };
  const connectors = {
    getManifest: () => ({ lifecycleState: "verified" }),
    listBindings: () => [existingBinding],
    bind: () => {
      assert.fail("Should not bind when existing binding found");
      return existingBinding;
    },
  };

  domainService.register({
    domainId: "coding",
    name: "Coding",
    description: "Coding domain",
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
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [],
  });

  const service = new PluginEcosystemRuntimeService(domainService, pluginRegistry, connectors as never);
  const activation = await service.activateRuntime({
    domainId: "coding",
    tenantId: "tenant_1",
    environment: "dev",
    connectorIds: ["conn_existing"],
    autoBindConnectors: true,
  });

  assert.equal(activation.connectorBindings.length, 1);
  assert.equal(activation.connectorBindings[0], existingBinding);
});

test("PluginEcosystemRuntimeService.activateRuntime builds the plan exactly once", async () => {
  class CountingPluginEcosystemRuntimeService extends PluginEcosystemRuntimeService {
    public buildPlanCalls = 0;

    public override buildPlan(input: Parameters<PluginEcosystemRuntimeService["buildPlan"]>[0]) {
      this.buildPlanCalls += 1;
      return super.buildPlan(input);
    }
  }

  const domainService = new DomainRegistryService();
  const pluginRegistry = new PluginSpiRegistry();
  const connectors = {
    getManifest: () => null,
    listBindings: () => [],
  };

  domainService.register({
    domainId: "coding",
    name: "Coding",
    description: "Coding domain",
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
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [],
  });

  const service = new CountingPluginEcosystemRuntimeService(domainService, pluginRegistry, connectors as never);
  const activation = await service.activateRuntime({
    domainId: "coding",
    tenantId: "tenant_1",
    environment: "dev",
  });

  assert.equal(service.buildPlanCalls, 1);
  assert.equal(activation.plan.domainId, "coding");
});

test("PluginEcosystemRuntimeService.activateRuntime does not auto-bind when autoBindConnectors is false", async () => {
  const domainService = new DomainRegistryService();
  const pluginRegistry = new PluginSpiRegistry();
  const connectors = {
    getManifest: () => ({ lifecycleState: "verified" }),
    listBindings: () => [],
    bind: () => {
      assert.fail("Should not bind when autoBindConnectors is false");
      return { connectorId: "conn_1", tenantId: "tenant_1", environment: "dev" as const, bound: true };
    },
  };

  domainService.register({
    domainId: "coding",
    name: "Coding",
    description: "Coding domain",
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
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [],
  });

  const service = new PluginEcosystemRuntimeService(domainService, pluginRegistry, connectors as never);
  const activation = await service.activateRuntime({
    domainId: "coding",
    tenantId: "tenant_1",
    environment: "dev",
    connectorIds: ["conn_1"],
    autoBindConnectors: false, // Default
  });

  assert.equal(activation.connectorBindings.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

test("toPluginTarget handles null record", () => {
  const domainService = new DomainRegistryService({
    installedPluginIds: ["plugin.missing"],
    healthyPluginIds: ["plugin.missing"],
  });
  const pluginRegistry = new PluginSpiRegistry();
  const connectors = {
    getManifest: () => null,
    listBindings: () => [],
  };

  domainService.register({
    domainId: "coding",
    name: "Coding",
    description: "Coding domain",
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
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [
      {
        bindingId: "binding_missing",
        domainId: "coding",
        pluginType: "retriever",
        pluginId: "plugin.missing",
        priority: 1,
        enabled: true,
        config: {},
      },
    ],
  });

  const service = new PluginEcosystemRuntimeService(domainService, pluginRegistry, connectors as never);
  const plan = service.buildPlan({
    domainId: "coding",
    tenantId: "tenant_1",
    environment: "dev",
  });

  const target = plan.pluginTargets[0];
  assert.ok(target);
  assert.equal(target.lifecycleState, "missing");
  assert.equal(target.healthy, false);
});

test("toPluginTarget handles disabled plugin", () => {
  const pluginRegistry = new PluginSpiRegistry();
  const domainService = new DomainRegistryService({ pluginRegistry });
  const connectors = {
    getManifest: () => null,
    listBindings: () => [],
  };

  pluginRegistry.register({
    pluginId: "plugin.disabled",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      return [];
    },
  }, {
    pluginId: "plugin.disabled",
    name: "disabled plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  // Manually set to disabled
  const record = pluginRegistry.get("plugin.disabled")!;
  record.lifecycleState = "disabled";

  domainService.register({
    domainId: "coding",
    name: "Coding",
    description: "Coding domain",
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
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [
      {
        bindingId: "binding_disabled",
        domainId: "coding",
        pluginType: "retriever",
        pluginId: "plugin.disabled",
        priority: 1,
        enabled: true,
        config: {},
      },
    ],
  });

  const service = new PluginEcosystemRuntimeService(domainService, pluginRegistry, connectors as never);
  const plan = service.buildPlan({
    domainId: "coding",
    tenantId: "tenant_1",
    environment: "dev",
  });

  const target = plan.pluginTargets[0];
  assert.ok(target);
  assert.equal(target.healthy, false);
});

test("toPluginTarget handles degraded plugin", () => {
  const pluginRegistry = new PluginSpiRegistry();
  const domainService = new DomainRegistryService({ pluginRegistry });
  const connectors = {
    getManifest: () => null,
    listBindings: () => [],
  };

  pluginRegistry.register({
    pluginId: "plugin.degraded",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      return [];
    },
  }, {
    pluginId: "plugin.degraded",
    name: "degraded plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  const record = pluginRegistry.get("plugin.degraded")!;
  record.lifecycleState = "degraded";

  domainService.register({
    domainId: "coding",
    name: "Coding",
    description: "Coding domain",
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
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status: "active",
    externalAdapters: [],
    pluginBindings: [
      {
        bindingId: "binding_degraded",
        domainId: "coding",
        pluginType: "retriever",
        pluginId: "plugin.degraded",
        priority: 1,
        enabled: true,
        config: {},
      },
    ],
  });

  const service = new PluginEcosystemRuntimeService(domainService, pluginRegistry, connectors as never);
  const plan = service.buildPlan({
    domainId: "coding",
    tenantId: "tenant_1",
    environment: "dev",
  });

  const target = plan.pluginTargets[0];
  assert.ok(target);
  assert.equal(target.healthy, false);
});
