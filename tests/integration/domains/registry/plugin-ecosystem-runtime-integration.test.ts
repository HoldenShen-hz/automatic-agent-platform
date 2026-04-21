import assert from "node:assert/strict";
import test from "node:test";

import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import { PluginEcosystemRuntimeService } from "../../../../src/domains/registry/plugin-ecosystem-runtime-service.js";
import { PluginSpiRegistry } from "../../../../src/domains/registry/plugin-spi-registry.js";
import { ConnectorFrameworkService } from "../../../../src/scale-ecosystem/integration/connector-framework-service.js";

test("integration: plugin ecosystem runtime aligns domain activation with connector binding readiness", async () => {
  const pluginRegistry = new PluginSpiRegistry();
  pluginRegistry.register({
    pluginId: "plugin.sales.retriever",
    domainId: "sales",
    spiType: "retriever",
    capabilityIds: ["retrieve"],
    async retrieve() {
      return [];
    },
  }, {
    pluginId: "plugin.sales.retriever",
    name: "sales retriever",
    version: "1.0.0",
    owner: "sales",
    domainIds: ["sales"],
    capabilityIds: ["retrieve"],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "tests/mock",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 1000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: ["sales/repo"],
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
    },
  });

  const domains = new DomainRegistryService({ pluginRegistry });
  domains.register({
    domainId: "sales",
    name: "Sales",
    description: "Sales workflows",
    version: 1,
    status: "draft",
    capabilities: {
      supportedTaskTypes: ["quote"],
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
        bindingId: "binding_sales_retriever",
        domainId: "sales",
        pluginId: "plugin.sales.retriever",
        pluginType: "retriever",
        config: {},
        priority: 100,
        enabled: true,
      },
    ],
    workflows: [
      {
        workflowId: "wf_sales_runtime",
        name: "Sales Runtime",
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
        bundleId: "sales-default",
        tools: [
          { toolName: "retrieve", enabled: true, configOverrides: {} },
        ],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    externalAdapters: [],
  });
  domains.activate("sales");

  const connectors = new ConnectorFrameworkService();
  connectors.register({
    connectorId: "crm_salesforce",
    provider: "salesforce",
    capabilities: ["sync"],
    authMode: "oauth2",
    rateLimits: { perMinute: 120 },
    supportedEvents: ["crm.contact.updated"],
    lifecycleState: "verified",
  });

  const service = new PluginEcosystemRuntimeService(domains, pluginRegistry, connectors);
  const activation = await service.activateRuntime({
    domainId: "sales",
    tenantId: "tenant-sales",
    environment: "prod",
    connectorIds: ["crm_salesforce"],
    autoBindConnectors: true,
  });

  assert.equal(activation.plan.ready, true);
  assert.deepEqual(activation.activatedPluginIds, ["plugin.sales.retriever"]);
  assert.equal(activation.connectorBindings[0]?.connectorId, "crm_salesforce");
});
