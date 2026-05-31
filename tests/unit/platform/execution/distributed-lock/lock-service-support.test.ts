import assert from "node:assert/strict";
import test from "node:test";

import { lockLogger, inferPgSslFromDsn, defaultPostgresFactory } from "../../../../../src/platform/five-plane-execution/distributed-lock/locking-support.js";

test("lockLogger is a StructuredLogger instance [lock-service-support]", () => {
  assert.ok(lockLogger);
  assert.equal(typeof lockLogger.log, "function");
});

test("inferPgSslFromDsn returns null for invalid URL [lock-service-support]", () => {
  const result = inferPgSslFromDsn("not-a-valid-url");
  assert.equal(result, null);
});

test("inferPgSslFromDsn returns null for URL without sslmode [lock-service-support]", () => {
  const result = inferPgSslFromDsn("postgres://localhost:5432/db");
  assert.equal(result, null);
});

test("inferPgSslFromDsn returns null for sslmode not set to require [lock-service-support]", () => {
  const result = inferPgSslFromDsn("postgres://localhost:5432/db?sslmode=disable");
  assert.equal(result, null);
});

test("inferPgSslFromDsn returns object for sslmode=require [lock-service-support]", () => {
  const result = inferPgSslFromDsn("postgres://localhost:5432/db?sslmode=require");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn is case insensitive for sslmode key [lock-service-support]", () => {
  const result = inferPgSslFromDsn("postgres://localhost:5432/db?SSLMODE=require");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn is case insensitive for sslmode value [lock-service-support]", () => {
  const result = inferPgSslFromDsn("postgres://localhost:5432/db?sslmode=REQUIRE");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn trims whitespace from sslmode value [lock-service-support]", () => {
  const result = inferPgSslFromDsn("postgres://localhost:5432/db?sslmode= require ");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn handles multiple query params [lock-service-support]", () => {
  const result = inferPgSslFromDsn("postgres://localhost:5432/db?connect_timeout=10&sslmode=require&application_name=test");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn returns null for empty URL [lock-service-support]", () => {
  const result = inferPgSslFromDsn("");
  assert.equal(result, null);
});

test("defaultPostgresFactory is a function [lock-service-support]", () => {
  assert.equal(typeof defaultPostgresFactory, "function");
});

test("lockLogger.log can be called with data object [lock-service-support]", () => {
  assert.doesNotThrow(() => {
    // This should not throw
    lockLogger.log({
      level: "info",
      message: "test message",
      data: { key: "value" },
    });
  });
});

test("lockLogger.log can be called with string data [lock-service-support]", () => {
  assert.doesNotThrow(() => {
    // This should not throw
    lockLogger.log({
      level: "warn",
      message: "test warning",
      data: "string data",
    });
  });
});

test("lockLogger.log can be called with error [lock-service-support]", () => {
  assert.doesNotThrow(() => {
    const error = new Error("test error");
    // This should not throw
    lockLogger.log({
      level: "error",
      message: "test error",
      data: { error },
    });
  });
});

test("inferPgSslFromDsn handles URL with port [lock-service-support]", () => {
  const result = inferPgSslFromDsn("postgres://localhost:5432/db?sslmode=require");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn handles sslmode with other params first [lock-service-support]", () => {
  const result = inferPgSslFromDsn("postgres://localhost:5432/db?other=value&sslmode=require");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn handles sslmode with special characters [lock-service-support]", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db?sslmode=require");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("lockLogger.log at debug level [lock-service-support]", () => {
  assert.doesNotThrow(() => {
    // This should not throw
    lockLogger.log({
      level: "debug",
      message: "debug message",
      data: { debugData: true },
    });
  });
});

test("lockLogger.log at info level [lock-service-support]", () => {
  assert.doesNotThrow(() => {
    // This should not throw
    lockLogger.log({
      level: "info",
      message: "info message",
      data: { infoData: true },
    });
  });
});

test("lockLogger.log at error level [lock-service-support]", () => {
  assert.doesNotThrow(() => {
    // This should not throw
    lockLogger.log({
      level: "error",
      message: "error message",
      data: { errorData: true },
    });
  });
});
