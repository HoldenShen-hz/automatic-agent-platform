import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  parseMetadata,
  requireNonEmpty,
  readTrackedDeliveryPayload,
} from "../../../../src/platform/five-plane-interface/channel-gateway/helpers.js";

test("parseMetadata returns empty object for null input", () => {
  const result = parseMetadata(null);
  assert.deepEqual(result, {});
});

test("parseMetadata returns empty object for undefined input", () => {
  const result = parseMetadata(undefined as unknown as string);
  assert.deepEqual(result, {});
});

test("parseMetadata parses valid JSON object", () => {
  const result = parseMetadata('{"key":"value","num":42}');
  assert.deepEqual(result, { key: "value", num: 42 });
});

test("parseMetadata returns empty object for JSON array", () => {
  const result = parseMetadata('["a","b","c"]');
  assert.deepEqual(result, {});
});

test("parseMetadata returns empty object for JSON primitives", () => {
  assert.deepEqual(parseMetadata('"string"'), {});
  assert.deepEqual(parseMetadata("123"), {});
  assert.deepEqual(parseMetadata("true"), {});
});

test("parseMetadata returns empty object for invalid JSON", () => {
  const result = parseMetadata("not valid json {{{");
  assert.deepEqual(result, {});
});

test("parseMetadata handles nested objects", () => {
  const result = parseMetadata('{"outer":{"inner":"value"},"arr":[1,2,3]}');
  assert.deepEqual(result, { outer: { inner: "value" }, arr: [1, 2, 3] });
});

test("requireNonEmpty returns trimmed non-empty string", () => {
  const result = requireNonEmpty("  hello world  ", "test.code");
  assert.equal(result, "hello world");
});

test("requireNonEmpty rejects empty string", () => {
  assert.throws(
    () => requireNonEmpty("", "empty.code"),
    /empty.code/,
  );
});

test("requireNonEmpty rejects whitespace-only string", () => {
  assert.throws(
    () => requireNonEmpty("   \t\n  ", "whitespace.code"),
    /whitespace.code/,
  );
});

test("requireNonEmpty rejects string with only spaces", () => {
  assert.throws(
    () => requireNonEmpty("   ", "spaces.code"),
    /spaces.code/,
  );
});

test("requireNonEmpty passes code in error details", () => {
  try {
    requireNonEmpty("", "my_error_code");
    assert.fail("should have thrown");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("my_error_code"));
  }
});

test("readTrackedDeliveryPayload returns null for missing targetId", () => {
  const result = readTrackedDeliveryPayload({ text: "hello" });
  assert.equal(result, null);
});

test("readTrackedDeliveryPayload returns null for empty targetId", () => {
  const result = readTrackedDeliveryPayload({ targetId: "", text: "hello" });
  assert.equal(result, null);
});

test("readTrackedDeliveryPayload returns null for whitespace targetId", () => {
  const result = readTrackedDeliveryPayload({ targetId: "   ", text: "hello" });
  assert.equal(result, null);
});

test("readTrackedDeliveryPayload returns null for missing text", () => {
  const result = readTrackedDeliveryPayload({ targetId: "target_123" });
  assert.equal(result, null);
});

test("readTrackedDeliveryPayload returns null for empty text", () => {
  const result = readTrackedDeliveryPayload({ targetId: "target_123", text: "" });
  assert.equal(result, null);
});

test("readTrackedDeliveryPayload returns null for whitespace-only text", () => {
  const result = readTrackedDeliveryPayload({ targetId: "target_123", text: "  \t\n  " });
  assert.equal(result, null);
});

test("readTrackedDeliveryPayload returns null for non-object metadata", () => {
  const result = readTrackedDeliveryPayload({ targetId: "target_123", text: "hello", metadata: "string" });
  assert.equal(result, null);
});

test("readTrackedDeliveryPayload returns null for array metadata", () => {
  const result = readTrackedDeliveryPayload({ targetId: "target_123", text: "hello", metadata: [1, 2, 3] });
  assert.equal(result, null);
});

test("readTrackedDeliveryPayload returns valid payload with targetId and text", () => {
  const result = readTrackedDeliveryPayload({ targetId: "target_123", text: "hello world" });
  assert.deepEqual(result, { targetId: "target_123", text: "hello world" });
});

test("readTrackedDeliveryPayload returns valid payload with metadata object", () => {
  const payload = { targetId: "target_123", text: "hello", metadata: { webhookUrl: "https://example.com" } };
  const result = readTrackedDeliveryPayload(payload);
  assert.deepEqual(result, {
    targetId: "target_123",
    text: "hello",
    metadata: { webhookUrl: "https://example.com" },
  });
});

test("readTrackedDeliveryPayload handles null metadata as valid", () => {
  const result = readTrackedDeliveryPayload({ targetId: "target_123", text: "hello", metadata: null });
  assert.deepEqual(result, { targetId: "target_123", text: "hello" });
});

test("readTrackedDeliveryPayload handles undefined metadata as valid", () => {
  const result = readTrackedDeliveryPayload({ targetId: "target_123", text: "hello", metadata: undefined });
  assert.deepEqual(result, { targetId: "target_123", text: "hello" });
});

test("readTrackedDeliveryPayload trims targetId and text", () => {
  const result = readTrackedDeliveryPayload({ targetId: "  target_123  ", text: "  hello  " });
  assert.equal(result?.targetId, "target_123");
  assert.equal(result?.text, "hello");
});