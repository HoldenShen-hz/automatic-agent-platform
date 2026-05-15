import assert from "node:assert/strict";
import test from "node:test";

import { lockLogger, inferPgSslFromDsn, defaultPostgresFactory } from "../../../../../src/platform/five-plane-execution/distributed-lock/locking-support.js";

test("lockLogger is available", () => {
  assert.ok(lockLogger);
  assert.equal(typeof lockLogger.log, "function");
});

test("inferPgSslFromDsn returns object for sslmode=require", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@host/db?sslmode=require");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn returns null for non-sslmode", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@host/db");
  assert.equal(result, null);
});

test("inferPgSslFromDsn returns null for sslmode=disable", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@host/db?sslmode=disable");
  assert.equal(result, null);
});

test("inferPgSslFromDsn returns null for empty DSN", () => {
  const result = inferPgSslFromDsn("");
  assert.equal(result, null);
});

test("inferPgSslFromDsn handles DSN without query params", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@host:5432/dbname");
  assert.equal(result, null);
});

test("inferPgSslFromDsn handles mixed case sslmode values", () => {
  // URL search params are case-sensitive, so only lowercase works
  const result1 = inferPgSslFromDsn("postgres://user:pass@host/db?sslmode=Require");
  const result2 = inferPgSslFromDsn("postgres://user:pass@host/db?sslmode=REQUIRE");
  assert.deepEqual(result1, { rejectUnauthorized: true });
  assert.deepEqual(result2, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn trims whitespace from sslmode value", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@host/db?sslmode=  require  ");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn returns null for invalid URL", () => {
  const result = inferPgSslFromDsn("not a valid url");
  assert.equal(result, null);
});

test("inferPgSslFromDsn returns null for missing sslmode param", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@host/db?other=value");
  assert.equal(result, null);
});

// =============================================================================
// defaultPostgresFactory tests
// =============================================================================

test("defaultPostgresFactory returns a callable factory function", () => {
  // This test verifies that defaultPostgresFactory returns a function
  // The returned function is a tagged template function when postgres is installed
  const factory = defaultPostgresFactory;
  assert.equal(typeof factory, "function");

  // Calling factory returns a driver (tagged template function)
  const driver = factory("postgres://localhost/db", { max: 1 });
  assert.equal(typeof driver, "function");
});
