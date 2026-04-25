import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  STABLE_EVIDENCE_PROFILES,
  buildStableAcceptanceLineReport,
  buildTakeoverEvidenceSample,
  createStableEvidenceBundle,
  resolveStableEvidenceProfile,
  seedTakeoverEvidenceScenario,
  writeJson,
} from "../../../../../src/platform/shared/stability/stable-evidence-bundle-support.js";
import {
  runStableValidation,
  type StableValidationReport,
} from "../../../../../src/platform/shared/stability/stable-runtime-validator.js";
import {
  runStableSoak,
  type StableSoakReport,
} from "../../../../../src/platform/shared/stability/stable-runtime-soak-runner.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("createStableEvidenceBundle runs smoke profile and produces all artifact paths", async () => {
  const workspace = createTempWorkspace("aa-evidence-bundle-smoke-");
  const outputDir = join(workspace, "stable-evidence");

  try {
    const report = await createStableEvidenceBundle({
      outputDir,
      profileName: "smoke",
      profileOverrides: {
        validationIterations: 1,
        soakDurationMs: 400,
        soakIntervalMs: 80,
        soakIterationsPerCycle: 1,
      },
    });

    assert.ok(report.startedAt.length > 0);
    assert.ok(report.finishedAt.length > 0);
    assert.equal(report.outputDir, outputDir);
    assert.equal(report.profile.name, "smoke");

    // All artifact paths exist
    assert.equal(existsSync(report.artifacts.bundleReportPath), true);
    assert.equal(existsSync(report.artifacts.chaosReportPath), true);
    assert.equal(existsSync(report.artifacts.promptInjectionReportPath), true);
    assert.equal(existsSync(report.artifacts.concurrencyReportPath), true);
    assert.equal(existsSync(report.artifacts.leaseReportPath), true);
    assert.equal(existsSync(report.artifacts.validationReportPath), true);
    assert.equal(existsSync(report.artifacts.soakReportPath), true);
    assert.equal(existsSync(report.artifacts.doctorReportPath), true);
    assert.equal(existsSync(report.artifacts.acceptanceReportPath), true);
    assert.equal(existsSync(report.artifacts.repairReportPath), true);
    assert.equal(existsSync(report.artifacts.drainEventsReportPath), true);
    assert.equal(existsSync(report.artifacts.diagnosticSnapshotPath), true);
    assert.equal(existsSync(report.artifacts.debugDumpPath), true);
    assert.equal(existsSync(report.artifacts.takeoverSamplePath), true);
    assert.equal(existsSync(report.artifacts.backupRestoreReportPath), true);
    assert.equal(existsSync(report.artifacts.backupRestorePlaybookPath), true);
    assert.equal(existsSync(report.artifacts.rollingUpgradeReportPath), true);
    assert.equal(existsSync(report.artifacts.maintenanceReportPath), true);
    assert.equal(existsSync(report.artifacts.grayReleaseReportPath), true);
    assert.equal(existsSync(report.artifacts.eventReplayReportPath), true);
    assert.equal(existsSync(report.artifacts.dbQueueDisconnectReportPath), true);
    assert.equal(existsSync(report.artifacts.dbWritabilityReportPath), true);
    assert.equal(existsSync(report.artifacts.queueDeliveryReportPath), true);
    assert.equal(existsSync(report.artifacts.migrationCompatibilityReportPath), true);
    assert.equal(existsSync(report.artifacts.runtimeDbPath), true);

    // Bundle report saved correctly
    const saved = JSON.parse(readFileSync(report.artifacts.bundleReportPath, "utf8"));
    assert.equal(saved.summary.passed, true);
    assert.equal(saved.profile.name, "smoke");
  } finally {
    cleanupPath(workspace);
  }
});

test("createStableEvidenceBundle smoke profile sets acceptance line to partial due to short duration", async () => {
  const workspace = createTempWorkspace("aa-evidence-acceptance-");
  const outputDir = join(workspace, "stable-evidence");

  try {
    const report = await createStableEvidenceBundle({
      outputDir,
      profileName: "smoke",
      profileOverrides: {
        validationIterations: 1,
        soakDurationMs: 500,
        soakIntervalMs: 100,
        soakIterationsPerCycle: 1,
      },
    });

    // Acceptance line is partial because smoke profile does not cover 14-day soak
    assert.equal(report.acceptanceLine.status, "partial");
    assert.ok(report.acceptanceLine.truthNotes.length > 0);
    assert.ok(report.acceptanceLine.truthNotes.some((note) => note.includes("14-day")));
    assert.equal(report.acceptanceLine.profileName, "smoke");
  } finally {
    cleanupPath(workspace);
  }
});

test("createStableEvidenceBundle smoke profile reports all sub-tests passing", async () => {
  const workspace = createTempWorkspace("aa-evidence-subtests-");
  const outputDir = join(workspace, "stable-evidence");

  try {
    const report = await createStableEvidenceBundle({
      outputDir,
      profileName: "smoke",
      profileOverrides: {
        validationIterations: 1,
        soakDurationMs: 400,
        soakIntervalMs: 80,
        soakIterationsPerCycle: 1,
      },
    });

    assert.equal(report.summary.passed, true);
    assert.equal(report.summary.chaosPassed, true);
    assert.equal(report.summary.promptInjectionPassed, true);
    assert.equal(report.summary.concurrencyPassed, true);
    assert.equal(report.summary.leasePassed, true);
    assert.equal(report.summary.rollbackPassed, true);
    assert.equal(report.summary.backupRestorePassed, true);
    assert.equal(report.summary.rollingUpgradePassed, true);
    assert.equal(report.summary.maintenancePassed, true);
    assert.equal(report.summary.grayReleasePassed, true);
    assert.equal(report.summary.eventReplayPassed, true);
    assert.equal(report.summary.dbQueueDisconnectPassed, true);
    assert.equal(report.summary.dbWritabilityPassed, true);
    assert.equal(report.summary.queueDeliveryPassed, true);
    assert.equal(report.summary.migrationCompatibilityPassed, true);
    assert.equal(report.summary.validationPassed, true);
    assert.equal(report.summary.soakPassed, true);
    assert.equal(report.summary.takeoverSampleClosedLoop, true);
    assert.equal(report.summary.doctorStatus, "ok");
    assert.equal(report.summary.repairAfterStatus, "pass");
    assert.equal(report.summary.pendingAckBacklogAfterDrain, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("STABLE_EVIDENCE_PROFILES smoke profile has expected short duration settings", () => {
  const smoke = STABLE_EVIDENCE_PROFILES["smoke"];
  assert.equal(smoke.name, "smoke");
  assert.equal(smoke.validationIterations, 2);
  assert.equal(smoke.soakDurationMs, 5_000);
  assert.equal(smoke.soakIntervalMs, 500);
  assert.equal(smoke.soakIterationsPerCycle, 1);
});

test("STABLE_EVIDENCE_PROFILES 24h profile has expected full-day duration settings", () => {
  const profile = STABLE_EVIDENCE_PROFILES["24h"];
  assert.equal(profile.name, "24h");
  assert.equal(profile.validationIterations, 5);
  assert.equal(profile.soakDurationMs, 24 * 60 * 60 * 1000);
  assert.equal(profile.soakIntervalMs, 5 * 60 * 1000);
  assert.equal(profile.soakIterationsPerCycle, 3);
});

test("STABLE_EVIDENCE_PROFILES 72h profile has expected 3-day duration settings", () => {
  const profile = STABLE_EVIDENCE_PROFILES["72h"];
  assert.equal(profile.name, "72h");
  assert.equal(profile.validationIterations, 8);
  assert.equal(profile.soakDurationMs, 72 * 60 * 60 * 1000);
  assert.equal(profile.soakIntervalMs, 10 * 60 * 1000);
  assert.equal(profile.soakIterationsPerCycle, 3);
});

test("resolveStableEvidenceProfile merges overrides correctly", () => {
  const merged = resolveStableEvidenceProfile("smoke", {
    soakDurationMs: 99_000,
    validationIterations: 99,
  });
  assert.equal(merged.name, "smoke");
  assert.equal(merged.soakDurationMs, 99_000);
  assert.equal(merged.validationIterations, 99);
  // defaults preserved
  assert.equal(merged.soakIntervalMs, 500);
  assert.equal(merged.soakIterationsPerCycle, 1);
});

test("buildStableAcceptanceLineReport produces correct criteria and latency budgets", async () => {
  const workspace = createTempWorkspace("aa-acceptance-line-");
  const validationDir = join(workspace, "validation");
  const soakDir = join(workspace, "soak");

  try {
    const validationReport = await runStableValidation({ outputDir: validationDir, iterations: 1 });
    const soakReport = await runStableSoak({
      outputDir: soakDir,
      durationMs: 200,
      intervalMs: 50,
      iterationsPerCycle: 1,
    });

    const acceptanceLine = buildStableAcceptanceLineReport({
      profileName: "smoke",
      validationReport,
      soakReport,
      doctorReport: {
        status: "ok",
        lockSummary: { totalLocks: 0, expiredLockCount: 0 },
        eventBacklogSummary: { claimedBacklogSize: 0 },
      },
      repairReport: {
        before: { status: "pass", findings: [], repairActions: [] },
        applied: [],
        after: { status: "pass", findings: [], repairActions: [] },
      },
    });

    assert.ok(acceptanceLine.evaluatedAt.length > 0);
    // Smoke profile with short soak duration yields "partial" status
    assert.equal(acceptanceLine.status, "partial");
    assert.equal(acceptanceLine.profileName, "smoke");
    assert.ok(acceptanceLine.truthNotes.length > 0);
    assert.ok(acceptanceLine.criteria.length >= 6);
    assert.ok(acceptanceLine.latencyBudget.length === 2);

    const longRunCriterion = acceptanceLine.criteria.find((c) => c.criterionId === "long_run_evidence");
    assert.ok(longRunCriterion);
    assert.equal(longRunCriterion.status, "partial"); // short soak = partial

    const latencyCriterion = acceptanceLine.criteria.find((c) => c.criterionId === "latency_budget_p95");
    assert.ok(latencyCriterion);
    assert.ok(latencyCriterion.metrics.interactiveP95Ms !== undefined);
    assert.ok(latencyCriterion.metrics.extendedP95Ms !== undefined);

    // Latency budget statuses present
    const interactiveBudget = acceptanceLine.latencyBudget.find((b) => b.latencyBand === "interactive");
    const extendedBudget = acceptanceLine.latencyBudget.find((b) => b.latencyBand === "extended");
    assert.ok(interactiveBudget);
    assert.ok(extendedBudget);
    assert.equal(interactiveBudget.budgetMs, 30_000);
    assert.equal(extendedBudget.budgetMs, 120_000);
  } finally {
    cleanupPath(workspace);
  }
});

test("createStableEvidenceBundle computes correct summary counts", async () => {
  const workspace = createTempWorkspace("aa-evidence-summary-");
  const outputDir = join(workspace, "stable-evidence");

  try {
    const report = await createStableEvidenceBundle({
      outputDir,
      profileName: "smoke",
      profileOverrides: {
        validationIterations: 1,
        soakDurationMs: 400,
        soakIntervalMs: 80,
        soakIterationsPerCycle: 1,
      },
    });

    // Smoke profile runs 2 validation iterations total (baseline + 1)
    assert.ok(report.summary.totalValidationRuns >= 1);
    assert.ok(report.summary.totalSoakRuns >= 1);
    assert.equal(report.summary.totalChaosScenarios, 5);
    assert.equal(report.summary.totalPromptInjectionScenarios, 5);
    assert.equal(report.summary.totalRollbackScenarios, 2);
    assert.equal(report.summary.totalRollingUpgradeScenarios, 2);
    assert.equal(report.summary.totalMaintenanceScenarios, 2);
    assert.equal(report.summary.totalGrayReleaseScenarios, 2);
    assert.equal(report.summary.totalDbQueueDisconnectScenarios, 3);
    assert.equal(report.summary.totalDbWritabilityScenarios, 3);
    assert.equal(report.summary.totalQueueDeliveryScenarios, 2);
    assert.equal(report.summary.totalMigrationCompatibilityScenarios, 2);
    assert.equal(report.summary.failedValidationRuns, 0);
    assert.equal(report.summary.failedSoakRuns, 0);
    assert.equal(report.summary.failedChaosScenarios, 0);
    assert.equal(report.summary.failedPromptInjectionScenarios, 0);
    assert.equal(report.summary.failedRollbackScenarios, 0);
    assert.equal(report.summary.failedRollingUpgradeScenarios, 0);
    assert.equal(report.summary.failedMaintenanceScenarios, 0);
    assert.equal(report.summary.failedGrayReleaseScenarios, 0);
    assert.equal(report.summary.failedDbQueueDisconnectScenarios, 0);
    assert.equal(report.summary.failedDbWritabilityScenarios, 0);
    assert.equal(report.summary.failedQueueDeliveryScenarios, 0);
    assert.equal(report.summary.failedMigrationCompatibilityScenarios, 0);
    assert.equal(report.summary.integrityFailures, 0);
    assert.equal(report.summary.backupFailures, 0);
  } finally {
    cleanupPath(workspace);
  }
});