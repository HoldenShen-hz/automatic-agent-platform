/**
 * @fileoverview Integration tests for plugin execution harness
 *
 * Tests the PluginSpiRegistry's invocation methods and harness behavior
 * including retriever invocation, presenter formatting, adapter operations,
 * and concurrent execution scenarios.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { PluginSpiRegistry } from "../../../src/domains/registry/plugin-spi-registry.js";
import { createBuiltinPlugin } from "../../../src/plugins/builtin-plugin-registry.js";

test("PluginHarness: invokeRetriever calls plugin retrieve method", async () => {
  const registry = new PluginSpiRegistry();

  const workspace = mkdtempSync(join(tmpdir(), "aa-harness-retriever-"));
  try {
    mkdirSync(join(workspace, "src"), { recursive: true });
    writeFileSync(join(workspace, "src", "main.ts"), "export const VERSION = '1.0.0';\n", "utf8");

    const retriever = createBuiltinPlugin("plugin.coding.retriever")!;
    registry.register(retriever);

    const results = await registry.invokeRetriever("plugin.coding.retriever", {
      query: {
        taskId: "task_harness_1",
        intent: "VERSION constant",
        context: { workspaceRoot: workspace },
        tokenBudget: 1000,
      },
    });

    assert.ok(Array.isArray(results));
    // Results may be empty or contain knowledge references
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("PluginHarness: invokePresenter formats machine outputs", async () => {
  const registry = new PluginSpiRegistry();

  const presenter = createBuiltinPlugin("plugin.coding.presenter")!;
  registry.register(presenter);

  await registry.ensureActive("plugin.coding.presenter");

  const output = await registry.invokePresenter("plugin.coding.presenter", {
    machineOutputs: [
      {
        stepId: "build",
        outputRef: "artifact:build",
        payload: { files: ["dist/index.js"], errors: [] },
      },
      {
        stepId: "test",
        outputRef: "artifact:test",
        payload: { passed: 10, failed: 0 },
      },
    ],
    artifacts: ["artifact:build", "artifact:test"],
    audience: "developer",
  });

  assert.ok(output.summary.includes("build") || output.summary.includes("test"));
  assert.ok(output.sections.length > 0);
  assert.ok(output.citations.includes("artifact:build"));
  assert.ok(output.citations.includes("artifact:test"));
});

test("PluginHarness: invokeAdapterAuthenticate sets up adapter credentials", async () => {
  const registry = new PluginSpiRegistry();

  const adapter = createBuiltinPlugin("plugin.shared.github_adapter")!;
  registry.register(adapter, {
    pluginId: "plugin.shared.github_adapter",
    name: "GitHub",
    version: "1.0.0",
    owner: "test",
    domainIds: [],
    capabilityIds: [],
    spiTypes: ["adapter"],
    extensionKind: "external_adapter",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 5000,
      allowFilesystemWrite: false,
      allowNetworkEgress: true,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
    },
  });

  await registry.ensureActive("plugin.shared.github_adapter");
  await registry.invokeAdapterAuthenticate("plugin.shared.github_adapter", {
    credentials: { token: "ghp_test_token_harness" },
  });

  // Authentication should not throw
  assert.ok(true);
});

test("PluginHarness: invokeAdapterExecute performs adapter action", async () => {
  const registry = new PluginSpiRegistry();

  const adapter = createBuiltinPlugin("plugin.shared.github_adapter")!;
  registry.register(adapter, {
    pluginId: "plugin.shared.github_adapter",
    name: "GitHub",
    version: "1.0.0",
    owner: "test",
    domainIds: [],
    capabilityIds: [],
    spiTypes: ["adapter"],
    extensionKind: "external_adapter",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 5000,
      allowFilesystemWrite: false,
      allowNetworkEgress: true,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
    },
  });

  await registry.ensureActive("plugin.shared.github_adapter");
  await registry.invokeAdapterAuthenticate("plugin.shared.github_adapter", {
    credentials: { token: "ghp_test_token" },
  });

  const result = await registry.invokeAdapterExecute("plugin.shared.github_adapter", {
    action: "create_issue",
    params: {
      repository: "test/harness-repo",
      title: "Harness test issue",
      body: "Testing plugin harness",
      labels: ["test"],
    },
  });

  assert.ok(result.endpoint.includes("/repos/test/harness-repo/issues"));
  assert.equal(result.payload.title, "Harness test issue");
});

test("PluginHarness: concurrent plugin activation is supported", async () => {
  const registry = new PluginSpiRegistry();

  registry.register(createBuiltinPlugin("plugin.coding.retriever")!);
  registry.register(createBuiltinPlugin("plugin.coding.presenter")!);
  registry.register(createBuiltinPlugin("plugin.core.basic-planner")!);

  // Activate multiple plugins concurrently
  const [retriever, presenter, planner] = await Promise.all([
    registry.ensureActive("plugin.coding.retriever"),
    registry.ensureActive("plugin.coding.presenter"),
    registry.ensureActive("plugin.core.basic-planner"),
  ]);

  assert.ok(retriever !== null);
  assert.ok(presenter !== null);
  assert.ok(planner !== null);
});

test("PluginHarness: plugin activation is idempotent", async () => {
  const registry = new PluginSpiRegistry();

  const retriever = createBuiltinPlugin("plugin.coding.retriever")!;
  registry.register(retriever);

  // Activate multiple times
  const first = await registry.ensureActive("plugin.coding.retriever");
  const second = await registry.ensureActive("plugin.coding.retriever");
  const third = await registry.ensureActive("plugin.coding.retriever");

  // All should return the same plugin instance
  assert.equal(first, second);
  assert.equal(second, third);
});

test("PluginHarness: plugin lifecycle transitions are tracked", async () => {
  const registry = new PluginSpiRegistry();

  const plugin = createBuiltinPlugin("plugin.core.basic-planner")!;
  registry.register(plugin);

  // Check initial state
  let record = registry.get(plugin.pluginId)!;
  assert.equal(record.lifecycleState, "registered");
  assert.equal(record.failureCount, 0);

  // Activate
  await registry.ensureActive(plugin.pluginId);
  record = registry.get(plugin.pluginId)!;
  assert.equal(record.lifecycleState, "active");

  // Deactivate
  await registry.deactivate(plugin.pluginId);
  record = registry.get(plugin.pluginId)!;
  assert.equal(record.lifecycleState, "inactive");
});

test("PluginHarness: deactivated plugin can be reactivated", async () => {
  const registry = new PluginSpiRegistry();

  const plugin = createBuiltinPlugin("plugin.core.basic-evaluator")!;
  registry.register(plugin);

  await registry.ensureActive(plugin.pluginId);
  await registry.deactivate(plugin.pluginId);

  const reactivated = await registry.ensureActive(plugin.pluginId);
  assert.ok(reactivated !== null);

  const record = registry.get(plugin.pluginId)!;
  assert.equal(record.lifecycleState, "active");
});

test("PluginHarness: unload removes plugin from active state", async () => {
  const registry = new PluginSpiRegistry();

  const plugin = createBuiltinPlugin("plugin.core.basic-planner")!;
  registry.register(plugin);

  await registry.ensureActive(plugin.pluginId);
  await registry.unload(plugin.pluginId);

  const record = registry.get(plugin.pluginId)!;
  assert.equal(record.lifecycleState, "unloaded");
});

test("PluginHarness: operations retriever can be invoked", async () => {
  const registry = new PluginSpiRegistry();

  const retriever = createBuiltinPlugin("plugin.operations.retriever")!;
  registry.register(retriever);

  const results = await registry.invokeRetriever("plugin.operations.retriever", {
    query: {
      taskId: "task_ops_harness",
      intent: "incident runbook",
      context: {},
      tokenBudget: 1000,
    },
  });

  assert.ok(Array.isArray(results));
});

test("PluginHarness: growth plugins work together (retriever + presenter)", async () => {
  const registry = new PluginSpiRegistry();

  const retriever = createBuiltinPlugin("plugin.growth.retriever")!;
  const presenter = createBuiltinPlugin("plugin.growth.presenter")!;

  registry.register(retriever);
  registry.register(presenter);

  // Retrieve
  const retrievalResults = await registry.invokeRetriever("plugin.growth.retriever", {
    query: {
      taskId: "task_growth_harness",
      intent: "campaign performance",
      context: {},
      tokenBudget: 1500,
    },
  });

  assert.ok(Array.isArray(retrievalResults));

  // Present
  await registry.ensureActive("plugin.growth.presenter");

  const output = await registry.invokePresenter("plugin.growth.presenter", {
    machineOutputs: [
      {
        stepId: "analyze",
        outputRef: null,
        payload: { type: "campaign", campaignName: "Test Campaign" },
      },
    ],
    artifacts: [],
    audience: "end_user",
  });

  assert.ok(output.summary.length > 0);
});

test("PluginHarness: multiple domain plugins can coexist", async () => {
  const registry = new PluginSpiRegistry();

  registry.register(createBuiltinPlugin("plugin.coding.retriever")!);
  registry.register(createBuiltinPlugin("plugin.operations.retriever")!);
  registry.register(createBuiltinPlugin("plugin.growth.retriever")!);
  registry.register(createBuiltinPlugin("plugin.gamedev.retriever")!);

  const plugins = registry.list();
  assert.ok(plugins.length >= 4);

  // All should be in registered state initially
  for (const p of plugins) {
    assert.equal(p.lifecycleState, "registered");
  }
});

test("PluginHarness: plugin invocation records lastInvocation timestamps", async () => {
  const registry = new PluginSpiRegistry();

  const plugin = createBuiltinPlugin("plugin.core.basic-planner")!;
  registry.register(plugin);

  await registry.ensureActive(plugin.pluginId);

  // Trigger an invocation by calling ensureActive again (which goes through execution path)
  await registry.ensureActive(plugin.pluginId);

  const record = registry.get(plugin.pluginId)!;
  assert.ok(record.lastInvocationStartedAt !== null || record.lastInvocationCompletedAt !== null);
});

test("PluginHarness: resolve returns plugin instance", () => {
  const registry = new PluginSpiRegistry();

  const plugin = createBuiltinPlugin("plugin.core.basic-evaluator")!;
  registry.register(plugin);

  const resolved = registry.resolve(plugin.pluginId);
  assert.ok(resolved !== null);
  assert.equal(resolved!.pluginId, plugin.pluginId);
});

test("PluginHarness: resolve returns null for unknown plugin", () => {
  const registry = new PluginSpiRegistry();

  const resolved = registry.resolve("nonexistent.plugin");
  assert.equal(resolved, null);
});

test("PluginHarness: listByDomain filters plugins by domain", () => {
  const registry = new PluginSpiRegistry();

  registry.register(createBuiltinPlugin("plugin.coding.retriever")!);
  registry.register(createBuiltinPlugin("plugin.coding.presenter")!);
  registry.register(createBuiltinPlugin("plugin.operations.retriever")!);
  registry.register(createBuiltinPlugin("plugin.growth.retriever")!);

  const codingPlugins = registry.listByDomain("coding");
  assert.ok(codingPlugins.length >= 2);

  const opsPlugins = registry.listByDomain("operations");
  assert.ok(opsPlugins.length >= 1);

  const growthPlugins = registry.listByDomain("growth");
  assert.ok(growthPlugins.length >= 1);
});

test("PluginHarness: listByDomain with spiType filter", () => {
  const registry = new PluginSpiRegistry();

  registry.register(createBuiltinPlugin("plugin.coding.retriever")!);
  registry.register(createBuiltinPlugin("plugin.coding.presenter")!);

  const retrievers = registry.listByDomain("coding", "retriever");
  assert.ok(retrievers.length >= 1);
  assert.equal(retrievers[0]!.manifest.spiTypes[0], "retriever");

  const presenters = registry.listByDomain("coding", "presenter");
  assert.ok(presenters.length >= 1);
  assert.equal(presenters[0]!.manifest.spiTypes[0], "presenter");
});

test("PluginHarness: unknown plugin invocation throws meaningful error", async () => {
  const registry = new PluginSpiRegistry();

  await assert.rejects(
    async () => registry.invokeRetriever("plugin.does.not.exist", {
      query: { taskId: "t", intent: "i", context: {}, tokenBudget: 1000 },
    }),
    /not found/i,
  );
});