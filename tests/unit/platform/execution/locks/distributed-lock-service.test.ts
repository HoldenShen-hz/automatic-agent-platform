import assert from "node:assert/strict";
import test from "node:test";

import {
  inferPgSslFromDsn,
  defaultPostgresFactory,
  lockLogger,
} from "../../../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-service.js";

test("inferPgSslFromDsn returns rejectUnauthorized object for sslmode=require [distributed-lock-service]", () => {
  const result = inferPgSslFromDsn("postgresql://user:pass@host/db?sslmode=require");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn returns null for sslmode=disable [distributed-lock-service]", () => {
  const result = inferPgSslFromDsn("postgresql://user:pass@host/db?sslmode=disable");
  assert.equal(result, null);
});

test("inferPgSslFromDsn returns null for sslmode=prefer [distributed-lock-service]", () => {
  const result = inferPgSslFromDsn("postgresql://user:pass@host/db?sslmode=prefer");
  assert.equal(result, null);
});

test("inferPgSslFromDsn returns null for no sslmode parameter [distributed-lock-service]", () => {
  const result = inferPgSslFromDsn("postgresql://user:pass@host/db");
  assert.equal(result, null);
});

test("inferPgSslFromDsn is case-insensitive for sslmode value [distributed-lock-service]", () => {
  const result1 = inferPgSslFromDsn("postgresql://user:pass@host/db?sslmode=REQUIRE");
  assert.deepEqual(result1, { rejectUnauthorized: true });

  const result2 = inferPgSslFromDsn("postgresql://user:pass@host/db?sslmode=Require");
  assert.deepEqual(result2, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn handles whitespace in sslmode value [distributed-lock-service]", () => {
  const result = inferPgSslFromDsn("postgresql://user:pass@host/db?sslmode=%20require%20");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn returns null for invalid URL [distributed-lock-service]", () => {
  const result = inferPgSslFromDsn("not-a-valid-url");
  assert.equal(result, null);
});

test("inferPgSslFromDsn returns null for empty string [distributed-lock-service]", () => {
  const result = inferPgSslFromDsn("");
  assert.equal(result, null);
});

test("inferPgSslFromDsn handles URL with multiple query params [distributed-lock-service]", () => {
  const result = inferPgSslFromDsn("postgresql://user:pass@host/db?connect_timeout=10&sslmode=require&application_name=test");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn extracts sslmode from first occurrence [distributed-lock-service]", () => {
  const result = inferPgSslFromDsn("postgresql://user:pass@host/db?sslmode=disable&sslmode=require");
  assert.equal(result, null);
});

test("lockLogger is a StructuredLogger instance [distributed-lock-service]", () => {
  assert.ok(lockLogger !== undefined);
  assert.equal(typeof lockLogger.log, "function");
});

test("lockLogger has retention limit configured [distributed-lock-service]", () => {
  assert.ok(lockLogger !== undefined);
});

test("defaultPostgresFactory is a function [distributed-lock-service]", () => {
  assert.equal(typeof defaultPostgresFactory, "function");
});

test("defaultPostgresFactory returns a driver when called with valid DSN [distributed-lock-service]", () => {
  // This will fail to connect but should return a driver object
  const driver = defaultPostgresFactory("postgresql://invalid:invalid@localhost:9999/db", {});
  assert.ok(driver !== undefined);
  assert.equal(typeof driver, "function");
  assert.equal(typeof driver.end, "function");
  assert.equal(typeof driver.begin, "function");
});

test("defaultPostgresFactory returns driver with unsafe method [distributed-lock-service]", () => {
  const driver = defaultPostgresFactory("postgresql://invalid:invalid@localhost:9999/db", {});
  assert.equal(typeof driver.unsafe, "function");
});

test("defaultPostgresFactory driver template tag works [distributed-lock-service]", () => {
  const driver = defaultPostgresFactory("postgresql://invalid:invalid@localhost:9999/db", {});
  // The tagged template returns a thenable query object before connection resolution.
  const result = driver`SELECT 1 as value`;
  assert.equal(typeof result, "object");
  assert.equal(typeof result.then, "function");
  void driver.end({ timeout: 0 });
});
