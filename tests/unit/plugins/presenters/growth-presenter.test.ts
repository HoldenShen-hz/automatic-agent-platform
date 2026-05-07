import assert from "node:assert/strict";
import test from "node:test";

import { createGrowthPresenterPlugin } from "../../../../src/plugins/presenters/growth-presenter.js";

test("GrowthPresenter has correct plugin metadata", () => {
  const plugin = createGrowthPresenterPlugin();

  assert.equal(plugin.pluginId, "plugin.growth.presenter");
  assert.equal(plugin.domainId, "growth");
  assert.equal(plugin.spiType, "presenter");
});

test("GrowthPresenter has correct capabilityIds", () => {
  const plugin = createGrowthPresenterPlugin();

  assert.deepEqual(plugin.capabilityIds, ["present.output", "present.campaign", "present.abtest"]);
});

test("GrowthPresenter.initialize returns undefined", async () => {
  const plugin = createGrowthPresenterPlugin();
  assert.ok(plugin.initialize !== undefined);
  const result = await plugin.initialize();
  assert.equal(result, undefined);
});

test("GrowthPresenter.healthCheck returns true", async () => {
  const plugin = createGrowthPresenterPlugin();
  assert.ok(plugin.healthCheck !== undefined);
  const result = await plugin.healthCheck();
  assert.equal(result, true);
});

test("GrowthPresenter.shutdown returns undefined", async () => {
  const plugin = createGrowthPresenterPlugin();
  assert.ok(plugin.shutdown !== undefined);
  const result = await plugin.shutdown();
  assert.equal(result, undefined);
});

test("GrowthPresenter.formatOutput formats campaign type correctly", async () => {
  const plugin = createGrowthPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [{
      stepId: "campaign_step",
      outputRef: "ref_123",
      payload: {
        type: "campaign",
        campaignName: "Summer Sale",
        reach: "10000",
        conversionRate: "5%",
        roas: "3.2x",
      },
    }],
    artifacts: [],
    audience: "end_user",
  });

  assert.ok(result.sections.length > 0);
  assert.ok(result.sections[0]?.includes("Campaign: Summer Sale"));
  assert.ok(result.sections[0]?.includes("**Reach**: 10000"));
  assert.ok(result.sections[0]?.includes("**Conversion Rate**: 5%"));
  assert.ok(result.sections[0]?.includes("**ROAS**: 3.2x"));
  assert.ok(result.citations.includes("ref_123"));
});

test("GrowthPresenter.formatOutput formats abtest type correctly", async () => {
  const plugin = createGrowthPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [{
      stepId: "abtest_step",
      outputRef: "ref_456",
      payload: {
        type: "abtest",
        testName: "Homepage CTA",
        variant: "Button B",
        lift: "12%",
        confidence: "95%",
      },
    }],
    artifacts: [],
    audience: "reviewer",
  });

  assert.ok(result.sections.length > 0);
  assert.ok(result.sections[0]?.includes("A/B Test: Homepage CTA"));
  assert.ok(result.sections[0]?.includes("**Winning Variant**: Button B"));
  assert.ok(result.sections[0]?.includes("**Lift**: 12%"));
  assert.ok(result.sections[0]?.includes("**Confidence**: 95%"));
});

test("GrowthPresenter.formatOutput formats generic type as JSON", async () => {
  const plugin = createGrowthPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [{
      stepId: "generic_step",
      outputRef: null,
      payload: { key: "value", nested: { a: 1 } },
    }],
    artifacts: [],
    audience: "developer",
  });

  assert.ok(result.sections.length > 0);
  assert.ok(result.sections[0]?.includes("generic_step"));
  assert.ok(result.sections[0]?.includes("```json"));
});

test("GrowthPresenter.formatOutput includes artifacts section", async () => {
  const plugin = createGrowthPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [{
      stepId: "step1",
      outputRef: "ref_1",
      payload: { type: "campaign", campaignName: "Test" },
    }],
    artifacts: ["artifact://doc/1", "artifact://doc/2"],
    audience: "end_user",
  });

  assert.ok(result.sections.some(s => s.includes("Artifacts")));
  assert.ok(result.sections.some(s => s.includes("artifact://doc/1")));
  assert.ok(result.sections.some(s => s.includes("artifact://doc/2")));
});

test("GrowthPresenter.formatOutput returns no output message when empty", async () => {
  const plugin = createGrowthPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [],
    artifacts: [],
    audience: "end_user",
  });

  assert.equal(result.summary, "No growth output produced");
  assert.equal(result.sections.length, 0);
  assert.equal(result.citations.length, 0);
});

test("GrowthPresenter.formatOutput handles missing optional fields in payload", async () => {
  const plugin = createGrowthPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [{
      stepId: "incomplete_step",
      outputRef: null,
      payload: {},
    }],
    artifacts: [],
    audience: "developer",
  });

  assert.ok(result.sections.length > 0);
  assert.ok(result.summary.includes("1 step"));
});

test("GrowthPresenter.formatOutput uses stepId as fallback for campaignName", async () => {
  const plugin = createGrowthPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [{
      stepId: "fallback_step",
      outputRef: null,
      payload: { type: "campaign" },
    }],
    artifacts: [],
    audience: "end_user",
  });

  assert.ok(result.sections[0]?.includes("fallback_step"));
});

test("GrowthPresenter.formatOutput prefers nodeRunId when campaignName is absent", async () => {
  const plugin = createGrowthPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [{
      nodeRunId: "node_run_campaign",
      outputRef: null,
      payload: { type: "campaign" },
    }],
    artifacts: [],
    audience: "end_user",
  });

  assert.ok(result.sections[0]?.includes("node_run_campaign"));
});

test("GrowthPresenter.formatOutput handles empty string type as generic JSON", async () => {
  const plugin = createGrowthPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [{
      stepId: "empty_type_step",
      outputRef: "ref_empty",
      payload: { type: "", customField: "value" },
    }],
    artifacts: [],
    audience: "developer",
  });

  // Empty string type should fall to else branch and format as JSON
  assert.ok(result.sections.length > 0);
  assert.ok(result.sections[0]?.includes("empty_type_step"));
  assert.ok(result.sections[0]?.includes("```json"));
  assert.ok(result.citations.includes("ref_empty"));
});

test("GrowthPresenter.formatOutput summary uses singular for single step", async () => {
  const plugin = createGrowthPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [{
      stepId: "single_step",
      outputRef: null,
      payload: { type: "campaign", campaignName: "Test Campaign" },
    }],
    artifacts: [],
    audience: "end_user",
  });

  assert.ok(result.summary.includes("1 step processed"));
});

test("GrowthPresenter.formatOutput summary uses plural for multiple steps", async () => {
  const plugin = createGrowthPresenterPlugin();

  const result = await plugin.formatOutput({
    machineOutputs: [
      { stepId: "step_1", outputRef: null, payload: { type: "campaign", campaignName: "Campaign 1" } },
      { stepId: "step_2", outputRef: null, payload: { type: "abtest", testName: "Test 1" } },
    ],
    artifacts: [],
    audience: "end_user",
  });

  assert.ok(result.summary.includes("2 steps processed"));
});
