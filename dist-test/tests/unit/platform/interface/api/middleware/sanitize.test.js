import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeJsonValue } from "../../../../../../src/platform/interface/api/middleware/sanitize.js";
function keysOf(obj) {
    return Object.keys(obj).sort();
}
function valuesOf(obj) {
    return keysOf(obj).map((k) => obj[k]);
}
test("sanitizeJsonValue returns primitives unchanged", () => {
    assert.equal(sanitizeJsonValue("hello"), "hello");
    assert.equal(sanitizeJsonValue(42), 42);
    assert.equal(sanitizeJsonValue(true), true);
    assert.equal(sanitizeJsonValue(null), null);
    assert.equal(sanitizeJsonValue(undefined), undefined);
});
test("sanitizeJsonValue returns arrays with sanitized elements", () => {
    const input = ["a", "b", 1, 2];
    const result = sanitizeJsonValue(input);
    assert.deepEqual(result, ["a", "b", 1, 2]);
});
test("sanitizeJsonValue handles nested arrays", () => {
    const input = [[1, 2], [3, 4]];
    const result = sanitizeJsonValue(input);
    assert.deepEqual(result, [[1, 2], [3, 4]]);
});
test("sanitizeJsonValue sanitizes object keys", () => {
    const input = { name: "Alice", age: 30 };
    const result = sanitizeJsonValue(input);
    assert.deepEqual(keysOf(result), ["age", "name"]);
    assert.deepEqual(valuesOf(result), [30, "Alice"]);
});
test("sanitizeJsonValue creates null-prototype objects", () => {
    const result = sanitizeJsonValue({ name: "Alice" });
    assert.equal(Object.getPrototypeOf(result), null);
});
test("sanitizeJsonValue throws on dangerous __proto__ key", () => {
    // Use JSON.parse to create an object where __proto__ is a regular string key
    // (direct object literal { __proto__: ... } sets the prototype, not a property)
    const malicious = JSON.parse('{"__proto__": {"admin": true}}');
    // Verify __proto__ is a regular property (not the prototype chain)
    assert.ok(Object.hasOwn(malicious, "__proto__"));
    assert.throws(() => sanitizeJsonValue(malicious), (err) => err.code === "api.invalid_json_key");
});
test("sanitizeJsonValue throws on dangerous prototype key", () => {
    assert.throws(() => sanitizeJsonValue({ prototype: { admin: true } }), (err) => err.code === "api.invalid_json_key");
});
test("sanitizeJsonValue throws on dangerous constructor key", () => {
    assert.throws(() => sanitizeJsonValue({ constructor: { admin: true } }), (err) => err.code === "api.invalid_json_key");
});
test("sanitizeJsonValue recursively sanitizes nested objects", () => {
    const input = {
        user: { name: "Bob", profile: { role: "admin" } },
        count: 5,
    };
    const result = sanitizeJsonValue(input);
    const user = result["user"];
    const profile = user["profile"];
    assert.deepEqual(keysOf(result).sort(), ["count", "user"]);
    assert.deepEqual(keysOf(user).sort(), ["name", "profile"]);
    assert.deepEqual(keysOf(profile), ["role"]);
    assert.equal(profile["role"], "admin");
});
test("sanitizeJsonValue sanitizes dangerous keys inside nested objects", () => {
    const nested = JSON.parse('{"outer": {"__proto__": {"evil": true}}}');
    assert.throws(() => sanitizeJsonValue(nested), (err) => err.code === "api.invalid_json_key");
});
test("sanitizeJsonValue throws with correct error metadata", () => {
    // Use JSON.parse to simulate actual JSON input where __proto__ becomes a string key
    const malicious = JSON.parse('{"__proto__": "attack"}');
    try {
        sanitizeJsonValue(malicious);
        assert.fail("should have thrown");
    }
    catch (err) {
        const appErr = err;
        assert.equal(appErr.code, "api.invalid_json_key");
        assert.equal(appErr.statusCode, 400);
        assert.equal(appErr.category, "validation");
        assert.equal(appErr.retryable, false);
        assert.ok(appErr.message.includes("__proto__"));
    }
});
test("sanitizeJsonValue handles empty object", () => {
    const result = sanitizeJsonValue({});
    assert.deepEqual(keysOf(result), []);
});
test("sanitizeJsonValue handles deeply nested structures", () => {
    const input = {
        level1: {
            level2: {
                level3: {
                    value: "deep",
                },
            },
        },
    };
    const result = sanitizeJsonValue(input);
    const l1 = result["level1"];
    const l2 = l1["level2"];
    const l3 = l2["level3"];
    assert.equal(l3["value"], "deep");
    assert.equal(Object.getPrototypeOf(result), null);
    assert.equal(Object.getPrototypeOf(l1), null);
});
test("sanitizeJsonValue handles mixed arrays with objects", () => {
    const input = [{ a: 1 }, "string", 42, { b: 2 }];
    const result = sanitizeJsonValue(input);
    assert.equal(result[1], "string");
    assert.equal(result[2], 42);
    const obj1 = result[0];
    const obj2 = result[3];
    assert.equal(obj1["a"], 1);
    assert.equal(obj2["b"], 2);
});
test("sanitizeJsonValue throws on dangerous key in array of objects", () => {
    const arr = JSON.parse('[{"__proto__": {"admin": true}}]');
    assert.throws(() => sanitizeJsonValue(arr), (err) => err.code === "api.invalid_json_key");
});
test("sanitizeJsonValue throws on dangerous constructor key in nested object in array", () => {
    assert.throws(() => sanitizeJsonValue({ items: [{ constructor: {} }] }), (err) => err.code === "api.invalid_json_key");
});
test("sanitizeJsonValue allows normal keys that happen to contain dangerous substrings", () => {
    // Keys that merely contain dangerous strings as substrings should still be allowed
    const result = sanitizeJsonValue({
        my_proto_value: 1,
        notprototype: 2,
        constructor_function: 3,
    });
    assert.deepEqual(keysOf(result).sort(), ["constructor_function", "my_proto_value", "notprototype"]);
    assert.deepEqual(valuesOf(result).sort(), [1, 2, 3]);
});
test("sanitizeJsonValue sanitizes arrays at all levels", () => {
    const input = { items: [{ a: 1 }, { b: 2 }] };
    const result = sanitizeJsonValue(input);
    const items = result["items"];
    assert.equal(items.length, 2);
    const obj1 = items[0];
    assert.equal(obj1["a"], 1);
});
test("sanitizeJsonValue handles null values in objects", () => {
    const input = { name: null, age: 30 };
    const result = sanitizeJsonValue(input);
    assert.equal(result["name"], null);
    assert.equal(result["age"], 30);
});
//# sourceMappingURL=sanitize.test.js.map