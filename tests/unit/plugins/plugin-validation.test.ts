/**
 * Unit Tests: Plugin Validation
 *
 * Tests for the basic-evaluator validator plugin including quality scoring,
 * deviation analysis, harness decision, and validation logic.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createBasicEvaluatorPlugin } from "../../../src/plugins/validators/basic-evaluator.js";

test("BasicEvaluatorPlugin creates successfully", () => {
  const plugin = createBasicEvaluatorPlugin();
  assert.ok(plugin !== undefined);
  assert.equal(plugin.pluginId, "plugin.core.basic-evaluator");
  assert.equal(plugin.spiType, "validator");
  assert.equal(plugin.domainId, "core");
});

test("BasicEvaluatorPlugin has validate method", () => {
  const plugin = createBasicEvaluatorPlugin();
  assert.equal(typeof plugin.validate, "function");
});

test("BasicEvaluatorPlugin has capabilityIds", () => {
  const plugin = createBasicEvaluatorPlugin();
  assert.ok(Array.isArray(plugin.capabilityIds));
  assert.ok(plugin.capabilityIds.includes("output.validate"));
});

test("BasicEvaluatorPlugin validate returns valid for complete matching payload", async () => {
  const plugin = createBasicEvaluatorPlugin();

  const result = await plugin.validate({
    stepId: "test_step",
    machineOutput: {
      stepId: "test_step",
      outputRef: "ref_1",
      payload: {
        name: "test",
        value: 42,
        active: true,
        items: [1, 2, 3],
        data: { nested: true },
      },
    },
    contract: {
      requiredFields: ["name", "value", "active", "items", "data"],
      fieldTypes: {
        name: "string",
        value: "number",
        active: "boolean",
        items: "array",
        data: "object",
      },
    },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.ok(Array.isArray(result.suggestions));
});

test("BasicEvaluatorPlugin validate returns errors for missing required fields", async () => {
  const plugin = createBasicEvaluatorPlugin();

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
  assert.ok(result.errors.some((e) => e.field === "value"));
  assert.ok(result.errors.some((e) => e.field === "status"));
  assert.ok(result.errors.every((e) => e.severity === "error"));
});

test("BasicEvaluatorPlugin validate returns errors for type mismatches", async () => {
  const plugin = createBasicEvaluatorPlugin();

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
  assert.ok(result.errors.some((e) => e.field === "count"));
  assert.ok(result.errors.some((e) => e.field === "enabled"));
});

test("BasicEvaluatorPlugin validate provides suggestions for missing fields", async () => {
  const plugin = createBasicEvaluatorPlugin();

  const result = await plugin.validate({
    stepId: "test_step",
    machineOutput: {
      stepId: "test_step",
      outputRef: "ref_1",
      payload: {},
    },
    contract: {
      requiredFields: ["name", "value"],
    },
  });

  assert.ok(result.suggestions.length > 0);
  assert.ok(result.suggestions.some((s) => s.includes('"name"')));
  assert.ok(result.suggestions.some((s) => s.includes('"value"')));
});

test("BasicEvaluatorPlugin validate provides suggestions for type mismatches", async () => {
  const plugin = createBasicEvaluatorPlugin();

  const result = await plugin.validate({
    stepId: "test_step",
    machineOutput: {
      stepId: "test_step",
      outputRef: "ref_1",
      payload: { count: 123 },
    },
    contract: {
      fieldTypes: { count: "string" },
    },
  });

  assert.ok(result.suggestions.length > 0);
  assert.ok(result.suggestions.some((s) => s.includes("Normalize")));
  assert.ok(result.suggestions.some((s) => s.includes("count")));
});

test("BasicEvaluatorPlugin validate handles empty contract", async () => {
  const plugin = createBasicEvaluatorPlugin();

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
  assert.deepEqual(result.errors, []);
});

test("BasicEvaluatorPlugin validate ignores missing fields when no required fields specified", async () => {
  const plugin = createBasicEvaluatorPlugin();

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

  // Missing fields should not cause type errors if not in requiredFields
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("BasicEvaluatorPlugin validate handles null payload fields", async () => {
  const plugin = createBasicEvaluatorPlugin();

  const result = await plugin.validate({
    stepId: "test_step",
    machineOutput: {
      stepId: "test_step",
      outputRef: "ref_1",
      payload: { name: null, value: undefined },
    },
    contract: {
      requiredFields: ["name", "value"],
    },
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 2);
});

test("BasicEvaluatorPlugin validate handles nested objects in payload", async () => {
  const plugin = createBasicEvaluatorPlugin();

  const result = await plugin.validate({
    stepId: "test_step",
    machineOutput: {
      stepId: "test_step",
      outputRef: "ref_1",
      payload: {
        user: { name: "John", age: 30 },
        settings: { theme: "dark", notifications: true },
      },
    },
    contract: {
      requiredFields: ["user", "settings"],
      fieldTypes: {
        user: "object",
        settings: "object",
      },
    },
  });

  assert.equal(result.valid, true);
});

test("BasicEvaluatorPlugin validate handles arrays in payload", async () => {
  const plugin = createBasicEvaluatorPlugin();

  const result = await plugin.validate({
    stepId: "test_step",
    machineOutput: {
      stepId: "test_step",
      outputRef: "ref_1",
      payload: {
        items: [1, 2, 3],
        users: [{ name: "John" }, { name: "Jane" }],
      },
    },
    contract: {
      requiredFields: ["items", "users"],
      fieldTypes: {
        items: "array",
        users: "array",
      },
    },
  });

  assert.equal(result.valid, true);
});

test("BasicEvaluatorPlugin validate handles mixed errors and suggestions", async () => {
  const plugin = createBasicEvaluatorPlugin();

  const result = await plugin.validate({
    stepId: "test_step",
    machineOutput: {
      stepId: "test_step",
      outputRef: "ref_1",
      payload: { count: "wrong type" },
    },
    contract: {
      requiredFields: ["name"],
      fieldTypes: { count: "number" },
    },
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
  assert.ok(result.suggestions.length > 0);
});

test("BasicEvaluatorPlugin has evaluate extended method", async () => {
  const plugin = createBasicEvaluatorPlugin() as any;

  assert.ok(typeof plugin.evaluate === "function");

  const result = await plugin.evaluate({
    machineOutput: { payload: { name: "test", value: 42 } },
    contract: {
      targetValues: { name: "test", value: 42 },
      deviationThreshold: 0.1,
    },
  });

  assert.ok(result.qualityScore !== undefined);
  assert.ok(result.suggestions !== undefined);
});

test("BasicEvaluatorPlugin evaluate calculates correct quality scores", async () => {
  const plugin = createBasicEvaluatorPlugin() as any;

  const result = await plugin.evaluate({
    machineOutput: { payload: { name: "test", value: 100 } },
    contract: {
      targetValues: { name: "test", value: 100 },
      deviationThreshold: 0.1,
      requiredFields: ["name", "value"],
      fieldTypes: { name: "string", value: "number" },
    },
  });

  // Perfect match should give high quality scores
  assert.ok(result.qualityScore.overall >= 0.9);
  assert.ok(result.qualityScore.completeness === 1);
  assert.ok(result.qualityScore.correctness === 1);
  assert.ok(result.qualityScore.deviation === 0);
});

test("BasicEvaluatorPlugin evaluate detects deviation from target", async () => {
  const plugin = createBasicEvaluatorPlugin() as any;

  const result = await plugin.evaluate({
    machineOutput: { payload: { name: "completely_different_value" } },
    contract: {
      targetValues: { name: "test" },
      deviationThreshold: 0.1,
    },
  });

  assert.ok(result.qualityScore.deviation > 0.1);
  assert.ok(result.qualityScore.riskLevel !== "low");
});

test("BasicEvaluatorPlugin evaluate provides risk assessment", async () => {
  const plugin = createBasicEvaluatorPlugin() as any;

  const result = await plugin.evaluate({
    machineOutput: { payload: {} },
    contract: {
      requiredFields: ["field1", "field2", "field3", "field4", "field5"],
      deviationThreshold: 0.1,
    },
  });

  assert.ok(result.qualityScore.riskFactors !== undefined);
  assert.ok(result.qualityScore.riskLevel !== undefined);
  assert.ok(["low", "medium", "high", "critical"].includes(result.qualityScore.riskLevel));
});

test("BasicEvaluatorPlugin has produceHarnessDecision extended method", async () => {
  const plugin = createBasicEvaluatorPlugin() as any;

  assert.ok(typeof plugin.produceHarnessDecision === "function");

  const result = await plugin.produceHarnessDecision({
    machineOutput: { payload: { name: "test" } },
    contract: {
      targetValues: { name: "test" },
      deviationThreshold: 0.1,
    },
  });

  assert.ok(result.qualityScore !== undefined);
  assert.ok(result.deviationAnalysis !== undefined);
  assert.ok(result.riskAssessment !== undefined);
  assert.ok(result.recommendations !== undefined);
});

test("BasicEvaluatorPlugin produceHarnessDecision includes deviation analysis", async () => {
  const plugin = createBasicEvaluatorPlugin() as any;

  const result = await plugin.produceHarnessDecision({
    machineOutput: { payload: { name: "test", count: 42 } },
    contract: {
      targetValues: { name: "test", count: 42 },
      deviationThreshold: 0.1,
    },
  });

  assert.ok(Array.isArray(result.deviationAnalysis));
  assert.ok(result.deviationAnalysis.length === 2);
});

test("BasicEvaluatorPlugin produceHarnessDecision includes risk assessment categories", async () => {
  const plugin = createBasicEvaluatorPlugin() as any;

  const result = await plugin.produceHarnessDecision({
    machineOutput: { payload: { name: "test" } },
    contract: {
      targetValues: { name: "test" },
      deviationThreshold: 0.1,
    },
  });

  assert.ok(Array.isArray(result.riskAssessment));
});

test("BasicEvaluatorPlugin produceHarnessDecision includes recommendations", async () => {
  const plugin = createBasicEvaluatorPlugin() as any;

  const result = await plugin.produceHarnessDecision({
    machineOutput: { payload: { name: "test" } },
    contract: {
      targetValues: { name: "test" },
      deviationThreshold: 0.1,
    },
  });

  assert.ok(Array.isArray(result.recommendations));
});

test("BasicEvaluatorPlugin produceHarnessDecision detects high risk", async () => {
  const plugin = createBasicEvaluatorPlugin() as any;

  const result = await plugin.produceHarnessDecision({
    machineOutput: { payload: { safety: true, kill: false } },
    contract: {
      targetValues: { safety: true, kill: false },
      deviationThreshold: 0.1,
    },
  });

  // Should have safety risk assessment due to safety-related field names
  const hasSafetyRisk = result.riskAssessment.some(
    (r: any) => r.category === "safety" || r.level === "critical" || r.level === "high",
  );
  assert.ok(hasSafetyRisk);
});

test("BasicEvaluatorPlugin healthCheck follows initialize/shutdown lifecycle", async () => {
  const plugin = createBasicEvaluatorPlugin();
  assert.equal(await plugin.healthCheck(), true);
  await plugin.initialize();
  assert.equal(await plugin.healthCheck(), true);
  await plugin.shutdown();
  assert.equal(await plugin.healthCheck(), true);
});

test("BasicEvaluatorPlugin initialize returns undefined", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.initialize();
  assert.equal(result, undefined);
});

test("BasicEvaluatorPlugin shutdown returns undefined", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.shutdown();
  assert.equal(result, undefined);
});
