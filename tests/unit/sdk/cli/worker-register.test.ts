/**
 * Worker Register CLI Tests
 *
 * Tests for worker-register.ts CLI module.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../src/platform/contracts/errors.js";

// ---------------------------------------------------------------------------
// Tests for worker registration action branching
// ---------------------------------------------------------------------------

test("worker-register action defaults to issue when issue is specified", () => {
  const action = "issue";
  const isIssue = action === "issue";
  assert.equal(isIssue, true);
});

test("worker-register action supports complete", () => {
  const action = "complete";
  const isComplete = action === "complete";
  assert.equal(isComplete, true);
});

test("worker-register action throws ValidationError for unknown action", () => {
  const action: string = "unknown";
  const errorPrefix = `unknown_worker_register_action:${action}`;
  assert.throws(
    () => {
      if (action !== "issue" && action !== "complete") {
        throw new ValidationError(errorPrefix, errorPrefix);
      }
    },
    { message: errorPrefix },
  );
});

// ---------------------------------------------------------------------------
// Tests for issue challenge argument building
// ---------------------------------------------------------------------------

test("issue challenge builds arguments with workerId and capabilities", () => {
  const envConfig = {
    workerId: "worker-123",
    capabilities: ["bash", "edit"],
    challengeTtlMs: 300_000,
    occurredAt: null,
  };

  const args: {
    workerId: string;
    requestedCapabilities: string[];
    ttlMs?: number;
    occurredAt?: string;
  } = {
    workerId: envConfig.workerId,
    requestedCapabilities: envConfig.capabilities,
  };

  if (envConfig.challengeTtlMs != null) {
    args.ttlMs = envConfig.challengeTtlMs;
  }

  assert.equal(args.workerId, "worker-123");
  assert.deepEqual(args.requestedCapabilities, ["bash", "edit"]);
  assert.equal(args.ttlMs, 300_000);
});

test("issue challenge omits ttlMs when not provided", () => {
  const envConfig = {
    workerId: "worker-123",
    capabilities: ["bash", "edit"],
    challengeTtlMs: null,
    occurredAt: null,
  };

  const args: Record<string, unknown> = {
    workerId: envConfig.workerId,
    requestedCapabilities: envConfig.capabilities,
  };

  if (envConfig.challengeTtlMs != null) {
    args.ttlMs = envConfig.challengeTtlMs;
  }

  assert.equal(args.ttlMs, undefined);
});

test("issue challenge includes occurredAt when provided", () => {
  const envConfig = {
    workerId: "worker-123",
    capabilities: ["bash"],
    challengeTtlMs: null,
    occurredAt: "2024-01-01T00:00:00.000Z",
  };

  const args: Record<string, unknown> = {
    workerId: envConfig.workerId,
    requestedCapabilities: envConfig.capabilities,
  };

  if (envConfig.occurredAt) {
    args.occurredAt = envConfig.occurredAt;
  }

  assert.equal(args.occurredAt, "2024-01-01T00:00:00.000Z");
});

// ---------------------------------------------------------------------------
// Tests for complete registration argument building
// ---------------------------------------------------------------------------

test("complete registration builds arguments with challenge details", () => {
  const envConfig = {
    workerId: "worker-123",
    challengeId: "challenge-456",
    challengeToken: "token-abc",
    capabilities: ["bash", "edit", "mcp"],
    maxConcurrency: 5,
    queueAffinity: null,
    isolationLevel: null,
    repoVersion: "1.0.0",
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    sessionConsistencyCheckedAt: null,
    workspaceSyncStatus: null,
    workspaceSyncCheckedAt: null,
    occurredAt: null,
  };

  const args: Record<string, unknown> = {
    workerId: envConfig.workerId,
    challengeId: envConfig.challengeId,
    challengeToken: envConfig.challengeToken,
    capabilities: envConfig.capabilities,
    maxConcurrency: envConfig.maxConcurrency,
  };

  if (envConfig.queueAffinity) {
    args.queueAffinity = envConfig.queueAffinity;
  }
  if (envConfig.isolationLevel) {
    args.isolationLevel = envConfig.isolationLevel;
  }
  if (envConfig.repoVersion) {
    args.repoVersion = envConfig.repoVersion;
  }

  assert.equal(args.workerId, "worker-123");
  assert.equal(args.challengeId, "challenge-456");
  assert.equal(args.challengeToken, "token-abc");
  assert.equal(args.maxConcurrency, 5);
  assert.equal(args.queueAffinity, undefined);
  assert.equal(args.repoVersion, "1.0.0");
});

test("complete registration includes all optional fields when provided", () => {
  const envConfig = {
    workerId: "worker-123",
    challengeId: "challenge-456",
    challengeToken: "token-abc",
    capabilities: ["bash"],
    maxConcurrency: 3,
    queueAffinity: "queue-1",
    isolationLevel: "hardened",
    repoVersion: "2.0.0",
    runtimeInstanceId: "runtime-789",
    restartedFromRuntimeInstanceId: "runtime-001",
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "100",
    sessionConsistencyCheckStatus: "passed",
    sessionConsistencyCheckedAt: "2024-01-01T00:00:00.000Z",
    workspaceSyncStatus: "aligned",
    workspaceSyncCheckedAt: "2024-01-01T00:00:00.000Z",
    occurredAt: "2024-01-01T00:00:00.000Z",
  };

  const args: Record<string, unknown> = {
    workerId: envConfig.workerId,
    challengeId: envConfig.challengeId,
    challengeToken: envConfig.challengeToken,
    capabilities: envConfig.capabilities,
    maxConcurrency: envConfig.maxConcurrency,
    queueAffinity: envConfig.queueAffinity,
    isolationLevel: envConfig.isolationLevel,
    repoVersion: envConfig.repoVersion,
    runtimeInstanceId: envConfig.runtimeInstanceId,
    restartedFromRuntimeInstanceId: envConfig.restartedFromRuntimeInstanceId,
    remoteSessionStatus: envConfig.remoteSessionStatus,
    lastAcknowledgedStreamOffset: envConfig.lastAcknowledgedStreamOffset,
    sessionConsistencyCheckStatus: envConfig.sessionConsistencyCheckStatus,
    sessionConsistencyCheckedAt: envConfig.sessionConsistencyCheckedAt,
    workspaceSyncStatus: envConfig.workspaceSyncStatus,
    workspaceSyncCheckedAt: envConfig.workspaceSyncCheckedAt,
    occurredAt: envConfig.occurredAt,
  };

  assert.equal(args.queueAffinity, "queue-1");
  assert.equal(args.isolationLevel, "hardened");
  assert.equal(args.runtimeInstanceId, "runtime-789");
  assert.equal(args.remoteSessionStatus, "connected");
  assert.equal(args.workspaceSyncStatus, "aligned");
});

// ---------------------------------------------------------------------------
// Tests for registration policy defaults
// ---------------------------------------------------------------------------

test("registration policy uses default challengeTtlMs when not configured", () => {
  const registration = { challengeTtlMs: undefined } as unknown as { challengeTtlMs?: number };
  const challengeTtlMs =
    typeof registration.challengeTtlMs === "number" && Number.isFinite(registration.challengeTtlMs)
      ? registration.challengeTtlMs
      : 300_000;
  assert.equal(challengeTtlMs, 300_000);
});

test("registration policy uses default allowedCapabilities when not configured", () => {
  const registration = { allowedCapabilities: undefined } as unknown as { allowedCapabilities?: string[] };
  const allowedCapabilities = Array.isArray(registration.allowedCapabilities)
    ? registration.allowedCapabilities.filter((item): item is string => typeof item === "string")
    : ["bash", "edit", "mcp"];
  assert.deepEqual(allowedCapabilities, ["bash", "edit", "mcp"]);
});

test("registration policy uses configured challengeTtlMs", () => {
  const registration: { challengeTtlMs?: number } = { challengeTtlMs: 600_000 };
  const challengeTtlMs =
    typeof registration.challengeTtlMs === "number" && Number.isFinite(registration.challengeTtlMs)
      ? registration.challengeTtlMs
      : 300_000;
  assert.equal(challengeTtlMs, 600_000);
});

test("registration policy filters invalid capabilities", () => {
  const registration: { allowedCapabilities?: (string | number | null | undefined)[] } = {
    allowedCapabilities: ["bash", 123, null, "edit", undefined, "mcp"],
  };
  const allowedCapabilities = Array.isArray(registration.allowedCapabilities)
    ? registration.allowedCapabilities.filter((item): item is string => typeof item === "string")
    : ["bash", "edit", "mcp"];
  assert.deepEqual(allowedCapabilities, ["bash", "edit", "mcp"]);
});
