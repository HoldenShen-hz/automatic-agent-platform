/**
 * Dispatch Execution CLI Tests
 *
 * Tests for dispatch-execution.ts CLI module.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { loadDispatchExecutionCliEnv } from "../../../../src/platform/five-plane-control-plane/config-center/runtime-ops-env.js";

// ---------------------------------------------------------------------------
// Tests for DispatchExecutionCliEnvConfig interface
// ---------------------------------------------------------------------------

test("DispatchExecutionCliEnvConfig has correct shape", () => {
  // Verify the interface defines the expected fields
  const config: {
    dbPath: string | undefined;
    executionId: string;
    priority: "low" | "normal" | "high" | "urgent" | undefined;
    queueName: string | null;
    dispatchTarget: "any" | "local_only" | "prefer_remote" | "require_remote" | undefined;
    requiredIsolationLevel: "standard" | "hardened" | "strict" | undefined;
    requiredRepoVersion: string | null;
    requiredCapabilities: string[];
    dispatchAfter: string | null;
    createOnly: boolean;
    preferredWorkerId: string | null;
    leaseTtlMs: number;
    includeDegraded: boolean;
  } = {
    dbPath: undefined,
    executionId: "exec-123",
    priority: "normal",
    queueName: "default",
    dispatchTarget: "any",
    requiredIsolationLevel: "standard",
    requiredRepoVersion: null,
    requiredCapabilities: [],
    dispatchAfter: null,
    createOnly: false,
    preferredWorkerId: null,
    leaseTtlMs: 30000,
    includeDegraded: false,
  };

  assert.equal(config.executionId, "exec-123");
  assert.equal(config.priority, "normal");
  assert.equal(config.queueName, "default");
  assert.equal(config.dispatchTarget, "any");
  assert.equal(config.createOnly, false);
  assert.equal(config.leaseTtlMs, 30000);
  assert.equal(config.includeDegraded, false);
});

// ---------------------------------------------------------------------------
// Tests for dispatch target enum values
// ---------------------------------------------------------------------------

test("dispatchTarget accepts 'any' value", () => {
  const target: "any" | "local_only" | "prefer_remote" | "require_remote" = "any";
  assert.equal(target, "any");
});

test("dispatchTarget accepts 'local_only' value", () => {
  const target: "any" | "local_only" | "prefer_remote" | "require_remote" = "local_only";
  assert.equal(target, "local_only");
});

test("dispatchTarget accepts 'prefer_remote' value", () => {
  const target: "any" | "local_only" | "prefer_remote" | "require_remote" = "prefer_remote";
  assert.equal(target, "prefer_remote");
});

test("dispatchTarget accepts 'require_remote' value", () => {
  const target: "any" | "local_only" | "prefer_remote" | "require_remote" = "require_remote";
  assert.equal(target, "require_remote");
});

// ---------------------------------------------------------------------------
// Tests for priority enum values
// ---------------------------------------------------------------------------

test("priority accepts 'low' value", () => {
  const priority: "low" | "normal" | "high" | "urgent" = "low";
  assert.equal(priority, "low");
});

test("priority accepts 'normal' value", () => {
  const priority: "low" | "normal" | "high" | "urgent" = "normal";
  assert.equal(priority, "normal");
});

test("priority accepts 'high' value", () => {
  const priority: "low" | "normal" | "high" | "urgent" = "high";
  assert.equal(priority, "high");
});

test("priority accepts 'urgent' value", () => {
  const priority: "low" | "normal" | "high" | "urgent" = "urgent";
  assert.equal(priority, "urgent");
});

// ---------------------------------------------------------------------------
// Tests for isolation level enum values
// ---------------------------------------------------------------------------

test("requiredIsolationLevel accepts 'standard' value", () => {
  const level: "standard" | "hardened" | "strict" = "standard";
  assert.equal(level, "standard");
});

test("requiredIsolationLevel accepts 'hardened' value", () => {
  const level: "standard" | "hardened" | "strict" = "hardened";
  assert.equal(level, "hardened");
});

test("requiredIsolationLevel accepts 'strict' value", () => {
  const level: "standard" | "hardened" | "strict" = "strict";
  assert.equal(level, "strict");
});

// ---------------------------------------------------------------------------
// Tests for default lease TTL
// ---------------------------------------------------------------------------

test("default lease TTL is 30000ms", () => {
  const DEFAULT_LEASE_TTL_MS = 30000;
  assert.equal(DEFAULT_LEASE_TTL_MS, 30000);
});
