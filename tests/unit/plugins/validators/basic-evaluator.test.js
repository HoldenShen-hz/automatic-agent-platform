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
test("validate handles object type correctly", async () => {
    const plugin = createBasicEvaluatorPlugin();
    const result = await plugin.validate({
        machineOutput: { payload: { field1: null } },
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
//# sourceMappingURL=basic-evaluator.test.js.map