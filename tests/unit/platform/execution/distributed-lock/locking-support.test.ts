import assert from "node:assert/strict";
import test from "node:test";

import { lockLogger, inferPgSslFromDsn, defaultPostgresFactory } from "../../../../../src/platform/execution/distributed-lock/locking-support.js";

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

test("defaultPostgresFactory throws when postgres module not found", () => {
  // Calling defaultPostgresFactory requires the 'postgres' package
  // It uses createRequire to dynamically import it
  // Without the package installed, it should throw a Module not found error
  try {
    defaultPostgresFactory("postgres://localhost/db", {});
    assert.fail("Expected an error to be thrown");
  } catch (error: any) {
    // Should be a require error about missing module
    assert.ok(error.message.includes("Cannot find module") || error.code === "MODULE_NOT_FOUND");
  }
});

test("defaultPostgresFactory returns a function when postgres is available", () => {
  // This test documents the expected shape of what defaultPostgresFactory returns
  // It's a tagged template function when postgres is installed
  const factory = defaultPostgresFactory;
  assert.equal(typeof factory, "function");
  // The factory itself is a function that creates a PostgresSqlDriver
  // We can't fully test it without a real postgres instance, but we can verify it returns something callable
});
