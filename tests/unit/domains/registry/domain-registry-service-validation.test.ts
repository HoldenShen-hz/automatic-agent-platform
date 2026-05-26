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
import type { NormalizedBusinessPackManifest } from "../../../../src/domains/business-pack/business-pack-manifest.js";

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
    status: "validated" as const,
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

test("DomainRegistryService buildCapabilityEntry includes strongest associated pack sandbox tier", () => {
  const pack: NormalizedBusinessPackManifest = {
    packId: "pack-001",
    name: "Pack",
    version: "1.0.0",
    domainId: "sandbox_domain",
    description: "",
    lifecycleStage: "published",
    deprecatedAt: null,
    archivedAt: null,
    riskMatrix: [{ riskId: "risk-1", level: "high", triggers: [], mitigation: "", escalationPolicy: "" }],
    toolBundles: [],
    pluginIds: [],
    dependencies: [],
    approvalPoints: [],
    artifactTypes: [],
    knowledgeNamespaces: [],
    failureStrategy: "fail_fast",
    rollbackCapability: true,
    domainMetrics: [],
    sandboxTier: "workspace_write",
    permissions: [],
    author: "",
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const service = new DomainRegistryService({
    packResolver: (domainId) => domainId === "sandbox_domain" ? [pack] : [],
    domainRiskResolver: () => "high",
  });
  service.register(
    makeMinimalDomain({
      domainId: "sandbox_domain",
      capabilities: {
        supportedTaskTypes: [],
        requiredTools: [],
        optionalTools: [],
        modelPreferences: {},
        budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
        securityLevel: "elevated" as const,
      },
    }),
  );

  assert.deepEqual(service.buildCapabilityEntry("sandbox_domain"), {
    domainId: "sandbox_domain",
    bundleId: "sandbox_domain.default",
    capabilityIds: [],
    toolNames: [],
    skillIds: [],
    pluginIds: [],
    knowledgeNamespaces: [],
    defaultActivationPolicy: "registered",
    trustTier: "elevated",
    sandboxTier: "workspace_write",
    highestPackRiskLevel: "high",
  });
});

test("DomainRegistryService archive rejects domains that still have active packs", () => {
  const pack: NormalizedBusinessPackManifest = {
    packId: "pack-001",
    name: "Pack",
    version: "1.0.0",
    domainId: "packed_domain",
    description: "",
    lifecycleStage: "published",
    deprecatedAt: null,
    archivedAt: null,
    riskMatrix: [{ riskId: "risk-1", level: "high", triggers: [], mitigation: "", escalationPolicy: "" }],
    toolBundles: [],
    pluginIds: [],
    dependencies: [],
    approvalPoints: [],
    artifactTypes: [],
    knowledgeNamespaces: [],
    failureStrategy: "fail_fast",
    rollbackCapability: true,
    domainMetrics: [],
    sandboxTier: "workspace_write",
    permissions: [],
    author: "",
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const service = new DomainRegistryService({
    packResolver: (domainId) => domainId === "packed_domain" ? [pack] : [],
    domainRiskResolver: () => "high",
  });
  service.register(
    makeMinimalDomain({
      domainId: "packed_domain",
      status: "deprecated" as const,
      capabilities: {
        supportedTaskTypes: [],
        requiredTools: [],
        optionalTools: [],
        modelPreferences: {},
        budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
        securityLevel: "elevated" as const,
      },
    }),
  );

  assert.throws(
    () => service.archive("packed_domain"),
    /archived_domain_has_packs/,
  );
});
