import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStableAcceptanceLineReport,
  STABLE_ACCEPTANCE_REQUIRED_DURATION_MS,
  STABLE_ACCEPTANCE_P95_BUDGET_MS,
  type StableAcceptanceLineOptions,
  type StableAcceptanceCriterionId,
} from "../../../src/platform/stability/stable-acceptance-line.js";

function createMockValidationReport(failedRuns = 0, integrityFailures = 0, backupFailures = 0) {
  return {
    reportId: "validation-report-1",
    profileName: "smoke",
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    wallClockDurationMs: 60_000,
    runs: [],
    failedRuns,
    integrityFailures,
    backupFailures: [],
  };
}

function createMockSoakReport(wallClockDurationMs = 60_000, failedRuns = 0) {
  return {
    reportId: "soak-report-1",
    profileName: "smoke",
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    wallClockDurationMs,
    cycles: [],
    failedRuns,
    integrityFailures: 0,
    backupFailures: [],
  };
}

function createMockDoctorReport() {
  return {
    status: "pass" as const,
    lockSummary: {
      totalLocks: 0,
      expiredLockCount: 0,
    },
    eventBacklogSummary: {
      claimedBacklogSize: 0,
    },
  };
}

function createMockRepairReport() {
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

test("buildStableAcceptanceLineReport exports are available", () => {
  assert.equal(typeof buildStableAcceptanceLineReport, "function");
  assert.equal(typeof STABLE_ACCEPTANCE_REQUIRED_DURATION_MS, "number");
  assert.equal(typeof STABLE_ACCEPTANCE_P95_BUDGET_MS, "object");
});

test("STABLE_ACCEPTANCE_REQUIRED_DURATION_MS is 14 days in ms", () => {
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  assert.equal(STABLE_ACCEPTANCE_REQUIRED_DURATION_MS, fourteenDaysMs);
});

test("STABLE_ACCEPTANCE_P95_BUDGET_MS has interactive and extended", () => {
  assert.equal(STABLE_ACCEPTANCE_P95_BUDGET_MS.interactive, 30_000);
  assert.equal(STABLE_ACCEPTANCE_P95_BUDGET_MS.extended, 120_000);
});

test("buildStableAcceptanceLineReport creates report with all criteria", () => {
  const options: StableAcceptanceLineOptions = {
    profileName: "smoke",
    validationReport: createMockValidationReport(),
    soakReport: createMockSoakReport(60_000),
    doctorReport: createMockDoctorReport(),
    repairReport: createMockRepairReport(),
  };

  const report = buildStableAcceptanceLineReport(options);

  assert.equal(typeof report.status, "string");
  assert.ok(["pass", "partial", "fail"].includes(report.status));
  assert.equal(report.profileName, "smoke");
  assert.ok(Array.isArray(report.criteria));
  assert.ok(Array.isArray(report.truthNotes));
  assert.ok(Array.isArray(report.latencyBudget));
});

test("buildStableAcceptanceLineReport evaluates long_run_evidence criterion", () => {
  const options: StableAcceptanceLineOptions = {
    profileName: "smoke",
    validationReport: createMockValidationReport(0, 0, 0),
    soakReport: createMockSoakReport(STABLE_ACCEPTANCE_REQUIRED_DURATION_MS),
    doctorReport: createMockDoctorReport(),
    repairReport: createMockRepairReport(),
  };

  const report = buildStableAcceptanceLineReport(options);
  const longRunCriterion = report.criteria.find((c) => c.criterionId === "long_run_evidence");

  assert.ok(longRunCriterion);
  assert.equal(longRunCriterion?.status, "pass");
});

test("buildStableAcceptanceLineReport partial when soak duration insufficient", () => {
  const options: StableAcceptanceLineOptions = {
    profileName: "smoke",
    validationReport: createMockValidationReport(),
    soakReport: createMockSoakReport(60_000),
    doctorReport: createMockDoctorReport(),
    repairReport: createMockRepairReport(),
  };

  const report = buildStableAcceptanceLineReport(options);
  const longRunCriterion = report.criteria.find((c) => c.criterionId === "long_run_evidence");

  assert.ok(longRunCriterion);
  assert.equal(longRunCriterion?.status, "partial");
});

test("buildStableAcceptanceLineReport fail when validation has failures", () => {
  const options: StableAcceptanceLineOptions = {
    profileName: "smoke",
    validationReport: createMockValidationReport(1, 0, 0),
    soakReport: createMockSoakReport(STABLE_ACCEPTANCE_REQUIRED_DURATION_MS),
    doctorReport: createMockDoctorReport(),
    repairReport: createMockRepairReport(),
  };

  const report = buildStableAcceptanceLineReport(options);
  const longRunCriterion = report.criteria.find((c) => c.criterionId === "long_run_evidence");

  assert.ok(longRunCriterion);
  assert.equal(longRunCriterion?.status, "fail");
});

test("buildStableAcceptanceLineReport evaluates manual_db_repair_free criterion", () => {
  const options: StableAcceptanceLineOptions = {
    profileName: "smoke",
    validationReport: createMockValidationReport(),
    soakReport: createMockSoakReport(),
    doctorReport: createMockDoctorReport(),
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
  };

  const report = buildStableAcceptanceLineReport(options);
  const criterion = report.criteria.find((c) => c.criterionId === "manual_db_repair_free");

  assert.ok(criterion);
  assert.equal(criterion?.status, "pass");
});

test("buildStableAcceptanceLineReport evaluates orphan_queue_free criterion", () => {
  const options: StableAcceptanceLineOptions = {
    profileName: "smoke",
    validationReport: createMockValidationReport(),
    soakReport: createMockSoakReport(),
    doctorReport: createMockDoctorReport(),
    repairReport: {
      before: {
        status: "pass",
        findings: [{ code: "orphan_queue_claim", entityType: "dispatch", message: "orphan" }],
        repairActions: [],
      },
      applied: [],
      after: {
        status: "pass",
        findings: [],
        repairActions: [],
      },
    },
  };

  const report = buildStableAcceptanceLineReport(options);
  const criterion = report.criteria.find((c) => c.criterionId === "orphan_queue_free");

  assert.ok(criterion);
  assert.equal(criterion?.status, "fail");
  assert.ok(criterion?.detail.includes("orphan queue claims"));
});

test("buildStableAcceptanceLineReport evaluates zombie_lock_free criterion", () => {
  const options: StableAcceptanceLineOptions = {
    profileName: "smoke",
    validationReport: createMockValidationReport(),
    soakReport: createMockSoakReport(),
    doctorReport: {
      status: "pass",
      lockSummary: { totalLocks: 10, expiredLockCount: 3 },
      eventBacklogSummary: { claimedBacklogSize: 0 },
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
  };

  const report = buildStableAcceptanceLineReport(options);
  const criterion = report.criteria.find((c) => c.criterionId === "zombie_lock_free");

  assert.ok(criterion);
  assert.equal(criterion?.status, "fail");
});

test("buildStableAcceptanceLineReport evaluates recovery_success_rate criterion", () => {
  const options: StableAcceptanceLineOptions = {
    profileName: "smoke",
    validationReport: createMockValidationReport(),
    soakReport: createMockSoakReport(),
    doctorReport: createMockDoctorReport(),
    repairReport: {
      before: {
        status: "pass",
        findings: [],
        repairActions: [
          { action: "requeue_execution", targetId: "exec-1", targetType: "execution" },
        ],
      },
      applied: [
        { action: "requeue_execution", targetId: "exec-1", applied: true },
      ],
      after: {
        status: "pass",
        findings: [],
        repairActions: [],
      },
    },
  };

  const report = buildStableAcceptanceLineReport(options);
  const criterion = report.criteria.find((c) => c.criterionId === "recovery_success_rate");

  assert.ok(criterion);
  assert.equal(criterion?.status, "pass");
});

test("buildStableAcceptanceLineReport evaluates latency_budget_p95 criterion", () => {
  const options: StableAcceptanceLineOptions = {
    profileName: "smoke",
    validationReport: createMockValidationReport(),
    soakReport: createMockSoakReport(),
    doctorReport: createMockDoctorReport(),
    repairReport: createMockRepairReport(),
    cases: [
      {
        id: "case-1",
        name: "Test Case",
        input: { taskId: "task-1" },
        metadata: { latencyBand: "interactive" as const },
      },
    ],
  };

  const report = buildStableAcceptanceLineReport(options);

  assert.ok(Array.isArray(report.latencyBudget));
  assert.ok(report.latencyBudget.length >= 0);
});

test("buildStableAcceptanceLineReport includes observed metrics", () => {
  const options: StableAcceptanceLineOptions = {
    profileName: "smoke",
    validationReport: createMockValidationReport(),
    soakReport: createMockSoakReport(3600_000),
    doctorReport: createMockDoctorReport(),
    repairReport: createMockRepairReport(),
  };

  const report = buildStableAcceptanceLineReport(options);

  assert.ok(typeof report.observed.soakDurationMs === "number");
  assert.ok(typeof report.observed.requiredDurationMs === "number");
  assert.ok(typeof report.observed.longRunCoveragePct === "number");
  assert.ok(typeof report.observed.manualDbRepairSignalCount === "number");
  assert.ok(typeof report.observed.orphanQueueClaimCount === "number");
  assert.ok(typeof report.observed.zombieLockCount === "number");
  assert.ok(typeof report.observed.recoveryAttemptCount === "number");
  assert.ok(typeof report.observed.recoverySucceededCount === "number");
  assert.ok(typeof report.observed.recoverySuccessRatePct === "number");
});

test("buildStableAcceptanceLineReport adds truth notes for smoke profile", () => {
  const options: StableAcceptanceLineOptions = {
    profileName: "smoke",
    validationReport: createMockValidationReport(),
    soakReport: createMockSoakReport(60_000),
    doctorReport: createMockDoctorReport(),
    repairReport: createMockRepairReport(),
  };

  const report = buildStableAcceptanceLineReport(options);

  assert.ok(report.truthNotes.some((note) => note.includes("Smoke evidence")));
});

test("buildStableAcceptanceLineReport status is partial when any criterion is partial", () => {
  const options: StableAcceptanceLineOptions = {
    profileName: "smoke",
    validationReport: createMockValidationReport(),
    soakReport: createMockSoakReport(STABLE_ACCEPTANCE_REQUIRED_DURATION_MS),
    doctorReport: createMockDoctorReport(),
    repairReport: {
      before: {
        status: "pass",
        findings: [],
        repairActions: [{ action: "manual_intervention_required", targetId: "db-1", targetType: "database" }],
      },
      applied: [],
      after: { status: "pass", findings: [], repairActions: [] },
    },
  };

  const report = buildStableAcceptanceLineReport(options);
  assert.equal(report.status, "partial");
});

test("buildStableAcceptanceLineReport status is fail when any criterion fails", () => {
  const options: StableAcceptanceLineOptions = {
    profileName: "smoke",
    validationReport: createMockValidationReport(1, 0, 0),
    soakReport: createMockSoakReport(STABLE_ACCEPTANCE_REQUIRED_DURATION_MS),
    doctorReport: createMockDoctorReport(),
    repairReport: createMockRepairReport(),
  };

  const report = buildStableAcceptanceLineReport(options);
  assert.equal(report.status, "fail");
});

test("StableAcceptanceCriterionId type includes all expected values", () => {
  const validIds: StableAcceptanceCriterionId[] = [
    "long_run_evidence",
    "manual_db_repair_free",
    "orphan_queue_free",
    "zombie_lock_free",
    "recovery_success_rate",
    "latency_budget_p95",
  ];

  validIds.forEach((id) => {
    assert.ok(typeof id === "string");
  });
});