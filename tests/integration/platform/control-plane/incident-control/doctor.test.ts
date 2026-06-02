import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { DiagnosticsService } from "../../../../../src/platform/shared/observability/diagnostics-service.js";
import { HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
import { InspectService } from "../../../../../src/platform/shared/observability/inspect-service.js";
import { ObservabilityRetentionService } from "../../../../../src/platform/shared/observability/observability-retention-service.js";
import { StructuredLogger } from "../../../../../src/platform/shared/observability/structured-logger.js";
import { ProtectedGovernanceIntegrityService } from "../../../../../src/platform/five-plane-control-plane/config-center/protected-governance-integrity-service.js";
import { DoctorService } from "../../../../../src/platform/five-plane-control-plane/incident-control/doctor-service.js";
import { ExecutionResourceMonitor } from "../../../../../src/platform/five-plane-execution/dispatcher/execution-resource-monitor.js";
import { createWorkspaceWritePolicy } from "../../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";
import { ExecutionResourceCeilingGuard } from "../../../../../src/platform/five-plane-execution/dispatcher/execution-resource-ceiling-guard.js";
import {
  buildEnvironmentProviderReadinessProbe,
} from "../../../../../src/platform/five-plane-execution/startup/startup-preflight.js";
import { RuntimeRecoveryService } from "../../../../../src/platform/five-plane-execution/recovery/runtime-recovery-service.js";
import { StalledExecutionDetector } from "../../../../../src/platform/five-plane-execution/recovery/stalled-execution-detector.js";
import { StalledExecutionEscalationService } from "../../../../../src/platform/five-plane-execution/recovery/stalled-execution-escalation-service.js";
import { runSingleTaskExecution } from "../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js";
import { StartupConsistencyChecker } from "../../../../../src/platform/five-plane-execution/startup/startup-consistency-checker.js";
import { WorkerRegistryService } from "../../../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";
import { StorageQuotaService } from "../../../../../src/platform/five-plane-state-evidence/truth/storage-quota-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteReliabilityService } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-reliability-service.js";
import { withEnv } from "../../../../helpers/env.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

function seedProtectedGovernanceTree(workspace: string): {
  configRoot: string;
  divisionsRoot: string;
  agentsPath: string;
} {
  const configRoot = join(workspace, "config");
  const divisionsRoot = join(workspace, "divisions");
  const agentsPath = join(workspace, "AGENTS.md");

  createFile(join(configRoot, "bootstrap/default.json"), JSON.stringify({ appName: "aa", phase: "phase_2a", stableCoreEnabled: true }));
  createFile(join(configRoot, "gateways/default.json"), JSON.stringify({ defaultGateway: "cli", sseEnabled: true }));
  createFile(join(configRoot, "providers/default.json"), JSON.stringify({ defaultProvider: "openai", defaultModelProfile: "reasoning-medium" }));
  createFile(join(configRoot, "providers/models.json"), JSON.stringify({
    version: "test-registry",
    providers: { openai: { status: "active", authMethods: ["api_key"] } },
    profiles: {
      "reasoning-medium": {
        provider: "openai",
        modelId: "gpt-5.2",
        tier: "reasoning",
        capabilities: ["reasoning"],
        contextWindowTokens: 400000,
        maxOutputTokens: 128000,
        pricing: { inputPer1kUsd: 0.012, outputPer1kUsd: 0.036 },
        metadataSource: "local_override",
      },
    },
  }));
  createFile(join(configRoot, "runtime/default.json"), JSON.stringify({ maxConcurrentTasks: 2, defaultTaskTimeoutMs: 300000, defaultStepTimeoutMs: 120000 }));
  createFile(join(configRoot, "security/default.json"), JSON.stringify({
    approvalMode: "supervised",
    sandboxMode: "workspace_write",
    allowDestructiveActions: false,
    remoteWorkerRegistration: {
      challengeTtlMs: 300000,
      allowedCapabilities: ["bash", "edit", "mcp"],
    },
  }));
  createFile(join(configRoot, "workflows/default.json"), JSON.stringify({ defaultWorkflowId: "single_agent_minimal", allowCrossDivisionDag: false }));
  createFile(join(divisionsRoot, "general-ops/division.yaml"), "id: general-ops\nversion: 1\ndefault_workflow: single_agent_minimal\nroles:\n  - id: general_executor\n    prompt: roles/general_executor.prompt.md\n    model: balanced\n    tools: [read]\n");
  createFile(join(divisionsRoot, "general-ops/roles/general_executor.prompt.md"), "# prompt\n");
  createFile(join(divisionsRoot, "general-ops/schemas/minimal-output.json"), JSON.stringify({ type: "object", required: ["summary", "result"], properties: { summary: { type: "string", minLength: 1 }, result: { type: "string", minLength: 1 } }, additionalProperties: false }));
  createFile(join(divisionsRoot, "general-ops/workflows/minimal.yaml"), "id: single_agent_minimal\ndivision_id: general-ops\nsteps:\n  - step_id: analyze_request\n    role_id: general_executor\n    output_key: analysis\n    output_schema: schemas/minimal-output.json\n    timeout_ms: 120000\n    max_attempts: 1\n");
  createFile(agentsPath, "# Repository Guidelines\n");

  return { configRoot, divisionsRoot, agentsPath };
}

function ackAllEventConsumers(store: AuthoritativeTaskStore): void {
  const occurredAt = new Date().toISOString();
  for (const event of store.event.listAllEvents()) {
    store.event.ackAllConsumersForEvent(event.id, occurredAt);
  }
}

test("doctor service summarizes a clean runtime as ok", async () => {
  const workspace = createTempWorkspace("aa-doctor-");
  const dbPath = join(workspace, "doctor.db");
  const now = new Date().toISOString();

  try {
    await runSingleTaskExecution({
      dbPath,
      title: "Doctor task",
      request: "Verify doctor service output.",
    });

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    ackAllEventConsumers(store);
    const workers = new WorkerRegistryService(store);
    workers.recordHeartbeat({
      workerId: "worker-doctor-clean",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-doctor-clean-1",
      cpuPct: 12,
      memoryMb: 96,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: now,
      occurredAt: now,
    });
    const healthService = new HealthService(db, store);
    const stalledDetector = new StalledExecutionDetector(store);
    const diagnostics = new DiagnosticsService(new InspectService(store), healthService, new StructuredLogger());
    const doctor = new DoctorService(
      healthService,
      new StartupConsistencyChecker(db, store),
      new RuntimeRecoveryService(store),
      stalledDetector,
      new SqliteReliabilityService(db),
      `${dbPath}.backup`,
      null,
      null,
      workers,
      null,
      new StalledExecutionEscalationService(stalledDetector, diagnostics),
      null,
      { store },
    );

    const report = doctor.run();

    assert.equal(report.status, "ok");
    assert.equal(report.selfCheckSummary.totalChecks, 8);
    assert.equal(report.selfCheckSummary.okChecks, 8);
    assert.deepEqual(report.selfCheckSummary.failingCheckIds, []);
    assert.equal(report.startupConsistency.status, "pass");
    assert.equal(report.startupConsistency.findings.length, 0);
    assert.equal(report.stalledExecutions.length, 0);
    assert.equal(report.stalledEscalations.length, 0);
    assert.ok(report.runtimeRecovery.recoverableRuns.length >= 0);
    assert.equal(report.sqliteReliability.integrityPassed, true);
    assert.equal(report.sqliteReliability.backup?.valid, true);
    assert.equal(report.lockSummary.checked, true);
    assert.equal(report.lockSummary.totalLocks, 0);
    assert.equal(report.eventBacklogSummary.pendingTier1Acks, 0);
    assert.equal(report.checks.find((check) => check.checkId === "db")?.status, "ok");
    assert.equal(report.checks.find((check) => check.checkId === "config")?.status, "ok");
    assert.equal(report.checks.find((check) => check.checkId === "backup")?.status, "ok");
    assert.equal(report.checks.find((check) => check.checkId === "locks")?.status, "ok");
    assert.equal(report.checks.find((check) => check.checkId === "workers")?.status, "ok");
    assert.equal(report.checks.find((check) => check.checkId === "event_backlog")?.status, "ok");
    assert.equal(report.checks.find((check) => check.checkId === "audit_integrity")?.status, "ok");
    assert.equal(report.checks.find((check) => check.checkId === "provider_health")?.status, "ok");
    assert.equal(report.auditIntegrity?.compromisedEvents, 0);
    assert.equal(report.versionSnapshot.applicationVersion, "0.2.0");
    assert.equal(report.versionSnapshot.schemaVersion.upToDate, true);
    assert.equal(report.versionSnapshot.configVersion.length > 0, true);
    assert.deepEqual(report.versionSnapshot.featureFlags, []);
    assert.equal(report.workerSummary.totalWorkers, 1);
    assert.equal(report.workerSummary.healthyWorkers, 1);
    assert.equal(report.workerSummary.workers[0]?.runtimeInstanceId, "runtime-doctor-clean-1");
    assert.equal(report.workerSummary.workers[0]?.schedulingStatus, "healthy");
    assert.equal(report.workerSummary.workers[0]?.restartGeneration, 0);
    assert.equal(report.workerSummary.workers[0]?.cpuPct, 12);
    assert.equal(report.workerSummary.workers[0]?.memoryMb, 96);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("doctor service fail-closes when the authoritative store is not writable", () => {
  const workspace = createTempWorkspace("aa-doctor-");
  const dbPath = join(workspace, "doctor-db-read-only.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const healthService = new HealthService(db, store);
    const healthInternals = healthService as unknown as { checkDbWritableSync: () => boolean };
    const originalCheckDbWritable = healthInternals.checkDbWritableSync.bind(healthService);
    healthInternals.checkDbWritableSync = () => false;

    const doctor = new DoctorService(
      healthService,
      new StartupConsistencyChecker(db, store),
      new RuntimeRecoveryService(store),
      null,
      new SqliteReliabilityService(db),
      `${dbPath}.backup`,
      null,
      null,
      workers,
      null,
      null,
      null,
      { store },
    );

    const report = doctor.run();

    healthInternals.checkDbWritableSync = originalCheckDbWritable;

    assert.equal(report.status, "fail_closed");
    assert.equal(report.health.dbWritable, false);
    assert.equal(report.health.degradationMode, "read_only_operations_only");
    assert.equal(report.checks.find((check) => check.checkId === "db")?.status, "fail_closed");
    assert.ok(report.checks.find((check) => check.checkId === "db")?.findings.includes("db_write_probe_failed"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("doctor service fail-closes when tier1 audit integrity is compromised", () => {
  const workspace = createTempWorkspace("aa-doctor-audit-");
  const dbPath = join(workspace, "doctor-audit.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);

    seedTaskAndExecution(db, store, {
      taskId: "task-audit-doctor",
      executionId: "exec-audit-doctor",
      traceId: "trace-audit-doctor",
    });
    store.insertEvent({
      id: "evt-audit-doctor",
      taskId: "task-audit-doctor",
      sessionId: null,
      executionId: "exec-audit-doctor",
      eventType: "task:status_changed",
      payloadJson: "{\"status\":\"executing\"}",
      traceId: "trace-audit-doctor",
      createdAt: "2026-04-07T00:00:00.000Z",
    });

    db.connection
      .prepare("UPDATE events SET payload_json = ? WHERE id = ?")
      .run("{\"status\":\"tampered\"}", "evt-audit-doctor");

    const healthService = new HealthService(db, store);
    const doctor = new DoctorService(
      healthService,
      new StartupConsistencyChecker(db, store),
      new RuntimeRecoveryService(store),
      null,
      new SqliteReliabilityService(db),
      `${dbPath}.backup`,
      null,
      null,
      workers,
      null,
      null,
      null,
      { store },
    );

    const report = doctor.run();

    assert.equal(report.status, "fail_closed");
    assert.equal(report.auditIntegrity?.compromisedEvents, 1);
    assert.equal(report.checks.find((check) => check.checkId === "audit_integrity")?.status, "fail_closed");
    assert.ok(report.checks.find((check) => check.checkId === "audit_integrity")?.findings.includes(
      "audit_event_checksum_mismatch:evt-audit-doctor",
    ));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("doctor service groups expired locks and tier1 backlog into unified self-check findings", () => {
  const workspace = createTempWorkspace("aa-doctor-self-check-");
  const dbPath = join(workspace, "doctor-self-check.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);

    seedTaskAndExecution(db, store, {
      taskId: "task-self-check",
      executionId: "exec-self-check",
      traceId: "trace-self-check",
    });
    store.insertWorkflowState({
      taskId: "task-self-check",
      divisionId: "general-ops",
      workflowId: "single_agent_minimal",
      currentStepIndex: 0,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: "2026-04-07T00:00:00.000Z",
      updatedAt: "2026-04-07T00:00:00.000Z",
    });
    store.insertSession({
      id: "sess-self-check",
      taskId: "task-self-check",
      channel: "cli",
      status: "open",
      externalSessionId: null,
      createdAt: "2026-04-07T00:00:00.000Z",
      updatedAt: "2026-04-07T00:00:00.000Z",
    });
    store.insertFileLock({
      id: "lock-live",
      taskId: "task-self-check",
      executionId: "exec-self-check",
      lockScope: "workspace",
      resourcePath: "data/output.md",
      lockMode: "exclusive",
      ownerId: "owner-live",
      expiresAt: "2099-01-01T00:00:00.000Z",
      createdAt: "2026-04-07T00:00:00.000Z",
      updatedAt: "2026-04-07T00:00:00.000Z",
    });
    store.insertFileLock({
      id: "lock-expired",
      taskId: "task-self-check",
      executionId: "exec-self-check",
      lockScope: "workspace",
      resourcePath: "data/stale.md",
      lockMode: "shared",
      ownerId: "owner-stale",
      expiresAt: "2000-01-01T00:00:00.000Z",
      createdAt: "2000-01-01T00:00:00.000Z",
      updatedAt: "2000-01-01T00:00:00.000Z",
    });
    store.insertEvent({
      id: "evt-self-check-backlog",
      taskId: "task-self-check",
      executionId: "exec-self-check",
      eventType: "task:status_changed",
      eventTier: "tier_1",
      payloadJson: JSON.stringify({ from: "queued", to: "in_progress" }),
      traceId: "trace-self-check",
      createdAt: "2000-01-01T00:00:00.000Z",
    });

    const doctor = new DoctorService(
      new HealthService(db, store),
      new StartupConsistencyChecker(db, store),
      new RuntimeRecoveryService(store),
      new StalledExecutionDetector(store),
      new SqliteReliabilityService(db),
      `${dbPath}.backup`,
      null,
      null,
      workers,
      null,
      null,
      null,
      { store },
    );

    const report = doctor.run();

    assert.equal(report.status, "degraded");
    assert.equal(report.lockSummary.totalLocks, 2);
    assert.equal(report.lockSummary.exclusiveLocks, 1);
    assert.equal(report.lockSummary.sharedLocks, 1);
    assert.equal(report.lockSummary.expiredLockCount, 1);
    assert.equal(report.eventBacklogSummary.pendingTier1Acks, 2);
    assert.ok(report.selfCheckSummary.failingCheckIds.includes("locks"));
    assert.ok(report.selfCheckSummary.failingCheckIds.includes("event_backlog"));
    assert.equal(report.checks.find((check) => check.checkId === "locks")?.status, "degraded");
    assert.equal(report.checks.find((check) => check.checkId === "event_backlog")?.status, "degraded");
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("doctor service exposes build and feature flag metadata in the version snapshot", async () => {
  const workspace = createTempWorkspace("aa-doctor-version-");
  const dbPath = join(workspace, "doctor-version.db");

  try {
    await withEnv(
      {
        AA_BUILD_COMMIT: "local-commit-123",
        AA_BUILD_PROFILE: "dev",
        AA_BUILD_TIMESTAMP: "2026-04-04T18:00:00.000Z",
        AA_FEATURE_FLAGS: "ops58,doctor-versioning",
        AA_ENABLED_EXTENSIONS: "dispatch-observability,stable-evidence",
      },
      async () => {
        await runSingleTaskExecution({
          dbPath,
          title: "Doctor version task",
          request: "Verify version snapshot metadata.",
        });

        const db = new SqliteDatabase(dbPath);
        const store = new AuthoritativeTaskStore(db);
        const workers = new WorkerRegistryService(store);
        const doctor = new DoctorService(
          new HealthService(db, store),
          new StartupConsistencyChecker(db, store),
          new RuntimeRecoveryService(store),
          new StalledExecutionDetector(store),
          new SqliteReliabilityService(db),
          `${dbPath}.backup`,
          null,
          null,
          workers,
        );

        const report = doctor.run();

        assert.equal(report.versionSnapshot.buildCommit, "local-commit-123");
        assert.equal(report.versionSnapshot.buildProfile, "dev");
        assert.equal(report.versionSnapshot.buildTimestamp, "2026-04-04T18:00:00.000Z");
        assert.deepEqual(report.versionSnapshot.featureFlags, ["doctor-versioning", "ops58"]);
        assert.deepEqual(report.versionSnapshot.enabledExtensions, ["dispatch-observability", "stable-evidence"]);
        db.close();
      },
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("doctor service degrades when a running execution becomes stalled", () => {
  const workspace = createTempWorkspace("aa-doctor-");

  try {
    const db = new SqliteDatabase(join(workspace, "doctor-stalled.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const healthService = new HealthService(db, store);
    const stalledDetector = new StalledExecutionDetector(store);
    const diagnostics = new DiagnosticsService(new InspectService(store), healthService, new StructuredLogger());

    seedTaskAndExecution(db, store, {
      taskId: "task-stalled",
      executionId: "exec-stalled",
      traceId: "trace-stalled",
    });

    db.transaction(() => {
      store.insertWorkflowState({
        taskId: "task-stalled",
        divisionId: "general-ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: "2000-01-01T00:00:00.000Z",
        updatedAt: "2000-01-01T00:00:00.000Z",
      });

      db.connection
        .prepare(`UPDATE executions SET updated_at = ? WHERE id = ?`)
        .run("2000-01-01T00:00:00.000Z", "exec-stalled");
      store.upsertAgentExecutionRecord({
        executionId: "exec-stalled",
        taskId: "task-stalled",
        agentId: "agent-1",
        workflowId: "single_agent_minimal",
        roleId: "general_executor",
        runKind: "task_run",
        runtimeInstanceId: "runtime-stalled-1",
        restartedFromRuntimeInstanceId: null,
        restartGeneration: 0,
        status: "executing",
        planJson: "{}",
        currentStepId: "step-stalled",
        lastToolName: "bash.exec",
        toolCallCount: 1,
        lastDecisionJson: null,
        lastErrorCode: null,
        retryCount: 0,
        progressMessage: "waiting",
        startedAt: "2000-01-01T00:00:00.000Z",
        createdAt: "2000-01-01T00:00:00.000Z",
        updatedAt: "2000-01-01T00:00:00.000Z",
        completedAt: null,
      });
    });

    const doctor = new DoctorService(
      healthService,
      new StartupConsistencyChecker(db, store),
      new RuntimeRecoveryService(store),
      stalledDetector,
      new SqliteReliabilityService(db),
      join(workspace, "doctor-stalled.backup.db"),
      null,
      null,
      workers,
      null,
      new StalledExecutionEscalationService(stalledDetector, diagnostics),
    );

    const report = doctor.run();

    assert.equal(report.status, "degraded");
    assert.equal(report.stalledExecutions.length, 1);
    assert.equal(report.stalledExecutions[0]?.executionId, "exec-stalled");
    assert.equal(report.stalledEscalations.length, 1);
    assert.equal(report.stalledEscalations[0]?.executionId, "exec-stalled");
    assert.equal(report.stalledEscalations[0]?.suggestedOperatorAction, "reclaim_lease_and_requeue");
    assert.equal(report.stalledEscalations[0]?.traceId, "trace-stalled");
    assert.equal(report.stalledEscalations[0]?.correlationId, "task-stalled");
    assert.equal(report.stalledEscalations[0]?.currentStepId, "step-stalled");
    assert.equal(report.stalledEscalations[0]?.runtimeInstanceId, "runtime-stalled-1");
    assert.equal(report.stalledEscalations[0]?.warnings.highestSeverity, "info");
    assert.ok((report.stalledEscalations[0]?.incident.candidateRootCauses.length ?? 0) >= 1);
    assert.equal(report.runtimeRecovery.recoverableRuns[0]?.executionId, "exec-stalled");
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("doctor service degrades when workflow terminal state is not reconciled into task and session status", () => {
  const workspace = createTempWorkspace("aa-doctor-terminal-mismatch-");

  try {
    const db = new SqliteDatabase(join(workspace, "doctor-terminal-mismatch.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const healthService = new HealthService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-doctor-terminal-mismatch",
      executionId: "exec-doctor-terminal-mismatch",
      traceId: "trace-doctor-terminal-mismatch",
    });

    db.transaction(() => {
      store.insertWorkflowState({
        taskId: "task-doctor-terminal-mismatch",
        divisionId: "general-ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 1,
        status: "completed",
        outputsJson: "{\"analysis\":{\"status\":\"ok\"}}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: "2026-04-04T18:00:00.000Z",
        updatedAt: "2026-04-04T18:05:00.000Z",
      });
      store.setTaskState({
        taskId: "task-doctor-terminal-mismatch",
        status: "in_progress",
        updatedAt: "2026-04-04T18:05:00.000Z",
        errorCode: null,
        completedAt: null,
      });
      store.updateSessionStatus(
        "sess_task-doctor-terminal-mismatch",
        "streaming",
        "2026-04-04T18:05:00.000Z",
      );
    });

    const doctor = new DoctorService(
      healthService,
      new StartupConsistencyChecker(db, store),
      new RuntimeRecoveryService(store),
      new StalledExecutionDetector(store),
      new SqliteReliabilityService(db),
      `${join(workspace, "doctor-terminal-mismatch.db")}.backup`,
    );

    const report = doctor.run();

    assert.equal(report.status, "degraded");
    assert.equal(report.startupConsistency.status, "repairable");
    assert.ok(report.startupConsistency.findings.some((finding) => finding.code === "workflow_terminal_state_mismatch"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("doctor service degrades when an active execution exceeds a resource ceiling", async () => {
  const workspace = createTempWorkspace("aa-doctor-resource-");
  const dbPath = join(workspace, "doctor-resource.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);

    seedTaskAndExecution(db, store, {
      taskId: "task-resource-limit",
      executionId: "exec-resource-limit",
      traceId: "trace-resource-limit",
    });

    db.connection.prepare(`UPDATE executions SET status = ?, started_at = ?, updated_at = ? WHERE id = ?`).run(
      "executing",
      "2026-04-04T10:00:00.000Z",
      "2026-04-04T10:00:05.000Z",
      "exec-resource-limit",
    );
    store.insertWorkflowState({
      taskId: "task-resource-limit",
      divisionId: "general-ops",
      workflowId: "single_agent_minimal",
      currentStepIndex: 0,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: "2026-04-04T10:00:00.000Z",
      updatedAt: "2026-04-04T10:00:05.000Z",
    });
    store.upsertAgentExecutionRecord({
      executionId: "exec-resource-limit",
      taskId: "task-resource-limit",
      agentId: "worker-resource",
      workflowId: "single_agent_minimal",
      roleId: "general_executor",
      runKind: "task_run",
      runtimeInstanceId: "runtime-resource-1",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      status: "executing",
      planJson: "{}",
      currentStepId: "step-resource",
      lastToolName: "bash.exec",
      toolCallCount: 5,
      lastDecisionJson: null,
      lastErrorCode: null,
      retryCount: 0,
      progressMessage: "still running",
      startedAt: "2026-04-04T10:00:00.000Z",
      createdAt: "2026-04-04T10:00:00.000Z",
      updatedAt: "2026-04-04T10:00:05.000Z",
      completedAt: null,
    });

    const doctor = new DoctorService(
      new HealthService(db, store),
      new StartupConsistencyChecker(db, store),
      new RuntimeRecoveryService(store),
      new StalledExecutionDetector(store),
      new SqliteReliabilityService(db),
      `${dbPath}.backup`,
      null,
      null,
      workers,
      null,
      null,
      new ExecutionResourceMonitor(
        store,
        new ExecutionResourceCeilingGuard({
          maxToolCalls: 2,
          maxMemoryMb: null,
          maxElapsedMs: null,
        }),
      ),
    );

    const report = doctor.run();

    assert.equal(report.status, "degraded");
    assert.equal(report.resourceCeilings.length, 1);
    assert.equal(report.resourceCeilings[0]?.executionId, "exec-resource-limit");
    assert.equal(report.resourceCeilings[0]?.reasonCode, "agent.resource_limit.tool_calls_exceeded");
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("doctor service fail-closes when startup consistency reports invalid tool contracts", async () => {
  const workspace = createTempWorkspace("aa-doctor-tool-contract-");
  const dbPath = join(workspace, "doctor-tool-contract.db");

  try {
    await runSingleTaskExecution({
      dbPath,
      title: "Doctor tool contract task",
      request: "Verify tool contract fail-close.",
    });

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    ackAllEventConsumers(store);
    const workers = new WorkerRegistryService(store);
    const doctor = new DoctorService(
      new HealthService(db, store),
      new StartupConsistencyChecker(db, store, {
        toolMetadataValidator: () => [{
          toolName: "bash",
          code: "mutable_execution_receipt_required",
          message: "State-mutating tool bash must require an execution receipt.",
        }],
      }),
      new RuntimeRecoveryService(store),
      new StalledExecutionDetector(store),
      new SqliteReliabilityService(db),
      `${dbPath}.backup`,
      null,
      null,
      workers,
    );

    const report = doctor.run();

    assert.equal(report.status, "fail_closed");
    assert.ok(report.startupConsistency.findings.some((finding) => finding.code === "tool_contract_invalid"));
    assert.ok(report.startupConsistency.findings.some((finding) => finding.entityType === "tool" && finding.entityId === "bash"));
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("doctor service fail-closes when startup preflight detects missing provider credentials", async () => {
  const workspace = createTempWorkspace("aa-doctor-provider-preflight-");
  const dbPath = join(workspace, "doctor-provider-preflight.db");

  try {
    const { configRoot } = seedProtectedGovernanceTree(workspace);
    await runSingleTaskExecution({
      dbPath,
      title: "Doctor provider preflight task",
      request: "Verify provider readiness fail-close.",
    });

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    ackAllEventConsumers(store);
    const workers = new WorkerRegistryService(store);
    const doctor = new DoctorService(
      new HealthService(db, store),
      new StartupConsistencyChecker(db, store, {
        configValidator: () => ({
          ok: true,
          environment: "test",
          configRoot,
          issues: [],
          bundle: {
            environment: "test",
            configRoot,
            version: {
              versionId: "test",
              bundleHash: "test",
              layerHashes: {},
              generatedAt: new Date().toISOString(),
            },
            layers: {
              providers: {
                defaultProvider: "openai",
              },
            },
            issues: [],
          },
        }),
        providerReadinessProbe: buildEnvironmentProviderReadinessProbe({
          providerEnv: {},
        }),
      }),
      new RuntimeRecoveryService(store),
      new StalledExecutionDetector(store),
      new SqliteReliabilityService(db),
      `${dbPath}.backup`,
      null,
      null,
      workers,
    );

    const report = doctor.run();

    assert.equal(report.status, "fail_closed");
    assert.ok(report.startupConsistency.findings.some((finding) => finding.code === "provider_not_ready"));
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("doctor service fail-closes when the sqlite schema ledger is not current", async () => {
  const workspace = createTempWorkspace("aa-doctor-schema-");
  const dbPath = join(workspace, "doctor-schema.db");

  try {
    await runSingleTaskExecution({
      dbPath,
      title: "Doctor schema task",
      request: "Verify schema freshness guard.",
    });

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    ackAllEventConsumers(store);
    const workers = new WorkerRegistryService(store);
    db.connection.prepare(`DELETE FROM schema_migrations WHERE version = ?`).run(1);

    const doctor = new DoctorService(
      new HealthService(db, store),
      new StartupConsistencyChecker(db, store),
      new RuntimeRecoveryService(store),
      new StalledExecutionDetector(store),
      new SqliteReliabilityService(db),
      `${dbPath}.backup`,
      null,
      null,
      workers,
    );

    const report = doctor.run();

    assert.equal(report.status, "fail_closed");
    assert.equal(report.sqliteReliability.schemaStatus.upToDate, false);
    assert.deepEqual(report.sqliteReliability.schemaStatus.pendingVersions, [1]);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("doctor service summarizes worker telemetry and stale heartbeat inventory", () => {
  const workspace = createTempWorkspace("aa-doctor-workers-");
  const dbPath = join(workspace, "doctor-workers.db");
  const now = Date.now();
  const busyAt = new Date(now - 60 * 1000).toISOString();
  const staleAt = new Date(now - 10 * 60 * 1000).toISOString();

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);

    workers.recordHeartbeat({
      workerId: "worker-busy",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-a"],
      maxConcurrency: 2,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-busy-1",
      cpuPct: 63,
      memoryMb: 512,
      toolBacklogCount: 5,
      currentStepId: "step-busy",
      lastProgressAt: busyAt,
      occurredAt: busyAt,
    });
    workers.recordHeartbeat({
      workerId: "worker-stale",
      status: "degraded",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "research",
      runtimeInstanceId: "runtime-stale-2",
      restartedFromRuntimeInstanceId: "runtime-stale-1",
      cpuPct: 10,
      memoryMb: 64,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: staleAt,
      occurredAt: staleAt,
    });
    workers.recordHeartbeat({
      workerId: "worker-offline",
      status: "offline",
      placement: "remote",
      remoteSessionStatus: "failed",
      lastAcknowledgedStreamOffset: "stream:90",
      streamResumeSuccessRate: 0.5,
      credentialRefreshSuccessRate: 0.8,
      sessionConsistencyCheckStatus: "mismatch",
      sessionConsistencyCheckedAt: staleAt,
      activeLeaseCount: 0,
      meanStartupLatencyMs: 1200,
      sandboxSuccessRate: 0.85,
      repoCacheHitRate: 0.4,
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "remote",
      runtimeInstanceId: "runtime-offline-1",
      occurredAt: staleAt,
    });
    workers.recordHeartbeat({
      workerId: "worker-quarantined",
      status: "quarantined",
      placement: "remote",
      remoteSessionStatus: "viewer_only",
      lastAcknowledgedStreamOffset: "stream:91",
      streamResumeSuccessRate: 0.95,
      credentialRefreshSuccessRate: 0.96,
      sessionConsistencyCheckStatus: "passed",
      sessionConsistencyCheckedAt: busyAt,
      activeLeaseCount: 0,
      meanStartupLatencyMs: 350,
      sandboxSuccessRate: 0.99,
      repoCacheHitRate: 0.93,
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "remote",
      runtimeInstanceId: "runtime-quarantine-1",
      occurredAt: busyAt,
    });

    const doctor = new DoctorService(
      new HealthService(db, store),
      new StartupConsistencyChecker(db, store),
      new RuntimeRecoveryService(store),
      new StalledExecutionDetector(store),
      new SqliteReliabilityService(db),
      `${dbPath}.backup`,
      null,
      null,
      workers,
    );

    const report = doctor.run();

    assert.equal(report.workerSummary.totalWorkers, 4);
    assert.equal(report.workerSummary.healthyWorkers, 1);
    assert.equal(report.workerSummary.busyWorkers, 1);
    assert.equal(report.workerSummary.degradedWorkers, 1);
    assert.equal(report.workerSummary.offlineWorkers, 1);
    assert.equal(report.workerSummary.quarantinedWorkers, 1);
    assert.equal(report.workerSummary.remoteWorkers, 2);
    assert.equal(report.workerSummary.remoteReconnectingWorkers, 0);
    assert.equal(report.workerSummary.remoteDegradedSessions, 0);
    assert.equal(report.workerSummary.remoteFailedSessions, 1);
    assert.equal(report.workerSummary.remoteViewerOnlyWorkers, 1);
    assert.equal(report.workerSummary.remoteConsistencyMismatchWorkers, 1);
    assert.equal(report.workerSummary.remoteOffsetMissingWorkers, 0);
    assert.equal(report.workerSummary.loadSkewDetected, false);
    assert.ok(report.workerSummary.staleWorkerIds.includes("worker-stale"));
    assert.equal(report.workerSummary.workers[0]?.workerId, "worker-busy");
    assert.equal(report.workerSummary.workers[0]?.schedulingStatus, "healthy");
    assert.equal(report.workerSummary.workers[1]?.schedulingStatus, "offline");
    assert.equal(report.workerSummary.workers[3]?.runtimeInstanceId, "runtime-stale-2");
    assert.equal(report.workerSummary.workers[3]?.restartedFromRuntimeInstanceId, "runtime-stale-1");
    assert.equal(report.workerSummary.workers[3]?.restartGeneration, 0);
    assert.equal(report.workerSummary.workers[0]?.toolBacklogCount, 5);
    assert.equal(report.workerSummary.workers[0]?.currentStepId, "step-busy");
    assert.equal(report.workerSummary.workers[1]?.placement, "remote");
    assert.equal(report.workerSummary.workers[1]?.remoteSessionStatus, "failed");
    assert.equal(report.workerSummary.workers[1]?.sessionConsistencyCheckStatus, "mismatch");
    assert.equal(report.workerSummary.workers[1]?.repoCacheHitRate, 0.4);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("doctor service surfaces sticky load skew when one worker dominates active leases despite spare healthy capacity", async () => {
  const workspace = createTempWorkspace("aa-doctor-workers-");
  const dbPath = join(workspace, "doctor-workers-load-skew.db");
  const nowIso = new Date().toISOString();

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);

    workers.recordHeartbeat({
      workerId: "worker-hotspot",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-hotspot"],
      maxConcurrency: 4,
      queueAffinity: "default",
      activeLeaseCount: 3,
      saturation: 0.95,
      cpuPct: 80,
      toolBacklogCount: 4,
      currentStepId: "draft_solution",
      lastProgressAt: nowIso,
      occurredAt: nowIso,
    });
    workers.recordHeartbeat({
      workerId: "worker-spare",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: null,
      activeLeaseCount: 0,
      saturation: 0.05,
      cpuPct: 11,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: nowIso,
      occurredAt: nowIso,
    });

    const doctor = new DoctorService(
      new HealthService(db, store),
      new StartupConsistencyChecker(db, store),
      new RuntimeRecoveryService(store),
      new StalledExecutionDetector(store),
      new SqliteReliabilityService(db),
      `${dbPath}.backup`,
      null,
      null,
      workers,
    );

    const report = doctor.run();

    assert.equal(report.status, "ok");
    assert.equal(report.workerSummary.loadSkewDetected, true);
    assert.equal(report.workerSummary.dominantWorkerId, "worker-hotspot");
    assert.ok((report.workerSummary.dominantWorkerShare ?? 0) > 0.6);
    assert.deepEqual(report.workerSummary.skewedWorkerIds, ["worker-hotspot"]);
    assert.equal(report.checks.find((check) => check.checkId === "workers")?.status, "degraded");
    assert.ok(report.checks.find((check) => check.checkId === "workers")?.findings.includes("worker_load_skew_detected"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("doctor service degrades when protected governance drift is detected", async () => {
  const workspace = createTempWorkspace("aa-doctor-governance-");
  const dbPath = join(workspace, "doctor-governance.db");
  const previousExpectedVersion = process.env.AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION;

  try {
    const paths = seedProtectedGovernanceTree(workspace);
    await runSingleTaskExecution({
      dbPath,
      title: "Doctor governance task",
      request: "Verify governance drift detection.",
    });

    const integrityService = new ProtectedGovernanceIntegrityService({
      ...paths,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
    });
    process.env.AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION = integrityService.captureSnapshot().versionId;
    createFile(paths.agentsPath, "# Repository Guidelines\n\n## Security\n- drift detected\n");

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    ackAllEventConsumers(store);
    const workers = new WorkerRegistryService(store);
    const doctor = new DoctorService(
      new HealthService(db, store),
      new StartupConsistencyChecker(db, store),
      new RuntimeRecoveryService(store),
      new StalledExecutionDetector(store),
      new SqliteReliabilityService(db),
      `${dbPath}.backup`,
      integrityService,
      null,
      workers,
    );

    const report = doctor.run();

    assert.equal(report.status, "degraded");
    assert.equal(report.protectedGovernance.checked, true);
    assert.equal(report.protectedGovernance.tampered, true);
    assert.ok(report.protectedGovernance.issues.includes("protected.version_mismatch"));
    db.close();
  } finally {
    if (previousExpectedVersion === undefined) {
      delete process.env.AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION;
    } else {
      process.env.AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION = previousExpectedVersion;
    }
    cleanupPath(workspace);
  }
});

test("doctor service degrades when managed storage remains over quota", async () => {
  const workspace = createTempWorkspace("aa-doctor-storage-");
  const dbPath = join(workspace, "doctor-storage.db");

  try {
    await runSingleTaskExecution({
      dbPath,
      title: "Doctor storage task",
      request: "Verify storage quota detection.",
    });
    createFile(join(workspace, "artifacts", "task-1", "artifact-1", "pinned.txt"), "x".repeat(120));

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    ackAllEventConsumers(store);
    const workers = new WorkerRegistryService(store);
    const storageQuota = new StorageQuotaService({
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      categories: [
        {
          categoryId: "artifact",
          roots: [join(workspace, "artifacts")],
          maxBytes: 64,
          cleanupEnabled: true,
          pinnedPaths: [join(workspace, "artifacts", "task-1", "artifact-1", "pinned.txt")],
        },
      ],
    });
    const doctor = new DoctorService(
      new HealthService(db, store),
      new StartupConsistencyChecker(db, store),
      new RuntimeRecoveryService(store),
      new StalledExecutionDetector(store),
      new SqliteReliabilityService(db),
      `${dbPath}.backup`,
      null,
      storageQuota,
      workers,
    );

    const report = doctor.run();

    assert.equal(report.status, "degraded");
    assert.equal(report.storageQuota?.categories.length, 1);
    assert.equal(report.storageQuota?.categories[0]?.categoryId, "artifact");
    assert.equal(report.storageQuota?.categories[0]?.overQuota, true);
    assert.equal(report.storageQuota?.categories[0]?.pinnedFileCount, 1);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("doctor service reports observability retention backlog without deleting protected summaries", () => {
  const workspace = createTempWorkspace("aa-doctor-retention-");
  const dbPath = join(workspace, "doctor-retention.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);

    seedTaskAndExecution(db, store, {
      taskId: "task-doctor-retention",
      executionId: "exec-doctor-retention",
      traceId: "trace-doctor-retention",
    });
    db.connection.prepare(`UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?`).run(
      "done",
      "2026-01-01T00:00:00.000Z",
      "task-doctor-retention",
    );
    store.insertSession({
      id: "sess-doctor-retention",
      taskId: "task-doctor-retention",
      channel: "cli",
      status: "completed",
      externalSessionId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    store.insertMessage({
      id: "msg-doctor-retention-old",
      sessionId: "sess-doctor-retention",
      direction: "system",
      messageType: "tool_result",
      content: "stale message",
      partsJson: null,
      attachmentsJson: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    store.insertMessage({
      id: "msg-doctor-retention-summary",
      sessionId: "sess-doctor-retention",
      direction: "system",
      messageType: "summary",
      content: "retained summary",
      partsJson: null,
      attachmentsJson: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    store.insertEvent({
      id: "evt-doctor-retention-tier2",
      taskId: "task-doctor-retention",
      executionId: "exec-doctor-retention",
      eventType: "dispatch:decision_recorded",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({ reason: "retention" }),
      traceId: "trace-doctor-retention",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const doctor = new DoctorService(
      new HealthService(db, store),
      new StartupConsistencyChecker(db, store),
      new RuntimeRecoveryService(store),
      new StalledExecutionDetector(store),
      new SqliteReliabilityService(db),
      `${dbPath}.backup`,
      null,
      null,
      workers,
      new ObservabilityRetentionService(db, {
        eventRetentionDays: { tier2: 14, tier3: 3 },
        terminalMessageRetentionDays: 30,
      }),
    );

    const report = doctor.run();

    assert.equal(report.observabilityRetention?.events.tier_2.eligibleCount, 1);
    assert.equal(report.observabilityRetention?.messages.eligibleCount, 1);
    assert.equal(report.observabilityRetention?.messages.preservedSummaryCount, 1);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
