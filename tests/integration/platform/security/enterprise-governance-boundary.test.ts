import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import test from "node:test";

import { ApprovalService } from "../../../../src/platform/control-plane/approval-center/approval-service.js";
import { ProtectedGovernanceIntegrityService } from "../../../../src/platform/control-plane/config-center/protected-governance-integrity-service.js";
import { DiagnosticsService } from "../../../../src/platform/shared/observability/diagnostics-service.js";
import { HealthService } from "../../../../src/platform/shared/observability/health-service.js";
import { InspectService } from "../../../../src/platform/shared/observability/inspect-service.js";
import { MetricsService } from "../../../../src/platform/shared/observability/metrics-service.js";
import { ObservabilityRetentionService } from "../../../../src/platform/shared/observability/observability-retention-service.js";
import { StructuredLogger } from "../../../../src/platform/shared/observability/structured-logger.js";
import { DoctorService } from "../../../../src/platform/control-plane/incident-control/doctor-service.js";
import { EnterpriseGovernanceService } from "../../../../src/platform/control-plane/incident-control/enterprise-governance-service.js";
import { OperationsGovernanceService } from "../../../../src/platform/control-plane/incident-control/operations-governance-service.js";
import { ExecutionResourceMonitor } from "../../../../src/platform/execution/dispatcher/execution-resource-monitor.js";
import { RuntimeRecoveryService } from "../../../../src/platform/execution/recovery/runtime-recovery-service-root.js";
import { StalledExecutionDetector } from "../../../../src/platform/execution/recovery/stalled-execution-detector.js";
import { StalledExecutionEscalationService } from "../../../../src/platform/execution/recovery/stalled-execution-escalation-service.js";
import { createDefaultStartupConsistencyCheckerOptions } from "../../../../src/platform/execution/startup/startup-preflight.js";
import { StartupConsistencyChecker } from "../../../../src/platform/execution/startup/startup-consistency-checker.js";
import { WorkerRegistryService } from "../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import { createWorkspaceWritePolicy } from "../../../../src/platform/control-plane/iam/sandbox-policy.js";
import { StorageQuotaService } from "../../../../src/platform/state-evidence/truth/storage-quota-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { SqliteReliabilityService } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-reliability-service.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

const repoRoot = process.cwd();

function seedHappyPathDb(dbPath: string): void {
  const script = `
    import { runSingleTaskExecution } from ${JSON.stringify(new URL("../../../../src/platform/execution/execution-engine/single-task-execution.js", import.meta.url).href)};
    await runSingleTaskExecution({
      dbPath: ${JSON.stringify(dbPath)},
      title: "Enterprise governance security task",
      request: "Seed security boundary coverage for enterprise governance.",
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

function writeDependencyFixtures(workspace: string): { manifestPath: string; lockfilePath: string } {
  const manifestPath = join(workspace, "package.enterprise.json");
  const lockfilePath = join(workspace, "package-lock.enterprise.json");
  writeFileSync(
    manifestPath,
    JSON.stringify({
      name: "enterprise-governance-security-fixture",
      version: "1.0.0",
      dependencies: {
        "demo-lib": "^1.0.0",
      },
    }, null, 2),
    "utf8",
  );
  writeFileSync(
    lockfilePath,
    JSON.stringify({
      name: "enterprise-governance-security-fixture",
      version: "1.0.0",
      lockfileVersion: 3,
      requires: true,
      packages: {
        "": {
          name: "enterprise-governance-security-fixture",
          version: "1.0.0",
          dependencies: {
            "demo-lib": "^1.0.0",
          },
        },
        "node_modules/demo-lib": {
          version: "1.0.0",
          resolved: "https://registry.npmjs.org/demo-lib/-/demo-lib-1.0.0.tgz",
          integrity: "sha512-demo",
          license: "MIT",
        },
      },
    }, null, 2),
    "utf8",
  );
  return { manifestPath, lockfilePath };
}

function createService(workspace: string) {
  const dbPath = join(workspace, "enterprise-governance-security.db");
  seedHappyPathDb(dbPath);
  const { manifestPath, lockfilePath } = writeDependencyFixtures(workspace);
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
    throw new Error("enterprise_governance.security.seed_task_missing");
  }
  const executionId = store.listExecutionsByTask(taskId)[0]?.id ?? null;
  const approvals = new ApprovalService(db, store);
  approvals.createRequest({
    taskId,
    executionId,
    sourceAgentId: "enterprise_governance_security",
    reason: "Seed approval for sandbox export boundary coverage.",
    riskLevel: "medium",
    options: ["approve", "reject"],
    context: { surface: "enterprise-governance-security" },
    timeoutPolicy: "reject",
  });
  store.upsertWorkerSnapshot({
    workerId: "worker-security-enterprise-governance",
    status: "busy",
    placement: "local",
    isolationLevel: "standard",
    capabilitiesJson: JSON.stringify(["bash"]),
    runningExecutionsJson: JSON.stringify(executionId ? [executionId] : []),
    maxConcurrency: 1,
    queueAffinity: "default",
    runtimeInstanceId: "runtime-security-enterprise-governance",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: 11,
    memoryMb: 72,
    toolBacklogCount: 0,
    currentStepId: "respond",
    lastProgressAt: nowIso(),
    lastHeartbeatAt: nowIso(),
    updatedAt: nowIso(),
  });

  const governance = new OperationsGovernanceService(db, metricsService, doctor, diagnostics);
  return {
    db,
    taskId,
    manifestPath,
    lockfilePath,
    serviceFactory: (outsideRoot: string) => new EnterpriseGovernanceService(governance, store, {
      artifactStoreOptions: {
        rootDir: join(outsideRoot, "artifacts"),
        sandboxPolicy: createWorkspaceWritePolicy(workspace),
      },
    }),
  };
}

test("enterprise governance export fail-closes when artifact root is outside the allowed workspace", () => {
  const workspace = createTempWorkspace("aa-enterprise-governance-security-");
  const outsideRoot = createTempWorkspace("aa-enterprise-governance-security-outside-");
  const { db, taskId, manifestPath, lockfilePath, serviceFactory } = createService(workspace);

  try {
    const service = serviceFactory(outsideRoot);
    assert.throws(
      () =>
        service.exportReport({
          environment: "prod",
          taskId,
          dependencyManifestPath: manifestPath,
          dependencyLockfilePath: lockfilePath,
        }),
      /sandbox\.path_outside_allowed_roots/,
    );
  } finally {
    db.close();
    cleanupPath(workspace);
    cleanupPath(outsideRoot);
  }
});
