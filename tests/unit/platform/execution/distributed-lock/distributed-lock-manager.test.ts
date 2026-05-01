import assert from "node:assert/strict";
import test from "node:test";

import { inferPgSslFromDsn } from "../../../../../src/platform/execution/distributed-lock/distributed-lock-manager.js";

test("inferPgSslFromDsn returns null for invalid DSN", () => {
  assert.equal(inferPgSslFromDsn("not-a-url"), null);
  assert.equal(inferPgSslFromDsn(""), null);
});

test("inferPgSslFromDsn returns null for DSN without sslmode", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db");
  assert.equal(result, null);
});

test("inferPgSslFromDsn returns null for sslmode not set to require", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db?sslmode=disable");
  assert.equal(result, null);
});

test("inferPgSslFromDsn returns object for sslmode=require", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db?sslmode=require");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn is case insensitive for sslmode", () => {
  const result1 = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db?SSLMODE=REQUIRE");
  assert.deepEqual(result1, { rejectUnauthorized: true });

  const result2 = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db?SslMode=Require");
  assert.deepEqual(result2, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn handles multiple query params", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db?connect_timeout=10&sslmode=require&pool_timeout=20");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn handles sslmode with whitespace", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db?sslmode=require");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn handles uppercase sslmode key", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db?SSLMODE=require");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn returns null when sslmode is empty string", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db?sslmode=");
  assert.equal(result, null);
});

test("inferPgSslFromDsn handles missing query string", () => {
  const result = inferPgSslFromDsn("postgres://user:pass@localhost:5432/db");
  assert.equal(result, null);
});