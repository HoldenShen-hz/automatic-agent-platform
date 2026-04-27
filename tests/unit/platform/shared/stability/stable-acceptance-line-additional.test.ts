/**
 * Unit tests for the Stable Acceptance Line Module - additional coverage.
 *
 * Tests edge cases and specific criteria evaluations:
 * - Long-run evidence criterion with various soak durations
 * - Latency budget calculations with different task profiles
 * - Recovery success rate calculations
 */

import assert from "node:assert/strict";
import test from "node:test";

import { buildStableAcceptanceLineReport } from "../../../../../src/platform/shared/stability/stable-acceptance-line.js";
import type { StableSoakReport } from "../../../../../src/platform/shared/stability/stable-runtime-soak-runner.js";
import type { StableValidationReport } from "../../../../../src/platform/shared/stability/stable-runtime-validator.js";

function createValidationReport(durationMs: number, caseId = "coding_minimal_baseline"): StableValidationReport {
  return {
    startedAt: "2026-04-07T00:00:00.000Z",
    finishedAt: "2026-04-07T00:00:10.000Z",
    iterations: 1,
    totalRuns: 1,
    passedRuns: 1,
    failedRuns: 0,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: durationMs,
    maxDurationMs: durationMs,
    caseSummaries: [
      {
        caseId,
        totalRuns: 1,
        passedRuns: 1,
        failedRuns: 0,
        averageDurationMs: durationMs,
        maxDurationMs: durationMs,
      },
    ],
    artifacts: {
      reportPath: "/tmp/validation.json",
      baselinePath: "/tmp/validation-baseline.json",
      inventoryPath: "/tmp/inventory.json",
    },
    baselineComparison: {
      baselinePath: "/tmp/validation-baseline.json",
      baselineCreated: true,
      status: "baseline_created",
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
    runs: [
      {
        iteration: 1,
        caseId,
        passed: true,
        durationMs,
        dbIntegrityPassed: true,
        backupPassed: true,
        backupPath: "/tmp/case.backup.db",
      },
    ],
  };
}

function createSoakReport(durationMs: number, runDurationMs: number): StableSoakReport {
  return {
    startedAt: "2026-04-07T00:00:00.000Z",
    finishedAt: "2026-04-07T00:10:00.000Z",
    durationMs,
    wallClockDurationMs: durationMs,
    intervalMs: 1_000,
    iterationsPerCycle: 1,
    cycles: [
      {
        cycle: 1,
        startedAt: "2026-04-07T00:00:00.000Z",
        finishedAt: "2026-04-07T00:10:00.000Z",
        report: createValidationReport(runDurationMs),
      },
    ],
    totalRuns: 1,
    failedRuns: 0,
    passedRuns: 1,
    integrityFailures: 0,
    backupFailures: 0,
  };
}

function createDoctorReport() {
  return {
    status: "ok" as const,
    lockSummary: {
      checked: true,
      totalLocks: 0,
      exclusiveLocks: 0,
      sharedLocks: 0,
      expiredLockCount: 0,
      taskIds: [],
      executionIds: [],
      ownerIds: [],
      resourcePaths: [],
    },
    eventBacklogSummary: {
      pendingTier1Acks: 0,
      failedTier1Acks: 0,
      queueBacklogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      starvationDetected: false,
    },
  };
}

function createEmptyRepairReport() {
  return {
    before: {
      status: "pass" as const,
      findings: [],
      repairActions: [],
    },
    applied: [],
    after: {
      status: "pass" as const,
      findings: [],
      repairActions: [],
    },
  };
}

test("acceptance line long_run_evidence fails when soak has failed runs", () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "24h",
    validationReport: createValidationReport(100),
    soakReport: {
      ...createSoakReport(24 * 60 * 60 * 1000, 150),
      failedRuns: 5,
    },
    doctorReport: createDoctorReport(),
    repairReport: createEmptyRepairReport(),
  });

  const criterion = report.criteria.find((c) => c.criterionId === "long_run_evidence");
  assert.equal(criterion?.status, "fail");
});

test("acceptance line long_run_evidence fails when soak has integrity failures", () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "24h",
    validationReport: createValidationReport(100),
    soakReport: {
      ...createSoakReport(24 * 60 * 60 * 1000, 150),
      integrityFailures: 3,
    },
    doctorReport: createDoctorReport(),
    repairReport: createEmptyRepairReport(),
  });

  const criterion = report.criteria.find((c) => c.criterionId === "long_run_evidence");
  assert.equal(criterion?.status, "fail");
});

test("acceptance line manual_db_repair_free passes when no manual repairs needed", () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "smoke",
    validationReport: createValidationReport(80),
    soakReport: createSoakReport(5_000, 90),
    doctorReport: createDoctorReport(),
    repairReport: createEmptyRepairReport(),
  });

  const criterion = report.criteria.find((c) => c.criterionId === "manual_db_repair_free");
  assert.equal(criterion?.status, "pass");
});

test("acceptance line orphan_queue_free passes when no orphan queue claims", () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "smoke",
    validationReport: createValidationReport(80),
    soakReport: createSoakReport(5_000, 90),
    doctorReport: createDoctorReport(),
    repairReport: createEmptyRepairReport(),
  });

  const criterion = report.criteria.find((c) => c.criterionId === "orphan_queue_free");
  assert.equal(criterion?.status, "pass");
});

test("acceptance line zombie_lock_free passes when no zombie locks", () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "smoke",
    validationReport: createValidationReport(80),
    soakReport: createSoakReport(5_000, 90),
    doctorReport: createDoctorReport(),
    repairReport: createEmptyRepairReport(),
  });

  const criterion = report.criteria.find((c) => c.criterionId === "zombie_lock_free");
  assert.equal(criterion?.status, "pass");
});

test("acceptance line recovery_success_rate passes when all automatic repairs succeed", () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "smoke",
    validationReport: createValidationReport(80),
    soakReport: createSoakReport(5_000, 90),
    doctorReport: createDoctorReport(),
    repairReport: {
      before: {
        status: "repairable" as const,
        findings: [
          { code: "stale_execution", severity: "p1", message: "stale", entityType: "execution", entityId: "exec-1" },
        ],
        repairActions: [
          { action: "requeue_execution", reasonCode: "stale_execution", targetType: "execution", targetId: "exec-1" },
        ],
      },
      applied: [
        { action: "requeue_execution", targetId: "exec-1", applied: true, detail: "requeued" },
      ],
      after: {
        status: "pass" as const,
        findings: [],
        repairActions: [],
      },
    },
  });

  const criterion = report.criteria.find((c) => c.criterionId === "recovery_success_rate");
  assert.equal(criterion?.status, "pass");
  assert.equal(report.observed.recoverySuccessRatePct, 100);
});

test("acceptance line recovery_success_rate fails when repairs do not succeed", () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "smoke",
    validationReport: createValidationReport(80),
    soakReport: createSoakReport(5_000, 90),
    doctorReport: createDoctorReport(),
    repairReport: {
      before: {
        status: "repairable" as const,
        findings: [
          { code: "stale_execution", severity: "p1", message: "stale", entityType: "execution", entityId: "exec-1" },
        ],
        repairActions: [
          { action: "requeue_execution", reasonCode: "stale_execution", targetType: "execution", targetId: "exec-1" },
        ],
      },
      applied: [
        { action: "requeue_execution", targetId: "exec-1", applied: false, detail: "failed" },
      ],
      after: {
        status: "repairable" as const,
        findings: [],
        repairActions: [],
      },
    },
  });

  const criterion = report.criteria.find((c) => c.criterionId === "recovery_success_rate");
  assert.equal(criterion?.status, "fail");
  assert.equal(report.observed.recoverySuccessRatePct, 0);
});

test("acceptance line recovery_success_rate defaults to 100 when no repairs attempted", () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "smoke",
    validationReport: createValidationReport(80),
    soakReport: createSoakReport(5_000, 90),
    doctorReport: createDoctorReport(),
    repairReport: createEmptyRepairReport(),
  });

  const criterion = report.criteria.find((c) => c.criterionId === "recovery_success_rate");
  assert.equal(criterion?.status, "pass");
  assert.equal(report.observed.recoveryAttemptCount, 0);
  assert.equal(report.observed.recoverySuccessRatePct, 100);
});

test("acceptance line latency_budget_p95 reports partial when no samples", () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "smoke",
    validationReport: createValidationReport(80, "unknown_case"),
    soakReport: createSoakReport(5_000, 90),
    doctorReport: createDoctorReport(),
    repairReport: createEmptyRepairReport(),
  });

  const criterion = report.criteria.find((c) => c.criterionId === "latency_budget_p95");
  assert.equal(criterion?.status, "partial");
});

test("acceptance line includes truth notes for smoke profile", () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "smoke",
    validationReport: createValidationReport(80),
    soakReport: createSoakReport(5_000, 90),
    doctorReport: createDoctorReport(),
    repairReport: createEmptyRepairReport(),
  });

  assert.ok(report.truthNotes.some((note) => note.includes("Smoke evidence only")));
});

test("acceptance line observed metrics are correctly computed", () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "24h",
    validationReport: createValidationReport(100),
    soakReport: createSoakReport(24 * 60 * 60 * 1000, 150),
    doctorReport: createDoctorReport(),
    repairReport: createEmptyRepairReport(),
  });

  assert.equal(report.observed.soakDurationMs, 24 * 60 * 60 * 1000);
  assert.equal(report.observed.requiredDurationMs, 14 * 24 * 60 * 60 * 1000);
  assert.equal(report.observed.manualDbRepairSignalCount, 0);
  assert.equal(report.observed.orphanQueueClaimCount, 0);
  assert.equal(report.observed.zombieLockCount, 0);
});

test("acceptance line latency budget includes interactive and extended bands", () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "smoke",
    validationReport: createValidationReport(80),
    soakReport: createSoakReport(5_000, 90),
    doctorReport: createDoctorReport(),
    repairReport: createEmptyRepairReport(),
  });

  const interactive = report.latencyBudget.find((b) => b.latencyBand === "interactive");
  const extended = report.latencyBudget.find((b) => b.latencyBand === "extended");

  assert.ok(interactive);
  assert.ok(extended);
  assert.equal(interactive.budgetMs, 30_000);
  assert.equal(extended.budgetMs, 120_000);
});
