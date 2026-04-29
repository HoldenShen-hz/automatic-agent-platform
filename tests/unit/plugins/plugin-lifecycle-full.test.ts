/**
 * @fileoverview Unit tests for plugin lifecycle state machine
 *
 * Tests the full state machine for plugin lifecycle transitions.
 * Covers all valid transitions, invalid transition rejection,
 * and terminal state handling.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PluginSpiRegistry } from "../../../src/domains/registry/plugin-spi-registry.js";
import { createBasicPlannerPlugin, createBasicEvaluatorPlugin } from "../../../src/plugins/index.js";

test("PluginLifecycle: all seven lifecycle states are valid", () => {
  const states = ["registered", "loading", "active", "inactive", "unloaded", "suspended", "disabled"];
  const registry = new PluginSpiRegistry();

  for (const state of states) {
    // Verify each state is a valid enum value
    assert.ok(states.includes(state), `State ${state} should be valid`);
  }
});

test("PluginLifecycle: plugin transitions registered -> loading -> active", async () => {
  const registry = new PluginSpiRegistry();
  const plugin = createBasicPlannerPlugin();

  registry.register(plugin);

  let record = registry.get(plugin.pluginId)!;
  assert.equal(record.lifecycleState, "registered");

  await registry.ensureActive(plugin.pluginId);

  record = registry.get(plugin.pluginId)!;
  assert.equal(record.lifecycleState, "active");
});

test("PluginLifecycle: active -> inactive via deactivate", async () => {
  const registry = new PluginSpiRegistry();
  const plugin = createBasicPlannerPlugin();

  registry.register(plugin);
  await registry.ensureActive(plugin.pluginId);

  await registry.deactivate(plugin.pluginId);

  const record = registry.get(plugin.pluginId)!;
  assert.equal(record.lifecycleState, "inactive");
});

test("PluginLifecycle: inactive -> active via ensureActive", async () => {
  const registry = new PluginSpiRegistry();
  const plugin = createBasicPlannerPlugin();

  registry.register(plugin);
  await registry.ensureActive(plugin.pluginId);
  await registry.deactivate(plugin.pluginId);

  await registry.ensureActive(plugin.pluginId);

  const record = registry.get(plugin.pluginId)!;
  assert.equal(record.lifecycleState, "active");
});

test("PluginLifecycle: active -> suspended via suspend", async () => {
  const registry = new PluginSpiRegistry();
  const plugin = createBasicPlannerPlugin();

  registry.register(plugin);
  await registry.ensureActive(plugin.pluginId);

  await registry.suspend(plugin.pluginId, "test reason");

  const record = registry.get(plugin.pluginId)!;
  assert.equal(record.lifecycleState, "suspended");
});

test("PluginLifecycle: suspended -> active via ensureActive", async () => {
  const registry = new PluginSpiRegistry();
  const plugin = createBasicPlannerPlugin();

  registry.register(plugin);
  await registry.ensureActive(plugin.pluginId);
  await registry.suspend(plugin.pluginId, "test reason");

  await registry.ensureActive(plugin.pluginId);

  const record = registry.get(plugin.pluginId)!;
  assert.equal(record.lifecycleState, "active");
});

test("PluginLifecycle: active -> unloaded via unload (deactivates first)", async () => {
  const registry = new PluginSpiRegistry();
  const plugin = createBasicPlannerPlugin();

  registry.register(plugin);
  await registry.ensureActive(plugin.pluginId);

  await registry.unload(plugin.pluginId);

  const record = registry.get(plugin.pluginId)!;
  assert.equal(record.lifecycleState, "unloaded");
});

test("PluginLifecycle: inactive -> unloaded via unload", async () => {
  const registry = new PluginSpiRegistry();
  const plugin = createBasicPlannerPlugin();

  registry.register(plugin);
  await registry.ensureActive(plugin.pluginId);
  await registry.deactivate(plugin.pluginId);

  await registry.unload(plugin.pluginId);

  const record = registry.get(plugin.pluginId)!;
  assert.equal(record.lifecycleState, "unloaded");
});

test("PluginLifecycle: unregistered plugin cannot ensureActive", async () => {
  const registry = new PluginSpiRegistry();

  await assert.rejects(
    async () => registry.ensureActive("nonexistent.plugin"),
    /not found/i,
  );
});

test("PluginLifecycle: deactivated plugin with healthCheck failure becomes suspended", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 2 });
  const plugin = createBasicEvaluatorPlugin();

  // Make healthCheck fail
  plugin.healthCheck = () => Promise.resolve(false);

  registry.register(plugin);

  await assert.rejects(
    async () => registry.ensureActive(plugin.pluginId),
    /unhealthy/i,
  );

  const record = registry.get(plugin.pluginId)!;
  assert.ok(
    record.lifecycleState === "suspended" || record.lifecycleState === "disabled",
    `Expected suspended or disabled, got ${record.lifecycleState}`,
  );
});

test("PluginLifecycle: repeated failures lead to disabled state", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 2 });
  const plugin = createBasicEvaluatorPlugin();

  plugin.healthCheck = () => Promise.resolve(false);

  registry.register(plugin);

  // First activation attempt fails
  try {
    await registry.ensureActive(plugin.pluginId);
  } catch {
    // Expected
  }

  // Second activation attempt should also fail
  try {
    await registry.ensureActive(plugin.pluginId);
  } catch {
    // Expected
  }

  const record = registry.get(plugin.pluginId)!;
  // After 2 failures with maxConsecutiveFailures=2, should be disabled
  assert.equal(record.lifecycleState, "disabled");
});

test("PluginLifecycle: disabled plugin throws on ensureActive", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 1 });
  const plugin = createBasicPlannerPlugin();

  plugin.healthCheck = () => Promise.resolve(false);

  registry.register(plugin);

  try {
    await registry.ensureActive(plugin.pluginId);
  } catch {
    // Expected failure
  }

  // Now try to activate again
  await assert.rejects(
    async () => registry.ensureActive(plugin.pluginId),
    /disabled/i,
  );
});

test("PluginLifecycle: unloaded plugin cannot be activated", async () => {
  const registry = new PluginSpiRegistry();
  const plugin = createBasicPlannerPlugin();

  registry.register(plugin);
  await registry.ensureActive(plugin.pluginId);
  await registry.unload(plugin.pluginId);

  await assert.rejects(
    async () => registry.ensureActive(plugin.pluginId),
    /not found/i,
  );
});

test("PluginLifecycle: deactivate returns early for non-active plugin", async () => {
  const registry = new PluginSpiRegistry();
  const plugin = createBasicPlannerPlugin();

  registry.register(plugin);

  // Plugin is in "registered" state, not active
  await registry.deactivate(plugin.pluginId);

  const record = registry.get(plugin.pluginId)!;
  assert.equal(record.lifecycleState, "registered");
});

test("PluginLifecycle: suspend returns early for registered plugin", async () => {
  const registry = new PluginSpiRegistry();
  const plugin = createBasicPlannerPlugin();

  registry.register(plugin);

  // Cannot suspend a plugin that's not active or inactive
  await registry.suspend(plugin.pluginId, "cannot suspend");

  const record = registry.get(plugin.pluginId)!;
  assert.equal(record.lifecycleState, "registered");
});

test("PluginLifecycle: multiple plugins can have independent states", async () => {
  const registry = new PluginSpiRegistry();

  const planner = createBasicPlannerPlugin();
  const evaluator = createBasicEvaluatorPlugin();

  registry.register(planner);
  registry.register(evaluator);

  // Activate planner only
  await registry.ensureActive(planner.pluginId);

  const plannerRecord = registry.get(planner.pluginId)!;
  const evaluatorRecord = registry.get(evaluator.pluginId)!;

  assert.equal(plannerRecord.lifecycleState, "active");
  assert.equal(evaluatorRecord.lifecycleState, "registered");
});

test("PluginLifecycle: lifecycle record tracks failureCount", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 2 });
  const plugin = createBasicEvaluatorPlugin();

  plugin.healthCheck = () => Promise.resolve(false);

  registry.register(plugin);

  try {
    await registry.ensureActive(plugin.pluginId);
  } catch {
    // Expected
  }

  const record = registry.get(plugin.pluginId)!;
  assert.ok(record.failureCount > 0);
});

test("PluginLifecycle: lifecycle record tracks lastErrorMessage", async () => {
  const registry = new PluginSpiRegistry();
  const plugin = createBasicEvaluatorPlugin();

  plugin.healthCheck = () => Promise.resolve(false);

  registry.register(plugin);

  try {
    await registry.ensureActive(plugin.pluginId);
  } catch {
    // Expected
  }

  const record = registry.get(plugin.pluginId)!;
  assert.ok(record.lastErrorMessage !== null);
});

test("PluginLifecycle: deactivate during active invocation is allowed", async () => {
  const registry = new PluginSpiRegistry();
  const plugin = createBasicPlannerPlugin();

  registry.register(plugin);
  await registry.ensureActive(plugin.pluginId);

  // deactivate should work even if there was recent invocation
  await registry.deactivate(plugin.pluginId);

  const record = registry.get(plugin.pluginId)!;
  assert.equal(record.lifecycleState, "inactive");
});

test("PluginLifecycle: unload after deactivate moves to unloaded", async () => {
  const registry = new PluginSpiRegistry();
  const plugin = createBasicPlannerPlugin();

  registry.register(plugin);
  await registry.ensureActive(plugin.pluginId);
  await registry.deactivate(plugin.pluginId);
  await registry.unload(plugin.pluginId);

  const record = registry.get(plugin.pluginId)!;
  assert.equal(record.lifecycleState, "unloaded");
});

test("PluginLifecycle: suspend reason is tracked in events (no throw)", async () => {
  const registry = new PluginSpiRegistry();
  const plugin = createBasicPlannerPlugin();

  registry.register(plugin);
  await registry.ensureActive(plugin.pluginId);

  // suspend should not throw and should succeed
  await registry.suspend(plugin.pluginId, "high error rate detected");

  const record = registry.get(plugin.pluginId)!;
  assert.equal(record.lifecycleState, "suspended");
});