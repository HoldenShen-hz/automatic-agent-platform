import assert from "node:assert/strict";
import test from "node:test";

import { readValidatedJsonBody } from "../../../../../../src/platform/five-plane-interface/api/middleware/input-validation.js";

test("readValidatedJsonBody parses valid JSON and validates with parser", () => {
  const result = readValidatedJsonBody('{"id": 123, "name": "test"}', (data) => {
    const d = data as { id: number; name: string };
    return { parsedId: d.id, parsedName: d.name };
  });
  assert.deepEqual(result, { parsedId: 123, parsedName: "test" });
});

test("readValidatedJsonBody applies sanitize before validation", () => {
  assert.throws(
    () => readValidatedJsonBody('{"__proto__": {"admin": true}}', (data) => data),
    (err: unknown) => (err as { code?: string }).code === "api.invalid_json_key",
  );
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

test("readValidatedJsonBody with empty object body", () => {
  const result = readValidatedJsonBody('{}', (data) => data);
  assert.equal(Object.getPrototypeOf(result), null);
});

test("readValidatedJsonBody rejects nested dangerous key", () => {
  assert.throws(
    () => readValidatedJsonBody('{"user":{"constructor":{"admin":true}}}', (data) => data),
    (err: unknown) => (err as { code?: string }).code === "api.invalid_json_key",
  );
});

test("readValidatedJsonBody passes number through parser", () => {
  const result = readValidatedJsonBody('42', (data) => data);
  assert.equal(result, 42);
});

test("readValidatedJsonBody passes boolean through parser", () => {
  const result = readValidatedJsonBody('true', (data) => data);
  assert.equal(result, true);
});