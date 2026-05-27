import assert from "node:assert/strict";
import test from "node:test";

import {
  STABLE_ACCEPTANCE_REQUIRED_DURATION_MS,
  STABLE_ACCEPTANCE_P95_BUDGET_MS,
  type StableAcceptanceCriterionId,
  type StableAcceptanceCriterion,
  type StableAcceptanceLatencyBudgetStatus,
  type StableAcceptanceLineReport,
  type StableAcceptanceLineOptions,
} from "../../../../../src/platform/shared/stability/stable-acceptance-line.js";

test("STABLE_ACCEPTANCE_REQUIRED_DURATION_MS is 14 days in ms [stable-acceptance-line-types]", () => {
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  assert.equal(STABLE_ACCEPTANCE_REQUIRED_DURATION_MS, fourteenDaysMs);
});

test("STABLE_ACCEPTANCE_P95_BUDGET_MS has correct values [stable-acceptance-line-types]", () => {
  assert.equal(STABLE_ACCEPTANCE_P95_BUDGET_MS.interactive, 30_000);
  assert.equal(STABLE_ACCEPTANCE_P95_BUDGET_MS.extended, 120_000);
});

test("StableAcceptanceCriterionId accepts all valid values [stable-acceptance-line-types]", () => {
  const ids: StableAcceptanceCriterionId[] = [
    "long_run_evidence",
    "manual_db_repair_free",
    "orphan_queue_free",
    "zombie_lock_free",
    "recovery_success_rate",
    "latency_budget_p95",
  ];
  assert.equal(ids.length, 6);
  for (const id of ids) {
    const result: StableAcceptanceCriterionId = id;
    assert.ok(result === id);
  }
});

test("StableAcceptanceCriterion structure is correct [stable-acceptance-line-types]", () => {
  const criterion: StableAcceptanceCriterion = {
    criterionId: "long_run_evidence",
    status: "pass",
    detail: "Full 14-day coverage achieved",
    metrics: {
      coverageDays: 14,
      requiredDays: 14,
      isComplete: true,
    },
  };

  assert.equal(criterion.criterionId, "long_run_evidence");
  assert.equal(criterion.status, "pass");
  assert.equal(criterion.metrics.coverageDays, 14);
});

test("StableAcceptanceCriterion status accepts all valid values [stable-acceptance-line-types]", () => {
  const statuses: StableAcceptanceCriterion["status"][] = ["pass", "partial", "fail"];

  for (const status of statuses) {
    const criterion: StableAcceptanceCriterion = {
      criterionId: "recovery_success_rate",
      status,
      detail: "test",
      metrics: {},
    };
    assert.ok(criterion.status === status);
  }
});

test("StableAcceptanceLatencyBudgetStatus structure is correct [stable-acceptance-line-types]", () => {
  const status: StableAcceptanceLatencyBudgetStatus = {
    latencyBand: "interactive",
    budgetMs: 30_000,
    sampleCount: 1000,
    p95DurationMs: 25_000,
    maxDurationMs: 45_000,
    status: "pass",
  };

  assert.equal(status.latencyBand, "interactive");
  assert.equal(status.budgetMs, 30_000);
  assert.equal(status.p95DurationMs, 25_000);
  assert.equal(status.status, "pass");
});

test("StableAcceptanceLatencyBudgetStatus allows null values when no data [stable-acceptance-line-types]", () => {
  const status: StableAcceptanceLatencyBudgetStatus = {
    latencyBand: "extended",
    budgetMs: 120_000,
    sampleCount: 0,
    p95DurationMs: null,
    maxDurationMs: null,
    status: "fail",
  };

  assert.equal(status.sampleCount, 0);
  assert.equal(status.p95DurationMs, null);
  assert.equal(status.maxDurationMs, null);
});

test("StableAcceptanceLatencyBudgetStatus latencyBand accepts all valid values [stable-acceptance-line-types]", () => {
  const bands: StableAcceptanceLatencyBudgetStatus["latencyBand"][] = ["interactive", "extended"];

  for (const band of bands) {
    const status: StableAcceptanceLatencyBudgetStatus = {
      latencyBand: band,
      budgetMs: 30_000,
      sampleCount: 100,
      p95DurationMs: 20_000,
      maxDurationMs: 40_000,
      status: "pass",
    };
    assert.ok(status.latencyBand === band);
  }
});

test("StableAcceptanceLineReport structure is correct [stable-acceptance-line-types]", () => {
  const report: StableAcceptanceLineReport = {
    evaluatedAt: "2026-04-14T00:00:00.000Z",
    status: "pass",
    profileName: "production_stable",
    truthNotes: ["All criteria met for 14-day soak"],
    criteria: [],
    observed: {
      soakDurationMs: 14 * 24 * 60 * 60 * 1000,
      requiredDurationMs: STABLE_ACCEPTANCE_REQUIRED_DURATION_MS,
      longRunCoveragePct: 100,
      manualDbRepairSignalCount: 0,
      orphanQueueClaimCount: 0,
      zombieLockCount: 0,
      recoveryAttemptCount: 10,
      recoverySucceededCount: 10,
      recoverySuccessRatePct: 100,
    },
    latencyBudget: [],
  };

  assert.equal(report.status, "pass");
  assert.equal(report.observed.longRunCoveragePct, 100);
  assert.equal(report.observed.recoverySuccessRatePct, 100);
});

test("StableAcceptanceLineReport status accepts all valid values [stable-acceptance-line-types]", () => {
  const statuses: StableAcceptanceLineReport["status"][] = ["pass", "partial", "fail"];

  for (const status of statuses) {
    const report: StableAcceptanceLineReport = {
      evaluatedAt: "2026-04-14T00:00:00.000Z",
      status,
      profileName: "test",
      truthNotes: [],
      criteria: [],
      observed: {
        soakDurationMs: 0,
        requiredDurationMs: STABLE_ACCEPTANCE_REQUIRED_DURATION_MS,
        longRunCoveragePct: 0,
        manualDbRepairSignalCount: 0,
        orphanQueueClaimCount: 0,
        zombieLockCount: 0,
        recoveryAttemptCount: 0,
        recoverySucceededCount: 0,
        recoverySuccessRatePct: 0,
      },
      latencyBudget: [],
    };
    assert.ok(report.status === status);
  }
});

test("StableAcceptanceLineReport allows partial coverage [stable-acceptance-line-types]", () => {
  const report: StableAcceptanceLineReport = {
    evaluatedAt: "2026-04-14T00:00:00.000Z",
    status: "partial",
    profileName: "canary_stable",
    truthNotes: ["Only 3 days of evidence, partial pass allowed"],
    criteria: [
      {
        criterionId: "long_run_evidence",
        status: "partial",
        detail: "3 of 14 days covered",
        metrics: { coverageDays: 3, requiredDays: 14 },
      },
    ],
    observed: {
      soakDurationMs: 3 * 24 * 60 * 60 * 1000,
      requiredDurationMs: STABLE_ACCEPTANCE_REQUIRED_DURATION_MS,
      longRunCoveragePct: 21.4,
      manualDbRepairSignalCount: 0,
      orphanQueueClaimCount: 0,
      zombieLockCount: 0,
      recoveryAttemptCount: 5,
      recoverySucceededCount: 5,
      recoverySuccessRatePct: 100,
    },
    latencyBudget: [],
  };

  assert.equal(report.status, "partial");
  assert.ok(report.observed.longRunCoveragePct < 100);
});

test("StableAcceptanceLineOptions structure is correct [stable-acceptance-line-types]", () => {
  const options: StableAcceptanceLineOptions = {
    profileName: "production_stable",
    validationReport: {
      startedAt: "2026-04-14T00:00:00.000Z",
      finishedAt: "2026-04-14T12:00:00.000Z",
      iterations: 10,
      totalRuns: 100,
      passedRuns: 95,
      failedRuns: 5,
      integrityFailures: 0,
      backupFailures: 0,
      averageDurationMs: 5000,
      maxDurationMs: 15000,
      caseSummaries: [],
      artifacts: {
        reportPath: "/var/validation/report.json",
        baselinePath: "/var/validation/baseline.json",
        inventoryPath: "/var/validation/inventory.json",
      },
      baselineComparison: {
        baselinePath: "/var/validation/baseline.json",
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
      finishedAt: "2026-04-14T00:00:00.000Z",
      durationMs: 14 * 24 * 60 * 60 * 1000,
      wallClockDurationMs: 14 * 24 * 60 * 60 * 1000,
      intervalMs: 60_000,
      iterationsPerCycle: 10,
      cycles: [],
      totalRuns: 1000,
      failedRuns: 10,
      passedRuns: 990,
      integrityFailures: 0,
      backupFailures: 0,
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
      before: { status: "pass", findings: [], repairActions: [] },
      applied: [],
      after: { status: "pass", findings: [], repairActions: [] },
    },
  };

  assert.equal(options.profileName, "production_stable");
  assert.equal(options.doctorReport.status, "ok");
});
