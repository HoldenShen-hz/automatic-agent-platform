/**
 * @fileoverview Unit tests for worker service identity functions
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeExecutionIds,
  normalizeLeaseReason,
} from "../../../../../src/platform/five-plane-execution/worker-pool/worker/execution-worker-handshake-support.js";

import type { WorkerHandshakeDecision } from "../../../../../src/platform/five-plane-execution/worker-pool/execution-worker-handshake-types.js";

test("mergeExecutionIds combines and deduplicates execution IDs", () => {
  const existing = ["exec_1", "exec_2", "exec_3"];
  const result = mergeExecutionIds(existing, "exec_2");

  assert.deepEqual(result, ["exec_1", "exec_2", "exec_3"]);
  assert.equal(result.length, 3);
});

test("mergeExecutionIds adds new execution ID", () => {
  const existing = ["exec_1", "exec_2"];
  const result = mergeExecutionIds(existing, "exec_3");

  assert.deepEqual(result, ["exec_1", "exec_2", "exec_3"]);
});

test("mergeExecutionIds returns sorted result", () => {
  const existing = ["exec_3", "exec_1", "exec_2"];
  const result = mergeExecutionIds(existing, "exec_4");

  assert.deepEqual(result, ["exec_1", "exec_2", "exec_3", "exec_4"]);
});

test("mergeExecutionIds handles empty existing array", () => {
  const result = mergeExecutionIds([], "exec_1");

  assert.deepEqual(result, ["exec_1"]);
});

test("mergeExecutionIds handles empty string execution ID", () => {
  const result = mergeExecutionIds(["exec_1"], "");

  assert.deepEqual(result, ["", "exec_1"]);
});

test("normalizeLeaseReason returns lease_not_found as-is", () => {
  const result = normalizeLeaseReason("lease_not_found");
  assert.equal(result, "lease_not_found");
});

test("normalizeLeaseReason returns lease_not_active as-is", () => {
  const result = normalizeLeaseReason("lease_not_active");
  assert.equal(result, "lease_not_active");
});

test("normalizeLeaseReason returns lease_expired as-is", () => {
  const result = normalizeLeaseReason("lease_expired");
  assert.equal(result, "lease_expired");
});

test("normalizeLeaseReason returns worker_mismatch as-is", () => {
  const result = normalizeLeaseReason("worker_mismatch");
  assert.equal(result, "worker_mismatch");
});

test("normalizeLeaseReason returns no_active_lease as-is", () => {
  const result = normalizeLeaseReason("no_active_lease");
  assert.equal(result, "no_active_lease");
});

test("normalizeLeaseReason returns stale_fencing_token as-is", () => {
  const result = normalizeLeaseReason("stale_fencing_token");
  assert.equal(result, "stale_fencing_token");
});

test("normalizeLeaseReason returns null for unknown reason codes", () => {
  const result = normalizeLeaseReason("unknown_code");
  assert.equal(result, null);
});

test("normalizeLeaseReason returns null for empty string", () => {
  const result = normalizeLeaseReason("");
  assert.equal(result, null);
});

test("normalizeLeaseReason handles null input", () => {
  const result = normalizeLeaseReason(null);
  assert.equal(result, null);
});