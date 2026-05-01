import assert from "node:assert/strict";
import test from "node:test";

import {
  getPluginLifecycleState,
  setPluginLifecycleState,
} from "../../../src/plugins/builtin-plugin-registry.js";

test("getPluginLifecycleState returns null for untracked plugin", () => {
  const state = getPluginLifecycleState("plugin.untracked");
  assert.equal(state, null);
});

test("setPluginLifecycleState sets registered state", () => {
  setPluginLifecycleState("plugin.test_registered", "registered");
  const state = getPluginLifecycleState("plugin.test_registered");
  assert.equal(state, "registered");
});

test("setPluginLifecycleState sets validated state", () => {
  setPluginLifecycleState("plugin.test_validated", "validated");
  const state = getPluginLifecycleState("plugin.test_validated");
  assert.equal(state, "validated");
});

test("setPluginLifecycleState sets loading state", () => {
  setPluginLifecycleState("plugin.test_loading", "loading");
  const state = getPluginLifecycleState("plugin.test_loading");
  assert.equal(state, "loading");
});

test("setPluginLifecycleState sets active state", () => {
  setPluginLifecycleState("plugin.test_active", "active");
  const state = getPluginLifecycleState("plugin.test_active");
  assert.equal(state, "active");
});

test("setPluginLifecycleState sets inactive state", () => {
  setPluginLifecycleState("plugin.test_inactive", "inactive");
  const state = getPluginLifecycleState("plugin.test_inactive");
  assert.equal(state, "inactive");
});

test("setPluginLifecycleState sets unloaded state", () => {
  setPluginLifecycleState("plugin.test_unloaded", "unloaded");
  const state = getPluginLifecycleState("plugin.test_unloaded");
  assert.equal(state, "unloaded");
});

test("lifecycle state transitions work correctly", () => {
  const pluginId = "plugin.transition_test";
  setPluginLifecycleState(pluginId, "registered");
  assert.equal(getPluginLifecycleState(pluginId), "registered");

  setPluginLifecycleState(pluginId, "validated");
  assert.equal(getPluginLifecycleState(pluginId), "validated");

  setPluginLifecycleState(pluginId, "loading");
  assert.equal(getPluginLifecycleState(pluginId), "loading");

  setPluginLifecycleState(pluginId, "active");
  assert.equal(getPluginLifecycleState(pluginId), "active");

  setPluginLifecycleState(pluginId, "inactive");
  assert.equal(getPluginLifecycleState(pluginId), "inactive");

  setPluginLifecycleState(pluginId, "unloaded");
  assert.equal(getPluginLifecycleState(pluginId), "unloaded");
});

test("multiple plugins have independent lifecycle states", () => {
  setPluginLifecycleState("plugin.plugin_a", "active");
  setPluginLifecycleState("plugin.plugin_b", "inactive");

  assert.equal(getPluginLifecycleState("plugin.plugin_a"), "active");
  assert.equal(getPluginLifecycleState("plugin.plugin_b"), "inactive");
});