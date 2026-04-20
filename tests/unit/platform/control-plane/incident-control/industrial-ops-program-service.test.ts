import assert from "node:assert/strict";
import { basename, dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { ApprovalService } from "../../../../../src/platform/control-plane/approval-center/approval-service.js";
import { DiagnosticsService } from "../../../../../src/platform/shared/observability/diagnostics-service.js";
import { HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
import { InspectService } from "../../../../../src/platform/shared/observability/inspect-service.js";
import { MetricsService } from "../../../../../src/platform/shared/observability/metrics-service.js";
import { ObservabilityRetentionService } from "../../../../../src/platform/shared/observability/observability-retention-service.js";
import { StructuredLogger } from "../../../../../src/platform/shared/observability/structured-logger.js";
import { ProtectedGovernanceIntegrityService } from "../../../../../src/platform/control-plane/config-center/protected-governance-integrity-service.js";
import { IndustrialOpsProgramService } from "../../../../../src/platform/control-plane/incident-control/industrial-ops-program-service.js";
import { DoctorService } from "../../../../../src/platform/control-plane/incident-control/doctor-service.js";
import { OperationsGovernanceService } from "../../../../../src/platform/control-plane/incident-control/operations-governance-service.js";
import { createWorkspaceWritePolicy } from "../../../../../src/platform/control-plane/iam/sandbox-policy.js";
import { RuntimeRecoveryService } from "../../../../../src/platform/execution/recovery/runtime-recovery-service-root.js";
import { StalledExecutionDetector } from "../../../../../src/platform/execution/recovery/stalled-execution-detector.js";
import { StalledExecutionEscalationService } from "../../../../../src/platform/execution/recovery/stalled-execution-escalation-service.js";
import { createDefaultStartupConsistencyCheckerOptions } from "../../../../../src/platform/execution/startup/startup-preflight.js";
import { StartupConsistencyChecker } from "../../../../../src/platform/execution/startup/startup-consistency-checker.js";
import { WorkerRegistryService } from "../../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import { ExecutionResourceMonitor } from "../../../../../src/platform/execution/dispatcher/execution-resource-monitor.js";
import { StorageQuotaService } from "../../../../../src/platform/state-evidence/truth/storage-quota-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { SqliteReliabilityService } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-reliability-service.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));

function seedHappyPathDb(dbPath: string): void {
  const script = `
    import { runSingleTaskExecution } from ${JSON.stringify(new URL("../../../../../src/platform/execution/execution-engine/single-task-execution.js", import.meta.url).href)};
    await runSingleTaskExecution({
      dbPath: ${JSON.stringify(dbPath)},
      title: "Industrial ops program task",
      request: "Seed industrial ops program evidence.",
    });
  `;
  execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: repoRoot,
    stdio: "pipe",
  });
}

function createWorkspaceScopedStorageQuotaService(workspaceRoot: string): StorageQuotaService {
  const dbRoot = basename(workspaceRoot) === "sqlite" && basename(dirname(workspaceRoot)) === "data"
    ? dirname(dirname(workspaceRoot))
    : workspaceRoot;
  return new StorageQuotaService({
    sandboxPolicy: createWorkspaceWritePolicy(dbRoot),
    categories: [],
  });
}

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "industrial-ops-program.db");
  seedHappyPathDb(dbPath);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const healthService = new HealthService(db, store);
  const metricsService = new MetricsService(db, healthService);
  const checker = new StartupConsistencyChecker(db, store, createDefaultStartupConsistencyCheckerOptions());
  const retentionService = new ObservabilityRetentionService(db);
  const diagnostics = new DiagnosticsService(
    new InspectService(store),
    healthService,
    new StructuredLogger(),
    retentionService,
  );
  const stalledDetector = new StalledExecutionDetector(store);
  const doctor = new DoctorService(
    healthService,
    checker,
    new RuntimeRecoveryService(store),
    stalledDetector,
    new SqliteReliabilityService(db),
    `${dbPath}.backup`,
    new ProtectedGovernanceIntegrityService(),
    createWorkspaceScopedStorageQuotaService(workspace),
    new WorkerRegistryService(store),
    retentionService,
    new StalledExecutionEscalationService(stalledDetector, diagnostics),
    new ExecutionResourceMonitor(store),
    { store },
  );
  const governance = new OperationsGovernanceService(db, metricsService, doctor, diagnostics);
  const taskId = store.listTasks(10)[0]?.id;
  if (!taskId) {
    throw new Error("industrial_ops_program.seed_task_missing");
  }
  const executionId = store.listExecutionsByTask(taskId)[0]?.id ?? null;
  const approvals = new ApprovalService(db, store);
  approvals.createRequest({
    taskId,
    executionId,
    sourceAgentId: "ops_program",
    reason: "Seed incident package",
    riskLevel: "medium",
    options: ["approve", "reject"],
    context: { surface: "ops-program" },
    timeoutPolicy: "reject",
  });
  store.upsertWorkerSnapshot({
    workerId: "worker-ops-program",
    status: "busy",
    placement: "local",
    isolationLevel: "standard",
    capabilitiesJson: JSON.stringify(["bash"]),
    runningExecutionsJson: JSON.stringify(executionId ? [executionId] : []),
    maxConcurrency: 1,
    queueAffinity: "default",
    runtimeInstanceId: "runtime-ops-program",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: 12,
    memoryMb: 80,
    toolBacklogCount: 1,
    currentStepId: "respond",
    lastProgressAt: nowIso(),
    lastHeartbeatAt: nowIso(),
    updatedAt: nowIso(),
  });

  return {
    workspace,
    db,
    service: new IndustrialOpsProgramService(governance),
    taskId,
  };
}

test("IndustrialOpsProgramService builds alerting and handoff package from ops governance evidence", () => {
  const harness = createHarness("aa-industrial-ops-program-");
  try {
    const report = harness.service.buildReport({
      environment: "prod",
      taskId: harness.taskId,
      shiftOwner: "runtime_reliability_oncall",
    });

    assert.equal(report.environment, "prod");
    assert.equal(report.shiftOwner, "runtime_reliability_oncall");
    assert.ok(report.alertPolicies.length >= 4);
    assert.ok(report.handoffChecklist.length >= 3);
    assert.ok(report.governanceReport.reportId.length > 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("IndustrialOpsProgramService builds report with default shift owner when not specified", () => {
  const harness = createHarness("aa-industrial-ops-default-");
  try {
    const report = harness.service.buildReport({
      environment: "staging",
      taskId: harness.taskId,
    });

    assert.equal(report.environment, "staging");
    assert.ok(report.alertPolicies.length >= 4);
    assert.ok(report.handoffChecklist.length >= 3);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});
