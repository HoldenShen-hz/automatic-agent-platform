import assert from "node:assert/strict";
import test from "node:test";

import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import { PluginEcosystemRuntimeService } from "../../../../src/domains/registry/plugin-ecosystem-runtime-service.js";
import { PluginSpiRegistry } from "../../../../src/domains/registry/plugin-spi-registry.js";
import { ConnectorFrameworkService } from "../../../../src/scale-ecosystem/integration/connector-framework-service.js";
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

function createHarness() {
  const pluginRegistry = new PluginSpiRegistry();
  pluginRegistry.register({
    pluginId: "plugin.ops.retriever",
    domainId: "ops",
    spiType: "retriever",
    capabilityIds: ["retrieve"],
    async retrieve() {
      return [];
    },
  }, {
    pluginId: "plugin.ops.retriever",
    name: "ops retriever",
    version: "1.0.0",
    owner: "ops",
    domainIds: ["ops"],
    capabilityIds: ["retrieve"],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "tests/mock",
    settingsSchema: {},
    sandbox: makeSandboxPolicy({
      timeoutMs: 1000,
      allowedKnowledgeNamespaces: ["ops/repo"],
    }),
  });

  const domainRegistry = new DomainRegistryService({ pluginRegistry });
  domainRegistry.register({
    domainId: "ops",
    name: "Ops",
    description: "Operations",
    version: 1,
    status: "draft",
    capabilities: {
      supportedTaskTypes: ["operate"],
      requiredTools: [],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: {
        maxTokensPerTask: 4000,
        maxCostPerTask: 5,
      },
      securityLevel: "elevated",
    },
    pluginBindings: [
      {
        bindingId: "binding_ops_retriever",
        domainId: "ops",
        pluginId: "plugin.ops.retriever",
        pluginType: "retriever",
        config: {},
        priority: 100,
        enabled: true,
      },
    ],
    workflows: [
      {
        workflowId: "wf_ops_runtime",
        name: "Ops Runtime",
        triggerConditions: {},
        steps: [
          {
            stepName: "collect",
            toolHints: ["retrieve"],
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
        bundleId: "ops-default",
        tools: [
          { toolName: "retrieve", enabled: true, configOverrides: {} },
        ],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    externalAdapters: [],
  });
  domainRegistry.activate("ops");

  const connectors = new ConnectorFrameworkService();
  connectors.register({
    connectorId: "crm_sync",
    provider: "crm",
    capabilities: ["sync"],
    authMode: "oauth2",
    rateLimits: { perMinute: 60 },
    supportedEvents: ["crm.contact.updated"],
    lifecycleState: "verified",
  });

  return {
    pluginRegistry,
    domainRegistry,
    connectors,
    service: new PluginEcosystemRuntimeService(domainRegistry, pluginRegistry, connectors),
  };
}

test("PluginEcosystemRuntimeService builds readiness plans across domain plugins and connectors", () => {
  const harness = createHarness();
  const plan = harness.service.buildPlan({
    domainId: "ops",
    tenantId: "tenant-1",
    environment: "prod",
    connectorIds: ["crm_sync"],
  });

  assert.equal(plan.pluginTargets.length, 1);
  assert.equal(plan.ready, false);
  assert.ok(plan.findings.includes("connector not bound: crm_sync"));
});

test("PluginEcosystemRuntimeService activates plugins and auto-binds connectors", async () => {
  const harness = createHarness();
  const activation = await harness.service.activateRuntime({
    domainId: "ops",
    tenantId: "tenant-1",
    environment: "prod",
    connectorIds: ["crm_sync"],
    autoBindConnectors: true,
  });

  assert.deepEqual(activation.activatedPluginIds, ["plugin.ops.retriever"]);
  assert.equal(activation.connectorBindings.length, 1);
  assert.equal(activation.plan.ready, true);
});
