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

function createSoakReport(durationMs: number, runDurationMs: number, caseId = "coding_minimal_baseline"): StableSoakReport {
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
        report: createValidationReport(runDurationMs, caseId),
      },
    ],
    totalRuns: 1,
    failedRuns: 0,
    passedRuns: 1,
    integrityFailures: 0,
    backupFailures: 0,
  };
}

test("stable acceptance line remains partial when evidence is healthy but below the 14-day threshold", () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "smoke",
    validationReport: createValidationReport(80),
    soakReport: createSoakReport(5_000, 90),
    doctorReport: {
      status: "ok",
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
    },
    repairReport: {
      before: {
        status: "pass",
        findings: [],
        repairActions: [],
      },
      applied: [],
      after: {
        status: "pass",
        findings: [],
        repairActions: [],
      },
    },
  });

  assert.equal(report.status, "partial");
  assert.equal(report.criteria.find((criterion) => criterion.criterionId === "long_run_evidence")?.status, "partial");
  assert.equal(report.criteria.find((criterion) => criterion.criterionId === "latency_budget_p95")?.status, "partial");
  assert.match(report.truthNotes[0] ?? "", /does not truthfully prove a full 14-day continuous run/);
});

test("stable acceptance line passes when 14-day soak, recovery, and latency budgets are all satisfied", () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "72h",
    validationReport: createValidationReport(250, "coding_minimal_baseline"),
    soakReport: {
      ...createSoakReport(14 * 24 * 60 * 60 * 1000, 300, "coding_minimal_baseline"),
      cycles: [
        {
          cycle: 1,
          startedAt: "2026-04-07T00:00:00.000Z",
          finishedAt: "2026-04-07T00:10:00.000Z",
          report: createValidationReport(300, "coding_minimal_baseline"),
        },
        {
          cycle: 2,
          startedAt: "2026-04-07T00:10:00.000Z",
          finishedAt: "2026-04-07T00:20:00.000Z",
          report: createValidationReport(700, "crash_recovery_minimal"),
        },
      ],
      totalRuns: 2,
      passedRuns: 2,
    },
    doctorReport: {
      status: "ok",
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
    },
    repairReport: {
      before: {
        status: "repairable",
        findings: [
          {
            code: "stale_execution",
            severity: "p1",
            message: "execution stale",
            entityType: "execution",
            entityId: "exec-1",
          },
        ],
        repairActions: [
          {
            action: "requeue_execution",
            reasonCode: "stale_execution",
            targetType: "execution",
            targetId: "exec-1",
          },
        ],
      },
      applied: [
        {
          action: "requeue_execution",
          targetId: "exec-1",
          applied: true,
          detail: "execution requeued",
        },
      ],
      after: {
        status: "pass",
        findings: [],
        repairActions: [],
      },
    },
  });

  assert.equal(report.status, "pass");
  assert.ok(report.criteria.every((criterion) => criterion.status === "pass"));
  assert.equal(report.observed.recoverySuccessRatePct, 100);
  assert.equal(report.latencyBudget.find((item) => item.latencyBand === "interactive")?.status, "pass");
  assert.equal(report.latencyBudget.find((item) => item.latencyBand === "extended")?.status, "pass");
});

test("stable acceptance line fails when orphan queue, zombie lock, or manual DB repair signals exist", () => {
  const report = buildStableAcceptanceLineReport({
    profileName: "24h",
    validationReport: createValidationReport(100),
    soakReport: createSoakReport(24 * 60 * 60 * 1000, 150),
    doctorReport: {
      status: "degraded",
      lockSummary: {
        checked: true,
        totalLocks: 1,
        exclusiveLocks: 1,
        sharedLocks: 0,
        expiredLockCount: 1,
        taskIds: ["task-1"],
        executionIds: ["exec-1"],
        ownerIds: ["worker-1"],
        resourcePaths: ["/tmp/file.txt"],
      },
      eventBacklogSummary: {
        pendingTier1Acks: 0,
        failedTier1Acks: 0,
        queueBacklogSize: 1,
        dispatchableBacklogSize: 0,
        claimedBacklogSize: 1,
        oldestWaitSeconds: 100,
        oldestClaimAgeSeconds: 100,
        starvationDetected: false,
      },
    },
    repairReport: {
      before: {
        status: "repairable",
        findings: [
          {
            code: "orphan_queue_claim",
            severity: "p1",
            message: "orphan ticket",
            entityType: "ticket",
            entityId: "ticket-1",
          },
          {
            code: "expired_file_lock",
            severity: "p1",
            message: "expired lock",
            entityType: "file_lock",
            entityId: "lock-1",
          },
          {
            code: "integrity_check_failed",
            severity: "p0",
            message: "db corrupt",
            entityType: "database",
            entityId: "sqlite",
          },
        ],
        repairActions: [
          {
            action: "manual_intervention_required",
            reasonCode: "integrity_check_failed",
            targetType: "database",
            targetId: "sqlite",
          },
        ],
      },
      applied: [
        {
          action: "manual_intervention_required",
          targetId: "sqlite",
          applied: false,
          detail: "manual intervention required",
        },
      ],
      after: {
        status: "repairable",
        findings: [],
        repairActions: [],
      },
    },
  });

  assert.equal(report.status, "fail");
  assert.equal(report.criteria.find((criterion) => criterion.criterionId === "manual_db_repair_free")?.status, "fail");
  assert.equal(report.criteria.find((criterion) => criterion.criterionId === "orphan_queue_free")?.status, "fail");
  assert.equal(report.criteria.find((criterion) => criterion.criterionId === "zombie_lock_free")?.status, "fail");
  assert.equal(report.criteria.find((criterion) => criterion.criterionId === "recovery_success_rate")?.status, "fail");
});
