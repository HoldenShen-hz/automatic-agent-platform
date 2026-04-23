/**
 * Unit tests for slot-resolver utilities
 */
import assert from "node:assert/strict";
import test from "node:test";
import { resolveRequiredSlots } from "../../../../../src/interaction/nl-gateway/slot-resolver/index.js";
test("resolveRequiredSlots returns empty missing when all slots resolved", () => {
    const entities = [
        { entityType: "user", value: "alice", normalized: "alice", sourceSpan: [0, 5] },
        { entityType: "task", value: "report", normalized: "report", sourceSpan: [6, 12] },
    ];
    const result = resolveRequiredSlots(entities, ["user", "task"]);
    assert.equal(result.missing.length, 0);
    assert.deepEqual(result.resolved, { user: "alice", task: "report" });
});
test("resolveRequiredSlots identifies missing slots", () => {
    const entities = [
        { entityType: "user", value: "bob", normalized: "bob", sourceSpan: [0, 3] },
    ];
    const result = resolveRequiredSlots(entities, ["user", "task", "environment"]);
    assert.deepEqual(result.missing, ["task", "environment"]);
    assert.deepEqual(result.resolved, { user: "bob" });
});
test("resolveRequiredSlots handles empty entities", () => {
    const result = resolveRequiredSlots([], ["user", "task"]);
    assert.deepEqual(result.missing, ["user", "task"]);
    assert.deepEqual(result.resolved, {});
});
test("resolveRequiredSlots handles empty requiredEntityTypes", () => {
    const entities = [
        { entityType: "user", value: "charlie", normalized: "charlie", sourceSpan: [0, 7] },
    ];
    const result = resolveRequiredSlots(entities, []);
    assert.equal(result.missing.length, 0);
    assert.deepEqual(result.resolved, { user: "charlie" });
});
test("resolveRequiredSlots uses first entity when duplicate types", () => {
    const entities = [
        { entityType: "user", value: "first", normalized: "first_value", sourceSpan: [0, 5] },
        { entityType: "user", value: "second", normalized: "second_value", sourceSpan: [6, 12] },
    ];
    const result = resolveRequiredSlots(entities, ["user"]);
    assert.deepEqual(result.resolved, { user: "first_value" });
});
test("resolveRequiredSlots preserves normalized values", () => {
    const entities = [
        { entityType: "date", value: "2026-04-22", normalized: new Date("2026-04-22"), sourceSpan: [0, 10] },
        { entityType: "money", value: "$100", normalized: 100, sourceSpan: [11, 15] },
    ];
    const result = resolveRequiredSlots(entities, ["date", "money"]);
    assert.deepEqual(result.resolved.date, new Date("2026-04-22"));
    assert.equal(result.resolved.money, 100);
    assert.equal(result.missing.length, 0);
});
test("resolveRequiredSlots handles readonly entities array", () => {
    const entities = [
        { entityType: "env", value: "prod", normalized: "prod", sourceSpan: [0, 4] },
    ];
    const result = resolveRequiredSlots(entities, ["env"]);
    assert.equal(result.missing.length, 0);
    assert.deepEqual(result.resolved, { env: "prod" });
});
test("resolveRequiredSlots handles duplicate requiredEntityTypes", () => {
    const entities = [
        { entityType: "user", value: "alice", normalized: "alice", sourceSpan: [0, 5] },
    ];
    const result = resolveRequiredSlots(entities, ["user", "user", "task"]);
    assert.deepEqual(result.missing, ["task"]);
    assert.deepEqual(result.resolved, { user: "alice" });
});
test("resolveRequiredSlots handles empty string entityType", () => {
    const entities = [
        { entityType: "", value: "empty", normalized: "empty", sourceSpan: [0, 5] },
    ];
    const result = resolveRequiredSlots(entities, ["", "task"]);
    assert.deepEqual(result.missing, ["task"]);
    assert.deepEqual(result.resolved, { "": "empty" });
});
test("resolveRequiredSlots handles null normalized value", () => {
    const entities = [
        { entityType: "user", value: "null_user", normalized: null, sourceSpan: [0, 9] },
    ];
    const result = resolveRequiredSlots(entities, ["user"]);
    assert.equal(result.missing.length, 0);
    assert.strictEqual(result.resolved.user, null);
});
test("resolveRequiredSlots handles undefined normalized value", () => {
    const entities = [
        { entityType: "meta", value: "undef", normalized: undefined, sourceSpan: [0, 5] },
    ];
    const result = resolveRequiredSlots(entities, ["meta"]);
    assert.equal(result.missing.length, 0);
    assert.strictEqual(result.resolved.meta, undefined);
});
test("resolveRequiredSlots handles numeric entityType", () => {
    const entities = [
        { entityType: "123", value: "numeric_key", normalized: "numeric_key", sourceSpan: [0, 12] },
    ];
    const result = resolveRequiredSlots(entities, ["123", "456"]);
    assert.deepEqual(result.missing, ["456"]);
    assert.deepEqual(result.resolved, { "123": "numeric_key" });
});
test("resolveRequiredSlots handles mixed resolved and missing", () => {
    const entities = [
        { entityType: "user", value: "alice", normalized: "alice", sourceSpan: [0, 5] },
        { entityType: "task", value: "job", normalized: "job", sourceSpan: [6, 9] },
        { entityType: "user", value: "bob", normalized: "bob_replaced", sourceSpan: [10, 13] },
    ];
    const result = resolveRequiredSlots(entities, ["user", "env", "date"]);
    assert.deepEqual(result.missing, ["env", "date"]);
    assert.deepEqual(result.resolved, { user: "alice", task: "job" });
});
test("resolveRequiredSlots handles special characters in entityType", () => {
    const entities = [
        { entityType: "user-name.with/special", value: "special", normalized: "special", sourceSpan: [0, 7] },
    ];
    const result = resolveRequiredSlots(entities, ["user-name.with/special"]);
    assert.equal(result.missing.length, 0);
    assert.deepEqual(result.resolved, { "user-name.with/special": "special" });
});
test("resolveRequiredSlots handles zero requiredEntityTypes and multiple entities", () => {
    const entities = [
        { entityType: "a", value: "1", normalized: 1, sourceSpan: [0, 1] },
        { entityType: "b", value: "2", normalized: 2, sourceSpan: [1, 2] },
        { entityType: "c", value: "3", normalized: 3, sourceSpan: [2, 3] },
    ];
    const result = resolveRequiredSlots(entities, []);
    assert.equal(result.missing.length, 0);
    assert.deepEqual(result.resolved, { a: 1, b: 2, c: 3 });
});
//# sourceMappingURL=index.test.js.map