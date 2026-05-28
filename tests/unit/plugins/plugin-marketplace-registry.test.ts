import assert from "node:assert/strict";
import test from "node:test";

import {
  PluginMarketplaceRegistry,
  DynamicPluginLoader,
  getMarketplaceRegistry,
  propagateDataTaint,
  getDataTaintLabels,
  hasDataTaintLabel,
  revokePluginBundle,
  getPluginRevocationStatus,
  isPluginRevoked,
  listRevokedPlugins,
  removePluginRevocation,
  getPluginLifecycleState,
  setPluginLifecycleState,
  BundleRevocationSeverity,
} from "../../../src/plugins/builtin-plugin-registry.js";

test("PluginMarketplaceRegistry can be instantiated", () => {
  const registry = new PluginMarketplaceRegistry();
  assert.ok(registry !== undefined);
});

test("getMarketplaceRegistry returns singleton instance", () => {
  const instance1 = getMarketplaceRegistry();
  const instance2 = getMarketplaceRegistry();
  assert.ok(instance1 === instance2);
});

test("PluginMarketplaceRegistry.registerLoader registers a loader", () => {
  const registry = new PluginMarketplaceRegistry();
  const mockLoader: DynamicPluginLoader = {
    loadFromSource: async () => null,
    supportsSource: () => false,
  };
  assert.equal(registry.registerLoader("test", mockLoader), undefined);
  const loaders = (registry as unknown as { loaders: Map<string, DynamicPluginLoader> }).loaders;
  assert.equal(loaders.size, 1);
  assert.strictEqual(loaders.get("test"), mockLoader);
});

test("PluginMarketplaceRegistry.registerMarketplaceEntry adds entry", () => {
  const registry = new PluginMarketplaceRegistry();
  registry.registerMarketplaceEntry({
    pluginId: "test.plugin",
    name: "Test Plugin",
    version: "1.0.0",
    owner: "test-owner",
    trustLevel: "internal",
    source: "marketplace:test",
  });
  assert.ok(registry.hasMarketplacePlugin("test.plugin"));
});

test("PluginMarketplaceRegistry.getMarketplaceEntry returns entry", () => {
  const registry = new PluginMarketplaceRegistry();
  const entry = {
    pluginId: "test.plugin",
    name: "Test Plugin",
    version: "1.0.0",
    owner: "test-owner",
    trustLevel: "internal" as const,
    source: "marketplace:test",
  };
  registry.registerMarketplaceEntry(entry);
  const retrieved = registry.getMarketplaceEntry("test.plugin");
  assert.equal(retrieved?.pluginId, "test.plugin");
  assert.equal(retrieved?.name, "Test Plugin");
});

test("PluginMarketplaceRegistry.hasMarketplacePlugin returns false for unknown", () => {
  const registry = new PluginMarketplaceRegistry();
  assert.equal(registry.hasMarketplacePlugin("unknown.plugin"), false);
});

test("PluginMarketplaceRegistry.listMarketplacePlugins returns all entries", () => {
  const registry = new PluginMarketplaceRegistry();
  registry.registerMarketplaceEntry({
    pluginId: "plugin1",
    name: "Plugin 1",
    version: "1.0.0",
    owner: "owner1",
    trustLevel: "internal",
    source: "marketplace:1",
  });
  registry.registerMarketplaceEntry({
    pluginId: "plugin2",
    name: "Plugin 2",
    version: "1.0.0",
    owner: "owner2",
    trustLevel: "trusted",
    source: "marketplace:2",
  });
  const plugins = registry.listMarketplacePlugins();
  assert.equal(plugins.length, 2);
});

test("PluginMarketplaceRegistry.authenticate returns session token", async () => {
  const registry = new PluginMarketplaceRegistry();
  const token = await registry.authenticate("https://marketplace.example.com", {
    apiKey: "test-key",
  });
  assert.ok(typeof token === "string");
  assert.ok(token.startsWith("session_"));
});

test("PluginMarketplaceRegistry.isAuthenticated returns true for valid session", async () => {
  const registry = new PluginMarketplaceRegistry();
  const token = await registry.authenticate("https://marketplace.example.com", {
    apiKey: "test-key",
  });
  assert.equal(registry.isAuthenticated(token), true);
});

test("PluginMarketplaceRegistry.isAuthenticated returns false for invalid session", () => {
  const registry = new PluginMarketplaceRegistry();
  assert.equal(registry.isAuthenticated("invalid-token"), false);
});

test("PluginMarketplaceRegistry.loadPlugin returns null for unknown plugin", async () => {
  const registry = new PluginMarketplaceRegistry();
  const plugin = await registry.loadPlugin("unknown.plugin", "test-source");
  assert.equal(plugin, null);
});

test("PluginMarketplaceRegistry.loadPlugin throws when no loader found", async () => {
  const registry = new PluginMarketplaceRegistry();
  registry.registerMarketplaceEntry({
    pluginId: "test.plugin",
    name: "Test Plugin",
    version: "1.0.0",
    owner: "test-owner",
    trustLevel: "internal",
    source: "unknown-source",
  });

  await assert.rejects(
    async () => {
      await registry.loadPlugin("test.plugin", "unknown-source");
    },
    /No loader found/
  );
});

test("PluginMarketplaceRegistry.loadPlugin throws when auth required but not provided", async () => {
  const registry = new PluginMarketplaceRegistry();
  const mockLoader: DynamicPluginLoader = {
    loadFromSource: async () => null,
    supportsSource: (source) => source.startsWith("marketplace:"),
  };
  registry.registerLoader("marketplace", mockLoader);
  registry.registerMarketplaceEntry({
    pluginId: "test.plugin",
    name: "Test Plugin",
    version: "1.0.0",
    owner: "test-owner",
    trustLevel: "verified",
    source: "marketplace:test",
  });

  // Pass an invalid auth token to trigger the auth check failure
  await assert.rejects(
    async () => {
      await registry.loadPlugin("test.plugin", "marketplace:test", "invalid-token");
    },
    /Authentication required/
  );
});

test("DynamicPluginLoader interface implementation works", async () => {
  const registry = new PluginMarketplaceRegistry();
  let loadCalled = false;
  const mockLoader: DynamicPluginLoader = {
    loadFromSource: async (source, auth) => {
      loadCalled = true;
      return null;
    },
    supportsSource: (source) => source.startsWith("mock:"),
  };
  registry.registerLoader("mock", mockLoader);
  registry.registerMarketplaceEntry({
    pluginId: "mock.plugin",
    name: "Mock Plugin",
    version: "1.0.0",
    owner: "test",
    trustLevel: "internal",
    source: "mock:test",
  });
  await registry.loadPlugin("mock.plugin", "mock:test");
  assert.ok(loadCalled);
});
