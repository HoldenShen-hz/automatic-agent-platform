/**
 * Unit tests for Channel Gateway Helpers - Additional edge cases
 * Tests for helpers.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { parseMetadata, requireNonEmpty, readTrackedDeliveryPayload } from "../../../../../src/platform/five-plane-interface/channel-gateway/helpers.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

test("parseMetadata handles boolean true", () => {
  const result = parseMetadata("true");
  assert.deepEqual(result, {});
});

test("parseMetadata handles boolean false", () => {
  const result = parseMetadata("false");
  assert.deepEqual(result, {});
});

test("parseMetadata handles number zero", () => {
  const result = parseMetadata("0");
  assert.deepEqual(result, {});
});

test("parseMetadata handles empty object string", () => {
  const result = parseMetadata("{}");
  assert.deepEqual(result, {});
});

test("parseMetadata handles nested objects", () => {
  const result = parseMetadata('{"level1":{"level2":{"level3":"value"}}}');
  assert.deepEqual(result, { level1: { level2: { level3: "value" } } });
});

test("requireNonEmpty returns original trimmed string", () => {
  const result = requireNonEmpty("  hello world  ", "test.code");
  assert.equal(result, "hello world");
});

test("requireNonEmpty returns single word trimmed", () => {
  const result = requireNonEmpty("word", "test.code");
  assert.equal(result, "word");
});

test("requireNonEmpty throws ValidationError with correct code", () => {
  try {
    requireNonEmpty("", "my.specific.code");
    assert.fail("Expected error to be thrown");
  } catch (error) {
    assert.ok(error instanceof ValidationError);
    assert.equal((error as ValidationError).code, "my.specific.code");
  }
});

test("requireNonEmpty throws for whitespace-only string", () => {
  try {
    requireNonEmpty(" \t\n ", "test.code");
    assert.fail("Expected error to be thrown");
  } catch (error) {
    assert.ok(error instanceof ValidationError);
  }
});

test("readTrackedDeliveryPayload handles missing targetId", () => {
  const payload: Record<string, unknown> = { text: "Hello" };
  const result = readTrackedDeliveryPayload(payload);
  assert.equal(result, null);
});

test("readTrackedDeliveryPayload handles missing text", () => {
  const payload: Record<string, unknown> = { targetId: "tgt-123" };
  const result = readTrackedDeliveryPayload(payload);
  assert.equal(result, null);
});

test("readTrackedDeliveryPayload handles whitespace-only targetId", () => {
  const payload: Record<string, unknown> = { targetId: "   ", text: "Hello" };
  const result = readTrackedDeliveryPayload(payload);
  assert.equal(result, null);
});

test("readTrackedDeliveryPayload handles whitespace-only text", () => {
  const payload: Record<string, unknown> = { targetId: "tgt-123", text: "   " };
  const result = readTrackedDeliveryPayload(payload);
  assert.equal(result, null);
});

test("readTrackedDeliveryPayload handles undefined metadata", () => {
  const payload: Record<string, unknown> = { targetId: "tgt-123", text: "Hello", metadata: undefined };
  const result = readTrackedDeliveryPayload(payload);
  assert.ok(result !== null);
  assert.equal(result!.targetId, "tgt-123");
  assert.equal(result!.text, "Hello");
});

test("readTrackedDeliveryPayload handles empty metadata object", () => {
  const payload: Record<string, unknown> = { targetId: "tgt-123", text: "Hello", metadata: {} };
  const result = readTrackedDeliveryPayload(payload);
  assert.ok(result !== null);
  assert.deepEqual(result!.metadata, {});
});

test("readTrackedDeliveryPayload handles nested metadata", () => {
  const payload: Record<string, unknown> = {
    targetId: "tgt-123",
    text: "Hello",
    metadata: { nested: { deep: { value: 42 } }, array: [1, 2, 3] },
  };
  const result = readTrackedDeliveryPayload(payload);
  assert.ok(result !== null);
  assert.deepEqual(result!.metadata, { nested: { deep: { value: 42 } }, array: [1, 2, 3] });
});
