import assert from "node:assert/strict";
import test from "node:test";

import { lockLogger, inferPgSslFromDsn } from "../../../../../src/platform/five-plane-execution/distributed-lock/locking-support.js";

test("lockLogger is a StructuredLogger instance", () => {
  assert.ok(lockLogger !== undefined);
  assert.equal(typeof lockLogger.log, "function");
});

test("lockLogger.log accepts an object with level and message", () => {
  // Should not throw
  lockLogger.log({ level: "info", message: "test message" });
  lockLogger.log({ level: "debug", message: "debug message" });
  lockLogger.log({ level: "warn", message: "warning message" });
  lockLogger.log({ level: "error", message: "error message" });
});

test("lockLogger.log accepts optional data field", () => {
  lockLogger.log({
    level: "info",
    message: "test message with data",
    data: { key: "value", count: 42 },
  });
});

test("lockLogger.log handles nested error objects", () => {
  lockLogger.log({
    level: "error",
    message: "error with cause",
    data: { err: new Error("underlying error") },
  });
});

test("lockLogger.log handles non-Error values in data", () => {
  lockLogger.log({
    level: "warn",
    message: "warning with mixed data",
    data: { count: 1, text: "hello", nested: { a: 1, b: 2 } },
  });
});

// inferPgSslFromDsn edge cases
test("inferPgSslFromDsn handles various sslmode values", () => {
  assert.deepEqual(inferPgSslFromDsn("postgres://host/db?sslmode=require"), { rejectUnauthorized: true });
  assert.equal(inferPgSslFromDsn("postgres://host/db?sslmode=disable"), null);
  assert.equal(inferPgSslFromDsn("postgres://host/db?sslmode=verify-full"), null);
  assert.equal(inferPgSslFromDsn("postgres://host/db?sslmode=prefer"), null);
});

test("inferPgSslFromDsn handles uppercase SSLMODE", () => {
  assert.deepEqual(inferPgSslFromDsn("postgres://host/db?SSLMODE=REQUIRE"), { rejectUnauthorized: true });
});

test("inferPgSslFromDsn handles encoded characters in URL", () => {
  // %20 is space, %3D is =
  assert.deepEqual(inferPgSslFromDsn("postgres://host/db?sslmode=%20require%20"), { rejectUnauthorized: true });
});

test("inferPgSslFromDsn returns null for empty sslmode value", () => {
  assert.equal(inferPgSslFromDsn("postgres://host/db?sslmode="), null);
});

test("inferPgSslFromDsn handles password with special characters in DSN", () => {
  // DSN with password containing special characters
  const dsn1 = "postgresql://user:p%40ssword@host/db?sslmode=require";
  assert.deepEqual(inferPgSslFromDsn(dsn1), { rejectUnauthorized: true });

  const dsn2 = "postgresql://user:p%2Fssword@host/db?sslmode=require";
  assert.deepEqual(inferPgSslFromDsn(dsn2), { rejectUnauthorized: true });
});

test("inferPgSslFromDsn returns null for unix socket DSN", () => {
  assert.equal(inferPgSslFromDsn("/var/run/postgresql/.s.PGSQL.5432"), null);
});

test("inferPgSslFromDsn handles multiple query parameters", () => {
  const dsn = "postgresql://user:pass@localhost:5432/mydb?connect_timeout=10&sslmode=require&application_name=testapp";
  assert.deepEqual(inferPgSslFromDsn(dsn), { rejectUnauthorized: true });
});

test("inferPgSslFromDsn returns null when sslmode is not in query string", () => {
  assert.equal(inferPgSslFromDsn("postgresql://user:pass@localhost:5432/db"), null);
});