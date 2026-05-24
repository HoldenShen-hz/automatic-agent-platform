import assert from "node:assert/strict";
import test from "node:test";

import { createBasicEvaluatorPlugin } from "../../../../src/plugins/validators/basic-evaluator.js";

function createPlugin() {
  const plugin = createBasicEvaluatorPlugin();
  assert.equal(plugin.spiType, "validator");
  assert.ok(typeof plugin.validate === "function");
  return plugin;
}

test("basic evaluator exposes expected plugin metadata", () => {
  const plugin = createPlugin();

  assert.equal(plugin.pluginId, "plugin.core.basic-evaluator");
  assert.equal(plugin.domainId, "core");
  assert.deepEqual(plugin.capabilityIds, ["output.validate"]);
});

test("basic evaluator lifecycle hooks flip health state", async () => {
  const plugin = createPlugin();

  assert.equal(await plugin.healthCheck?.(), false);
  await plugin.initialize?.();
  assert.equal(await plugin.healthCheck?.(), true);
  await plugin.shutdown?.();
  assert.equal(await plugin.healthCheck?.(), false);
});

test("basic evaluator validates required fields and types", async () => {
  const plugin = createPlugin();
  const result = await plugin.validate({
    machineOutput: {
      outputRef: "output:1",
      payload: { amount: "oops" },
    },
    contract: {
      requiredFields: ["summary"],
      fieldTypes: { amount: "number" },
    },
  });

  assert.equal(result.valid, false);
  assert.deepEqual(
    result.errors.map((error) => error.field).sort(),
    ["amount", "summary"],
  );
  assert.ok(result.suggestions.includes('Provide "summary" in machine output payload.'));
});

test("basic evaluator produces evaluation metadata for high-risk outputs", async () => {
  const plugin = createPlugin();
  const result = await plugin.validate({
    machineOutput: {
      outputRef: "output:2",
      payload: { summary: "ok", amount: 1000 },
    },
    contract: {
      requiredFields: ["summary"],
      expectedOutcomeFields: ["summary"],
      highRiskFields: ["amount"],
      qualityThreshold: 0.8,
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.evaluation?.goalDeviation.severity, "none");
  assert.equal(result.evaluation?.riskFindings[0]?.code, "risk.high_value_field:amount");
  assert.equal(result.evaluation?.harnessDecision.action, "requires_human");
});

test("basic evaluator tolerates empty contracts for already-shaped output", async () => {
  const plugin = createPlugin();
  const result = await plugin.validate({
    machineOutput: {
      outputRef: "output:3",
      payload: { summary: "done" },
    },
    contract: {},
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.suggestions, []);
});
