import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { buildStableReleaseGateReport, } from "../../../../src/platform/shared/stability/stable-release-gate.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
function writeEvidenceReport(root, profile, summary) {
    const dir = join(root, profile);
    mkdirSync(dir, { recursive: true });
    const acceptanceStatus = "partial";
    writeFileSync(join(dir, "stable-evidence-report.json"), JSON.stringify({
        profile: { name: profile },
        artifacts: {
            chaosReportPath: join(dir, "chaos-report.json"),
            concurrencyReportPath: join(dir, "concurrency-report.json"),
            leaseReportPath: join(dir, "lease-report.json"),
            doctorReportPath: join(dir, "doctor-report.json"),
            acceptanceReportPath: join(dir, "stable-acceptance-line-report.json"),
            backupRestoreReportPath: join(dir, "backup-restore-report.json"),
            backupRestorePlaybookPath: join(dir, "stable-disaster-recovery-playbook.json"),
            rollingUpgradeReportPath: join(dir, "rolling-upgrade-report.json"),
            rollingUpgradePlaybookPath: join(dir, "stable-rolling-upgrade-playbook.json"),
            maintenanceReportPath: join(dir, "maintenance-report.json"),
            maintenancePlaybookPath: join(dir, "stable-maintenance-playbook.json"),
            grayReleaseReportPath: join(dir, "gray-release-report.json"),
            grayReleasePlaybookPath: join(dir, "stable-gray-release-playbook.json"),
            eventReplayReportPath: join(dir, "event-replay-report.json"),
            dbQueueDisconnectReportPath: join(dir, "db-queue-disconnect-report.json"),
            dbWritabilityReportPath: join(dir, "db-writability-report.json"),
            queueDeliveryReportPath: join(dir, "queue-delivery-report.json"),
            migrationCompatibilityReportPath: join(dir, "migration-compatibility-report.json"),
            repairReportPath: join(dir, "repair-report.json"),
            rollbackReportPath: join(dir, "rollback-report.json"),
            takeoverSamplePath: join(dir, "takeover-sample.json"),
        },
        acceptanceLine: {
            evaluatedAt: "2026-04-07T00:00:00.000Z",
            status: acceptanceStatus,
            profileName: profile,
            truthNotes: ["long-run evidence is below 14 days"],
            criteria: [
                {
                    criterionId: "long_run_evidence",
                    status: acceptanceStatus,
                    detail: "long-run evidence below 14 days",
                    metrics: {
                        soakDurationMs: profile === "72h" ? 72 * 60 * 60 * 1000 : 5_000,
                        requiredDurationMs: 14 * 24 * 60 * 60 * 1000,
                    },
                },
            ],
            observed: {
                soakDurationMs: profile === "72h" ? 72 * 60 * 60 * 1000 : 5_000,
                requiredDurationMs: 14 * 24 * 60 * 60 * 1000,
                longRunCoveragePct: profile === "72h" ? 21.43 : 0,
                manualDbRepairSignalCount: 0,
                orphanQueueClaimCount: 0,
                zombieLockCount: 0,
                recoveryAttemptCount: 0,
                recoverySucceededCount: 0,
                recoverySuccessRatePct: 100,
            },
            latencyBudget: [],
        },
        summary,
    }, null, 2));
}
test("stable release gate approves canary promotion from a passing smoke evidence bundle", () => {
    const workspace = createTempWorkspace("aa-stable-gate-");
    try {
        writeEvidenceReport(join(workspace, "stable-evidence"), "smoke", {
            passed: true,
            chaosPassed: true,
            concurrencyPassed: true,
            leasePassed: true,
            rollbackPassed: true,
            backupRestorePassed: true,
            rollingUpgradePassed: true,
            maintenancePassed: true,
            grayReleasePassed: true,
            eventReplayPassed: true,
            dbQueueDisconnectPassed: true,
            dbWritabilityPassed: true,
            queueDeliveryPassed: true,
            migrationCompatibilityPassed: true,
            doctorStatus: "ok",
            repairAfterStatus: "pass",
            takeoverSampleClosedLoop: true,
        });
        const report = buildStableReleaseGateReport({
            evidenceRootDir: join(workspace, "stable-evidence"),
            targetStatus: "canary",
        });
        assert.equal(report.overallVerdict, "promote_approved");
        assert.equal(report.targetStatus, "canary");
        assert.deepEqual(report.requiredProfiles, ["smoke"]);
        assert.equal(report.requiredCriteria.length > 0, true);
        assert.equal(report.optionalCriteria.some((criterion) => criterion.criterionId === "chaos_drill_results"), true);
        assert.equal(report.requiredCriteria.some((criterion) => criterion.criterionId === "migration_compatibility_tested"), true);
        assert.equal(report.optionalCriteria.some((criterion) => criterion.criterionId === "rolling_upgrade_tested"), true);
        assert.equal(report.optionalCriteria.some((criterion) => criterion.criterionId === "maintenance_drain_tested"), true);
        assert.equal(report.optionalCriteria.some((criterion) => criterion.criterionId === "tenant_gray_rollout_tested"), true);
        assert.equal(report.optionalCriteria.some((criterion) => criterion.criterionId === "db_writability_tested"), true);
        assert.equal(report.optionalCriteria.some((criterion) => criterion.criterionId === "stable_acceptance_line"), true);
        assert.ok(report.requiredCriteria.every((criterion) => criterion.status === "pass"));
    }
    finally {
        cleanupPath(workspace);
    }
});
test("stable release gate marks backup restore evidence partial when the disaster recovery playbook is missing", () => {
    const workspace = createTempWorkspace("aa-stable-gate-");
    const dir = join(workspace, "stable-evidence", "smoke");
    mkdirSync(dir, { recursive: true });
    try {
        writeFileSync(join(dir, "stable-evidence-report.json"), JSON.stringify({
            profile: { name: "smoke" },
            artifacts: {
                chaosReportPath: join(dir, "chaos-report.json"),
                concurrencyReportPath: join(dir, "concurrency-report.json"),
                leaseReportPath: join(dir, "lease-report.json"),
                doctorReportPath: join(dir, "doctor-report.json"),
                acceptanceReportPath: join(dir, "stable-acceptance-line-report.json"),
                backupRestoreReportPath: join(dir, "backup-restore-report.json"),
                rollingUpgradeReportPath: join(dir, "rolling-upgrade-report.json"),
                rollingUpgradePlaybookPath: join(dir, "stable-rolling-upgrade-playbook.json"),
                maintenanceReportPath: join(dir, "maintenance-report.json"),
                maintenancePlaybookPath: join(dir, "stable-maintenance-playbook.json"),
                grayReleaseReportPath: join(dir, "gray-release-report.json"),
                grayReleasePlaybookPath: join(dir, "stable-gray-release-playbook.json"),
                eventReplayReportPath: join(dir, "event-replay-report.json"),
                dbQueueDisconnectReportPath: join(dir, "db-queue-disconnect-report.json"),
                dbWritabilityReportPath: join(dir, "db-writability-report.json"),
                queueDeliveryReportPath: join(dir, "queue-delivery-report.json"),
                migrationCompatibilityReportPath: join(dir, "migration-compatibility-report.json"),
                repairReportPath: join(dir, "repair-report.json"),
                rollbackReportPath: join(dir, "rollback-report.json"),
                takeoverSamplePath: join(dir, "takeover-sample.json"),
            },
            acceptanceLine: {
                evaluatedAt: "2026-04-07T00:00:00.000Z",
                status: "partial",
                profileName: "smoke",
                truthNotes: ["long-run evidence is below 14 days"],
                criteria: [
                    {
                        criterionId: "long_run_evidence",
                        status: "partial",
                        detail: "long-run evidence below 14 days",
                        metrics: {},
                    },
                ],
                observed: {
                    soakDurationMs: 5_000,
                    requiredDurationMs: 14 * 24 * 60 * 60 * 1000,
                    longRunCoveragePct: 0,
                    manualDbRepairSignalCount: 0,
                    orphanQueueClaimCount: 0,
                    zombieLockCount: 0,
                    recoveryAttemptCount: 0,
                    recoverySucceededCount: 0,
                    recoverySuccessRatePct: 100,
                },
                latencyBudget: [],
            },
            summary: {
                passed: true,
                chaosPassed: true,
                concurrencyPassed: true,
                leasePassed: true,
                rollbackPassed: true,
                backupRestorePassed: true,
                rollingUpgradePassed: true,
                maintenancePassed: true,
                grayReleasePassed: true,
                eventReplayPassed: true,
                dbQueueDisconnectPassed: true,
                dbWritabilityPassed: true,
                queueDeliveryPassed: true,
                migrationCompatibilityPassed: true,
                doctorStatus: "ok",
                repairAfterStatus: "pass",
                takeoverSampleClosedLoop: true,
            },
        }, null, 2));
        const report = buildStableReleaseGateReport({
            evidenceRootDir: join(workspace, "stable-evidence"),
            targetStatus: "canary",
        });
        const backupRestoreCriterion = report.optionalCriteria.find((criterion) => criterion.criterionId === "backup_restore_tested");
        assert.equal(report.overallVerdict, "promote_approved");
        assert.equal(backupRestoreCriterion?.status, "partial");
        assert.match(backupRestoreCriterion?.detail ?? "", /playbooks are missing/);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("stable release gate marks production promotion as conditional when 24h/72h evidence is missing", () => {
    const workspace = createTempWorkspace("aa-stable-gate-");
    try {
        writeEvidenceReport(join(workspace, "stable-evidence"), "smoke", {
            passed: true,
            chaosPassed: true,
            concurrencyPassed: true,
            leasePassed: true,
            rollbackPassed: true,
            backupRestorePassed: true,
            rollingUpgradePassed: true,
            maintenancePassed: true,
            grayReleasePassed: true,
            eventReplayPassed: true,
            dbQueueDisconnectPassed: true,
            dbWritabilityPassed: true,
            queueDeliveryPassed: true,
            migrationCompatibilityPassed: true,
            doctorStatus: "ok",
            repairAfterStatus: "pass",
            takeoverSampleClosedLoop: true,
        });
        const report = buildStableReleaseGateReport({
            evidenceRootDir: join(workspace, "stable-evidence"),
            targetStatus: "production_ready",
        });
        assert.equal(report.overallVerdict, "conditional");
        assert.ok(report.blockers.some((blocker) => blocker.includes("24h")));
        assert.ok(report.blockers.some((blocker) => blocker.includes("72h")));
        assert.equal(report.currentStatus, "tenant_gray");
        assert.equal(report.requiredCriteria.some((criterion) => criterion.criterionId === "conformance_tests"), true);
        assert.equal(report.requiredCriteria.some((criterion) => criterion.criterionId === "db_queue_disconnect_tested"), true);
        assert.equal(report.requiredCriteria.some((criterion) => criterion.criterionId === "db_writability_tested"), true);
        assert.equal(report.requiredCriteria.some((criterion) => criterion.criterionId === "stable_acceptance_line"), true);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("stable release gate blocks promotion when available evidence reports a failure", () => {
    const workspace = createTempWorkspace("aa-stable-gate-");
    try {
        writeEvidenceReport(join(workspace, "stable-evidence"), "smoke", {
            passed: false,
            chaosPassed: false,
            concurrencyPassed: false,
            leasePassed: false,
            rollbackPassed: false,
            backupRestorePassed: false,
            rollingUpgradePassed: false,
            maintenancePassed: false,
            grayReleasePassed: false,
            eventReplayPassed: false,
            dbQueueDisconnectPassed: false,
            dbWritabilityPassed: false,
            queueDeliveryPassed: false,
            doctorStatus: "degraded",
            repairAfterStatus: "repairable",
            takeoverSampleClosedLoop: false,
        });
        const report = buildStableReleaseGateReport({
            evidenceRootDir: join(workspace, "stable-evidence"),
            targetStatus: "canary",
        });
        assert.equal(report.overallVerdict, "promote_blocked");
        assert.equal(report.currentStatus, "contract_frozen");
        assert.ok(report.blockers.some((blocker) => blocker.includes("failing evidence profiles")));
        assert.equal(report.requiredCriteria.some((criterion) => criterion.status === "fail"), true);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("stable release gate keeps production promotion conditional when 24h/72h evidence exists but QA-64 acceptance is still partial", () => {
    const workspace = createTempWorkspace("aa-stable-gate-");
    const evidenceRoot = join(workspace, "stable-evidence");
    try {
        writeEvidenceReport(evidenceRoot, "smoke", {
            passed: true,
            chaosPassed: true,
            concurrencyPassed: true,
            leasePassed: true,
            rollbackPassed: true,
            backupRestorePassed: true,
            rollingUpgradePassed: true,
            maintenancePassed: true,
            grayReleasePassed: true,
            eventReplayPassed: true,
            dbQueueDisconnectPassed: true,
            dbWritabilityPassed: true,
            queueDeliveryPassed: true,
            migrationCompatibilityPassed: true,
            doctorStatus: "ok",
            repairAfterStatus: "pass",
            takeoverSampleClosedLoop: true,
        });
        writeEvidenceReport(evidenceRoot, "24h", {
            passed: true,
            chaosPassed: true,
            concurrencyPassed: true,
            leasePassed: true,
            rollbackPassed: true,
            backupRestorePassed: true,
            rollingUpgradePassed: true,
            maintenancePassed: true,
            grayReleasePassed: true,
            eventReplayPassed: true,
            dbQueueDisconnectPassed: true,
            dbWritabilityPassed: true,
            queueDeliveryPassed: true,
            migrationCompatibilityPassed: true,
            doctorStatus: "ok",
            repairAfterStatus: "pass",
            takeoverSampleClosedLoop: true,
        });
        writeEvidenceReport(evidenceRoot, "72h", {
            passed: true,
            chaosPassed: true,
            concurrencyPassed: true,
            leasePassed: true,
            rollbackPassed: true,
            backupRestorePassed: true,
            rollingUpgradePassed: true,
            maintenancePassed: true,
            grayReleasePassed: true,
            eventReplayPassed: true,
            dbQueueDisconnectPassed: true,
            dbWritabilityPassed: true,
            queueDeliveryPassed: true,
            migrationCompatibilityPassed: true,
            doctorStatus: "ok",
            repairAfterStatus: "pass",
            takeoverSampleClosedLoop: true,
        });
        const report = buildStableReleaseGateReport({
            evidenceRootDir: evidenceRoot,
            targetStatus: "production_ready",
        });
        const acceptanceCriterion = report.requiredCriteria.find((criterion) => criterion.criterionId === "stable_acceptance_line");
        assert.equal(report.overallVerdict, "conditional");
        assert.equal(acceptanceCriterion?.status, "partial");
        assert.match(acceptanceCriterion?.detail ?? "", /long_run_evidence:partial/);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("stable release gate approves tenant-gray promotion only when gray rollout evidence is attached", () => {
    const workspace = createTempWorkspace("aa-stable-gate-");
    try {
        writeEvidenceReport(join(workspace, "stable-evidence"), "smoke", {
            passed: true,
            chaosPassed: true,
            concurrencyPassed: true,
            leasePassed: true,
            rollbackPassed: true,
            backupRestorePassed: true,
            rollingUpgradePassed: true,
            maintenancePassed: true,
            grayReleasePassed: true,
            eventReplayPassed: true,
            dbQueueDisconnectPassed: true,
            dbWritabilityPassed: true,
            queueDeliveryPassed: true,
            migrationCompatibilityPassed: true,
            doctorStatus: "ok",
            repairAfterStatus: "pass",
            takeoverSampleClosedLoop: true,
        });
        const report = buildStableReleaseGateReport({
            evidenceRootDir: join(workspace, "stable-evidence"),
            targetStatus: "tenant_gray",
        });
        const grayCriterion = report.requiredCriteria.find((criterion) => criterion.criterionId === "tenant_gray_rollout_tested");
        assert.equal(report.overallVerdict, "promote_approved");
        assert.equal(report.currentStatus, "tenant_gray");
        assert.equal(grayCriterion?.status, "pass");
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=stable-release-gate.test.js.map