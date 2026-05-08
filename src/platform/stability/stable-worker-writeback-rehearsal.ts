/**
 * Stable worker-writeback rehearsal suite.
 *
 * This module provides scenarios that exercise the
 * {@link ExecutionWorkerWritebackService} lifecycle: how workers report execution completion
 * and how the system enforces lease / fencing integrity on the writeback path.
 *
 * **Scenarios covered:**
 * - `worker_writeback_completes_execution`: A worker with a valid lease and fencing token calls
 *   `recordWriteback` with a terminal status. The writeback is accepted and the system transitions
 *   the task, workflow, session, and execution to terminal states while releasing the lease and
 *   clearing the worker's running-execution list.
 * - `duplicate_writeback_rejected`: After a successful writeback marks the execution terminal,
 *   a second writeback with the same lease/fencing is rejected with `execution_not_executing`.
 * - `stale_fencing_writeback_rejected`: The original worker lease expires, is reclaimed, and a
 *   second worker acquires a new lease with an incremented fencing token. The first worker's
 *   writeback (using the old token) is rejected with `stale_fencing_token`.
 *
 * These scenarios validate the writeback path described in the task-lease / fencing contract and
 * the execution plane contract.
 *
 * **Design contract:**
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/task_lease_and_fencing_contract.md | task_lease_and_fencing_contract.md}
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/execution_plane_contract.md | execution_plane_contract.md}
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/runtime_execution_contract.md | runtime_execution_contract.md}
 *
 * **Glossary terms:** `lease`, `fencing token`, `writeback`, `stale fencing token`, `lease reclaim`,
 * `lease reacquisition`, `worker`, `execution ticket`, `terminal status`
 *
 * **Architecture:** {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/architecture/00-platform-architecture.md | 01_architecture_and_technical_design.md}
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { ExecutionDispatchService } from "../execution/dispatcher/execution-dispatch-service.js";
import { ExecutionLeaseService } from "../execution/lease/execution-lease-service.js";
import { ExecutionWorkerHandshakeService } from "../execution/worker-pool/execution-worker-handshake-service.js";
import { ExecutionWorkerWritebackService } from "../execution/worker-pool/execution-worker-writeback-service.js";
import { WorkerRegistryService } from "../execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../state-evidence/truth/sqlite-database.js";
import { nowIso } from "../contracts/types/ids.js";

export interface StableWorkerWritebackRehearsalOptions {
  outputDir: string;
}

export interface StableWorkerWritebackScenarioResult {
  scenarioId:
    | "worker_writeback_completes_execution"
    | "duplicate_writeback_rejected"
    | "stale_fencing_writeback_rejected";
  passed: boolean;
  durationMs: number;
  summary: string;
  details: Record<string, unknown>;
}

export interface StableWorkerWritebackRehearsalReport {
  startedAt: string;
  finishedAt: string;
  outputDir: string;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  scenarios: StableWorkerWritebackScenarioResult[];
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

async function measureScenario(
  scenarioId: StableWorkerWritebackScenarioResult["scenarioId"],
  run: () => Promise<Omit<StableWorkerWritebackScenarioResult, "scenarioId" | "durationMs">>,
): Promise<StableWorkerWritebackScenarioResult> {
  const started = performance.now();
  const result = await run();
  return {
    scenarioId,
    durationMs: Math.round((performance.now() - started) * 100) / 100,
    ...result,
  };
}

function seedTaskExecutionWorkflowAndSession(
  db: SqliteDatabase,
  store: AuthoritativeTaskStore,
  input: {
    taskId: string;
    executionId: string;
    sessionId: string;
    traceId: string;
  },
): void {
  const now = nowIso();
  db.transaction(() => {
    store.task.insertTask({
      id: input.taskId,
      parentId: null,
      rootId: input.taskId,
      divisionId: "general_ops",
      title: "Stable worker writeback rehearsal task",
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
    // @ts-ignore ExecutionRecord type mismatch
    store.execution.insertExecution({
      id: input.executionId,
      taskId: input.taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-worker-writeback",
      roleId: "general_executor",
      runKind: "task_run",
      status: "created",
      inputRef: null,
      traceId: input.traceId,
      attempt: 1,
      timeoutMs: 1_000,
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
    store.workflow.insertWorkflowState({
      taskId: input.taskId,
      divisionId: "general_ops",
      workflowId: "single_agent_minimal",
      currentStepIndex: 0,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });
    store.session.insertSession({
      id: input.sessionId,
      taskId: input.taskId,
      channel: "cli",
      status: "streaming",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

function seedClaimedExecution(dbPath: string): { leaseId: string; fencingToken: number } {
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const workers = new WorkerRegistryService(store);
  const dispatch = new ExecutionDispatchService(db, store);
  const handshake = new ExecutionWorkerHandshakeService(db, store);

  seedTaskExecutionWorkflowAndSession(db, store, {
    taskId: "task-worker-writeback",
    executionId: "exec-worker-writeback",
    sessionId: "sess-worker-writeback",
    traceId: "trace-worker-writeback",
  });
  workers.recordHeartbeat({
    workerId: "worker-writeback",
    status: "idle",
    capabilities: ["bash"],
    runningExecutionIds: [],
    maxConcurrency: 1,
    queueAffinity: "default",
    occurredAt: "2026-04-04T12:00:00.000Z",
  });

  const created = dispatch.createTicket({
    executionId: "exec-worker-writeback",
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
    workerId: "worker-writeback",
    leaseId: dispatched.leaseId ?? "",
    fencingToken: 1,
    occurredAt: "2026-04-04T12:00:07.000Z",
  });
  db.close();

  return {
    leaseId: dispatched.leaseId ?? "",
    fencingToken: 1,
  };
}

async function runCompletionScenario(outputDir: string): Promise<StableWorkerWritebackScenarioResult> {
  return measureScenario("worker_writeback_completes_execution", async () => {
    const dbPath = join(outputDir, "worker-writeback-complete.db");
    rmSync(dbPath, { force: true });
    const seeded = seedClaimedExecution(dbPath);

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    const writeback = new ExecutionWorkerWritebackService(db, store);
    const decision = writeback.recordWriteback({
      executionId: "exec-worker-writeback",
      workerId: "worker-writeback",
      leaseId: seeded.leaseId,
      fencingToken: seeded.fencingToken,
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ summary: "completed" }),
      outputsJson: JSON.stringify({ final: { summary: "completed" } }),
      occurredAt: "2026-04-04T12:00:10.000Z",
    });
    const snapshot = store.operations.loadTaskSnapshot("task-worker-writeback");
    const lease = store.worker.getExecutionLease(seeded.leaseId);
    const worker = store.worker.getWorkerSnapshot("worker-writeback");
    db.close();

    return {
      passed:
        decision.accepted &&
        snapshot.task.status === "done" &&
        snapshot.workflow?.status === "completed" &&
        snapshot.session?.status === "completed" &&
        snapshot.execution?.status === "succeeded" &&
        lease?.status === "released" &&
        worker?.status === "idle" &&
        worker.runningExecutionsJson === "[]",
      summary: "worker writeback closes runtime state, releases the lease, and clears worker ownership",
      details: {
        decision,
        snapshot,
        lease,
        worker,
      },
    };
  });
}

async function runDuplicateScenario(outputDir: string): Promise<StableWorkerWritebackScenarioResult> {
  return measureScenario("duplicate_writeback_rejected", async () => {
    const dbPath = join(outputDir, "worker-writeback-duplicate.db");
    rmSync(dbPath, { force: true });
    const seeded = seedClaimedExecution(dbPath);

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    const writeback = new ExecutionWorkerWritebackService(db, store);
    writeback.recordWriteback({
      executionId: "exec-worker-writeback",
      workerId: "worker-writeback",
      leaseId: seeded.leaseId,
      fencingToken: seeded.fencingToken,
      terminalStatus: "done",
      occurredAt: "2026-04-04T12:00:10.000Z",
    });
    const duplicate = writeback.recordWriteback({
      executionId: "exec-worker-writeback",
      workerId: "worker-writeback",
      leaseId: seeded.leaseId,
      fencingToken: seeded.fencingToken,
      terminalStatus: "done",
      occurredAt: "2026-04-04T12:00:11.000Z",
    });
    const events = store.event.listEventsForTask("task-worker-writeback");
    db.close();

    return {
      passed:
        duplicate.accepted === false &&
        duplicate.reasonCode === "execution_not_executing" &&
        events.some((event) => event.eventType === "worker:writeback_rejected"),
      summary: "duplicate writeback is rejected once the execution has already reached a terminal state",
      details: {
        duplicate,
        events,
      },
    };
  });
}

async function runStaleFencingScenario(outputDir: string): Promise<StableWorkerWritebackScenarioResult> {
  return measureScenario("stale_fencing_writeback_rejected", async () => {
    const dbPath = join(outputDir, "worker-writeback-stale.db");
    rmSync(dbPath, { force: true });
    const seeded = seedClaimedExecution(dbPath);

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    const leases = new ExecutionLeaseService(db, store);
    const writeback = new ExecutionWorkerWritebackService(db, store);
    leases.reclaimExpiredLeases("2026-04-04T12:01:00.000Z");
    const reacquired = leases.acquireLease({
      executionId: "exec-worker-writeback",
      workerId: "worker-writeback",
      ttlMs: 30_000,
      queueName: "default",
      occurredAt: "2026-04-04T12:01:00.000Z",
    });
    const rejected = writeback.recordWriteback({
      executionId: "exec-worker-writeback",
      workerId: "worker-writeback",
      leaseId: seeded.leaseId,
      fencingToken: seeded.fencingToken,
      terminalStatus: "failed",
      reasonCode: "worker.stale",
      occurredAt: "2026-04-04T12:01:05.000Z",
    });
    db.close();

    return {
      passed:
        reacquired.lease?.fencingToken === 2 &&
        rejected.accepted === false &&
        rejected.reasonCode === "stale_fencing_token",
      summary: "stale fencing tokens are rejected after lease failover and reacquisition",
      details: {
        reacquired,
        rejected,
      },
    };
  });
}

export async function runStableWorkerWritebackRehearsal(
  options: StableWorkerWritebackRehearsalOptions,
): Promise<StableWorkerWritebackRehearsalReport> {
  mkdirSync(options.outputDir, { recursive: true });
  const startedAt = nowIso();
  const scenarios = await Promise.all([
    runCompletionScenario(options.outputDir),
    runDuplicateScenario(options.outputDir),
    runStaleFencingScenario(options.outputDir),
  ]);
  const finishedAt = nowIso();
  const passedScenarios = scenarios.filter((scenario) => scenario.passed).length;

  return {
    startedAt,
    finishedAt,
    outputDir: options.outputDir,
    totalScenarios: scenarios.length,
    passedScenarios,
    failedScenarios: scenarios.length - passedScenarios,
    scenarios,
  };
}

export function writeStableWorkerWritebackRehearsalReport(
  path: string,
  report: StableWorkerWritebackRehearsalReport,
): void {
  writeJson(path, report);
}
