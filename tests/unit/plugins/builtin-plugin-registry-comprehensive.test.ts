/**
 * Unit Tests: Builtin Plugin Registry Comprehensive
 *
 * Comprehensive tests for builtin-plugin-registry covering all builtin plugins,
 * registration patterns, lifecycle functions, marketplace, and data taint features.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createBuiltinPlugin,
  getBuiltinPluginManifest,
  hasBuiltinPlugin,
  listBuiltinPluginIds,
  propagateDataTaint,
  getDataTaintLabels,
  hasDataTaintLabel,
  revokePluginBundle,
  getPluginRevocationStatus,
  isPluginRevoked,
  listRevokedPlugins,
  removePluginRevocation,
  BundleRevocationSeverity,
  PluginMarketplaceRegistry,
  getMarketplaceRegistry,
  type DynamicPluginLoader,
  type MarketplacePluginEntry,
} from "../../../src/plugins/builtin-plugin-registry.js";

test("listBuiltinPluginIds returns array of plugin IDs", () => {
  const pluginIds = listBuiltinPluginIds();

  assert.ok(Array.isArray(pluginIds));
  assert.ok(pluginIds.length > 0);
});

test("listBuiltinPluginIds includes all domain plugins", () => {
  const pluginIds = listBuiltinPluginIds();

  // Coding domain
  assert.ok(pluginIds.includes("plugin.coding.retriever"));
  assert.ok(pluginIds.includes("plugin.coding.presenter"));

  // Operations domain
  assert.ok(pluginIds.includes("plugin.operations.retriever"));
  assert.ok(pluginIds.includes("plugin.operations.presenter"));

  // Growth domain
  assert.ok(pluginIds.includes("plugin.growth.retriever"));
  assert.ok(pluginIds.includes("plugin.growth.presenter"));

  // GameDev domain
  assert.ok(pluginIds.includes("plugin.gamedev.retriever"));

  // Asset Production domain
  assert.ok(pluginIds.includes("plugin.assetproduction.retriever"));

  // Livestream domain
  assert.ok(pluginIds.includes("plugin.livestream.retriever"));
});

test("listBuiltinPluginIds includes all core plugins", () => {
  const pluginIds = listBuiltinPluginIds();

  assert.ok(pluginIds.includes("plugin.core.basic-evaluator"));
  assert.ok(pluginIds.includes("plugin.core.basic-planner"));
});

test("listBuiltinPluginIds includes all external adapters", () => {
  const pluginIds = listBuiltinPluginIds();

  assert.ok(pluginIds.includes("plugin.shared.github_adapter"));
  assert.ok(pluginIds.includes("plugin.growth.crm_adapter"));
  assert.ok(pluginIds.includes("plugin.gamedev.unity_adapter"));
  assert.ok(pluginIds.includes("plugin.assetproduction.figma_adapter"));
  assert.ok(pluginIds.includes("plugin.livestream.obs_adapter"));
});

test("hasBuiltinPlugin returns true for known plugins", () => {
  const knownPlugins = [
    "plugin.coding.retriever",
    "plugin.coding.presenter",
    "plugin.core.basic-evaluator",
    "plugin.core.basic-planner",
    "plugin.shared.github_adapter",
    "plugin.operations.retriever",
    "plugin.growth.retriever",
    "plugin.growth.crm_adapter",
  ];

  for (const pluginId of knownPlugins) {
    assert.equal(hasBuiltinPlugin(pluginId), true, `Expected ${pluginId} to be builtin`);
  }
});

test("hasBuiltinPlugin returns false for unknown plugins", () => {
  const unknownPlugins = [
    "plugin.unknown.retriever",
    "plugin.does.not.exist",
    "plugin.mystery.adapter",
    "",
  ];

  for (const pluginId of unknownPlugins) {
    assert.equal(hasBuiltinPlugin(pluginId), false, `Expected ${pluginId} to not be builtin`);
  }
});

test("createBuiltinPlugin returns plugin for known IDs", () => {
  const pluginIds = listBuiltinPluginIds();

  for (const pluginId of pluginIds) {
    const plugin = createBuiltinPlugin(pluginId);
    assert.ok(plugin !== null, `Expected ${pluginId} to be creatable`);
    assert.equal(plugin!.pluginId, pluginId);
  }
});

test("createBuiltinPlugin returns null for unknown IDs", () => {
  const plugin = createBuiltinPlugin("plugin.unknown.id");
  assert.equal(plugin, null);
});

test("createBuiltinPlugin returns null for empty string", () => {
  const plugin = createBuiltinPlugin("");
  assert.equal(plugin, null);
});

test("createBuiltinPlugin creates retriever plugins with correct spiType", () => {
  const retrieverIds = [
    "plugin.coding.retriever",
    "plugin.operations.retriever",
    "plugin.growth.retriever",
    "plugin.gamedev.retriever",
    "plugin.assetproduction.retriever",
    "plugin.livestream.retriever",
  ];

  for (const pluginId of retrieverIds) {
    const plugin = createBuiltinPlugin(pluginId);
    assert.ok(plugin !== null);
    assert.equal(plugin!.spiType, "retriever", `${pluginId} should be retriever`);
  }
});

test("createBuiltinPlugin creates presenter plugins with correct spiType", () => {
  const presenterIds = [
    "plugin.coding.presenter",
    "plugin.growth.presenter",
    "plugin.operations.presenter",
  ];

  for (const pluginId of presenterIds) {
    const plugin = createBuiltinPlugin(pluginId);
    assert.ok(plugin !== null);
    assert.equal(plugin!.spiType, "presenter", `${pluginId} should be presenter`);
  }
});

test("createBuiltinPlugin creates adapter plugins with correct spiType", () => {
  const adapterIds = [
    "plugin.shared.github_adapter",
    "plugin.growth.crm_adapter",
    "plugin.gamedev.unity_adapter",
    "plugin.assetproduction.figma_adapter",
    "plugin.livestream.obs_adapter",
  ];

  for (const pluginId of adapterIds) {
    const plugin = createBuiltinPlugin(pluginId);
    assert.ok(plugin !== null);
    assert.equal(plugin!.spiType, "adapter", `${pluginId} should be adapter`);
  }
});

test("createBuiltinPlugin creates validator plugin", () => {
  const plugin = createBuiltinPlugin("plugin.core.basic-evaluator");
  assert.ok(plugin !== null);
  assert.equal(plugin!.spiType, "validator");
});

test("createBuiltinPlugin creates planner plugin", () => {
  const plugin = createBuiltinPlugin("plugin.core.basic-planner");
  assert.ok(plugin !== null);
  assert.equal(plugin!.spiType, "planner");
});

test("getBuiltinPluginManifest returns manifest for known plugins", () => {
  const pluginIds = listBuiltinPluginIds();

  for (const pluginId of pluginIds) {
    const manifest = getBuiltinPluginManifest(pluginId);
    assert.ok(manifest !== null, `Expected manifest for ${pluginId}`);
    assert.equal(manifest!.pluginId, pluginId);
    assert.ok(manifest!.name.length > 0);
    assert.ok(manifest!.version.length > 0);
    assert.ok(manifest!.owner.length > 0);
    assert.ok(Array.isArray(manifest!.domainIds));
    assert.ok(Array.isArray(manifest!.capabilityIds));
    assert.ok(Array.isArray(manifest!.spiTypes));
  }
});

test("getBuiltinPluginManifest returns null for unknown plugins", () => {
  const manifest = getBuiltinPluginManifest("plugin.unknown.id");
  assert.equal(manifest, null);
});

test("getBuiltinPluginManifest contains correct trust levels", () => {
  // Internal plugins
  const internalManifest = getBuiltinPluginManifest("plugin.core.basic-evaluator");
  assert.ok(internalManifest);
  assert.equal(internalManifest!.trustLevel, "internal");

  // Trusted external adapters
  const adapterManifest = getBuiltinPluginManifest("plugin.shared.github_adapter");
  assert.ok(adapterManifest);
  assert.equal(adapterManifest!.trustLevel, "trusted");
});

test("getBuiltinPluginManifest contains publicSdkSurface", () => {
  const manifest = getBuiltinPluginManifest("plugin.coding.retriever");
  assert.ok(manifest);
  assert.ok(manifest!.publicSdkSurface.length > 0);
  assert.ok(manifest!.publicSdkSurface.startsWith("@automatic-agent/"));
});

test("getBuiltinPluginManifest contains settingsSchema", () => {
  const manifest = getBuiltinPluginManifest("plugin.coding.retriever");
  assert.ok(manifest);
  assert.ok(manifest!.settingsSchema !== undefined);
});

test("BundleRevocationSeverity enum has all expected values", () => {
  assert.equal(BundleRevocationSeverity.INFO, "info");
  assert.equal(BundleRevocationSeverity.WARNING, "warning");
  assert.equal(BundleRevocationSeverity.MODERATE, "moderate");
  assert.equal(BundleRevocationSeverity.SEVERE, "severe");
  assert.equal(BundleRevocationSeverity.CRITICAL, "critical");
});

test("revokePluginBundle marks plugin as revoked", () => {
  const pluginId = "plugin.test.revocation";

  assert.equal(isPluginRevoked(pluginId), false);

  const record = revokePluginBundle(
    pluginId,
    BundleRevocationSeverity.SEVERE,
    "Test revocation reason",
  );

  assert.equal(record.pluginId, pluginId);
  assert.equal(record.severity, BundleRevocationSeverity.SEVERE);
  assert.equal(record.reason, "Test revocation reason");
  assert.ok(record.revokedAt.length > 0);
  assert.deepEqual(record.affectedVersions, ["*"]);

  assert.equal(isPluginRevoked(pluginId), true);
});

test("revokePluginBundle accepts specific affectedVersions", () => {
  const pluginId = "plugin.test.versions";

  const record = revokePluginBundle(
    pluginId,
    BundleRevocationSeverity.MODERATE,
    "Version specific issue",
    ["1.0.0", "1.1.0"],
  );

  assert.deepEqual(record.affectedVersions, ["1.0.0", "1.1.0"]);
});

test("getPluginRevocationStatus returns record for revoked plugin", () => {
  const pluginId = "plugin.test.status";

  revokePluginBundle(pluginId, BundleRevocationSeverity.WARNING, "Test");

  const status = getPluginRevocationStatus(pluginId);

  assert.ok(status !== null);
  assert.equal(status!.pluginId, pluginId);
  assert.equal(status!.severity, BundleRevocationSeverity.WARNING);
});

test("getPluginRevocationStatus returns null for non-revoked plugin", () => {
  const status = getPluginRevocationStatus("plugin.coding.retriever");
  assert.equal(status, null);
});

test("listRevokedPlugins returns all revoked plugins", () => {
  const initialCount = listRevokedPlugins().length;

  revokePluginBundle("plugin.test.list1", BundleRevocationSeverity.INFO, "Test 1");
  revokePluginBundle("plugin.test.list2", BundleRevocationSeverity.CRITICAL, "Test 2");

  const revoked = listRevokedPlugins();
  assert.ok(revoked.length >= initialCount + 2);
});

test("removePluginRevocation clears revocation", () => {
  const pluginId = "plugin.test.remove";

  revokePluginBundle(pluginId, BundleRevocationSeverity.SEVERE, "To be removed");
  assert.equal(isPluginRevoked(pluginId), true);

  const removed = removePluginRevocation(pluginId);
  assert.equal(removed, true);
  assert.equal(isPluginRevoked(pluginId), false);
});

test("removePluginRevocation returns false for non-revoked plugin", () => {
  const removed = removePluginRevocation("plugin.coding.retriever");
  assert.equal(removed, false);
});

test("propagateDataTaint creates propagation record", () => {
  const dataId = "data-001";
  const targetPluginId = "plugin.coding.retriever";
  const labels = ["sensitive", "pii"];

  const propagation = propagateDataTaint(dataId, targetPluginId, labels);

  assert.equal(propagation.originPluginId, targetPluginId);
  assert.equal(propagation.originatingDataId, dataId);
  assert.equal(propagation.labels.length, 2);
  assert.equal(propagation.labels[0].sourcePluginId, targetPluginId);
  assert.equal(propagation.labels[0].label, "sensitive");
  assert.equal(propagation.labels[1].label, "pii");
});

test("getDataTaintLabels retrieves labels for data ID", () => {
  const dataId = "data-002";

  propagateDataTaint(dataId, "plugin.coding.retriever", ["label-a"]);
  propagateDataTaint(dataId, "plugin.coding.presenter", ["label-b"]);
  propagateDataTaint(dataId, "plugin.shared.github_adapter", ["label-c"]);

  const labels = getDataTaintLabels(dataId);

  assert.equal(labels.length, 3);
  assert.ok(labels.some((l) => l.label === "label-a"));
  assert.ok(labels.some((l) => l.label === "label-b"));
  assert.ok(labels.some((l) => l.label === "label-c"));
});

test("getDataTaintLabels returns empty for unknown data ID", () => {
  const labels = getDataTaintLabels("nonexistent-data-id");
  assert.deepEqual(labels, []);
});

test("hasDataTaintLabel checks for specific label", () => {
  const dataId = "data-003";

  propagateDataTaint(dataId, "plugin.coding.retriever", ["secret", "confidential"]);

  assert.equal(hasDataTaintLabel(dataId, "secret"), true);
  assert.equal(hasDataTaintLabel(dataId, "confidential"), true);
  assert.equal(hasDataTaintLabel(dataId, "public"), false);
});

test("PluginMarketplaceRegistry registers loader", () => {
  const registry = new PluginMarketplaceRegistry();

  const mockLoader: DynamicPluginLoader = {
    loadFromSource: async () => null,
    supportsSource: (source) => source.startsWith("test:"),
  };

  registry.registerLoader("test", mockLoader);

  // Loader should be registered (no error thrown)
});

test("PluginMarketplaceRegistry.registerMarketplaceEntry adds entry", () => {
  const registry = new PluginMarketplaceRegistry();

  const entry: MarketplacePluginEntry = {
    pluginId: "marketplace.plugin",
    name: "Marketplace Plugin",
    version: "1.0.0",
    owner: "marketplace-team",
    trustLevel: "verified",
    source: "marketplace:plugin-id",
  };

  registry.registerMarketplaceEntry(entry);

  const retrieved = registry.getMarketplaceEntry("marketplace.plugin");
  assert.ok(retrieved !== null);
  assert.equal(retrieved!.pluginId, "marketplace.plugin");
  assert.equal(retrieved!.name, "Marketplace Plugin");
});

test("PluginMarketplaceRegistry.hasMarketplacePlugin checks presence", () => {
  const registry = new PluginMarketplaceRegistry();

  const entry: MarketplacePluginEntry = {
    pluginId: "marketplace.test",
    name: "Test",
    version: "1.0.0",
    owner: "test",
    trustLevel: "community",
    source: "marketplace:test",
  };

  assert.equal(registry.hasMarketplacePlugin("marketplace.test"), false);

  registry.registerMarketplaceEntry(entry);

  assert.equal(registry.hasMarketplacePlugin("marketplace.test"), true);
});

test("PluginMarketplaceRegistry.listMarketplacePlugins returns all entries", () => {
  const registry = new PluginMarketplaceRegistry();

  registry.registerMarketplaceEntry({
    pluginId: "mp.plugin1",
    name: "Plugin 1",
    version: "1.0.0",
    owner: "team1",
    trustLevel: "verified",
    source: "marketplace:plugin1",
  });

  registry.registerMarketplaceEntry({
    pluginId: "mp.plugin2",
    name: "Plugin 2",
    version: "2.0.0",
    owner: "team2",
    trustLevel: "community",
    source: "marketplace:plugin2",
  });

  const plugins = registry.listMarketplacePlugins();
  assert.equal(plugins.length, 2);
});

test("PluginMarketplaceRegistry.authenticate creates session", async () => {
  const registry = new PluginMarketplaceRegistry();

  const sessionToken = await registry.authenticate("https://marketplace.example.com", {
    apiKey: "test-key",
  });

  assert.ok(sessionToken.length > 0);
  assert.ok(sessionToken.startsWith("session_"));

  assert.equal(registry.isAuthenticated(sessionToken), true);
});

test("PluginMarketplaceRegistry.isAuthenticated returns false for invalid token", () => {
  const registry = new PluginMarketplaceRegistry();

  assert.equal(registry.isAuthenticated("invalid_token"), false);
});

test("getMarketplaceRegistry returns global registry", () => {
  const registry1 = getMarketplaceRegistry();
  const registry2 = getMarketplaceRegistry();

  assert.ok(registry1 === registry2); // Should be same instance
});

test("Builtin plugin manifest spiTypes match plugin spiType", () => {
  const pluginIds = listBuiltinPluginIds();

  for (const pluginId of pluginIds) {
    const plugin = createBuiltinPlugin(pluginId);
    const manifest = getBuiltinPluginManifest(pluginId);

    assert.ok(plugin !== null);
    assert.ok(manifest !== null);
    assert.ok(
      manifest!.spiTypes.includes(plugin!.spiType),
      `${pluginId}: manifest spiTypes ${manifest!.spiTypes} should include plugin spiType ${plugin!.spiType}`,
    );
  }
});

test("Builtin plugin manifest owner is always set", () => {
  const pluginIds = listBuiltinPluginIds();

  for (const pluginId of pluginIds) {
    const manifest = getBuiltinPluginManifest(pluginId);
    assert.ok(manifest);
    assert.ok(manifest!.owner.length > 0, `${pluginId} should have owner set`);
  }
});

test("Builtin plugin manifest extensionKind is correctly set", () => {
  // External adapters
  const githubManifest = getBuiltinPluginManifest("plugin.shared.github_adapter");
  assert.ok(githubManifest);
  assert.equal(githubManifest!.extensionKind, "external_adapter");

  // Domain plugins
  const presenterManifest = getBuiltinPluginManifest("plugin.coding.presenter");
  assert.ok(presenterManifest);
  assert.equal(presenterManifest!.extensionKind, "domain_plugin");
});

test("Builtin plugin manifest trustLevel is valid enum value", () => {
  const validTrustLevels = ["internal", "trusted", "community", "unverified"];
  const pluginIds = listBuiltinPluginIds();

  for (const pluginId of pluginIds) {
    const manifest = getBuiltinPluginManifest(pluginId);
    assert.ok(manifest);
    assert.ok(
      validTrustLevels.includes(manifest!.trustLevel),
      `${pluginId}: trustLevel ${manifest!.trustLevel} is not valid`,
    );
  }
});
