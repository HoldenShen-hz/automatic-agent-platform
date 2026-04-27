import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  buildStableAcceptanceLineReport,
  STABLE_ACCEPTANCE_REQUIRED_DURATION_MS,
  STABLE_ACCEPTANCE_P95_BUDGET_MS,
  type StableAcceptanceLineOptions,
  type StableAcceptanceLatencyBudgetStatus,
} from "../../../../src/platform/stability/stable-acceptance-line.js";
import type { GoldenTaskCase } from "../../../../src/platform/stability/golden-task-runner.js";

describe("stable-acceptance-line comprehensive", () => {
  describe("constants", () => {
    test("STABLE_ACCEPTANCE_REQUIRED_DURATION_MS equals 14 days in milliseconds", () => {
      const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
      assert.equal(STABLE_ACCEPTANCE_REQUIRED_DURATION_MS, fourteenDaysMs);
    });

    test("STABLE_ACCEPTANCE_P95_BUDGET_MS has correct values", () => {
      assert.equal(STABLE_ACCEPTANCE_P95_BUDGET_MS.interactive, 30_000);
      assert.equal(STABLE_ACCEPTANCE_P95_BUDGET_MS.extended, 120_000);
    });
  });

  describe("buildStableAcceptanceLineReport", () => {
    const createMinimalOptions = (overrides: Partial<StableAcceptanceLineOptions> = {}): StableAcceptanceLineOptions => ({
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
      ...overrides,
    });

    test("returns report with correct structure", () => {
      const report = buildStableAcceptanceLineReport(createMinimalOptions());

      assert.ok(report.evaluatedAt.length > 0);
      assert.ok(["pass", "partial", "fail"].includes(report.status));
      assert.equal(report.profileName, "smoke");
      assert.ok(Array.isArray(report.truthNotes));
      assert.ok(Array.isArray(report.criteria));
      assert.ok(report.observed);
      assert.ok(Array.isArray(report.latencyBudget));
    });

    test("returns pass when all criteria are met and duration is sufficient", () => {
      // Build options with proper 14d soak duration and no failures
      const interactiveCase: GoldenTaskCase = {
        id: "interactive_case",
        title: "Interactive case",
        request: "Test request",
        metadata: {
          expectedClass: "coding",
          successCriteria: ["test"],
          costCeilingUsd: 0.01,
          latencyBand: "interactive",
          approvalExpectation: "not_expected",
          recoveryExpectation: "not_required",
        },
        expected: {
          taskStatus: "done",
          workflowStatus: "completed",
          executionStatus: "succeeded",
          sessionStatus: "completed",
          eventTypes: [],
          stepOutputs: 0,
        },
      };

      const extendedCase: GoldenTaskCase = {
        id: "extended_case",
        title: "Extended case",
        request: "Test request",
        metadata: {
          expectedClass: "crash_recovery",
          successCriteria: ["test"],
          costCeilingUsd: 0.01,
          latencyBand: "extended",
          approvalExpectation: "not_expected",
          recoveryExpectation: "requeue_supported",
        },
        expected: {
          taskStatus: "done",
          workflowStatus: "completed",
          executionStatus: "succeeded",
          sessionStatus: "completed",
          eventTypes: [],
          stepOutputs: 0,
        },
      };

      const options: StableAcceptanceLineOptions = {
        profileName: "full_acceptance",
        validationReport: {
          startedAt: "2026-04-01T00:00:00.000Z",
          finishedAt: "2026-04-01T00:01:00.000Z",
          iterations: 1,
          totalRuns: 2,
          passedRuns: 2,
          failedRuns: 0,
          integrityFailures: 0,
          backupFailures: 0,
          averageDurationMs: 60000,
          maxDurationMs: 120000,
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
          runs: [
            { iteration: 1, caseId: "interactive_case", passed: true, durationMs: 1000, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/1" },
            { iteration: 1, caseId: "extended_case", passed: true, durationMs: 60000, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/2" },
          ],
        },
        soakReport: {
          startedAt: "2026-04-01T00:00:00.000Z",
          finishedAt: "2026-04-15T00:00:00.000Z",
          durationMs: STABLE_ACCEPTANCE_REQUIRED_DURATION_MS,
          wallClockDurationMs: STABLE_ACCEPTANCE_REQUIRED_DURATION_MS,
          intervalMs: 500,
          iterationsPerCycle: 1,
          cycles: [],
          totalRuns: 100,
          failedRuns: 0,
          passedRuns: 100,
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
        cases: [interactiveCase, extendedCase],
      };

      const report = buildStableAcceptanceLineReport(options);

      assert.equal(report.status, "pass");
    });

    test("returns partial when soak duration is below 14 days", () => {
      const report = buildStableAcceptanceLineReport(createMinimalOptions({
        profileName: "24h",
        soakReport: {
          startedAt: "2026-04-01T00:00:00.000Z",
          finishedAt: "2026-04-02T00:00:00.000Z",
          durationMs: 86_400_000,
          wallClockDurationMs: 86_400_000,
          intervalMs: 500,
          iterationsPerCycle: 1,
          cycles: [],
          totalRuns: 100,
          failedRuns: 0,
          passedRuns: 100,
          integrityFailures: 0,
          backupFailures: 0,
        },
      }));

      assert.equal(report.status, "partial");
      const longRunCriterion = report.criteria.find((c) => c.criterionId === "long_run_evidence");
      assert.equal(longRunCriterion?.status, "partial");
    });

    test("returns fail when validation has failed runs", () => {
      const report = buildStableAcceptanceLineReport(createMinimalOptions({
        validationReport: {
          startedAt: "2026-04-01T00:00:00.000Z",
          finishedAt: "2026-04-01T00:01:00.000Z",
          iterations: 1,
          totalRuns: 5,
          passedRuns: 3,
          failedRuns: 2,
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
      }));

      assert.equal(report.status, "fail");
      const longRunCriterion = report.criteria.find((c) => c.criterionId === "long_run_evidence");
      assert.equal(longRunCriterion?.status, "fail");
    });

    test("returns fail when soak has integrity failures", () => {
      const report = buildStableAcceptanceLineReport(createMinimalOptions({
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
          integrityFailures: 2,
          backupFailures: 0,
        },
      }));

      assert.equal(report.status, "fail");
    });

    test("returns fail when soak has backup failures", () => {
      const report = buildStableAcceptanceLineReport(createMinimalOptions({
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
          backupFailures: 3,
        },
      }));

      assert.equal(report.status, "fail");
    });

    test("manual_db_repair_free criterion passes when no manual intervention required", () => {
      const report = buildStableAcceptanceLineReport(createMinimalOptions({
        repairReport: {
          before: {
            status: "pass",
            findings: [],
            repairActions: [
              { action: "release_stale_lock", targetId: "lock-1", targetType: "file_lock", applied: true },
            ],
          },
          applied: [{ action: "release_stale_lock", targetId: "lock-1", targetType: "file_lock", applied: true, result: "success" }],
          after: { status: "pass", findings: [], repairActions: [] },
        },
      }));

      const criterion = report.criteria.find((c) => c.criterionId === "manual_db_repair_free");
      assert.equal(criterion?.status, "pass");
    });

    test("manual_db_repair_free criterion fails when manual intervention required", () => {
      const report = buildStableAcceptanceLineReport(createMinimalOptions({
        repairReport: {
          before: {
            status: "fail_closed",
            findings: [{ code: "db_integrity_error", entityType: "database", message: "DB integrity error", severity: "high", entityId: "db-1" }],
            repairActions: [
              { action: "manual_intervention_required", targetId: "db-1", targetType: "database" },
            ],
          },
          applied: [],
          after: { status: "pass", findings: [], repairActions: [] },
        },
      }));

      const criterion = report.criteria.find((c) => c.criterionId === "manual_db_repair_free");
      assert.equal(criterion?.status, "fail");
    });

    test("orphan_queue_free criterion passes when no orphan queues detected", () => {
      const report = buildStableAcceptanceLineReport(createMinimalOptions({
        repairReport: {
          before: {
            status: "pass",
            findings: [],
            repairActions: [],
          },
          applied: [],
          after: { status: "pass", findings: [], repairActions: [] },
        },
        doctorReport: {
          status: "ok",
          lockSummary: { totalLocks: 0, expiredLockCount: 0, exclusiveLocks: 0, sharedLocks: 0, taskIds: [], executionIds: [], ownerIds: [], resourcePaths: [], checked: false },
          eventBacklogSummary: { queueBacklogSize: 10, claimedBacklogSize: 0, pendingTier1Acks: 0, failedTier1Acks: 0, dispatchableBacklogSize: 5, oldestWaitSeconds: null, oldestClaimAgeSeconds: null, starvationDetected: false },
        },
      }));

      const criterion = report.criteria.find((c) => c.criterionId === "orphan_queue_free");
      assert.equal(criterion?.status, "pass");
    });

    test("orphan_queue_free criterion fails when orphan queue claims detected", () => {
      const report = buildStableAcceptanceLineReport(createMinimalOptions({
        repairReport: {
          before: {
            status: "pass",
            findings: [
              { code: "orphan_queue_claim", entityType: "queue", message: "Orphan queue detected", severity: "medium", entityId: "queue-1" },
            ],
            repairActions: [],
          },
          applied: [],
          after: { status: "pass", findings: [], repairActions: [] },
        },
      }));

      const criterion = report.criteria.find((c) => c.criterionId === "orphan_queue_free");
      assert.equal(criterion?.status, "fail");
    });

    test("zombie_lock_free criterion passes when no expired locks", () => {
      const report = buildStableAcceptanceLineReport(createMinimalOptions({
        repairReport: {
          before: {
            status: "pass",
            findings: [],
            repairActions: [],
          },
          applied: [],
          after: { status: "pass", findings: [], repairActions: [] },
        },
        doctorReport: {
          status: "ok",
          lockSummary: { totalLocks: 5, expiredLockCount: 0, exclusiveLocks: 2, sharedLocks: 3, taskIds: [], executionIds: [], ownerIds: [], resourcePaths: [], checked: false },
          eventBacklogSummary: { queueBacklogSize: 0, claimedBacklogSize: 0, pendingTier1Acks: 0, failedTier1Acks: 0, dispatchableBacklogSize: 0, oldestWaitSeconds: null, oldestClaimAgeSeconds: null, starvationDetected: false },
        },
      }));

      const criterion = report.criteria.find((c) => c.criterionId === "zombie_lock_free");
      assert.equal(criterion?.status, "pass");
    });

    test("zombie_lock_free criterion fails when expired locks detected", () => {
      const report = buildStableAcceptanceLineReport(createMinimalOptions({
        doctorReport: {
          status: "degraded",
          lockSummary: { totalLocks: 5, expiredLockCount: 2, exclusiveLocks: 2, sharedLocks: 3, taskIds: [], executionIds: [], ownerIds: [], resourcePaths: [], checked: false },
          eventBacklogSummary: { queueBacklogSize: 0, claimedBacklogSize: 0, pendingTier1Acks: 0, failedTier1Acks: 0, dispatchableBacklogSize: 0, oldestWaitSeconds: null, oldestClaimAgeSeconds: null, starvationDetected: false },
        },
      }));

      const criterion = report.criteria.find((c) => c.criterionId === "zombie_lock_free");
      assert.equal(criterion?.status, "fail");
    });

    test("recovery_success_rate criterion passes when all automatic recoveries succeed", () => {
      const report = buildStableAcceptanceLineReport(createMinimalOptions({
        repairReport: {
          before: {
            status: "degraded",
            findings: [{ code: "stale_lock", entityType: "file_lock", message: "Stale lock", severity: "low", entityId: "lock-1" }],
            repairActions: [
              { action: "release_stale_lock", targetId: "lock-1", targetType: "file_lock" },
            ],
          },
          applied: [{ action: "release_stale_lock", targetId: "lock-1", targetType: "file_lock", applied: true, result: "success" }],
          after: { status: "pass", findings: [], repairActions: [] },
        },
      }));

      const criterion = report.criteria.find((c) => c.criterionId === "recovery_success_rate");
      assert.equal(criterion?.status, "pass");
      assert.equal(report.observed.recoverySuccessRatePct, 100);
    });

    test("recovery_success_rate criterion fails when automatic recoveries fail", () => {
      const report = buildStableAcceptanceLineReport(createMinimalOptions({
        repairReport: {
          before: {
            status: "degraded",
            findings: [{ code: "stale_lock", entityType: "file_lock", message: "Stale lock", severity: "low", entityId: "lock-1" }],
            repairActions: [
              { action: "release_stale_lock", targetId: "lock-1", targetType: "file_lock" },
            ],
          },
          applied: [{ action: "release_stale_lock", targetId: "lock-1", targetType: "file_lock", applied: false, result: "failed" }],
          after: { status: "pass", findings: [], repairActions: [] },
        },
      }));

      const criterion = report.criteria.find((c) => c.criterionId === "recovery_success_rate");
      assert.equal(criterion?.status, "fail");
      assert.equal(report.observed.recoverySuccessRatePct, 0);
    });

    test("latency_budget_p95 criterion pass when P95 within budget", () => {
      const interactiveCase: GoldenTaskCase = {
        id: "interactive_case",
        title: "Interactive case",
        request: "Test",
        metadata: {
          expectedClass: "coding",
          successCriteria: ["test"],
          costCeilingUsd: 0.01,
          latencyBand: "interactive",
          approvalExpectation: "not_expected",
          recoveryExpectation: "not_required",
        },
        expected: {
          taskStatus: "done",
          workflowStatus: "completed",
          executionStatus: "succeeded",
          sessionStatus: "completed",
          eventTypes: [],
          stepOutputs: 0,
        },
      };

      const extendedCase: GoldenTaskCase = {
        id: "extended_case",
        title: "Extended case",
        request: "Test",
        metadata: {
          expectedClass: "crash_recovery",
          successCriteria: ["test"],
          costCeilingUsd: 0.01,
          latencyBand: "extended",
          approvalExpectation: "not_expected",
          recoveryExpectation: "requeue_supported",
        },
        expected: {
          taskStatus: "done",
          workflowStatus: "completed",
          executionStatus: "succeeded",
          sessionStatus: "completed",
          eventTypes: [],
          stepOutputs: 0,
        },
      };

      const options: StableAcceptanceLineOptions = {
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
          averageDurationMs: 60000,
          maxDurationMs: 120000,
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
          runs: [
            { iteration: 1, caseId: "interactive_case", passed: true, durationMs: 10000, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/1" },
            { iteration: 1, caseId: "extended_case", passed: true, durationMs: 60000, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/2" },
          ],
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
        cases: [interactiveCase, extendedCase],
      };

      const report = buildStableAcceptanceLineReport(options);

      const criterion = report.criteria.find((c) => c.criterionId === "latency_budget_p95");
      assert.equal(criterion?.status, "pass");
    });

    test("latency_budget_p95 criterion fail when P95 exceeds budget", () => {
      const customCase: GoldenTaskCase = {
        id: "interactive_case",
        title: "Interactive case",
        request: "Test",
        metadata: {
          expectedClass: "coding",
          successCriteria: ["test"],
          costCeilingUsd: 0.01,
          latencyBand: "interactive",
          approvalExpectation: "not_expected",
          recoveryExpectation: "not_required",
        },
        expected: {
          taskStatus: "done",
          workflowStatus: "completed",
          executionStatus: "succeeded",
          sessionStatus: "completed",
          eventTypes: [],
          stepOutputs: 0,
        },
      };

      const extendedCase: GoldenTaskCase = {
        id: "extended_case",
        title: "Extended case",
        request: "Test",
        metadata: {
          expectedClass: "crash_recovery",
          successCriteria: ["test"],
          costCeilingUsd: 0.01,
          latencyBand: "extended",
          approvalExpectation: "not_expected",
          recoveryExpectation: "requeue_supported",
        },
        expected: {
          taskStatus: "done",
          workflowStatus: "completed",
          executionStatus: "succeeded",
          sessionStatus: "completed",
          eventTypes: [],
          stepOutputs: 0,
        },
      };

      const options: StableAcceptanceLineOptions = {
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
          averageDurationMs: 100000,
          maxDurationMs: 200000,
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
          runs: [
            { iteration: 1, caseId: "interactive_case", passed: true, durationMs: 40000, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/1" },
            { iteration: 1, caseId: "extended_case", passed: true, durationMs: 150000, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/2" },
          ],
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
        cases: [customCase, extendedCase],
      };

      const report = buildStableAcceptanceLineReport(options);

      const criterion = report.criteria.find((c) => c.criterionId === "latency_budget_p95");
      assert.equal(criterion?.status, "fail");
    });

    test("includes all six criteria", () => {
      const report = buildStableAcceptanceLineReport(createMinimalOptions());

      const criterionIds = report.criteria.map((c) => c.criterionId);
      assert.ok(criterionIds.includes("long_run_evidence"));
      assert.ok(criterionIds.includes("manual_db_repair_free"));
      assert.ok(criterionIds.includes("orphan_queue_free"));
      assert.ok(criterionIds.includes("zombie_lock_free"));
      assert.ok(criterionIds.includes("recovery_success_rate"));
      assert.ok(criterionIds.includes("latency_budget_p95"));
    });

    test("includes latency budget for both bands", () => {
      const report = buildStableAcceptanceLineReport(createMinimalOptions());

      assert.ok(Array.isArray(report.latencyBudget));
      assert.equal(report.latencyBudget.length, 2);
      assert.ok(report.latencyBudget.some((lb) => lb.latencyBand === "interactive"));
      assert.ok(report.latencyBudget.some((lb) => lb.latencyBand === "extended"));
    });

    test("includes truth notes for smoke profile", () => {
      const report = buildStableAcceptanceLineReport(createMinimalOptions({
        profileName: "smoke",
      }));

      assert.ok(report.truthNotes.some((note) => note.includes("Smoke evidence")));
    });

    test("includes truth notes when duration below 14 days", () => {
      const report = buildStableAcceptanceLineReport(createMinimalOptions({
        profileName: "24h",
        soakReport: {
          startedAt: "2026-04-01T00:00:00.000Z",
          finishedAt: "2026-04-02T00:00:00.000Z",
          durationMs: 86_400_000,
          wallClockDurationMs: 86_400_000,
          intervalMs: 500,
          iterationsPerCycle: 1,
          cycles: [],
          totalRuns: 100,
          failedRuns: 0,
          passedRuns: 100,
          integrityFailures: 0,
          backupFailures: 0,
        },
      }));

      assert.ok(report.truthNotes.some((note) => note.includes("does not truthfully prove")));
    });

    test("observed has correct structure with all fields", () => {
      const report = buildStableAcceptanceLineReport(createMinimalOptions());

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

    test("criteria have correct structure", () => {
      const report = buildStableAcceptanceLineReport(createMinimalOptions());

      for (const criterion of report.criteria) {
        assert.ok(["long_run_evidence", "manual_db_repair_free", "orphan_queue_free", "zombie_lock_free", "recovery_success_rate", "latency_budget_p95"].includes(criterion.criterionId));
        assert.ok(["pass", "partial", "fail"].includes(criterion.status));
        assert.ok(typeof criterion.detail === "string");
        assert.ok(typeof criterion.metrics === "object");
      }
    });

    test("latency budget statuses have correct structure", () => {
      const report = buildStableAcceptanceLineReport(createMinimalOptions());

      for (const lb of report.latencyBudget) {
        assert.ok(["interactive", "extended"].includes(lb.latencyBand));
        assert.ok(typeof lb.budgetMs === "number");
        assert.ok(typeof lb.sampleCount === "number");
        assert.ok(lb.p95DurationMs === null || typeof lb.p95DurationMs === "number");
        assert.ok(lb.maxDurationMs === null || typeof lb.maxDurationMs === "number");
        assert.ok(["pass", "partial", "fail"].includes(lb.status));
      }
    });
  });
});
