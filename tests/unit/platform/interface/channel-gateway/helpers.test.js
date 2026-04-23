import assert from "node:assert/strict";
import test from "node:test";

import { parseMetadata, requireNonEmpty, readTrackedDeliveryPayload } from "../../../../../src/platform/interface/channel-gateway/helpers.js";

test("parseMetadata returns empty object for null", () => {
  assert.deepEqual(parseMetadata(null), {});
});

test("parseMetadata returns empty object for invalid JSON", () => {
  assert.deepEqual(parseMetadata("not valid json"), {});
});

test("parseMetadata returns empty object for empty string", () => {
  assert.deepEqual(parseMetadata(""), {});
});

test("parseMetadata parses valid JSON object", () => {
  const result = parseMetadata('{"key": "value", "num": 42}');
  assert.deepEqual(result, { key: "value", num: 42 });
});

test("parseMetadata returns empty object for non-object JSON (array)", () => {
  assert.deepEqual(parseMetadata("[1, 2, 3]"), {});
});

test("parseMetadata returns empty object for non-object JSON (primitive)", () => {
  assert.deepEqual(parseMetadata('"string"'), {});
});

test("requireNonEmpty returns trimmed non-empty string", () => {
  assert.equal(requireNonEmpty("  hello  ", "code"), "hello");
});

test("requireNonEmpty throws ValidationError for empty string", () => {
  assert.throws(
    () => requireNonEmpty("", "empty_code"),
    (err: unknown) => {
      if (err instanceof Error && "code" in err) {
        return (err as { code: string }).code === "empty_code";
      }
      return false;
    },
  );
});

test("requireNonEmpty throws ValidationError for whitespace-only string", () => {
  assert.throws(
    () => requireNonEmpty("   ", "whitespace_code"),
    (err: unknown) => {
      if (err instanceof Error && "code" in err) {
        return (err as { code: string }).code === "whitespace_code";
      }
      return false;
    },
  );
});

test("readTrackedDeliveryPayload returns null for missing targetId", () => {
  const payload = { text: "hello" };
  assert.equal(readTrackedDeliveryPayload(payload), null);
});

test("readTrackedDeliveryPayload returns null for empty targetId", () => {
  const payload = { targetId: "   ", text: "hello" };
  assert.equal(readTrackedDeliveryPayload(payload), null);
});

test("readTrackedDeliveryPayload returns null for missing text", () => {
  const payload = { targetId: "target-1" };
  assert.equal(readTrackedDeliveryPayload(payload), null);
});

test("readTrackedDeliveryPayload returns null for empty text", () => {
  const payload = { targetId: "target-1", text: "  " };
  assert.equal(readTrackedDeliveryPayload(payload), null);
});

test("readTrackedDeliveryPayload returns null for invalid metadata type", () => {
  const payload = { targetId: "target-1", text: "hello", metadata: "not an object" };
  assert.equal(readTrackedDeliveryPayload(payload), null);
});

test("readTrackedDeliveryPayload returns null for array metadata", () => {
  const payload = { targetId: "target-1", text: "hello", metadata: [1, 2, 3] };
  assert.equal(readTrackedDeliveryPayload(payload), null);
});

test("readTrackedDeliveryPayload returns valid payload without metadata", () => {
  const payload = { targetId: "target-1", text: "hello" };
  const result = readTrackedDeliveryPayload(payload);
  assert.equal(result?.targetId, "target-1");
  assert.equal(result?.text, "hello");
  assert.equal(result?.metadata, undefined);
});

test("readTrackedDeliveryPayload returns valid payload with metadata", () => {
  const payload = { targetId: "target-1", text: "hello", metadata: { webhookUrl: "https://example.com" } };
  const result = readTrackedDeliveryPayload(payload);
  assert.equal(result?.targetId, "target-1");
  assert.equal(result?.text, "hello");
  assert.deepEqual(result?.metadata, { webhookUrl: "https://example.com" });
});
