/**
 * Unit tests for Billing Utils
 */

import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { assertIdentifier, assertPositiveNumber, roundCurrency, monthWindow } from "../../../../src/scale-ecosystem/billing/utils.js";

test("assertIdentifier accepts valid identifiers [utils]", () => {
  const result = assertIdentifier("valid-id_123.456", "test.code");
  assert.strictEqual(result, "valid-id_123.456");
});

test("assertIdentifier accepts identifiers at min length [utils]", () => {
  const result = assertIdentifier("ab", "test.code");
  assert.strictEqual(result, "ab");
});

test("assertIdentifier accepts identifiers at max length [utils]", () => {
  const longId = "a".repeat(128);
  const result = assertIdentifier(longId, "test.code");
  assert.strictEqual(result, longId);
});

test("assertIdentifier rejects identifiers shorter than min length [utils]", () => {
  assert.throws(() => {
    assertIdentifier("a", "test.code");
  }, /test.code/);
});

test("assertIdentifier rejects identifiers longer than max length [utils]", () => {
  const longId = "a".repeat(129);
  assert.throws(() => {
    assertIdentifier(longId, "test.code");
  }, /test.code/);
});

test("assertIdentifier rejects identifiers with invalid characters [utils]", () => {
  assert.throws(() => {
    assertIdentifier("invalid id", "test.code");
  }, /test.code/);
});

test("assertIdentifier accepts identifiers starting with allowed punctuation [utils]", () => {
  const result = assertIdentifier("-invalid", "test.code");
  assert.strictEqual(result, "-invalid");
});

test("assertPositiveNumber accepts positive numbers [utils]", () => {
  const result = assertPositiveNumber(42, "test.code");
  assert.strictEqual(result, 42);
});

test("assertPositiveNumber accepts small positive numbers [utils]", () => {
  const result = assertPositiveNumber(0.0001, "test.code");
  assert.strictEqual(result, 0.0001);
});

test("assertPositiveNumber rejects zero [utils]", () => {
  assert.throws(() => {
    assertPositiveNumber(0, "test.code");
  }, /test.code/);
});

test("assertPositiveNumber rejects negative numbers [utils]", () => {
  assert.throws(() => {
    assertPositiveNumber(-1, "test.code");
  }, /test.code/);
});

test("assertPositiveNumber rejects Infinity [utils]", () => {
  assert.throws(() => {
    assertPositiveNumber(Infinity, "test.code");
  }, /test.code/);
});

test("assertPositiveNumber rejects NaN [utils]", () => {
  assert.throws(() => {
    assertPositiveNumber(NaN, "test.code");
  }, /test.code/);
});

test("roundCurrency rounds to 4 decimal places [utils]", () => {
  assert.strictEqual(roundCurrency(1.12345), 1.1235);
  assert.strictEqual(roundCurrency(1.12344), 1.1234);
  assert.strictEqual(roundCurrency(1.5), 1.5);
  assert.strictEqual(roundCurrency(0.00001), 0);
  assert.strictEqual(roundCurrency(0.00009), 0.0001);
});

test("roundCurrency handles whole numbers [utils]", () => {
  assert.strictEqual(roundCurrency(100), 100);
  assert.strictEqual(roundCurrency(0), 0);
});

test("monthWindow calculates correct window for January [utils]", () => {
  const result = monthWindow("2025-01-15T12:00:00Z");

  assert.strictEqual(result.periodId, "2025-01");
  assert.ok(result.start.includes("2025-01-01T00:00:00"));
  assert.ok(result.end.includes("2025-02-01T00:00:00"));
});

test("monthWindow calculates correct window for December [utils]", () => {
  const result = monthWindow("2025-12-31T23:59:59Z");

  assert.strictEqual(result.periodId, "2025-12");
  assert.ok(result.start.includes("2025-12-01T00:00:00"));
  assert.ok(result.end.includes("2026-01-01T00:00:00"));
});

test("monthWindow handles leap year February [utils]", () => {
  const result = monthWindow("2024-02-15T12:00:00Z");

  assert.strictEqual(result.periodId, "2024-02");
  assert.ok(result.end.includes("2024-03-01T00:00:00"));
});

test("monthWindow rejects invalid timestamp [utils]", () => {
  assert.throws(() => {
    monthWindow("not-a-date");
  }, /Invalid timestamp/);
});

test("monthWindow rejects empty string [utils]", () => {
  assert.throws(() => {
    monthWindow("");
  }, /Invalid timestamp/);
});
