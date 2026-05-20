/**
 * Remaining CLI Env Support Tests
 *
 * Tests for the CLI environment variable parser utilities.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  requiredEnv,
  optionalEnv,
  optionalNumber,
  optionalEnumValue,
  requiredEnumValue,
  parseStringArrayJson,
  parseObjectJson,
  parseBoolean,
  parseInteger,
  parseStringArrayFromCsv,
  parseCompatibilityJson,
  missingEnv,
  invalidEnv,
} from "../../../src/platform/five-plane-control-plane/config-center/remaining-cli-env-support.js";

test("requiredEnv returns value when present", () => {
  const result = requiredEnv({ TEST_VAR: "value" }, "TEST_VAR");
  assert.equal(result, "value");
});

test("requiredEnv throws missingEnv when variable is missing", () => {
  assert.throws(() => requiredEnv({}, "MISSING_VAR"), /missing_env:MISSING_VAR/);
});

test("requiredEnv throws missingEnv when value is empty", () => {
  assert.throws(() => requiredEnv({ TEST_VAR: "" }, "TEST_VAR"), /missing_env:TEST_VAR/);
});

test("requiredEnv trims whitespace from value", () => {
  const result = requiredEnv({ TEST_VAR: "  value  " }, "TEST_VAR");
  assert.equal(result, "value");
});

test("optionalEnv returns value when present", () => {
  const result = optionalEnv({ TEST_VAR: "value" }, "TEST_VAR");
  assert.equal(result, "value");
});

test("optionalEnv returns null when missing", () => {
  const result = optionalEnv({}, "MISSING_VAR");
  assert.equal(result, null);
});

test("optionalEnv returns null when empty", () => {
  const result = optionalEnv({ TEST_VAR: "" }, "TEST_VAR");
  assert.equal(result, null);
});

test("optionalNumber returns number when valid", () => {
  const result = optionalNumber({ TEST_VAR: "42" }, "TEST_VAR");
  assert.equal(result, 42);
});

test("optionalNumber returns null when missing", () => {
  const result = optionalNumber({}, "MISSING_VAR");
  assert.equal(result, null);
});

test("optionalNumber rejects non-finite values", () => {
  assert.throws(() => optionalNumber({ TEST_VAR: "NaN" }, "TEST_VAR"), /invalid_env:TEST_VAR/);
  assert.throws(() => optionalNumber({ TEST_VAR: "Infinity" }, "TEST_VAR"), /invalid_env:TEST_VAR/);
});

test("optionalEnumValue returns value when in allowed list", () => {
  const allowed = ["dev", "test", "prod"] as const;
  const result = optionalEnumValue({ TEST_VAR: "test" }, "TEST_VAR", allowed);
  assert.equal(result, "test");
});

test("optionalEnumValue returns null when missing", () => {
  const allowed = ["dev", "test", "prod"] as const;
  const result = optionalEnumValue({}, "MISSING_VAR", allowed);
  assert.equal(result, null);
});

test("optionalEnumValue throws when value not in allowed list", () => {
  const allowed = ["dev", "test", "prod"] as const;
  assert.throws(() => optionalEnumValue({ TEST_VAR: "invalid" }, "TEST_VAR", allowed), /invalid_env:TEST_VAR/);
});

test("requiredEnumValue returns value when in allowed list", () => {
  const allowed = ["dev", "test", "prod"] as const;
  const result = requiredEnumValue({ TEST_VAR: "prod" }, "TEST_VAR", allowed);
  assert.equal(result, "prod");
});

test("requiredEnumValue throws missingEnv when missing", () => {
  const allowed = ["dev", "test", "prod"] as const;
  assert.throws(() => requiredEnumValue({}, "MISSING_VAR", allowed), /missing_env:MISSING_VAR/);
});

test("requiredEnumValue throws invalidEnv when not in allowed list", () => {
  const allowed = ["dev", "test", "prod"] as const;
  assert.throws(() => requiredEnumValue({ TEST_VAR: "invalid" }, "TEST_VAR", allowed), /invalid_env:TEST_VAR/);
});

test("parseStringArrayJson parses valid JSON array", () => {
  const result = parseStringArrayJson({ TEST_VAR: '["a","b","c"]' }, "TEST_VAR", false);
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("parseStringArrayJson returns null when not required and missing", () => {
  const result = parseStringArrayJson({}, "MISSING_VAR", false);
  assert.equal(result, null);
});

test("parseStringArrayJson throws on invalid JSON", () => {
  assert.throws(() => parseStringArrayJson({ TEST_VAR: "not-json" }, "TEST_VAR", false), /invalid_env:TEST_VAR/);
});

test("parseStringArrayJson throws on non-array JSON", () => {
  assert.throws(() => parseStringArrayJson({ TEST_VAR: '{"a":"b"}' }, "TEST_VAR", false), /invalid_env:TEST_VAR/);
});

test("parseStringArrayJson throws on array with non-strings", () => {
  assert.throws(() => parseStringArrayJson({ TEST_VAR: '["a",123]' }, "TEST_VAR", false), /invalid_env:TEST_VAR/);
});

test("parseObjectJson parses valid JSON object", () => {
  const result = parseObjectJson({ TEST_VAR: '{"key":"value"}' }, "TEST_VAR");
  assert.deepEqual(result, { key: "value" });
});

test("parseObjectJson returns null when missing", () => {
  const result = parseObjectJson({}, "MISSING_VAR");
  assert.equal(result, null);
});

test("parseObjectJson throws on invalid JSON", () => {
  assert.throws(() => parseObjectJson({ TEST_VAR: "not-json" }, "TEST_VAR"), /invalid_env:TEST_VAR/);
});

test("parseObjectJson throws on array JSON", () => {
  assert.throws(() => parseObjectJson({ TEST_VAR: '["a","b"]' }, "TEST_VAR"), /invalid_env:TEST_VAR/);
});

test("parseObjectJson throws on null JSON", () => {
  assert.throws(() => parseObjectJson({ TEST_VAR: "null" }, "TEST_VAR"), /invalid_env:TEST_VAR/);
});

test("parseBoolean returns true for 'true' string", () => {
  const result = parseBoolean({ TEST_VAR: "true" }, "TEST_VAR");
  assert.equal(result, true);
});

test("parseBoolean returns true for '1' string", () => {
  const result = parseBoolean({ TEST_VAR: "1" }, "TEST_VAR");
  assert.equal(result, true);
});

test("parseBoolean returns false for 'false' string", () => {
  const result = parseBoolean({ TEST_VAR: "false" }, "TEST_VAR");
  assert.equal(result, false);
});

test("parseBoolean returns false for '0' string", () => {
  const result = parseBoolean({ TEST_VAR: "0" }, "TEST_VAR");
  assert.equal(result, false);
});

test("parseBoolean returns undefined when missing", () => {
  const result = parseBoolean({}, "MISSING_VAR");
  assert.equal(result, undefined);
});

test("parseBoolean accepts yes/no style truthy strings", () => {
  assert.equal(parseBoolean({ TEST_VAR: "yes" }, "TEST_VAR"), true);
  assert.equal(parseBoolean({ TEST_VAR: "on" }, "TEST_VAR"), true);
  assert.equal(parseBoolean({ TEST_VAR: "no" }, "TEST_VAR"), false);
  assert.equal(parseBoolean({ TEST_VAR: "off" }, "TEST_VAR"), false);
});

test("parseInteger parses valid integer string", () => {
  const result = parseInteger({ TEST_VAR: "42" }, "TEST_VAR");
  assert.equal(result, 42);
});

test("parseInteger returns undefined when missing", () => {
  const result = parseInteger({}, "MISSING_VAR");
  assert.equal(result, undefined);
});

test("parseInteger parses decimal by truncating", () => {
  // parseInteger uses Number.parseInt which truncates
  const result = parseInteger({ TEST_VAR: "42.5" }, "TEST_VAR");
  assert.equal(result, 42);
});

test("parseStringArrayFromCsv parses comma-separated values", () => {
  const result = parseStringArrayFromCsv({ TEST_VAR: "a,b,c" }, "TEST_VAR");
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("parseStringArrayFromCsv trims whitespace", () => {
  const result = parseStringArrayFromCsv({ TEST_VAR: "  a , b , c  " }, "TEST_VAR");
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("parseStringArrayFromCsv filters empty strings", () => {
  const result = parseStringArrayFromCsv({ TEST_VAR: "a,,b," }, "TEST_VAR");
  assert.deepEqual(result, ["a", "b"]);
});

test("parseStringArrayFromCsv returns null when missing", () => {
  const result = parseStringArrayFromCsv({}, "MISSING_VAR");
  assert.equal(result, null);
});

test("parseStringArrayFromCsv returns null for blank string", () => {
  // whitespace-only strings are trimmed to empty and return null
  const result = parseStringArrayFromCsv({ TEST_VAR: "   " }, "TEST_VAR");
  assert.equal(result, null);
});

test("parseCompatibilityJson parses valid compatibility object", () => {
  const result = parseCompatibilityJson({
    TEST_VAR: JSON.stringify({
      apiContract: "v1",
      permissionSurface: "admin",
      runtimeCapability: "exec",
    }),
  }, "TEST_VAR");
  assert.deepEqual(result, {
    apiContract: "v1",
    permissionSurface: "admin",
    runtimeCapability: "exec",
  });
});

test("parseCompatibilityJson returns null when missing", () => {
  const result = parseCompatibilityJson({}, "MISSING_VAR");
  assert.equal(result, null);
});

test("parseCompatibilityJson throws on missing fields", () => {
  assert.throws(
    () =>
      parseCompatibilityJson(
        { TEST_VAR: JSON.stringify({ apiContract: "v1" }) },
        "TEST_VAR",
      ),
    /invalid_env:TEST_VAR/,
  );
});

test("missingEnv throws ValidationError with correct code", () => {
  try {
    missingEnv("MY_VAR");
    assert.fail("Should throw");
  } catch (err: unknown) {
    const error = err as { message?: string };
    assert.ok(error.message?.includes("missing_env:MY_VAR"));
  }
});

test("invalidEnv throws ValidationError with correct code", () => {
  try {
    invalidEnv("MY_VAR");
    assert.fail("Should throw");
  } catch (err: unknown) {
    const error = err as { message?: string };
    assert.ok(error.message?.includes("invalid_env:MY_VAR"));
  }
});
