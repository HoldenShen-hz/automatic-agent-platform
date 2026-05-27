/**
 * Unit Tests: Dispatch Router Functions
 *
 * Tests for the routing and selection logic in execution-dispatch-support.ts
 * These functions determine how executions are routed to workers.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveDispatchTarget,
  resolveRequiredIsolationLevel,
  resolveRequiredRepoVersion,
  meetsIsolationRequirement,
  normalizeStringArray,
  parseJsonArray,
  isElevatedPriority,
  type CreateExecutionTicketInput,
  type DispatchExecutionOptions,
} from "../../../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-support.js";

import type { DispatchTarget, WorkerIsolationLevel, TaskPriority } from "../../../../../src/platform/contracts/types/domain/index.js";

// =============================================================================
// resolveDispatchTarget
// =============================================================================

test("resolveDispatchTarget returns exact value for local_only [router]", () => {
  assert.equal(resolveDispatchTarget("local_only"), "local_only");
});

test("resolveDispatchTarget returns exact value for prefer_remote [router]", () => {
  assert.equal(resolveDispatchTarget("prefer_remote"), "prefer_remote");
});

test("resolveDispatchTarget returns exact value for require_remote [router]", () => {
  assert.equal(resolveDispatchTarget("require_remote"), "require_remote");
});

test("resolveDispatchTarget returns any for null [router]", () => {
  assert.equal(resolveDispatchTarget(null), "any");
});

test("resolveDispatchTarget returns any for undefined [router]", () => {
  assert.equal(resolveDispatchTarget(undefined), "any");
});

test("resolveDispatchTarget returns any for unknown values [router]", () => {
  assert.equal(resolveDispatchTarget("unknown" as DispatchTarget), "any");
});

// =============================================================================
// resolveRequiredIsolationLevel
// =============================================================================

test("resolveRequiredIsolationLevel returns exact value for hardened [router]", () => {
  assert.equal(resolveRequiredIsolationLevel("hardened"), "hardened");
});

test("resolveRequiredIsolationLevel returns exact value for strict [router]", () => {
  assert.equal(resolveRequiredIsolationLevel("strict"), "strict");
});

test("resolveRequiredIsolationLevel returns standard for null [router]", () => {
  assert.equal(resolveRequiredIsolationLevel(null), "standard");
});

test("resolveRequiredIsolationLevel returns standard for undefined [router]", () => {
  assert.equal(resolveRequiredIsolationLevel(undefined), "standard");
});

test("resolveRequiredIsolationLevel returns standard for unknown values [router]", () => {
  assert.equal(resolveRequiredIsolationLevel("unknown" as WorkerIsolationLevel), "standard");
});

// =============================================================================
// resolveRequiredRepoVersion
// =============================================================================

test("resolveRequiredRepoVersion returns trimmed value for valid string [router]", () => {
  assert.equal(resolveRequiredRepoVersion("  v1.2.3  "), "v1.2.3");
});

test("resolveRequiredRepoVersion returns null for empty string [router]", () => {
  assert.equal(resolveRequiredRepoVersion(""), null);
});

test("resolveRequiredRepoVersion returns null for whitespace-only string [router]", () => {
  assert.equal(resolveRequiredRepoVersion("   "), null);
});

test("resolveRequiredRepoVersion returns null for null [router]", () => {
  assert.equal(resolveRequiredRepoVersion(null), null);
});

test("resolveRequiredRepoVersion returns null for undefined [router]", () => {
  assert.equal(resolveRequiredRepoVersion(undefined), null);
});

// =============================================================================
// meetsIsolationRequirement
// =============================================================================

test("meetsIsolationRequirement standard accepts standard [router]", () => {
  assert.equal(meetsIsolationRequirement("standard", "standard"), true);
});

test("meetsIsolationRequirement hardened accepts standard [router]", () => {
  assert.equal(meetsIsolationRequirement("hardened", "standard"), true);
});

test("meetsIsolationRequirement strict accepts standard [router]", () => {
  assert.equal(meetsIsolationRequirement("strict", "standard"), true);
});

test("meetsIsolationRequirement standard does not accept hardened [router]", () => {
  assert.equal(meetsIsolationRequirement("standard", "hardened"), false);
});

test("meetsIsolationRequirement standard does not accept strict [router]", () => {
  assert.equal(meetsIsolationRequirement("standard", "strict"), false);
});

test("meetsIsolationRequirement hardened accepts hardened [router]", () => {
  assert.equal(meetsIsolationRequirement("hardened", "hardened"), true);
});

test("meetsIsolationRequirement strict accepts hardened [router]", () => {
  assert.equal(meetsIsolationRequirement("strict", "hardened"), true);
});

test("meetsIsolationRequirement hardened does not accept strict [router]", () => {
  assert.equal(meetsIsolationRequirement("hardened", "strict"), false);
});

test("meetsIsolationRequirement strict accepts strict [router]", () => {
  assert.equal(meetsIsolationRequirement("strict", "strict"), true);
});

// =============================================================================
// normalizeStringArray
// =============================================================================

test("normalizeStringArray removes duplicates and sorts [router]", () => {
  const result = normalizeStringArray(["z", "a", "m", "a", "z"]);
  assert.deepEqual(result, ["a", "m", "z"]);
});

test("normalizeStringArray trims whitespace [router]", () => {
  const result = normalizeStringArray(["  foo  ", " bar ", "baz"]);
  assert.deepEqual(result, ["bar", "baz", "foo"]);
});

test("normalizeStringArray removes empty strings [router]", () => {
  const result = normalizeStringArray(["a", "", "  ", "b"]);
  assert.deepEqual(result, ["a", "b"]);
});

test("normalizeStringArray returns empty array for empty input [router]", () => {
  const result = normalizeStringArray([]);
  assert.deepEqual(result, []);
});

test("normalizeStringArray returns empty array for all empty strings [router]", () => {
  const result = normalizeStringArray(["", "  ", ""]);
  assert.deepEqual(result, []);
});

// =============================================================================
// parseJsonArray
// =============================================================================

test("parseJsonArray parses valid JSON array [router]", () => {
  const result = parseJsonArray('["a", "b", "c"]');
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("parseJsonArray filters non-string items [router]", () => {
  const result = parseJsonArray('["a", 123, true, "b", null]');
  assert.deepEqual(result, ["a", "b"]);
});

test("parseJsonArray returns empty array for non-array JSON [router]", () => {
  const result = parseJsonArray('{"key": "value"}');
  assert.deepEqual(result, []);
});

test("parseJsonArray returns empty array for invalid JSON [router]", () => {
  const result = parseJsonArray("not json at all");
  assert.deepEqual(result, []);
});

test("parseJsonArray returns empty array for empty string [router]", () => {
  const result = parseJsonArray("");
  assert.deepEqual(result, []);
});

test("parseJsonArray calls onError callback for invalid JSON [router]", () => {
  let errorMessage = "";
  parseJsonArray("invalid", (msg) => { errorMessage = msg; });
  assert.ok(errorMessage.length > 0);
});

test("parseJsonArray handles nested arrays [router]", () => {
  const result = parseJsonArray('[["a"], ["b"]]');
  // Only direct string elements pass the filter
  assert.deepEqual(result, []);
});

// =============================================================================
// isElevatedPriority
// =============================================================================

test("isElevatedPriority returns true for high [router]", () => {
  assert.equal(isElevatedPriority("high"), true);
});

test("isElevatedPriority returns true for urgent [router]", () => {
  assert.equal(isElevatedPriority("urgent"), true);
});

test("isElevatedPriority returns false for low [router]", () => {
  assert.equal(isElevatedPriority("low"), false);
});

test("isElevatedPriority returns false for normal [router]", () => {
  assert.equal(isElevatedPriority("normal"), false);
});

// =============================================================================
// CreateExecutionTicketInput type structure
// =============================================================================

test("CreateExecutionTicketInput accepts minimal required fields [router]", () => {
  const input: CreateExecutionTicketInput = {
    executionId: "exec_123",
  };
  assert.equal(input.executionId, "exec_123");
});

test("CreateExecutionTicketInput accepts all optional fields [router]", () => {
  const input: CreateExecutionTicketInput = {
    executionId: "exec_123",
    priority: "high",
    queueName: "default",
    dispatchTarget: "local_only",
    requiredIsolationLevel: "hardened",
    requiredRepoVersion: "v1.0.0",
    requiredCapabilities: ["gpu", "large-memory"],
    dispatchAfter: "2026-04-24T00:00:00.000Z",
    occurredAt: "2026-04-24T00:00:00.000Z",
  };
  assert.equal(input.priority, "high");
  assert.equal(input.queueName, "default");
  assert.equal(input.dispatchTarget, "local_only");
  assert.equal(input.requiredIsolationLevel, "hardened");
  assert.equal(input.requiredRepoVersion, "v1.0.0");
  assert.deepEqual(input.requiredCapabilities, ["gpu", "large-memory"]);
});

test("CreateExecutionTicketInput allows null for nullable fields [router]", () => {
  const input: CreateExecutionTicketInput = {
    executionId: "exec_123",
    queueName: null,
    dispatchTarget: null,
    requiredIsolationLevel: null,
    requiredRepoVersion: null,
    dispatchAfter: null,
  };
  assert.equal(input.queueName, null);
  assert.equal(input.dispatchTarget, null);
});

// =============================================================================
// DispatchExecutionOptions type structure
// =============================================================================

test("DispatchExecutionOptions accepts minimal required fields [router]", () => {
  const input: DispatchExecutionOptions = {
    leaseTtlMs: 30000,
  };
  assert.equal(input.leaseTtlMs, 30000);
});

test("DispatchExecutionOptions accepts all optional fields [router]", () => {
  const input: DispatchExecutionOptions = {
    queueName: "default",
    preferredWorkerId: "worker_abc",
    leaseTtlMs: 60000,
    includeDegraded: true,
    occurredAt: "2026-04-24T00:00:00.000Z",
  };
  assert.equal(input.queueName, "default");
  assert.equal(input.preferredWorkerId, "worker_abc");
  assert.equal(input.leaseTtlMs, 60000);
  assert.equal(input.includeDegraded, true);
});

test("DispatchExecutionOptions allows null for queueName [router]", () => {
  const input: DispatchExecutionOptions = {
    queueName: null,
    leaseTtlMs: 30000,
  };
  assert.equal(input.queueName, null);
});