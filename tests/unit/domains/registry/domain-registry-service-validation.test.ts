/**
 * Unit Tests: DomainRegistryService Validation Paths
 *
 * Tests validation logic in DomainRegistryService.validateDefinition()
 * including duplicate detection, tool name validation, and plugin binding validation.
 */

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

function makeMinimalDomain(overrides: Record<string, unknown> = {}) {
  return {
    domainId: "test_domain",
    name: "Test Domain",
    description: "Test domain description",
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
      securityLevel: "standard" as const,
    },
    status: "testing" as const,
    externalAdapters: [],
    pluginBindings: [],
    ...overrides,
  };
}

test("DomainRegistryService throws on duplicate workflow IDs", () => {
  const service = new DomainRegistryService();
  assert.throws(
    () =>
      service.register(
        makeMinimalDomain({
          domainId: "dup_wf_domain",
          workflows: [
            { workflowId: "wf_1", name: "Workflow 1", triggerConditions: {}, steps: [] },
            { workflowId: "wf_1", name: "Workflow 2", triggerConditions: {}, steps: [] },
          ],
        }),
      ),
    /duplicate_workflow/,
  );
});

test("DomainRegistryService throws on duplicate step names within a workflow", () => {
  const service = new DomainRegistryService();
  assert.throws(
    () =>
      service.register(
        makeMinimalDomain({
          domainId: "dup_step_domain",
          workflows: [
            {
              workflowId: "wf_1",
              name: "Workflow 1",
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
                  dependsOn: [],
                },
                {
                  stepName: "step_a",
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
        }),
      ),
    /duplicate_step_name/,
  );
});

test("DomainRegistryService throws on tool name containing '..'", () => {
  const service = new DomainRegistryService();
  assert.throws(
    () =>
      service.register(
        makeMinimalDomain({
          domainId: "bad_tool_name",
          toolBundles: [
            {
              bundleId: "bundle_1",
              tools: [{ toolName: "../etc/passwd", enabled: true, configOverrides: {} }],
            },
          ],
        }),
      ),
    /invalid_tool_bundle/,
  );
});

test("DomainRegistryService throws on tool name containing '/'", () => {
  const service = new DomainRegistryService();
  assert.throws(
    () =>
      service.register(
        makeMinimalDomain({
          domainId: "bad_tool_name_2",
          toolBundles: [
            {
              bundleId: "bundle_1",
              tools: [{ toolName: "path/traversal", enabled: true, configOverrides: {} }],
            },
          ],
        }),
      ),
    /invalid_tool_bundle/,
  );
});

test("DomainRegistryService throws on plugin binding domain mismatch", () => {
  const service = new DomainRegistryService({
    installedPluginIds: ["plugin_1"],
    healthyPluginIds: ["plugin_1"],
  });
  assert.throws(
    () =>
      service.register(
        makeMinimalDomain({
          domainId: "domain_mismatch",
          pluginBindings: [
            {
              bindingId: "b1",
              domainId: "different_domain",
              pluginType: "presenter",
              pluginId: "plugin_1",
              priority: 1,
              enabled: true,
              config: {},
            },
          ],
        }),
      ),
    /plugin_domain_mismatch/,
  );
});

test("DomainRegistryService throws when plugin not in installedPluginIds", () => {
  const service = new DomainRegistryService({
    installedPluginIds: ["plugin_1"],
    healthyPluginIds: ["plugin_1"],
  });
  assert.throws(
    () =>
      service.register(
        makeMinimalDomain({
          domainId: "missing_plugin",
          pluginBindings: [
            {
              bindingId: "b1",
              domainId: "missing_plugin",
              pluginType: "presenter",
              pluginId: "plugin_not_installed",
              priority: 1,
              enabled: true,
              config: {},
            },
          ],
        }),
      ),
    /plugin_missing/,
  );
});

test("DomainRegistryService throws when plugin not in healthyPluginIds", () => {
  const service = new DomainRegistryService({
    installedPluginIds: ["plugin_1", "plugin_unhealthy"],
    healthyPluginIds: ["plugin_1"],
  });
  assert.throws(
    () =>
      service.register(
        makeMinimalDomain({
          domainId: "unhealthy_plugin",
          pluginBindings: [
            {
              bindingId: "b1",
              domainId: "unhealthy_plugin",
              pluginType: "presenter",
              pluginId: "plugin_unhealthy",
              priority: 1,
              enabled: true,
              config: {},
            },
          ],
        }),
      ),
    /plugin_unhealthy/,
  );
});

test("DomainRegistryService throws when plugin type does not match manifest", () => {
  const pluginRegistry = new PluginSpiRegistry();
  pluginRegistry.register(
    {
      pluginId: "presenter_plugin",
      domainId: "type_mismatch",
      spiType: "presenter",
      async formatOutput() {
        return { summary: "ok", sections: [], citations: [] };
      },
    },
    {
      pluginId: "presenter_plugin",
      name: "Presenter Plugin",
      version: "1.0.0",
      owner: "test",
      domainIds: ["type_mismatch"],
      capabilityIds: [],
      spiTypes: ["presenter"],
      extensionKind: "domain_plugin",
      trustLevel: "trusted",
      publicSdkSurface: "tests/mock",
      settingsSchema: {},
      sandbox: makeSandboxPolicy(),
    },
  );

  const service = new DomainRegistryService({
    pluginRegistry,
    installedPluginIds: [],
    healthyPluginIds: [],
  });
  assert.throws(
    () =>
      service.register(
        makeMinimalDomain({
          domainId: "type_mismatch",
          pluginBindings: [
            {
              bindingId: "b1",
              domainId: "type_mismatch",
              pluginType: "retriever",
              pluginId: "presenter_plugin",
              priority: 1,
              enabled: true,
              config: {},
            },
          ],
        }),
      ),
    /plugin_type_mismatch/,
  );
});

test("DomainRegistryService throws when plugin domain not allowed by manifest", () => {
  const pluginRegistry = new PluginSpiRegistry();
  pluginRegistry.register(
    {
      pluginId: "restricted_plugin",
      domainId: "allowed_domain",
      spiType: "presenter",
      async formatOutput() {
        return { summary: "ok", sections: [], citations: [] };
      },
    },
    {
      pluginId: "restricted_plugin",
      name: "Restricted Plugin",
      version: "1.0.0",
      owner: "test",
      domainIds: ["allowed_domain"],
      capabilityIds: [],
      spiTypes: ["presenter"],
      extensionKind: "domain_plugin",
      trustLevel: "trusted",
      publicSdkSurface: "tests/mock",
      settingsSchema: {},
      sandbox: makeSandboxPolicy(),
    },
  );

  const service = new DomainRegistryService({
    pluginRegistry,
    installedPluginIds: [],
    healthyPluginIds: [],
  });
  assert.throws(
    () =>
      service.register(
        makeMinimalDomain({
          domainId: "not_allowed_domain",
          pluginBindings: [
            {
              bindingId: "b1",
              domainId: "not_allowed_domain",
              pluginType: "presenter",
              pluginId: "restricted_plugin",
              priority: 1,
              enabled: true,
              config: {},
            },
          ],
        }),
      ),
    /plugin_domain_not_allowed/,
  );
});

test("DomainRegistryService allows plugin when manifest has no domain restrictions", () => {
  const pluginRegistry = new PluginSpiRegistry();
  pluginRegistry.register(
    {
      pluginId: "global_plugin",
      domainId: "any_domain",
      spiType: "presenter",
      async formatOutput() {
        return { summary: "ok", sections: [], citations: [] };
      },
    },
    {
      pluginId: "global_plugin",
      name: "Global Plugin",
      version: "1.0.0",
      owner: "test",
      domainIds: [],
      capabilityIds: [],
      spiTypes: ["presenter"],
      extensionKind: "domain_plugin",
      trustLevel: "trusted",
      publicSdkSurface: "tests/mock",
      settingsSchema: {},
      sandbox: makeSandboxPolicy(),
    },
  );

  const service = new DomainRegistryService({
    pluginRegistry,
    installedPluginIds: [],
    healthyPluginIds: [],
  });
  service.register(
    makeMinimalDomain({
      domainId: "any_domain",
      pluginBindings: [
        {
          bindingId: "b1",
          domainId: "any_domain",
          pluginType: "presenter",
          pluginId: "global_plugin",
          priority: 1,
          enabled: true,
          config: {},
        },
      ],
    }),
  );
  assert.equal(service.get("any_domain")?.pluginBindings.length, 1);
});

test("DomainRegistryService buildCapabilityEntry throws for unknown domain", () => {
  const service = new DomainRegistryService();
  assert.throws(
    () => service.buildCapabilityEntry("nonexistent"),
    /domain_not_found/,
  );
});

test("DomainRegistryService activate throws for unknown domain", () => {
  const service = new DomainRegistryService();
  assert.throws(
    () => service.activate("nonexistent"),
    /domain_not_found/,
  );
});

test("DomainRegistryService deprecate throws for unknown domain", () => {
  const service = new DomainRegistryService();
  assert.throws(
    () => service.deprecate("nonexistent"),
    /domain_not_found/,
  );
});

test("DomainRegistryService validate throws for unknown domain", () => {
  const service = new DomainRegistryService();
  assert.throws(
    () => service.validate("nonexistent"),
    /domain_not_found/,
  );
});
