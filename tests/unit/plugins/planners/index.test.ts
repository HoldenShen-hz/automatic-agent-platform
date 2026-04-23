import assert from "node:assert/strict";
import test from "node:test";

import * as PlannersIndex from "../../../../src/plugins/planners/index.js";

test("PlannersIndex exports basic-planner", () => {
  assert.ok(PlannersIndex.createBasicPlannerPlugin !== undefined);
});

test("PlannersIndex creates BasicPlannerPlugin successfully", () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();
  assert.ok(plugin !== undefined);
});

test("PlannersIndex BasicPlannerPlugin has correct metadata", () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();

  assert.equal(plugin.pluginId, "plugin.core.basic-planner");
  assert.equal(plugin.spiType, "planner");
});

test("PlannersIndex BasicPlannerPlugin has suggestWorkflow method", () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();
  assert.ok(typeof plugin.suggestWorkflow === "function");
  assert.ok(plugin.capabilityIds != null);
  assert.ok((plugin.capabilityIds as readonly string[]).includes("workflow.suggest"));
});

test("PlannersIndex BasicPlannerPlugin.initialize is no-op", async () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();
  if (plugin.initialize) {
    const result = await plugin.initialize();
    assert.equal(result, undefined);
  } else {
    assert.ok(true);
  }
});

test("PlannersIndex BasicPlannerPlugin.shutdown is no-op", async () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();
  if (plugin.shutdown) {
    const result = await plugin.shutdown();
    assert.equal(result, undefined);
  } else {
    assert.ok(true);
  }
});

test("PlannersIndex BasicPlannerPlugin.capabilityIds includes workflow.suggest", () => {
  const plugin = PlannersIndex.createBasicPlannerPlugin();
  assert.ok(plugin.capabilityIds != null);
  assert.ok((plugin.capabilityIds as readonly string[]).includes("workflow.suggest"));
});
