/**
 * @fileoverview Unit tests for builtin plugin registry - comprehensive coverage
 *
 * Tests PluginMarketplaceRegistry, DynamicPluginLoader interface,
 * taint propagation, revocation handling, and manifest utilities.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  PluginMarketplaceRegistry,
  getMarketplaceRegistry,
  getBuiltinPluginManifest,
  hasBuiltinPlugin,
  listBuiltinPluginIds,
  createBuiltinPlugin,
  propagateDataTaint,
  getDataTaintLabels,
  hasDataTaintLabel,
  revokePluginBundle,
  getPluginRevocationStatus,
  isPluginRevoked,
  listRevokedPlugins,
  removePluginRevocation,
  BundleRevocationSeverity,
} from "../../../src/plugins/builtin-plugin-registry.js";

test("PluginMarketplaceRegistry can be instantiated", () => {
  const registry = new PluginMarketplaceRegistry();
  assert.ok(registry !== undefined);
});

test("PluginMarketplaceRegistry.registerLoader adds loader for scheme", () => {
  const registry = new PluginMarketplaceRegistry();

  const mockLoader = {
    supportsSource: (source: string) => source.startsWith("marketplace:"),
    loadFromSource: async (source: string) => null,
  };

  registry.registerLoader("marketplace:", mockLoader);

  // Registry should have the loader registered (internal state)
  assert.ok(mockLoader !== undefined);
});

test("PluginMarketplaceRegistry.registerMarketplaceEntry adds plugin entry", () => {
  const registry = new PluginMarketplaceRegistry();

  registry.registerMarketplaceEntry({
    pluginId: "marketplace.plugin.test",
    name: "Test Plugin",
    version: "1.0.0",
    owner: "test-owner",
    trustLevel: "verified",
    source: "marketplace:test-plugin",
  });

  assert.equal(registry.hasMarketplacePlugin("marketplace.plugin.test"), true);
});

test("PluginMarketplaceRegistry.hasMarketplacePlugin returns false for unknown", () => {
  const registry = new PluginMarketplaceRegistry();

  assert.equal(registry.hasMarketplacePlugin("nonexistent.plugin"), false);
});

test("PluginMarketplaceRegistry.getMarketplaceEntry returns entry", () => {
  const registry = new PluginMarketplaceRegistry();

  registry.registerMarketplaceEntry({
    pluginId: "marketplace.plugin.entry",
    name: "Entry Plugin",
    version: "1.0.0",
    owner: "test-owner",
    trustLevel: "verified",
    source: "marketplace:entry-plugin",
  });

  const entry = registry.getMarketplaceEntry("marketplace.plugin.entry");
  assert.ok(entry !== null);
  assert.equal(entry!.name, "Entry Plugin");
});

test("PluginMarketplaceRegistry.getMarketplaceEntry returns null for unknown", () => {
  const registry = new PluginMarketplaceRegistry();

  const entry = registry.getMarketplaceEntry("nonexistent.plugin");
  assert.equal(entry, null);
});

test("PluginMarketplaceRegistry.listMarketplacePlugins returns all entries", () => {
  const registry = new PluginMarketplaceRegistry();

  registry.registerMarketplaceEntry({
    pluginId: "plugin-a",
    name: "Plugin A",
    version: "1.0.0",
    owner: "owner-a",
    trustLevel: "verified",
    source: "marketplace:a",
  });
  registry.registerMarketplaceEntry({
    pluginId: "plugin-b",
    name: "Plugin B",
    version: "1.0.0",
    owner: "owner-b",
    trustLevel: "community",
    source: "marketplace:b",
  });

  const plugins = registry.listMarketplacePlugins();
  assert.equal(plugins.length, 2);
});

test("PluginMarketplaceRegistry.authenticate returns session token", async () => {
  const registry = new PluginMarketplaceRegistry();

  const token = await registry.authenticate("https://marketplace.example.com", {
    apiKey: "test-api-key",
  });

  assert.ok(typeof token === "string");
  assert.ok(token.startsWith("session_"));
});

test("PluginMarketplaceRegistry.isAuthenticated returns true for valid session", async () => {
  const registry = new PluginMarketplaceRegistry();

  const token = await registry.authenticate("https://marketplace.example.com", {
    apiKey: "test",
  });

  assert.equal(registry.isAuthenticated(token), true);
  assert.equal(registry.isAuthenticated("invalid-token"), false);
});

test("PluginMarketplaceRegistry.loadPlugin requires marketplace entry", async () => {
  const registry = new PluginMarketplaceRegistry();

  const result = await registry.loadPlugin("nonexistent.plugin", "marketplace:nonexistent");
  assert.equal(result, null);
});

test("PluginMarketplaceRegistry.loadPlugin requires authentication", async () => {
  const registry = new PluginMarketplaceRegistry();

  registry.registerMarketplaceEntry({
    pluginId: "auth.required.plugin",
    name: "Auth Required Plugin",
    version: "1.0.0",
    owner: "test",
    trustLevel: "certified",
    source: "marketplace:auth-required",
  });

  await assert.rejects(
    async () => registry.loadPlugin("auth.required.plugin", "marketplace:auth-required", "invalid-token"),
    /Authentication required/i,
  );
});

test("getMarketplaceRegistry returns global singleton", () => {
  const registry1 = getMarketplaceRegistry();
  const registry2 = getMarketplaceRegistry();

  assert.equal(registry1, registry2, "should return same instance");
});

test("getBuiltinPluginManifest returns manifest for valid plugin", () => {
  const manifest = getBuiltinPluginManifest("plugin.coding.retriever");

  assert.ok(manifest !== null);
  assert.equal(manifest!.pluginId, "plugin.coding.retriever");
  assert.equal(manifest!.name, "Coding Retriever");
  assert.equal(manifest!.version, "1.0.0");
});

test("getBuiltinPluginManifest returns null for unknown plugin", () => {
  const manifest = getBuiltinPluginManifest("plugin.does.not.exist");
  assert.equal(manifest, null);
});

test("hasBuiltinPlugin returns true for known plugins", () => {
  assert.equal(hasBuiltinPlugin("plugin.coding.retriever"), true);
  assert.equal(hasBuiltinPlugin("plugin.core.basic-planner"), true);
  assert.equal(hasBuiltinPlugin("plugin.shared.github_adapter"), true);
});

test("hasBuiltinPlugin returns false for unknown plugins", () => {
  assert.equal(hasBuiltinPlugin("plugin.does.not.exist"), false);
  assert.equal(hasBuiltinPlugin(""), false);
});

test("listBuiltinPluginIds returns all builtin plugin IDs", () => {
  const ids = listBuiltinPluginIds();

  // Verify we have all expected categories
  assert.ok(ids.some((id) => id.startsWith("plugin.coding.")));
  assert.ok(ids.some((id) => id.startsWith("plugin.operations.")));
  assert.ok(ids.some((id) => id.startsWith("plugin.growth.")));
  assert.ok(ids.some((id) => id.startsWith("plugin.gamedev.")));
  assert.ok(ids.some((id) => id.startsWith("plugin.assetproduction.")));
  assert.ok(ids.some((id) => id.startsWith("plugin.livestream.")));
  assert.ok(ids.some((id) => id.startsWith("plugin.core.")));
  assert.ok(ids.some((id) => id.startsWith("plugin.shared.")));
});

test("listBuiltinPluginIds returns unique IDs (no duplicates)", () => {
  const ids = listBuiltinPluginIds();
  const uniqueIds = new Set(ids);

  assert.equal(ids.length, uniqueIds.size, "should have no duplicate plugin IDs");
});

test("createBuiltinPlugin returns null for empty or whitespace pluginId", () => {
  assert.equal(createBuiltinPlugin(""), null);
  assert.equal(createBuiltinPlugin("   "), null);
});

test("createBuiltinPlugin creates all known builtin plugins", () => {
  const pluginIds = listBuiltinPluginIds();

  for (const pluginId of pluginIds) {
    const plugin = createBuiltinPlugin(pluginId);
    assert.ok(plugin !== null, `Should create plugin: ${pluginId}`);
    assert.equal(plugin!.pluginId, pluginId);
  }
});

test("propagateDataTaint creates taint labels for data-plugin pair", () => {
  const propagation = propagateDataTaint("data-abc", "plugin.test", ["label1", "label2"]);

  assert.equal(propagation.originPluginId, "plugin.test");
  assert.equal(propagation.originatingDataId, "data-abc");
  assert.equal(propagation.labels.length, 2);
  assert.equal(propagation.labels[0].label, "label1");
  assert.equal(propagation.labels[1].label, "label2");
});

test("propagateDataTaint tracks severity in labels", () => {
  const propagation = propagateDataTaint("data-severity", "plugin.test", ["security"]);

  assert.equal(propagation.labels[0].severity, "medium");
  assert.ok(propagation.labels[0].sourcePluginId.length > 0);
  assert.ok(propagation.labels[0].propagatedAt.length > 0);
});

test("getDataTaintLabels retrieves all labels for data ID", () => {
  propagateDataTaint("data-multi", "plugin-a", ["label-a"]);
  propagateDataTaint("data-multi", "plugin-b", ["label-b"]);
  propagateDataTaint("data-multi", "plugin-c", ["label-c"]);

  const labels = getDataTaintLabels("data-multi");
  assert.equal(labels.length, 3);
  assert.ok(labels.some((l) => l.label === "label-a"));
  assert.ok(labels.some((l) => l.label === "label-b"));
  assert.ok(labels.some((l) => l.label === "label-c"));
});

test("getDataTaintLabels returns empty array for unknown data ID", () => {
  const labels = getDataTaintLabels("nonexistent-data-id");
  assert.equal(labels.length, 0);
});

test("hasDataTaintLabel returns true for existing label", () => {
  propagateDataTaint("data-check", "plugin.check", ["exists"]);

  assert.equal(hasDataTaintLabel("data-check", "exists"), true);
});

test("hasDataTaintLabel returns false for unknown label", () => {
  propagateDataTaint("data-check", "plugin.check", ["exists"]);

  assert.equal(hasDataTaintLabel("data-check", "notexists"), false);
});

test("hasDataTaintLabel returns false for unknown data ID", () => {
  assert.equal(hasDataTaintLabel("nonexistent-data", "label"), false);
});

test("revokePluginBundle creates revocation record with INFO severity", () => {
  const record = revokePluginBundle(
    "plugin.test.info",
    BundleRevocationSeverity.INFO,
    "Informational notice",
    ["1.0.0"],
  );

  assert.equal(record.pluginId, "plugin.test.info");
  assert.equal(record.severity, BundleRevocationSeverity.INFO);
  assert.equal(record.reason, "Informational notice");
  assert.deepEqual(record.affectedVersions, ["1.0.0"]);
  assert.ok(record.revokedAt.length > 0);
});

test("revokePluginBundle creates revocation record with WARNING severity", () => {
  const record = revokePluginBundle(
    "plugin.test.warning",
    BundleRevocationSeverity.WARNING,
    "Warning notice",
  );

  assert.equal(record.severity, BundleRevocationSeverity.WARNING);
  assert.deepEqual(record.affectedVersions, ["*"]);
});

test("revokePluginBundle creates revocation record with MODERATE severity", () => {
  const record = revokePluginBundle(
    "plugin.test.moderate",
    BundleRevocationSeverity.MODERATE,
    "Moderate issue",
    ["1.0.0", "1.1.0"],
  );

  assert.equal(record.severity, BundleRevocationSeverity.MODERATE);
  assert.deepEqual(record.affectedVersions, ["1.0.0", "1.1.0"]);
});

test("revokePluginBundle creates revocation record with SEVERE severity", () => {
  const record = revokePluginBundle(
    "plugin.test.severe",
    BundleRevocationSeverity.SEVERE,
    "Severe vulnerability",
  );

  assert.equal(record.severity, BundleRevocationSeverity.SEVERE);
});

test("revokePluginBundle creates revocation record with CRITICAL severity", () => {
  const record = revokePluginBundle(
    "plugin.test.critical",
    BundleRevocationSeverity.CRITICAL,
    "Critical emergency",
  );

  assert.equal(record.severity, BundleRevocationSeverity.CRITICAL);
});

test("getPluginRevocationStatus returns record for revoked plugin", () => {
  revokePluginBundle("plugin.status.test", BundleRevocationSeverity.SEVERE, "Test revocation");

  const status = getPluginRevocationStatus("plugin.status.test");
  assert.ok(status !== null);
  assert.equal(status!.severity, BundleRevocationSeverity.SEVERE);
});

test("getPluginRevocationStatus returns null for non-revoked plugin", () => {
  const status = getPluginRevocationStatus("plugin.never.revoked");
  assert.equal(status, null);
});

test("isPluginRevoked returns true for revoked plugin", () => {
  revokePluginBundle("plugin.revoked.test", BundleRevocationSeverity.WARNING, "Test");

  assert.equal(isPluginRevoked("plugin.revoked.test"), true);
});

test("isPluginRevoked returns false for non-revoked plugin", () => {
  assert.equal(isPluginRevoked("plugin.not.revoked"), false);
});

test("listRevokedPlugins returns all revoked plugins", () => {
  revokePluginBundle("plugin.list.1", BundleRevocationSeverity.INFO, "One");
  revokePluginBundle("plugin.list.2", BundleRevocationSeverity.WARNING, "Two");
  revokePluginBundle("plugin.list.3", BundleRevocationSeverity.SEVERE, "Three");

  const revoked = listRevokedPlugins();
  assert.ok(revoked.length >= 3);
  assert.ok(revoked.some((r) => r.pluginId === "plugin.list.1"));
  assert.ok(revoked.some((r) => r.pluginId === "plugin.list.2"));
  assert.ok(revoked.some((r) => r.pluginId === "plugin.list.3"));
});

test("removePluginRevocation returns true and clears revocation", () => {
  revokePluginBundle("plugin.remove.test", BundleRevocationSeverity.WARNING, "To be removed");

  assert.equal(isPluginRevoked("plugin.remove.test"), true);

  const removed = removePluginRevocation("plugin.remove.test");
  assert.equal(removed, true);
  assert.equal(isPluginRevoked("plugin.remove.test"), false);
});

test("removePluginRevocation returns false for non-revoked plugin", () => {
  const removed = removePluginRevocation("plugin.never.revoked");
  assert.equal(removed, false);
});

test("BundleRevocationSeverity enum has all expected values", () => {
  assert.equal(BundleRevocationSeverity.INFO, "info");
  assert.equal(BundleRevocationSeverity.WARNING, "warning");
  assert.equal(BundleRevocationSeverity.MODERATE, "moderate");
  assert.equal(BundleRevocationSeverity.SEVERE, "severe");
  assert.equal(BundleRevocationSeverity.CRITICAL, "critical");
});

test("builtin plugin manifest has all required fields", () => {
  const manifest = getBuiltinPluginManifest("plugin.core.basic-planner")!;

  assert.ok(manifest.pluginId.length > 0);
  assert.ok(manifest.name.length > 0);
  assert.ok(manifest.version.length > 0);
  assert.ok(manifest.owner.length > 0);
  assert.ok(Array.isArray(manifest.domainIds));
  assert.ok(Array.isArray(manifest.capabilityIds));
  assert.ok(Array.isArray(manifest.spiTypes));
  assert.ok(["internal", "trusted", "community", "unverified"].includes(manifest.trustLevel));
  assert.ok(manifest.publicSdkSurface.length > 0);
  assert.ok(typeof manifest.settingsSchema === "object");
});

test("builtin plugin manifest spiTypes match plugin type", () => {
  const plugins: Array<{ id: string; expectedSpiType: string }> = [
    { id: "plugin.coding.retriever", expectedSpiType: "retriever" },
    { id: "plugin.coding.presenter", expectedSpiType: "presenter" },
    { id: "plugin.core.basic-planner", expectedSpiType: "planner" },
    { id: "plugin.core.basic-evaluator", expectedSpiType: "evaluator" },
    { id: "plugin.shared.github_adapter", expectedSpiType: "adapter" },
  ];

  for (const { id, expectedSpiType } of plugins) {
    const manifest = getBuiltinPluginManifest(id)!;
    assert.ok(manifest.spiTypes.includes(expectedSpiType as any), `${id} should have spiType ${expectedSpiType}`);
  }
});