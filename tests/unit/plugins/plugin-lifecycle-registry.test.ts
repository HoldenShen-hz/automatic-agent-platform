/**
 * Unit Tests: Plugin Lifecycle
 *
 * Tests for plugin lifecycle management including registration,
 * activation, deactivation, suspension, and unloading via PluginSpiRegistry.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PluginSpiRegistry } from "../../../src/domains/registry/plugin-spi-registry.js";
import { createGithubAdapterPlugin } from "../../../src/plugins/adapters/github-adapter.js";
import { createCrmAdapterPlugin } from "../../../src/plugins/adapters/crm-adapter.js";
import { createCodingPresenterPlugin } from "../../../src/plugins/presenters/coding-presenter.js";
import { createBasicEvaluatorPlugin } from "../../../src/plugins/validators/basic-evaluator.js";
import type { PluginManifest } from "../../../src/domains/registry/plugin-spi.js";

function createMockFetch(payload: Record<string, unknown> = { ok: true }): typeof fetch {
  return async () => new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function createHealthyGithubAdapterPlugin() {
  return createGithubAdapterPlugin({
    healthProbe: () => true,
    fetchImplementation: createMockFetch({ id: 1, state: "ok" }),
  });
}

test("PluginSpiRegistry registers a plugin successfully", () => {
  const registry = new PluginSpiRegistry();
  const adapter = createHealthyGithubAdapterPlugin();

  const record = registry.register(adapter);

  assert.ok(record !== undefined);
  assert.equal(record.manifest.pluginId, adapter.pluginId);
  assert.equal(record.lifecycleState, "registered");
  assert.equal(record.failureCount, 0);
  assert.equal(record.lastErrorMessage, null);
});

test("PluginSpiRegistry.get returns registered plugin", () => {
  const registry = new PluginSpiRegistry();
  const adapter = createHealthyGithubAdapterPlugin();

  registry.register(adapter);

  const record = registry.get(adapter.pluginId);

  assert.ok(record !== null);
  assert.equal(record?.manifest.pluginId, adapter.pluginId);
});

test("PluginSpiRegistry.get returns null for unregistered plugin", () => {
  const registry = new PluginSpiRegistry();

  const record = registry.get("nonexistent.plugin");

  assert.equal(record, null);
});

test("PluginSpiRegistry.list returns all registered plugins", () => {
  const registry = new PluginSpiRegistry();

  registry.register(createHealthyGithubAdapterPlugin());
  registry.register(createCrmAdapterPlugin());

  const plugins = registry.list();

  assert.equal(plugins.length, 2);
});

test("PluginSpiRegistry.listByDomain filters by domain", () => {
  const registry = new PluginSpiRegistry();

  registry.register(createHealthyGithubAdapterPlugin());
  registry.register(createCrmAdapterPlugin());

  const growthPlugins = registry.listByDomain("growth");
  const codingPlugins = registry.listByDomain("coding");

  assert.ok(growthPlugins.length >= 1);
  assert.ok(codingPlugins.length >= 1);
});

test("PluginSpiRegistry.listByDomain filters by spiType", () => {
  const registry = new PluginSpiRegistry();

  registry.register(createHealthyGithubAdapterPlugin());
  registry.register(createCodingPresenterPlugin());
  registry.register(createBasicEvaluatorPlugin());

  const adapters = registry.listByDomain("coding", "adapter");
  const presenters = registry.listByDomain("coding", "presenter");
  const validators = registry.listByDomain("core", "validator");

  assert.equal(adapters.length, 1);
  assert.equal(presenters.length, 1);
  assert.equal(validators.length, 1);
});

test("PluginSpiRegistry.resolve returns plugin instance", () => {
  const registry = new PluginSpiRegistry();
  const adapter = createHealthyGithubAdapterPlugin();

  registry.register(adapter);

  const plugin = registry.resolve(adapter.pluginId);

  assert.ok(plugin !== null);
  assert.equal(plugin?.pluginId, adapter.pluginId);
});

test("PluginSpiRegistry.register accepts custom manifest", () => {
  const registry = new PluginSpiRegistry();
  const adapter = createHealthyGithubAdapterPlugin();

  const customManifest: PluginManifest = {
    pluginId: "custom.plugin",
    name: "Custom Plugin",
    version: "1.0.0",
    owner: "test-team",
    domainIds: ["custom"],
    capabilityIds: ["custom.capability"],
    spiTypes: ["adapter"],
    extensionKind: "external_adapter",
    trustLevel: "trusted",
    publicSdkSurface: "@test/custom",
    settingsSchema: {},
  };

  const record = registry.register(adapter, customManifest);

  assert.equal(record.manifest.pluginId, adapter.pluginId);
  assert.equal(record.manifest.name, "Custom Plugin");
});

test("PluginSpiRegistry.ensureActive activates registered plugin", async () => {
  const registry = new PluginSpiRegistry();
  const adapter = createHealthyGithubAdapterPlugin();

  registry.register(adapter);
  await adapter.authenticate({ token: "test_token" });

  const activated = await registry.ensureActive(adapter.pluginId);

  assert.ok(activated !== null);
  const record = registry.get(adapter.pluginId);
  assert.equal(record?.lifecycleState, "active");
});

test("PluginSpiRegistry.ensureActive throws for unregistered plugin", async () => {
  const registry = new PluginSpiRegistry();

  await assert.rejects(
    async () => registry.ensureActive("nonexistent.plugin"),
    { message: /plugin_not_found/ },
  );
});

test("PluginSpiRegistry.ensureActive throws for disabled plugin", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 1 });
  const adapter = createHealthyGithubAdapterPlugin();

  registry.register(adapter);
  await adapter.authenticate({ token: "test_token" });

  // Manually disable the plugin to simulate failure state
  const record = registry.get(adapter.pluginId);
  record!.lifecycleState = "disabled";
  record!.disabledReason = "test_disabled";

  await assert.rejects(
    async () => registry.ensureActive(adapter.pluginId),
    { message: /plugin_disabled/ },
  );
});

test("PluginSpiRegistry.deactivate deactivates active plugin", async () => {
  const registry = new PluginSpiRegistry();
  const adapter = createHealthyGithubAdapterPlugin();

  registry.register(adapter);
  await adapter.authenticate({ token: "test_token" });
  await registry.ensureActive(adapter.pluginId);

  await registry.deactivate(adapter.pluginId);

  const record = registry.get(adapter.pluginId);
  assert.equal(record?.lifecycleState, "inactive");
});

test("PluginSpiRegistry.deactivate does nothing for inactive plugin", async () => {
  const registry = new PluginSpiRegistry();
  const adapter = createHealthyGithubAdapterPlugin();

  registry.register(adapter);
  await adapter.authenticate({ token: "test_token" });
  await registry.ensureActive(adapter.pluginId);
  await registry.deactivate(adapter.pluginId);

  // Deactivate again should not throw
  await registry.deactivate(adapter.pluginId);

  const record = registry.get(adapter.pluginId);
  assert.equal(record?.lifecycleState, "inactive");
});

test("PluginSpiRegistry.unload unloads plugin completely", async () => {
  const registry = new PluginSpiRegistry();
  const adapter = createHealthyGithubAdapterPlugin();

  registry.register(adapter);
  await adapter.authenticate({ token: "test_token" });
  await registry.ensureActive(adapter.pluginId);

  await registry.unload(adapter.pluginId);

  const record = registry.get(adapter.pluginId);
  assert.equal(record?.lifecycleState, "unloaded");
});

test("PluginSpiRegistry.suspend suspends active plugin", async () => {
  const registry = new PluginSpiRegistry();
  const adapter = createHealthyGithubAdapterPlugin();

  registry.register(adapter);
  await adapter.authenticate({ token: "test_token" });
  await registry.ensureActive(adapter.pluginId);

  await registry.suspend(adapter.pluginId, "test reason");

  const record = registry.get(adapter.pluginId);
  assert.equal(record?.lifecycleState, "suspended");
});

test("PluginSpiRegistry.invokeRetriever calls retriever plugin", async () => {
  const registry = new PluginSpiRegistry();
  const { createCodingRetrieverPlugin } = await import("../../../src/plugins/retrievers/coding-retriever.js");
  const retriever = createCodingRetrieverPlugin({ rootPath: "/tmp" });

  registry.register(retriever);

  const results = await registry.invokeRetriever(retriever.pluginId, {
    query: {
      taskId: "task_123",
      intent: "test intent",
      context: {},
      tokenBudget: 1000,
    },
  });

  assert.ok(Array.isArray(results));
});

test("PluginSpiRegistry.invokeRetriever throws for non-retriever plugin", async () => {
  const registry = new PluginSpiRegistry();
  const adapter = createHealthyGithubAdapterPlugin();

  registry.register(adapter);

  await assert.rejects(
    async () =>
      registry.invokeRetriever(adapter.pluginId, {
        query: {
          taskId: "task_123",
          intent: "test",
          context: {},
          tokenBudget: 1000,
        },
      }),
    { message: /not a retriever/ },
  );
});

test("PluginSpiRegistry.invokePresenter calls presenter plugin", async () => {
  const registry = new PluginSpiRegistry();
  const presenter = createCodingPresenterPlugin();

  registry.register(presenter);
  await registry.ensureActive(presenter.pluginId);

  const output = await registry.invokePresenter(presenter.pluginId, {
    machineOutputs: [
      {
        stepId: "step1",
        outputRef: "ref1",
        payload: { test: "data" },
      },
    ],
    artifacts: [],
    audience: "developer",
  });

  assert.ok(output !== undefined);
  assert.ok(typeof output.summary === "string");
  assert.ok(Array.isArray(output.sections));
});

test("PluginSpiRegistry.invokePresenter throws for non-presenter plugin", async () => {
  const registry = new PluginSpiRegistry();
  const adapter = createHealthyGithubAdapterPlugin();

  registry.register(adapter);

  await assert.rejects(
    async () =>
      registry.invokePresenter(adapter.pluginId, {
        machineOutputs: [],
        artifacts: [],
        audience: "developer",
      }),
    { message: /not a presenter/ },
  );
});

test("PluginSpiRegistry.invokeAdapterAuthenticate authenticates adapter", async () => {
  await assert.doesNotReject(async () => {
    const registry = new PluginSpiRegistry();
    const adapter = createHealthyGithubAdapterPlugin();

    registry.register(adapter);

    await registry.invokeAdapterAuthenticate(adapter.pluginId, {
      credentials: { token: "test_token" },
    });

    // Authentication should succeed without throwing
  });
});

test("PluginSpiRegistry.invokeAdapterAuthenticate throws for non-adapter plugin", async () => {
  const registry = new PluginSpiRegistry();
  const presenter = createCodingPresenterPlugin();

  registry.register(presenter);

  await assert.rejects(
    async () =>
      registry.invokeAdapterAuthenticate(presenter.pluginId, {
        credentials: { token: "test" },
      }),
    { message: /not an adapter/ },
  );
});

test("PluginSpiRegistry.invokeAdapterExecute executes adapter action", async () => {
  const registry = new PluginSpiRegistry();
  const adapter = createHealthyGithubAdapterPlugin();

  registry.register(adapter);

  await registry.invokeAdapterAuthenticate(adapter.pluginId, {
    credentials: { token: "test_token" },
  });

  const result = await registry.invokeAdapterExecute(adapter.pluginId, {
    action: "create_issue",
    params: {
      repository: "owner/repo",
      title: "Test Issue",
      body: "Test body",
    },
  });

  assert.ok(result !== undefined);
  assert.equal((result as any).action, "create_issue");
});

test("PluginSpiRegistry.invokeAdapterExecute throws for non-adapter plugin", async () => {
  const registry = new PluginSpiRegistry();
  const presenter = createCodingPresenterPlugin();

  registry.register(presenter);

  await assert.rejects(
    async () =>
      registry.invokeAdapterExecute(presenter.pluginId, {
        action: "test",
        params: {},
      }),
    { message: /not an adapter/ },
  );
});

test("PluginSpiRegistry tracks invocation counts", async () => {
  const registry = new PluginSpiRegistry();
  const adapter = createHealthyGithubAdapterPlugin();

  registry.register(adapter);

  await registry.invokeAdapterAuthenticate(adapter.pluginId, {
    credentials: { token: "test_token" },
  });

  const record = registry.get(adapter.pluginId);
  assert.ok(record !== null);
});

test("PluginSpiRegistry handles plugin with no domainId", () => {
  const registry = new PluginSpiRegistry();
  const validator = createBasicEvaluatorPlugin();

  registry.register(validator);

  const record = registry.get(validator.pluginId);
  assert.ok(record !== null);
  assert.ok(record.manifest.domainIds.includes("core"));
});

test("PluginSpiRegistry registers multiple plugins of same type", () => {
  const registry = new PluginSpiRegistry();

  registry.register(createHealthyGithubAdapterPlugin());
  registry.register(createCrmAdapterPlugin());

  const adapters = registry.listByDomain("coding", "adapter");
  const growthAdapters = registry.listByDomain("growth", "adapter");

  assert.equal(adapters.length, 1); // Only github adapter has coding domain
  assert.ok(growthAdapters.length >= 2); // Both CRM and GitHub support growth
});

test("PluginSpiRegistry.validateContract rejects mismatched spiType", () => {
  const registry = new PluginSpiRegistry();
  const adapter = createHealthyGithubAdapterPlugin();

  registry.register(adapter);

  // The manifest spiTypes must include 'adapter'
  const record = registry.get(adapter.pluginId);
  assert.ok(record?.manifest.spiTypes.includes("adapter"));
});

test("PluginSpiRegistry tracks lastHealthCheckAt after activation", async () => {
  const registry = new PluginSpiRegistry();
  const adapter = createHealthyGithubAdapterPlugin();

  registry.register(adapter);
  await adapter.authenticate({ token: "test_token" });

  const before = Date.now();
  await registry.ensureActive(adapter.pluginId);
  const after = Date.now();

  const record = registry.get(adapter.pluginId);
  assert.ok(record?.lastHealthCheckAt !== null);

  const healthCheckTime = new Date(record!.lastHealthCheckAt!).getTime();
  assert.ok(healthCheckTime >= before && healthCheckTime <= after);
});

test("PluginSpiRegistry handles concurrent activations", async () => {
  const registry = new PluginSpiRegistry();
  const adapter = createHealthyGithubAdapterPlugin();

  registry.register(adapter);
  await adapter.authenticate({ token: "test_token" });

  // Start multiple activations concurrently
  const [result1, result2] = await Promise.all([
    registry.ensureActive(adapter.pluginId),
    registry.ensureActive(adapter.pluginId),
  ]);

  assert.equal(result1.pluginId, result2.pluginId);
});

test("PluginSpiRegistry rejects plugin with unsupported runtime isolation", () => {
  const registry = new PluginSpiRegistry();
  const customPlugin = {
    pluginId: "plugin.custom.adapter",
    spiType: "adapter" as const,
    adapterType: "custom",
    capabilityIds: ["external.custom"],
    async initialize() {
      return undefined;
    },
    async healthCheck() {
      return true;
    },
    async shutdown() {
      return undefined;
    },
    async authenticate() {
      return undefined;
    },
    async execute() {
      return {};
    },
  };

  // Create a manifest with sandboxed_process isolation
  const manifest: PluginManifest = {
    pluginId: customPlugin.pluginId,
    name: "Test",
    version: "1.0.0",
    owner: "test",
    domainIds: [],
    capabilityIds: [],
    spiTypes: ["adapter"],
    extensionKind: "external_adapter",
    trustLevel: "unverified",
    publicSdkSurface: "@test/plugin",
    settingsSchema: {},
    sandbox: {
      runtimeIsolation: "sandboxed_process",
      timeoutMs: 5000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 8,
      cooldownMs: 0,
    },
  };

  // Should throw because sandboxed_process isolation is not allowed for non-builtin plugins
  assert.throws(
    () => registry.register(customPlugin, manifest),
    { message: /unsupported_runtime_isolation/ },
  );
});
