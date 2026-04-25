import assert from "node:assert/strict";
import test from "node:test";
import { rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { buildStableAcceptanceLineReport, STABLE_ACCEPTANCE_REQUIRED_DURATION_MS, STABLE_ACCEPTANCE_P95_BUDGET_MS } from "../../../../src/platform/stability/stable-acceptance-line.js";

test("STABLE_ACCEPTANCE_REQUIRED_DURATION_MS is 14 days in milliseconds", () => {
  assert.equal(STABLE_ACCEPTANCE_REQUIRED_DURATION_MS, 14 * 24 * 60 * 60 * 1000);
});

test("STABLE_ACCEPTANCE_P95_BUDGET_MS has interactive and extended bands", () => {
  assert.equal(STABLE_ACCEPTANCE_P95_BUDGET_MS.interactive, 30_000);
  assert.equal(STABLE_ACCEPTANCE_P95_BUDGET_MS.extended, 120_000);
});

test("buildStableAcceptanceLineReport returns report with pass status when all criteria pass", async () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "smoke",
    validationReport: {
      startedAt: "2026-04-01T00:00:00.000Z",
      finishedAt: "2026-04-01T00:01:00.000Z",
      iterations: 1,
      totalRuns: 2,
      passedRuns: 2,
      failedRuns: 0,
      integrityFailures: 0,
      backupFailures: 0,
      averageDurationMs: 1000,
      maxDurationMs: 2000,
      caseSummaries: [],
      artifacts: { reportPath: "", baselinePath: "", inventoryPath: "" },
      baselineComparison: {
        baselinePath: "",
        baselineCreated: false,
        status: "match",
        regressionDetected: false,
        failedRunsDelta: 0,
        integrityFailuresDelta: 0,
        backupFailuresDelta: 0,
        averageDurationDeltaMs: 0,
        averageDurationDeltaPct: 0,
        maxDurationDeltaMs: 0,
        maxDurationDeltaPct: 0,
        caseDrifts: [],
      },
      runs: [],
    },
    soakReport: {
      startedAt: "2026-04-01T00:00:00.000Z",
      finishedAt: "2026-04-01T01:00:00.000Z",
      durationMs: 3_600_000,
      wallClockDurationMs: 3_600_000,
      intervalMs: 500,
      iterationsPerCycle: 1,
      cycles: [],
      totalRuns: 5,
      failedRuns: 0,
      passedRuns: 5,
      integrityFailures: 0,
      backupFailures: 0,
    },
    doctorReport: {
      status: "ok",
      lockSummary: { totalLocks: 0, expiredLockCount: 0, exclusiveLocks: 0, sharedLocks: 0, taskIds: [], executionIds: [], ownerIds: [], resourcePaths: [], checked: false },
      eventBacklogSummary: { queueBacklogSize: 0, claimedBacklogSize: 0, pendingTier1Acks: 0, failedTier1Acks: 0, dispatchableBacklogSize: 0, oldestWaitSeconds: null, oldestClaimAgeSeconds: null, starvationDetected: false },
    },
    repairReport: {
      before: { status: "pass", findings: [], repairActions: [] },
      applied: [],
      after: { status: "pass", findings: [], repairActions: [] },
    },
  });

  assert.equal(report.status, "pass");
  assert.equal(report.profileName, "smoke");
  assert.ok(report.evaluatedAt);
  assert.ok(Array.isArray(report.criteria));
  assert.ok(report.criteria.length > 0);
  assert.ok(Array.isArray(report.truthNotes));
  assert.ok(Array.isArray(report.observed));
});

test("buildStableAcceptanceLineReport returns fail when soak has failed runs", () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "smoke",
    validationReport: {
      startedAt: "2026-04-01T00:00:00.000Z",
      finishedAt: "2026-04-01T00:01:00.000Z",
      iterations: 1,
      totalRuns: 2,
      passedRuns: 1,
      failedRuns: 1,
      integrityFailures: 0,
      backupFailures: 0,
      averageDurationMs: 1000,
      maxDurationMs: 2000,
      caseSummaries: [],
      artifacts: { reportPath: "", baselinePath: "", inventoryPath: "" },
      baselineComparison: {
        baselinePath: "",
        baselineCreated: false,
        status: "match",
        regressionDetected: false,
        failedRunsDelta: 0,
        integrityFailuresDelta: 0,
        backupFailuresDelta: 0,
        averageDurationDeltaMs: 0,
        averageDurationDeltaPct: 0,
        maxDurationDeltaMs: 0,
        maxDurationDeltaPct: 0,
        caseDrifts: [],
      },
      runs: [],
    },
    soakReport: {
      startedAt: "2026-04-01T00:00:00.000Z",
      finishedAt: "2026-04-01T01:00:00.000Z",
      durationMs: 3_600_000,
      wallClockDurationMs: 3_600_000,
      intervalMs: 500,
      iterationsPerCycle: 1,
      cycles: [],
      totalRuns: 5,
      failedRuns: 0,
      passedRuns: 5,
      integrityFailures: 0,
      backupFailures: 0,
    },
    doctorReport: {
      status: "ok",
      lockSummary: { totalLocks: 0, expiredLockCount: 0, exclusiveLocks: 0, sharedLocks: 0, taskIds: [], executionIds: [], ownerIds: [], resourcePaths: [], checked: false },
      eventBacklogSummary: { queueBacklogSize: 0, claimedBacklogSize: 0, pendingTier1Acks: 0, failedTier1Acks: 0, dispatchableBacklogSize: 0, oldestWaitSeconds: null, oldestClaimAgeSeconds: null, starvationDetected: false },
    },
    repairReport: {
      before: { status: "pass", findings: [], repairActions: [] },
      applied: [],
      after: { status: "pass", findings: [], repairActions: [] },
    },
  });

  // Validation failed runs should cause overall fail
  assert.equal(report.status, "fail");
});

test("buildStableAcceptanceLineReport returns partial when soak duration is below 14 days", () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "24h",
    validationReport: {
      startedAt: "2026-04-01T00:00:00.000Z",
      finishedAt: "2026-04-01T00:01:00.000Z",
      iterations: 1,
      totalRuns: 2,
      passedRuns: 2,
      failedRuns: 0,
      integrityFailures: 0,
      backupFailures: 0,
      averageDurationMs: 1000,
      maxDurationMs: 2000,
      caseSummaries: [],
      artifacts: { reportPath: "", baselinePath: "", inventoryPath: "" },
      baselineComparison: {
        baselinePath: "",
        baselineCreated: false,
        status: "match",
        regressionDetected: false,
        failedRunsDelta: 0,
        integrityFailuresDelta: 0,
        backupFailuresDelta: 0,
        averageDurationDeltaMs: 0,
        averageDurationDeltaPct: 0,
        maxDurationDeltaMs: 0,
        maxDurationDeltaPct: 0,
        caseDrifts: [],
      },
      runs: [],
    },
    soakReport: {
      startedAt: "2026-04-01T00:00:00.000Z",
      finishedAt: "2026-04-01T01:00:00.000Z",
      durationMs: 86_400_000, // 24 hours - still below 14 days
      wallClockDurationMs: 86_400_000,
      intervalMs: 500,
      iterationsPerCycle: 1,
      cycles: [],
      totalRuns: 5,
      failedRuns: 0,
      passedRuns: 5,
      integrityFailures: 0,
      backupFailures: 0,
    },
    doctorReport: {
      status: "ok",
      lockSummary: { totalLocks: 0, expiredLockCount: 0, exclusiveLocks: 0, sharedLocks: 0, taskIds: [], executionIds: [], ownerIds: [], resourcePaths: [], checked: false },
      eventBacklogSummary: { queueBacklogSize: 0, claimedBacklogSize: 0, pendingTier1Acks: 0, failedTier1Acks: 0, dispatchableBacklogSize: 0, oldestWaitSeconds: null, oldestClaimAgeSeconds: null, starvationDetected: false },
    },
    repairReport: {
      before: { status: "pass", findings: [], repairActions: [] },
      applied: [],
      after: { status: "pass", findings: [], repairActions: [] },
    },
  });

  // 24h is still partial (below 14 days)
  assert.equal(report.status, "partial");
  const longRunCriterion = report.criteria.find((c) => c.criterionId === "long_run_evidence");
  assert.equal(longRunCriterion?.status, "partial");
});

test("buildStableAcceptanceLineReport includes truth notes for smoke profile", () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "smoke",
    validationReport: {
      startedAt: "2026-04-01T00:00:00.000Z",
      finishedAt: "2026-04-01T00:01:00.000Z",
      iterations: 1,
      totalRuns: 2,
      passedRuns: 2,
      failedRuns: 0,
      integrityFailures: 0,
      backupFailures: 0,
      averageDurationMs: 1000,
      maxDurationMs: 2000,
      caseSummaries: [],
      artifacts: { reportPath: "", baselinePath: "", inventoryPath: "" },
      baselineComparison: {
        baselinePath: "",
        baselineCreated: false,
        status: "match",
        regressionDetected: false,
        failedRunsDelta: 0,
        integrityFailuresDelta: 0,
        backupFailuresDelta: 0,
        averageDurationDeltaMs: 0,
        averageDurationDeltaPct: 0,
        maxDurationDeltaMs: 0,
        maxDurationDeltaPct: 0,
        caseDrifts: [],
      },
      runs: [],
    },
    soakReport: {
      startedAt: "2026-04-01T00:00:00.000Z",
      finishedAt: "2026-04-01T01:00:00.000Z",
      durationMs: 3_600_000,
      wallClockDurationMs: 3_600_000,
      intervalMs: 500,
      iterationsPerCycle: 1,
      cycles: [],
      totalRuns: 5,
      failedRuns: 0,
      passedRuns: 5,
      integrityFailures: 0,
      backupFailures: 0,
    },
    doctorReport: {
      status: "ok",
      lockSummary: { totalLocks: 0, expiredLockCount: 0, exclusiveLocks: 0, sharedLocks: 0, taskIds: [], executionIds: [], ownerIds: [], resourcePaths: [], checked: false },
      eventBacklogSummary: { queueBacklogSize: 0, claimedBacklogSize: 0, pendingTier1Acks: 0, failedTier1Acks: 0, dispatchableBacklogSize: 0, oldestWaitSeconds: null, oldestClaimAgeSeconds: null, starvationDetected: false },
    },
    repairReport: {
      before: { status: "pass", findings: [], repairActions: [] },
      applied: [],
      after: { status: "pass", findings: [], repairActions: [] },
    },
  });

  // Smoke profile should have truth note about short-run evidence
  assert.ok(report.truthNotes.some((note) => note.includes("Smoke evidence")));
});

test("buildStableAcceptanceLineReport includes all six criteria", () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "smoke",
    validationReport: {
      startedAt: "2026-04-01T00:00:00.000Z",
      finishedAt: "2026-04-01T00:01:00.000Z",
      iterations: 1,
      totalRuns: 2,
      passedRuns: 2,
      failedRuns: 0,
      integrityFailures: 0,
      backupFailures: 0,
      averageDurationMs: 1000,
      maxDurationMs: 2000,
      caseSummaries: [],
      artifacts: { reportPath: "", baselinePath: "", inventoryPath: "" },
      baselineComparison: {
        baselinePath: "",
        baselineCreated: false,
        status: "match",
        regressionDetected: false,
        failedRunsDelta: 0,
        integrityFailuresDelta: 0,
        backupFailuresDelta: 0,
        averageDurationDeltaMs: 0,
        averageDurationDeltaPct: 0,
        maxDurationDeltaMs: 0,
        maxDurationDeltaPct: 0,
        caseDrifts: [],
      },
      runs: [],
    },
    soakReport: {
      startedAt: "2026-04-01T00:00:00.000Z",
      finishedAt: "2026-04-01T01:00:00.000Z",
      durationMs: 3_600_000,
      wallClockDurationMs: 3_600_000,
      intervalMs: 500,
      iterationsPerCycle: 1,
      cycles: [],
      totalRuns: 5,
      failedRuns: 0,
      passedRuns: 5,
      integrityFailures: 0,
      backupFailures: 0,
    },
    doctorReport: {
      status: "ok",
      lockSummary: { totalLocks: 0, expiredLockCount: 0, exclusiveLocks: 0, sharedLocks: 0, taskIds: [], executionIds: [], ownerIds: [], resourcePaths: [], checked: false },
      eventBacklogSummary: { queueBacklogSize: 0, claimedBacklogSize: 0, pendingTier1Acks: 0, failedTier1Acks: 0, dispatchableBacklogSize: 0, oldestWaitSeconds: null, oldestClaimAgeSeconds: null, starvationDetected: false },
    },
    repairReport: {
      before: { status: "pass", findings: [], repairActions: [] },
      applied: [],
      after: { status: "pass", findings: [], repairActions: [] },
    },
  });

  const criterionIds = report.criteria.map((c) => c.criterionId);
  assert.ok(criterionIds.includes("long_run_evidence"));
  assert.ok(criterionIds.includes("manual_db_repair_free"));
  assert.ok(criterionIds.includes("orphan_queue_free"));
  assert.ok(criterionIds.includes("zombie_lock_free"));
  assert.ok(criterionIds.includes("recovery_success_rate"));
  assert.ok(criterionIds.includes("latency_budget_p95"));
});

test("buildStableAcceptanceLineReport includes latency budget for both bands", () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "smoke",
    validationReport: {
      startedAt: "2026-04-01T00:00:00.000Z",
      finishedAt: "2026-04-01T00:01:00.000Z",
      iterations: 1,
      totalRuns: 2,
      passedRuns: 2,
      failedRuns: 0,
      integrityFailures: 0,
      backupFailures: 0,
      averageDurationMs: 1000,
      maxDurationMs: 2000,
      caseSummaries: [],
      artifacts: { reportPath: "", baselinePath: "", inventoryPath: "" },
      baselineComparison: {
        baselinePath: "",
        baselineCreated: false,
        status: "match",
        regressionDetected: false,
        failedRunsDelta: 0,
        integrityFailuresDelta: 0,
        backupFailuresDelta: 0,
        averageDurationDeltaMs: 0,
        averageDurationDeltaPct: 0,
        maxDurationDeltaMs: 0,
        maxDurationDeltaPct: 0,
        caseDrifts: [],
      },
      runs: [],
    },
    soakReport: {
      startedAt: "2026-04-01T00:00:00.000Z",
      finishedAt: "2026-04-01T01:00:00.000Z",
      durationMs: 3_600_000,
      wallClockDurationMs: 3_600_000,
      intervalMs: 500,
      iterationsPerCycle: 1,
      cycles: [],
      totalRuns: 5,
      failedRuns: 0,
      passedRuns: 5,
      integrityFailures: 0,
      backupFailures: 0,
    },
    doctorReport: {
      status: "ok",
      lockSummary: { totalLocks: 0, expiredLockCount: 0, exclusiveLocks: 0, sharedLocks: 0, taskIds: [], executionIds: [], ownerIds: [], resourcePaths: [], checked: false },
      eventBacklogSummary: { queueBacklogSize: 0, claimedBacklogSize: 0, pendingTier1Acks: 0, failedTier1Acks: 0, dispatchableBacklogSize: 0, oldestWaitSeconds: null, oldestClaimAgeSeconds: null, starvationDetected: false },
    },
    repairReport: {
      before: { status: "pass", findings: [], repairActions: [] },
      applied: [],
      after: { status: "pass", findings: [], repairActions: [] },
    },
  });

  assert.ok(Array.isArray(report.latencyBudget));
  assert.equal(report.latencyBudget.length, 2);
  assert.ok(report.latencyBudget.some((lb) => lb.latencyBand === "interactive"));
  assert.ok(report.latencyBudget.some((lb) => lb.latencyBand === "extended"));
});