import assert from "node:assert/strict";
import test from "node:test";

// Learn Pattern Detectors module barrel
import {
  detectLlmTruncation,
  detectModelHallucination,
  detectSchemaValidationLoop,
  detectToolPermissionDenial,
  FailurePatternSchema,
  FailurePatternTypeSchema,
} from "../../../../../../src/platform/orchestration/learn/pattern-detectors/index.js";

test("detectLlmTruncation is exported as function", () => {
  assert.equal(typeof detectLlmTruncation, "function");
});

test("detectModelHallucination is exported as function", () => {
  assert.equal(typeof detectModelHallucination, "function");
});

test("detectSchemaValidationLoop is exported as function", () => {
  assert.equal(typeof detectSchemaValidationLoop, "function");
});

test("detectToolPermissionDenial is exported as function", () => {
  assert.equal(typeof detectToolPermissionDenial, "function");
});

test("FailurePatternSchema is exported", () => {
  assert.ok(FailurePatternSchema !== undefined);
});

test("FailurePatternTypeSchema is exported", () => {
  assert.ok(FailurePatternTypeSchema !== undefined);
});

test("detectLlmTruncation can be called with valid input", () => {
  const result = detectLlmTruncation({ text: "", modelId: "test" });
  assert.ok(result !== undefined);
});

test("detectModelHallucination can be called with valid input", () => {
  const result = detectModelHallucination({ text: "", expectedFacts: [] });
  assert.ok(result !== undefined);
});

test("detectSchemaValidationLoop can be called with valid input", () => {
  const result = detectSchemaValidationLoop({ schemaAttempts: 0, maxRetries: 5 });
  assert.ok(result !== undefined);
});

test("detectToolPermissionDenial can be called with valid input", () => {
  const result = detectToolPermissionDenial({ toolName: "test", errorCode: "permission_denied" });
  assert.ok(result !== undefined);
});