import assert from "node:assert/strict";
import test from "node:test";

import { PluginSpiRegistry } from "../../../src/domains/registry/plugin-spi-registry.js";
import { PluginManifestSchema } from "../../../src/domains/registry/plugin-spi.js";
import type { RegisteredPlugin } from "../../../src/domains/registry/plugin-spi.js";

function makeMinimalPlugin(
  pluginId: string,
  spiType: "adapter" | "retriever" | "planner" | "presenter" | "validator" = "planner",
): RegisteredPlugin {
  const sharedHooks = {
    onLoad: async () => {},
    onActivate: async () => {},
    onDeactivate: async () => {},
    onUnload: async () => {},
    healthCheck: async () => true,
    capabilityIds: [],
  };

  switch (spiType) {
    case "adapter":
      return {
        pluginId,
        spiType,
        adapterType: "github",
        authenticate: async () => {},
        execute: async () => ({}),
        ...sharedHooks,
      };
    case "retriever":
      return {
        pluginId,
        spiType,
        domainId: "test-domain",
        retrieve: async () => [],
        ...sharedHooks,
      };
    case "validator":
      return {
        pluginId,
        spiType,
        domainId: "test-domain",
        validate: async () => ({
          valid: true,
          errors: [],
          suggestions: [],
        }),
        ...sharedHooks,
      };
    case "presenter":
      return {
        pluginId,
        spiType,
        domainId: "test-domain",
        formatOutput: async () => ({
          summary: "ok",
          sections: [],
          citations: [],
        }),
        ...sharedHooks,
      };
    case "planner":
    default:
      return {
        pluginId,
        spiType: "planner",
        domainId: "test-domain",
        suggestWorkflow: async () => null,
        ...sharedHooks,
      };
  }
}

test("PluginSpiRegistry.register stores plugin record", () => {
  const registry = new PluginSpiRegistry();
  const plugin = makeMinimalPlugin("plugin_alpha");

  const record = registry.register(plugin);

  assert.equal(record.manifest.pluginId, "plugin_alpha");
  assert.equal(record.lifecycleState, "registered");
  assert.equal(record.failureCount, 0);
});

test("PluginSpiRegistry.register includes spiType in manifest", () => {
  const registry = new PluginSpiRegistry();
  const plugin = makeMinimalPlugin("plugin_retriever", "retriever");

  const record = registry.register(plugin);

  assert.ok(record.manifest.spiTypes.includes("retriever"));
});

test("PluginSpiRegistry.get returns record for registered plugin", () => {
  const registry = new PluginSpiRegistry();
  registry.register(makeMinimalPlugin("plugin_beta"));

  const record = registry.get("plugin_beta");
  assert.notEqual(record, null);
  assert.equal(record!.manifest.pluginId, "plugin_beta");
});

test("PluginSpiRegistry.get returns null for unknown plugin", () => {
  const registry = new PluginSpiRegistry();
  assert.equal(registry.get("unknown_plugin"), null);
});

test("PluginSpiRegistry.list returns all registered plugins", () => {
  const registry = new PluginSpiRegistry();
  registry.register(makeMinimalPlugin("plugin_list_a"));
  registry.register(makeMinimalPlugin("plugin_list_b"));

  const listed = registry.list();
  assert.equal(listed.length, 2);
  assert.ok(listed.some((r) => r.manifest.pluginId === "plugin_list_a"));
  assert.ok(listed.some((r) => r.manifest.pluginId === "plugin_list_b"));
});

test("PluginSpiRegistry.listByDomain filters by domain", () => {
  const registry = new PluginSpiRegistry();
  const pluginA = makeMinimalPlugin("plugin_domain_a");
  (pluginA as { domainId?: string }).domainId = "domain_alpha";
  const pluginB = makeMinimalPlugin("plugin_domain_b");
  (pluginB as { domainId?: string }).domainId = "domain_beta";

  registry.register(pluginA);
  registry.register(pluginB);

  const domainAlphaPlugins = registry.listByDomain("domain_alpha");
  const domainBetaPlugins = registry.listByDomain("domain_beta");

  assert.equal(domainAlphaPlugins.length, 1);
  assert.equal(domainAlphaPlugins[0]!.manifest.pluginId, "plugin_domain_a");
  assert.equal(domainBetaPlugins.length, 1);
  assert.equal(domainBetaPlugins[0]!.manifest.pluginId, "plugin_domain_b");
});

test("PluginSpiRegistry.listByDomain filters by spiType", () => {
  const registry = new PluginSpiRegistry();
  registry.register(makeMinimalPlugin("retriever_plugin", "retriever"));
  registry.register(makeMinimalPlugin("planner_plugin", "planner"));

  const retrievers = registry.listByDomain("", "retriever");
  assert.equal(retrievers.length, 1);
  assert.equal(retrievers[0]!.manifest.pluginId, "retriever_plugin");
});

test("PluginSpiRegistry.resolve returns plugin from record", () => {
  const registry = new PluginSpiRegistry();
  const plugin = makeMinimalPlugin("resolve_plugin");
  registry.register(plugin);

  const resolved = registry.resolve("resolve_plugin");
  assert.notEqual(resolved, null);
  assert.equal(resolved!.pluginId, "resolve_plugin");
});

test("PluginSpiRegistry.resolve returns null for unregistered plugin", () => {
  const registry = new PluginSpiRegistry();
  assert.equal(registry.resolve("unregistered"), null);
});

test("PluginSpiRegistry.ensureActive transitions plugin to active state", async () => {
  const registry = new PluginSpiRegistry();
  const plugin = {
    ...makeMinimalPlugin("activate_plugin"),
    onLoad: async () => {},
    onActivate: async () => {},
    healthCheck: async () => true,
  };
  registry.register(plugin);

  const activated = await registry.ensureActive("activate_plugin");
  assert.notEqual(activated, null);
  assert.equal(activated.pluginId, "activate_plugin");
});

test("PluginSpiRegistry.ensureActive throws for non-existent plugin", async () => {
  const registry = new PluginSpiRegistry();

  await assert.rejects(async () => {
    await registry.ensureActive("nonexistent_plugin");
  }, /plugin_not_found|Plugin.*not registered|not.*registered/);
});

test("PluginSpiRegistry.deactivate transitions plugin to inactive state", async () => {
  const registry = new PluginSpiRegistry();
  const plugin = {
    ...makeMinimalPlugin("deactivate_plugin"),
    onLoad: async () => {},
    onActivate: async () => {},
    onDeactivate: async () => {},
    healthCheck: async () => true,
  };
  registry.register(plugin);
  await registry.ensureActive("deactivate_plugin");

  await registry.deactivate("deactivate_plugin");

  const record = registry.get("deactivate_plugin");
  assert.notEqual(record, null);
  assert.equal(record!.lifecycleState, "inactive");
});

test("PluginSpiRegistry.suspend transitions active plugin to suspended state", async () => {
  const registry = new PluginSpiRegistry();
  const plugin = {
    ...makeMinimalPlugin("suspend_plugin"),
    onLoad: async () => {},
    onActivate: async () => {},
    suspend: async (_reason: string) => {},
    healthCheck: async () => true,
  };
  registry.register(plugin);
  await registry.ensureActive("suspend_plugin");

  await registry.suspend("suspend_plugin", "testing suspension");

  const record = registry.get("suspend_plugin");
  assert.notEqual(record, null);
  assert.equal(record!.lifecycleState, "suspended");
});

test("PluginSpiRegistry.unload transitions plugin to unloaded state", async () => {
  const registry = new PluginSpiRegistry();
  const plugin = {
    ...makeMinimalPlugin("unload_plugin"),
    onLoad: async () => {},
    onActivate: async () => {},
    onUnload: async () => {},
    healthCheck: async () => true,
  };
  registry.register(plugin);
  await registry.ensureActive("unload_plugin");

  await registry.unload("unload_plugin");

  const record = registry.get("unload_plugin");
  assert.notEqual(record, null);
  assert.equal(record!.lifecycleState, "unloaded");
});

test("PluginSpiRegistry.invokeRetriever throws for non-retriever plugin", async () => {
  const registry = new PluginSpiRegistry();
  registry.register(makeMinimalPlugin("non_retriever", "planner"));

  await assert.rejects(async () => {
    await registry.invokeRetriever("non_retriever", {
      query: {
        taskId: "task_1",
        intent: "search",
        context: {},
        tokenBudget: 1000,
      },
    });
  }, /not a retriever/);
});

test("PluginSpiRegistry.invokePresenter throws for non-presenter plugin", async () => {
  const registry = new PluginSpiRegistry();
  registry.register(makeMinimalPlugin("non_presenter", "planner"));

  await assert.rejects(async () => {
    await registry.invokePresenter("non_presenter", {
      machineOutputs: [],
      artifacts: [],
      audience: "end_user",
    });
  }, /not a presenter/);
});

test("PluginSpiRegistry.invokeAdapterAuthenticate throws for non-adapter plugin", async () => {
  const registry = new PluginSpiRegistry();
  registry.register(makeMinimalPlugin("non_adapter", "planner"));

  await assert.rejects(async () => {
    await registry.invokeAdapterAuthenticate("non_adapter", {
      credentials: { apiKey: "secret" },
    });
  }, /not an adapter/);
});

test("PluginSpiRegistry.invokeAdapterExecute throws for non-adapter plugin", async () => {
  const registry = new PluginSpiRegistry();
  registry.register(makeMinimalPlugin("non_adapter_exec", "planner"));

  await assert.rejects(async () => {
    await registry.invokeAdapterExecute("non_adapter_exec", {
      action: "execute",
      params: {},
    });
  }, /not an adapter/);
});

test("PluginSpiRegistry.deactivate handles non-active plugin gracefully", async () => {
  const registry = new PluginSpiRegistry();
  registry.register(makeMinimalPlugin("inactive_plugin"));

  await registry.deactivate("inactive_plugin");
  // Should not throw
});

test("PluginSpiRegistry.suspend handles non-active plugin gracefully", async () => {
  const registry = new PluginSpiRegistry();
  registry.register(makeMinimalPlugin("suspend_inactive_plugin"));

  await registry.suspend("suspend_inactive_plugin", "reason");
  // Should not throw
});
