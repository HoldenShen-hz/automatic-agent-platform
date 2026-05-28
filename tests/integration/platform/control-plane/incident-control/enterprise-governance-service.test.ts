import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { ApprovalService } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { ProtectedGovernanceIntegrityService } from "../../../../../src/platform/five-plane-control-plane/config-center/protected-governance-integrity-service.js";
import { DiagnosticsService } from "../../../../../src/platform/shared/observability/diagnostics-service.js";
import { HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
import { InspectService } from "../../../../../src/platform/shared/observability/inspect-service.js";
import { MetricsService } from "../../../../../src/platform/shared/observability/metrics-service.js";
import { ObservabilityRetentionService } from "../../../../../src/platform/shared/observability/observability-retention-service.js";
import { StructuredLogger } from "../../../../../src/platform/shared/observability/structured-logger.js";
import { DoctorService } from "../../../../../src/platform/five-plane-control-plane/incident-control/doctor-service.js";
import { EnterpriseGovernanceService } from "../../../../../src/platform/five-plane-control-plane/incident-control/enterprise-governance-service.js";
import { OperationsGovernanceService } from "../../../../../src/platform/five-plane-control-plane/incident-control/operations-governance-service.js";
import { ExecutionResourceMonitor } from "../../../../../src/platform/five-plane-execution/dispatcher/execution-resource-monitor.js";
import { RuntimeRecoveryService } from "../../../../../src/platform/five-plane-execution/recovery/runtime-recovery-service.js";
import { StalledExecutionDetector } from "../../../../../src/platform/five-plane-execution/recovery/stalled-execution-detector.js";
import { StalledExecutionEscalationService } from "../../../../../src/platform/five-plane-execution/recovery/stalled-execution-escalation-service.js";
import { createDefaultStartupConsistencyCheckerOptions } from "../../../../../src/platform/five-plane-execution/startup/startup-preflight.js";
import { StartupConsistencyChecker } from "../../../../../src/platform/five-plane-execution/startup/startup-consistency-checker.js";
import { WorkerRegistryService } from "../../../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";
import { createWorkspaceWritePolicy } from "../../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";
import { StorageQuotaService } from "../../../../../src/platform/five-plane-state-evidence/truth/storage-quota-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { SqliteReliabilityService } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-reliability-service.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));

function seedHappyPathDb(dbPath: string): void {
  const script = `
    import { runSingleTaskExecution } from ${JSON.stringify(new URL("../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js", import.meta.url).href)};
    await runSingleTaskExecution({
      dbPath: ${JSON.stringify(dbPath)},
      title: "Enterprise governance task",
      request: "Seed enterprise governance evidence.",
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
      name: "enterprise-governance-fixture",
      version: "1.0.0",
      dependencies: {
        "demo-lib": "latest",
      },
      devDependencies: {
        "beta-lib": "1.0.0-beta.1",
      },
    }, null, 2),
    "utf8",
  );
  writeFileSync(
    lockfilePath,
    JSON.stringify({
      name: "enterprise-governance-fixture",
      version: "1.0.0",
      lockfileVersion: 3,
      requires: true,
      packages: {
        "": {
          name: "enterprise-governance-fixture",
          version: "1.0.0",
          dependencies: {
            "demo-lib": "latest",
          },
          devDependencies: {
            "beta-lib": "1.0.0-beta.1",
          },
        },
        "node_modules/demo-lib": {
          version: "2.0.0",
          resolved: "file:../demo-lib",
          license: "MIT",
        },
        "node_modules/beta-lib": {
          version: "1.0.0-beta.1",
          resolved: "https://registry.npmjs.org/beta-lib/-/beta-lib-1.0.0-beta.1.tgz",
          integrity: "sha512-beta",
          dev: true,
          license: "Apache-2.0",
        },
      },
    }, null, 2),
    "utf8",
  );
  return { manifestPath, lockfilePath };
}

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "enterprise-governance.db");
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
  const governance = new OperationsGovernanceService(db, metricsService, doctor, diagnostics);
  const taskId = store.listTasks(10)[0]?.id;
  if (!taskId) {
    throw new Error("enterprise_governance.seed_task_missing");
  }
  const executionId = store.listExecutionsByTask(taskId)[0]?.id ?? null;
  const approvals = new ApprovalService(db, store);
  approvals.createRequest({
    taskId,
    executionId,
    sourceAgentId: "enterprise_governance",
    reason: "Seed incident package",
    riskLevel: "medium",
    options: ["approve", "reject"],
    context: { surface: "enterprise-governance" },
    timeoutPolicy: "reject",
  });
  store.upsertWorkerSnapshot({
    workerId: "worker-enterprise-governance",
    status: "busy",
    placement: "local",
    isolationLevel: "standard",
    capabilitiesJson: JSON.stringify(["bash"]),
    runningExecutionsJson: JSON.stringify(executionId ? [executionId] : []),
    maxConcurrency: 1,
    queueAffinity: "default",
    runtimeInstanceId: "runtime-enterprise-governance",
    restartedFromRuntimeInstanceId: null,
    version: 1,
    restartGeneration: 0,
    cpuPct: 12,
    memoryMb: 96,
    toolBacklogCount: 1,
    currentStepId: "respond",
    lastProgressAt: nowIso(),
    lastHeartbeatAt: nowIso(),
    updatedAt: nowIso(),
  });
  store.upsertExtensionPackage({
    packageId: "pkg_demo_extension",
    tenantId: null,
    extensionId: "demo_extension",
    packageType: "plugin",
    displayName: "Demo Extension",
    version: "1.0.0",
    owner: "security-team",
    trustLevel: "community",
    sourceUri: "https://example.com/demo-extension.tgz",
    capabilitiesJson: JSON.stringify(["execute"]),
    permissionsJson: JSON.stringify(["command.run"]),
    compatibilityJson: JSON.stringify({ minVersion: "0.1.0" }),
    signatureVerified: 0,
    manifestChecksum: "checksum",
    lifecycleState: "enabled",
    reviewRequired: 1,
    sbomVerified: 0,
    sandboxCertVerified: 0,
    egressPolicyCompliant: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  return {
    workspace,
    db,
    store,
    service: new EnterpriseGovernanceService(governance, store),
    manifestPath,
    lockfilePath,
    taskId,
  };
}

test("EnterpriseGovernanceService builds and persists aggregated ops, schema, supply-chain, and APM evidence", () => {
  const harness = createHarness("aa-enterprise-governance-");
  try {
    const result = harness.service.runReport({
      environment: "prod",
      taskId: harness.taskId,
      shiftOwner: "runtime_reliability_oncall",
      dependencyManifestPath: harness.manifestPath,
      dependencyLockfilePath: harness.lockfilePath,
    });

    assert.equal(result.report.environment, "prod");
    assert.equal(result.report.schemaGate.verdict, "pass");
    assert.equal(result.report.supplyChain.verdict, "fail");
    assert.equal(result.report.status, "fail");
    assert.ok(result.report.incidentHandoff.activeIncidentId);
    assert.ok(result.report.apmExport.datadog.series.length >= 4);
    assert.ok(result.report.supplyChain.findings.some((item) => item.findingId === "dependency_missing_integrity"));
    assert.ok(result.report.supplyChain.findings.some((item) => item.findingId === "extension_signature_missing"));

    const history = harness.service.listHistory(5);
    const handoffs = harness.service.listIncidentHandoffs(5);
    assert.equal(history.length, 1);
    assert.equal(handoffs.length, 1);
    assert.equal(history[0]?.handoffId, handoffs[0]?.handoffId);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("EnterpriseGovernanceService returns empty history when no reports exist", () => {
  const workspace = createTempWorkspace("aa-enterprise-governance-empty-");
  const dbPath = join(workspace, "enterprise-governance-empty.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  try {
    const store = new AuthoritativeTaskStore(db);
    const governance = new OperationsGovernanceService(db, new MetricsService(db, new HealthService(db, store)), new DoctorService(
      new HealthService(db, store),
      new StartupConsistencyChecker(db, store, createDefaultStartupConsistencyCheckerOptions()),
      new RuntimeRecoveryService(store),
      new StalledExecutionDetector(store),
      new SqliteReliabilityService(db),
      `${dbPath}.backup`,
      new ProtectedGovernanceIntegrityService(),
      createWorkspaceScopedStorageQuotaService(workspace),
      new WorkerRegistryService(store),
      new ObservabilityRetentionService(db),
      new StalledExecutionEscalationService(new StalledExecutionDetector(store), new DiagnosticsService(
        new InspectService(store),
        new HealthService(db, store),
        new StructuredLogger(),
        new ObservabilityRetentionService(db),
      )),
      new ExecutionResourceMonitor(store),
      { store },
    ), new DiagnosticsService(
      new InspectService(store),
      new HealthService(db, store),
      new StructuredLogger(),
      new ObservabilityRetentionService(db),
    ));
    const service = new EnterpriseGovernanceService(governance, store);

    const history = service.listHistory(5);
    const handoffs = service.listIncidentHandoffs(5);

    assert.equal(history.length, 0);
    assert.equal(handoffs.length, 0);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});
