import assert from "node:assert/strict";
import test from "node:test";

import { PluginSpiRegistry } from "../../../../src/domains/registry/plugin-spi-registry.js";
import type { PluginSandboxPolicy, PluginLifecycleContext } from "../../../../src/domains/registry/plugin-spi.js";

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

// ─────────────────────────────────────────────────────────────────────────────
// Plugin Lifecycle: Suspend and Resume
// Contract §4: suspended plugins may be resumed without full reload
// ─────────────────────────────────────────────────────────────────────────────

test("PluginSpiRegistry suspend transitions active plugin to suspended state", async () => {
  const events: string[] = [];
  const registry = new PluginSpiRegistry({
    eventPublisher: {
      publish(input) {
        events.push(input.eventType);
      },
    },
  });

  registry.register({
    pluginId: "plugin.suspend.test",
    domainId: "test",
    spiType: "tool",
    async execute() {
      return { success: true, output: "ok" };
    },
    async onDeactivate() {
      events.push("deactivate_hook");
    },
  }, {
    pluginId: "plugin.suspend.test",
    name: "suspend test",
    version: "1.0.0",
    owner: "test",
    domainIds: ["test"],
    capabilityIds: [],
    spiTypes: ["tool"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  await registry.ensureActive("plugin.suspend.test");
  assert.equal(registry.get("plugin.suspend.test")?.lifecycleState, "active");

  await registry.suspend("plugin.suspend.test", "testing suspend");
  assert.equal(registry.get("plugin.suspend.test")?.lifecycleState, "suspended");
  assert.ok(events.includes("plugin:suspended"));
});

test("PluginSpiRegistry suspend transitions inactive plugin to suspended state", async () => {
  const registry = new PluginSpiRegistry();

  registry.register({
    pluginId: "plugin.suspend.inactive",
    domainId: "test",
    spiType: "tool",
    async execute() {
      return { success: true, output: "ok" };
    },
  }, {
    pluginId: "plugin.suspend.inactive",
    name: "suspend inactive",
    version: "1.0.0",
    owner: "test",
    domainIds: ["test"],
    capabilityIds: [],
    spiTypes: ["tool"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  await registry.ensureActive("plugin.suspend.inactive");
  await registry.deactivate("plugin.suspend.inactive");
  assert.equal(registry.get("plugin.suspend.inactive")?.lifecycleState, "inactive");

  await registry.suspend("plugin.suspend.inactive", "testing suspend from inactive");
  assert.equal(registry.get("plugin.suspend.inactive")?.lifecycleState, "suspended");
});

test("PluginSpiRegistry suspend does nothing for registered plugin", async () => {
  const registry = new PluginSpiRegistry();

  registry.register({
    pluginId: "plugin.suspend.registered",
    domainId: "test",
    spiType: "tool",
    async execute() {
      return { success: true, output: "ok" };
    },
  }, {
    pluginId: "plugin.suspend.registered",
    name: "suspend registered",
    version: "1.0.0",
    owner: "test",
    domainIds: ["test"],
    capabilityIds: [],
    spiTypes: ["tool"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  // Not activated yet - should do nothing
  await registry.suspend("plugin.suspend.registered", "testing");
  assert.equal(registry.get("plugin.suspend.registered")?.lifecycleState, "registered");
});

test("PluginSpiRegistry suspend does nothing for disabled plugin", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 1 });

  registry.register({
    pluginId: "plugin.suspend.disabled",
    domainId: "test",
    spiType: "retriever",
    async retrieve() {
      throw new Error("boom");
    },
  }, {
    pluginId: "plugin.suspend.disabled",
    name: "suspend disabled",
    version: "1.0.0",
    owner: "test",
    domainIds: ["test"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  await registry.ensureActive("plugin.suspend.disabled");
  // Trigger failures to disable
  await assert.rejects(() =>
    registry.invokeRetriever("plugin.suspend.disabled", {
      query: { taskId: "t1", intent: "test", context: {}, tokenBudget: 100 },
    }),
  );
  await assert.rejects(() =>
    registry.invokeRetriever("plugin.suspend.disabled", {
      query: { taskId: "t2", intent: "test", context: {}, tokenBudget: 100 },
    }),
  );
  assert.equal(registry.get("plugin.suspend.disabled")?.lifecycleState, "disabled");

  // Suspend should do nothing for disabled plugins
  await registry.suspend("plugin.suspend.disabled", "testing");
  assert.equal(registry.get("plugin.suspend.disabled")?.lifecycleState, "disabled");
});

test("PluginSpiRegistry ensureActive returns suspended plugin without error", async () => {
  const lifecycle: string[] = [];
  const registry = new PluginSpiRegistry();

  registry.register({
    pluginId: "plugin.ensureactive.suspended",
    domainId: "test",
    spiType: "tool",
    capabilityIds: ["cap1"],
    async execute() {
      return { success: true, output: "ok" };
    },
  }, {
    pluginId: "plugin.ensureactive.suspended",
    name: "ensure active suspended",
    version: "1.0.0",
    owner: "test",
    domainIds: ["test"],
    capabilityIds: ["cap1"],
    spiTypes: ["tool"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  await registry.ensureActive("plugin.ensureactive.suspended");
  await registry.suspend("plugin.ensureactive.suspended", "testing");

  // ensureActive on suspended plugin should return the plugin (not throw)
  const plugin = await registry.ensureActive("plugin.ensureactive.suspended", { capabilityIds: ["cap1"] });
  assert.ok(plugin);
  assert.equal(plugin?.pluginId, "plugin.ensureactive.suspended");
});

test("PluginSpiRegistry suspend calls plugin suspend hook when defined", async () => {
  const suspendCalled: string[] = [];
  const registry = new PluginSpiRegistry();

  registry.register({
    pluginId: "plugin.suspend.hook",
    domainId: "test",
    spiType: "tool",
    async execute() {
      return { success: true, output: "ok" };
    },
    async suspend(reason: string) {
      suspendCalled.push(reason);
    },
  }, {
    pluginId: "plugin.suspend.hook",
    name: "suspend hook",
    version: "1.0.0",
    owner: "test",
    domainIds: ["test"],
    capabilityIds: [],
    spiTypes: ["tool"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  await registry.ensureActive("plugin.suspend.hook");
  await registry.suspend("plugin.suspend.hook", "suspend reason");

  assert.deepEqual(suspendCalled, ["suspend reason"]);
});

test("PluginSpiRegistry deactivated plugin can be suspended", async () => {
  const registry = new PluginSpiRegistry();

  registry.register({
    pluginId: "plugin.deactivate.suspend",
    domainId: "test",
    spiType: "tool",
    async execute() {
      return { success: true, output: "ok" };
    },
  }, {
    pluginId: "plugin.deactivate.suspend",
    name: "deactivate suspend",
    version: "1.0.0",
    owner: "test",
    domainIds: ["test"],
    capabilityIds: [],
    spiTypes: ["tool"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  await registry.ensureActive("plugin.deactivate.suspend");
  await registry.deactivate("plugin.deactivate.suspend");
  assert.equal(registry.get("plugin.deactivate.suspend")?.lifecycleState, "inactive");

  await registry.suspend("plugin.deactivate.suspend", "testing");
  assert.equal(registry.get("plugin.deactivate.suspend")?.lifecycleState, "suspended");
});

// ─────────────────────────────────────────────────────────────────────────────
// Plugin List and Filter Operations
// ─────────────────────────────────────────────────────────────────────────────

test("PluginSpiRegistry listByDomain filters by spiType", () => {
  const registry = new PluginSpiRegistry();

  registry.register({
    pluginId: "plugin.list.retriever",
    domainId: "domain1",
    spiType: "retriever",
    async retrieve() {
      return [];
    },
  }, {
    pluginId: "plugin.list.retriever",
    name: "list retriever",
    version: "1.0.0",
    owner: "test",
    domainIds: ["domain1"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  registry.register({
    pluginId: "plugin.list.tool",
    domainId: "domain1",
    spiType: "tool",
    async execute() {
      return { success: true, output: "ok" };
    },
  }, {
    pluginId: "plugin.list.tool",
    name: "list tool",
    version: "1.0.0",
    owner: "test",
    domainIds: ["domain1"],
    capabilityIds: [],
    spiTypes: ["tool"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  const retrieverOnly = registry.listByDomain("domain1", "retriever");
  assert.equal(retrieverOnly.length, 1);
  assert.equal(retrieverOnly[0]?.manifest.pluginId, "plugin.list.retriever");

  const toolOnly = registry.listByDomain("domain1", "tool");
  assert.equal(toolOnly.length, 1);
  assert.equal(toolOnly[0]?.manifest.pluginId, "plugin.list.tool");

  const all = registry.listByDomain("domain1");
  assert.equal(all.length, 2);
});

test("PluginSpiRegistry listByDomain returns plugins without domain restriction when domainIds is empty", () => {
  const registry = new PluginSpiRegistry();

  registry.register({
    pluginId: "plugin.global",
    spiType: "tool",
    async execute() {
      return { success: true, output: "ok" };
    },
  }, {
    pluginId: "plugin.global",
    name: "global plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: [], // No domain restriction
    capabilityIds: [],
    spiTypes: ["tool"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  const plugins = registry.listByDomain("any_domain");
  assert.equal(plugins.length, 1);
  assert.equal(plugins[0]?.manifest.pluginId, "plugin.global");
});

test("PluginSpiRegistry resolve returns plugin instance", () => {
  const registry = new PluginSpiRegistry();

  registry.register({
    pluginId: "plugin.resolve",
    domainId: "test",
    spiType: "tool",
    async execute() {
      return { success: true, output: "resolved" };
    },
  }, {
    pluginId: "plugin.resolve",
    name: "resolve plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["test"],
    capabilityIds: [],
    spiTypes: ["tool"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  const plugin = registry.resolve("plugin.resolve");
  assert.ok(plugin);
  assert.equal(plugin?.pluginId, "plugin.resolve");
});

test("PluginSpiRegistry resolve returns null for unknown plugin", () => {
  const registry = new PluginSpiRegistry();
  assert.equal(registry.resolve("unknown_plugin"), null);
});

test("PluginSpiRegistry get returns null for unknown plugin", () => {
  const registry = new PluginSpiRegistry();
  assert.equal(registry.get("unknown_plugin"), null);
});

test("PluginSpiRegistry list returns all registered plugins", () => {
  const registry = new PluginSpiRegistry();

  registry.register({
    pluginId: "plugin.list.1",
    domainId: "test",
    spiType: "tool",
    async execute() {
      return { success: true, output: "ok" };
    },
  }, {
    pluginId: "plugin.list.1",
    name: "list 1",
    version: "1.0.0",
    owner: "test",
    domainIds: ["test"],
    capabilityIds: [],
    spiTypes: ["tool"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  registry.register({
    pluginId: "plugin.list.2",
    domainId: "test",
    spiType: "retriever",
    async retrieve() {
      return [];
    },
  }, {
    pluginId: "plugin.list.2",
    name: "list 2",
    version: "1.0.0",
    owner: "test",
    domainIds: ["test"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy(),
  });

  const all = registry.list();
  assert.equal(all.length, 2);
});
