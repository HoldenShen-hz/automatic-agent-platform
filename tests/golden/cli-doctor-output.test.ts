/**
 * Golden Test: CLI Doctor Command Output
 *
 * Verifies doctor CLI tool produces consistent JSON output with
 * expected structure for system diagnostics.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { newId } from "../../src/platform/contracts/types/ids.js";
import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { seedTaskAndExecution } from "../helpers/seed.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { assertGolden } from "../helpers/golden.js";
import { HealthService } from "../../src/platform/shared/observability/health-service.js";
import { DoctorService } from "../../src/platform/control-plane/incident-control/doctor-service.js";
import { StartupConsistencyChecker } from "../../src/platform/execution/startup/startup-consistency-checker.js";
import { createDefaultStartupConsistencyCheckerOptions } from "../../src/platform/execution/startup/startup-preflight.js";
import { RuntimeRecoveryService } from "../../src/platform/execution/recovery/runtime-recovery-service-root.js";
import { StalledExecutionDetector } from "../../src/platform/execution/recovery/stalled-execution-detector.js";
import { StalledExecutionEscalationService } from "../../src/platform/execution/recovery/stalled-execution-escalation-service.js";
import { WorkerRegistryService } from "../../src/platform/execution/worker-pool/worker-registry-service.js";
import { SqliteReliabilityService } from "../../src/platform/state-evidence/truth/sqlite/sqlite-reliability-service.js";
import { ExecutionResourceMonitor } from "../../src/platform/execution/dispatcher/execution-resource-monitor.js";
import { ObservabilityRetentionService } from "../../src/platform/shared/observability/observability-retention-service.js";
import { StructuredLogger } from "../../src/platform/shared/observability/structured-logger.js";
import { ProtectedGovernanceIntegrityService } from "../../src/platform/control-plane/config-center/protected-governance-integrity-service.js";

function createTestDoctorService(db: SqliteDatabase, store: AuthoritativeTaskStore): DoctorService {
  const logger = new StructuredLogger();
  // ObservabilityRetentionService takes db and optional options
  const retentionService = new ObservabilityRetentionService(db);
  const healthService = new HealthService(db, store);
  const startupChecker = new StartupConsistencyChecker(
    db,
    store,
    createDefaultStartupConsistencyCheckerOptions({
      providerSecretResolver: null,
    }),
  );
  const stalledDetector = new StalledExecutionDetector(store);
  const stalledEscalation = new StalledExecutionEscalationService(store);
  const runtimeRecovery = new RuntimeRecoveryService(store);
  const workerRegistry = new WorkerRegistryService(store);
  const sqliteReliability = new SqliteReliabilityService(db);
  const resourceMonitor = new ExecutionResourceMonitor(store);
  const protectedGovernance = new ProtectedGovernanceIntegrityService({
    configRoot: "",
    divisionsRoot: "",
    agentsPath: "",
  });

  // DoctorService constructor signature:
  // healthService, startupChecker, runtimeRecovery, stalledDetector, sqliteReliability,
  // backupPath, protectedGovernance, storageQuota, workerRegistry, observabilityRetention,
  // stalledEscalationService, resourceMonitor, options
  return new DoctorService(
    healthService,
    startupChecker,
    runtimeRecovery,
    stalledDetector,
    sqliteReliability,
    null, // backupPath
    protectedGovernance,
    null, // storageQuota
    workerRegistry,
    retentionService,
    stalledEscalation,
    resourceMonitor,
    { store },
  );
}

test("golden: doctor service can be constructed and produces expected report structure", () => {
  const workspace = createTempWorkspace("aa-golden-doctor-");

  const dbPath = `${workspace}/doctor-test.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  // Create a task with execution
  const taskId = newId("task");
  const executionId = newId("exec");
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "doctor-trace" });

  const doctorService = createTestDoctorService(db, store);
  const output = doctorService.run();

  // Verify top-level structure
  assert.ok(output, "Doctor should return output");
  assert.ok(typeof output.status === "string", "Should have status field");
  assert.ok(["ok", "degraded", "fail_closed"].includes(output.status), "Status should be ok/degraded/fail_closed");
  assert.ok(output.selfCheckSummary, "Should have selfCheckSummary");
  assert.ok(Array.isArray(output.checks), "Should have checks array");
  assert.ok(output.versionSnapshot, "Should have versionSnapshot");

  assertGolden("cli-doctor-top-level", {
    status: output.status,
    selfCheckSummary: {
      totalChecks: output.selfCheckSummary.totalChecks,
      okChecks: output.selfCheckSummary.okChecks,
      degradedChecks: output.selfCheckSummary.degradedChecks,
      failClosedChecks: output.selfCheckSummary.failClosedChecks,
    },
    checkCount: output.checks.length,
    hasVersionSnapshot: output.versionSnapshot !== null,
    hasLockSummary: output.lockSummary !== null,
    hasEventBacklogSummary: output.eventBacklogSummary !== null,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: doctor checks have expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-doctor-checks-");

  const dbPath = `${workspace}/doctor-checks.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const taskId = newId("task");
  const executionId = newId("exec");
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "doctor-checks-trace" });

  const doctorService = createTestDoctorService(db, store);
  const output = doctorService.run();

  // Verify check structure
  assert.ok(output.checks.length > 0, "Should have at least one check");

  for (const check of output.checks) {
    assert.ok(check.checkId, "Check should have checkId");
    assert.ok(check.label, "Check should have label");
    assert.ok(["ok", "degraded", "fail_closed"].includes(check.status), `Check ${check.checkId} should have valid status`);
    assert.ok(typeof check.summary === "string", `Check ${check.checkId} should have summary`);
    assert.ok(Array.isArray(check.findings), `Check ${check.checkId} should have findings array`);
    assert.ok(typeof check.metrics === "object", `Check ${check.checkId} should have metrics object`);
  }

  assertGolden("cli-doctor-checks", {
    checks: output.checks.map((c) => ({
      checkId: c.checkId,
      status: c.status,
      label: c.label,
      findingCount: c.findings.length,
      metricKeys: Object.keys(c.metrics).sort(),
    })),
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: doctor worker summary has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-doctor-workers-");

  const dbPath = `${workspace}/doctor-workers.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const doctorService = createTestDoctorService(db, store);
  const output = doctorService.run();

  // Verify worker summary structure
  assert.ok(output.workerSummary, "Should have workerSummary");
  assert.ok(typeof output.workerSummary.totalWorkers === "number");
  assert.ok(typeof output.workerSummary.healthyWorkers === "number");
  assert.ok(typeof output.workerSummary.busyWorkers === "number");
  assert.ok(Array.isArray(output.workerSummary.workers), "workers should be array");

  assertGolden("cli-doctor-worker-summary", {
    totalWorkers: output.workerSummary.totalWorkers,
    healthyWorkers: output.workerSummary.healthyWorkers,
    busyWorkers: output.workerSummary.busyWorkers,
    remoteWorkers: output.workerSummary.remoteWorkers,
    loadSkewDetected: output.workerSummary.loadSkewDetected,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: doctor runtime recovery has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-doctor-recovery-");

  const dbPath = `${workspace}/doctor-recovery.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const taskId = newId("task");
  const executionId = newId("exec");
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "doctor-recovery-trace" });

  const doctorService = createTestDoctorService(db, store);
  const output = doctorService.run();

  // Verify runtime recovery structure
  assert.ok(output.runtimeRecovery, "Should have runtimeRecovery");
  assert.ok(Array.isArray(output.runtimeRecovery.recoverableRuns));
  assert.ok(Array.isArray(output.runtimeRecovery.blockedRunsAwaitingApproval));
  assert.ok(typeof output.runtimeRecovery.divisionOverview === "object");

  assertGolden("cli-doctor-runtime-recovery", {
    recoverableRunCount: output.runtimeRecovery.recoverableRuns.length,
    blockedRunCount: output.runtimeRecovery.blockedRunsAwaitingApproval.length,
    hasDivisionOverview: output.runtimeRecovery.divisionOverview !== null,
  });

  db.close();
  cleanupPath(workspace);
});