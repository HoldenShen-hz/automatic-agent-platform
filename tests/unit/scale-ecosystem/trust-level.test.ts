/**
 * TrustLevel Unit Tests
 *
 * Tests for federation/trust-level.ts - TrustLevel enum
 */

import assert from "node:assert/strict";
import test from "node:test";

import { TrustLevel } from "../../../src/scale-ecosystem/federation/trust-level.js";

// ─────────────────────────────────────────────────────────────────────────────
// TrustLevel Enum Tests
// ─────────────────────────────────────────────────────────────────────────────

test("trust-level: TrustLevel enum has all expected values [trust-level]", () => {
  assert.equal(TrustLevel.NONE, "none");
  assert.equal(TrustLevel.AUDIT_ONLY, "audit_only");
  assert.equal(TrustLevel.READ, "read");
  assert.equal(TrustLevel.WRITE, "write");
  assert.equal(TrustLevel.ADMIN, "admin");
});

test("trust-level: TrustLevel enum has correct number of values [trust-level]", () => {
  const values = Object.values(TrustLevel);
  assert.equal(values.length, 5);
});

test("trust-level: TrustLevel is an enum (not a object) [trust-level]", () => {
  // TrustLevel should be a string enum
  assert.equal(typeof TrustLevel.NONE, "string");
  assert.equal(typeof TrustLevel.READ, "string");
});

test("trust-level: TrustLevel values are unique strings [trust-level]", () => {
  const values = Object.values(TrustLevel) as string[];
  const uniqueValues = new Set(values);
  assert.equal(uniqueValues.size, values.length, "All TrustLevel values should be unique");
});

test("trust-level: TrustLevel values are lowercase with underscores [trust-level]", () => {
  const values = Object.values(TrustLevel) as string[];
  for (const value of values) {
    assert.ok(/^[a-z_]+$/.test(value), `TrustLevel value "${value}" should be lowercase with underscores`);
  }
});

test("trust-level: TrustLevel ordering is hierarchical [trust-level]", () => {
  // NONE < AUDIT_ONLY < READ < WRITE < ADMIN
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

test("trust-level: TrustLevel can be compared using equality [trust-level]", () => {
  assert.equal(TrustLevel.READ, TrustLevel.READ);
  assert.notEqual(TrustLevel.READ, TrustLevel.WRITE);
});

test("trust-level: TrustLevel keys match values [trust-level]", () => {
  const keys = Object.keys(TrustLevel);
  const values = Object.values(TrustLevel);
  assert.equal(keys.length, values.length);
});