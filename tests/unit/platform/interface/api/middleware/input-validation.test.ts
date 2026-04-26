import assert from "node:assert/strict";
import test from "node:test";

import { readValidatedJsonBody } from "../../../../../src/platform/interface/api/middleware/input-validation.js";

test("readValidatedJsonBody parses valid JSON and validates with parser", () => {
  const result = readValidatedJsonBody('{"id": 123, "name": "test"}', (data) => {
    const d = data as { id: number; name: string };
    return { parsedId: d.id, parsedName: d.name };
  });
  assert.deepEqual(result, { parsedId: 123, parsedName: "test" });
});

test("readValidatedJsonBody applies sanitize before validation", () => {
  const result = readValidatedJsonBody('{"__proto__": {"admin": true}}', (data) => data);
  assert.fail("Should have thrown on dangerous key");
});

test("readValidatedJsonBody handles nested objects", () => {
  const result = readValidatedJsonBody('{"user": {"name": "Alice", "age": 30}}', (data) => {
    const d = data as { user: { name: string; age: number } };
    return d.user.name;
  });
  assert.equal(result, "Alice");
});

test("readValidatedJsonBody with array payload", () => {
  const result = readValidatedJsonBody('[1, 2, 3]', (data) => {
    return (data as number[]).reduce((a, b) => a + b, 0);
  });
  assert.equal(result, 6);
});

test("readValidatedJsonBody returns parser result directly", () => {
  const result = readValidatedJsonBody('"just-a-string"', (data) => data);
  assert.equal(result, "just-a-string");
});

test("readValidatedJsonBody with null body returns null", () => {
  const result = readValidatedJsonBody(null, (data) => data);
  assert.equal(result, null);
});

test("readValidatedJsonBody with undefined body returns undefined", () => {
  const result = readValidatedJsonBody(undefined, (data) => data);
  assert.equal(result, undefined);
});