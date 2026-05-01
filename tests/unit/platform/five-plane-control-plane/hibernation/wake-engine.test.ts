/**
 * Wake Engine Unit Tests
 *
 * Tests wake condition matching, resume compatibility checking,
 * expiration detection, and status transitions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  WakeEngine,
  type WakeEvent,
  type ResumeSnapshotDescriptor,
  type ResumeCompatibilityOptions,
} from "../../../../../../src/platform/five-plane-execution/hibernation/wake-engine.js";
import {
  createHibernationRecord,
  createWakeCondition,
  type HibernationRecord,
} from "../../../../../../src/platform/five-plane-execution/hibernation/hibernation-types.js";
import type { ArtifactRef } from "../../../../../../src/platform/contracts/executable-contracts/index.js";

// ---------------------------------------------------------------------------
// Test Fixtures & Helpers
// ---------------------------------------------------------------------------

function createMockArtifactRef(): ArtifactRef {
  return {
    artifactId: "art-123",
    artifactVersion: 1,
    storagePath: "/artifacts/test",
    contentHash: "abc123",
  };
}

function createTestRecord(overrides: Partial<HibernationRecord> = {}): HibernationRecord {
  return createHibernationRecord({
    harnessRunId: "hrun-123",
    tenantId: "tenant-456",
    checkpointRef: createMockArtifactRef(),
    wakeConditions: [],
    pausedReason: "waiting for approval",
    ...overrides,
  });
}

function createTestEngine(options?: { defaultResumeTimeoutMs?: number; maxResumeAttempts?: number }): WakeEngine {
  return new WakeEngine(options);
}

// ---------------------------------------------------------------------------
// Tests: Wake Condition Matching
// ---------------------------------------------------------------------------

test("matchesCondition() returns true for manual_wake condition", () => {
  const engine = createTestEngine();
  const event: WakeEvent = {
    eventKind: "manual_wake",
    source: "operator",
    occurredAt: new Date().toISOString(),
  };
  const condition = createWakeCondition("manual_wake", { conditionId: "cond-1" });

  assert.equal(engine.matchesCondition(event, condition), true);
});

test("matchesCondition() returns false when eventKind does not match", () => {
  const engine = createTestEngine();
  const event: WakeEvent = {
    eventKind: "manual_wake",
    source: "operator",
    occurredAt: new Date().toISOString(),
  };
  const condition = createWakeCondition("timer_expired", { conditionId: "cond-1" });

  assert.equal(engine.matchesCondition(event, condition), false);
});

test("matchesCondition() matches approval_received with correct approvalRequestId", () => {
  const engine = createTestEngine();
  const event: WakeEvent = {
    eventKind: "approval_received",
    source: "approval-service",
    payload: { approvalRequestId: "approval-123" },
    occurredAt: new Date().toISOString(),
  };
  const condition = createWakeCondition("approval_received", {
    conditionId: "cond-1",
    approvalRequestId: "approval-123",
  });

  assert.equal(engine.matchesCondition(event, condition), true);
});

test("matchesCondition() does not match approval_received with wrong approvalRequestId", () => {
  const engine = createTestEngine();
  const event: WakeEvent = {
    eventKind: "approval_received",
    source: "approval-service",
    payload: { approvalRequestId: "approval-999" },
    occurredAt: new Date().toISOString(),
  };
  const condition = createWakeCondition("approval_received", {
    conditionId: "cond-1",
    approvalRequestId: "approval-123",
  });

  assert.equal(engine.matchesCondition(event, condition), false);
});

test("matchesCondition() matches external_callback with correct source", () => {
  const engine = createTestEngine();
  const event: WakeEvent = {
    eventKind: "external_callback",
    source: "https://api.example.com/webhook",
    payload: { callbackId: "cb-123" },
    occurredAt: new Date().toISOString(),
  };
  const condition = createWakeCondition("external_callback", {
    conditionId: "cond-1",
    callbackEndpoint: "https://api.example.com/webhook",
  });

  assert.equal(engine.matchesCondition(event, condition), true);
});

test("matchesCondition() does not match external_callback with wrong source", () => {
  const engine = createTestEngine();
  const event: WakeEvent = {
    eventKind: "external_callback",
    source: "https://other.example.com/webhook",
    payload: { callbackId: "cb-123" },
    occurredAt: new Date().toISOString(),
  };
  const condition = createWakeCondition("external_callback", {
    conditionId: "cond-1",
    callbackEndpoint: "https://api.example.com/webhook",
  });

  assert.equal(engine.matchesCondition(event, condition), false);
});

test("matchesCondition() matches timer_expired when event time >= target time", () => {
  const engine = createTestEngine();
  const targetTime = new Date(Date.now() - 1000).toISOString(); // 1 second in the past
  const event: WakeEvent = {
    eventKind: "timer_expired",
    source: "timer-service",
    occurredAt: new Date().toISOString(),
  };
  const condition = createWakeCondition("timer_expired", {
    conditionId: "cond-1",
    targetTime,
  });

  assert.equal(engine.matchesCondition(event, condition), true);
});

test("matchesCondition() does not match timer_expired when event time < target time", () => {
  const engine = createTestEngine();
  const targetTime = new Date(Date.now() + 10000).toISOString(); // 10 seconds in the future
  const event: WakeEvent = {
    eventKind: "timer_expired",
    source: "timer-service",
    occurredAt: new Date().toISOString(),
  };
  const condition = createWakeCondition("timer_expired", {
    conditionId: "cond-1",
    targetTime,
  });

  assert.equal(engine.matchesCondition(event, condition), false);
});

test("matchesCondition() matches event_received with matching filter", () => {
  const engine = createTestEngine();
  const event: WakeEvent = {
    eventKind: "event_received",
    source: "event-bus",
    payload: { eventType: "order_completed", orderId: "order-123" },
    occurredAt: new Date().toISOString(),
  };
  const condition = createWakeCondition("event_received", {
    conditionId: "cond-1",
    eventFilter: { eventType: "order_completed" },
  });

  assert.equal(engine.matchesCondition(event, condition), true);
});

test("matchesCondition() does not match event_received when filter does not match", () => {
  const engine = createTestEngine();
  const event: WakeEvent = {
    eventKind: "event_received",
    source: "event-bus",
    payload: { eventType: "order_cancelled", orderId: "order-123" },
    occurredAt: new Date().toISOString(),
  };
  const condition = createWakeCondition("event_received", {
    conditionId: "cond-1",
    eventFilter: { eventType: "order_completed" },
  });

  assert.equal(engine.matchesCondition(event, condition), false);
});

test("matchesCondition() matches event_received without filter (any event)", () => {
  const engine = createTestEngine();
  const event: WakeEvent = {
    eventKind: "event_received",
    source: "event-bus",
    payload: { any: "data" },
    occurredAt: new Date().toISOString(),
  };
  const condition = createWakeCondition("event_received", {
    conditionId: "cond-1",
  });

  assert.equal(engine.matchesCondition(event, condition), true);
});

// ---------------------------------------------------------------------------
// Tests: Evaluate Wake Conditions
// ---------------------------------------------------------------------------

test("evaluateWakeConditions() returns true when any condition matches (default logic)", () => {
  const engine = createTestEngine();
  const record = createTestRecord({
    wakeConditions: [
      createWakeCondition("manual_wake", { conditionId: "cond-1" }),
      createWakeCondition("timer_expired", {
        conditionId: "cond-2",
        targetTime: new Date(Date.now() - 1000).toISOString(),
      }),
    ],
    wakeConditionLogic: "any",
  });
  const event: WakeEvent = {
    eventKind: "manual_wake",
    source: "operator",
    occurredAt: new Date().toISOString(),
  };

  assert.equal(engine.evaluateWakeConditions(record, event), true);
});

test("evaluateWakeConditions() returns false when no condition matches", () => {
  const engine = createTestEngine();
  const record = createTestRecord({
    wakeConditions: [
      createWakeCondition("approval_received", {
        conditionId: "cond-1",
        approvalRequestId: "approval-123",
      }),
    ],
    wakeConditionLogic: "any",
  });
  const event: WakeEvent = {
    eventKind: "approval_received",
    source: "approval-service",
    payload: { approvalRequestId: "approval-999" },
    occurredAt: new Date().toISOString(),
  };

  assert.equal(engine.evaluateWakeConditions(record, event), false);
});

test("evaluateWakeConditions() returns true when all conditions match (all logic)", () => {
  const engine = createTestEngine();
  const record = createTestRecord({
    wakeConditions: [
      createWakeCondition("manual_wake", { conditionId: "cond-1" }),
      createWakeCondition("timer_expired", {
        conditionId: "cond-2",
        targetTime: new Date(Date.now() - 1000).toISOString(),
      }),
    ],
    wakeConditionLogic: "all",
  });
  const event: WakeEvent = {
    eventKind: "manual_wake",
    source: "operator",
    occurredAt: new Date().toISOString(),
  };

  // Manual wake matches, timer matches, so all (both) should match
  assert.equal(engine.evaluateWakeConditions(record, event), true);
});

test("evaluateWakeConditions() returns false when not all conditions match (all logic)", () => {
  const engine = createTestEngine();
  const record = createTestRecord({
    wakeConditions: [
      createWakeCondition("manual_wake", { conditionId: "cond-1" }),
      createWakeCondition("approval_received", {
        conditionId: "cond-2",
        approvalRequestId: "approval-123",
      }),
    ],
    wakeConditionLogic: "all",
  });
  const event: WakeEvent = {
    eventKind: "manual_wake",
    source: "operator",
    occurredAt: new Date().toISOString(),
  };

  // Only manual wake matches, approval doesn't
  assert.equal(engine.evaluateWakeConditions(record, event), false);
});

// ---------------------------------------------------------------------------
// Tests: Resume Compatibility Check
// ---------------------------------------------------------------------------

test("checkResumeCompatibility() returns compatible when versions match", () => {
  const engine = createTestEngine();
  const before: ResumeSnapshotDescriptor = {
    runId: "run-123",
    contractVersion: "v4.3",
    runtimeVersion: "1.0.0",
    graphHash: "abc123",
    artifactLockHash: "def456",
  };
  const after: ResumeSnapshotDescriptor = { ...before };
  const options: ResumeCompatibilityOptions = {
    timeoutMs: 30000,
    startedAtMs: Date.now(),
    nowMs: Date.now(),
  };

  const result = engine.checkResumeCompatibility(before, after, options);

  assert.equal(result.compatible, true);
  assert.equal(result.timedOut, false);
  assert.equal(result.differences.length, 0);
});

test("checkResumeCompatibility() returns not compatible when contractVersion differs", () => {
  const engine = createTestEngine();
  const before: ResumeSnapshotDescriptor = {
    runId: "run-123",
    contractVersion: "v4.3",
    runtimeVersion: "1.0.0",
    graphHash: "abc123",
    artifactLockHash: "def456",
  };
  const after: ResumeSnapshotDescriptor = {
    ...before,
    contractVersion: "v4.4",
  };
  const options: ResumeCompatibilityOptions = {
    timeoutMs: 30000,
    startedAtMs: Date.now(),
    nowMs: Date.now(),
  };

  const result = engine.checkResumeCompatibility(before, after, options);

  assert.equal(result.compatible, false);
  assert.equal(result.differences.length, 1);
  assert.equal(result.differences[0].field, "contractVersion");
  assert.equal(result.differences[0].before, "v4.3");
  assert.equal(result.differences[0].after, "v4.4");
});

test("checkResumeCompatibility() returns timedOut when timeout exceeded", () => {
  const engine = createTestEngine();
  const before: ResumeSnapshotDescriptor = {
    runId: "run-123",
    contractVersion: "v4.3",
    runtimeVersion: "1.0.0",
    graphHash: "abc123",
    artifactLockHash: "def456",
  };
  const after: ResumeSnapshotDescriptor = { ...before };
  const options: ResumeCompatibilityOptions = {
    timeoutMs: 30000,
    startedAtMs: Date.now() - 60000, // Started 60 seconds ago
    nowMs: Date.now(),
  };

  const result = engine.checkResumeCompatibility(before, after, options);

  assert.equal(result.timedOut, true);
  assert.equal(result.compatible, false);
  assert.equal(result.differences.length, 0);
});

test("checkResumeCompatibility() detects multiple version differences", () => {
  const engine = createTestEngine();
  const before: ResumeSnapshotDescriptor = {
    runId: "run-123",
    contractVersion: "v4.3",
    runtimeVersion: "1.0.0",
    graphHash: "abc123",
    artifactLockHash: "def456",
  };
  const after: ResumeSnapshotDescriptor = {
    runId: "run-123",
    contractVersion: "v4.4",
    runtimeVersion: "2.0.0",
    graphHash: "xyz789",
    artifactLockHash: "def456",
  };
  const options: ResumeCompatibilityOptions = {
    timeoutMs: 30000,
    startedAtMs: Date.now(),
    nowMs: Date.now(),
  };

  const result = engine.checkResumeCompatibility(before, after, options);

  assert.equal(result.compatible, false);
  assert.equal(result.differences.length, 3);
});

// ---------------------------------------------------------------------------
// Tests: Resume Diff Report
// ---------------------------------------------------------------------------

test("generateResumeDiffReport() recommends replan for critical changes", () => {
  const engine = createTestEngine();
  const differences = [
    { field: "contractVersion", before: "v4.3", after: "v4.4" },
    { field: "runtimeVersion", before: "1.0.0", after: "1.0.0" },
  ];

  const report = engine.generateResumeDiffReport("run-123", differences);

  assert.equal(report.recommendation, "replan");
  assert.equal(report.runId, "run-123");
  assert.equal(report.differences.length, 2);
});

test("generateResumeDiffReport() recommends migrate for many non-critical changes", () => {
  const engine = createTestEngine();
  const differences = [
    { field: "graphHash", before: "abc", after: "def" },
    { field: "artifactLockHash", before: "123", after: "456" },
    { field: "runtimeVersion", before: "1.0.0", after: "1.0.0" },
    { field: "someOtherField", before: "x", after: "y" },
  ];

  const report = engine.generateResumeDiffReport("run-123", differences);

  assert.equal(report.recommendation, "migrate");
});

test("generateResumeDiffReport() recommends supervised_resume for no differences", () => {
  const engine = createTestEngine();
  const differences: readonly { field: string; before: string; after: string }[] = [];

  const report = engine.generateResumeDiffReport("run-123", differences);

  assert.equal(report.recommendation, "supervised_resume");
});

// ---------------------------------------------------------------------------
// Tests: Expiration
// ---------------------------------------------------------------------------

test("isExpired() returns false for non-expired record", () => {
  const engine = createTestEngine();
  const record = createTestRecord({
    expiresAt: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
  });

  assert.equal(engine.isExpired(record), false);
});

test("isExpired() returns true for expired record", () => {
  const engine = createTestEngine();
  const record = createTestRecord({
    expiresAt: new Date(Date.now() - 1000).toISOString(), // 1 second ago
  });

  assert.equal(engine.isExpired(record), true);
});

// ---------------------------------------------------------------------------
// Tests: Renewal
// ---------------------------------------------------------------------------

test("canRenew() returns true when under max renewals", () => {
  const engine = createTestEngine();
  const record = createTestRecord({
    maxRenewals: 3,
    currentRenewals: 1,
  });

  assert.equal(engine.canRenew(record), true);
});

test("canRenew() returns false when at max renewals", () => {
  const engine = createTestEngine();
  const record = createTestRecord({
    maxRenewals: 3,
    currentRenewals: 3,
  });

  assert.equal(engine.canRenew(record), false);
});

test("calculateRenewalExpiration() returns new expiration date", () => {
  const engine = createTestEngine();
  const record = createTestRecord({
    ttlMs: 86400000, // 1 day in ms
  });

  const newExpiration = engine.calculateRenewalExpiration(record);
  const expectedMinTime = Date.now() + 86400000 - 1000; // Allow 1 second variance

  assert.ok(new Date(newExpiration).getTime() >= expectedMinTime);
});

// ---------------------------------------------------------------------------
// Tests: Supervision
// ---------------------------------------------------------------------------

test("shouldRequireSupervision() returns true when timed out", () => {
  const engine = createTestEngine();
  const record = createTestRecord();
  const compatibilityResult = {
    compatible: true,
    timedOut: true,
    differences: [],
    checkedAt: new Date().toISOString(),
  };

  assert.equal(engine.shouldRequireSupervision(record, compatibilityResult), true);
});

test("shouldRequireSupervision() returns true when not compatible", () => {
  const engine = createTestEngine();
  const record = createTestRecord();
  const compatibilityResult = {
    compatible: false,
    timedOut: false,
    differences: [{ field: "contractVersion", before: "v4.3", after: "v4.4" }],
    checkedAt: new Date().toISOString(),
  };

  assert.equal(engine.shouldRequireSupervision(record, compatibilityResult), true);
});

test("shouldRequireSupervision() returns false when compatible and not timed out", () => {
  const engine = createTestEngine();
  const record = createTestRecord();
  const compatibilityResult = {
    compatible: true,
    timedOut: false,
    differences: [],
    checkedAt: new Date().toISOString(),
  };

  assert.equal(engine.shouldRequireSupervision(record, compatibilityResult), false);
});

// ---------------------------------------------------------------------------
// Tests: Status Transitions
// ---------------------------------------------------------------------------

test("getNextHibernationStatus() returns correct next status for start_resume", () => {
  const engine = createTestEngine();

  assert.equal(engine.getNextHibernationStatus("hibernating", "start_resume"), "waking");
});

test("getNextHibernationStatus() returns correct next status for resume_success", () => {
  const engine = createTestEngine();

  assert.equal(engine.getNextHibernationStatus("waking", "resume_success"), "resumed");
});

test("getNextHibernationStatus() returns correct next status for resume_failed", () => {
  const engine = createTestEngine();

  assert.equal(engine.getNextHibernationStatus("waking", "resume_failed"), "resume_failed");
});

test("getNextHibernationStatus() returns correct next status for expire", () => {
  const engine = createTestEngine();

  assert.equal(engine.getNextHibernationStatus("hibernating", "expire"), "expired");
});

test("getNextHibernationStatus() returns current status for unknown action", () => {
  const engine = createTestEngine();

  assert.equal(
    engine.getNextHibernationStatus("waking", "unknown_action" as any),
    "waking",
  );
});

// ---------------------------------------------------------------------------
// Tests: Resume Preconditions
// ---------------------------------------------------------------------------

test("validateResumePreconditions() returns valid for hibernating non-expired record", () => {
  const engine = createTestEngine();
  const record = createTestRecord({
    status: "hibernating",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    resumeAttemptCount: 0,
  });

  const result = engine.validateResumePreconditions(record);

  assert.equal(result.valid, true);
});

test("validateResumePreconditions() returns invalid when not in hibernating state", () => {
  const engine = createTestEngine();
  const record = createTestRecord({
    status: "waking",
  });

  const result = engine.validateResumePreconditions(record);

  assert.equal(result.valid, false);
  assert.ok(result.reason?.includes("not in hibernating state"));
});

test("validateResumePreconditions() returns invalid when expired", () => {
  const engine = createTestEngine();
  const record = createTestRecord({
    status: "hibernating",
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  });

  const result = engine.validateResumePreconditions(record);

  assert.equal(result.valid, false);
  assert.ok(result.reason?.includes("has expired"));
});

test("validateResumePreconditions() returns invalid when max attempts exceeded", () => {
  const engine = createTestEngine({ maxResumeAttempts: 3 });
  const record = createTestRecord({
    status: "hibernating",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    resumeAttemptCount: 3,
  });

  const result = engine.validateResumePreconditions(record);

  assert.equal(result.valid, false);
  assert.ok(result.reason?.includes("exceeded max resume attempts"));
});

// ---------------------------------------------------------------------------
// Tests: Wake Condition Factory Methods
// ---------------------------------------------------------------------------

test("createManualWakeCondition() creates correct condition", () => {
  const engine = createTestEngine();

  const condition = engine.createManualWakeCondition("cond-manual");

  assert.equal(condition.conditionKind, "manual_wake");
  assert.equal(condition.conditionId, "cond-manual");
});

test("createTimerWakeCondition() creates correct condition with target time", () => {
  const engine = createTestEngine();
  const targetTime = new Date(Date.now() + 3600000).toISOString();

  const condition = engine.createTimerWakeCondition("cond-timer", targetTime);

  assert.equal(condition.conditionKind, "timer_expired");
  assert.equal(condition.conditionId, "cond-timer");
  assert.equal(condition.targetTime, targetTime);
});

test("createApprovalWakeCondition() creates correct condition with approval request id", () => {
  const engine = createTestEngine();

  const condition = engine.createApprovalWakeCondition("cond-approval", "approval-123");

  assert.equal(condition.conditionKind, "approval_received");
  assert.equal(condition.conditionId, "cond-approval");
  assert.equal(condition.approvalRequestId, "approval-123");
});

test("createCallbackWakeCondition() creates correct condition with endpoint", () => {
  const engine = createTestEngine();
  const endpoint = "https://api.example.com/webhook";

  const condition = engine.createCallbackWakeCondition("cond-callback", endpoint);

  assert.equal(condition.conditionKind, "external_callback");
  assert.equal(condition.conditionId, "cond-callback");
  assert.equal(condition.callbackEndpoint, endpoint);
});
