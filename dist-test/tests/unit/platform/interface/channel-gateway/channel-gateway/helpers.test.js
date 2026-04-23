import assert from "node:assert/strict";
import test from "node:test";
import { parseMetadata, requireNonEmpty, readTrackedDeliveryPayload, } from "../../../../../../src/platform/interface/channel-gateway/helpers.js";
test("parseMetadata returns empty object for null", () => {
    assert.deepEqual(parseMetadata(null), {});
});
test("parseMetadata returns empty object for undefined-like input", () => {
    // parseMetadata only accepts string | null, so we test null behavior
    assert.deepEqual(parseMetadata(null), {});
});
test("parseMetadata parses valid JSON string", () => {
    const result = parseMetadata('{"key": "value", "num": 123}');
    assert.deepEqual(result, { key: "value", num: 123 });
});
test("parseMetadata returns empty object for empty string", () => {
    assert.deepEqual(parseMetadata(""), {});
});
test("parseMetadata returns empty object for invalid JSON", () => {
    assert.deepEqual(parseMetadata("not valid json"), {});
});
test("parseMetadata returns empty object for arrays", () => {
    assert.deepEqual(parseMetadata("[1, 2, 3]"), {});
});
test("parseMetadata returns empty object for primitives", () => {
    assert.deepEqual(parseMetadata("123"), {});
    assert.deepEqual(parseMetadata("\"string\""), {});
    assert.deepEqual(parseMetadata("true"), {});
});
test("parseMetadata handles nested objects", () => {
    const result = parseMetadata('{"outer": {"inner": "value"}}');
    assert.deepEqual(result, { outer: { inner: "value" } });
});
test("requireNonEmpty returns trimmed value for valid input", () => {
    assert.equal(requireNonEmpty("hello", "test.invalid"), "hello");
    assert.equal(requireNonEmpty("  hello  ", "test.invalid"), "hello");
});
test("requireNonEmpty throws for empty string", () => {
    assert.throws(() => requireNonEmpty("", "test.empty"), (e) => e.code === "test.empty");
});
test("requireNonEmpty throws for whitespace-only string", () => {
    assert.throws(() => requireNonEmpty("   ", "test.whitespace"), (e) => e.code === "test.whitespace");
});
test("readTrackedDeliveryPayload returns payload for valid input", () => {
    const payload = {
        targetId: "chat_123",
        text: "Hello world",
        metadata: { key: "value" },
    };
    const result = readTrackedDeliveryPayload(payload);
    assert.deepEqual(result, {
        targetId: "chat_123",
        text: "Hello world",
        metadata: { key: "value" },
    });
});
test("readTrackedDeliveryPayload returns null for missing targetId", () => {
    const payload = { text: "Hello" };
    assert.equal(readTrackedDeliveryPayload(payload), null);
});
test("readTrackedDeliveryPayload returns null for empty targetId", () => {
    const payload = { targetId: "", text: "Hello" };
    assert.equal(readTrackedDeliveryPayload(payload), null);
});
test("readTrackedDeliveryPayload returns null for whitespace-only targetId", () => {
    const payload = { targetId: "   ", text: "Hello" };
    assert.equal(readTrackedDeliveryPayload(payload), null);
});
test("readTrackedDeliveryPayload returns null for missing text", () => {
    const payload = { targetId: "chat_123" };
    assert.equal(readTrackedDeliveryPayload(payload), null);
});
test("readTrackedDeliveryPayload returns null for empty text", () => {
    const payload = { targetId: "chat_123", text: "" };
    assert.equal(readTrackedDeliveryPayload(payload), null);
});
test("readTrackedDeliveryPayload returns null for whitespace-only text", () => {
    const payload = { targetId: "chat_123", text: "   " };
    assert.equal(readTrackedDeliveryPayload(payload), null);
});
test("readTrackedDeliveryPayload returns null for invalid metadata type (array)", () => {
    const payload = { targetId: "chat_123", text: "Hello", metadata: [1, 2, 3] };
    assert.equal(readTrackedDeliveryPayload(payload), null);
});
test("readTrackedDeliveryPayload returns null for invalid metadata type (primitive)", () => {
    const payload = { targetId: "chat_123", text: "Hello", metadata: "string" };
    assert.equal(readTrackedDeliveryPayload(payload), null);
});
test("readTrackedDeliveryPayload handles null metadata", () => {
    const payload = { targetId: "chat_123", text: "Hello", metadata: null };
    const result = readTrackedDeliveryPayload(payload);
    assert.deepEqual(result, { targetId: "chat_123", text: "Hello" });
});
test("readTrackedDeliveryPayload handles undefined metadata", () => {
    const payload = { targetId: "chat_123", text: "Hello", metadata: undefined };
    const result = readTrackedDeliveryPayload(payload);
    assert.deepEqual(result, { targetId: "chat_123", text: "Hello" });
});
test("readTrackedDeliveryPayload omits metadata when not provided", () => {
    const payload = { targetId: "chat_123", text: "Hello" };
    const result = readTrackedDeliveryPayload(payload);
    assert.deepEqual(result, { targetId: "chat_123", text: "Hello" });
});
//# sourceMappingURL=helpers.test.js.map