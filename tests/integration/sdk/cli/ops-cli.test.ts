import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import { ApprovalService } from "../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { ExecutionDispatchService } from "../../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-service.js";
import { ExecutionLeaseService } from "../../../../src/platform/five-plane-execution/lease/execution-lease-service.js";
import { runSingleTaskExecution } from "../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js";
import { RuntimeRecoveryDecisionService } from "../../../../src/platform/five-plane-execution/recovery/runtime-recovery-decision-service.js";
import { ExecutionWorkerHandshakeService } from "../../../../src/platform/five-plane-execution/worker-pool/execution-worker-handshake-service.js";
import { WorkerRegistryService } from "../../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../helpers/fs.js";
import { seedQueuedTasks, seedTaskAndExecution } from "../../../helpers/seed.js";

function runCli<T>(scriptName: string, env: NodeJS.ProcessEnv): T {
  const stdout = execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "sdk", "cli", scriptName)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  });

  return JSON.parse(stdout) as T;
}

function serialTest(
  name: string,
  optionsOrFn: { skip?: boolean } | ((t: TestContext) => void | Promise<void>),
  maybeFn?: (t: TestContext) => void | Promise<void>,
): void {
  if (typeof optionsOrFn === "function") {
    test(name, { concurrency: false }, optionsOrFn);
    return;
  }
  if (maybeFn == null) {
    throw new TypeError("serialTest options form requires a test function");
  }
  if (optionsOrFn.skip !== undefined && optionsOrFn.skip !== true) {
    throw new TypeError("serialTest only accepts skip: true");
  }
  test(name, { concurrency: false, skip: optionsOrFn.skip }, maybeFn!);
}

function seedWorkflowAndSession(
  db: SqliteDatabase,
  store: AuthoritativeTaskStore,
  input: {
    taskId: string;
    sessionId: string;
    workflowId?: string;
    currentStepIndex?: number;
    outputsJson?: string;
    resumableFromStep?: string | null;
    workflowStatus?: "running" | "failed" | "completed";
    sessionStatus?: "open" | "streaming" | "failed" | "completed";
  },
): void {
  const now = nowIso();
  db.transaction(() => {
    store.insertWorkflowState({
      taskId: input.taskId,
      divisionId: "general_ops",
      workflowId: input.workflowId ?? "single_agent_minimal",
      currentStepIndex: input.currentStepIndex ?? 0,
      status: input.workflowStatus ?? "running",
      outputsJson: input.outputsJson ?? "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: input.resumableFromStep ?? null,
      startedAt: now,
      updatedAt: now,
    });
    store.insertSession({
      id: input.sessionId,
      taskId: input.taskId,
      channel: "cli",
      status: input.sessionStatus ?? "open",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

function isoOffsetFromNow(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function seedCliDispatchPreemptionScenario(
  db: SqliteDatabase,
  store: AuthoritativeTaskStore,
  input: {
    lowExecutionId: string;
    lowTaskId: string;
    urgentExecutionId: string;
    urgentTaskId: string;
    workerCurrentStepId: string | null;
    resumableFromStep: string | null;
  },
): void {
  const dispatch = new ExecutionDispatchService(db, store);
  const leases = new ExecutionLeaseService(db, store);
  const workers = new WorkerRegistryService(store);

  seedTaskAndExecution(db, store, {
    taskId: input.lowTaskId,
    executionId: input.lowExecutionId,
    traceId: `trace-${input.lowExecutionId}`,
  });
  seedTaskAndExecution(db, store, {
    taskId: input.urgentTaskId,
    executionId: input.urgentExecutionId,
    traceId: `trace-${input.urgentExecutionId}`,
  });

  db.connection.prepare(`UPDATE tasks SET priority = ? WHERE id = ?`).run("low", input.lowTaskId);
  db.connection.prepare(`UPDATE tasks SET priority = ? WHERE id = ?`).run("urgent", input.urgentTaskId);
  db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", input.urgentExecutionId);
  seedWorkflowAndSession(db, store, {
    taskId: input.lowTaskId,
    sessionId: `sess-${input.lowTaskId}`,
    workflowId: "single_division_multi_step_orchestration",
    currentStepIndex: 1,
    resumableFromStep: input.resumableFromStep,
    workflowStatus: "running",
    sessionStatus: "open",
  });

  const lowTicket = dispatch.createTicket({
    executionId: input.lowExecutionId,
    priority: "low",
    queueName: "default",
    requiredCapabilities: ["bash"],
    occurredAt: "2026-04-07T12:00:05.000Z",
  }).ticket;
  store.consumeExecutionTicket(lowTicket.id, "2026-04-07T12:00:06.000Z");
  const lease = leases.acquireLease({
    executionId: input.lowExecutionId,
    workerId: "worker-cli-preempt",
    ttlMs: 30_000,
    queueName: "default",
    occurredAt: "2026-04-07T12:00:07.000Z",
  });
  assert.equal(lease.outcome, "granted");

  workers.recordHeartbeat({
    workerId: "worker-cli-preempt",
    status: "busy",
    capabilities: ["bash"],
    runningExecutionIds: [input.lowExecutionId],
    maxConcurrency: 1,
    queueAffinity: "default",
    currentStepId: input.workerCurrentStepId,
    lastProgressAt: "2026-04-07T12:00:08.000Z",
    occurredAt: "2026-04-07T12:00:08.000Z",
  });

  const lowExecution = store.getExecution(input.lowExecutionId);
  assert.ok(lowExecution);
  store.upsertAgentExecutionRecord({
    executionId: input.lowExecutionId,
    taskId: input.lowTaskId,
    agentId: lowExecution.agentId,
    workflowId: lowExecution.workflowId,
    roleId: lowExecution.roleId,
    runKind: lowExecution.runKind,
    runtimeInstanceId: "runtime-cli-preempt",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "executing",
    planJson: JSON.stringify({ workflowId: lowExecution.workflowId }),
    currentStepId: input.workerCurrentStepId,
    lastToolName: "bash",
    toolCallCount: 1,
    lastDecisionJson: null,
    lastErrorCode: null,
    retryCount: 0,
    progressMessage: "working",
    startedAt: "2026-04-07T12:00:00.000Z",
    createdAt: "2026-04-07T12:00:00.000Z",
    updatedAt: "2026-04-07T12:00:08.000Z",
    completedAt: null,
  });
}

function seedCliConfigTree(root: string): void {
  createFile(join(root, "bootstrap/default.json"), JSON.stringify({
    appName: "aa",
    phase: "phase_2a",
    stableCoreEnabled: true,
    dependencyOrder: ["config", "providers", "runtime"],
    readinessGates: ["config_loaded", "provider_ready"],
    degradationPolicy: {
      onReadinessFailure: "fail_closed",
      allowSummaryMode: false,
    },
    healthCheckTimeoutMs: 5000,
    readinessProbe: {
      initialDelayMs: 1000,
      intervalMs: 1000,
      timeoutMs: 500,
      failureThreshold: 3,
    },
  }));
  createFile(join(root, "gateways/default.json"), JSON.stringify({ defaultGateway: "cli", sseEnabled: true }));
  createFile(join(root, "providers/default.json"), JSON.stringify({ defaultProvider: "openai", defaultModelProfile: "reasoning-medium" }));
  createFile(join(root, "providers/models.json"), JSON.stringify({
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
  createFile(join(root, "runtime/default.json"), JSON.stringify({
    configVersion: "test-runtime-v1",
    configSchemaVersion: "1",
    maxConcurrentTasks: 2,
    defaultTaskTimeoutMs: 300000,
    defaultStepTimeoutMs: 120000,
    apiDefaultTimeoutMs: 30000,
    apiMaxTimeoutMs: 120000,
    retryMax: 3,
    circuitBreaker: {
      enabled: true,
      threshold: 5,
    },
    rateLimit: {
      enabled: true,
      requestsPerMinute: 120,
    },
    configDriftReconciler: {
      interval: 60000,
    },
  }));
  createFile(join(root, "security/default.json"), JSON.stringify({
    approvalMode: "supervised",
    sandboxMode: "workspace_write",
    allowDestructiveActions: false,
    remoteWorkerRegistration: {
      challengeTtlMs: 300000,
      allowedCapabilities: ["bash", "edit", "mcp"],
    },
  }));
  createFile(join(root, "workflows/default.json"), JSON.stringify({ defaultWorkflowId: "single_agent_minimal", allowCrossDivisionDag: false }));
}

serialTest("inspect CLI returns task, execution, and approval views", async () => {
  const workspace = createTempWorkspace("aa-cli-inspect-");
  const dbPath = join(workspace, "inspect-cli.db");

  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Inspect CLI task",
      request: "Inspect the CLI output.",
    });

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);
    const approval = approvalService.createRequest({
      taskId: snapshot.task.id,
      executionId: snapshot.execution?.id ?? null,
      sourceAgentId: "agent_general_executor",
      reason: "Need CLI inspection approval",
      riskLevel: "medium",
      options: ["approve", "reject"],
      context: { source: "ops-cli-test" },
      timeoutPolicy: "reject",
    });
    db.close();

    const taskInspect = runCli<{
      task: { id: string };
      dispatchDecisions: unknown[];
      recentEvents: unknown[];
      taskResult: { status: string } | null;
      stepResults: unknown[];
      artifacts: unknown[];
      runtimeRecovery: { candidates: Array<{ latestPrecheck: { allowed: boolean } | null }> };
    }>("inspect.js", {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "task",
      AA_TASK_ID: snapshot.task.id,
    });
    const executionInspect = runCli<{
      execution: { id: string };
      dispatchDecisions: unknown[];
      executions: unknown[];
      taskResult: { status: string } | null;
      stepResults: unknown[];
      artifacts: unknown[];
      runtimeRecovery: { candidates: unknown[] };
    }>("inspect.js", {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "execution",
      AA_EXECUTION_ID: snapshot.execution?.id ?? "",
    });
    const approvalInspect = runCli<{
      approval: { id: string };
      dispatchDecisions: unknown[];
      approvals: unknown[];
      taskResult: { status: string } | null;
      stepResults: unknown[];
      artifacts: unknown[];
      runtimeRecovery: { requestedApprovals: unknown[] };
    }>("inspect.js", {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "approval",
      AA_APPROVAL_ID: approval.approvalId,
    });

    assert.equal(taskInspect.task.id, snapshot.task.id);
    assert.equal(taskInspect.dispatchDecisions.length, 0);
    assert.ok(taskInspect.recentEvents.length >= 3);
    assert.equal(taskInspect.taskResult?.status, "success");
    assert.equal(taskInspect.stepResults.length >= 1, true);
    assert.equal(taskInspect.artifacts.length, 1);
    assert.equal(taskInspect.runtimeRecovery.candidates[0]?.latestPrecheck?.allowed, true);
    assert.equal(executionInspect.execution.id, snapshot.execution?.id);
    assert.equal(executionInspect.dispatchDecisions.length, 0);
    assert.ok(executionInspect.executions.length >= 1);
    assert.equal(executionInspect.taskResult?.status, "success");
    assert.equal(executionInspect.stepResults.length >= 1, true);
    assert.equal(executionInspect.artifacts.length, 1);
    assert.equal(executionInspect.runtimeRecovery.candidates.length, 1);
    assert.equal(approvalInspect.approval.id, approval.approvalId);
    assert.equal(approvalInspect.dispatchDecisions.length, 0);
    assert.equal(approvalInspect.approvals.length, 1);
    assert.equal(approvalInspect.taskResult?.status, "success");
    assert.equal(approvalInspect.stepResults.length >= 1, true);
    assert.equal(approvalInspect.artifacts.length, 1);
    assert.equal(approvalInspect.runtimeRecovery.requestedApprovals.length, 1);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("inspect CLI exposes structured dispatch decisions for active execution routing", () => {
  const workspace = createTempWorkspace("aa-cli-inspect-dispatch-");
  const dbPath = join(workspace, "inspect-dispatch-cli.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-inspect-dispatch",
      executionId: "exec-cli-inspect-dispatch",
      traceId: "trace-cli-inspect-dispatch",
    });
    seedWorkflowAndSession(db, store, {
      taskId: "task-cli-inspect-dispatch",
      sessionId: "sess-cli-inspect-dispatch",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-cli-inspect-dispatch");
    workers.recordHeartbeat({
      workerId: "worker-cli-inspect-capable",
      status: "idle",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T16:00:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-cli-inspect-basic",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T16:00:00.000Z",
    });
    dispatch.createTicket({
      executionId: "exec-cli-inspect-dispatch",
      queueName: "default",
      requiredCapabilities: ["bash", "edit"],
      occurredAt: "2026-04-04T16:00:05.000Z",
    });
    dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T16:00:06.000Z",
    });
    db.close();

    const taskInspect = runCli<{
      dispatchDecisions: Array<{
        outcome: string;
        selectedWorkerId: string | null;
        evaluations: Array<{ workerId: string; rejectionReason: string | null }>;
      }>;
    }>("inspect.js", {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "task",
      AA_TASK_ID: "task-cli-inspect-dispatch",
    });
    const executionInspect = runCli<{
      dispatchDecisions: Array<{
        outcome: string;
        selectedWorkerId: string | null;
      }>;
    }>("inspect.js", {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "execution",
      AA_EXECUTION_ID: "exec-cli-inspect-dispatch",
    });

    assert.equal(taskInspect.dispatchDecisions.length, 1);
    assert.equal(taskInspect.dispatchDecisions[0]?.outcome, "dispatched");
    assert.equal(taskInspect.dispatchDecisions[0]?.selectedWorkerId, "worker-cli-inspect-capable");
    assert.ok(
      taskInspect.dispatchDecisions[0]?.evaluations.some(
        (evaluation) =>
          evaluation.workerId === "worker-cli-inspect-basic" && evaluation.rejectionReason === "missing_capabilities",
      ),
    );
    assert.equal(executionInspect.dispatchDecisions.length, 1);
    assert.equal(executionInspect.dispatchDecisions[0]?.selectedWorkerId, "worker-cli-inspect-capable");
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("inspect CLI exposes remote fallback placement summaries for remote-aware dispatches", () => {
  const workspace = createTempWorkspace("aa-cli-inspect-remote-");
  const dbPath = join(workspace, "inspect-remote-cli.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-inspect-remote",
      executionId: "exec-cli-inspect-remote",
      traceId: "trace-cli-inspect-remote",
    });
    seedWorkflowAndSession(db, store, {
      taskId: "task-cli-inspect-remote",
      sessionId: "sess-cli-inspect-remote",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-cli-inspect-remote");
    workers.recordHeartbeat({
      workerId: "worker-cli-inspect-remote-offline",
      status: "offline",
      placement: "remote",
      registrationVerifiedAt: "2026-04-05T13:10:00.000Z",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-05T13:10:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-cli-inspect-local-fallback",
      status: "idle",
      placement: "local",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-05T13:10:00.000Z",
    });
    dispatch.createTicket({
      executionId: "exec-cli-inspect-remote",
      queueName: "default",
      dispatchTarget: "prefer_remote",
      requiredCapabilities: ["bash", "edit"],
      occurredAt: "2026-04-05T13:10:05.000Z",
    });
    dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-05T13:10:06.000Z",
    });
    db.close();

    const taskInspect = runCli<{
      dispatchDecisions: Array<{
        selectedWorkerId: string | null;
        selectedWorkerPlacement: string | null;
        remoteAvailability: string | null;
        fallbackApplied?: boolean;
        remoteRejectedWorkerIds: string[];
      }>;
      remoteRoutingSummary: {
        remoteDecisionCount: number;
        localFallbackCount: number;
        latestSelectedWorkerPlacement: string | null;
      };
    }>("inspect.js", {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "task",
      AA_TASK_ID: "task-cli-inspect-remote",
    });

    assert.equal(taskInspect.dispatchDecisions.length, 1);
    assert.equal(taskInspect.dispatchDecisions[0]?.selectedWorkerId, "worker-cli-inspect-local-fallback");
    assert.equal(taskInspect.dispatchDecisions[0]?.selectedWorkerPlacement, "local");
    assert.equal(taskInspect.dispatchDecisions[0]?.remoteAvailability, "unavailable");
    assert.equal(taskInspect.dispatchDecisions[0]?.fallbackApplied, true);
    assert.deepEqual(taskInspect.dispatchDecisions[0]?.remoteRejectedWorkerIds, ["worker-cli-inspect-remote-offline"]);
    assert.equal(taskInspect.remoteRoutingSummary.remoteDecisionCount, 1);
    assert.equal(taskInspect.remoteRoutingSummary.localFallbackCount, 1);
    assert.equal(taskInspect.remoteRoutingSummary.latestSelectedWorkerPlacement, "local");
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("inspect CLI summarizes partial and degraded remote routing outcomes", () => {
  const workspace = createTempWorkspace("aa-cli-inspect-remote-summary-");
  const dbPath = join(workspace, "inspect-remote-summary-cli.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-cli-inspect-remote-partial",
      executionId: "exec-cli-inspect-remote-partial",
      traceId: "trace-cli-inspect-remote-partial",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-cli-inspect-remote-partial");
    workers.recordHeartbeat({
      workerId: "worker-cli-inspect-remote-busy",
      status: "busy",
      placement: "remote",
      registrationVerifiedAt: "2026-04-06T13:30:00.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:201",
      capabilities: ["bash", "edit"],
      runningExecutionIds: ["exec-busy"],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-06T13:30:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-cli-inspect-remote-missing",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-06T13:30:00.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:202",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-06T13:30:00.000Z",
    });
    dispatch.createTicket({
      executionId: "exec-cli-inspect-remote-partial",
      queueName: "default",
      dispatchTarget: "require_remote",
      requiredCapabilities: ["bash", "edit"],
      occurredAt: "2026-04-06T13:30:05.000Z",
    });
    dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-06T13:30:06.000Z",
    });

    workers.recordHeartbeat({
      workerId: "worker-cli-inspect-remote-busy",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-06T13:30:45.000Z",
      remoteSessionStatus: "viewer_only",
      lastAcknowledgedStreamOffset: "stream:201",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-06T13:30:45.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-cli-inspect-remote-missing",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-06T13:30:45.000Z",
      remoteSessionStatus: "viewer_only",
      lastAcknowledgedStreamOffset: "stream:202",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-06T13:30:45.000Z",
    });

    seedTaskAndExecution(db, store, {
      taskId: "task-cli-inspect-remote-degraded",
      executionId: "exec-cli-inspect-remote-degraded",
      traceId: "trace-cli-inspect-remote-degraded",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-cli-inspect-remote-degraded");
    workers.recordHeartbeat({
      workerId: "worker-cli-inspect-remote-viewer",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-06T13:31:00.000Z",
      remoteSessionStatus: "viewer_only",
      lastAcknowledgedStreamOffset: "stream:203",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-06T13:31:00.000Z",
    });
    dispatch.createTicket({
      executionId: "exec-cli-inspect-remote-degraded",
      priority: "high",
      queueName: "default",
      dispatchTarget: "require_remote",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-06T13:31:05.000Z",
    });
    dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-06T13:31:06.000Z",
    });
    db.close();

    const partialTaskInspect = runCli<{
      dispatchDecisions: Array<{ reasonCode: string | null; remoteAvailability: string | null }>;
      remoteRoutingSummary: {
        partialAvailableDecisionCount: number;
        degradedDecisionCount: number;
      };
    }>("inspect.js", {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "task",
      AA_TASK_ID: "task-cli-inspect-remote-partial",
    });
    const degradedTaskInspect = runCli<{
      dispatchDecisions: Array<{ reasonCode: string | null; remoteAvailability: string | null }>;
      remoteRoutingSummary: {
        partialAvailableDecisionCount: number;
        degradedDecisionCount: number;
      };
    }>("inspect.js", {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "task",
      AA_TASK_ID: "task-cli-inspect-remote-degraded",
    });

    assert.equal(
      partialTaskInspect.dispatchDecisions.some((decision) => decision.reasonCode === "remote.partial_available"),
      true,
    );
    assert.equal(
      partialTaskInspect.dispatchDecisions.some((decision) => decision.remoteAvailability === "partial_available"),
      true,
    );
    assert.equal(partialTaskInspect.remoteRoutingSummary.partialAvailableDecisionCount, 1);
    assert.equal(partialTaskInspect.remoteRoutingSummary.degradedDecisionCount, 1);
    assert.equal(degradedTaskInspect.dispatchDecisions[0]?.reasonCode, "remote.session_unready");
    assert.equal(degradedTaskInspect.dispatchDecisions[0]?.remoteAvailability, "degraded");
    assert.equal(degradedTaskInspect.remoteRoutingSummary.partialAvailableDecisionCount, 0);
    assert.equal(degradedTaskInspect.remoteRoutingSummary.degradedDecisionCount, 1);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("inspect CLI query mode lists task workflow and decision summaries", () => {
  const workspace = createTempWorkspace("aa-cli-inspect-query-");
  const dbPath = join(workspace, "inspect-query-cli.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvals = new ApprovalService(db, store);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-cli-query",
      executionId: "exec-cli-query",
      traceId: "trace-cli-query",
    });
    seedWorkflowAndSession(db, store, {
      taskId: "task-cli-query",
      sessionId: "sess-cli-query",
    });
    db.connection.prepare(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`).run(
      "awaiting_decision",
      "2026-04-05T13:00:00.000Z",
      "task-cli-query",
    );
    db.connection.prepare(`UPDATE executions SET status = ?, updated_at = ? WHERE id = ?`).run(
      "created",
      "2026-04-05T13:00:00.000Z",
      "exec-cli-query",
    );
    const approval = approvals.createRequest({
      taskId: "task-cli-query",
      executionId: "exec-cli-query",
      sourceAgentId: "agent-cli-query",
      reason: "Need CLI query approval",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: { sessionId: "cli-query-session" },
      timeoutPolicy: "reject",
    });
    workers.recordHeartbeat({
      workerId: "worker-cli-query",
      status: "idle",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-05T13:00:05.000Z",
    });
    dispatch.createTicket({
      executionId: "exec-cli-query",
      queueName: "default",
      requiredCapabilities: ["bash", "edit"],
      occurredAt: "2026-04-05T13:00:06.000Z",
    });
    dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-05T13:00:07.000Z",
    });
    db.close();

    const taskSummaries = runCli<
      Array<{
        taskId: string;
        pendingApprovalCount: number;
        dispatchDecisionCount: number;
      }>
    >("inspect.js", {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "tasks",
      AA_TASK_STATUS: "awaiting_decision",
      AA_HAS_PENDING_APPROVAL: "true",
    });
    const workflowSummaries = runCli<
      Array<{
        taskId: string;
        workflowId: string;
        workflowStatus: string;
      }>
    >("inspect.js", {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "workflows",
      AA_WORKFLOW_ID: "single_agent_minimal",
      AA_WORKFLOW_STATUS: "running",
    });
    const decisionSummaries = runCli<
      Array<{
        decisionType: string;
        decisionId: string;
        selectedWorkerId: string | null;
      }>
    >("inspect.js", {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "decisions",
      AA_TASK_ID: "task-cli-query",
    });

    assert.equal(taskSummaries.length, 1);
    assert.equal(taskSummaries[0]?.taskId, "task-cli-query");
    assert.equal(taskSummaries[0]?.pendingApprovalCount, 1);
    assert.equal(taskSummaries[0]?.dispatchDecisionCount, 1);
    assert.equal(workflowSummaries.length, 1);
    assert.equal(workflowSummaries[0]?.workflowId, "single_agent_minimal");
    assert.equal(workflowSummaries[0]?.workflowStatus, "running");
    assert.equal(decisionSummaries.length, 2);
    assert.ok(
      decisionSummaries.some((summary) => summary.decisionType === "approval" && summary.decisionId === approval.approvalId),
    );
    assert.ok(
      decisionSummaries.some(
        (summary) => summary.decisionType === "dispatch" && summary.selectedWorkerId === "worker-cli-query",
      ),
    );
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("inspect CLI query mode lists remote worker session telemetry summaries", async () => {
  const workspace = createTempWorkspace("aa-cli-inspect-workers-");
  const dbPath = join(workspace, "inspect-workers-cli.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);

    workers.recordHeartbeat({
      workerId: "worker-cli-remote-connected",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-05T13:30:00.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:88",
      streamResumeSuccessRate: 0.99,
      credentialRefreshSuccessRate: 0.98,
      sessionConsistencyCheckStatus: "passed",
      sessionConsistencyCheckedAt: "2026-04-05T13:30:00.000Z",
      saturation: 0.5,
      activeLeaseCount: 1,
      meanStartupLatencyMs: 300,
      sandboxSuccessRate: 0.97,
      repoCacheHitRate: 0.95,
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: "2026-04-05T13:30:00.000Z",
    });
    db.close();

    const workerSummaries = runCli<
      Array<{
        workerId: string;
        placement: string;
        schedulingStatus: string;
        remoteSessionStatus: string | null;
        lastAcknowledgedStreamOffset: string | null;
        streamResumeSuccessRate: number | null;
        credentialRefreshSuccessRate: number | null;
        sessionConsistencyCheckStatus: string | null;
        activeLeaseCount: number;
      }>
    >("inspect.js", {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "workers",
      AA_WORKER_PLACEMENT: "remote",
      AA_REMOTE_SESSION_STATUS: "connected",
    });

    assert.equal(workerSummaries.length, 1);
    assert.equal(workerSummaries[0]?.workerId, "worker-cli-remote-connected");
    assert.equal(workerSummaries[0]?.placement, "remote");
    assert.equal(workerSummaries[0]?.schedulingStatus, "healthy");
    assert.equal(workerSummaries[0]?.remoteSessionStatus, "connected");
    assert.equal(workerSummaries[0]?.lastAcknowledgedStreamOffset, "stream:88");
    assert.equal(workerSummaries[0]?.streamResumeSuccessRate, 0.99);
    assert.equal(workerSummaries[0]?.credentialRefreshSuccessRate, 0.98);
    assert.equal(workerSummaries[0]?.sessionConsistencyCheckStatus, "passed");
    assert.equal(workerSummaries[0]?.activeLeaseCount, 1);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("diagnostics CLI returns snapshot debug repro and export outputs", async () => {
  const workspace = createTempWorkspace("aa-cli-diagnostics-");
  const dbPath = join(workspace, "diagnostics-cli.db");
  const artifactRoot = join(workspace, "diagnostics-artifacts");

  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Diagnostics CLI task",
      request: "Build diagnostics outputs.",
    });

    const taskSnapshot = runCli<{
      taskId: string;
      health: { dbWritable: boolean };
      inspect: { taskResult: { status: string } | null; stepResults: unknown[] };
      contextSummary: { dispatchDecisionCount: number };
      retention: { events: { tier_1: { retentionDays: number | null } } } | null;
    }>("diagnostics.js", {
      AA_DB_PATH: dbPath,
      AA_TASK_ID: snapshot.task.id,
      AA_DIAGNOSTICS_KIND: "snapshot",
    });
    const debugDump = runCli<{
      taskId: string;
      backpressure: {
        queueGovernance: { backlogSize: number };
        workerHealth: { totalWorkers: number };
        healthFindings: string[];
      };
      warningSummary: {
        totalUniqueWarnings: number;
        highestSeverity: string;
        entries: Array<{ code: string }>;
      };
      retention: { messages: { retentionDays: number } } | null;
      logBuffer: { retentionLimit: number; entryCount: number; droppedEntryCount: number };
    }>("diagnostics.js", {
      AA_DB_PATH: dbPath,
      AA_TASK_ID: snapshot.task.id,
      AA_DIAGNOSTICS_KIND: "debug",
    });
    const reproBundle = runCli<{
      taskId: string;
      taskResult: { status: string } | null;
      toolUsage: Array<{ result: { status: string } }>;
      sanitizedArtifacts: unknown[];
    }>("diagnostics.js", {
      AA_DB_PATH: dbPath,
      AA_TASK_ID: snapshot.task.id,
      AA_DIAGNOSTICS_KIND: "repro",
    });
    const exported = runCli<{
      bundle: { taskId: string };
      artifact: { kind: string };
    }>("diagnostics.js", {
      AA_DB_PATH: dbPath,
      AA_TASK_ID: snapshot.task.id,
      AA_DIAGNOSTICS_KIND: "export",
      AA_ARTIFACT_ROOT: artifactRoot,
    });

    assert.equal(taskSnapshot.taskId, snapshot.task.id);
    assert.equal(taskSnapshot.health.dbWritable, true);
    assert.equal(taskSnapshot.inspect.taskResult?.status, "success");
    assert.equal(taskSnapshot.inspect.stepResults.length >= 1, true);
    assert.equal(taskSnapshot.contextSummary.dispatchDecisionCount, 0);
    assert.equal(taskSnapshot.retention?.events.tier_1.retentionDays, null);
    assert.equal(debugDump.taskId, snapshot.task.id);
    assert.equal(debugDump.backpressure.queueGovernance.backlogSize, 0);
    assert.equal(debugDump.backpressure.workerHealth.totalWorkers, 0);
    assert.deepEqual(debugDump.backpressure.healthFindings, ["tier1_ack_backlog_degraded"]);
    assert.equal(typeof debugDump.warningSummary.highestSeverity, "string");
    assert.equal(Array.isArray(debugDump.warningSummary.entries), true);
    assert.equal(debugDump.retention?.messages.retentionDays, 30);
    assert.equal(debugDump.logBuffer.retentionLimit, 500);
    assert.equal(debugDump.logBuffer.entryCount, 0);
    assert.equal(debugDump.logBuffer.droppedEntryCount, 0);
    assert.equal(reproBundle.taskId, snapshot.task.id);
    assert.equal(reproBundle.taskResult?.status, "success");
    assert.equal(reproBundle.toolUsage.length >= 1, true);
    assert.equal(reproBundle.toolUsage[0]?.result.status, "success");
    assert.equal(reproBundle.sanitizedArtifacts.length, 1);
    assert.equal(exported.bundle.taskId, snapshot.task.id);
    assert.equal(exported.artifact.kind, "minimal_repro_bundle");
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("diagnostics CLI returns runtime metrics summaries", async () => {
  const workspace = createTempWorkspace("aa-cli-diagnostics-metrics-");
  const dbPath = join(workspace, "diagnostics-metrics-cli.db");

  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Diagnostics metrics task",
      request: "Build runtime metrics output.",
    });

    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-diagnostics-metrics-failed",
      executionId: "exec-cli-diagnostics-metrics-failed",
      traceId: "trace-cli-diagnostics-metrics-failed",
    });
    seedWorkflowAndSession(db, store, {
      taskId: "task-cli-diagnostics-metrics-failed",
      sessionId: "sess-cli-diagnostics-metrics-failed",
      workflowStatus: "failed",
    });
    db.connection
      .prepare(
        `UPDATE tasks
         SET status = ?, actual_cost_usd = ?, updated_at = ?, completed_at = ?, error_code = ?
         WHERE id = ?`,
      )
      .run(
        "failed",
        0.75,
        "2026-04-06T12:00:00.000Z",
        "2026-04-06T12:00:00.000Z",
        "task.failed",
        "task-cli-diagnostics-metrics-failed",
      );
    db.connection
      .prepare(`UPDATE executions SET status = ?, attempt = ?, updated_at = ?, finished_at = ? WHERE id = ?`)
      .run(
        "failed",
        2,
        "2026-04-06T12:00:00.000Z",
        "2026-04-06T12:00:00.000Z",
        "exec-cli-diagnostics-metrics-failed",
      );
    store.insertEvent({
      id: "evt-cli-diagnostics-metrics-recovery",
      taskId: "task-cli-diagnostics-metrics-failed",
      executionId: "exec-cli-diagnostics-metrics-failed",
      eventType: "recovery:dead_lettered",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({ decisionId: "rdec-cli-metrics", deadLetterId: "dlq-cli-metrics" }),
      traceId: "trace-cli-diagnostics-metrics-failed",
      createdAt: "2026-04-06T12:00:00.000Z",
    });
    store.insertExecutionTicket({
      id: "ticket-cli-diagnostics-metrics-pending",
      executionId: "exec-cli-diagnostics-metrics-failed",
      taskId: "task-cli-diagnostics-metrics-failed",
      tenantId: "t_test",
      priority: "normal",
      queueName: "default",
      requiredCapabilitiesJson: JSON.stringify(["bash"]),
      dispatchAfter: null,
      attempt: 2,
      status: "pending",
      assignedWorkerId: null,
      leaseId: null,
      claimedAt: null,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: "2026-04-06T12:00:00.000Z",
      updatedAt: "2026-04-06T12:00:00.000Z",
    } as import("../../../../src/platform/contracts/types/domain/dispatch-types.js").ExecutionTicketRecord);
    db.close();

    const metrics = runCli<{
      taskMetrics: { total: number; successCount: number; failedCount: number; successRate: number };
      executionMetrics: { retryAttemptCount: number };
      recoveryMetrics: { taskCount: number; deadLetterCount: number };
      runtimeMetrics: { queueGovernance: { backlogSize: number } };
    }>("diagnostics.js", {
      AA_DB_PATH: dbPath,
      AA_DIAGNOSTICS_KIND: "metrics",
    });

    assert.equal(metrics.taskMetrics.total, 2);
    assert.equal(metrics.taskMetrics.successCount, 1);
    assert.equal(metrics.taskMetrics.failedCount, 1);
    assert.equal(metrics.taskMetrics.successRate, 0.5);
    assert.equal(metrics.executionMetrics.retryAttemptCount, 1);
    assert.equal(metrics.recoveryMetrics.taskCount, 1);
    assert.equal(metrics.recoveryMetrics.deadLetterCount, 1);
    assert.equal(metrics.runtimeMetrics.queueGovernance.backlogSize, 1);
    assert.equal(snapshot.task.id.length > 0, true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("diagnostics CLI exposes remote routing summaries for fallback dispatches", () => {
  const workspace = createTempWorkspace("aa-cli-diagnostics-remote-");
  const dbPath = join(workspace, "diagnostics-remote-cli.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-diagnostics-remote",
      executionId: "exec-cli-diagnostics-remote",
      traceId: "trace-cli-diagnostics-remote",
    });
    seedWorkflowAndSession(db, store, {
      taskId: "task-cli-diagnostics-remote",
      sessionId: "sess-cli-diagnostics-remote",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-cli-diagnostics-remote");
    workers.recordHeartbeat({
      workerId: "worker-cli-diagnostics-remote-offline",
      status: "offline",
      placement: "remote",
      registrationVerifiedAt: "2026-04-05T13:20:00.000Z",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-05T13:20:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-cli-diagnostics-local-fallback",
      status: "idle",
      placement: "local",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-05T13:20:00.000Z",
    });
    dispatch.createTicket({
      executionId: "exec-cli-diagnostics-remote",
      queueName: "default",
      dispatchTarget: "prefer_remote",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-05T13:20:05.000Z",
    });
    dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-05T13:20:06.000Z",
    });
    db.close();

    const taskSnapshot = runCli<{
      contextSummary: {
        dispatchDecisionCount: number;
        remoteRouting: {
          remoteDecisionCount: number;
          localFallbackCount: number;
          latestSelectedWorkerPlacement: string | null;
        };
      };
    }>("diagnostics.js", {
      AA_DB_PATH: dbPath,
      AA_TASK_ID: "task-cli-diagnostics-remote",
      AA_DIAGNOSTICS_KIND: "snapshot",
    });
    const debugDump = runCli<{
      dispatchSummary: {
        latestSelectedWorkerPlacement: string | null;
        latestRemoteAvailability: string | null;
        latestFallbackApplied: boolean;
        latestRemoteRejectedWorkers: string[];
      };
      warningSummary: {
        totalUniqueWarnings: number;
        entries: Array<{ code: string }>;
      };
    }>("diagnostics.js", {
      AA_DB_PATH: dbPath,
      AA_TASK_ID: "task-cli-diagnostics-remote",
      AA_DIAGNOSTICS_KIND: "debug",
    });

    assert.equal(taskSnapshot.contextSummary.dispatchDecisionCount, 1);
    assert.equal(taskSnapshot.contextSummary.remoteRouting.remoteDecisionCount, 1);
    assert.equal(taskSnapshot.contextSummary.remoteRouting.localFallbackCount, 1);
    assert.equal(taskSnapshot.contextSummary.remoteRouting.latestSelectedWorkerPlacement, "local");
    assert.equal(debugDump.dispatchSummary.latestSelectedWorkerPlacement, "local");
    assert.equal(debugDump.dispatchSummary.latestRemoteAvailability, "unavailable");
    assert.equal(debugDump.dispatchSummary.latestFallbackApplied, true);
    assert.deepEqual(debugDump.dispatchSummary.latestRemoteRejectedWorkers, ["worker-cli-diagnostics-remote-offline"]);
    assert.equal(Array.isArray(debugDump.warningSummary.entries), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("diagnostics CLI returns incident timeline reports and exports markdown/json artifacts", async () => {
  const workspace = createTempWorkspace("aa-cli-incident-");
  const dbPath = join(workspace, "incident-cli.db");
  const artifactRoot = join(workspace, "incident-artifacts");

  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Incident CLI task",
      request: "Build an incident CLI report.",
    });
    assert.ok(snapshot.session);

    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);
    store.insertMessage({
      id: "msg-cli-incident-tool-result",
      sessionId: snapshot.session.id,
      direction: "system",
      messageType: "tool_result",
      content: "cli incident export captured the last failing tool output",
      partsJson: null,
      attachmentsJson: null,
      createdAt: "2026-04-06T11:00:03.000Z",
    });
    store.insertCompactionRecord({
      id: "comp-cli-incident",
      sessionId: snapshot.session.id,
      taskId: snapshot.task.id,
      harnessRunId: null,
      nodeRunId: null,
      stage: "summarize",
      sourceMessageIdsJson: JSON.stringify(["msg-cli-incident-tool-result"]),
      summaryText: "Compacted CLI incident evidence for operator handoff.",
      summaryRef: null,
      compactionReason: "cli.incident_test",
      overflowTriggered: 0,
      autoTriggered: 1,
      tokenReductionEstimate: 96,
      createdAt: "2026-04-06T11:00:04.000Z",
    } as import("../../../../src/platform/contracts/types/domain/session-types.js").CompactionRecord);
    approvalService.createRequest({
      taskId: snapshot.task.id,
      executionId: snapshot.execution?.id ?? null,
      sourceAgentId: "agent_general_executor",
      reason: "Need CLI incident approval",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: { reasonCode: "cli.incident_test" },
      timeoutPolicy: "reject",
    });
    db.close();

    const incident = runCli<{
      taskId: string;
      summary: {
        totalEntries: number;
        stepOutputCount: number;
        messageCount: number;
        compactionCount: number;
        highestSeverity: string;
      };
      warnings: {
        entries: Array<{ code: string }>;
      };
      candidateRootCauses: string[];
      entries: Array<{ source: string; title: string }>;
    }>("diagnostics.js", {
      AA_DB_PATH: dbPath,
      AA_TASK_ID: snapshot.task.id,
      AA_DIAGNOSTICS_KIND: "incident",
    });
    const exported = runCli<{
      report: { taskId: string };
      jsonArtifact: { kind: string; uri: string };
      markdownArtifact: { kind: string; uri: string };
    }>("diagnostics.js", {
      AA_DB_PATH: dbPath,
      AA_TASK_ID: snapshot.task.id,
      AA_DIAGNOSTICS_KIND: "incident-export",
      AA_ARTIFACT_ROOT: artifactRoot,
    });

    assert.equal(incident.taskId, snapshot.task.id);
    assert.equal(incident.summary.totalEntries >= 4, true);
    assert.equal(incident.summary.stepOutputCount >= 1, true);
    assert.equal(incident.summary.messageCount >= 1, true);
    assert.equal(incident.summary.compactionCount, 1);
    assert.equal(incident.summary.highestSeverity, "warning");
    assert.ok(incident.warnings.entries.some((entry) => entry.code === "approval_pending"));
    assert.ok(
      incident.candidateRootCauses.includes("Execution is waiting on an operator approval before it can continue."),
    );
    assert.ok(incident.entries.some((entry) => entry.source === "message" && entry.title === "message:tool_result"));
    assert.ok(incident.entries.some((entry) => entry.source === "compaction" && entry.title === "compaction:summarize"));
    assert.equal(exported.report.taskId, snapshot.task.id);
    assert.equal(exported.jsonArtifact.kind, "incident_timeline_report");
    assert.equal(exported.markdownArtifact.kind, "incident_timeline_markdown");
    assert.equal(existsSync(exported.jsonArtifact.uri), true);
    assert.equal(existsSync(exported.markdownArtifact.uri), true);
    assert.match(readFileSync(exported.markdownArtifact.uri, "utf8"), /# Incident Timeline:/);
    assert.match(readFileSync(exported.markdownArtifact.uri, "utf8"), /approval_pending/);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("diagnostics CLI returns stalled escalation packages and exports escalation artifacts", () => {
  const workspace = createTempWorkspace("aa-cli-stalled-escalation-");
  const dbPath = join(workspace, "stalled-escalation-cli.db");
  const artifactRoot = join(workspace, "stalled-escalation-artifacts");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-stalled-escalation",
      executionId: "exec-cli-stalled-escalation",
      traceId: "trace-cli-stalled-escalation",
    });
    db.connection.prepare(
      `UPDATE workflow_state SET status = ?, current_step_index = ?, updated_at = ? WHERE task_id = ?`,
    ).run("running", 0, "2000-01-01T00:00:00.000Z", "task-cli-stalled-escalation");
    db.connection.prepare(`UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?`).run(
      "in_progress",
      null,
      "2000-01-01T00:00:00.000Z",
      "task-cli-stalled-escalation",
    );
    db.connection.prepare(`UPDATE executions SET status = ?, finished_at = ?, updated_at = ? WHERE id = ?`).run(
      "executing",
      null,
      "2000-01-01T00:00:00.000Z",
      "exec-cli-stalled-escalation",
    );
    store.upsertAgentExecutionRecord({
      executionId: "exec-cli-stalled-escalation",
      taskId: "task-cli-stalled-escalation",
      agentId: "agent-1",
      workflowId: "single_agent_minimal",
      roleId: "general_executor",
      runKind: "task_run",
      runtimeInstanceId: "runtime-cli-stalled-1",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      status: "executing",
      planJson: "{}",
      currentStepId: "step-cli-stalled",
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
    db.close();

    const escalations = runCli<Array<{
      executionId: string;
      taskId: string;
      suggestedOperatorAction: string;
      currentStepId: string | null;
      runtimeInstanceId: string | null;
    }>>("diagnostics.js", {
      AA_DB_PATH: dbPath,
      AA_DIAGNOSTICS_KIND: "stalled-escalation",
      AA_TASK_ID: "task-cli-stalled-escalation",
    });
    const exported = runCli<{
      packages: Array<{ executionId: string; taskId: string }>;
      artifacts: Array<{ kind: string; uri: string }>;
    }>("diagnostics.js", {
      AA_DB_PATH: dbPath,
      AA_DIAGNOSTICS_KIND: "stalled-escalation-export",
      AA_TASK_ID: "task-cli-stalled-escalation",
      AA_ARTIFACT_ROOT: artifactRoot,
    });

    assert.equal(escalations.length, 1);
    assert.equal(escalations[0]?.executionId, "exec-cli-stalled-escalation");
    assert.equal(escalations[0]?.taskId, "task-cli-stalled-escalation");
    assert.equal(escalations[0]?.suggestedOperatorAction, "reclaim_lease_and_requeue");
    assert.equal(escalations[0]?.currentStepId, "step-cli-stalled");
    assert.equal(escalations[0]?.runtimeInstanceId, "runtime-cli-stalled-1");
    assert.equal(exported.packages.length, 1);
    assert.equal(exported.packages[0]?.executionId, "exec-cli-stalled-escalation");
    assert.equal(exported.artifacts.length, 1);
    assert.equal(exported.artifacts[0]?.kind, "stalled_execution_escalation");
    assert.equal(existsSync(exported.artifacts[0]?.uri ?? ""), true);
    assert.match(readFileSync(exported.artifacts[0]?.uri ?? "", "utf8"), /reclaim_lease_and_requeue/);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("diagnostics CLI returns remote timeline views for persisted remote worker logs", () => {
  const workspace = createTempWorkspace("aa-cli-remote-timeline-");
  const dbPath = join(workspace, "remote-timeline-cli.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const handshake = new ExecutionWorkerHandshakeService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-cli-remote-timeline",
      executionId: "exec-cli-remote-timeline",
      traceId: "trace-cli-remote-timeline",
    });
    seedWorkflowAndSession(db, store, {
      taskId: "task-cli-remote-timeline",
      sessionId: "sess-cli-remote-timeline",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-cli-remote-timeline");
    workers.recordHeartbeat({
      workerId: "worker-cli-remote-timeline",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-06T14:00:00.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:300",
      sessionConsistencyCheckStatus: "passed",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-cli-remote-timeline-1",
      occurredAt: "2026-04-06T14:00:00.000Z",
    });
    const created = dispatch.createTicket({
      executionId: "exec-cli-remote-timeline",
      queueName: "default",
      dispatchTarget: "prefer_remote",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-06T14:00:05.000Z",
    });
    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-06T14:00:06.000Z",
    });
    handshake.claimExecution({
      ticketId: created.ticket.id,
      workerId: "worker-cli-remote-timeline",
      leaseId: dispatched.leaseId ?? "",
      fencingToken: 1,
      runtimeInstanceId: "runtime-cli-remote-timeline-1",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:301",
      sessionConsistencyCheckStatus: "passed",
      remoteLogs: [
        {
          level: "info",
          message: "cli remote timeline recorded the remote bootstrap sequence",
          context: { stage: "claim" },
        },
      ],
      occurredAt: "2026-04-06T14:00:07.000Z",
    });
    db.close();

    const remoteTimeline = runCli<{
      taskId: string;
      totalEntries: number;
      totalRemoteLogs: number;
      remoteWorkerIds: string[];
      entries: Array<{ source: string; title: string; summary: string }>;
    }>("diagnostics.js", {
      AA_DB_PATH: dbPath,
      AA_TASK_ID: "task-cli-remote-timeline",
      AA_DIAGNOSTICS_KIND: "remote-timeline",
    });

    assert.equal(remoteTimeline.taskId, "task-cli-remote-timeline");
    assert.equal(remoteTimeline.totalRemoteLogs, 1);
    assert.deepEqual(remoteTimeline.remoteWorkerIds, ["worker-cli-remote-timeline"]);
    assert.equal(remoteTimeline.totalEntries >= 2, true);
    assert.equal(
      remoteTimeline.entries.some((entry) => entry.source === "remote_log" && entry.title === "remote_log:info"),
      true,
    );
    assert.equal(
      remoteTimeline.entries.some((entry) => entry.source === "dispatch" && entry.summary.includes("Dispatch routed")),
      true,
    );
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("repair CLI rebuilds missing tier1 ack coverage and returns a passing report", () => {
  const workspace = createTempWorkspace("aa-cli-repair-");
  const dbPath = join(workspace, "repair-cli.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-repair",
      executionId: "exec-cli-repair",
      traceId: "trace-cli-repair",
    });
    seedWorkflowAndSession(db, store, {
      taskId: "task-cli-repair",
      sessionId: "sess-cli-repair",
      workflowStatus: "running",
      sessionStatus: "open",
    });

    store.createTier1StatusEvent({
      taskId: "task-cli-repair",
      executionId: "exec-cli-repair",
      eventType: "task:status_changed",
      traceId: "trace-cli-repair",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    db.connection
      .prepare(
        `DELETE FROM event_consumer_acks
         WHERE consumer_id = ?
           AND event_id IN (SELECT id FROM events WHERE execution_id = ?)`,
      )
      .run("inspect_projection", "exec-cli-repair");
    db.close();

    const repaired = runCli<{
      before: { status: string; findings: Array<{ code: string }> };
      applied: Array<{ action: string; applied: boolean }>;
      after: { status: string; findings: Array<{ code: string }> };
    }>("repair.js", {
      AA_DB_PATH: dbPath,
    });

    assert.equal(repaired.before.status, "repairable");
    assert.ok(repaired.before.findings.some((finding) => finding.code === "event_consumer_mismatch"));
    assert.ok(repaired.applied.some((result) => result.action === "rebuild_ack" && result.applied));
    assert.equal(repaired.after.status, "pass");
    assert.equal(repaired.after.findings.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("drain-events CLI drains default consumers and clears pending tier1 acks", () => {
  const workspace = createTempWorkspace("aa-cli-drain-");
  const dbPath = join(workspace, "drain-cli.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-drain",
      executionId: "exec-cli-drain",
      traceId: "trace-cli-drain",
    });

    store.createTier1StatusEvent({
      taskId: "task-cli-drain",
      executionId: "exec-cli-drain",
      eventType: "task:status_changed",
      traceId: "trace-cli-drain",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });
    assert.ok(store.countPendingTier1Acks() > 0);
    db.close();

    const drained = runCli<
      Array<{
        consumerId: string;
        delivered: number;
        pendingBefore: number;
        pendingAfter: number;
        outcome: "delivered" | "failed";
      }>
    >("drain-events.js", {
      AA_DB_PATH: dbPath,
    });

    const reloaded = new SqliteDatabase(dbPath);
    const reloadedStore = new AuthoritativeTaskStore(reloaded);

    assert.equal(reloadedStore.countPendingTier1Acks(), 0);
    assert.ok(
      drained.some(
        (result) =>
          result.consumerId === "task_projection"
          && result.pendingBefore >= 1
          && result.pendingAfter === 0
          && result.outcome === "delivered",
      ),
    );
    assert.ok(
      drained.some(
        (result) =>
          result.consumerId === "inspect_projection"
          && result.pendingBefore >= 1
          && result.pendingAfter === 0
          && result.outcome === "delivered",
      ),
    );
    reloaded.close();
  } finally {
    cleanupPath(workspace);
  }
});

serialTest(
  "replay-events CLI replays failed consumer acknowledgements",
  () => {
    const workspace = createTempWorkspace("aa-cli-replay-events-");
    const dbPath = join(workspace, "replay-events-cli.db");

    try {
      const db = new SqliteDatabase(dbPath);
      db.migrate();
      const store = new AuthoritativeTaskStore(db);
      seedTaskAndExecution(db, store, {
        taskId: "task-cli-replay",
        executionId: "exec-cli-replay",
        traceId: "trace-cli-replay",
      });

      store.createTier1StatusEvent({
        taskId: "task-cli-replay",
        executionId: "exec-cli-replay",
        eventType: "task:status_changed",
        traceId: "trace-cli-replay",
        payload: { fromStatus: "queued", toStatus: "in_progress" },
      });
      db.connection
        .prepare(
          `UPDATE event_consumer_acks
           SET status = 'failed', error_code = 'forced_cli_replay_failure', attempt_count = 1
           WHERE consumer_id = ?
             AND event_id IN (SELECT id FROM events WHERE execution_id = ?)`,
        )
        .run("task_projection", "exec-cli-replay");
      db.close();

      const replayed = runCli<
        Array<{
          consumerId: string;
          outcome: string;
          replayedFromHistoryCount: number;
          delivered: number;
          failedBefore: number;
          failedAfter: number;
          pendingAfter: number;
        }>
      >("replay-events.js", {
        AA_DB_PATH: dbPath,
        AA_EVENT_CONSUMER_ID: "task_projection",
      });

      assert.equal(replayed.length, 1);
      assert.equal(replayed[0]?.consumerId, "task_projection");
      assert.equal(replayed[0]?.outcome, "delivered");
      assert.equal(replayed[0]?.replayedFromHistoryCount, 1);
      assert.equal(replayed[0]?.delivered, 1);
      assert.equal(replayed[0]?.failedBefore, 0);
      assert.equal(replayed[0]?.failedAfter, 0);
      assert.equal(replayed[0]?.pendingAfter, 0);
    } finally {
      cleanupPath(workspace);
    }
  },
);

serialTest("replay-recovery CLI returns deterministic dead-letter recovery history", () => {
  const workspace = createTempWorkspace("aa-cli-replay-recovery-");
  const dbPath = join(workspace, "replay-recovery-cli.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-replay-recovery",
      executionId: "exec-cli-replay-recovery",
      traceId: "trace-cli-replay-recovery",
    });
    db.transaction(() => {
      db.connection
        .prepare(
          `UPDATE executions
           SET attempt = ?, last_error_code = ?, last_error_message = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          2,
          "unexpected_runtime_error",
          "tool crashed twice",
          "2026-04-04T10:25:00.000Z",
          "exec-cli-replay-recovery",
        );
      store.insertExecutionPrecheck({
        id: "precheck-cli-replay-recovery",
        executionId: "exec-cli-replay-recovery",
        allowed: 1,
        reasonCode: null,
        resolvedBudgetUsd: 1,
        resolvedTimeoutMs: 1000,
        resolvedSandboxMode: "workspace_write",
        resolvedToolsJson: JSON.stringify(["analysis"]),
        resolvedPathsJson: JSON.stringify([]),
        checkedAt: "2026-04-04T10:25:05.000Z",
      });
    });

    const decisionService = new RuntimeRecoveryDecisionService(db, store);
    decisionService.apply("exec-cli-replay-recovery", "cli_operator");
    db.close();

    const replayed = runCli<{
      taskId: string;
      outcome: string;
      deadLetterCount: number;
      executions: Array<{ executionId: string; finalOutcome: string; timeline: Array<{ eventType: string }> }>;
    }>("replay-recovery.js", {
      AA_DB_PATH: dbPath,
      AA_RECOVERY_REPLAY_KIND: "task",
      AA_TASK_ID: "task-cli-replay-recovery",
    });

    assert.equal(replayed.taskId, "task-cli-replay-recovery");
    assert.equal(replayed.outcome, "repair_pending");
    assert.equal(replayed.deadLetterCount, 0);
    assert.equal(replayed.executions[0]?.executionId, "exec-cli-replay-recovery");
    assert.equal(replayed.executions[0]?.finalOutcome, "repair_pending");
    assert.deepEqual(
      replayed.executions[0]?.timeline.map((event) => event.eventType),
      ["recovery:decision_recorded"],
    );
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("dispatch-execution CLI creates and dispatches a ticket to an eligible worker", () => {
  const workspace = createTempWorkspace("aa-cli-dispatch-execution-");
  const dbPath = join(workspace, "dispatch-execution-cli.db");
  const heartbeatAt = isoOffsetFromNow(-1_000);

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-dispatch",
      executionId: "exec-cli-dispatch",
      traceId: "trace-cli-dispatch",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-cli-dispatch");
    workers.recordHeartbeat({
      workerId: "worker-cli-dispatch",
      status: "idle",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: heartbeatAt,
    });
    db.close();

    const dispatched = runCli<{
      created: { outcome: string; ticket: { status: string } };
      dispatched: {
        outcome: string;
        worker: { workerId: string } | null;
        leaseId: string | null;
        ticket: { status: string; assignedWorkerId: string | null } | null;
        trace: {
          selectedWorkerId: string | null;
          evaluations: Array<{ workerId: string; rejectionReason: string | null }>;
        } | null;
      } | null;
    }>("dispatch-execution.js", {
      AA_DB_PATH: dbPath,
      AA_EXECUTION_ID: "exec-cli-dispatch",
      AA_QUEUE_NAME: "default",
      AA_REQUIRED_CAPABILITIES_JSON: JSON.stringify(["bash", "edit"]),
      AA_LEASE_TTL_MS: "30000",
    });

    assert.equal(dispatched.created.outcome, "created");
    assert.equal(dispatched.dispatched?.outcome, "dispatched");
    assert.equal(dispatched.dispatched?.worker?.workerId, "worker-cli-dispatch");
    assert.equal(dispatched.dispatched?.ticket?.status, "claimed");
    assert.equal(dispatched.dispatched?.ticket?.assignedWorkerId, "worker-cli-dispatch");
    assert.equal(dispatched.dispatched?.trace?.selectedWorkerId, "worker-cli-dispatch");
    assert.ok(
      dispatched.dispatched?.trace?.evaluations.some(
        (item) => item.workerId === "worker-cli-dispatch" && item.rejectionReason === null,
      ),
    );
    assert.ok(dispatched.dispatched?.leaseId);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("dispatch-execution CLI blocks normal-priority claims when default health backpressure enters queue-only mode", () => {
  const workspace = createTempWorkspace("aa-cli-dispatch-execution-");
  const dbPath = join(workspace, "dispatch-execution-cli-backpressure.db");
  const heartbeatAt = isoOffsetFromNow(-1_000);

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    seedQueuedTasks(db, store, {
      count: 6,
      prefix: "cli-dispatch-backpressure",
    });
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-dispatch-backpressure",
      executionId: "exec-cli-dispatch-backpressure",
      traceId: "trace-cli-dispatch-backpressure",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-cli-dispatch-backpressure");
    workers.recordHeartbeat({
      workerId: "worker-cli-dispatch-backpressure",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: heartbeatAt,
    });
    db.close();

    const dispatched = runCli<{
      created: { outcome: string; ticket: { status: string } };
      dispatched: {
        outcome: string;
        reasonCode: string | null;
        worker: { workerId: string } | null;
        ticket: { status: string; assignedWorkerId: string | null } | null;
        trace: { reasonCode: string | null } | null;
      } | null;
    }>("dispatch-execution.js", {
      AA_DB_PATH: dbPath,
      AA_EXECUTION_ID: "exec-cli-dispatch-backpressure",
      AA_QUEUE_NAME: "default",
      AA_REQUIRED_CAPABILITIES_JSON: JSON.stringify(["bash"]),
      AA_LEASE_TTL_MS: "30000",
    });

    assert.equal(dispatched.created.outcome, "created");
    assert.equal(dispatched.dispatched?.outcome, "blocked");
    assert.equal(dispatched.dispatched?.reasonCode, "backpressure.queue_only");
    assert.equal(dispatched.dispatched?.worker, null);
    assert.equal(dispatched.dispatched?.ticket?.status, "pending");
    assert.equal(dispatched.dispatched?.ticket?.assignedWorkerId, null);
    assert.equal(dispatched.dispatched?.trace?.reasonCode, "backpressure.queue_only");
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("dispatch-execution CLI forwards required isolation level and rejects weaker workers", () => {
  const workspace = createTempWorkspace("aa-cli-dispatch-execution-");
  const dbPath = join(workspace, "dispatch-execution-cli-isolation.db");
  const standardHeartbeatAt = isoOffsetFromNow(-2_000);
  const strictHeartbeatAt = isoOffsetFromNow(-1_000);

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-dispatch-isolation",
      executionId: "exec-cli-dispatch-isolation",
      traceId: "trace-cli-dispatch-isolation",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-cli-dispatch-isolation");
    workers.recordHeartbeat({
      workerId: "worker-cli-standard",
      status: "idle",
      isolationLevel: "standard",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: standardHeartbeatAt,
    });
    workers.recordHeartbeat({
      workerId: "worker-cli-strict",
      status: "idle",
      isolationLevel: "strict",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: strictHeartbeatAt,
    });
    db.close();

    const dispatched = runCli<{
      created: { ticket: { requiredIsolationLevel: string | null } };
      dispatched: {
        outcome: string;
        worker: { workerId: string } | null;
        trace: {
          requiredIsolationLevel: string | null;
          evaluations: Array<{ workerId: string; rejectionReason: string | null }>;
        } | null;
      } | null;
    }>("dispatch-execution.js", {
      AA_DB_PATH: dbPath,
      AA_EXECUTION_ID: "exec-cli-dispatch-isolation",
      AA_QUEUE_NAME: "default",
      AA_REQUIRED_ISOLATION_LEVEL: "hardened",
      AA_REQUIRED_CAPABILITIES_JSON: JSON.stringify(["bash"]),
      AA_LEASE_TTL_MS: "30000",
    });

    assert.equal(dispatched.created.ticket.requiredIsolationLevel, "hardened");
    assert.equal(dispatched.dispatched?.outcome, "dispatched");
    assert.equal(dispatched.dispatched?.worker?.workerId, "worker-cli-strict");
    assert.equal(dispatched.dispatched?.trace?.requiredIsolationLevel, "hardened");
    assert.ok(
      dispatched.dispatched?.trace?.evaluations.some(
        (item) => item.workerId === "worker-cli-standard" && item.rejectionReason === "worker_isolation_mismatch",
      ),
    );
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("dispatch-execution CLI forwards required repo version and fail-closes repo-mismatched remote workers", () => {
  const workspace = createTempWorkspace("aa-cli-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-cli-repo.db");
  const heartbeatAt = isoOffsetFromNow(-1_000);

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-dispatch-repo",
      executionId: "exec-cli-dispatch-repo",
      traceId: "trace-cli-dispatch-repo",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-cli-dispatch-repo");
    workers.recordHeartbeat({
      workerId: "worker-cli-remote-repo-old",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: heartbeatAt,
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:120",
      repoVersion: "repo-main@old999",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: heartbeatAt,
    });
    db.close();

    const dispatched = runCli<{
      created: { ticket: { requiredRepoVersion: string | null } };
      dispatched: {
        outcome: string;
        reasonCode: string | null;
        trace: {
          requiredRepoVersion: string | null;
          evaluations: Array<{ workerId: string; rejectionReason: string | null }>;
        } | null;
      } | null;
    }>("dispatch-execution.js", {
      AA_DB_PATH: dbPath,
      AA_EXECUTION_ID: "exec-cli-dispatch-repo",
      AA_QUEUE_NAME: "default",
      AA_DISPATCH_TARGET: "require_remote",
      AA_REQUIRED_REPO_VERSION: "repo-main@abc123",
      AA_REQUIRED_CAPABILITIES_JSON: JSON.stringify(["bash"]),
      AA_LEASE_TTL_MS: "30000",
    });

    assert.equal(dispatched.created.ticket.requiredRepoVersion, "repo-main@abc123");
    assert.equal(dispatched.dispatched?.outcome, "blocked");
    assert.equal(dispatched.dispatched?.reasonCode, "remote.repo_version_mismatch");
    assert.equal(dispatched.dispatched?.trace?.requiredRepoVersion, "repo-main@abc123");
    assert.ok(
      dispatched.dispatched?.trace?.evaluations.some(
        (item) => item.workerId === "worker-cli-remote-repo-old" && item.rejectionReason === "worker_repo_version_mismatch",
      ),
    );
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("dispatch-execution CLI preempts a safe low-priority execution for an urgent ticket", () => {
  const workspace = createTempWorkspace("aa-cli-dispatch-execution-");
  const dbPath = join(workspace, "dispatch-execution-cli-preemption.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedCliDispatchPreemptionScenario(db, store, {
      lowExecutionId: "exec-cli-low-preempt",
      lowTaskId: "task-cli-low-preempt",
      urgentExecutionId: "exec-cli-urgent-preempt",
      urgentTaskId: "task-cli-urgent-preempt",
      workerCurrentStepId: "draft_solution",
      resumableFromStep: "draft_solution",
    });
    db.close();

    const dispatched = runCli<{
      created: { outcome: string };
      dispatched: {
        outcome: string;
        worker: { workerId: string } | null;
        trace: {
          preemption: {
            applied: boolean;
            preemptedExecutionId: string | null;
            recoveryStepId: string | null;
          } | null;
        } | null;
      } | null;
    }>("dispatch-execution.js", {
      AA_DB_PATH: dbPath,
      AA_EXECUTION_ID: "exec-cli-urgent-preempt",
      AA_PRIORITY: "urgent",
      AA_QUEUE_NAME: "default",
      AA_REQUIRED_CAPABILITIES_JSON: JSON.stringify(["bash"]),
      AA_LEASE_TTL_MS: "30000",
    });

    const reloaded = new SqliteDatabase(dbPath);
    const reloadedStore = new AuthoritativeTaskStore(reloaded);
    const lowExecution = reloadedStore.getExecution("exec-cli-low-preempt");
    const workflow = reloadedStore.getWorkflowState("task-cli-low-preempt");
    reloaded.close();

    assert.equal(dispatched.created.outcome, "created");
    assert.equal(dispatched.dispatched?.outcome, "dispatched");
    assert.equal(dispatched.dispatched?.worker?.workerId, "worker-cli-preempt");
    assert.equal(dispatched.dispatched?.trace?.preemption?.applied, true);
    assert.equal(dispatched.dispatched?.trace?.preemption?.preemptedExecutionId, "exec-cli-low-preempt");
    assert.equal(dispatched.dispatched?.trace?.preemption?.recoveryStepId, "draft_solution");
    assert.equal(lowExecution?.status, "blocked");
    assert.equal(workflow?.status, "paused");
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("dispatch-reconcile CLI requeues orphan claimed tickets back into a pending ticket", () => {
  const workspace = createTempWorkspace("aa-cli-dispatch-reconcile-");
  const dbPath = join(workspace, "dispatch-reconcile-cli.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const leases = new ExecutionLeaseService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-dispatch-reconcile",
      executionId: "exec-cli-dispatch-reconcile",
      traceId: "trace-cli-dispatch-reconcile",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-cli-dispatch-reconcile");
    workers.recordHeartbeat({
      workerId: "worker-cli-dispatch-reconcile",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T14:00:00.000Z",
    });
    dispatch.createTicket({
      executionId: "exec-cli-dispatch-reconcile",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T14:00:05.000Z",
    });
    const claimed = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T14:00:06.000Z",
    });
    leases.releaseLease({
      leaseId: claimed.leaseId ?? "",
      workerId: "worker-cli-dispatch-reconcile",
      reasonCode: "cli.seed",
      occurredAt: "2026-04-04T14:00:07.000Z",
    });
    db.close();

    const reconciled = runCli<{
      issues: Array<{ issueType: string }>;
      applied: Array<{ applied: boolean; replacementTicketId: string | null }>;
    }>("dispatch-reconcile.js", {
      AA_DB_PATH: dbPath,
      AA_DISPATCH_RECONCILE_ACTION: "repair",
      AA_OCCURRED_AT: "2026-04-04T14:00:08.000Z",
    });

    const reloaded = new SqliteDatabase(dbPath);
    const reloadedStore = new AuthoritativeTaskStore(reloaded);
    const tickets = reloadedStore.listExecutionTicketsByExecution("exec-cli-dispatch-reconcile");
    reloaded.close();

    assert.ok(reconciled.issues.some((issue) => issue.issueType === "orphan_queue_claim"));
    assert.ok(reconciled.applied.some((item) => item.applied && item.replacementTicketId != null));
    assert.equal(tickets.length, 2);
    assert.equal(tickets[0]?.status, "expired");
    assert.equal(tickets[1]?.status, "pending");
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("orphan-cleanup CLI repairs orphan sessions, orphan claimed tickets, and worker execution refs", () => {
  const workspace = createTempWorkspace("aa-cli-orphan-cleanup-");
  const dbPath = join(workspace, "orphan-cleanup-cli.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const leases = new ExecutionLeaseService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-cli-orphan",
      executionId: "exec-cli-orphan",
      traceId: "trace-cli-orphan",
    });
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-worker-valid",
      executionId: "exec-cli-worker-valid",
      traceId: "trace-cli-worker-valid",
    });
    db.connection.prepare(`UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?`).run(
      "done",
      "2026-04-07T14:00:01.000Z",
      "task-cli-orphan",
    );
    store.insertSession({
      id: "sess-cli-orphan",
      taskId: "task-cli-orphan",
      channel: "cli",
      status: "open",
      externalSessionId: null,
      createdAt: "2026-04-07T14:00:00.000Z",
      updatedAt: "2026-04-07T14:00:00.000Z",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-cli-orphan");
    db.transaction(() => {
      store.insertExecutionLease({
        id: "lease-cli-worker-valid",
        executionId: "exec-cli-worker-valid",
        workerId: "worker-cli-orphan",
        attempt: 1,
        fencingToken: 1,
        queueName: "default",
        status: "active",
        leasedAt: "2026-04-07T14:00:00.000Z",
        expiresAt: "2026-04-07T14:10:00.000Z",
        lastHeartbeatAt: "2026-04-07T14:00:00.000Z",
        releasedAt: null,
        reasonCode: null,
      });
    });
    workers.recordHeartbeat({
      workerId: "worker-cli-orphan",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-cli-orphan", "exec-cli-worker-valid", "exec-cli-worker-missing"],
      activeLeaseCount: 3,
      maxConcurrency: 4,
      queueAffinity: "default",
      occurredAt: "2026-04-07T14:00:02.000Z",
    });

    const created = dispatch.createTicket({
      executionId: "exec-cli-orphan",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-07T14:00:03.000Z",
    });
    const claimed = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-07T14:00:04.000Z",
    });
    leases.releaseLease({
      leaseId: claimed.leaseId ?? "",
      workerId: "worker-cli-orphan",
      reasonCode: "cli.seed",
      occurredAt: "2026-04-07T14:00:05.000Z",
    });
    db.close();

    const repaired = runCli<{
      issues: Array<{ issueType: string; entityId: string }>;
      applied: Array<{ action: string; applied: boolean }>;
    }>("orphan-cleanup.js", {
      AA_DB_PATH: dbPath,
      AA_ORPHAN_CLEANUP_ACTION: "repair",
      AA_ORPHAN_CLEANUP_CONFIRM: "yes",
      AA_OCCURRED_AT: "2026-04-07T14:00:06.000Z",
    });

    const reloaded = new SqliteDatabase(dbPath);
    const reloadedStore = new AuthoritativeTaskStore(reloaded);
    const session = reloadedStore.getSession("sess-cli-orphan");
    const tickets = reloadedStore.listExecutionTicketsByExecution("exec-cli-orphan");
    const worker = reloadedStore.getWorkerSnapshot("worker-cli-orphan");
    reloaded.close();

    assert.ok(repaired.issues.some((issue) => issue.issueType === "orphan_session" && issue.entityId === "sess-cli-orphan"));
    assert.ok(repaired.issues.some((issue) => issue.issueType === "orphan_queue_claim" && issue.entityId === created.ticket.id));
    assert.ok(repaired.issues.some((issue) => issue.issueType === "worker_execution_reference_orphan" && issue.entityId === "worker-cli-orphan"));
    assert.ok(repaired.applied.some((item) => item.action === "close_orphan_session" && item.applied));
    assert.ok(repaired.applied.some((item) => item.action === "requeue_ticket" && item.applied));
    assert.ok(repaired.applied.some((item) => item.action === "clean_worker_execution_refs" && item.applied));
    assert.equal(session?.status, "completed");
    assert.equal(tickets.length, 2);
    assert.equal(tickets[0]?.id, created.ticket.id);
    assert.equal(tickets[0]?.status, "expired");
    assert.equal(tickets[1]?.status, "pending");
    assert.equal(worker?.runningExecutionsJson, JSON.stringify(["exec-cli-worker-valid"]));
    assert.equal(worker?.activeLeaseCount, 1);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("worker-register CLI issues and completes a trusted remote worker registration", () => {
  const workspace = createTempWorkspace("aa-cli-worker-register-");
  const dbPath = join(workspace, "worker-register-cli.db");
  const configRoot = join(workspace, "config");

  try {
    seedCliConfigTree(configRoot);

    const issued = runCli<{
      issued: boolean;
      reasonCode: string | null;
      challengeId: string | null;
      challengeToken: string | null;
      allowedCapabilities: string[];
    }>("worker-register.js", {
      AA_DB_PATH: dbPath,
      AA_CONFIG_ROOT: configRoot,
      AA_WORKER_REGISTER_ACTION: "issue",
      AA_WORKER_ID: "worker-cli-register",
      AA_CAPABILITIES_JSON: JSON.stringify(["bash", "edit"]),
      AA_OCCURRED_AT: "2026-04-06T15:00:00.000Z",
    });
    const completed = runCli<{
      accepted: boolean;
      reasonCode: string | null;
      registrationVerifiedAt: string | null;
      registrationChallengeId: string | null;
    }>("worker-register.js", {
      AA_DB_PATH: dbPath,
      AA_CONFIG_ROOT: configRoot,
      AA_WORKER_REGISTER_ACTION: "complete",
      AA_WORKER_ID: "worker-cli-register",
      AA_CHALLENGE_ID: issued.challengeId ?? "",
      AA_CHALLENGE_TOKEN: issued.challengeToken ?? "",
      AA_CAPABILITIES_JSON: JSON.stringify(["bash", "edit"]),
      AA_MAX_CONCURRENCY: "2",
      AA_QUEUE_AFFINITY: "default",
      AA_RUNTIME_INSTANCE_ID: "runtime-cli-register-1",
      AA_REMOTE_SESSION_STATUS: "connected",
      AA_LAST_ACKNOWLEDGED_STREAM_OFFSET: "stream:1000",
      AA_SESSION_CONSISTENCY_CHECK_STATUS: "passed",
      AA_SESSION_CONSISTENCY_CHECKED_AT: "2026-04-06T15:00:04.000Z",
      AA_OCCURRED_AT: "2026-04-06T15:00:05.000Z",
    });
    const reloaded = new SqliteDatabase(dbPath);
    const reloadedStore = new AuthoritativeTaskStore(reloaded);
    const worker = reloadedStore.getWorkerSnapshot("worker-cli-register");
    reloaded.close();

    assert.equal(issued.issued, true);
    assert.equal(issued.reasonCode, null);
    assert.deepEqual(issued.allowedCapabilities, ["bash", "edit"]);
    assert.equal(completed.accepted, true);
    assert.equal(completed.reasonCode, null);
    assert.equal(completed.registrationVerifiedAt, "2026-04-06T15:00:05.000Z");
    assert.equal(worker?.placement, "remote");
    assert.equal(worker?.registrationVerifiedAt, "2026-04-06T15:00:05.000Z");
    assert.equal(worker?.registrationChallengeId, issued.challengeId);
    assert.equal(worker?.runtimeInstanceId, "runtime-cli-register-1");
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("doctor CLI fail-closes when default provider credentials are missing", () => {
  const workspace = createTempWorkspace("aa-cli-doctor-preflight-");
  const dbPath = join(workspace, "doctor-preflight-cli.db");
  const configRoot = join(workspace, "config");

  try {
    seedCliConfigTree(configRoot);
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.close();

    const report = runCli<{
      status: string;
      startupConsistency: {
        status: string;
        findings: Array<{ code: string; entityId: string }>;
      };
    }>("doctor.js", {
      AA_DB_PATH: dbPath,
      AA_CONFIG_ROOT: configRoot,
      OPENAI_API_KEY: "",
    });

    assert.equal(report.status, "fail_closed");
    assert.equal(report.startupConsistency.status, "fail_closed");
    assert.ok(report.startupConsistency.findings.some((finding) => finding.code === "provider_not_ready"));
    assert.ok(report.startupConsistency.findings.some((finding) => finding.entityId === "openai"));
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("doctor CLI returns grouped self-check sections for operator review", () => {
  const workspace = createTempWorkspace("aa-cli-doctor-self-check-");
  const dbPath = join(workspace, "doctor-self-check-cli.db");
  const configRoot = join(workspace, "config");
  const heartbeatAt = isoOffsetFromNow(-1_000);

  try {
    seedCliConfigTree(configRoot);
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    workers.recordHeartbeat({
      workerId: "worker-cli-doctor",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-cli-doctor-1",
      occurredAt: heartbeatAt,
    });
    db.close();

    const report = runCli<{
      status: string;
      selfCheckSummary: {
        totalChecks: number;
        okChecks: number;
        failingCheckIds: string[];
      };
      checks: Array<{ checkId: string; status: string }>;
      lockSummary: { checked: boolean; totalLocks: number };
      eventBacklogSummary: { pendingTier1Acks: number };
    }>("doctor.js", {
      AA_DB_PATH: dbPath,
      AA_CONFIG_ROOT: configRoot,
      OPENAI_API_KEY: "test-key",
    });

    assert.equal(report.status, "ok");
    assert.equal(report.selfCheckSummary.totalChecks, 8);
    assert.equal(report.selfCheckSummary.okChecks, 8);
    assert.deepEqual(report.selfCheckSummary.failingCheckIds, []);
    assert.deepEqual(
      report.checks.map((check) => check.checkId),
      ["db", "config", "backup", "locks", "workers", "event_backlog", "audit_integrity", "provider_health"],
    );
    assert.equal(report.lockSummary.checked, true);
    assert.equal(report.lockSummary.totalLocks, 0);
    assert.equal(report.eventBacklogSummary.pendingTier1Acks, 0);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("worker-handshake CLI claims a dispatched ticket and renews worker heartbeat", () => {
  const workspace = createTempWorkspace("aa-cli-worker-handshake-");
  const dbPath = join(workspace, "worker-handshake-cli.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-worker-handshake",
      executionId: "exec-cli-worker-handshake",
      traceId: "trace-cli-worker-handshake",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-cli-worker-handshake");
    workers.recordHeartbeat({
      workerId: "worker-cli-handshake",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-04T11:00:00.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:500",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-cli-handshake-1",
      occurredAt: "2026-04-04T11:00:00.000Z",
    });
    const created = dispatch.createTicket({
      executionId: "exec-cli-worker-handshake",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T11:00:05.000Z",
    });
    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T11:00:06.000Z",
    });
    db.close();

    const claimed = runCli<{
      accepted: boolean;
      reasonCode: string | null;
      ticketId: string | null;
      executionId: string | null;
    }>("worker-handshake.js", {
      AA_DB_PATH: dbPath,
      AA_WORKER_HANDSHAKE_ACTION: "claim",
      AA_TICKET_ID: created.ticket.id,
      AA_WORKER_ID: "worker-cli-handshake",
      AA_LEASE_ID: dispatched.leaseId ?? "",
      AA_FENCING_TOKEN: "1",
      AA_RUNTIME_INSTANCE_ID: "runtime-cli-handshake-1",
      AA_REMOTE_SESSION_STATUS: "connected",
      AA_LAST_ACKNOWLEDGED_STREAM_OFFSET: "stream:501",
      AA_STREAM_RESUME_SUCCESS_RATE: "0.99",
      AA_CREDENTIAL_REFRESH_SUCCESS_RATE: "0.97",
      AA_SESSION_CONSISTENCY_CHECK_STATUS: "passed",
      AA_SESSION_CONSISTENCY_CHECKED_AT: "2026-04-04T11:00:07.000Z",
      AA_SATURATION: "0.45",
      AA_ACTIVE_LEASE_COUNT: "1",
      AA_MEAN_STARTUP_LATENCY_MS: "280",
      AA_SANDBOX_SUCCESS_RATE: "0.96",
      AA_REPO_CACHE_HIT_RATE: "0.94",
      AA_OCCURRED_AT: "2026-04-04T11:00:07.000Z",
    });
    const heartbeat = runCli<{
      accepted: boolean;
      reasonCode: string | null;
      executionId: string | null;
    }>("worker-handshake.js", {
      AA_DB_PATH: dbPath,
      AA_WORKER_HANDSHAKE_ACTION: "heartbeat",
      AA_EXECUTION_ID: "exec-cli-worker-handshake",
      AA_WORKER_ID: "worker-cli-handshake",
      AA_LEASE_ID: dispatched.leaseId ?? "",
      AA_FENCING_TOKEN: "1",
      AA_LEASE_TTL_MS: "30000",
      AA_RUNTIME_INSTANCE_ID: "runtime-cli-handshake-2",
      AA_PROGRESS_MESSAGE: "cli heartbeat",
      AA_CPU_PCT: "55.5",
      AA_MEMORY_MB: "384",
      AA_REMOTE_SESSION_STATUS: "reconnecting",
      AA_LAST_ACKNOWLEDGED_STREAM_OFFSET: "stream:502",
      AA_STREAM_RESUME_SUCCESS_RATE: "0.91",
      AA_CREDENTIAL_REFRESH_SUCCESS_RATE: "0.93",
      AA_SESSION_CONSISTENCY_CHECK_STATUS: "passed",
      AA_SESSION_CONSISTENCY_CHECKED_AT: "2026-04-04T11:00:08.000Z",
      AA_SATURATION: "0.62",
      AA_ACTIVE_LEASE_COUNT: "2",
      AA_MEAN_STARTUP_LATENCY_MS: "325",
      AA_SANDBOX_SUCCESS_RATE: "0.95",
      AA_REPO_CACHE_HIT_RATE: "0.89",
      AA_TOOL_BACKLOG_COUNT: "6",
      AA_CURRENT_STEP_ID: "step-cli-heartbeat",
      AA_OCCURRED_AT: "2026-04-04T11:00:08.000Z",
    });
    const reloaded = new SqliteDatabase(dbPath);
    const reloadedStore = new AuthoritativeTaskStore(reloaded);
    const worker = reloadedStore.getWorkerSnapshot("worker-cli-handshake");
    reloaded.close();

    assert.equal(claimed.accepted, true);
    assert.equal(claimed.ticketId, created.ticket.id);
    assert.equal(heartbeat.accepted, true);
    assert.equal(heartbeat.executionId, "exec-cli-worker-handshake");
    assert.equal(worker?.cpuPct, 55.5);
    assert.equal(worker?.memoryMb, 384);
    assert.equal(worker?.toolBacklogCount, 6);
    assert.equal(worker?.currentStepId, "step-cli-heartbeat");
    assert.equal(worker?.runtimeInstanceId, "runtime-cli-handshake-2");
    assert.equal(worker?.restartedFromRuntimeInstanceId, "runtime-cli-handshake-1");
    assert.equal(worker?.restartGeneration, 1);
    assert.equal(worker?.remoteSessionStatus, "reconnecting");
    assert.equal(worker?.lastAcknowledgedStreamOffset, "stream:502");
    assert.equal(worker?.streamResumeSuccessRate, 0.91);
    assert.equal(worker?.credentialRefreshSuccessRate, 0.93);
    assert.equal(worker?.sessionConsistencyCheckStatus, "passed");
    assert.equal(worker?.sessionConsistencyCheckedAt, "2026-04-04T11:00:08.000Z");
    assert.equal(worker?.saturation, 0.62);
    assert.equal(worker?.activeLeaseCount, 2);
    assert.equal(worker?.meanStartupLatencyMs, 325);
    assert.equal(worker?.sandboxSuccessRate, 0.95);
    assert.equal(worker?.repoCacheHitRate, 0.89);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("worker-handshake CLI fail-closes remote sessions that lose resume authority", () => {
  const workspace = createTempWorkspace("aa-cli-worker-handshake-");
  const dbPath = join(workspace, "worker-handshake-cli-remote-guard.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-worker-handshake-guard",
      executionId: "exec-cli-worker-handshake-guard",
      traceId: "trace-cli-worker-handshake-guard",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-cli-worker-handshake-guard");
    workers.recordHeartbeat({
      workerId: "worker-cli-handshake-guard",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-04T11:10:00.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:600",
      sessionConsistencyCheckStatus: "passed",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-cli-handshake-guard-1",
      occurredAt: "2026-04-04T11:10:00.000Z",
    });
    const created = dispatch.createTicket({
      executionId: "exec-cli-worker-handshake-guard",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T11:10:05.000Z",
    });
    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T11:10:06.000Z",
    });
    db.close();

    const claimed = runCli<{
      accepted: boolean;
      reasonCode: string | null;
      ticketId: string | null;
      executionId: string | null;
    }>("worker-handshake.js", {
      AA_DB_PATH: dbPath,
      AA_WORKER_HANDSHAKE_ACTION: "claim",
      AA_TICKET_ID: created.ticket.id,
      AA_WORKER_ID: "worker-cli-handshake-guard",
      AA_LEASE_ID: dispatched.leaseId ?? "",
      AA_FENCING_TOKEN: "1",
      AA_RUNTIME_INSTANCE_ID: "runtime-cli-handshake-guard-1",
      AA_REMOTE_SESSION_STATUS: "connected",
      AA_LAST_ACKNOWLEDGED_STREAM_OFFSET: "stream:601",
      AA_SESSION_CONSISTENCY_CHECK_STATUS: "passed",
      AA_OCCURRED_AT: "2026-04-04T11:10:07.000Z",
    });
    const heartbeat = runCli<{
      accepted: boolean;
      reasonCode: string | null;
      executionId: string | null;
    }>("worker-handshake.js", {
      AA_DB_PATH: dbPath,
      AA_WORKER_HANDSHAKE_ACTION: "heartbeat",
      AA_EXECUTION_ID: "exec-cli-worker-handshake-guard",
      AA_WORKER_ID: "worker-cli-handshake-guard",
      AA_LEASE_ID: dispatched.leaseId ?? "",
      AA_FENCING_TOKEN: "1",
      AA_LEASE_TTL_MS: "30000",
      AA_RUNTIME_INSTANCE_ID: "runtime-cli-handshake-guard-1",
      AA_REMOTE_SESSION_STATUS: "reconnecting",
      AA_LAST_ACKNOWLEDGED_STREAM_OFFSET: "",
      AA_SESSION_CONSISTENCY_CHECK_STATUS: "passed",
      AA_OCCURRED_AT: "2026-04-04T11:10:08.000Z",
    });
    const reloaded = new SqliteDatabase(dbPath);
    const reloadedStore = new AuthoritativeTaskStore(reloaded);
    const lease = reloadedStore.getExecutionLease(dispatched.leaseId ?? "");
    const events = reloadedStore.listEventsForTask("task-cli-worker-handshake-guard");
    reloaded.close();

    assert.equal(claimed.accepted, true);
    assert.equal(heartbeat.accepted, false);
    assert.equal(heartbeat.reasonCode, "remote_session_resume_offset_missing");
    assert.ok(lease?.lastHeartbeatAt == null || lease.lastHeartbeatAt < "2026-04-04T11:10:08.000Z");
    assert.ok(
      events.some((event) => {
        if (event.eventType !== "worker:heartbeat_rejected") {
          return false;
        }
        const payload = JSON.parse(event.payloadJson) as { reasonCode?: string | null };
        return payload.reasonCode === "remote_session_resume_offset_missing";
      }),
    );
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("worker-handshake CLI fail-closes remote sessions with workspace sync conflicts", () => {
  const workspace = createTempWorkspace("aa-cli-worker-handshake-");
  const dbPath = join(workspace, "worker-handshake-cli-workspace-conflict.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-worker-handshake-workspace-conflict",
      executionId: "exec-cli-worker-handshake-workspace-conflict",
      traceId: "trace-cli-worker-handshake-workspace-conflict",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-cli-worker-handshake-workspace-conflict");
    workers.recordHeartbeat({
      workerId: "worker-cli-handshake-workspace-conflict",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-07T11:10:00.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:610",
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "aligned",
      workspaceSyncCheckedAt: "2026-04-07T11:10:00.000Z",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-cli-handshake-workspace-conflict-1",
      occurredAt: "2026-04-07T11:10:00.000Z",
    });
    const created = dispatch.createTicket({
      executionId: "exec-cli-worker-handshake-workspace-conflict",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-07T11:10:05.000Z",
    });
    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-07T11:10:06.000Z",
    });
    db.close();

    const claimed = runCli<{
      accepted: boolean;
      reasonCode: string | null;
      ticketId: string | null;
      executionId: string | null;
    }>("worker-handshake.js", {
      AA_DB_PATH: dbPath,
      AA_WORKER_HANDSHAKE_ACTION: "claim",
      AA_TICKET_ID: created.ticket.id,
      AA_WORKER_ID: "worker-cli-handshake-workspace-conflict",
      AA_LEASE_ID: dispatched.leaseId ?? "",
      AA_FENCING_TOKEN: "1",
      AA_RUNTIME_INSTANCE_ID: "runtime-cli-handshake-workspace-conflict-1",
      AA_REMOTE_SESSION_STATUS: "connected",
      AA_LAST_ACKNOWLEDGED_STREAM_OFFSET: "stream:611",
      AA_SESSION_CONSISTENCY_CHECK_STATUS: "passed",
      AA_WORKSPACE_SYNC_STATUS: "conflict",
      AA_WORKSPACE_SYNC_CHECKED_AT: "2026-04-07T11:10:07.000Z",
      AA_OCCURRED_AT: "2026-04-07T11:10:07.000Z",
    });
    const reloaded = new SqliteDatabase(dbPath);
    const reloadedStore = new AuthoritativeTaskStore(reloaded);
    const events = reloadedStore.listEventsForTask("task-cli-worker-handshake-workspace-conflict");
    reloaded.close();

    assert.equal(claimed.accepted, false);
    assert.equal(claimed.reasonCode, "remote_workspace_sync_conflict");
    assert.ok(
      events.some((event) => {
        if (event.eventType !== "worker:claim_rejected") {
          return false;
        }
        const payload = JSON.parse(event.payloadJson) as { reasonCode?: string | null; workspaceSyncStatus?: string | null };
        return payload.reasonCode === "remote_workspace_sync_conflict" && payload.workspaceSyncStatus === "conflict";
      }),
    );
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("worker-writeback CLI records a terminal worker completion and releases runtime ownership", () => {
  const workspace = createTempWorkspace("aa-cli-worker-writeback-");
  const dbPath = join(workspace, "worker-writeback-cli.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const handshake = new ExecutionWorkerHandshakeService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-worker-writeback",
      executionId: "exec-cli-worker-writeback",
      traceId: "trace-cli-worker-writeback",
    });
    seedWorkflowAndSession(db, store, {
      taskId: "task-cli-worker-writeback",
      sessionId: "sess-cli-worker-writeback",
      workflowStatus: "running",
      sessionStatus: "streaming",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-cli-worker-writeback");
    workers.recordHeartbeat({
      workerId: "worker-cli-writeback",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-cli-writeback-1",
      occurredAt: "2026-04-04T12:00:00.000Z",
    });
    const created = dispatch.createTicket({
      executionId: "exec-cli-worker-writeback",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T12:00:05.000Z",
    });
    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T12:00:06.000Z",
    });
    handshake.claimExecution({
      ticketId: created.ticket.id,
      workerId: "worker-cli-writeback",
      leaseId: dispatched.leaseId ?? "",
      fencingToken: 1,
      runtimeInstanceId: "runtime-cli-writeback-1",
      occurredAt: "2026-04-04T12:00:07.000Z",
    });
    db.close();

    const writeback = runCli<{
      accepted: boolean;
      reasonCode: string | null;
      executionId: string | null;
      terminalStatus: string | null;
    }>("worker-writeback.js", {
      AA_DB_PATH: dbPath,
      AA_EXECUTION_ID: "exec-cli-worker-writeback",
      AA_WORKER_ID: "worker-cli-writeback",
      AA_LEASE_ID: dispatched.leaseId ?? "",
      AA_FENCING_TOKEN: "1",
      AA_RUNTIME_INSTANCE_ID: "runtime-cli-writeback-2",
      AA_TERMINAL_STATUS: "done",
      AA_TASK_OUTPUT_JSON: JSON.stringify({ summary: "cli done" }),
      AA_WORKFLOW_OUTPUTS_JSON: JSON.stringify({ final: { summary: "cli done" } }),
      AA_PROGRESS_MESSAGE: "cli writeback",
      AA_OCCURRED_AT: "2026-04-04T12:00:08.000Z",
    });

    const reloaded = new SqliteDatabase(dbPath);
    const reloadedStore = new AuthoritativeTaskStore(reloaded);
    const snapshot = reloadedStore.loadTaskSnapshot("task-cli-worker-writeback");
    const worker = reloadedStore.getWorkerSnapshot("worker-cli-writeback");
    const lease = reloadedStore.getExecutionLease(dispatched.leaseId ?? "");
    reloaded.close();

    assert.equal(writeback.accepted, true);
    assert.equal(writeback.executionId, "exec-cli-worker-writeback");
    assert.equal(writeback.terminalStatus, "done");
    assert.equal(snapshot.task.status, "done");
    assert.equal(snapshot.execution?.status, "succeeded");
    assert.equal(snapshot.workflow?.status, "completed");
    assert.equal(snapshot.session?.status, "completed");
    assert.equal(worker?.status, "idle");
    assert.equal(worker?.runtimeInstanceId, "runtime-cli-writeback-2");
    assert.equal(worker?.restartedFromRuntimeInstanceId, "runtime-cli-writeback-1");
    assert.equal(worker?.restartGeneration, 1);
    assert.equal(lease?.status, "released");
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("worker-writeback CLI fail-closes remote sessions with workspace sync conflicts", () => {
  const workspace = createTempWorkspace("aa-cli-worker-writeback-");
  const dbPath = join(workspace, "worker-writeback-cli-workspace-conflict.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const handshake = new ExecutionWorkerHandshakeService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-worker-writeback-workspace-conflict",
      executionId: "exec-cli-worker-writeback-workspace-conflict",
      traceId: "trace-cli-worker-writeback-workspace-conflict",
    });
    seedWorkflowAndSession(db, store, {
      taskId: "task-cli-worker-writeback-workspace-conflict",
      sessionId: "sess-cli-worker-writeback-workspace-conflict",
      workflowStatus: "running",
      sessionStatus: "streaming",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-cli-worker-writeback-workspace-conflict");
    workers.recordHeartbeat({
      workerId: "worker-cli-writeback-workspace-conflict",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-07T12:00:00.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:920",
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "aligned",
      workspaceSyncCheckedAt: "2026-04-07T12:00:00.000Z",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-cli-writeback-workspace-conflict-1",
      occurredAt: "2026-04-07T12:00:00.000Z",
    });
    const created = dispatch.createTicket({
      executionId: "exec-cli-worker-writeback-workspace-conflict",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-07T12:00:05.000Z",
    });
    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-07T12:00:06.000Z",
    });
    handshake.claimExecution({
      ticketId: created.ticket.id,
      workerId: "worker-cli-writeback-workspace-conflict",
      leaseId: dispatched.leaseId ?? "",
      fencingToken: 1,
      runtimeInstanceId: "runtime-cli-writeback-workspace-conflict-1",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:921",
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "aligned",
      workspaceSyncCheckedAt: "2026-04-07T12:00:07.000Z",
      occurredAt: "2026-04-07T12:00:07.000Z",
    });
    db.close();

    const writeback = runCli<{
      accepted: boolean;
      reasonCode: string | null;
      executionId: string | null;
      terminalStatus: string | null;
    }>("worker-writeback.js", {
      AA_DB_PATH: dbPath,
      AA_EXECUTION_ID: "exec-cli-worker-writeback-workspace-conflict",
      AA_WORKER_ID: "worker-cli-writeback-workspace-conflict",
      AA_LEASE_ID: dispatched.leaseId ?? "",
      AA_FENCING_TOKEN: "1",
      AA_RUNTIME_INSTANCE_ID: "runtime-cli-writeback-workspace-conflict-1",
      AA_TERMINAL_STATUS: "done",
      AA_WORKSPACE_SYNC_STATUS: "conflict",
      AA_WORKSPACE_SYNC_CHECKED_AT: "2026-04-07T12:00:08.000Z",
      AA_OCCURRED_AT: "2026-04-07T12:00:08.000Z",
    });
    const reloaded = new SqliteDatabase(dbPath);
    const reloadedStore = new AuthoritativeTaskStore(reloaded);
    const snapshot = reloadedStore.loadTaskSnapshot("task-cli-worker-writeback-workspace-conflict");
    const lease = reloadedStore.getExecutionLease(dispatched.leaseId ?? "");
    const events = reloadedStore.listEventsForTask("task-cli-worker-writeback-workspace-conflict");
    reloaded.close();

    assert.equal(writeback.accepted, false);
    assert.equal(writeback.reasonCode, "remote_workspace_sync_conflict");
    assert.equal(snapshot.execution?.status, "executing");
    assert.equal(lease?.status, "active");
    assert.ok(
      events.some((event) => {
        if (event.eventType !== "worker:writeback_rejected") {
          return false;
        }
        const payload = JSON.parse(event.payloadJson) as { reasonCode?: string | null; workspaceSyncStatus?: string | null };
        return payload.reasonCode === "remote_workspace_sync_conflict" && payload.workspaceSyncStatus === "conflict";
      }),
    );
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("lease-handover CLI transfers an active lease to a replacement worker with lineage", () => {
  const workspace = createTempWorkspace("aa-cli-lease-handover-");
  const dbPath = join(workspace, "lease-handover-cli.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const leases = new ExecutionLeaseService(db, store);
    const workers = new WorkerRegistryService(store);
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-lease-handover",
      executionId: "exec-cli-lease-handover",
      traceId: "trace-cli-lease-handover",
    });
    workers.recordHeartbeat({
      workerId: "worker-cli-handover-a",
      status: "draining",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-cli-lease-handover"],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-06T11:00:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-cli-handover-b",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-06T11:00:00.000Z",
    });
    const granted = leases.acquireLease({
      executionId: "exec-cli-lease-handover",
      workerId: "worker-cli-handover-a",
      ttlMs: 30_000,
      occurredAt: "2026-04-06T11:00:00.000Z",
    });
    db.close();

    const handover = runCli<{
      outcome: string;
      reasonCode: string | null;
      previousLease: { id: string; status: string; reasonCode: string | null } | null;
      lease: { id: string; workerId: string; fencingToken: number } | null;
    }>("lease-handover.js", {
      AA_DB_PATH: dbPath,
      AA_LEASE_ID: granted.lease?.id ?? "",
      AA_WORKER_ID: "worker-cli-handover-a",
      AA_NEW_WORKER_ID: "worker-cli-handover-b",
      AA_LEASE_TTL_MS: "30000",
      AA_REASON_CODE: "worker_draining_handover",
      AA_OCCURRED_AT: "2026-04-06T11:00:10.000Z",
    });
    const taskInspect = runCli<{
      leaseHandoverSummary: {
        totalHandovers: number;
        latestReasonCode: string | null;
        latestPreviousWorkerId: string | null;
        latestWorkerId: string | null;
      };
    }>("inspect.js", {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "task",
      AA_TASK_ID: "task-cli-lease-handover",
    });
    const reloaded = new SqliteDatabase(dbPath);
    const reloadedStore = new AuthoritativeTaskStore(reloaded);
    const execution = reloadedStore.getExecution("exec-cli-lease-handover");
    const previousWorker = reloadedStore.getWorkerSnapshot("worker-cli-handover-a");
    const nextWorker = reloadedStore.getWorkerSnapshot("worker-cli-handover-b");
    const events = reloadedStore.listEventsForTask("task-cli-lease-handover");
    reloaded.close();

    assert.equal(handover.outcome, "handed_over");
    assert.equal(handover.previousLease?.status, "released");
    assert.equal(handover.previousLease?.reasonCode, "worker_draining_handover");
    assert.equal(handover.lease?.workerId, "worker-cli-handover-b");
    assert.equal(handover.lease?.fencingToken, 2);
    assert.equal(taskInspect.leaseHandoverSummary.totalHandovers, 1);
    assert.equal(taskInspect.leaseHandoverSummary.latestReasonCode, "worker_draining_handover");
    assert.equal(taskInspect.leaseHandoverSummary.latestPreviousWorkerId, "worker-cli-handover-a");
    assert.equal(taskInspect.leaseHandoverSummary.latestWorkerId, "worker-cli-handover-b");
    assert.equal(execution?.agentId, "worker-cli-handover-b");
    assert.equal(previousWorker?.runningExecutionsJson, "[]");
    assert.ok(nextWorker?.runningExecutionsJson.includes("exec-cli-lease-handover"));
    assert.ok(
      events.some((event) => {
        if (event.eventType !== "lease:handover_recorded") {
          return false;
        }
        const payload = JSON.parse(event.payloadJson) as { previousWorkerId?: string; workerId?: string };
        return payload.previousWorkerId === "worker-cli-handover-a" && payload.workerId === "worker-cli-handover-b";
      }),
    );
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("takeover CLI opens a session and applies operator overrides", () => {
  const workspace = createTempWorkspace("aa-cli-takeover-");
  const dbPath = join(workspace, "takeover-cli.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-takeover",
      executionId: "exec-cli-takeover",
      traceId: "trace-cli-takeover",
    });
    seedWorkflowAndSession(db, store, {
      taskId: "task-cli-takeover",
      sessionId: "sess-cli-takeover",
      workflowStatus: "running",
      sessionStatus: "open",
    });
    db.close();

    const opened = runCli<{ takeoverSessionId: string; taskId: string }>("takeover.js", {
      AA_DB_PATH: dbPath,
      AA_TAKEOVER_ACTION: "open",
      AA_TASK_ID: "task-cli-takeover",
      AA_OPERATOR_ID: "operator-cli",
      AA_REASON_CODE: "incident.cli_open",
    });

    runCli<{ executionId: string | null }>("takeover.js", {
      AA_DB_PATH: dbPath,
      AA_TAKEOVER_ACTION: "switch_worker",
      AA_TAKEOVER_SESSION_ID: opened.takeoverSessionId,
      AA_AGENT_ID: "agent-cli-manual",
      AA_REASON_CODE: "incident.cli_switch",
    });

    const reloaded = new SqliteDatabase(dbPath);
    const reloadedStore = new AuthoritativeTaskStore(reloaded);
    const snapshot = reloadedStore.loadTaskSnapshot("task-cli-takeover");
    const takeoverSessions = reloadedStore.listTakeoverSessionsByTask("task-cli-takeover");
    const operatorActions = reloadedStore.listOperatorActionsByTask("task-cli-takeover");

    assert.equal(opened.taskId, "task-cli-takeover");
    assert.equal(snapshot.execution?.agentId, "agent-cli-manual");
    assert.equal(takeoverSessions.length, 1);
    assert.equal(takeoverSessions[0]?.id, opened.takeoverSessionId);
    assert.equal(operatorActions.length, 2);
    assert.equal(operatorActions.at(-1)?.actionType, "switch_worker");
    reloaded.close();
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("takeover CLI supports workflow repair actions for manual output injection and step reset", () => {
  const workspace = createTempWorkspace("aa-cli-takeover-repair-");
  const dbPath = join(workspace, "takeover-repair-cli.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-cli-takeover-repair",
      executionId: "exec-cli-takeover-repair",
      traceId: "trace-cli-takeover-repair",
    });
    db.connection
      .prepare(`UPDATE executions SET workflow_id = ?, role_id = ? WHERE id = ?`)
      .run("single_division_multi_step_orchestration", "workflow_planner", "exec-cli-takeover-repair");
    seedWorkflowAndSession(db, store, {
      taskId: "task-cli-takeover-repair",
      sessionId: "sess-cli-takeover-repair",
      workflowId: "single_division_multi_step_orchestration",
      currentStepIndex: 2,
      outputsJson: JSON.stringify({
        triage: { summary: "triaged", result: "triaged" },
      }),
      resumableFromStep: "final_review",
      workflowStatus: "failed",
      sessionStatus: "failed",
    });
    db.close();

    const opened = runCli<{ takeoverSessionId: string }>("takeover.js", {
      AA_DB_PATH: dbPath,
      AA_TAKEOVER_ACTION: "open",
      AA_TASK_ID: "task-cli-takeover-repair",
      AA_OPERATOR_ID: "operator-cli-repair",
      AA_REASON_CODE: "incident.cli_open_repair",
    });

    runCli<{ executionId: string | null }>("takeover.js", {
      AA_DB_PATH: dbPath,
      AA_TAKEOVER_ACTION: "write_step_output",
      AA_TAKEOVER_SESSION_ID: opened.takeoverSessionId,
      AA_STEP_ID: "draft_solution",
      AA_STEP_OUTPUT_JSON: JSON.stringify({
        summary: "CLI manual draft",
        result: "Recovered by CLI takeover",
      }),
      AA_STEP_STATUS: "succeeded",
      AA_REASON_CODE: "incident.cli_write_output",
    });

    runCli<{ executionId: string | null }>("takeover.js", {
      AA_DB_PATH: dbPath,
      AA_TAKEOVER_ACTION: "set_current_step",
      AA_TAKEOVER_SESSION_ID: opened.takeoverSessionId,
      AA_STEP_ID: "draft_solution",
      AA_REASON_CODE: "incident.cli_set_step",
    });

    const reloaded = new SqliteDatabase(dbPath);
    const reloadedStore = new AuthoritativeTaskStore(reloaded);
    const snapshot = reloadedStore.loadTaskSnapshot("task-cli-takeover-repair");
    const operatorActions = reloadedStore.listOperatorActionsByTask("task-cli-takeover-repair");
    const outputs = JSON.parse(snapshot.workflow?.outputsJson ?? "{}") as Record<string, { result?: string; summary?: string }>;

    assert.equal(snapshot.workflow?.currentStepIndex, 1);
    assert.equal(snapshot.workflow?.resumableFromStep, "draft_solution");
    assert.equal(snapshot.stepOutputs.length, 1);
    assert.equal(snapshot.stepOutputs[0]?.stepId, "draft_solution");
    assert.equal(snapshot.stepOutputs[0]?.summary, "CLI manual draft");
    assert.equal(outputs.draft?.result, "Recovered by CLI takeover");
    assert.deepEqual(
      operatorActions.map((action) => action.actionType),
      ["take_over_task", "write_step_output", "set_current_step"],
    );
    reloaded.close();
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable evidence CLI writes a short local evidence bundle", () => {
  const workspace = createTempWorkspace("aa-cli-evidence-");
  const outputDir = join(workspace, "stable-evidence");

  try {
    const report = runCli<{
      artifacts: {
        bundleReportPath: string;
        chaosReportPath: string;
        promptInjectionReportPath: string;
        leaseReportPath: string;
        rollbackReportPath: string;
        backupRestorePlaybookPath: string;
        rollingUpgradeReportPath: string;
        rollingUpgradePlaybookPath: string;
        grayReleaseReportPath: string;
        grayReleasePlaybookPath: string;
        validationReportPath: string;
        soakReportPath: string;
      };
      summary: {
        passed: boolean;
        chaosPassed: boolean;
        promptInjectionPassed: boolean;
        leasePassed: boolean;
        rollbackPassed: boolean;
        rollingUpgradePassed: boolean;
        grayReleasePassed: boolean;
        totalChaosScenarios: number;
        totalPromptInjectionScenarios: number;
        totalRollingUpgradeScenarios: number;
        totalGrayReleaseScenarios: number;
        totalRollbackScenarios: number;
        totalValidationRuns: number;
        totalSoakRuns: number;
      };
    }>("stable-evidence.js", {
      AA_STABLE_EVIDENCE_OUTPUT_DIR: outputDir,
      AA_STABLE_EVIDENCE_PROFILE: "smoke",
      AA_STABLE_EVIDENCE_VALIDATION_ITERATIONS: "1",
      AA_STABLE_EVIDENCE_DURATION_MS: "600",
      AA_STABLE_EVIDENCE_INTERVAL_MS: "100",
      AA_STABLE_EVIDENCE_ITERATIONS_PER_CYCLE: "1",
    });

    assert.equal(report.summary.passed, true);
    assert.equal(report.summary.chaosPassed, true);
    assert.equal(report.summary.promptInjectionPassed, true);
    assert.equal(report.summary.leasePassed, true);
    assert.equal(report.summary.rollbackPassed, true);
    assert.equal(report.summary.rollingUpgradePassed, true);
    assert.equal(report.summary.grayReleasePassed, true);
    assert.equal(report.summary.totalChaosScenarios, 5);
    assert.equal(report.summary.totalPromptInjectionScenarios, 5);
    assert.equal(report.summary.totalRollingUpgradeScenarios, 2);
    assert.equal(report.summary.totalGrayReleaseScenarios, 2);
    assert.equal(report.summary.totalRollbackScenarios, 2);
    assert.ok(report.summary.totalValidationRuns >= 2);
    assert.ok(report.summary.totalSoakRuns >= 2);
    assert.equal(existsSync(report.artifacts.bundleReportPath), true);
    assert.equal(existsSync(report.artifacts.chaosReportPath), true);
    assert.equal(existsSync(report.artifacts.promptInjectionReportPath), true);
    assert.equal(existsSync(report.artifacts.leaseReportPath), true);
    assert.equal(existsSync(report.artifacts.rollbackReportPath), true);
    assert.equal(existsSync(report.artifacts.backupRestorePlaybookPath), true);
    assert.equal(existsSync(report.artifacts.rollingUpgradeReportPath), true);
    assert.equal(existsSync(report.artifacts.rollingUpgradePlaybookPath), true);
    assert.equal(existsSync(report.artifacts.grayReleaseReportPath), true);
    assert.equal(existsSync(report.artifacts.grayReleasePlaybookPath), true);
    assert.equal(existsSync(report.artifacts.validationReportPath), true);
    assert.equal(existsSync(report.artifacts.soakReportPath), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable chaos CLI writes a local chaos smoke report", () => {
  const workspace = createTempWorkspace("aa-cli-chaos-");
  const outputDir = join(workspace, "stable-chaos");

  try {
    const report = runCli<{
      failedScenarios: number;
      totalScenarios: number;
      scenarios: Array<{ passed: boolean }>;
    }>("stable-chaos.js", {
      AA_STABLE_CHAOS_OUTPUT_DIR: outputDir,
    });

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 5);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.equal(existsSync(join(outputDir, "stable-chaos-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable prompt injection CLI writes a local red-team report", () => {
  const workspace = createTempWorkspace("aa-cli-prompt-red-team-");
  const outputDir = join(workspace, "stable-prompt-injection");

  try {
    const report = runCli<{
      failedScenarios: number;
      totalScenarios: number;
      scenarios: Array<{ scenarioId: string; passed: boolean; actualRisk: string; redactionCount: number }>;
    }>("stable-prompt-injection.js", {
      AA_STABLE_PROMPT_INJECTION_OUTPUT_DIR: outputDir,
    });

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 5);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(
      report.scenarios.some(
        (scenario) =>
          scenario.scenarioId === "instruction_override_secret_exfiltration" &&
          scenario.actualRisk === "high" &&
          scenario.redactionCount > 0,
      ),
    );
    assert.ok(
      report.scenarios.some(
        (scenario) => scenario.scenarioId === "benign_runtime_control" && scenario.actualRisk === "none",
      ),
    );
    assert.equal(existsSync(join(outputDir, "stable-prompt-injection-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable concurrency CLI writes a local concurrency rehearsal report", () => {
  const workspace = createTempWorkspace("aa-cli-concurrency-");
  const outputDir = join(workspace, "stable-concurrency");

  try {
    const report = runCli<{
      failedScenarios: number;
      totalScenarios: number;
      scenarios: Array<{ passed: boolean }>;
    }>("stable-concurrency.js", {
      AA_STABLE_CONCURRENCY_OUTPUT_DIR: outputDir,
    });

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 3);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.equal(existsSync(join(outputDir, "stable-concurrency-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable rollback CLI writes a local rollback rehearsal report", () => {
  const workspace = createTempWorkspace("aa-cli-rollback-");
  const outputDir = join(workspace, "stable-rollback");

  try {
    const report = runCli<{
      failedScenarios: number;
      totalScenarios: number;
      artifacts: {
        reportPath: string;
        playbookPath: string;
      };
      playbook: {
        rollbackOwner: string;
        targets: Array<{ targetId: string }>;
      };
      scenarios: Array<{ passed: boolean }>;
    }>("stable-rollback.js", {
      AA_STABLE_ROLLBACK_OUTPUT_DIR: outputDir,
    });

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 2);
    assert.equal(report.artifacts.reportPath, join(outputDir, "stable-rollback-report.json"));
    assert.equal(report.artifacts.playbookPath, join(outputDir, "stable-rollback-playbook.json"));
    assert.equal(report.playbook.rollbackOwner, "release_manager_oncall");
    assert.ok(report.playbook.targets.some((target) => target.targetId === "config_bundle"));
    assert.ok(report.playbook.targets.some((target) => target.targetId === "feature_flag"));
    assert.ok(report.playbook.targets.some((target) => target.targetId === "worker_version"));
    assert.ok(report.playbook.targets.some((target) => target.targetId === "prompt_bundle"));
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.equal(existsSync(join(outputDir, "stable-rollback-report.json")), true);
    assert.equal(existsSync(join(outputDir, "stable-rollback-playbook.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable recovery drill CLI writes a local cross-division recovery drill report", () => {
  const workspace = createTempWorkspace("aa-cli-stable-recovery-drill-");

  try {
    const report = runCli<{
      failedScenarios: number;
      totalScenarios: number;
      scenarios: Array<{ scenarioId: string; passed: boolean }>;
    }>("stable-recovery-drill.js", {
      AA_STABLE_RECOVERY_DRILL_OUTPUT_DIR: workspace,
    });

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 2);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "cross_division_overview"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "cross_division_replay_matrix"));
    assert.equal(existsSync(join(workspace, "stable-recovery-drill-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable dispatch CLI writes a local dispatch rehearsal report", () => {
  const workspace = createTempWorkspace("aa-cli-stable-dispatch-");

  try {
    const report = runCli<{
      failedScenarios: number;
      totalScenarios: number;
      scenarios: Array<{ scenarioId: string; passed: boolean }>;
    }>("stable-dispatch.js", {
      AA_STABLE_DISPATCH_OUTPUT_DIR: workspace,
    });

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 4);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "dispatch_claims_capable_worker"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "dispatch_balances_affinity_against_hotspot_load"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "dispatch_respects_dispatch_after"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "dispatch_reports_no_worker_for_capability_gap"));
    assert.equal(existsSync(join(workspace, "stable-dispatch-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable dispatch reconcile CLI writes a local dispatch reconciliation rehearsal report", () => {
  const workspace = createTempWorkspace("aa-cli-stable-dispatch-reconcile-");

  try {
    const report = runCli<{
      failedScenarios: number;
      totalScenarios: number;
      scenarios: Array<{ scenarioId: string; passed: boolean }>;
    }>("stable-dispatch-reconcile.js", {
      AA_STABLE_DISPATCH_RECONCILE_OUTPUT_DIR: workspace,
    });

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 2);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "orphan_claim_requeued"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "terminal_execution_ticket_cancelled"));
    assert.equal(existsSync(join(workspace, "stable-dispatch-reconcile-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable worker handshake CLI writes a local worker handshake rehearsal report", () => {
  const workspace = createTempWorkspace("aa-cli-stable-worker-handshake-");

  try {
    const report = runCli<{
      failedScenarios: number;
      totalScenarios: number;
      scenarios: Array<{ scenarioId: string; passed: boolean }>;
    }>("stable-worker-handshake.js", {
      AA_STABLE_WORKER_HANDSHAKE_OUTPUT_DIR: workspace,
    });

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 3);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "worker_claim_consumes_ticket"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "worker_heartbeat_renews_lease"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "stale_fencing_handshake_rejected"));
    assert.equal(existsSync(join(workspace, "stable-worker-handshake-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable worker writeback CLI writes a local worker writeback rehearsal report", () => {
  const workspace = createTempWorkspace("aa-cli-stable-worker-writeback-");

  try {
    const report = runCli<{
      failedScenarios: number;
      totalScenarios: number;
      scenarios: Array<{ scenarioId: string; passed: boolean }>;
    }>("stable-worker-writeback.js", {
      AA_STABLE_WORKER_WRITEBACK_OUTPUT_DIR: workspace,
    });

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 3);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "worker_writeback_completes_execution"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "duplicate_writeback_rejected"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "stale_fencing_writeback_rejected"));
    assert.equal(existsSync(join(workspace, "stable-worker-writeback-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable lease CLI writes a local lease rehearsal report", () => {
  const workspace = createTempWorkspace("aa-cli-lease-");
  const outputDir = join(workspace, "stable-lease");

  try {
    const report = runCli<{
      failedScenarios: number;
      totalScenarios: number;
      scenarios: Array<{ passed: boolean }>;
    }>("stable-lease.js", {
      AA_STABLE_LEASE_OUTPUT_DIR: outputDir,
    });

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 4);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.equal(existsSync(join(outputDir, "stable-lease-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable restore CLI writes a local backup restore rehearsal report", () => {
  const workspace = createTempWorkspace("aa-cli-restore-");
  const outputDir = join(workspace, "stable-restore");

  try {
    const report = runCli<{
      failedScenarios: number;
      totalScenarios: number;
      artifacts: {
        reportPath: string;
        playbookPath: string;
      };
      playbook: {
        recoveryOwner: string;
        targetRpo: string;
        targetRto: string;
        targets: Array<{ targetId: string }>;
      };
      scenarios: Array<{ passed: boolean }>;
    }>("stable-restore.js", {
      AA_STABLE_RESTORE_OUTPUT_DIR: outputDir,
    });

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 1);
    assert.equal(report.artifacts.reportPath, join(outputDir, "stable-backup-restore-report.json"));
    assert.equal(report.artifacts.playbookPath, join(outputDir, "stable-disaster-recovery-playbook.json"));
    assert.equal(report.playbook.recoveryOwner, "runtime_reliability_oncall");
    assert.equal(report.playbook.targetRpo, "15m");
    assert.equal(report.playbook.targetRto, "30m");
    assert.ok(report.playbook.targets.some((target) => target.targetId === "restored_runtime"));
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.equal(existsSync(join(outputDir, "stable-backup-restore-report.json")), true);
    assert.equal(existsSync(join(outputDir, "stable-disaster-recovery-playbook.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable upgrade CLI writes a local rolling upgrade rehearsal report", () => {
  const workspace = createTempWorkspace("aa-cli-upgrade-");
  const outputDir = join(workspace, "stable-upgrade");

  try {
    const report = runCli<{
      failedScenarios: number;
      totalScenarios: number;
      artifacts: {
        reportPath: string;
        playbookPath: string;
      };
      playbook: {
        upgradeOwner: string;
        targets: Array<{ targetId: string }>;
      };
      scenarios: Array<{ passed: boolean }>;
    }>("stable-upgrade.js", {
      AA_STABLE_UPGRADE_OUTPUT_DIR: outputDir,
    });

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 2);
    assert.equal(report.artifacts.reportPath, join(outputDir, "stable-rolling-upgrade-report.json"));
    assert.equal(report.artifacts.playbookPath, join(outputDir, "stable-rolling-upgrade-playbook.json"));
    assert.equal(report.playbook.upgradeOwner, "release_manager_oncall");
    assert.ok(report.playbook.targets.some((target) => target.targetId === "dispatch_policy"));
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.equal(existsSync(join(outputDir, "stable-rolling-upgrade-report.json")), true);
    assert.equal(existsSync(join(outputDir, "stable-rolling-upgrade-playbook.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable maintenance CLI writes a local maintenance rehearsal report", () => {
  const workspace = createTempWorkspace("aa-cli-maintenance-");
  const outputDir = join(workspace, "stable-maintenance");

  try {
    const report = runCli<{
      failedScenarios: number;
      totalScenarios: number;
      artifacts: {
        reportPath: string;
        playbookPath: string;
      };
      playbook: {
        maintenanceOwner: string;
        targets: Array<{ targetId: string }>;
      };
      scenarios: Array<{ passed: boolean }>;
    }>("stable-maintenance.js", {
      AA_STABLE_MAINTENANCE_OUTPUT_DIR: outputDir,
    });

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 2);
    assert.equal(report.artifacts.reportPath, join(outputDir, "stable-maintenance-report.json"));
    assert.equal(report.artifacts.playbookPath, join(outputDir, "stable-maintenance-playbook.json"));
    assert.equal(report.playbook.maintenanceOwner, "runtime_reliability_oncall");
    assert.ok(report.playbook.targets.some((target) => target.targetId === "dispatch_policy"));
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.equal(existsSync(join(outputDir, "stable-maintenance-report.json")), true);
    assert.equal(existsSync(join(outputDir, "stable-maintenance-playbook.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable DB queue disconnect CLI writes a local disconnect drill report", () => {
  const workspace = createTempWorkspace("aa-cli-db-queue-disconnect-");
  const outputDir = join(workspace, "stable-db-queue-disconnect");

  try {
    const report = runCli<{
      failedScenarios: number;
      totalScenarios: number;
      scenarios: Array<{ scenarioId: string; passed: boolean }>;
    }>("stable-db-queue-disconnect.js", {
      AA_STABLE_DB_QUEUE_DISCONNECT_OUTPUT_DIR: outputDir,
    });

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 3);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "queue_disconnect_degrades_without_silent_drop"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "missing_dispatch_ticket_rebuilt_after_queue_reconnect"));
    assert.ok(
      report.scenarios.some(
        (scenario) => scenario.scenarioId === "authoritative_writeback_failure_fails_closed_until_store_recovers",
      ),
    );
    assert.equal(existsSync(join(outputDir, "stable-db-queue-disconnect-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable DB writability CLI writes a local read-only fail-close drill report", () => {
  const workspace = createTempWorkspace("aa-cli-db-writability-");
  const outputDir = join(workspace, "stable-db-writability");

  try {
    const report = runCli<{
      failedScenarios: number;
      totalScenarios: number;
      scenarios: Array<{ scenarioId: string; passed: boolean }>;
    }>("stable-db-writability.js", {
      AA_STABLE_DB_WRITABILITY_OUTPUT_DIR: outputDir,
    });

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 3);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(
      report.scenarios.some((scenario) => scenario.scenarioId === "health_and_doctor_fail_close_when_db_is_not_writable"),
    );
    assert.ok(
      report.scenarios.some((scenario) => scenario.scenarioId === "multi_step_admission_rejects_new_work_in_read_only_mode"),
    );
    assert.ok(
      report.scenarios.some(
        (scenario) => scenario.scenarioId === "dispatch_blocks_claims_without_dropping_pending_ticket_in_read_only_mode",
      ),
    );
    assert.equal(existsSync(join(outputDir, "stable-db-writability-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable queue delivery CLI writes a local queue replay / duplicate delivery rehearsal report", () => {
  const workspace = createTempWorkspace("aa-cli-queue-delivery-");
  const outputDir = join(workspace, "stable-queue-delivery");

  try {
    const report = runCli<{
      failedScenarios: number;
      totalScenarios: number;
      scenarios: Array<{ scenarioId: string; passed: boolean }>;
    }>("stable-queue-delivery.js", {
      AA_STABLE_QUEUE_DELIVERY_OUTPUT_DIR: outputDir,
    });

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 2);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "queue_replay_rebuilds_dispatchable_ticket"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "duplicate_delivery_blocked_and_reconciled"));
    assert.equal(existsSync(join(outputDir, "stable-queue-delivery-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable migration compatibility CLI writes a local PG portability rehearsal report", () => {
  const workspace = createTempWorkspace("aa-cli-migration-compatibility-");
  const outputDir = join(workspace, "stable-migration-compatibility");

  try {
    const report = runCli<{
      failedScenarios: number;
      totalScenarios: number;
      scenarios: Array<{ scenarioId: string; passed: boolean }>;
    }>("stable-migration-compatibility.js", {
      AA_STABLE_MIGRATION_COMPATIBILITY_OUTPUT_DIR: outputDir,
    });

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 2);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "migration_plan_passes_pg_portability_rules"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "sqlite_migration_bootstrap_reaches_latest_schema"));
    assert.equal(existsSync(join(outputDir, "stable-migration-compatibility-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable replay CLI writes a local event replay rehearsal report", () => {
  const workspace = createTempWorkspace("aa-cli-stable-replay-");
  const outputDir = join(workspace, "stable-replay");

  try {
    const report = runCli<{
      failedScenarios: number;
      totalScenarios: number;
      scenarios: Array<{ passed: boolean }>;
    }>("stable-replay.js", {
      AA_STABLE_REPLAY_OUTPUT_DIR: outputDir,
    });

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 1);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.equal(existsSync(join(outputDir, "stable-event-replay-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable gray CLI writes a local tenant-gray rehearsal report", () => {
  const workspace = createTempWorkspace("aa-cli-stable-gray-");
  const outputDir = join(workspace, "stable-gray");

  try {
    const report = runCli<{
      failedScenarios: number;
      totalScenarios: number;
      scenarios: Array<{ passed: boolean }>;
    }>("stable-gray.js", {
      AA_STABLE_GRAY_OUTPUT_DIR: outputDir,
    });

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 2);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.equal(existsSync(join(outputDir, "stable-gray-release-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable gate CLI reports canary and tenant-gray approval from smoke evidence and conditional production readiness", () => {
  const workspace = createTempWorkspace("aa-cli-gate-");
  const evidenceRoot = join(workspace, "stable-evidence");
  const outputDir = join(workspace, "stable-gate");

  try {
    runCli<{ summary: { passed: boolean } }>("stable-evidence.js", {
      AA_STABLE_EVIDENCE_OUTPUT_DIR: join(evidenceRoot, "smoke"),
      AA_STABLE_EVIDENCE_PROFILE: "smoke",
      AA_STABLE_EVIDENCE_VALIDATION_ITERATIONS: "1",
      AA_STABLE_EVIDENCE_DURATION_MS: "600",
      AA_STABLE_EVIDENCE_INTERVAL_MS: "100",
      AA_STABLE_EVIDENCE_ITERATIONS_PER_CYCLE: "1",
    });

    const canaryReport = runCli<{
      overallVerdict: string;
      targetStatus: string;
      blockers: string[];
      requiredCriteria: Array<{ criterionId: string; status: string }>;
      optionalCriteria: Array<{ criterionId: string; status: string }>;
    }>("stable-gate.js", {
      AA_STABLE_GATE_EVIDENCE_ROOT: evidenceRoot,
      AA_STABLE_GATE_OUTPUT_DIR: outputDir,
      AA_STABLE_GATE_TARGET_STATUS: "canary",
    });
    const productionReport = runCli<{
      overallVerdict: string;
      targetStatus: string;
      blockers: string[];
      requiredCriteria: Array<{ criterionId: string; status: string }>;
      optionalCriteria: Array<{ criterionId: string; status: string }>;
    }>("stable-gate.js", {
      AA_STABLE_GATE_EVIDENCE_ROOT: evidenceRoot,
      AA_STABLE_GATE_OUTPUT_DIR: outputDir,
      AA_STABLE_GATE_TARGET_STATUS: "production_ready",
    });
    const grayReport = runCli<{
      overallVerdict: string;
      targetStatus: string;
      blockers: string[];
      requiredCriteria: Array<{ criterionId: string; status: string }>;
    }>("stable-gate.js", {
      AA_STABLE_GATE_EVIDENCE_ROOT: evidenceRoot,
      AA_STABLE_GATE_OUTPUT_DIR: outputDir,
      AA_STABLE_GATE_TARGET_STATUS: "tenant_gray",
    });

    assert.equal(canaryReport.overallVerdict, "promote_approved");
    assert.equal(canaryReport.targetStatus, "canary");
    assert.equal(canaryReport.requiredCriteria.some((criterion) => criterion.criterionId === "conformance_tests"), true);
    assert.equal(canaryReport.optionalCriteria.some((criterion) => criterion.criterionId === "chaos_drill_results"), true);
    assert.equal(canaryReport.optionalCriteria.some((criterion) => criterion.criterionId === "maintenance_drain_tested"), true);
    assert.equal(grayReport.overallVerdict, "promote_approved");
    assert.equal(grayReport.targetStatus, "tenant_gray");
    assert.equal(grayReport.requiredCriteria.some((criterion) => criterion.criterionId === "tenant_gray_rollout_tested"), true);
    assert.equal(productionReport.overallVerdict, "conditional");
    assert.equal(productionReport.targetStatus, "production_ready");
    assert.ok(productionReport.blockers.some((blocker) => blocker.includes("24h")));
    assert.ok(productionReport.blockers.some((blocker) => blocker.includes("72h")));
    assert.equal(existsSync(join(outputDir, "stable-release-gate-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable package CLI writes a local release package with gate and summary artifacts", () => {
  const workspace = createTempWorkspace("aa-cli-package-");
  const evidenceRoot = join(workspace, "stable-evidence");
  const outputDir = join(workspace, "stable-package");

  try {
    runCli<{ summary: { passed: boolean } }>("stable-evidence.js", {
      AA_STABLE_EVIDENCE_OUTPUT_DIR: join(evidenceRoot, "smoke"),
      AA_STABLE_EVIDENCE_PROFILE: "smoke",
      AA_STABLE_EVIDENCE_VALIDATION_ITERATIONS: "1",
      AA_STABLE_EVIDENCE_DURATION_MS: "600",
      AA_STABLE_EVIDENCE_INTERVAL_MS: "100",
      AA_STABLE_EVIDENCE_ITERATIONS_PER_CYCLE: "1",
    });

    const report = runCli<{
      overallVerdict: string;
      targetStatus: string;
      artifacts: {
        packageReportPath: string;
        gateReportPath: string;
        releaseChecklistPath: string;
        summaryMarkdownPath: string;
      };
      releaseChecklist: {
        overallStatus: string;
        items: Array<{ itemId: string; status: string }>;
      };
      nextActions: string[];
      recommendedCommands: string[];
    }>("stable-package.js", {
      AA_STABLE_PACKAGE_EVIDENCE_ROOT: evidenceRoot,
      AA_STABLE_PACKAGE_OUTPUT_DIR: outputDir,
      AA_STABLE_PACKAGE_TARGET_STATUS: "canary",
    });

    assert.equal(report.overallVerdict, "promote_approved");
    assert.equal(report.targetStatus, "canary");
    assert.equal(report.releaseChecklist.overallStatus, "pass");
    assert.equal(report.releaseChecklist.items.some((item) => item.itemId === "required_criteria_complete"), true);
    assert.equal(report.releaseChecklist.items.some((item) => item.itemId === "tenant_gray_ready"), true);
    assert.equal(report.releaseChecklist.items.some((item) => item.itemId === "disaster_recovery_ready"), true);
    assert.equal(report.releaseChecklist.items.some((item) => item.itemId === "rolling_upgrade_ready"), true);
    assert.equal(report.releaseChecklist.items.some((item) => item.itemId === "maintenance_handover_ready"), true);
    assert.ok(report.nextActions.some((action) => action.includes("canary rollout")));
    assert.ok(report.recommendedCommands.some((command) => command === "npm run restore:stable"));
    assert.ok(report.recommendedCommands.some((command) => command === "npm run upgrade:stable"));
    assert.ok(report.recommendedCommands.some((command) => command === "npm run maintenance:stable"));
    assert.ok(report.recommendedCommands.some((command) => command === "npm run gray:stable"));
    assert.equal(existsSync(report.artifacts.packageReportPath), true);
    assert.equal(existsSync(report.artifacts.gateReportPath), true);
    assert.equal(existsSync(report.artifacts.releaseChecklistPath), true);
    assert.equal(existsSync(report.artifacts.summaryMarkdownPath), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable validate CLI writes reusable baseline and report artifacts", () => {
  const workspace = createTempWorkspace("aa-cli-stable-validate-");
  const outputDir = join(workspace, "stable-validate");

  try {
    const firstReport = runCli<{
      totalRuns: number;
      failedRuns: number;
      passedRuns: number;
      artifacts: {
        reportPath: string;
        baselinePath: string;
        inventoryPath: string;
      };
      baselineComparison: {
        status: string;
        baselineCreated: boolean;
        regressionDetected: boolean;
      };
    }>("stable-validate.js", {
      AA_VALIDATION_OUTPUT_DIR: outputDir,
      AA_VALIDATION_ITERATIONS: "1",
    });
    const secondReport = runCli<{
      totalRuns: number;
      failedRuns: number;
      passedRuns: number;
      artifacts: {
        reportPath: string;
        baselinePath: string;
        inventoryPath: string;
      };
      baselineComparison: {
        status: string;
        baselineCreated: boolean;
        regressionDetected: boolean;
        failedRunsDelta: number;
        integrityFailuresDelta: number;
        backupFailuresDelta: number;
      };
    }>("stable-validate.js", {
      AA_VALIDATION_OUTPUT_DIR: outputDir,
      AA_VALIDATION_ITERATIONS: "1",
    });

    assert.equal(firstReport.totalRuns, 7);
    assert.equal(firstReport.failedRuns, 0);
    assert.equal(firstReport.passedRuns, 7);
    assert.equal(firstReport.baselineComparison.status, "baseline_created");
    assert.equal(firstReport.baselineComparison.baselineCreated, true);
    assert.equal(existsSync(firstReport.artifacts.reportPath), true);
    assert.equal(existsSync(firstReport.artifacts.baselinePath), true);
    assert.equal(existsSync(firstReport.artifacts.inventoryPath), true);

    assert.equal(secondReport.totalRuns, 7);
    assert.equal(secondReport.failedRuns, 0);
    assert.equal(secondReport.passedRuns, 7);
    assert.equal(secondReport.artifacts.reportPath, firstReport.artifacts.reportPath);
    assert.equal(secondReport.artifacts.baselinePath, firstReport.artifacts.baselinePath);
    assert.equal(secondReport.artifacts.inventoryPath, firstReport.artifacts.inventoryPath);
    assert.equal(secondReport.baselineComparison.baselineCreated, false);
    assert.equal(secondReport.baselineComparison.regressionDetected, false);
    assert.equal(secondReport.baselineComparison.failedRunsDelta, 0);
    assert.equal(secondReport.baselineComparison.integrityFailuresDelta, 0);
    assert.equal(secondReport.baselineComparison.backupFailuresDelta, 0);
    assert.equal(existsSync(secondReport.artifacts.reportPath), true);
    assert.equal(existsSync(secondReport.artifacts.baselinePath), true);
    assert.equal(existsSync(secondReport.artifacts.inventoryPath), true);
  } finally {
    cleanupPath(workspace);
  }
});

serialTest("stable campaign CLI accumulates local segments and finalizes an evidence bundle", () => {
  const workspace = createTempWorkspace("aa-cli-campaign-");
  const outputDir = join(workspace, "stable-campaign");

  try {
    const first = runCli<{
      state: {
        completed: boolean;
        accumulatedDurationMs: number;
        segments: Array<unknown>;
      };
      finalEvidenceReport: null;
    }>("stable-campaign.js", {
      AA_STABLE_CAMPAIGN_OUTPUT_DIR: outputDir,
      AA_STABLE_CAMPAIGN_PROFILE: "24h",
      AA_STABLE_CAMPAIGN_TARGET_DURATION_MS: "40",
      AA_STABLE_CAMPAIGN_SEGMENT_DURATION_MS: "25",
      AA_STABLE_CAMPAIGN_INTERVAL_MS: "5",
      AA_STABLE_CAMPAIGN_ITERATIONS_PER_CYCLE: "1",
      AA_STABLE_CAMPAIGN_VALIDATION_ITERATIONS: "1",
    });
    const second = runCli<{
      state: {
        completed: boolean;
        accumulatedDurationMs: number;
        segments: Array<unknown>;
      };
      finalEvidenceReport: { summary: { passed: boolean } } | null;
    }>("stable-campaign.js", {
      AA_STABLE_CAMPAIGN_OUTPUT_DIR: outputDir,
      AA_STABLE_CAMPAIGN_PROFILE: "24h",
      AA_STABLE_CAMPAIGN_TARGET_DURATION_MS: "40",
      AA_STABLE_CAMPAIGN_SEGMENT_DURATION_MS: "25",
      AA_STABLE_CAMPAIGN_INTERVAL_MS: "5",
      AA_STABLE_CAMPAIGN_ITERATIONS_PER_CYCLE: "1",
      AA_STABLE_CAMPAIGN_VALIDATION_ITERATIONS: "1",
    });

    assert.equal(first.state.completed, false);
    assert.equal(first.state.accumulatedDurationMs, 25);
    assert.equal(first.state.segments.length, 1);
    assert.equal(second.state.completed, true);
    assert.equal(second.state.accumulatedDurationMs, 40);
    assert.equal(second.state.segments.length, 2);
    assert.equal(second.finalEvidenceReport?.summary.passed, true);
    assert.equal(existsSync(join(outputDir, "stable-evidence-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});
