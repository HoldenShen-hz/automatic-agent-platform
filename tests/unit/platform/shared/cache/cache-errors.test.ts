import assert from "node:assert/strict";
import test from "node:test";

import {
  CacheError,
  CacheSerializationError,
  CachePolicyError,
  CachePayloadTooLargeError,
  CacheNotFoundError,
  CacheExpiredError,
  CacheVersionMismatchError,
  CacheDisabledError,
  CacheInitializationError,
} from "../../../../../src/platform/shared/cache/cache-errors.js";

test("CacheError has correct properties", () => {
  const error = new CacheError("test message", "TEST_CODE", true);
  assert.equal(error.message, "test message");
  assert.equal(error.code, "TEST_CODE");
  assert.equal(error.retryable, true);
  assert.equal(error.name, "CacheError");
});

test("CacheError defaults retryable to false", () => {
  const error = new CacheError("test", "CODE");
  assert.equal(error.retryable, false);
});

test("CacheSerializationError has correct code", () => {
  const error = new CacheSerializationError();
  assert.equal(error.code, "CACHE_SERIALIZATION_ERROR");
  assert.equal(error.retryable, false);
  assert.equal(error.name, "CacheSerializationError");
});

test("CacheSerializationError accepts custom message", () => {
  const error = new CacheSerializationError("custom serialization error");
  assert.equal(error.message, "custom serialization error");
});

test("CachePolicyError has correct code", () => {
  const error = new CachePolicyError();
  assert.equal(error.code, "CACHE_POLICY_ERROR");
  assert.equal(error.retryable, false);
  assert.equal(error.name, "CachePolicyError");
});

test("CachePolicyError accepts custom message", () => {
  const error = new CachePolicyError("invalid policy config");
  assert.equal(error.message, "invalid policy config");
});

test("CachePayloadTooLargeError shows size info", () => {
  const error = new CachePayloadTooLargeError(1000, 500);
  assert.ok(error.message.includes("1000"));
  assert.ok(error.message.includes("500"));
  assert.equal(error.code, "CACHE_PAYLOAD_TOO_LARGE");
});

test("CacheNotFoundError includes namespace and key", () => {
  const error = new CacheNotFoundError("my-namespace", "my-key");
  assert.ok(error.message.includes("my-namespace"));
  assert.ok(error.message.includes("my-key"));
  assert.equal(error.code, "CACHE_NOT_FOUND");
});

test("CacheExpiredError includes namespace and key", () => {
  const error = new CacheExpiredError("ns", "key");
  assert.ok(error.message.includes("ns"));
  assert.ok(error.message.includes("key"));
  assert.equal(error.code, "CACHE_EXPIRED");
});

test("CacheVersionMismatchError shows expected vs actual", () => {
  const error = new CacheVersionMismatchError("ns", "key", "v1", "v2");
  assert.ok(error.message.includes("v1"));
  assert.ok(error.message.includes("v2"));
  assert.equal(error.code, "CACHE_VERSION_MISMATCH");
});

test("CacheDisabledError includes namespace", () => {
  const error = new CacheDisabledError("disabled-ns");
  assert.ok(error.message.includes("disabled-ns"));
  assert.equal(error.code, "CACHE_DISABLED");
});

test("CacheInitializationError accepts custom message", () => {
  const error = new CacheInitializationError("failed to connect");
  assert.equal(error.message, "failed to connect");
  assert.equal(error.code, "CACHE_INITIALIZATION_ERROR");
});

test("All cache errors are instances of Error", () => {
  assert.ok(new CacheError("t", "c") instanceof Error);
  assert.ok(new CacheSerializationError() instanceof Error);
  assert.ok(new CachePolicyError() instanceof Error);
  assert.ok(new CachePayloadTooLargeError(1, 2) instanceof Error);
  assert.ok(new CacheNotFoundError("n", "k") instanceof Error);
  assert.ok(new CacheExpiredError("n", "k") instanceof Error);
  assert.ok(new CacheVersionMismatchError("n", "k", "e", "a") instanceof Error);
  assert.ok(new CacheDisabledError("n") instanceof Error);
  assert.ok(new CacheInitializationError("m") instanceof Error);
});

test("All cache errors have correct name property", () => {
  assert.equal(new CacheError("t", "c").name, "CacheError");
  assert.equal(new CacheSerializationError().name, "CacheSerializationError");
  assert.equal(new CachePolicyError().name, "CachePolicyError");
  assert.equal(new CachePayloadTooLargeError(1, 2).name, "CachePayloadTooLargeError");
  assert.equal(new CacheNotFoundError("n", "k").name, "CacheNotFoundError");
  assert.equal(new CacheExpiredError("n", "k").name, "CacheExpiredError");
  assert.equal(new CacheVersionMismatchError("n", "k", "e", "a").name, "CacheVersionMismatchError");
  assert.equal(new CacheDisabledError("n").name, "CacheDisabledError");
  assert.equal(new CacheInitializationError("m").name, "CacheInitializationError");
});
