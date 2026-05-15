import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { basename, dirname, join } from "node:path";
import test from "node:test";

import { ApprovalService } from "../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { DiagnosticsService } from "../../../../src/platform/shared/observability/diagnostics-service.js";
import { HealthService } from "../../../../src/platform/shared/observability/health-service.js";
import { InspectService } from "../../../../src/platform/shared/observability/inspect-service.js";
import { MetricsService } from "../../../../src/platform/shared/observability/metrics-service.js";
import { ObservabilityRetentionService } from "../../../../src/platform/shared/observability/observability-retention-service.js";
import { StructuredLogger } from "../../../../src/platform/shared/observability/structured-logger.js";
import { ProtectedGovernanceIntegrityService } from "../../../../src/platform/five-plane-control-plane/config-center/protected-governance-integrity-service.js";
import { OperationsGovernanceService } from "../../../../src/platform/five-plane-control-plane/incident-control/operations-governance-service.js";
import { DoctorService } from "../../../../src/platform/five-plane-control-plane/incident-control/doctor-service.js";
import { ExecutionResourceMonitor } from "../../../../src/platform/five-plane-execution/dispatcher/execution-resource-monitor.js";
import { RuntimeRecoveryService } from "../../../../src/platform/five-plane-execution/recovery/runtime-recovery-service-root.js";
import { StalledExecutionDetector } from "../../../../src/platform/five-plane-execution/recovery/stalled-execution-detector.js";
import { StalledExecutionEscalationService } from "../../../../src/platform/five-plane-execution/recovery/stalled-execution-escalation-service.js";
import { createDefaultStartupConsistencyCheckerOptions } from "../../../../src/platform/five-plane-execution/startup/startup-preflight.js";
import { StartupConsistencyChecker } from "../../../../src/platform/five-plane-execution/startup/startup-consistency-checker.js";
import { WorkerRegistryService } from "../../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";
import { createWorkspaceWritePolicy } from "../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";
import { StorageQuotaService } from "../../../../src/platform/five-plane-state-evidence/truth/storage-quota-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { SqliteReliabilityService } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-reliability-service.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

const repoRoot = process.cwd();

function seedHappyPathDb(dbPath: string): void {
  const script = `
    import { runSingleTaskExecution } from ${JSON.stringify(new URL("../../../../src/platform/five-plane-execution/execution-engine/single-task-execution.ts", import.meta.url).href)};
    await runSingleTaskExecution({
      dbPath: ${JSON.stringify(dbPath)},
      title: "Ops governance security task",
      request: "Seed security boundary coverage for ops governance.",
    });
  `;
  execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", script], {
    cwd: repoRoot,
    stdio: "pipe",
  });
}

function createWorkspaceScopedStorageQuotaService(workspaceRoot: string): StorageQuotaService {
  const dbRoot = basename(workspaceRoot) === "sqlite" && basename(dirname(workspaceRoot)) === "data"
    ? dirname(dirname(workspaceRoot))
    : workspaceRoot;
  const usesDataLayout = basename(workspaceRoot) === "sqlite" && basename(dirname(workspaceRoot)) === "data";
  return new StorageQuotaService({
    sandboxPolicy: createWorkspaceWritePolicy(dbRoot),
    categories: [
      {
        categoryId: "artifact",
        roots: usesDataLayout ? [join(dbRoot, "data", "artifacts")] : [join(dbRoot, "artifacts")],
        maxBytes: 250 * 1024 * 1024,
        cleanupEnabled: true,
      },
      {
        categoryId: "debug",
        roots: usesDataLayout
          ? [join(dbRoot, "data", "stable-evidence"), join(dbRoot, "data", "debug")]
          : [join(dbRoot, "stable-evidence"), join(dbRoot, "debug")],
        maxBytes: 150 * 1024 * 1024,
        cleanupEnabled: true,
      },
      {
        categoryId: "backup",
        roots: usesDataLayout ? [join(dbRoot, "data", "sqlite"), join(dbRoot, "data", "backups")] : [dbRoot, join(dbRoot, "backups")],
        maxBytes: 200 * 1024 * 1024,
        cleanupEnabled: true,
      },
    ],
  });
}

function createService(workspace: string) {
  const dbPath = join(workspace, "ops-governance-security.db");
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
  const taskId = store.listTasks(10)[0]?.id;
  if (!taskId) {
    throw new Error("ops_governance.security.seed_task_missing");
  }
  const executionId = store.listExecutionsByTask(taskId)[0]?.id ?? null;
  const approvals = new ApprovalService(db, store);
  approvals.createRequest({
    taskId,
    executionId,
    sourceAgentId: "ops_security",
    reason: "Seed approval for sandbox export boundary coverage.",
    riskLevel: "medium",
    options: ["approve", "reject"],
    context: { surface: "ops-security" },
    timeoutPolicy: "reject",
  });

  return { db, taskId, serviceFactory: (outsideRoot: string) => new OperationsGovernanceService(db, metricsService, doctor, diagnostics, {
    artifactStoreOptions: {
      rootDir: join(outsideRoot, "artifacts"),
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
    },
  }) };
}

test("ops governance export fail-closes when artifact root is outside the allowed workspace", () => {
  const workspace = createTempWorkspace("aa-ops-governance-security-");
  const outsideRoot = createTempWorkspace("aa-ops-governance-security-outside-");
  const { db, taskId, serviceFactory } = createService(workspace);

  try {
    const service = serviceFactory(outsideRoot);
    assert.throws(
      () =>
        service.exportReport({
          environment: "prod",
          taskId,
        }),
      /sandbox\.path_outside_allowed_roots/,
    );
  } finally {
    db.close();
    cleanupPath(workspace);
    cleanupPath(outsideRoot);
  }
});
