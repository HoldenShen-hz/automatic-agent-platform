import assert from "node:assert/strict";
import test from "node:test";

import * as ValidatorsIndex from "../../../../src/plugins/validators/index.js";

test("ValidatorsIndex exports basic-evaluator", () => {
  assert.ok(ValidatorsIndex.createBasicEvaluatorPlugin !== undefined);
});

test("ValidatorsIndex creates basic evaluator plugin successfully", () => {
  const plugin = ValidatorsIndex.createBasicEvaluatorPlugin();
  assert.ok(plugin !== undefined);
  assert.equal(plugin.pluginId, "plugin.core.basic-evaluator");
});

test("ValidatorsIndex basic-evaluator has correct spiType", () => {
  const plugin = ValidatorsIndex.createBasicEvaluatorPlugin();
  assert.equal(plugin.spiType, "validator");
});

test("ValidatorsIndex basic-evaluator has correct domainId", () => {
  const plugin = ValidatorsIndex.createBasicEvaluatorPlugin();
  assert.equal(plugin.domainId, "core");
});

test("ValidatorsIndex basic-evaluator has validate method", () => {
  const plugin = ValidatorsIndex.createBasicEvaluatorPlugin();
  assert.equal(typeof plugin.validate, "function");
});

test("ValidatorsIndex basic-evaluator has capabilityIds", () => {
  const plugin = ValidatorsIndex.createBasicEvaluatorPlugin();
  assert.ok(Array.isArray(plugin.capabilityIds));
  assert.ok(plugin.capabilityIds.includes("output.validate"));
  assert.ok(plugin.capabilityIds.includes("output.evaluate"));
  assert.ok(plugin.capabilityIds.includes("output.harness-decision"));
});

test("ValidatorsIndex basic-evaluator initialize returns undefined", async () => {
  const plugin = ValidatorsIndex.createBasicEvaluatorPlugin();
  assert.ok(plugin.initialize !== undefined);
  const result = await plugin.initialize();
  assert.equal(result, undefined);
  assert.equal(await plugin.healthCheck?.(), true);
});

test("ValidatorsIndex basic-evaluator healthCheck follows lifecycle state", async () => {
  const plugin = ValidatorsIndex.createBasicEvaluatorPlugin();
  assert.ok(plugin.healthCheck !== undefined);
  assert.equal(await plugin.healthCheck(), false);
  await plugin.initialize?.();
  assert.equal(await plugin.healthCheck(), true);
  await plugin.shutdown?.();
  assert.equal(await plugin.healthCheck(), false);
});

test("ValidatorsIndex basic-evaluator shutdown returns undefined", async () => {
  const plugin = ValidatorsIndex.createBasicEvaluatorPlugin();
  await plugin.initialize?.();
  assert.ok(plugin.shutdown !== undefined);
  const result = await plugin.shutdown();
  assert.equal(result, undefined);
});

test("ValidatorsIndex basic-evaluator validate method works correctly", async () => {
  const plugin = ValidatorsIndex.createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    stepId: "test_step",
    machineOutput: {
      stepId: "test_step",
      outputRef: "ref_1",
      payload: { name: "test", value: 42, active: true, items: [1, 2, 3], data: { nested: true } },
    },
    contract: {
      requiredFields: ["name", "value", "active", "items", "data"],
      fieldTypes: { name: "string", value: "number", active: "boolean", items: "array", data: "object" },
    },
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("ValidatorsIndex basic-evaluator validate returns errors for missing fields", async () => {
  const plugin = ValidatorsIndex.createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    stepId: "test_step",
    machineOutput: {
      stepId: "test_step",
      outputRef: "ref_1",
      payload: { name: "test" },
    },
    contract: {
      requiredFields: ["name", "value", "status"],
    },
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 2);
  assert.ok(result.errors.some((e: any) => e.field === "value"));
  assert.ok(result.errors.some((e: any) => e.field === "status"));
});

test("ValidatorsIndex basic-evaluator validate returns errors for type mismatches", async () => {
  const plugin = ValidatorsIndex.createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    stepId: "test_step",
    machineOutput: {
      stepId: "test_step",
      outputRef: "ref_1",
      payload: { count: "not a number", enabled: "not a boolean" },
    },
    contract: {
      fieldTypes: { count: "number", enabled: "boolean" },
    },
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 2);
});

test("ValidatorsIndex basic-evaluator validate handles empty contract", async () => {
  const plugin = ValidatorsIndex.createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    stepId: "test_step",
    machineOutput: {
      stepId: "test_step",
      outputRef: "ref_1",
      payload: { anything: "goes" },
    },
    contract: {},
  });
  assert.equal(result.valid, true);
});

test("ValidatorsIndex basic-evaluator validate provides suggestions", async () => {
  const plugin = ValidatorsIndex.createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    stepId: "test_step",
    machineOutput: {
      stepId: "test_step",
      outputRef: "ref_1",
      payload: { name: 123 },
    },
    contract: {
      requiredFields: ["name"],
      fieldTypes: { name: "string" },
    },
  });
  assert.ok(result.suggestions.length > 0);
  assert.ok(result.suggestions.some((s: string) => s.includes("Normalize")));
});

test("ValidatorsIndex basic-evaluator validate ignores missing fields for type checking", async () => {
  const plugin = ValidatorsIndex.createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    stepId: "test_step",
    machineOutput: {
      stepId: "test_step",
      outputRef: "ref_1",
      payload: {},
    },
    contract: {
      fieldTypes: { missingField: "string", anotherMissing: "number" },
    },
  });
  // Missing fields should not cause type errors
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});
