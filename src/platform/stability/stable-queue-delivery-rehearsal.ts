/**
 * Stable Queue Delivery Rehearsal
 *
 * Tests the system's behavior around queue delivery scenarios, focusing on
 * ticket replay after delivery loss and duplicate delivery prevention:
 *
 * 1. Queue replay rebuilds dispatchable ticket after delivery is lost
 *    - A ticket is dispatched and lease is released without writeback
 *    - Reconciliation detects orphan queue claim
 *    - Replacement ticket is created and can be redispatched
 *    - Original ticket is marked as expired
 *
 * 2. Duplicate delivery is blocked and reconciled
 *    - First dispatch creates a valid claim with lease
 *    - Second dispatch for same execution is blocked (worker at capacity)
 *    - Writeback completes normally
 *    - Reconciliation cancels the stale duplicate ticket
 *
 * These scenarios verify the dispatch reconciliation contract requirements
 * for handling delivery anomalies and maintaining queue integrity.
 *
 * @see ExecutionDispatchReconciliationService for the repair logic
 * @see docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { ExecutionDispatchReconciliationService } from "../execution/dispatcher/execution-dispatch-reconciliation-service.js";
import { ExecutionDispatchService } from "../execution/dispatcher/execution-dispatch-service.js";
import { ExecutionLeaseService } from "../execution/lease/execution-lease-service.js";
import { ExecutionWorkerHandshakeService } from "../execution/worker-pool/execution-worker-handshake-service.js";
import { ExecutionWorkerWritebackService } from "../execution/worker-pool/execution-worker-writeback-service.js";
import { WorkerRegistryService } from "../execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../state-evidence/truth/sqlite-database.js";
import { newId, nowIso } from "../contracts/types/ids.js";

/** Options for running the queue delivery rehearsal */
export interface StableQueueDeliveryRehearsalOptions {
  outputDir: string;
}

/** Result of a single queue delivery scenario */
export interface StableQueueDeliveryScenarioResult {
  scenarioId:
    | "queue_replay_rebuilds_dispatchable_ticket"
    | "duplicate_delivery_blocked_and_reconciled";
  passed: boolean;
  durationMs: number;
  summary: string;
  details: Record<string, unknown>;
}

/** Complete report from the queue delivery rehearsal */
export interface StableQueueDeliveryRehearsalReport {
  startedAt: string;
  finishedAt: string;
  outputDir: string;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  scenarios: StableQueueDeliveryScenarioResult[];
}

/**
 * Writes JSON to a file, creating parent directories as needed.
 * Used for persisting rehearsal reports and state artifacts.
 */
function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

/**
 * Executes a scenario and measures its duration.
 * Wraps scenario results with timing information for performance analysis.
 */
async function measureScenario(
  scenarioId: StableQueueDeliveryScenarioResult["scenarioId"],
  run: () => Promise<Omit<StableQueueDeliveryScenarioResult, "scenarioId" | "durationMs">>,
): Promise<StableQueueDeliveryScenarioResult> {
  const started = performance.now();
  const result = await run();
  return {
    scenarioId,
    durationMs: Math.round((performance.now() - started) * 100) / 100,
    ...result,
  };
}

/**
 * Seeds the database with a minimal task and execution record.
 * Creates the authoritative records needed for queue delivery testing.
 */
function seedTaskAndExecution(
  db: SqliteDatabase,
  store: AuthoritativeTaskStore,
  input: {
    taskId: string;
    executionId: string;
    traceId: string;
    priority?: "low" | "normal" | "high" | "critical";
  },
): void {
  const now = nowIso();
  db.transaction(() => {
    store.task.insertTask({
      id: input.taskId,
      parentId: null,
      rootId: input.taskId,
      divisionId: "general_ops",
      title: "Stable queue delivery rehearsal task",
      status: "in_progress",
      source: "user",
      priority: input.priority ?? "normal",
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
    store.execution.insertExecution({
      id: input.executionId,
      taskId: input.taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-queue-delivery-rehearsal",
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
  });
}

/**
 * Seeds workflow and session records for a given task.
 * These are needed for writeback operations that transition session state.
 */
function seedWorkflowAndSession(db: SqliteDatabase, store: AuthoritativeTaskStore, taskId: string): void {
  const now = nowIso();
  db.transaction(() => {
    store.workflow.insertWorkflowState({
      taskId,
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
      id: `sess-${taskId}`,
      taskId,
      channel: "cli",
      status: "streaming",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

/**
 * Scenario 1: Queue replay rebuilds dispatchable ticket after delivery loss.
 *
 * Tests that when a dispatch lease is released without a corresponding writeback
 * (simulating delivery loss), the reconciliation service can detect the orphan
 * claim and rebuild a replacement ticket that can be redispatched.
 *
 * Verifies:
 * - Original ticket is dispatched and lease is released
 * - Reconciliation creates a replacement ticket
 * - Original ticket is marked as expired
 * - Replacement ticket can be successfully dispatched
 * - dispatch:ticket_requeued event is emitted
 */
async function runQueueReplayScenario(outputDir: string): Promise<StableQueueDeliveryScenarioResult> {
  return measureScenario("queue_replay_rebuilds_dispatchable_ticket", async () => {
    const dbPath = join(outputDir, "queue-replay.db");
    rmSync(dbPath, { force: true });

    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const leases = new ExecutionLeaseService(db, store);
    const reconcile = new ExecutionDispatchReconciliationService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-queue-replay",
      executionId: "exec-queue-replay",
      traceId: "trace-queue-replay",
    });
    workers.recordHeartbeat({
      workerId: "worker-queue-replay",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-07T10:00:00.000Z",
    });

    // First dispatch and then release lease without writeback (simulating delivery loss)
    const created = dispatch.createTicket({
      executionId: "exec-queue-replay",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-07T10:00:05.000Z",
    });
    const firstDispatch = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-07T10:00:06.000Z",
    });
    if (firstDispatch.leaseId) {
      leases.releaseLease({
        leaseId: firstDispatch.leaseId,
        workerId: "worker-queue-replay",
        reasonCode: "queue_delivery_replay.seed",
        occurredAt: "2026-04-07T10:00:07.000Z",
      });
    }

    // Reconciliation should detect orphan and create replacement ticket
    const repaired = reconcile.repair("2026-04-07T10:00:08.000Z");
    const replacementTicketId =
      repaired.applied.find((item) => item.applied && item.replacementTicketId != null)?.replacementTicketId ?? null;

    // Replacement ticket should be dispatchable
    const replayDispatch = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-07T10:00:09.000Z",
    });
    const tickets = store.worker.listExecutionTicketsByExecution("exec-queue-replay");
    const events = store.event.listEventsForTask("task-queue-replay");
    db.close();

    return {
      passed:
        created.outcome === "created" &&
        firstDispatch.outcome === "dispatched" &&
        replacementTicketId != null &&
        repaired.applied.some((item) => item.applied && item.replacementTicketId === replacementTicketId) &&
        tickets.some((ticket) => ticket.id === created.ticket.id && ticket.status === "expired") &&
        replayDispatch.outcome === "dispatched" &&
        replayDispatch.ticket?.id === replacementTicketId &&
        replayDispatch.worker?.workerId === "worker-queue-replay" &&
        events.some((event) => event.eventType === "dispatch:ticket_requeued"),
      summary: "queue replay rebuilds a dispatchable ticket from authoritative DB truth after delivery is lost",
      details: {
        created,
        firstDispatch,
        repaired,
        replayDispatch,
        tickets,
        eventTypes: events.map((event) => event.eventType),
      },
    };
  });
}

/**
 * Scenario 2: Duplicate delivery is blocked and reconciled.
 *
 * Tests that the system handles duplicate dispatch tickets correctly:
 * - First dispatch succeeds with valid claim
 * - Duplicate ticket dispatch is blocked because worker is at capacity
 * - Writeback completes normally for the first dispatch
 * - Reconciliation cancels the stale duplicate ticket
 * - Both writeback and reconciliation events are emitted
 */
async function runDuplicateDeliveryScenario(outputDir: string): Promise<StableQueueDeliveryScenarioResult> {
  return measureScenario("duplicate_delivery_blocked_and_reconciled", async () => {
    const dbPath = join(outputDir, "queue-duplicate-delivery.db");
    rmSync(dbPath, { force: true });

    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const handshake = new ExecutionWorkerHandshakeService(db, store);
    const writeback = new ExecutionWorkerWritebackService(db, store);
    const reconcile = new ExecutionDispatchReconciliationService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-duplicate-delivery",
      executionId: "exec-duplicate-delivery",
      traceId: "trace-duplicate-delivery",
    });
    seedWorkflowAndSession(db, store, "task-duplicate-delivery");
    workers.recordHeartbeat({
      workerId: "worker-duplicate-delivery",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-duplicate-delivery-1",
      occurredAt: "2026-04-07T10:10:00.000Z",
    });

    // First dispatch with claim
    const created = dispatch.createTicket({
      executionId: "exec-duplicate-delivery",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-07T10:10:05.000Z",
    });
    const firstDispatch = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-07T10:10:06.000Z",
    });
    const claim = handshake.claimExecution({
      ticketId: created.ticket.id,
      workerId: "worker-duplicate-delivery",
      leaseId: firstDispatch.leaseId ?? "",
      fencingToken: 1,
      runtimeInstanceId: "runtime-duplicate-delivery-1",
      occurredAt: "2026-04-07T10:10:07.000Z",
    });

    // Create a duplicate ticket manually (simulating duplicate delivery)
    const duplicateTicketId = newId("ticket");
    store.worker.insertExecutionTicket({
      id: duplicateTicketId,
      executionId: "exec-duplicate-delivery",
      taskId: "task-duplicate-delivery",
      priority: "normal",
      queueName: "default",
      dispatchTarget: "any",
      requiredIsolationLevel: "standard",
      requiredRepoVersion: null,
      requiredCapabilitiesJson: JSON.stringify(["bash"]),
      dispatchAfter: null,
      attempt: 1,
      status: "pending",
      assignedWorkerId: null,
      leaseId: null,
      claimedAt: null,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: "2026-04-07T10:10:08.000Z",
      updatedAt: "2026-04-07T10:10:08.000Z",
    });

    // Second dispatch should be blocked because worker is at capacity
    const duplicateDispatch = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-07T10:10:09.000Z",
    });

    // Normal writeback for the first dispatch
    const writebackDecision = writeback.recordWriteback({
      executionId: "exec-duplicate-delivery",
      workerId: "worker-duplicate-delivery",
      leaseId: firstDispatch.leaseId ?? "",
      fencingToken: 1,
      runtimeInstanceId: "runtime-duplicate-delivery-1",
      terminalStatus: "done",
      occurredAt: "2026-04-07T10:10:10.000Z",
    });

    // Reconciliation should cancel the duplicate stale ticket
    const repaired = reconcile.repair("2026-04-07T10:10:11.000Z");
    const duplicateTicket = store.worker.getExecutionTicket(duplicateTicketId);
    const worker = store.worker.getWorkerSnapshot("worker-duplicate-delivery");
    const events = store.event.listEventsForTask("task-duplicate-delivery");
    db.close();

    return {
      passed:
        claim.accepted &&
        duplicateDispatch.outcome === "no_worker" &&
        duplicateDispatch.trace?.evaluations.some(
          (evaluation) =>
            evaluation.workerId === "worker-duplicate-delivery" && evaluation.rejectionReason === "worker_capacity_full",
        ) === true &&
        duplicateDispatch.ticket?.id === duplicateTicketId &&
        writebackDecision.accepted &&
        repaired.issues.some(
          (issue) => issue.issueType === "terminal_execution_ticket" && issue.ticketId === duplicateTicketId,
        ) &&
        duplicateTicket?.status === "cancelled" &&
        worker?.status === "idle" &&
        events.some((event) => event.eventType === "worker:writeback_recorded") &&
        events.some((event) => event.eventType === "dispatch:ticket_reconciled"),
      summary: "duplicate delivery is blocked by the active lease and cleaned up after authoritative terminal writeback",
      details: {
        created,
        firstDispatch,
        claim,
        duplicateDispatch,
        writebackDecision,
        repaired,
        duplicateTicket,
        worker,
        eventTypes: events.map((event) => event.eventType),
      },
    };
  });
}

/**
 * Runs all queue delivery rehearsal scenarios.
 *
 * Executes two scenarios sequentially:
 * 1. Queue replay rebuilds ticket after delivery loss
 * 2. Duplicate delivery is blocked and reconciled
 */
export async function runStableQueueDeliveryRehearsal(
  options: StableQueueDeliveryRehearsalOptions,
): Promise<StableQueueDeliveryRehearsalReport> {
  const startedAt = new Date().toISOString();
  const scenarios = [
    await runQueueReplayScenario(options.outputDir),
    await runDuplicateDeliveryScenario(options.outputDir),
  ];
  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    outputDir: options.outputDir,
    totalScenarios: scenarios.length,
    passedScenarios: scenarios.filter((scenario) => scenario.passed).length,
    failedScenarios: scenarios.filter((scenario) => !scenario.passed).length,
    scenarios,
  };
}

/**
 * Writes the queue delivery rehearsal report to a JSON file.
 */
export function writeStableQueueDeliveryRehearsalReport(
  outputFile: string,
  report: StableQueueDeliveryRehearsalReport,
): void {
  writeJson(outputFile, report);
}
