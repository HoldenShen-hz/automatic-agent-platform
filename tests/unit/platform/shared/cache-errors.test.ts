import { test } from "node:test";
import assert from "node:assert/strict";
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
} from "../../../../src/platform/shared/cache/cache-errors.js";

test("CacheError - base error properties", () => {
  const error = new CacheError("test message", "TEST_CODE", true);

  assert.equal(error.message, "test message");
  assert.equal(error.code, "TEST_CODE");
  assert.equal(error.retryable, true);
  assert.equal(error.name, "CacheError");
});

test("CacheError - retryable defaults to false", () => {
  const error = new CacheError("test", "CODE");

  assert.equal(error.retryable, false);
});

test("CacheSerializationError - has correct code and name", () => {
  const error = new CacheSerializationError("custom message");

  assert.equal(error.message, "custom message");
  assert.equal(error.code, "CACHE_SERIALIZATION_ERROR");
  assert.equal(error.retryable, false);
  assert.equal(error.name, "CacheSerializationError");
});

test("CacheSerializationError - uses default message", () => {
  const error = new CacheSerializationError();

  assert.equal(error.message, "Failed to serialize cache value");
});

test("CachePolicyError - has correct code and name", () => {
  const error = new CachePolicyError("invalid policy");

  assert.equal(error.message, "invalid policy");
  assert.equal(error.code, "CACHE_POLICY_ERROR");
  assert.equal(error.name, "CachePolicyError");
});

test("CachePayloadTooLargeError - includes size information", () => {
  const error = new CachePayloadTooLargeError(1024, 512);

  assert.equal(error.message, "Cache payload size 1024 exceeds maximum 512");
  assert.equal(error.code, "CACHE_PAYLOAD_TOO_LARGE");
  assert.equal(error.name, "CachePayloadTooLargeError");
});

test("CacheNotFoundError - includes namespace and key", () => {
  const error = new CacheNotFoundError("my-namespace", "my-key");

  assert.equal(error.message, "Cache entry not found: my-namespace:my-key");
  assert.equal(error.code, "CACHE_NOT_FOUND");
  assert.equal(error.name, "CacheNotFoundError");
});

test("CacheExpiredError - includes namespace and key", () => {
  const error = new CacheExpiredError("my-namespace", "my-key");

  assert.equal(error.message, "Cache entry expired: my-namespace:my-key");
  assert.equal(error.code, "CACHE_EXPIRED");
  assert.equal(error.name, "CacheExpiredError");
});

test("CacheVersionMismatchError - includes version info", () => {
  const error = new CacheVersionMismatchError("ns", "key", "1.0", "2.0");

  assert.equal(error.message, "Cache version mismatch for ns:key: expected 1.0, got 2.0");
  assert.equal(error.code, "CACHE_VERSION_MISMATCH");
  assert.equal(error.name, "CacheVersionMismatchError");
});

test("CacheDisabledError - includes namespace", () => {
  const error = new CacheDisabledError("my-namespace");

  assert.equal(error.message, "Cache is disabled for namespace: my-namespace");
  assert.equal(error.code, "CACHE_DISABLED");
  assert.equal(error.name, "CacheDisabledError");
});

test("CacheInitializationError - passes message through", () => {
  const error = new CacheInitializationError("failed to connect");

  assert.equal(error.message, "failed to connect");
  assert.equal(error.code, "CACHE_INITIALIZATION_ERROR");
  assert.equal(error.name, "CacheInitializationError");
});

test("Cache errors are instanceof Error", () => {
  assert.ok(new CacheError("test", "CODE") instanceof Error);
  assert.ok(new CacheSerializationError() instanceof Error);
  assert.ok(new CachePolicyError() instanceof Error);
  assert.ok(new CachePayloadTooLargeError(1, 2) instanceof Error);
  assert.ok(new CacheNotFoundError("n", "k") instanceof Error);
  assert.ok(new CacheExpiredError("n", "k") instanceof Error);
  assert.ok(new CacheVersionMismatchError("n", "k", "e", "a") instanceof Error);
  assert.ok(new CacheDisabledError("n") instanceof Error);
  assert.ok(new CacheInitializationError("test") instanceof Error);
});