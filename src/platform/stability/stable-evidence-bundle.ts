/**
 * Stable Evidence Bundle
 */

export * from "./stable-evidence-bundle-support.js";

import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

import { DiagnosticsService } from "../shared/observability/diagnostics-service.js";
import { HealthService } from "../shared/observability/health-service.js";
import { InspectService } from "../shared/observability/inspect-service.js";
import { ObservabilityRetentionService } from "../shared/observability/observability-retention-service.js";
import { StructuredLogger } from "../shared/observability/structured-logger.js";
import { DoctorService, type DoctorReport } from "../five-plane-control-plane/incident-control/doctor-service.js";
import { HumanTakeoverService } from "../five-plane-control-plane/incident-control/human-takeover-service.js";
import { EventOpsService } from "../five-plane-state-evidence/events/event-ops-service.js";
import { runSingleTaskExecution } from "../five-plane-execution/execution-engine/single-task-execution.js";
import { RuntimeRepairService, type RepairExecutionResult } from "../five-plane-execution/recovery/runtime-repair-service-root.js";
import { RuntimeRecoveryService } from "../five-plane-execution/recovery/runtime-recovery-service-root.js";
import { StalledExecutionDetector } from "../five-plane-execution/recovery/stalled-execution-detector.js";
import { StalledExecutionEscalationService } from "../five-plane-execution/recovery/stalled-execution-escalation-service.js";
import { WorkerRegistryService } from "../five-plane-execution/worker-pool/worker-registry-service.js";
import { StartupConsistencyChecker, type StartupConsistencyReport } from "../five-plane-execution/startup/startup-consistency-checker.js";
import { AuthoritativeTaskStore } from "../five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../five-plane-state-evidence/truth/sqlite-database.js";
import { SqliteReliabilityService } from "../five-plane-state-evidence/truth/sqlite/sqlite-reliability-service.js";
import { nowIso } from "../contracts/types/ids.js";
import {
  STABLE_EVIDENCE_PROFILES,
  buildTakeoverEvidenceSample,
  resolveStableEvidenceProfile,
  seedTakeoverEvidenceScenario,
  writeJson,
  writeSignedJson,
  createStableEvidenceSigner,
  type StableEvidenceBundleOptions,
  type StableEvidenceBundleReport,
  type StableEvidenceRepairReport,
} from "./stable-evidence-bundle-support.js";
import {
  runStableBackupRestoreRehearsal,
  writeStableBackupRestoreRehearsalReport,
  type StableBackupRestoreRehearsalReport,
} from "./stable-backup-restore-rehearsal.js";
import {
  runStableEventReplayRehearsal,
  writeStableEventReplayRehearsalReport,
  type StableEventReplayRehearsalReport,
} from "./stable-event-replay-rehearsal.js";
import {
  runStableDbWritabilityRehearsal,
  writeStableDbWritabilityRehearsalReport,
  type StableDbWritabilityRehearsalReport,
} from "./stable-db-writability-rehearsal.js";
import {
  runStableDbQueueDisconnectRehearsal,
  writeStableDbQueueDisconnectRehearsalReport,
  type StableDbQueueDisconnectRehearsalReport,
} from "./stable-db-queue-disconnect-rehearsal.js";
import {
  runStableQueueDeliveryRehearsal,
  writeStableQueueDeliveryRehearsalReport,
  type StableQueueDeliveryRehearsalReport,
} from "./stable-queue-delivery-rehearsal.js";
import {
  runStableDispatchRehearsal,
  writeStableDispatchRehearsalReport,
  type StableDispatchRehearsalReport,
} from "./stable-dispatch-rehearsal.js";
import {
  runStableWorkerHandshakeRehearsal,
  writeStableWorkerHandshakeRehearsalReport,
  type StableWorkerHandshakeRehearsalReport,
} from "./stable-worker-handshake-rehearsal.js";
import {
  runStableWorkerWritebackRehearsal,
  writeStableWorkerWritebackRehearsalReport,
  type StableWorkerWritebackRehearsalReport,
} from "./stable-worker-writeback-rehearsal.js";
import {
  runStableMigrationCompatibilityRehearsal,
  writeStableMigrationCompatibilityRehearsalReport,
  type StableMigrationCompatibilityRehearsalReport,
} from "./stable-migration-compatibility-rehearsal.js";
import {
  runStableRollingUpgradeRehearsal,
  writeStableRollingUpgradeRehearsalReport,
  type StableRollingUpgradeRehearsalReport,
} from "./stable-rolling-upgrade-rehearsal.js";
import {
  runStableMaintenanceRehearsal,
  writeStableMaintenanceRehearsalReport,
  type StableMaintenanceRehearsalReport,
} from "./stable-maintenance-rehearsal.js";
import {
  runStableGrayReleaseRehearsal,
  writeStableGrayReleaseRehearsalReport,
  type StableGrayReleaseRehearsalReport,
} from "./stable-gray-release-rehearsal.js";
import {
  runStableChaosSmoke,
  writeStableChaosSmokeReport,
  type StableChaosSmokeReport,
} from "./stable-chaos-smoke.js";
import {
  runStablePromptInjectionRedTeam,
  writeStablePromptInjectionRedTeamReport,
  type StablePromptInjectionRedTeamReport,
} from "./stable-prompt-injection-red-team.js";
import {
  runStableConcurrencyRehearsal,
  writeStableConcurrencyRehearsalReport,
  type StableConcurrencyRehearsalReport,
} from "./stable-concurrency-rehearsal.js";
import {
  runStableLeaseRehearsal,
  writeStableLeaseRehearsalReport,
  type StableLeaseRehearsalReport,
} from "./stable-lease-rehearsal.js";
import {
  runStableRollbackRehearsal,
  writeStableRollbackRehearsalReport,
  type StableRollbackRehearsalReport,
} from "./stable-rollback-rehearsal.js";
import { runStableSoak, writeStableSoakReport, type StableSoakReport } from "./stable-runtime-soak-runner.js";
import { runStableValidation, type StableValidationReport } from "./stable-runtime-validator.js";
import { buildStableAcceptanceLineReport, type StableAcceptanceLineReport } from "./stable-acceptance-line.js";

export async function createStableEvidenceBundle(
  options: StableEvidenceBundleOptions,
): Promise<StableEvidenceBundleReport> {
  mkdirSync(options.outputDir, { recursive: true });

  const profile = resolveStableEvidenceProfile(options.profileName, options.profileOverrides);
  const startedAt = new Date().toISOString();

  // R12-16: Create evidence signer for tamper-evident bundles
  const signer = createStableEvidenceSigner();

  // Define all artifact paths
  const artifacts = {
    bundleReportPath: join(options.outputDir, "stable-evidence-report.json"),
    chaosReportPath: join(options.outputDir, "chaos-report.json"),
    promptInjectionReportPath: join(options.outputDir, "prompt-injection-report.json"),
    concurrencyReportPath: join(options.outputDir, "concurrency-report.json"),
    leaseReportPath: join(options.outputDir, "lease-report.json"),
    validationReportPath: join(options.outputDir, "validation-report.json"),
    soakReportPath: join(options.outputDir, "soak-report.json"),
    doctorReportPath: join(options.outputDir, "doctor-report.json"),
    acceptanceReportPath: join(options.outputDir, "stable-acceptance-line-report.json"),
    repairReportPath: join(options.outputDir, "repair-report.json"),
    drainEventsReportPath: join(options.outputDir, "drain-events-report.json"),
    diagnosticSnapshotPath: join(options.outputDir, "diagnostic-snapshot.json"),
    debugDumpPath: join(options.outputDir, "debug-dump.json"),
    takeoverSamplePath: join(options.outputDir, "takeover-sample.json"),
    rollbackReportPath: join(options.outputDir, "rollback-report.json"),
    backupRestoreReportPath: join(options.outputDir, "backup-restore-report.json"),
    backupRestorePlaybookPath: join(options.outputDir, "backup-restore", "stable-disaster-recovery-playbook.json"),
    rollingUpgradeReportPath: join(options.outputDir, "rolling-upgrade-report.json"),
    rollingUpgradePlaybookPath: join(options.outputDir, "upgrade", "stable-rolling-upgrade-playbook.json"),
    maintenanceReportPath: join(options.outputDir, "maintenance-report.json"),
    maintenancePlaybookPath: join(options.outputDir, "maintenance", "stable-maintenance-playbook.json"),
    grayReleaseReportPath: join(options.outputDir, "gray-release-report.json"),
    grayReleasePlaybookPath: join(options.outputDir, "gray", "stable-gray-release-playbook.json"),
    eventReplayReportPath: join(options.outputDir, "event-replay-report.json"),
    dbQueueDisconnectReportPath: join(options.outputDir, "db-queue-disconnect-report.json"),
    dbWritabilityReportPath: join(options.outputDir, "db-writability-report.json"),
    queueDeliveryReportPath: join(options.outputDir, "queue-delivery-report.json"),
    migrationCompatibilityReportPath: join(options.outputDir, "migration-compatibility-report.json"),
    dispatchReportPath: join(options.outputDir, "dispatch-report.json"),
    workerHandshakeReportPath: join(options.outputDir, "worker-handshake-report.json"),
    workerWritebackReportPath: join(options.outputDir, "worker-writeback-report.json"),
    runtimeDbPath: join(options.outputDir, "runtime", "stable-evidence.db"),
  };

  // Run all chaos and stability rehearsals
  const chaosReport: StableChaosSmokeReport = await runStableChaosSmoke({
    outputDir: join(options.outputDir, "chaos"),
  });
  writeStableChaosSmokeReport(artifacts.chaosReportPath, chaosReport);

  const promptInjectionReport: StablePromptInjectionRedTeamReport = await runStablePromptInjectionRedTeam({
    outputDir: join(options.outputDir, "prompt-injection"),
  });
  writeStablePromptInjectionRedTeamReport(artifacts.promptInjectionReportPath, promptInjectionReport);

  const concurrencyReport: StableConcurrencyRehearsalReport = await runStableConcurrencyRehearsal({
    outputDir: join(options.outputDir, "concurrency"),
  });
  writeStableConcurrencyRehearsalReport(artifacts.concurrencyReportPath, concurrencyReport);

  const leaseReport: StableLeaseRehearsalReport = await runStableLeaseRehearsal({
    outputDir: join(options.outputDir, "lease"),
  });
  writeStableLeaseRehearsalReport(artifacts.leaseReportPath, leaseReport);

  const rollbackReport: StableRollbackRehearsalReport = await runStableRollbackRehearsal({
    outputDir: join(options.outputDir, "rollback"),
  });
  writeStableRollbackRehearsalReport(artifacts.rollbackReportPath, rollbackReport);

  const backupRestoreReport: StableBackupRestoreRehearsalReport = await runStableBackupRestoreRehearsal({
    outputDir: join(options.outputDir, "backup-restore"),
  });
  writeStableBackupRestoreRehearsalReport(artifacts.backupRestoreReportPath, backupRestoreReport);

  const rollingUpgradeReport: StableRollingUpgradeRehearsalReport = await runStableRollingUpgradeRehearsal({
    outputDir: join(options.outputDir, "upgrade"),
  });
  writeStableRollingUpgradeRehearsalReport(artifacts.rollingUpgradeReportPath, rollingUpgradeReport);

  const maintenanceReport: StableMaintenanceRehearsalReport = await runStableMaintenanceRehearsal({
    outputDir: join(options.outputDir, "maintenance"),
  });
  writeStableMaintenanceRehearsalReport(artifacts.maintenanceReportPath, maintenanceReport);

  const grayReleaseReport: StableGrayReleaseRehearsalReport = await runStableGrayReleaseRehearsal({
    outputDir: join(options.outputDir, "gray"),
  });
  writeStableGrayReleaseRehearsalReport(artifacts.grayReleaseReportPath, grayReleaseReport);

  const eventReplayReport: StableEventReplayRehearsalReport = await runStableEventReplayRehearsal({
    outputDir: join(options.outputDir, "event-replay"),
  });
  writeStableEventReplayRehearsalReport(artifacts.eventReplayReportPath, eventReplayReport);

  const dbQueueDisconnectReport: StableDbQueueDisconnectRehearsalReport = await runStableDbQueueDisconnectRehearsal({
    outputDir: join(options.outputDir, "db-queue-disconnect"),
  });
  writeStableDbQueueDisconnectRehearsalReport(artifacts.dbQueueDisconnectReportPath, dbQueueDisconnectReport);

  const dbWritabilityReport: StableDbWritabilityRehearsalReport = await runStableDbWritabilityRehearsal({
    outputDir: join(options.outputDir, "db-writability"),
  });
  writeStableDbWritabilityRehearsalReport(artifacts.dbWritabilityReportPath, dbWritabilityReport);

  const queueDeliveryReport: StableQueueDeliveryRehearsalReport = await runStableQueueDeliveryRehearsal({
    outputDir: join(options.outputDir, "queue-delivery"),
  });
  writeStableQueueDeliveryRehearsalReport(artifacts.queueDeliveryReportPath, queueDeliveryReport);

  const dispatchReport: StableDispatchRehearsalReport = await runStableDispatchRehearsal({
    outputDir: join(options.outputDir, "dispatch"),
  });
  writeStableDispatchRehearsalReport(artifacts.dispatchReportPath, dispatchReport);

  const workerHandshakeReport: StableWorkerHandshakeRehearsalReport = await runStableWorkerHandshakeRehearsal({
    outputDir: join(options.outputDir, "worker-handshake"),
  });
  writeStableWorkerHandshakeRehearsalReport(artifacts.workerHandshakeReportPath, workerHandshakeReport);

  const workerWritebackReport: StableWorkerWritebackRehearsalReport = await runStableWorkerWritebackRehearsal({
    outputDir: join(options.outputDir, "worker-writeback"),
  });
  writeStableWorkerWritebackRehearsalReport(artifacts.workerWritebackReportPath, workerWritebackReport);

  const migrationCompatibilityReport: StableMigrationCompatibilityRehearsalReport =
    await runStableMigrationCompatibilityRehearsal({
      outputDir: join(options.outputDir, "migration-compatibility"),
    });
  writeStableMigrationCompatibilityRehearsalReport(
    artifacts.migrationCompatibilityReportPath,
    migrationCompatibilityReport,
  );

  // Run or use provided validation and soak reports
  const validationReport: StableValidationReport =
    options.validationReport ??
    await runStableValidation({
      outputDir: join(options.outputDir, "validation"),
      iterations: profile.validationIterations,
    });
  writeJson(artifacts.validationReportPath, validationReport);

  const soakReport: StableSoakReport =
    options.soakReport ??
    (await runStableSoak({
      outputDir: join(options.outputDir, "soak"),
      durationMs: profile.soakDurationMs,
      intervalMs: profile.soakIntervalMs,
      iterationsPerCycle: profile.soakIterationsPerCycle,
    }));
  writeStableSoakReport(artifacts.soakReportPath, soakReport);

  // Clean up runtime database before creating baseline
  rmSync(artifacts.runtimeDbPath, { force: true });
  rmSync(`${artifacts.runtimeDbPath}.backup`, { force: true });

  // Create baseline runtime using happy path
  const happyPathSnapshot = await runSingleTaskExecution({
    dbPath: artifacts.runtimeDbPath,
    title: "Stable evidence runtime baseline",
    request: "Produce a runtime evidence snapshot.",
  });

  // Set up services for doctor, repair, and diagnostics
  const db = new SqliteDatabase(artifacts.runtimeDbPath);
  const store = new AuthoritativeTaskStore(db);
  const logger = new StructuredLogger();
  const observabilityRetention = new ObservabilityRetentionService(db);
  const inspectService = new InspectService(store);
  const healthService = new HealthService(db, store);
  const checker = new StartupConsistencyChecker(db, store);
  const repairService = new RuntimeRepairService(db, store);
  const eventOps = new EventOpsService(db, store);

  logger.log({
    level: "info",
    message: "stable evidence baseline created",
    taskId: happyPathSnapshot.task.id,
    ...(happyPathSnapshot.execution?.traceId ? { traceId: happyPathSnapshot.execution.traceId } : {}),
  });

  // Run doctor health check
  const diagnostics = new DiagnosticsService(inspectService, healthService, logger, observabilityRetention);
  const doctor = new DoctorService(
    healthService,
    checker,
    new RuntimeRecoveryService(store),
    null,
    new SqliteReliabilityService(db),
    `${artifacts.runtimeDbPath}.backup`,
    null,
    null,
    new WorkerRegistryService(store),
    observabilityRetention,
    new StalledExecutionEscalationService(new StalledExecutionDetector(store), diagnostics),
    null,
    { store },
  );

  let doctorReport: DoctorReport;
  let repairReport: StableEvidenceRepairReport;
  let diagnosticSnapshot: ReturnType<DiagnosticsService["buildTaskSnapshot"]>;
  let debugDump: ReturnType<DiagnosticsService["buildDebugDump"]>;
  let takeoverSample: ReturnType<typeof buildTakeoverEvidenceSample>;
  let drainReport: Awaited<ReturnType<EventOpsService["drainDefaultConsumers"]>>;
  let pendingAckBacklogAfterDrain: number;
  let acceptanceLine: StableAcceptanceLineReport;

  try {
    // Run doctor, repair, and diagnostics
    doctorReport = doctor.run();
    const repairBefore = checker.run();
    const repairApplied = await repairService.apply(repairBefore);
    const repairAfter = checker.run();
    repairReport = {
      before: repairBefore,
      applied: repairApplied,
      after: repairAfter,
    };
    diagnosticSnapshot = diagnostics.buildTaskSnapshot(happyPathSnapshot.task.id);
    debugDump = diagnostics.buildDebugDump(happyPathSnapshot.task.id);
    takeoverSample = buildTakeoverEvidenceSample(db, store, logger);
    drainReport = await eventOps.drainDefaultConsumers();
    pendingAckBacklogAfterDrain = store.event.countPendingTier1Acks();

    // Write all reports
    writeJson(artifacts.doctorReportPath, doctorReport);
    writeJson(artifacts.repairReportPath, repairReport);
    writeJson(artifacts.diagnosticSnapshotPath, diagnosticSnapshot);
    writeJson(artifacts.debugDumpPath, debugDump);
    writeJson(artifacts.takeoverSamplePath, takeoverSample);
    writeJson(artifacts.drainEventsReportPath, drainReport);

    // Build and write acceptance line report
    acceptanceLine = buildStableAcceptanceLineReport({
      profileName: profile.name,
      validationReport,
      soakReport,
      doctorReport,
      repairReport,
    });
    writeJson(artifacts.acceptanceReportPath, acceptanceLine);
  } finally {
    await repairService.dispose();
    await eventOps.dispose();
    db.close();
  }

  // Compute validation and soak pass/fail status
  const validationPassed =
    validationReport.failedRuns === 0 &&
    validationReport.integrityFailures === 0 &&
    validationReport.backupFailures === 0;
  const soakPassed = soakReport.failedRuns === 0 && soakReport.integrityFailures === 0 && soakReport.backupFailures === 0;
  const doctorSafe = doctorReport.status === "ok" || doctorReport.status === "fail_closed";
  const repairAfterSafe = repairReport.after.status === "pass" || repairReport.after.status === "fail_closed";

  // Build summary with all test results
  const summary = {
    passed:
      chaosReport.failedScenarios === 0 &&
      promptInjectionReport.failedScenarios === 0 &&
      concurrencyReport.failedScenarios === 0 &&
      leaseReport.failedScenarios === 0 &&
      rollbackReport.failedScenarios === 0 &&
      backupRestoreReport.failedScenarios === 0 &&
      rollingUpgradeReport.failedScenarios === 0 &&
      maintenanceReport.failedScenarios === 0 &&
      grayReleaseReport.failedScenarios === 0 &&
      eventReplayReport.failedScenarios === 0 &&
      dbQueueDisconnectReport.failedScenarios === 0 &&
      dbWritabilityReport.failedScenarios === 0 &&
      queueDeliveryReport.failedScenarios === 0 &&
      dispatchReport.failedScenarios === 0 &&
      workerHandshakeReport.failedScenarios === 0 &&
      workerWritebackReport.failedScenarios === 0 &&
      migrationCompatibilityReport.failedScenarios === 0 &&
      validationPassed &&
      soakPassed &&
      doctorSafe &&
      repairAfterSafe &&
      pendingAckBacklogAfterDrain === 0 &&
      takeoverSample.finalTaskStatus === "done" &&
      takeoverSample.operatorActionCount >= 4,
    chaosPassed: chaosReport.failedScenarios === 0,
    promptInjectionPassed: promptInjectionReport.failedScenarios === 0,
    concurrencyPassed: concurrencyReport.failedScenarios === 0,
    leasePassed: leaseReport.failedScenarios === 0,
    rollbackPassed: rollbackReport.failedScenarios === 0,
    backupRestorePassed: backupRestoreReport.failedScenarios === 0,
    rollingUpgradePassed: rollingUpgradeReport.failedScenarios === 0,
    maintenancePassed: maintenanceReport.failedScenarios === 0,
    grayReleasePassed: grayReleaseReport.failedScenarios === 0,
    eventReplayPassed: eventReplayReport.failedScenarios === 0,
    dbQueueDisconnectPassed: dbQueueDisconnectReport.failedScenarios === 0,
    dbWritabilityPassed: dbWritabilityReport.failedScenarios === 0,
    queueDeliveryPassed: queueDeliveryReport.failedScenarios === 0,
    dispatchPassed: dispatchReport.failedScenarios === 0,
    workerHandshakePassed: workerHandshakeReport.failedScenarios === 0,
    workerWritebackPassed: workerWritebackReport.failedScenarios === 0,
    migrationCompatibilityPassed: migrationCompatibilityReport.failedScenarios === 0,
    validationPassed,
    soakPassed,
    doctorStatus: doctorReport.status,
    startupConsistencyStatus: doctorReport.startupConsistency.status,
    repairAfterStatus: repairReport.after.status,
    totalValidationRuns: validationReport.totalRuns,
    totalSoakRuns: soakReport.totalRuns,
    totalChaosScenarios: chaosReport.totalScenarios,
    totalPromptInjectionScenarios: promptInjectionReport.totalScenarios,
    totalRollingUpgradeScenarios: rollingUpgradeReport.totalScenarios,
    totalMaintenanceScenarios: maintenanceReport.totalScenarios,
    totalGrayReleaseScenarios: grayReleaseReport.totalScenarios,
    totalDbQueueDisconnectScenarios: dbQueueDisconnectReport.totalScenarios,
    totalDbWritabilityScenarios: dbWritabilityReport.totalScenarios,
    totalQueueDeliveryScenarios: queueDeliveryReport.totalScenarios,
    totalDispatchScenarios: dispatchReport.totalScenarios,
    totalWorkerHandshakeScenarios: workerHandshakeReport.totalScenarios,
    totalWorkerWritebackScenarios: workerWritebackReport.totalScenarios,
    totalMigrationCompatibilityScenarios: migrationCompatibilityReport.totalScenarios,
    totalRollbackScenarios: rollbackReport.totalScenarios,
    failedValidationRuns: validationReport.failedRuns,
    failedSoakRuns: soakReport.failedRuns,
    failedChaosScenarios: chaosReport.failedScenarios,
    failedPromptInjectionScenarios: promptInjectionReport.failedScenarios,
    failedRollingUpgradeScenarios: rollingUpgradeReport.failedScenarios,
    failedMaintenanceScenarios: maintenanceReport.failedScenarios,
    failedGrayReleaseScenarios: grayReleaseReport.failedScenarios,
    failedDbQueueDisconnectScenarios: dbQueueDisconnectReport.failedScenarios,
    failedDbWritabilityScenarios: dbWritabilityReport.failedScenarios,
    failedQueueDeliveryScenarios: queueDeliveryReport.failedScenarios,
    failedDispatchScenarios: dispatchReport.failedScenarios,
    failedWorkerHandshakeScenarios: workerHandshakeReport.failedScenarios,
    failedWorkerWritebackScenarios: workerWritebackReport.failedScenarios,
    failedMigrationCompatibilityScenarios: migrationCompatibilityReport.failedScenarios,
    failedRollbackScenarios: rollbackReport.failedScenarios,
    integrityFailures: validationReport.integrityFailures + soakReport.integrityFailures,
    backupFailures: validationReport.backupFailures + soakReport.backupFailures,
    pendingAckBacklogAfterDrain,
    takeoverSampleClosedLoop:
      takeoverSample.finalTaskStatus === "done" &&
      takeoverSample.finalExecutionStatus === "succeeded" &&
      takeoverSample.finalSessionStatus === "completed",
    acceptanceLineStatus: acceptanceLine.status,
  };

  // Build and write final report
  const report: StableEvidenceBundleReport = {
    startedAt,
    finishedAt: new Date().toISOString(),
    outputDir: options.outputDir,
    profile,
    artifacts,
    acceptanceLine,
    summary,
  };
  writeJson(artifacts.bundleReportPath, report);

  return report;
}
