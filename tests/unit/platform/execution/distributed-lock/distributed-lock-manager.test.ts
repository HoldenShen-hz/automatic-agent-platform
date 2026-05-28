import assert from "node:assert/strict";
import test from "node:test";

import { inferPgSslFromDsn } from "../../../../../src/platform/five-plane-execution/distributed-lock/locking-support.js";

test("inferPgSslFromDsn returns null for invalid DSN [distributed-lock-manager]", () => {
  assert.equal(inferPgSslFromDsn("not-a-url"), null);
  assert.equal(inferPgSslFromDsn(""), null);
});

test("inferPgSslFromDsn returns null for DSN without sslmode [distributed-lock-manager]", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db");
  assert.equal(result, null);
});

test("inferPgSslFromDsn returns null for sslmode not set to require [distributed-lock-manager]", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db?sslmode=disable");
  assert.equal(result, null);
});

test("inferPgSslFromDsn returns object for sslmode=require [distributed-lock-manager]", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db?sslmode=require");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn is case insensitive for sslmode [distributed-lock-manager]", () => {
  const result1 = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db?SSLMODE=REQUIRE");
  assert.deepEqual(result1, { rejectUnauthorized: true });

  const result2 = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db?SslMode=Require");
  assert.deepEqual(result2, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn handles multiple query params [distributed-lock-manager]", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db?connect_timeout=10&sslmode=require&pool_timeout=20");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn handles sslmode with whitespace [distributed-lock-manager]", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db?sslmode=require");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn handles uppercase sslmode key [distributed-lock-manager]", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db?SSLMODE=require");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn returns null when sslmode is empty string [distributed-lock-manager]", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db?sslmode=");
  assert.equal(result, null);
});

test("inferPgSslFromDsn handles missing query string [distributed-lock-manager]", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db");
  assert.equal(result, null);
});