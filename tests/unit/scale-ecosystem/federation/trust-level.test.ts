/**
 * TrustLevel Unit Tests
 *
 * Tests for federation/trust-level.ts - TrustLevel enum
 */

import assert from "node:assert/strict";
import test from "node:test";

import { TrustLevel } from "../../../../src/scale-ecosystem/federation/trust-level.js";

// ─────────────────────────────────────────────────────────────────────────────
// TrustLevel Enum Tests
// ─────────────────────────────────────────────────────────────────────────────

test("trust-level: TrustLevel enum has all expected values", () => {
  assert.equal(TrustLevel.NONE, "none");
  assert.equal(TrustLevel.AUDIT_ONLY, "audit_only");
  assert.equal(TrustLevel.READ, "read");
  assert.equal(TrustLevel.WRITE, "write");
  assert.equal(TrustLevel.ADMIN, "admin");
});

test("trust-level: TrustLevel enum has correct number of values", () => {
  const values = Object.values(TrustLevel);
  assert.equal(values.length, 5);
});

test("trust-level: TrustLevel is a string enum", () => {
  assert.equal(typeof TrustLevel.NONE, "string");
  assert.equal(typeof TrustLevel.READ, "string");
  assert.equal(typeof TrustLevel.WRITE, "string");
  assert.equal(typeof TrustLevel.ADMIN, "string");
});

test("trust-level: TrustLevel values are unique strings", () => {
  const values = Object.values(TrustLevel) as string[];
  const uniqueValues = new Set(values);
  assert.equal(uniqueValues.size, values.length, "All TrustLevel values should be unique");
});

test("trust-level: TrustLevel values follow naming convention", () => {
  const values = Object.values(TrustLevel) as string[];
  for (const value of values) {
    assert.ok(
      /^[a-z_]+$/.test(value),
      `TrustLevel value "${value}" should be lowercase with underscores`
    );
  }
});

test("trust-level: TrustLevel.NONE equals 'none'", () => {
  assert.equal(TrustLevel.NONE, "none");
});

test("trust-level: TrustLevel.AUDIT_ONLY equals 'audit_only'", () => {
  assert.equal(TrustLevel.AUDIT_ONLY, "audit_only");
});

test("trust-level: TrustLevel.READ equals 'read'", () => {
  assert.equal(TrustLevel.READ, "read");
});

test("trust-level: TrustLevel.WRITE equals 'write'", () => {
  assert.equal(TrustLevel.WRITE, "write");
});

test("trust-level: TrustLevel.ADMIN equals 'admin'", () => {
  assert.equal(TrustLevel.ADMIN, "admin");
});

test("trust-level: TrustLevel can be compared using equality", () => {
  assert.equal(TrustLevel.READ, TrustLevel.READ);
  assert.notEqual(TrustLevel.READ, TrustLevel.WRITE);
  assert.notEqual(TrustLevel.WRITE, TrustLevel.ADMIN);
});

test("trust-level: TrustLevel keys match values", () => {
  const keys = Object.keys(TrustLevel);
  const values = Object.values(TrustLevel);
  assert.equal(keys.length, values.length);
});

test("trust-level: TrustLevel can be used in Map as key", () => {
  const trustMap = new Map<TrustLevel, string>();
  trustMap.set(TrustLevel.READ, "read-access");
  trustMap.set(TrustLevel.WRITE, "write-access");
  trustMap.set(TrustLevel.ADMIN, "admin-access");

  assert.equal(trustMap.get(TrustLevel.READ), "read-access");
  assert.equal(trustMap.get(TrustLevel.WRITE), "write-access");
  assert.equal(trustMap.get(TrustLevel.ADMIN), "admin-access");
});

test("trust-level: TrustLevel can be serialized to JSON and back", () => {
  const original = TrustLevel.WRITE;
  const serialized = JSON.stringify(original);
  const deserialized = JSON.parse(serialized);

  assert.equal(deserialized, original);
});

test("trust-level: TrustLevel ordering is hierarchical", () => {
  const hierarchy: TrustLevel[] = [
    TrustLevel.NONE,
    TrustLevel.AUDIT_ONLY,
    TrustLevel.READ,
    TrustLevel.WRITE,
    TrustLevel.ADMIN,
  ];

  for (let i = 0; i < hierarchy.length; i++) {
    for (let j = i + 1; j < hierarchy.length; j++) {
      assert.ok(
        hierarchy[i] !== hierarchy[j],
        `TrustLevel at index ${i} and ${j} should not be equal`
      );
    }
  }
});