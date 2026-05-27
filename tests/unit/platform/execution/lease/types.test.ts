import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LEASE_TTL_MS,
  MIN_LEASE_TTL_MS,
  MAX_LEASE_TTL_MS,
  DEFAULT_RENEWAL_INTERVAL_MS,
} from "../../../../../src/platform/five-plane-execution/lease/types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

test("DEFAULT_LEASE_TTL_MS is 10 seconds [types]", () => {
  assert.equal(DEFAULT_LEASE_TTL_MS, 10_000);
});

test("MIN_LEASE_TTL_MS is 5 seconds [types]", () => {
  assert.equal(MIN_LEASE_TTL_MS, 5_000);
});

test("MAX_LEASE_TTL_MS is 30 seconds [types]", () => {
  assert.equal(MAX_LEASE_TTL_MS, 30_000);
});

test("DEFAULT_RENEWAL_INTERVAL_MS is 3 seconds [types]", () => {
  assert.equal(DEFAULT_RENEWAL_INTERVAL_MS, 3_000);
});

test("constants are ordered correctly [types]", () => {
  assert.ok(MIN_LEASE_TTL_MS < DEFAULT_LEASE_TTL_MS);
  assert.ok(DEFAULT_LEASE_TTL_MS < MAX_LEASE_TTL_MS);
  assert.ok(DEFAULT_RENEWAL_INTERVAL_MS < DEFAULT_LEASE_TTL_MS);
});
