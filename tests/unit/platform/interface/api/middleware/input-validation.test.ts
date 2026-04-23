import assert from "node:assert/strict";
import test from "node:test";

import { readValidatedJsonBody } from "../../../../../../src/platform/interface/api/middleware/input-validation.js";

interface TestPayload {
  name: string;
  age: number;
  email?: string;
}

function isAppError(err: unknown): err is { code: string; message: string } {
  return err !== null && typeof err === "object" && "message" in err;
}

test("readValidatedJsonBody parses valid JSON and validates", () => {
  const body = JSON.stringify({ name: "Alice", age: 30 });
  const result = readValidatedJsonBody<TestPayload>(body, (p) => {
    if (typeof p !== "object" || p === null) throw new Error("not an object");
    const obj = p as Record<string, unknown>;
    if (typeof obj["name"] !== "string") throw new Error("name must be string");
    if (typeof obj["age"] !== "number") throw new Error("age must be number");
    return obj as unknown as TestPayload;
  });

  assert.equal(result.name, "Alice");
  assert.equal(result.age, 30);
});

test("readValidatedJsonBody returns null-prototype empty object for null body", () => {
  // readJsonBody(null) returns {}, sanitizeJsonValue({}) returns null-prototype {}
  const result = readValidatedJsonBody(null, (p) => p);
  assert.equal(Object.getPrototypeOf(result as object), null);
});

test("readValidatedJsonBody returns null-prototype empty object for undefined body", () => {
  const result = readValidatedJsonBody(undefined, (p) => p);
  assert.equal(Object.getPrototypeOf(result as object), null);
});

test("readValidatedJsonBody returns null-prototype empty object for empty string body", () => {
  const result = readValidatedJsonBody("", (p) => p);
  assert.equal(Object.getPrototypeOf(result as object), null);
});

test("readValidatedJsonBody applies sanitizer before parser", () => {
  // Must use raw JSON string because JSON.stringify({__proto__:...}) returns '{}'
  const body = '{"__proto__":{"admin":true}}';
  assert.throws(
    () => readValidatedJsonBody(body, (p) => p),
    (err: unknown) => isAppError(err) && err.message.includes("reserved key"),
  );
});

test("readValidatedJsonBody applies sanitizer to nested dangerous keys", () => {
  const body = '{"user":{"__proto__":{"admin":true}}}';
  assert.throws(
    () => readValidatedJsonBody(body, (p) => p),
    (err: unknown) => isAppError(err) && err.message.includes("reserved key"),
  );
});

test("readValidatedJsonBody parser receives sanitized payload", () => {
  const body = JSON.stringify({ name: "  Bob  ", age: 25 });
  const result = readValidatedJsonBody<TestPayload>(body, (p) => {
    if (typeof p !== "object" || p === null) throw new Error("not an object");
    const obj = p as Record<string, unknown>;
    return {
      name: String(obj["name"]).trim(),
      age: Number(obj["age"]),
    } as TestPayload;
  });

  assert.equal(result.name, "Bob");
  assert.equal(result.age, 25);
});

test("readValidatedJsonBody throws when JSON is invalid", () => {
  const body = "not valid json{";
  assert.throws(
    () => readValidatedJsonBody(body, (p) => p),
    (err: unknown) => isAppError(err) && err.message.includes("valid JSON"),
  );
});

test("readValidatedJsonBody works with empty object body", () => {
  const body = "{}";
  const result = readValidatedJsonBody(body, (p) => p);
  assert.equal(Object.getPrototypeOf(result as object), null);
});

test("readValidatedJsonBody passes optional fields", () => {
  const body = JSON.stringify({ name: "Carol", age: 28, email: "carol@example.com" });
  const result = readValidatedJsonBody<TestPayload>(body, (p) => p as unknown as TestPayload);
  assert.equal(result.name, "Carol");
  assert.equal(result.age, 28);
  assert.equal(result.email, "carol@example.com");
});

test("readValidatedJsonBody sanitizer blocks constructor key", () => {
  const body = '{"constructor":{"admin":true}}';
  assert.throws(
    () => readValidatedJsonBody(body, (p) => p),
    (err: unknown) => isAppError(err) && err.message.includes("reserved key"),
  );
});

test("readValidatedJsonBody sanitizer blocks prototype key", () => {
  const body = '{"prototype":{"admin":true}}';
  assert.throws(
    () => readValidatedJsonBody(body, (p) => p),
    (err: unknown) => isAppError(err) && err.message.includes("reserved key"),
  );
});

test("readValidatedJsonBody sanitizer recursively checks nested objects", () => {
  const body = '{"outer":{"constructor":{}}}';
  assert.throws(
    () => readValidatedJsonBody(body, (p) => p),
    (err: unknown) => isAppError(err) && err.message.includes("reserved key"),
  );
});
