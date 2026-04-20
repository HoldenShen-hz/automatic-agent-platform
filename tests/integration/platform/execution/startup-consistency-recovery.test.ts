import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { ExecutionDispatchService } from "../../../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import { ExecutionLeaseService } from "../../../../src/platform/execution/lease/execution-lease-service.js";
import { ExecutionWorkerHandshakeService } from "../../../../src/platform/execution/worker-pool/execution-worker-handshake-service.js";
import { runSingleTaskExecution } from "../../../../src/platform/execution/execution-engine/single-task-execution.js";
import {
  buildDefaultStartupConfigValidator,
  buildEnvironmentProviderReadinessProbe,
} from "../../../../src/platform/execution/startup/startup-preflight.js";
import { RuntimeRepairService } from "../../../../src/platform/execution/recovery/runtime-repair-service-root.js";
import { StartupConsistencyChecker } from "../../../../src/platform/execution/startup/startup-consistency-checker.js";
import { createWorkspaceWritePolicy } from "../../../../src/platform/control-plane/iam/sandbox-policy.js";
import { WorkerRegistryService } from "../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import type { ToolContractViolation } from "../../../../src/platform/execution/tool-executor/tool-contract-validator.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

function seedStartupConfigTree(root: string, overrides: Record<string, string> = {}): void {
  const files: Record<string, string> = {
    "bootstrap/default.json": JSON.stringify({ appName: "aa", phase: "phase_2a", stableCoreEnabled: true }, null, 2),
    "gateways/default.json": JSON.stringify({ defaultGateway: "cli", sseEnabled: true }, null, 2),
    "providers/default.json": JSON.stringify({ defaultProvider: "openai", defaultModelProfile: "reasoning-medium" }, null, 2),
    "providers/models.json": JSON.stringify({
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
    }, null, 2),
    "runtime/default.json": JSON.stringify({ maxConcurrentTasks: 2, defaultTaskTimeoutMs: 300000, defaultStepTimeoutMs: 120000 }, null, 2),
    "security/default.json": JSON.stringify({
      approvalMode: "supervised",
      sandboxMode: "workspace_write",
      allowDestructiveActions: false,
      remoteWorkerRegistration: {
        challengeTtlMs: 300000,
        allowedCapabilities: ["bash", "edit", "mcp"],
      },
    }, null, 2),
    "workflows/default.json": JSON.stringify({ defaultWorkflowId: "single_agent_minimal", allowCrossDivisionDag: false }, null, 2),
    ...overrides,
  };

  for (const [relativePath, content] of Object.entries(files)) {
    createFile(join(root, relativePath), content);
  }
}

test("startup consistency checker passes for a clean single-task task", async () => {
  const workspace = createTempWorkspace("aa-recovery-pass-");

  try {
    const dbPath = join(workspace, "single-task.db");
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Recovery baseline",
      request: "verify startup checker",
    });

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);

    for (const event of snapshot.events) {
      store.markEventAck({
        eventId: event.id,
        consumerId: "inspect_projection",
        status: "acked",
        occurredAt: nowIso(),
      });
    }

    const checker = new StartupConsistencyChecker(db, store);
    const report = checker.run({
      now: new Date(Date.parse(snapshot.task.updatedAt) + 1_000).toISOString(),
      staleExecutionAfterMs: 60_000,
      pendingAckOlderThanMs: 60_000,
    });

    assert.equal(report.status, "pass");
    assert.equal(report.findings.length, 0);
    assert.equal(report.repairActions.length, 0);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("startup consistency checker fail-closes on active task and workflow ownership conflicts", () => {
  const workspace = createTempWorkspace("aa-recovery-p0-");

  try {
    const db = new SqliteDatabase(join(workspace, "p0.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const now = nowIso();

    store.insertTask({
      id: "task-missing-workflow",
      parentId: null,
      rootId: "task-missing-workflow",
      divisionId: "general_ops",
      title: "Missing workflow",
      status: "in_progress",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });

    seedTaskAndExecution(db, store, {
      taskId: "task-conflict",
      executionId: "exec-conflict-1",
      traceId: "trace-conflict",
    });

    store.insertExecution({
      id: "exec-conflict-2",
      taskId: "task-conflict",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-2",
      roleId: "general_executor",
      runKind: "task_run",
      status: "prechecking",
      inputRef: null,
      traceId: "trace-conflict",
      attempt: 2,
      timeoutMs: 1000,
      budgetUsdLimit: 1,
      requiresApproval: 0,
      sandboxMode: "workspace_write",
      allowedToolsJson: "[]",
      allowedPathsJson: "[]",
      maxRetries: 0,
      retryBackoff: "none",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    store.insertTask({
      id: "task-invalid-step",
      parentId: null,
      rootId: "task-invalid-step",
      divisionId: "general_ops",
      title: "Invalid step index",
      status: "in_progress",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });

    store.insertWorkflowState({
      taskId: "task-invalid-step",
      divisionId: "general_ops",
      workflowId: "single_agent_minimal",
      currentStepIndex: 9,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    store.insertEvent({
      id: "evt-unregistered",
      taskId: "task-conflict",
      executionId: "exec-conflict-1",
      eventType: "custom:unknown_tier1",
      eventTier: "tier_1",
      payloadJson: "{}",
      traceId: "trace-conflict",
      createdAt: now,
    });

    const checker = new StartupConsistencyChecker(db, store);
    const report = checker.run({ now });

    assert.equal(report.status, "fail_closed");
    assert.ok(report.findings.some((finding) => finding.code === "active_task_missing_workflow"));
    assert.ok(report.findings.some((finding) => finding.code === "active_execution_conflict"));
    assert.ok(report.findings.some((finding) => finding.code === "invalid_step_index"));
    assert.ok(report.findings.some((finding) => finding.code === "event_schema_missing"));
    assert.ok(report.repairActions.every((action) => action.action === "manual_intervention_required"));
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("startup consistency checker produces repair actions for recoverable Week 3 scenarios", () => {
  const workspace = createTempWorkspace("aa-recovery-p1-");

  try {
    const db = new SqliteDatabase(join(workspace, "p1.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const leases = new ExecutionLeaseService(db, store);

    const staleAt = "2026-04-03T10:00:00.000Z";
    const now = "2026-04-03T10:10:00.000Z";

    seedTaskAndExecution(db, store, {
      taskId: "task-stale",
      executionId: "exec-stale",
      traceId: "trace-stale",
    });

    db.transaction(() => {
      store.insertWorkflowState({
        taskId: "task-stale",
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: staleAt,
        updatedAt: staleAt,
      });

      db.connection
        .prepare(`UPDATE executions SET updated_at = ? WHERE id = ?`)
        .run(staleAt, "exec-stale");

      store.insertTask({
        id: "task-orphan-session",
        parentId: null,
        rootId: "task-orphan-session",
        divisionId: "general_ops",
        title: "Orphan session",
        status: "done",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: "{}",
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: staleAt,
        updatedAt: staleAt,
        completedAt: staleAt,
      });

      db.connection
        .prepare(
          `INSERT INTO sessions (id, task_id, channel, status, external_session_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("sess-orphan", "task-orphan-session", "cli", "open", null, staleAt, staleAt);

      store.insertFileLock({
        id: "lock-stale",
        taskId: "task-stale",
        executionId: "exec-stale",
        lockScope: "workspace_path",
        resourcePath: "/tmp/demo.txt",
        lockMode: "write",
        ownerId: "exec-stale",
        expiresAt: "2026-04-03T10:01:00.000Z",
        createdAt: staleAt,
        updatedAt: staleAt,
      });

      store.createTier1StatusEvent({
        taskId: "task-stale",
        executionId: "exec-stale",
        eventType: "task:status_changed",
        traceId: "trace-stale",
        payload: { status: "in_progress" },
      });

      db.connection
        .prepare(`UPDATE events SET created_at = ? WHERE execution_id = ?`)
        .run(staleAt, "exec-stale");
    });

    workers.recordHeartbeat({
      workerId: "worker-recovery-p1",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-03T10:09:00.000Z",
    });
    const orphanTicket = dispatch.createTicket({
      executionId: "exec-stale",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-03T10:09:05.000Z",
    });
    const orphanClaim = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-03T10:09:06.000Z",
    });
    leases.releaseLease({
      leaseId: orphanClaim.leaseId ?? "",
      workerId: "worker-recovery-p1",
      reasonCode: "test.seed",
      occurredAt: "2026-04-03T10:09:07.000Z",
    });

    seedTaskAndExecution(db, store, {
      taskId: "task-terminal-ticket",
      executionId: "exec-terminal-ticket",
      traceId: "trace-terminal-ticket",
    });
    store.insertWorkflowState({
      taskId: "task-terminal-ticket",
      divisionId: "general_ops",
      workflowId: "single_agent_minimal",
      currentStepIndex: 0,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: "2026-04-03T10:09:10.000Z",
      updatedAt: "2026-04-03T10:09:10.000Z",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-terminal-ticket");
    const terminalTicket = dispatch.createTicket({
      executionId: "exec-terminal-ticket",
      queueName: "default",
      occurredAt: "2026-04-03T10:09:10.000Z",
    });
    store.updateExecutionStatus(
      "exec-terminal-ticket",
      "succeeded",
      "2026-04-03T10:09:11.000Z",
      null,
      "2026-04-03T10:09:11.000Z",
      null,
    );

    const checker = new StartupConsistencyChecker(db, store);
    const report = checker.run({
      now,
      staleExecutionAfterMs: 60_000,
      pendingAckOlderThanMs: 60_000,
    });

    assert.equal(report.status, "repairable");
    assert.ok(report.findings.some((finding) => finding.code === "stale_execution"));
    assert.ok(report.findings.some((finding) => finding.code === "orphan_session"));
    assert.ok(report.findings.some((finding) => finding.code === "expired_file_lock"));
    assert.ok(report.findings.some((finding) => finding.code === "tier1_ack_backlog"));
    assert.ok(report.findings.some((finding) => finding.code === "orphan_queue_claim" && finding.entityId === orphanTicket.ticket.id));
    assert.ok(
      report.findings.some((finding) => finding.code === "terminal_execution_ticket" && finding.entityId === terminalTicket.ticket.id),
    );
    assert.ok(report.repairActions.some((action) => action.action === "requeue_execution"));
    assert.ok(report.repairActions.some((action) => action.action === "close_orphan_session"));
    assert.ok(report.repairActions.some((action) => action.action === "release_stale_lock"));
    assert.ok(report.repairActions.some((action) => action.action === "rebuild_ack"));
    assert.ok(report.repairActions.some((action) => action.action === "reconcile_dispatch_ticket"));
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("startup consistency checker marks workflow terminal mismatches as repairable", () => {
  const workspace = createTempWorkspace("aa-recovery-terminal-mismatch-");

  try {
    const db = new SqliteDatabase(join(workspace, "terminal-mismatch.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const staleAt = "2026-04-03T10:00:00.000Z";

    seedTaskAndExecution(db, store, {
      taskId: "task-terminal-mismatch",
      executionId: "exec-terminal-mismatch",
      traceId: "trace-terminal-mismatch",
    });

    db.transaction(() => {
      store.insertSession({
        id: "sess-task-terminal-mismatch",
        taskId: "task-terminal-mismatch",
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: staleAt,
        updatedAt: staleAt,
      });
      store.insertWorkflowState({
        taskId: "task-terminal-mismatch",
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 1,
        status: "completed",
        outputsJson: "{\"analysis\":{\"status\":\"ok\"}}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: staleAt,
        updatedAt: staleAt,
      });
      store.setTaskState({
        taskId: "task-terminal-mismatch",
        status: "in_progress",
        updatedAt: staleAt,
        errorCode: null,
        completedAt: null,
      });
      store.updateSessionStatus("sess-task-terminal-mismatch", "streaming", staleAt);
    });

    const checker = new StartupConsistencyChecker(db, store);
    const report = checker.run({ now: "2026-04-03T10:10:00.000Z" });

    assert.equal(report.status, "repairable");
    assert.ok(report.findings.some((finding) => finding.code === "workflow_terminal_state_mismatch"));
    assert.ok(report.repairActions.some((action) => action.action === "reconcile_terminal_state"));
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("startup consistency checker flags active tasks whose latest session is already terminal", () => {
  const workspace = createTempWorkspace("aa-recovery-terminal-session-");

  try {
    const db = new SqliteDatabase(join(workspace, "terminal-session.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const staleAt = "2026-04-03T10:00:00.000Z";

    seedTaskAndExecution(db, store, {
      taskId: "task-terminal-session",
      executionId: "exec-terminal-session",
      traceId: "trace-terminal-session",
    });

    db.transaction(() => {
      store.insertSession({
        id: "sess-terminal-session",
        taskId: "task-terminal-session",
        channel: "cli",
        status: "failed",
        externalSessionId: null,
        createdAt: staleAt,
        updatedAt: staleAt,
      });
      store.setTaskState({
        taskId: "task-terminal-session",
        status: "pending",
        updatedAt: staleAt,
        errorCode: null,
        completedAt: null,
      });
    });

    const checker = new StartupConsistencyChecker(db, store);
    const report = checker.run({ now: "2026-04-03T10:10:00.000Z" });

    assert.equal(report.status, "repairable");
    assert.ok(report.findings.some((finding) => finding.code === "active_task_terminal_session"));
    assert.ok(report.repairActions.some((action) => action.action === "replace_terminal_session"));
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("startup consistency checker fail-closes when builtin tool metadata violates the contract", () => {
  const workspace = createTempWorkspace("aa-recovery-tool-contract-");

  try {
    const db = new SqliteDatabase(join(workspace, "tool-contract.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const checker = new StartupConsistencyChecker(db, store, {
      toolMetadataValidator: () =>
        [{
          toolName: "command_exec",
          code: "default_timeout_invalid",
          message: "Tool command_exec must declare a positive default timeout.",
        } satisfies ToolContractViolation],
    });
    const report = checker.run({ now: nowIso() });

    assert.equal(report.status, "fail_closed");
    assert.ok(report.findings.some((finding) => finding.code === "tool_contract_invalid"));
    assert.ok(report.findings.some((finding) => finding.entityType === "tool" && finding.entityId === "command_exec"));
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("startup consistency checker fail-closes when required migration ledger entries are missing", () => {
  const workspace = createTempWorkspace("aa-recovery-schema-");

  try {
    const db = new SqliteDatabase(join(workspace, "schema-lag.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    db.connection.prepare(`DELETE FROM schema_migrations WHERE version = ?`).run(1);

    const checker = new StartupConsistencyChecker(db, store);
    const report = checker.run({ now: nowIso() });

    assert.equal(report.status, "fail_closed");
    assert.ok(report.findings.some((finding) => finding.code === "schema_outdated"));
    assert.ok(report.repairActions.every((action) => action.action === "manual_intervention_required"));
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("startup consistency checker fail-closes when startup config validation fails", () => {
  const workspace = createTempWorkspace("aa-recovery-config-invalid-");
  const configRoot = join(workspace, "config");

  try {
    seedStartupConfigTree(configRoot, {
      "runtime/default.json": JSON.stringify({ maxConcurrentTasks: 0, defaultTaskTimeoutMs: 300000, defaultStepTimeoutMs: 120000 }, null, 2),
    });
    const db = new SqliteDatabase(join(workspace, "config-invalid.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const checker = new StartupConsistencyChecker(db, store, {
      configValidator: buildDefaultStartupConfigValidator({
        configRoot,
        sandboxPolicy: createWorkspaceWritePolicy(configRoot),
      }),
    });
    const report = checker.run({ now: nowIso() });

    assert.equal(report.status, "fail_closed");
    assert.ok(report.findings.some((finding) => finding.code === "config_invalid"));
    assert.ok(report.findings.some((finding) => finding.message === "config.invalid_runtime.maxConcurrentTasks"));
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("startup consistency checker fail-closes when default provider credentials are missing", () => {
  const workspace = createTempWorkspace("aa-recovery-provider-preflight-");
  const configRoot = join(workspace, "config");

  try {
    seedStartupConfigTree(configRoot);
    const db = new SqliteDatabase(join(workspace, "provider-preflight.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const checker = new StartupConsistencyChecker(db, store, {
      configValidator: buildDefaultStartupConfigValidator({
        configRoot,
        sandboxPolicy: createWorkspaceWritePolicy(configRoot),
      }),
      providerReadinessProbe: buildEnvironmentProviderReadinessProbe({
        providerEnv: {},
      }),
    });
    const report = checker.run({ now: nowIso() });

    assert.equal(report.status, "fail_closed");
    assert.ok(report.findings.some((finding) => finding.code === "provider_not_ready"));
    assert.ok(report.findings.some((finding) => finding.entityType === "provider" && finding.entityId === "openai"));
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("runtime repair service applies recoverable startup actions and clears the report", async () => {
  const workspace = createTempWorkspace("aa-recovery-repair-");

  try {
    const db = new SqliteDatabase(join(workspace, "repair.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const leases = new ExecutionLeaseService(db, store);

    const staleAt = "2026-04-03T10:00:00.000Z";
    const now = "2026-04-03T10:10:00.000Z";

    seedTaskAndExecution(db, store, {
      taskId: "task-repair",
      executionId: "exec-repair",
      traceId: "trace-repair",
    });

    db.transaction(() => {
      store.insertWorkflowState({
        taskId: "task-repair",
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: staleAt,
        updatedAt: staleAt,
      });

      db.connection.prepare(`UPDATE executions SET updated_at = ? WHERE id = ?`).run(staleAt, "exec-repair");
      store.createTier1StatusEvent({
        taskId: "task-repair",
        executionId: "exec-repair",
        eventType: "task:status_changed",
        traceId: "trace-repair",
        payload: { status: "in_progress" },
      });
      db.connection.prepare(`UPDATE events SET created_at = ? WHERE execution_id = ?`).run(staleAt, "exec-repair");
      db.connection
        .prepare(`DELETE FROM event_consumer_acks WHERE consumer_id = ? AND event_id IN (SELECT id FROM events WHERE execution_id = ?)`)
        .run("inspect_projection", "exec-repair");

      store.insertTask({
        id: "task-repair-orphan",
        parentId: null,
        rootId: "task-repair-orphan",
        divisionId: "general_ops",
        title: "Repair orphan session",
        status: "done",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: "{}",
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: staleAt,
        updatedAt: staleAt,
        completedAt: staleAt,
      });
      db.connection
        .prepare(
          `INSERT INTO sessions (id, task_id, channel, status, external_session_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("sess-repair-orphan", "task-repair-orphan", "cli", "open", null, staleAt, staleAt);
      store.insertFileLock({
        id: "lock-repair",
        taskId: "task-repair",
        executionId: "exec-repair",
        lockScope: "workspace_path",
        resourcePath: "/tmp/repair.txt",
        lockMode: "write",
        ownerId: "exec-repair",
        expiresAt: "2026-04-03T10:01:00.000Z",
        createdAt: staleAt,
        updatedAt: staleAt,
      });
    });

    workers.recordHeartbeat({
      workerId: "worker-repair",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-03T10:09:00.000Z",
    });
    const orphanTicket = dispatch.createTicket({
      executionId: "exec-repair",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-03T10:09:05.000Z",
    });
    const orphanClaim = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-03T10:09:06.000Z",
    });
    leases.releaseLease({
      leaseId: orphanClaim.leaseId ?? "",
      workerId: "worker-repair",
      reasonCode: "test.seed",
      occurredAt: "2026-04-03T10:09:07.000Z",
    });

    const checker = new StartupConsistencyChecker(db, store);
    const before = checker.run({
      now,
      staleExecutionAfterMs: 60_000,
      pendingAckOlderThanMs: 60_000,
    });
    const repair = new RuntimeRepairService(db, store);
    const applied = await repair.apply(before);
    const after = checker.run({
      now,
      staleExecutionAfterMs: 60_000,
      pendingAckOlderThanMs: 60_000,
    });
    const tickets = store.listExecutionTicketsByExecution("exec-repair");
    const originalTicket = tickets.find((ticket) => ticket.id === orphanTicket.ticket.id) ?? null;
    const replacementTicket = tickets.find((ticket) => ticket.id !== orphanTicket.ticket.id && ticket.status === "pending") ?? null;

    assert.equal(before.status, "repairable");
    assert.ok(before.repairActions.some((action) => action.action === "reconcile_dispatch_ticket"));
    assert.ok(applied.some((result) => result.action === "requeue_execution" && result.applied));
    assert.ok(applied.some((result) => result.action === "close_orphan_session" && result.applied));
    assert.ok(applied.some((result) => result.action === "release_stale_lock" && result.applied));
    assert.ok(applied.some((result) => result.action === "rebuild_ack" && result.applied));
    assert.equal(after.status, "pass");
    assert.equal(tickets.length, 2);
    assert.equal(originalTicket?.status, "expired");
    assert.equal(replacementTicket?.status, "pending");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("runtime repair service reconciles task and session terminal state from a completed workflow", async () => {
  const workspace = createTempWorkspace("aa-recovery-terminal-repair-");

  try {
    const db = new SqliteDatabase(join(workspace, "terminal-repair.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const staleAt = "2026-04-03T10:00:00.000Z";
    const now = "2026-04-03T10:10:00.000Z";

    seedTaskAndExecution(db, store, {
      taskId: "task-terminal-repair",
      executionId: "exec-terminal-repair",
      traceId: "trace-terminal-repair",
    });

    db.transaction(() => {
      store.insertSession({
        id: "sess-task-terminal-repair",
        taskId: "task-terminal-repair",
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: staleAt,
        updatedAt: staleAt,
      });
      store.insertWorkflowState({
        taskId: "task-terminal-repair",
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 1,
        status: "completed",
        outputsJson: "{\"analysis\":{\"status\":\"ok\"}}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: staleAt,
        updatedAt: staleAt,
      });
      store.setTaskState({
        taskId: "task-terminal-repair",
        status: "in_progress",
        updatedAt: staleAt,
        errorCode: null,
        completedAt: null,
      });
      store.updateSessionStatus("sess-task-terminal-repair", "streaming", staleAt);
    });

    const checker = new StartupConsistencyChecker(db, store);
    const before = checker.run({ now });
    const repair = new RuntimeRepairService(db, store);
    const applied = await repair.apply(before);
    const after = checker.run({ now });
    const snapshot = store.loadTaskSnapshot("task-terminal-repair");
    const repairEvents = store
      .listEventsForTask("task-terminal-repair")
      .filter((event) => event.eventType === "recovery:repair_applied");

    assert.equal(before.status, "repairable");
    assert.ok(before.findings.some((finding) => finding.code === "workflow_terminal_state_mismatch"));
    assert.ok(applied.some((result) => result.action === "reconcile_terminal_state" && result.applied));
    assert.equal(after.status, "pass");
    assert.equal(snapshot.task.status, "done");
    assert.equal(snapshot.task.completedAt != null, true);
    assert.equal(snapshot.session?.status, "completed");
    assert.ok(repairEvents.length >= 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("runtime repair service reclaims stale execution ownership and recreates a pending ticket for redispatch", async () => {
  const workspace = createTempWorkspace("aa-recovery-ownership-");

  try {
    const db = new SqliteDatabase(join(workspace, "ownership-recovery.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const handshake = new ExecutionWorkerHandshakeService(db, store);

    const staleAt = "2026-04-03T10:00:00.000Z";
    const now = "2026-04-03T10:10:00.000Z";

    seedTaskAndExecution(db, store, {
      taskId: "task-ownership-recovery",
      executionId: "exec-ownership-recovery",
      traceId: "trace-ownership-recovery",
    });

    db.transaction(() => {
      store.insertWorkflowState({
        taskId: "task-ownership-recovery",
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: staleAt,
        updatedAt: staleAt,
      });
      store.insertSession({
        id: "sess-ownership-recovery",
        taskId: "task-ownership-recovery",
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: staleAt,
        updatedAt: staleAt,
      });
      store.updateExecutionStatus(
        "exec-ownership-recovery",
        "created",
        staleAt,
        staleAt,
        null,
        null,
      );
    });

    workers.recordHeartbeat({
      workerId: "worker-ownership-recovery",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: staleAt,
    });

    const created = dispatch.createTicket({
      executionId: "exec-ownership-recovery",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-03T10:00:05.000Z",
    });
    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-03T10:00:06.000Z",
    });
    const claimed = handshake.claimExecution({
      ticketId: created.ticket.id,
      workerId: "worker-ownership-recovery",
      leaseId: dispatched.leaseId ?? "",
      fencingToken: 1,
      occurredAt: "2026-04-03T10:00:07.000Z",
    });

    const checker = new StartupConsistencyChecker(db, store);
    const before = checker.run({
      now,
      staleExecutionAfterMs: 60_000,
      pendingAckOlderThanMs: 60_000,
    });
    const repair = new RuntimeRepairService(db, store);
    const applied = await repair.apply(before);
    const after = checker.run({
      now,
      staleExecutionAfterMs: 60_000,
      pendingAckOlderThanMs: 60_000,
    });
    const tickets = store.listExecutionTicketsByExecution("exec-ownership-recovery");
    const originalTicket = tickets.find((ticket) => ticket.id === created.ticket.id) ?? null;
    const replacementTicket = tickets.find((ticket) => ticket.id !== created.ticket.id && ticket.status === "pending") ?? null;
    const activeLease = store.getActiveExecutionLease("exec-ownership-recovery");
    const reclaimedLease = store.listExecutionLeases("exec-ownership-recovery").find((lease) => lease.status === "reclaimed") ?? null;
    const worker = store.getWorkerSnapshot("worker-ownership-recovery");
    const execution = store.getExecution("exec-ownership-recovery");

    assert.equal(claimed.accepted, true);
    assert.equal(before.status, "repairable");
    assert.ok(before.repairActions.some((action) => action.action === "requeue_execution"));
    assert.ok(applied.some((result) => result.action === "requeue_execution" && result.applied));
    assert.equal(after.status, "pass");
    assert.equal(originalTicket?.status, "consumed");
    assert.equal(replacementTicket?.status, "pending");
    assert.equal(activeLease, null);
    assert.equal(reclaimedLease?.reasonCode, "stale_worker_requeue");
    assert.equal(worker?.runningExecutionsJson, "[]");
    assert.equal(execution?.status, "created");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("runtime repair service replaces terminal sessions instead of reopening them for active tasks", async () => {
  const workspace = createTempWorkspace("aa-recovery-replace-session-");

  try {
    const db = new SqliteDatabase(join(workspace, "replace-session.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const staleAt = "2026-04-03T10:00:00.000Z";
    const now = "2026-04-03T10:10:00.000Z";

    seedTaskAndExecution(db, store, {
      taskId: "task-replace-session",
      executionId: "exec-replace-session",
      traceId: "trace-replace-session",
    });

    db.transaction(() => {
      store.insertWorkflowState({
        taskId: "task-replace-session",
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: staleAt,
        updatedAt: staleAt,
      });
      store.insertSession({
        id: "sess-replace-session",
        taskId: "task-replace-session",
        channel: "cli",
        status: "failed",
        externalSessionId: null,
        createdAt: staleAt,
        updatedAt: staleAt,
      });
      store.setTaskState({
        taskId: "task-replace-session",
        status: "in_progress",
        updatedAt: staleAt,
        errorCode: null,
        completedAt: null,
      });
    });

    const checker = new StartupConsistencyChecker(db, store);
    const before = checker.run({ now });
    const repair = new RuntimeRepairService(db, store);
    const applied = await repair.apply(before);
    const after = checker.run({ now });
    const snapshot = store.loadTaskSnapshot("task-replace-session");
    const originalSession = store.getSession("sess-replace-session");

    assert.equal(before.status, "repairable");
    assert.ok(before.findings.some((finding) => finding.code === "active_task_terminal_session"));
    assert.ok(applied.some((result) => result.action === "replace_terminal_session" && result.applied));
    assert.equal(after.status, "pass");
    assert.equal(originalSession?.status, "failed");
    assert.equal(snapshot.session?.status, "open");
    assert.notEqual(snapshot.session?.id, "sess-replace-session");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
