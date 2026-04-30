/**
 * Unit Tests: Basic Evaluator (Extended)
 *
 * Tests for issue #2016: requiredFields empty skips type validation
 * Tests for issue #2017: null typed as "object", passes check
 *
 * These tests verify the Basic Evaluator's validation logic and
 * document the behavior around type checking and null values.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createBasicEvaluatorPlugin } from "../../../../src/plugins/validators/basic-evaluator.js";

test("createBasicEvaluatorPlugin returns valid plugin structure", () => {
  const plugin = createBasicEvaluatorPlugin();

  assert.equal(plugin.pluginId, "plugin.core.basic-evaluator");
  assert.equal(plugin.domainId, "core");
  assert.equal(plugin.spiType, "validator");
  assert.deepEqual(plugin.capabilityIds, ["output.validate"]);
});

test("createBasicEvaluatorPlugin initialize returns undefined", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.initialize();
  assert.equal(result, undefined);
});

test("createBasicEvaluatorPlugin healthCheck returns true", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.healthCheck();
  assert.equal(result, true);
});

test("createBasicEvaluatorPlugin shutdown returns undefined", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.shutdown();
  assert.equal(result, undefined);
});

test("validate returns valid:true when no errors", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    machineOutput: { payload: { field1: "value" } },
    contract: {},
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.suggestions, []);
});

test("validate returns error for missing required field", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    machineOutput: { payload: {} },
    contract: { requiredFields: ["field1"] },
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].field, "field1");
  assert.equal(result.errors[0].severity, "error");
  assert.equal(result.errors[0].message, 'Missing required field "field1"');
});

test("validate returns suggestion for missing required field", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    machineOutput: { payload: {} },
    contract: { requiredFields: ["field1"] },
  });

  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0], 'Provide "field1" in machine output payload.');
});

test("validate returns error for type mismatch", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    machineOutput: { payload: { field1: 123 } },
    contract: { fieldTypes: { field1: "string" } },
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].field, "field1");
  assert.equal(result.errors[0].message, "Expected string, received number");
});

test("validate returns suggestion for type mismatch", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    machineOutput: { payload: { field1: 123 } },
    contract: { fieldTypes: { field1: "string" } },
  });

  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0], 'Normalize "field1" to string.');
});

// =============================================================================
// Issue #2016: requiredFields empty skips type validation
// When requiredFields is empty [], fieldTypes validation is skipped for missing fields
// =============================================================================

test("validate skips type check when field missing and requiredFields is empty (issue #2016)", async () => {
  const plugin = createBasicEvaluatorPlugin();

  // With requiredFields = [] and field1 missing, no error should be raised for fieldTypes
  const result = await plugin.validate({
    machineOutput: { payload: {} },
    contract: {
      requiredFields: [],
      fieldTypes: { field1: "string" },
    },
  });

  // This is the bug: field1 is missing but no error is raised because requiredFields is empty
  // The condition at line 120 only checks type when requiredFields.length > 0
  assert.equal(result.valid, true, "Bug: type validation skipped when requiredFields empty");
  assert.equal(result.errors.length, 0, "Bug: missing field with empty requiredFields doesn't error");
});

test("validate checks type when field missing but requiredFields has entries (issue #2016)", async () => {
  const plugin = createBasicEvaluatorPlugin();

  // With requiredFields = ["otherField"] and field1 missing, error should be raised
  const result = await plugin.validate({
    machineOutput: { payload: {} },
    contract: {
      requiredFields: ["otherField"],
      fieldTypes: { field1: "string" },
    },
  });

  // This should error because requiredFields.length > 0
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "field1"));
});

test("validate handles field present with correct type", async () => {
  const plugin = createBasicEvaluatorPlugin();

  const result = await plugin.validate({
    machineOutput: { payload: { field1: "hello" } },
    contract: {
      requiredFields: [],
      fieldTypes: { field1: "string" },
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("validate handles field present with wrong type", async () => {
  const plugin = createBasicEvaluatorPlugin();

  const result = await plugin.validate({
    machineOutput: { payload: { field1: 123 } },
    contract: {
      requiredFields: [],
      fieldTypes: { field1: "string" },
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].field, "field1");
});

// =============================================================================
// Issue #2017: null typed as "object", passes check
// null === null is true, so typeof null is "object"
// A field with value null passes validation for expectedType "object"
// =============================================================================

test("validate passes null for object type (issue #2017)", async () => {
  const plugin = createBasicEvaluatorPlugin();

  const result = await plugin.validate({
    machineOutput: { payload: { data: null } },
    contract: {
      fieldTypes: { data: "object" },
    },
  });

  // Bug: null is typed as "object" so it passes the check
  assert.equal(result.valid, true, "Bug: null passes object type check");
  assert.equal(result.errors.length, 0, "Bug: null doesn't cause type error for object");
});

test("validate detects type mismatch for null vs string (issue #2017)", async () => {
  const plugin = createBasicEvaluatorPlugin();

  const result = await plugin.validate({
    machineOutput: { payload: { data: null } },
    contract: {
      fieldTypes: { data: "string" },
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].field, "data");
  assert.equal(result.errors[0].message, "Expected string, received object");
});

test("validate passes null for object type even with requiredFields (issue #2017)", async () => {
  const plugin = createBasicEvaluatorPlugin();

  const result = await plugin.validate({
    machineOutput: { payload: { data: null } },
    contract: {
      requiredFields: ["data"],
      fieldTypes: { data: "object" },
    },
  });

  // null passes both requiredFields check (null != null is false) and object type check
  assert.equal(result.valid, true, "Bug: null passes object type even with requiredFields");
});

test("validate detects null vs number type mismatch (issue #2017)", async () => {
  const plugin = createBasicEvaluatorPlugin();

  const result = await plugin.validate({
    machineOutput: { payload: { count: null } },
    contract: {
      fieldTypes: { count: "number" },
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].message, "Expected number, received object");
});

test("validate handles null in array type check", async () => {
  const plugin = createBasicEvaluatorPlugin();

  const result = await plugin.validate({
    machineOutput: { payload: { items: null } },
    contract: {
      fieldTypes: { items: "array" },
    },
  });

  // null is typed as "object", not "array", so this should fail
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].message, "Expected array, received object");
});

test("validate handles boolean type correctly", async () => {
  const plugin = createBasicEvaluatorPlugin();

  const result = await plugin.validate({
    machineOutput: { payload: { active: null } },
    contract: {
      fieldTypes: { active: "boolean" },
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors[0].message, "Expected boolean, received object");
});

// =============================================================================
// Additional validation edge cases
// =============================================================================

test("validate does not check type if field is missing but not required", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    machineOutput: { payload: {} },
    contract: { fieldTypes: { field1: "string" } },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("validate handles multiple required fields", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    machineOutput: { payload: { field1: "value" } },
    contract: { requiredFields: ["field1", "field2"] },
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].field, "field2");
});

test("validate handles multiple type errors", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    machineOutput: { payload: { field1: 123, field2: true } },
    contract: { fieldTypes: { field1: "string", field2: "number" } },
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 2);
});

test("validate handles both missing and type errors", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    machineOutput: { payload: { field1: 123 } },
    contract: {
      requiredFields: ["field2"],
      fieldTypes: { field1: "string" },
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 2);
  assert.ok(result.errors.some((e) => e.field === "field1"));
  assert.ok(result.errors.some((e) => e.field === "field2"));
});

test("validate handles array type correctly", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    machineOutput: { payload: { field1: [1, 2, 3] } },
    contract: { fieldTypes: { field1: "array" } },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("validate handles object type correctly with actual object", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    machineOutput: { payload: { field1: { key: "value" } } },
    contract: { fieldTypes: { field1: "object" } },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("validate handles empty payload", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    machineOutput: { payload: {} },
    contract: {},
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.suggestions, []);
});

test("validate handles payload with undefined machineOutput", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    machineOutput: {},
    contract: { requiredFields: ["field1"] },
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].field, "field1");
});

test("validate handles undefined field values in payload", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    machineOutput: { payload: { field1: undefined } },
    contract: { requiredFields: ["field1"] },
  });

  // undefined is == null, so this should fail required field check
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].field, "field1");
});

test("validate handles nested object fields", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    machineOutput: {
      payload: {
        user: { name: "John", age: 30 },
      },
    },
    contract: {
      fieldTypes: { user: "object" },
    },
  });

  assert.equal(result.valid, true);
});

test("validate handles string type with actual string", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    machineOutput: { payload: { name: "test" } },
    contract: { fieldTypes: { name: "string" } },
  });

  assert.equal(result.valid, true);
});

test("validate handles number type with actual number", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    machineOutput: { payload: { count: 42 } },
    contract: { fieldTypes: { count: "number" } },
  });

  assert.equal(result.valid, true);
});

test("validate handles boolean type with actual boolean", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const result = await plugin.validate({
    machineOutput: { payload: { enabled: true } },
    contract: { fieldTypes: { enabled: "boolean" } },
  });

  assert.equal(result.valid, true);
});

// =============================================================================
// Extended evaluate() function tests (if available)
// =============================================================================

test("basic-evaluator has evaluate function on plugin", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const evaluateFn = (plugin as any).evaluate;

  assert.ok(typeof evaluateFn === "function", "Plugin should have evaluate function");
});

test("evaluate calculates quality score for valid output", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const evaluateFn = (plugin as any).evaluate;

  if (typeof evaluateFn !== "function") {
    // Skip if evaluate not available
    return;
  }

  const result = await evaluateFn({
    machineOutput: { payload: { summary: "all good", passed: true } },
    contract: {
      requiredFields: ["summary", "passed"],
      targetValues: { summary: "all good", passed: true },
      deviationThreshold: 0.1,
    },
  });

  assert.ok(result.qualityScore);
  assert.ok(typeof result.qualityScore.overall === "number");
  assert.ok(result.suggestions);
});

test("evaluate detects deviation from target values", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const evaluateFn = (plugin as any).evaluate;

  if (typeof evaluateFn !== "function") {
    return;
  }

  const result = await evaluateFn({
    machineOutput: { payload: { summary: "different text" } },
    contract: {
      targetValues: { summary: "target text" },
      deviationThreshold: 0.1,
    },
  });

  assert.ok(result.qualityScore);
  assert.ok(result.qualityScore.deviation > 0);
});

test("evaluate produces harness decision when available", async () => {
  const plugin = createBasicEvaluatorPlugin();
  const produceHarnessDecisionFn = (plugin as any).produceHarnessDecision;

  if (typeof produceHarnessDecisionFn !== "function") {
    return;
  }

  const decision = await produceHarnessDecisionFn({
    machineOutput: { payload: { summary: "test output" } },
    contract: {
      targetValues: { summary: "test output" },
      deviationThreshold: 0.1,
    },
  });

  assert.ok(decision.qualityScore);
  assert.ok(Array.isArray(decision.deviationAnalysis));
  assert.ok(Array.isArray(decision.riskAssessment));
  assert.ok(Array.isArray(decision.recommendations));
});