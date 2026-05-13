/**
 * Unit Tests: Plugin Registration
 *
 * Tests for plugin registration patterns including manifest validation,
 * capability enumeration, trust levels, and sandbox policies.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PluginSpiRegistry } from "../../../src/domains/registry/plugin-spi-registry.js";
import { createGithubAdapterPlugin } from "../../../src/plugins/adapters/github-adapter.js";
import { createCrmAdapterPlugin } from "../../../src/plugins/adapters/crm-adapter.js";
import { createGameDevAdapterPlugin } from "../../../src/plugins/adapters/game-dev-adapter.js";
import { createAssetProductionAdapterPlugin } from "../../../src/plugins/adapters/asset-production-adapter.js";
import { createLivestreamAdapterPlugin } from "../../../src/plugins/adapters/livestream-adapter.js";
import { createCodingPresenterPlugin } from "../../../src/plugins/presenters/coding-presenter.js";
import { createGrowthPresenterPlugin } from "../../../src/plugins/presenters/growth-presenter.js";
import { createOperationsPresenterPlugin } from "../../../src/plugins/presenters/operations-presenter.js";
import { createBasicEvaluatorPlugin } from "../../../src/plugins/validators/basic-evaluator.js";
import { PluginManifestSchema } from "../../../src/domains/registry/plugin-spi.js";
import type { PluginManifest } from "../../../src/domains/registry/plugin-spi.js";

test("PluginManifestSchema validates correct manifest", () => {
  const manifest = {
    pluginId: "test.plugin",
    name: "Test Plugin",
    version: "1.0.0",
    owner: "test-team",
    domainIds: ["test"],
    capabilityIds: ["test.capability"],
    spiTypes: ["adapter"],
    extensionKind: "external_adapter",
    trustLevel: "trusted",
    publicSdkSurface: "@test/plugin",
    settingsSchema: {},
  };

  const result = PluginManifestSchema.safeParse(manifest);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.pluginId, "test.plugin");
  }
});

test("PluginManifestSchema rejects missing required fields", () => {
  const invalidManifest = {
    name: "Test Plugin",
    // missing pluginId, version, owner, etc.
  };

  const result = PluginManifestSchema.safeParse(invalidManifest);

  assert.equal(result.success, false);
});

test("PluginManifestSchema validates spiTypes enum", () => {
  const validManifest = {
    pluginId: "test.plugin",
    name: "Test Plugin",
    version: "1.0.0",
    owner: "test-team",
    domainIds: [],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "internal",
    publicSdkSurface: "@test/plugin",
    settingsSchema: {},
  };

  const result = PluginManifestSchema.safeParse(validManifest);

  assert.equal(result.success, true);
});

test("PluginManifestSchema validates trustLevel enum", () => {
  const manifest = {
    pluginId: "test.plugin",
    name: "Test Plugin",
    version: "1.0.0",
    owner: "test-team",
    domainIds: [],
    capabilityIds: [],
    spiTypes: ["adapter"],
    extensionKind: "external_adapter",
    trustLevel: "verified",
    publicSdkSurface: "@test/plugin",
    settingsSchema: {},
  };

  const result = PluginManifestSchema.safeParse(manifest);

  assert.equal(result.success, true);
});

test("PluginSpiRegistry.register generates default manifest for plugin without manifest", () => {
  const registry = new PluginSpiRegistry();
  const adapter = createGithubAdapterPlugin();

  const record = registry.register(adapter);

  assert.ok(record.manifest.pluginId, adapter.pluginId);
  assert.ok(record.manifest.name);
  assert.ok(record.manifest.version);
  assert.ok(record.manifest.owner);
});

test("PluginSpiRegistry.register merges provided manifest with defaults", () => {
  const registry = new PluginSpiRegistry();
  const adapter = createGithubAdapterPlugin();

  const customManifest: PluginManifest = {
    pluginId: adapter.pluginId,
    name: "Custom Name",
    version: "2.0.0",
    owner: "custom-owner",
    domainIds: ["custom-domain"],
    capabilityIds: ["custom.capability"],
    spiTypes: ["adapter"],
    extensionKind: "external_adapter",
    trustLevel: "verified",
    publicSdkSurface: "@custom/plugin",
    settingsSchema: { customField: { type: "string" } },
  };

  const record = registry.register(adapter, customManifest);

  assert.equal(record.manifest.name, "Custom Name");
  assert.equal(record.manifest.version, "2.0.0");
  assert.equal(record.manifest.owner, "custom-owner");
  assert.ok(record.manifest.domainIds.includes("custom-domain"));
});

test("PluginSpiRegistry.register preserves plugin capabilityIds", () => {
  const registry = new PluginSpiRegistry();
  const adapter = createGithubAdapterPlugin();
  const originalCapabilityIds = [...(adapter.capabilityIds ?? [])];

  registry.register(adapter);

  const record = registry.get(adapter.pluginId);
  assert.ok(record !== null);

  // CapabilityIds should be a superset of original
  for (const cap of originalCapabilityIds) {
    assert.ok(record!.manifest.capabilityIds.includes(cap));
  }
});

test("PluginSpiRegistry.register accepts domain_plugin extensionKind", () => {
  const registry = new PluginSpiRegistry();
  const presenter = createCodingPresenterPlugin();

  const record = registry.register(presenter);

  assert.equal(record.manifest.extensionKind, "domain_plugin");
});

test("PluginSpiRegistry.register accepts external_adapter extensionKind", () => {
  const registry = new PluginSpiRegistry();
  const adapter = createGithubAdapterPlugin();

  const record = registry.register(adapter);

  assert.equal(record.manifest.extensionKind, "external_adapter");
});

test("PluginSpiRegistry.register sets initial lifecycleState to registered", () => {
  const registry = new PluginSpiRegistry();
  const adapter = createGithubAdapterPlugin();

  const record = registry.register(adapter);

  assert.equal(record.lifecycleState, "registered");
});

test("PluginSpiRegistry.register initializes failure tracking fields", () => {
  const registry = new PluginSpiRegistry();
  const adapter = createGithubAdapterPlugin();

  const record = registry.register(adapter);

  assert.equal(record.failureCount, 0);
  assert.equal(record.lastErrorMessage, null);
  assert.equal(record.lastErrorAt, null);
  assert.equal(record.disabledReason, null);
  assert.equal(record.cooldownUntil, null);
});

test("PluginSpiRegistry.register initializes invocation tracking fields", () => {
  const registry = new PluginSpiRegistry();
  const adapter = createGithubAdapterPlugin();

  const record = registry.register(adapter);

  assert.equal(record.activeInvocationCount, 0);
  assert.equal(record.queuedInvocationCount, 0);
  assert.equal(record.lastInvocationStartedAt, null);
  assert.equal(record.lastInvocationCompletedAt, null);
  assert.equal(record.runtimeProcessId, null);
  assert.equal(record.runtimeSandboxRoot, null);
});

test("PluginSpiRegistry.register can register multiple adapters", () => {
  const registry = new PluginSpiRegistry();

  registry.register(createGithubAdapterPlugin());
  registry.register(createCrmAdapterPlugin());
  registry.register(createGameDevAdapterPlugin());
  registry.register(createAssetProductionAdapterPlugin());
  registry.register(createLivestreamAdapterPlugin());

  const allPlugins = registry.list();
  assert.equal(allPlugins.length, 5);
});

test("PluginSpiRegistry.register can register multiple presenters", () => {
  const registry = new PluginSpiRegistry();

  registry.register(createCodingPresenterPlugin());
  registry.register(createGrowthPresenterPlugin());
  registry.register(createOperationsPresenterPlugin());

  const allPlugins = registry.list();
  assert.equal(allPlugins.length, 3);
});

test("PluginSpiRegistry.register can register mix of plugin types", () => {
  const registry = new PluginSpiRegistry();

  registry.register(createGithubAdapterPlugin());
  registry.register(createCodingPresenterPlugin());
  registry.register(createBasicEvaluatorPlugin());

  const adapters = registry.listByDomain("coding", "adapter");
  const presenters = registry.listByDomain("coding", "presenter");
  const validators = registry.listByDomain("core", "validator");

  assert.equal(adapters.length, 1);
  assert.equal(presenters.length, 1);
  assert.equal(validators.length, 1);
});

test("PluginSpiRegistry.register dedupes capabilityIds", () => {
  const registry = new PluginSpiRegistry();
  const adapter = createGithubAdapterPlugin();

  const manifest: PluginManifest = {
    pluginId: adapter.pluginId,
    name: "Test",
    version: "1.0.0",
    owner: "test",
    domainIds: [],
    capabilityIds: ["external.github", "external.github"], // duplicate
    spiTypes: ["adapter"],
    extensionKind: "external_adapter",
    trustLevel: "trusted",
    publicSdkSurface: "@test/plugin",
    settingsSchema: {},
  };

  const record = registry.register(adapter, manifest);

  const githubCount = record.manifest.capabilityIds.filter(
    (c) => c === "external.github",
  ).length;
  assert.equal(githubCount, 1);
});

test("PluginSpiRegistry.register dedupes spiTypes", () => {
  const registry = new PluginSpiRegistry();
  const adapter = createGithubAdapterPlugin();

  const manifest: PluginManifest = {
    pluginId: adapter.pluginId,
    name: "Test",
    version: "1.0.0",
    owner: "test",
    domainIds: [],
    capabilityIds: [],
    spiTypes: ["adapter", "adapter"], // duplicate
    extensionKind: "external_adapter",
    trustLevel: "trusted",
    publicSdkSurface: "@test/plugin",
    settingsSchema: {},
  };

  const record = registry.register(adapter, manifest);

  const adapterCount = record.manifest.spiTypes.filter((s) => s === "adapter").length;
  assert.equal(adapterCount, 1);
});

test("PluginSpiRegistry.register requires spiTypes to include plugin spiType", () => {
  const registry = new PluginSpiRegistry();
  const adapter = createGithubAdapterPlugin();

  const manifest: PluginManifest = {
    pluginId: adapter.pluginId,
    name: "Test",
    version: "1.0.0",
    owner: "test",
    domainIds: [],
    capabilityIds: [],
    spiTypes: ["retriever"], // Wrong type
    extensionKind: "external_adapter",
    trustLevel: "trusted",
    publicSdkSurface: "@test/plugin",
    settingsSchema: {},
  };

  assert.throws(
    () => registry.register(adapter, manifest),
    { message: /spi_type_mismatch/ },
  );
});

test("PluginSpiRegistry.register sets lastHealthCheckAt to null initially", () => {
  const registry = new PluginSpiRegistry();
  const adapter = createGithubAdapterPlugin();

  const record = registry.register(adapter);

  assert.equal(record.lastHealthCheckAt, null);
});

test("All adapter plugins have valid manifests when registered", () => {
  const registry = new PluginSpiRegistry();

  const adapters = [
    createGithubAdapterPlugin(),
    createCrmAdapterPlugin(),
    createGameDevAdapterPlugin(),
    createAssetProductionAdapterPlugin(),
    createLivestreamAdapterPlugin(),
  ];

  for (const adapter of adapters) {
    const record = registry.register(adapter);
    assert.ok(PluginManifestSchema.safeParse(record.manifest).success);
  }
});

test("All presenter plugins have valid manifests when registered", () => {
  const registry = new PluginSpiRegistry();

  const presenters = [
    createCodingPresenterPlugin(),
    createGrowthPresenterPlugin(),
    createOperationsPresenterPlugin(),
  ];

  for (const presenter of presenters) {
    const record = registry.register(presenter);
    assert.ok(PluginManifestSchema.safeParse(record.manifest).success);
  }
});

test("Validator plugin has valid manifest when registered", () => {
  const registry = new PluginSpiRegistry();
  const validator = createBasicEvaluatorPlugin();

  const record = registry.register(validator);

  assert.ok(PluginManifestSchema.safeParse(record.manifest).success);
  assert.equal(record.manifest.pluginId, "plugin.core.basic-evaluator");
});

test("PluginSpiRegistry.get returns correct record type", () => {
  const registry = new PluginSpiRegistry();
  const adapter = createGithubAdapterPlugin();

  registry.register(adapter);

  const record = registry.get(adapter.pluginId);

  assert.ok(record !== null);
  assert.equal(record!.manifest.pluginId, adapter.pluginId);
  assert.equal(record!.plugin.pluginId, adapter.pluginId);
});

test("PluginSpiRegistry.resolve returns plugin directly", () => {
  const registry = new PluginSpiRegistry();
  const adapter = createGithubAdapterPlugin();

  registry.register(adapter);

  const plugin = registry.resolve(adapter.pluginId);

  assert.ok(plugin !== null);
  assert.equal(plugin!.pluginId, adapter.pluginId);
});

test("PluginSpiRegistry.resolve returns null for unregistered plugin", () => {
  const registry = new PluginSpiRegistry();

  const plugin = registry.resolve("nonexistent.plugin");

  assert.equal(plugin, null);
});

test("PluginSpiRegistry.list returns empty array when no plugins registered", () => {
  const registry = new PluginSpiRegistry();

  const plugins = registry.list();

  assert.deepEqual(plugins, []);
});

test("PluginSpiRegistry.listByDomain returns empty array for unknown domain", () => {
  const registry = new PluginSpiRegistry();

  const plugins = registry.listByDomain("nonexistent_domain");

  assert.deepEqual(plugins, []);
});

test("PluginSpiRegistry.listByDomain with spiType returns empty for no matches", () => {
  const registry = new PluginSpiRegistry();

  const plugins = registry.listByDomain("nonexistent_domain", "adapter");

  assert.deepEqual(plugins, []);
});

test("PluginSpiRegistry allows registering same pluginId twice (overwrites)", () => {
  const registry = new PluginSpiRegistry();
  const adapter1 = createGithubAdapterPlugin();
  const adapter2 = createGithubAdapterPlugin();

  registry.register(adapter1);
  registry.register(adapter2); // Same pluginId

  const plugins = registry.list();
  assert.equal(plugins.length, 1);
  assert.equal(plugins[0].manifest.pluginId, adapter1.pluginId);
});
