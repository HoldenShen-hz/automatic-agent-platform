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

test("CacheError", () => {
  const err = new CacheError("test message", "TEST_CODE", true);
  assert.equal(err.message, "test message");
  assert.equal(err.code, "TEST_CODE");
  assert.equal(err.retryable, true);
  assert.equal(err.name, "CacheError");
});

test("CacheSerializationError", () => {
  const err = new CacheSerializationError();
  assert.equal(err.code, "CACHE_SERIALIZATION_ERROR");
  assert.equal(err.retryable, false);
  assert.equal(err.name, "CacheSerializationError");
});

test("CacheSerializationError with custom message", () => {
  const err = new CacheSerializationError("custom message");
  assert.equal(err.message, "custom message");
});

test("CachePolicyError", () => {
  const err = new CachePolicyError();
  assert.equal(err.code, "CACHE_POLICY_ERROR");
  assert.equal(err.retryable, false);
  assert.equal(err.name, "CachePolicyError");
});

test("CachePayloadTooLargeError", () => {
  const err = new CachePayloadTooLargeError(1000, 500);
  assert.equal(err.code, "CACHE_PAYLOAD_TOO_LARGE");
  assert.ok(err.message.includes("1000"));
  assert.ok(err.message.includes("500"));
});

test("CacheNotFoundError", () => {
  const err = new CacheNotFoundError("my-ns", "my-key");
  assert.equal(err.code, "CACHE_NOT_FOUND");
  assert.ok(err.message.includes("my-ns"));
  assert.ok(err.message.includes("my-key"));
});

test("CacheExpiredError", () => {
  const err = new CacheExpiredError("ns", "key");
  assert.equal(err.code, "CACHE_EXPIRED");
  assert.ok(err.message.includes("ns"));
  assert.ok(err.message.includes("key"));
});

test("CacheVersionMismatchError", () => {
  const err = new CacheVersionMismatchError("ns", "key", "v1", "v2");
  assert.equal(err.code, "CACHE_VERSION_MISMATCH");
  assert.ok(err.message.includes("ns"));
  assert.ok(err.message.includes("key"));
  assert.ok(err.message.includes("v1"));
  assert.ok(err.message.includes("v2"));
});

test("CacheDisabledError", () => {
  const err = new CacheDisabledError("my-namespace");
  assert.equal(err.code, "CACHE_DISABLED");
  assert.ok(err.message.includes("my-namespace"));
});

test("CacheInitializationError", () => {
  const err = new CacheInitializationError("failed to connect");
  assert.equal(err.code, "CACHE_INITIALIZATION_ERROR");
  assert.equal(err.message, "failed to connect");
});

test("CacheError instances are distinct classes", () => {
  const err1 = new CacheError("a", "A", false);
  const err2 = new CacheError("a", "A", false);
  assert.ok(err1 instanceof Error);
  assert.ok(err1 instanceof CacheError);
  assert.ok(!(err1 === err2));
});
