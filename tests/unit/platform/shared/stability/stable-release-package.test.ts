import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { createStableReleasePackage } from "../../../../../src/platform/shared/stability/stable-release-package.js";
import type {
  StableReleasePackageOptions,
  StableReleasePackageReport,
  StableReleaseChecklist,
  StableReleaseChecklistItem,
} from "../../../../../src/platform/shared/stability/stable-release-package.js";

function createTempWorkspace(name: string): string {
  const path = join("/tmp", `${name}-${Date.now()}`);
  mkdirSync(path, { recursive: true });
  return path;
}

function seedEmptyEvidenceProfile(evidenceRoot: string, profile: string): void {
  const profileDir = join(evidenceRoot, profile);
  mkdirSync(profileDir, { recursive: true });
  // Create an empty report to simulate a passing smoke test
  writeFileSync(
    join(profileDir, "stable-evidence-report.json"),
    JSON.stringify({
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      profile: { name: profile },
      summary: {
        passed: true,
        chaosPassed: true,
        leasePassed: true,
        rollbackPassed: true,
        rollingUpgradePassed: true,
        maintenancePassed: true,
        grayReleasePassed: true,
        dbQueueDisconnectPassed: true,
        dbWritabilityPassed: true,
        queueDeliveryPassed: true,
        migrationCompatibilityPassed: true,
        validationPassed: true,
        soakPassed: true,
        doctorStatus: "ok",
        startupConsistencyStatus: "pass",
        repairAfterStatus: "pass",
        totalValidationRuns: 2,
        totalSoakRuns: 2,
        totalChaosScenarios: 5,
        totalPromptInjectionScenarios: 3,
        totalRollingUpgradeScenarios: 1,
        totalMaintenanceScenarios: 1,
        totalGrayReleaseScenarios: 1,
        totalDbQueueDisconnectScenarios: 1,
        totalDbWritabilityScenarios: 1,
        totalQueueDeliveryScenarios: 1,
        totalMigrationCompatibilityScenarios: 1,
        totalRollbackScenarios: 1,
        failedValidationRuns: 0,
        failedSoakRuns: 0,
        failedChaosScenarios: 0,
        failedPromptInjectionScenarios: 0,
        failedRollingUpgradeScenarios: 0,
        failedMaintenanceScenarios: 0,
        failedGrayReleaseScenarios: 0,
        failedDbQueueDisconnectScenarios: 0,
        failedDbWritabilityScenarios: 0,
        failedQueueDeliveryScenarios: 0,
        failedMigrationCompatibilityScenarios: 0,
        failedRollbackScenarios: 0,
        integrityFailures: 0,
        backupFailures: 0,
        pendingAckBacklogAfterDrain: 0,
        takeoverSampleClosedLoop: true,
        acceptanceLineStatus: "pass",
      },
      acceptanceLine: {
        status: "pass",
        criteria: [],
        observed: {
          soakDurationMs: 14 * 24 * 60 * 60 * 1000,
        },
      },
      artifacts: {
        backupRestorePlaybookPath: join(profileDir, "backup-restore", "playbook.json"),
        rollingUpgradePlaybookPath: join(profileDir, "upgrade", "playbook.json"),
        maintenancePlaybookPath: join(profileDir, "maintenance", "playbook.json"),
        grayReleasePlaybookPath: join(profileDir, "gray", "playbook.json"),
      },
    }),
  );
}

function seedEmptyEvidenceProfileMissingPlaybooks(evidenceRoot: string, profile: string): void {
  const profileDir = join(evidenceRoot, profile);
  mkdirSync(profileDir, { recursive: true });
  // Create report without playbooks
  writeFileSync(
    join(profileDir, "stable-evidence-report.json"),
    JSON.stringify({
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      profile: { name: profile },
      summary: {
        passed: true,
        chaosPassed: true,
        leasePassed: true,
        rollbackPassed: true,
        rollingUpgradePassed: true,
        maintenancePassed: true,
        grayReleasePassed: true,
        dbQueueDisconnectPassed: true,
        dbWritabilityPassed: true,
        queueDeliveryPassed: true,
        migrationCompatibilityPassed: true,
        validationPassed: true,
        soakPassed: true,
        doctorStatus: "ok",
        startupConsistencyStatus: "pass",
        repairAfterStatus: "pass",
        totalValidationRuns: 2,
        totalSoakRuns: 2,
        totalChaosScenarios: 5,
        totalPromptInjectionScenarios: 3,
        totalRollingUpgradeScenarios: 1,
        totalMaintenanceScenarios: 1,
        totalGrayReleaseScenarios: 1,
        totalDbQueueDisconnectScenarios: 1,
        totalDbWritabilityScenarios: 1,
        totalQueueDeliveryScenarios: 1,
        totalMigrationCompatibilityScenarios: 1,
        totalRollbackScenarios: 1,
        failedValidationRuns: 0,
        failedSoakRuns: 0,
        failedChaosScenarios: 0,
        failedPromptInjectionScenarios: 0,
        failedRollingUpgradeScenarios: 0,
        failedMaintenanceScenarios: 0,
        failedGrayReleaseScenarios: 0,
        failedDbQueueDisconnectScenarios: 0,
        failedDbWritabilityScenarios: 0,
        failedQueueDeliveryScenarios: 0,
        failedMigrationCompatibilityScenarios: 0,
        failedRollbackScenarios: 0,
        integrityFailures: 0,
        backupFailures: 0,
        pendingAckBacklogAfterDrain: 0,
        takeoverSampleClosedLoop: true,
        acceptanceLineStatus: "pass",
      },
      acceptanceLine: {
        status: "pass",
        criteria: [],
        observed: {
          soakDurationMs: 14 * 24 * 60 * 60 * 1000,
        },
      },
      artifacts: {},
    }),
  );
}

test("StableReleasePackageOptions interface accepts valid options [stable-release-package]", () => {
  const options: StableReleasePackageOptions = {
    evidenceRootDir: "/tmp/evidence",
    outputDir: "/tmp/output",
    targetStatus: "canary",
  };

  assert.equal(options.evidenceRootDir, "/tmp/evidence");
  assert.equal(options.outputDir, "/tmp/output");
  assert.equal(options.targetStatus, "canary");
});

test("StableReleasePackageOptions targetStatus is optional [stable-release-package]", () => {
  const options: StableReleasePackageOptions = {
    evidenceRootDir: "/tmp/evidence",
    outputDir: "/tmp/output",
  };

  assert.equal(options.targetStatus, undefined);
});

test("StableReleasePackageReport has correct structure for canary promotion [stable-release-package]", () => {
  const workspace = createTempWorkspace("aa-stable-package-canary-");
  const evidenceRoot = join(workspace, "evidence");
  const outputDir = join(workspace, "output");

  try {
    seedEmptyEvidenceProfile(evidenceRoot, "smoke");

    const report = createStableReleasePackage({
      evidenceRootDir: evidenceRoot,
      outputDir,
      targetStatus: "canary",
    });

    assert.equal(report.componentId, "stable_core");
    assert.equal(report.targetStatus, "canary");
    assert.ok(Array.isArray(report.missingRequiredProfiles));
    assert.ok(Array.isArray(report.failingProfiles));
    assert.ok(Array.isArray(report.profiles));
    assert.ok(Array.isArray(report.nextActions));
    assert.ok(Array.isArray(report.runbookRefs));
    assert.ok(Array.isArray(report.recommendedCommands));
    assert.ok(report.releaseChecklist);
    assert.ok(report.gate);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("StableReleasePackageReport includes smoke profile summary [stable-release-package]", () => {
  const workspace = createTempWorkspace("aa-stable-package-smoke-");
  const evidenceRoot = join(workspace, "evidence");
  const outputDir = join(workspace, "output");

  try {
    seedEmptyEvidenceProfile(evidenceRoot, "smoke");

    const report = createStableReleasePackage({
      evidenceRootDir: evidenceRoot,
      outputDir,
    });

    const smokeProfile = report.profiles.find((p) => p.profile === "smoke");
    assert.ok(smokeProfile);
    assert.equal(smokeProfile.present, true);
    assert.equal(smokeProfile.passed, true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("StableReleasePackageReport missing smoke profile when not present [stable-release-package]", () => {
  const workspace = createTempWorkspace("aa-stable-package-missing-");
  const evidenceRoot = join(workspace, "evidence");
  const outputDir = join(workspace, "output");

  try {
    const report = createStableReleasePackage({
      evidenceRootDir: evidenceRoot,
      outputDir,
    });

    const smokeProfile = report.profiles.find((p) => p.profile === "smoke");
    assert.ok(smokeProfile);
    assert.equal(smokeProfile.present, false);
    assert.equal(smokeProfile.passed, null);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("StableReleasePackageReport verdict is conditional when profiles missing [stable-release-package]", () => {
  const workspace = createTempWorkspace("aa-stable-package-conditional-");
  const evidenceRoot = join(workspace, "evidence");
  const outputDir = join(workspace, "output");

  try {
    // Don't seed any profiles - should be conditional or blocked
    const report = createStableReleasePackage({
      evidenceRootDir: evidenceRoot,
      outputDir,
      targetStatus: "canary",
    });

    assert.ok(
      report.overallVerdict === "conditional" || report.overallVerdict === "promote_blocked",
      `Expected conditional or blocked, got ${report.overallVerdict}`,
    );
    assert.ok(report.missingRequiredProfiles.includes("smoke"));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("StableReleasePackageReport nextActions includes smoke action when missing [stable-release-package]", () => {
  const workspace = createTempWorkspace("aa-stable-package-actions-");
  const evidenceRoot = join(workspace, "evidence");
  const outputDir = join(workspace, "output");

  try {
    const report = createStableReleasePackage({
      evidenceRootDir: evidenceRoot,
      outputDir,
      targetStatus: "canary",
    });

    const hasSmokeAction = report.nextActions.some(
      (action) => action.includes("smoke evidence") || action.includes("smoke"),
    );
    assert.ok(hasSmokeAction, "Expected action related to smoke evidence");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("StableReleasePackageReport recommendedCommands includes expected commands [stable-release-package]", () => {
  const workspace = createTempWorkspace("aa-stable-package-commands-");
  const evidenceRoot = join(workspace, "evidence");
  const outputDir = join(workspace, "output");

  try {
    const report = createStableReleasePackage({
      evidenceRootDir: evidenceRoot,
      outputDir,
      targetStatus: "canary",
    });

    assert.ok(report.recommendedCommands.length > 0);
    const hasGateCommand = report.recommendedCommands.some((cmd) => cmd.includes("gate:stable"));
    assert.ok(hasGateCommand, "Expected command to include gate:stable");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("StableReleasePackageReport runbookRefs contains expected documentation [stable-release-package]", () => {
  const workspace = createTempWorkspace("aa-stable-package-runbooks-");
  const evidenceRoot = join(workspace, "evidence");
  const outputDir = join(workspace, "output");

  try {
    const report = createStableReleasePackage({
      evidenceRootDir: evidenceRoot,
      outputDir,
    });

    assert.ok(report.runbookRefs.length > 0);
    const hasReleaseChecklist = report.runbookRefs.some((ref) => ref.includes("01-release-checklist"));
    assert.ok(hasReleaseChecklist, "Expected runbook reference to include the release checklist");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("StableReleasePackageReport releaseChecklist has correct structure [stable-release-package]", () => {
  const workspace = createTempWorkspace("aa-stable-package-checklist-");
  const evidenceRoot = join(workspace, "evidence");
  const outputDir = join(workspace, "output");

  try {
    const report = createStableReleasePackage({
      evidenceRootDir: evidenceRoot,
      outputDir,
    });

    const checklist = report.releaseChecklist;
    assert.ok(Array.isArray(checklist.items));
    assert.equal(typeof checklist.overallStatus, "string");
    assert.equal(typeof checklist.passedCount, "number");
    assert.equal(typeof checklist.partialCount, "number");
    assert.equal(typeof checklist.failedCount, "number");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("StableReleasePackageReport releaseChecklist items have expected IDs [stable-release-package]", () => {
  const workspace = createTempWorkspace("aa-stable-package-checklist-ids-");
  const evidenceRoot = join(workspace, "evidence");
  const outputDir = join(workspace, "output");

  try {
    const report = createStableReleasePackage({
      evidenceRootDir: evidenceRoot,
      outputDir,
    });

    const itemIds = report.releaseChecklist.items.map((item) => item.itemId);
    assert.ok(itemIds.includes("release_gate_verdict"));
    assert.ok(itemIds.includes("smoke_evidence_available"));
    assert.ok(itemIds.includes("runbooks_ready"));
    assert.ok(itemIds.includes("ownership_ready"));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("StableReleasePackageReport artifacts are written to output dir [stable-release-package]", () => {
  const workspace = createTempWorkspace("aa-stable-package-artifacts-");
  const evidenceRoot = join(workspace, "evidence");
  const outputDir = join(workspace, "output");

  try {
    seedEmptyEvidenceProfile(evidenceRoot, "smoke");

    const report = createStableReleasePackage({
      evidenceRootDir: evidenceRoot,
      outputDir,
    });

    assert.ok(report.artifacts.packageReportPath.includes(outputDir));
    assert.ok(report.artifacts.gateReportPath.includes(outputDir));
    assert.ok(report.artifacts.releaseChecklistPath.includes(outputDir));
    assert.ok(report.artifacts.summaryMarkdownPath.includes(outputDir));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("StableReleasePackageReport gates field contains gate report [stable-release-package]", () => {
  const workspace = createTempWorkspace("aa-stable-package-gate-");
  const evidenceRoot = join(workspace, "evidence");
  const outputDir = join(workspace, "output");

  try {
    seedEmptyEvidenceProfile(evidenceRoot, "smoke");

    const report = createStableReleasePackage({
      evidenceRootDir: evidenceRoot,
      outputDir,
    });

    assert.ok(report.gate);
    assert.equal(report.gate.componentId, "stable_core");
    assert.ok(Array.isArray(report.gate.criteria));
    assert.ok(Array.isArray(report.gate.requiredCriteria));
    assert.ok(Array.isArray(report.gate.optionalCriteria));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("StableReleasePackageReport tenant_gray target includes tenant_gray criteria [stable-release-package]", () => {
  const workspace = createTempWorkspace("aa-stable-package-tenant-gray-");
  const evidenceRoot = join(workspace, "evidence");
  const outputDir = join(workspace, "output");

  try {
    seedEmptyEvidenceProfile(evidenceRoot, "smoke");

    const report = createStableReleasePackage({
      evidenceRootDir: evidenceRoot,
      outputDir,
      targetStatus: "tenant_gray",
    });

    const tenantGrayCriterion = report.gate.criteria.find(
      (c) => c.criterionId === "tenant_gray_rollout_tested",
    );
    assert.ok(tenantGrayCriterion);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("StableReleasePackageReport production_ready target requires additional criteria [stable-release-package]", () => {
  const workspace = createTempWorkspace("aa-stable-package-prod-");
  const evidenceRoot = join(workspace, "evidence");
  const outputDir = join(workspace, "output");

  try {
    seedEmptyEvidenceProfile(evidenceRoot, "smoke");
    seedEmptyEvidenceProfile(evidenceRoot, "24h");
    seedEmptyEvidenceProfile(evidenceRoot, "72h");

    const report = createStableReleasePackage({
      evidenceRootDir: evidenceRoot,
      outputDir,
      targetStatus: "production_ready",
    });

    const dbQueueCriterion = report.gate.criteria.find(
      (c) => c.criterionId === "db_queue_disconnect_tested",
    );
    assert.ok(dbQueueCriterion, "Expected db_queue_disconnect_tested criterion for production_ready");

    const acceptanceLineCriterion = report.gate.criteria.find(
      (c) => c.criterionId === "stable_acceptance_line",
    );
    assert.ok(acceptanceLineCriterion, "Expected stable_acceptance_line criterion for production_ready");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("StableReleaseChecklistItem structure is correct [stable-release-package]", () => {
  const item: StableReleaseChecklistItem = {
    itemId: "smoke_evidence_available",
    status: "pass",
    detail: "smoke evidence bundle is present and passing",
    evidenceRefs: ["/path/to/report.json"],
  };

  assert.equal(item.itemId, "smoke_evidence_available");
  assert.equal(item.status, "pass");
  assert.equal(item.detail, "smoke evidence bundle is present and passing");
  assert.deepEqual(item.evidenceRefs, ["/path/to/report.json"]);
});

test("StableReleaseChecklist overallStatus reflects item statuses [stable-release-package]", () => {
  const checklist: StableReleaseChecklist = {
    overallStatus: "fail",
    passedCount: 5,
    partialCount: 3,
    failedCount: 8,
    items: [
      {
        itemId: "release_gate_verdict",
        status: "fail",
        detail: "gate verdict failed",
        evidenceRefs: [],
      },
    ],
  };

  assert.equal(checklist.overallStatus, "fail");
  assert.ok(checklist.passedCount >= 0);
  assert.ok(checklist.partialCount >= 0);
  assert.ok(checklist.failedCount >= 0);
});
