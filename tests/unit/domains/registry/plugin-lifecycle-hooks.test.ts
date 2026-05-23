import test from "node:test";
import assert from "node:assert/strict";

import type { PluginLifecycleContext, PluginLifecycleHooks } from "../../../../src/domains/registry/plugin-spi.js";

const TEST_CONTEXT: PluginLifecycleContext = {
  pluginId: "test.plugin",
  domainId: "test-domain",
  capabilityIds: ["capability.1", "capability.2"],
  bindingId: "binding-123",
  config: { setting: "value" },
};

test("onLoad hook is called when plugin loads", async () => {
  let loadCallCount = 0;
  let capturedContext: PluginLifecycleContext | null = null;

  const hooks: PluginLifecycleHooks = {
    async onLoad(context) {
      loadCallCount++;
      capturedContext = context;
    },
  };

  await hooks.onLoad!(TEST_CONTEXT);

  assert.equal(loadCallCount, 1);
  assert.deepEqual(capturedContext, TEST_CONTEXT);
});

test("onLoad hook supports synchronous implementation", () => {
  let loadCalled = false;

  const hooks: PluginLifecycleHooks = {
    onLoad(context) {
      loadCalled = true;
      assert.equal(context.pluginId, TEST_CONTEXT.pluginId);
    },
  };

  hooks.onLoad!(TEST_CONTEXT);
  assert.equal(loadCalled, true);
});

test("onActivate hook is called on plugin activation", async () => {
  let activateCallCount = 0;
  let capturedContext: PluginLifecycleContext | null = null;

  const hooks: PluginLifecycleHooks = {
    async onActivate(context) {
      activateCallCount++;
      capturedContext = context;
    },
  };

  await hooks.onActivate!(TEST_CONTEXT);

  assert.equal(activateCallCount, 1);
  assert.deepEqual(capturedContext, TEST_CONTEXT);
});

test("onActivate hook supports synchronous implementation", () => {
  let activateCalled = false;

  const hooks: PluginLifecycleHooks = {
    onActivate(context) {
      activateCalled = true;
      assert.equal(context.pluginId, TEST_CONTEXT.pluginId);
    },
  };

  hooks.onActivate!(TEST_CONTEXT);
  assert.equal(activateCalled, true);
});

test("onDeactivate hook is called on plugin deactivation", async () => {
  let deactivateCallCount = 0;
  let capturedContext: PluginLifecycleContext | null = null;

  const hooks: PluginLifecycleHooks = {
    async onDeactivate(context) {
      deactivateCallCount++;
      capturedContext = context;
    },
  };

  await hooks.onDeactivate!(TEST_CONTEXT);

  assert.equal(deactivateCallCount, 1);
  assert.deepEqual(capturedContext, TEST_CONTEXT);
});

test("onDeactivate hook supports synchronous implementation", () => {
  let deactivateCalled = false;

  const hooks: PluginLifecycleHooks = {
    onDeactivate(context) {
      deactivateCalled = true;
      assert.equal(context.pluginId, TEST_CONTEXT.pluginId);
    },
  };

  hooks.onDeactivate!(TEST_CONTEXT);
  assert.equal(deactivateCalled, true);
});

test("healthCheck returns true when plugin is healthy", async () => {
  const hooks: PluginLifecycleHooks = {
    async healthCheck() {
      return true;
    },
  };

  const result = await hooks.healthCheck!();

  assert.equal(result, true);
});

test("healthCheck returns false when plugin is unhealthy", async () => {
  const hooks: PluginLifecycleHooks = {
    async healthCheck() {
      return false;
    },
  };

  const result = await hooks.healthCheck!();

  assert.equal(result, false);
});

test("healthCheck supports synchronous implementation", () => {
  const hooks: PluginLifecycleHooks = {
    healthCheck() {
      return true;
    },
  };

  const result = hooks.healthCheck!();

  assert.equal(result, true);
});

test("healthCheck returns false by default when not implemented", () => {
  const hooks: PluginLifecycleHooks = {};

  assert.equal(hooks.healthCheck, undefined);
});

test("onLoad hook is undefined when not implemented", () => {
  const hooks: PluginLifecycleHooks = {};

  assert.equal(hooks.onLoad, undefined);
});

test("onActivate hook is undefined when not implemented", () => {
  const hooks: PluginLifecycleHooks = {};

  assert.equal(hooks.onActivate, undefined);
});

test("onDeactivate hook is undefined when not implemented", () => {
  const hooks: PluginLifecycleHooks = {};

  assert.equal(hooks.onDeactivate, undefined);
});

test("multiple lifecycle hooks can be called in sequence", async () => {
  const callOrder: string[] = [];

  const hooks: PluginLifecycleHooks = {
    onLoad() {
      callOrder.push("load");
    },
    onActivate() {
      callOrder.push("activate");
    },
    onDeactivate() {
      callOrder.push("deactivate");
    },
  };

  await hooks.onLoad!(TEST_CONTEXT);
  await hooks.onActivate!(TEST_CONTEXT);
  await hooks.onDeactivate!(TEST_CONTEXT);

  assert.deepEqual(callOrder, ["load", "activate", "deactivate"]);
});

test("lifecycle hooks receive correct context with null domainId", async () => {
  const contextWithNullDomain: PluginLifecycleContext = {
    pluginId: "test.plugin",
    domainId: null,
    capabilityIds: [],
    bindingId: null,
    config: {},
  };

  let capturedContext: PluginLifecycleContext | null = null;

  const hooks: PluginLifecycleHooks = {
    async onActivate(context) {
      capturedContext = context;
    },
  };

  await hooks.onActivate!(contextWithNullDomain);

  const context = capturedContext as unknown as PluginLifecycleContext;
  assert.equal(context.domainId, null);
  assert.equal(context.bindingId, null);
});

test("lifecycle hooks receive correct context with empty capabilityIds", async () => {
  const contextWithEmptyCaps: PluginLifecycleContext = {
    pluginId: "test.plugin",
    domainId: "test-domain",
    capabilityIds: [],
    bindingId: null,
    config: {},
  };

  let capturedContext: PluginLifecycleContext | null = null;

  const hooks: PluginLifecycleHooks = {
    async onLoad(context) {
      capturedContext = context;
    },
  };

  await hooks.onLoad!(contextWithEmptyCaps);

  const context = capturedContext as unknown as PluginLifecycleContext;
  assert.deepEqual(context.capabilityIds, []);
});
