import assert from "node:assert/strict";
import test from "node:test";

import { readValidatedJsonBody } from "../../../../../src/platform/interface/api/middleware/input-validation.js";

test("readValidatedJsonBody parses valid JSON body", () => {
  const body = '{"key": "value"}';
  const parser = (payload: unknown) => {
    if (typeof payload === "object" && payload !== null && "key" in payload) {
      return (payload as Record<string, string>)["key"];
    }
    throw new Error("Invalid payload");
  };
  const result = readValidatedJsonBody(body, parser);
  assert.equal(result, "value");
});

test("readValidatedJsonBody returns empty object for null body", () => {
  const parser = (payload: unknown) => payload;
  const result = readValidatedJsonBody(null, parser) as Record<string, unknown>;
  assert.equal(Object.keys(result).length, 0);
  assert.equal(Object.getPrototypeOf(result), null);
});

test("readValidatedJsonBody returns empty object for undefined body", () => {
  const parser = (payload: unknown) => payload;
  const result = readValidatedJsonBody(undefined, parser) as Record<string, unknown>;
  assert.equal(Object.keys(result).length, 0);
  assert.equal(Object.getPrototypeOf(result), null);
});

test("readValidatedJsonBody returns empty object for empty string body", () => {
  const parser = (payload: unknown) => payload;
  const result = readValidatedJsonBody("", parser) as Record<string, unknown>;
  assert.equal(Object.keys(result).length, 0);
  assert.equal(Object.getPrototypeOf(result), null);
});

test("readValidatedJsonBody sanitizes dangerous keys before parsing", () => {
  const body = '{"__proto__": "dangerous", "safe": "value"}';
  const parser = (payload: unknown) => payload;
  assert.throws(
    () => readValidatedJsonBody(body, parser),
    (err: unknown) => (err as Error).message.includes("reserved key")
  );
});

test("readValidatedJsonBody throws for invalid JSON", () => {
  const body = "not valid json";
  const parser = (payload: unknown) => payload;
  assert.throws(
    () => readValidatedJsonBody(body, parser),
    (err: unknown) => (err as Error).message.includes("valid JSON")
  );
});
