import test from "node:test";
import assert from "node:assert/strict";
import { createBasicEvaluatorPlugin } from "../../../src/plugins/validators/basic-evaluator.js";
test("createBasicEvaluatorPlugin returns valid plugin structure", () => {
    const plugin = createBasicEvaluatorPlugin();
    assert.equal(plugin.pluginId, "plugin.core.basic-evaluator");
    assert.equal(plugin.domainId, "core");
    assert.equal(plugin.spiType, "validator");
    assert.deepEqual(plugin.capabilityIds, ["output.validate"]);
});
test("basic evaluator validates when all required fields present", async () => {
    const plugin = createBasicEvaluatorPlugin();
    const result = await plugin.validate({
        stepId: "step_1",
        machineOutput: {
            stepId: "step_1",
            outputRef: "output_1",
            payload: { name: "test", value: 42 },
        },
        contract: {
            requiredFields: ["name", "value"],
            fieldTypes: { name: "string", value: "number" },
        },
    });
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.suggestions, []);
});
test("basic evaluator returns error for missing required field", async () => {
    const plugin = createBasicEvaluatorPlugin();
    const result = await plugin.validate({
        stepId: "step_1",
        machineOutput: {
            stepId: "step_1",
            outputRef: "output_1",
            payload: { name: "test" },
        },
        contract: {
            requiredFields: ["name", "value"],
        },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.some((e) => e.field === "value" && e.message.includes('Missing required field "value"')));
    assert.ok(result.suggestions.some((s) => s.includes('Provide "value"')));
});
test("basic evaluator returns error for type mismatch", async () => {
    const plugin = createBasicEvaluatorPlugin();
    const result = await plugin.validate({
        stepId: "step_1",
        machineOutput: {
            stepId: "step_1",
            outputRef: "output_1",
            payload: { name: 123 },
        },
        contract: {
            fieldTypes: { name: "string" },
        },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.field === "name" && e.message.includes("Expected string")));
    assert.ok(result.suggestions.some((s) => s.includes('Normalize "name" to string')));
});
test("basic evaluator handles multiple type errors", async () => {
    const plugin = createBasicEvaluatorPlugin();
    const result = await plugin.validate({
        stepId: "step_1",
        machineOutput: {
            stepId: "step_1",
            outputRef: "output_1",
            payload: { count: "not a number", active: "not a boolean" },
        },
        contract: {
            fieldTypes: { count: "number", active: "boolean" },
        },
    });
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 2);
    assert.ok(result.errors.some((e) => e.field === "count"));
    assert.ok(result.errors.some((e) => e.field === "active"));
});
test("basic evaluator handles empty contract", async () => {
    const plugin = createBasicEvaluatorPlugin();
    const result = await plugin.validate({
        stepId: "step_1",
        machineOutput: {
            stepId: "step_1",
            outputRef: "output_1",
            payload: { anything: "goes" },
        },
        contract: {},
    });
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
});
test("basic evaluator handles null payload", async () => {
    const plugin = createBasicEvaluatorPlugin();
    const result = await plugin.validate({
        stepId: "step_1",
        machineOutput: {
            stepId: "step_1",
            outputRef: "output_1",
            payload: {},
        },
        contract: {
            requiredFields: [],
        },
    });
    assert.equal(result.valid, true);
});
test("basic evaluator ignores field type check when field is missing", async () => {
    const plugin = createBasicEvaluatorPlugin();
    const result = await plugin.validate({
        stepId: "step_1",
        machineOutput: {
            stepId: "step_1",
            outputRef: "output_1",
            payload: {},
        },
        contract: {
            fieldTypes: { missingField: "string" },
        },
    });
    // Missing fields should not cause type errors, just be skipped
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
});
test("basic evaluator handles array type correctly", async () => {
    const plugin = createBasicEvaluatorPlugin();
    const result = await plugin.validate({
        stepId: "step_1",
        machineOutput: {
            stepId: "step_1",
            outputRef: "output_1",
            payload: { items: [1, 2, 3] },
        },
        contract: {
            fieldTypes: { items: "array" },
        },
    });
    assert.equal(result.valid, true);
});
test("basic evaluator handles object type correctly", async () => {
    const plugin = createBasicEvaluatorPlugin();
    const result = await plugin.validate({
        stepId: "step_1",
        machineOutput: {
            stepId: "step_1",
            outputRef: "output_1",
            payload: { data: { nested: true } },
        },
        contract: {
            fieldTypes: { data: "object" },
        },
    });
    assert.equal(result.valid, true);
});
test("basic evaluator treats null value as object type", async () => {
    const plugin = createBasicEvaluatorPlugin();
    const result = await plugin.validate({
        stepId: "step_1",
        machineOutput: {
            stepId: "step_1",
            outputRef: "output_1",
            payload: { data: null },
        },
        contract: {
            fieldTypes: { data: "object" },
        },
    });
    assert.equal(result.valid, true);
});
test("basic evaluator has initialize method", async () => {
    const plugin = createBasicEvaluatorPlugin();
    assert.ok(plugin.initialize !== undefined);
    const result = await plugin.initialize();
    assert.equal(result, undefined);
});
test("basic evaluator has healthCheck method that returns true", async () => {
    const plugin = createBasicEvaluatorPlugin();
    assert.ok(plugin.healthCheck !== undefined);
    const result = await plugin.healthCheck();
    assert.equal(result, true);
});
test("basic evaluator has shutdown method", async () => {
    const plugin = createBasicEvaluatorPlugin();
    assert.ok(plugin.shutdown !== undefined);
    const result = await plugin.shutdown();
    assert.equal(result, undefined);
});
//# sourceMappingURL=basic-evaluator.test.js.map