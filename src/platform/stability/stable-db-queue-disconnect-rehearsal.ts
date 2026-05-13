/**
 * Stable DB Queue Disconnect Rehearsal
 *
 * Tests the system's behavior when the dispatch queue becomes unavailable or
 * disconnected from the authoritative database. Validates that:
 *
 * 1. Queue disconnect degrades gracefully without silently dropping tickets
 *    - Tickets remain in pending state with explicit "blocked" decision
 *    - No work is lost during queue unavailability
 *
 * 2. Missing dispatch tickets are rebuilt after queue reconnect
 *    - The repair service scans for missing tickets
 *    - Rebuilds tickets from authoritative DB truth and plan metadata
 *    - Preserves all ticket attributes (capabilities, isolation level, etc.)
 *
 * 3. Authoritative writeback failures fail closed until store recovers
 *    - Writeback rejections during DB outage are properly handled
 *    - System recovers and succeeds once the store becomes available
 *    - No silent failures or data loss
 *
 * These scenarios verify QA-76 contract requirements for queue disconnect
 * handling and database recovery behavior.
 *
 * @see execution-db-queue-disconnect-repair-service.ts for the repair logic
 * @see docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md for QA-76
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { StorageError } from "../contracts/errors.js";
import { ExecutionDbQueueDisconnectRepairService } from "../execution/recovery/execution-db-queue-disconnect-repair-service.js";
import {
  ExecutionDispatchService,
  type DispatchQueueAvailabilitySnapshot,
} from "../execution/dispatcher/execution-dispatch-service.js";
import { ExecutionWorkerHandshakeService } from "../execution/worker-pool/execution-worker-handshake-service.js";
import { ExecutionWorkerWritebackService } from "../execution/worker-pool/execution-worker-writeback-service.js";
import { WorkerRegistryService } from "../execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../state-evidence/truth/sqlite-database.js";
import { nowIso } from "../contracts/types/ids.js";

/** Options for running the DB queue disconnect rehearsal */
export interface StableDbQueueDisconnectRehearsalOptions {
  outputDir: string;
}

/** Result of a single queue disconnect scenario */
export interface StableDbQueueDisconnectScenarioResult {
  scenarioId:
    | "queue_disconnect_degrades_without_silent_drop"
    | "missing_dispatch_ticket_rebuilt_after_queue_reconnect"
    | "authoritative_writeback_failure_fails_closed_until_store_recovers";
  passed: boolean;
  durationMs: number;
  summary: string;
  details: Record<string, unknown>;
}

/** Complete report from the DB queue disconnect rehearsal */
export interface StableDbQueueDisconnectRehearsalReport {
  startedAt: string;
  finishedAt: string;
  outputDir: string;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  scenarios: StableDbQueueDisconnectScenarioResult[];
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
  scenarioId: StableDbQueueDisconnectScenarioResult["scenarioId"],
  run: () => Promise<Omit<StableDbQueueDisconnectScenarioResult, "scenarioId" | "durationMs">>,
): Promise<StableDbQueueDisconnectScenarioResult> {
  const started = performance.now();
  const result = await run();
  return {
    scenarioId,
    durationMs: Math.round((performance.now() - started) * 100) / 100,
    ...result,
  };
}

/**
 * Seeds the database with a minimal task, execution, workflow, and session.
 * This creates the authoritative records needed for dispatch testing.
 * The task starts in "in_progress" status to allow execution operations.
 */
function seedTaskExecutionWorkflowAndSession(
  db: SqliteDatabase,
  store: AuthoritativeTaskStore,
  input: {
    taskId: string;
    executionId: string;
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
      title: "Stable DB queue disconnect rehearsal task",
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
      agentId: "agent-db-queue-disconnect",
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
      id: `sess-${input.taskId}`,
      taskId: input.taskId,
      channel: "cli",
      status: "streaming",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

/**
 * Seeds a worker with specific capabilities for dispatch scenarios.
 * The worker is registered with "bash" capability to match test requirements.
 */
function seedWorker(store: AuthoritativeTaskStore, occurredAt = "2026-04-07T12:00:00.000Z"): void {
  const workers = new WorkerRegistryService(store);
  workers.recordHeartbeat({
    workerId: "worker-db-queue-disconnect",
    status: "idle",
    capabilities: ["bash"],
    runningExecutionIds: [],
    maxConcurrency: 1,
    queueAffinity: "default",
    runtimeInstanceId: "runtime-db-queue-disconnect-1",
    occurredAt,
  });
}

/**
 * Scenario 1: Queue disconnect degrades gracefully without silent drop.
 *
 * Simulates queue unavailability and verifies that:
 * - Ticket creation still succeeds (ticket is created in DB)
 * - Dispatch returns "blocked" outcome with "queue_unavailable" reason
 * - The ticket remains in "pending" state (not dropped)
 * - A dispatch decision event is recorded for audit
 */
async function runQueueDisconnectDegradeScenario(outputDir: string): Promise<StableDbQueueDisconnectScenarioResult> {
  return measureScenario("queue_disconnect_degrades_without_silent_drop", async () => {
    const dbPath = join(outputDir, "queue-disconnect-degrade.db");
    rmSync(dbPath, { force: true });

    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskExecutionWorkflowAndSession(db, store, {
      taskId: "task-queue-disconnect-degrade",
      executionId: "exec-queue-disconnect-degrade",
      traceId: "trace-queue-disconnect-degrade",
    });
    seedWorker(store, "2026-04-07T12:00:00.000Z");

    // Configure dispatch with unavailable queue to simulate disconnect
    const dispatch = new ExecutionDispatchService(
      db,
      store,
      null,
      () =>
        ({
          state: "unavailable",
          reasonCode: "queue_unavailable",
        }) satisfies DispatchQueueAvailabilitySnapshot,
    );
    const created = dispatch.createTicket({
      executionId: "exec-queue-disconnect-degrade",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-07T12:00:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-07T12:00:06.000Z",
    });
    const tickets = store.worker.listExecutionTicketsByExecution("exec-queue-disconnect-degrade");
    const events = store.event.listEventsForTask("task-queue-disconnect-degrade");
    db.close();

    return {
      passed:
        created.outcome === "created" &&
        decision.outcome === "blocked" &&
        decision.reasonCode === "queue_unavailable" &&
        decision.ticket?.id === created.ticket.id &&
        tickets.length === 1 &&
        tickets[0]?.status === "pending" &&
        events.some((event) => event.eventType === "dispatch:decision_recorded"),
      summary: "queue disconnect degrades dispatch to an explicit blocked state while preserving the authoritative ticket",
      details: {
        created,
        decision,
        tickets,
        eventTypes: events.map((event) => event.eventType),
      },
    };
  });
}

/**
 * Scenario 2: Missing dispatch tickets are rebuilt after queue reconnect.
 *
 * Tests the repair service's ability to recover from ticket loss:
 * - Creates a ticket with specific attributes (capabilities, isolation, version)
 * - Deletes the ticket directly from the database to simulate loss
 * - Runs the repair scan and repair process
 * - Verifies the ticket is rebuilt with all original attributes preserved
 * - Checks that dispatch:ticket_rebuilt event is emitted
 */
async function runMissingTicketRepairScenario(outputDir: string): Promise<StableDbQueueDisconnectScenarioResult> {
  return measureScenario("missing_dispatch_ticket_rebuilt_after_queue_reconnect", async () => {
    const dbPath = join(outputDir, "queue-disconnect-repair.db");
    rmSync(dbPath, { force: true });

    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskExecutionWorkflowAndSession(db, store, {
      taskId: "task-queue-disconnect-repair",
      executionId: "exec-queue-disconnect-repair",
      traceId: "trace-queue-disconnect-repair",
    });
    const dispatch = new ExecutionDispatchService(db, store);

    // Create ticket with specific attributes that must be preserved in rebuild
    const created = dispatch.createTicket({
      executionId: "exec-queue-disconnect-repair",
      queueName: "default",
      dispatchTarget: "require_remote",
      requiredIsolationLevel: "strict",
      requiredRepoVersion: "repo-v7",
      requiredCapabilities: ["bash", "python"],
      dispatchAfter: "2026-04-07T12:10:30.000Z",
      occurredAt: "2026-04-07T12:10:05.000Z",
    });

    // Simulate ticket loss by deleting it directly
    db.connection.prepare("DELETE FROM execution_tickets WHERE id = ?").run(created.ticket.id);

    // Run repair to rebuild the missing ticket
    const repair = new ExecutionDbQueueDisconnectRepairService(db, store);
    const issues = repair.scan();
    const repaired = repair.repair("2026-04-07T12:10:08.000Z");
    const tickets = store.worker.listExecutionTicketsByExecution("exec-queue-disconnect-repair");
    const rebuiltTicket = tickets.find((ticket) => ticket.id !== created.ticket.id) ?? null;
    const rebuiltCapabilities = rebuiltTicket ? JSON.parse(rebuiltTicket.requiredCapabilitiesJson) as string[] : [];
    const events = store.event.listEventsForTask("task-queue-disconnect-repair");
    db.close();

    return {
      passed:
        issues.some((issue) => issue.issueType === "missing_dispatch_ticket" && issue.recoveredFromPlan) &&
        repaired.applied.some((item) => item.applied && item.replacementTicketId != null && item.recoveredFromPlan) &&
        rebuiltTicket?.queueName === "default" &&
        rebuiltTicket?.dispatchTarget === "require_remote" &&
        rebuiltTicket?.requiredIsolationLevel === "strict" &&
        rebuiltTicket?.requiredRepoVersion === "repo-v7" &&
        rebuiltTicket?.dispatchAfter === "2026-04-07T12:10:30.000Z" &&
        rebuiltCapabilities.includes("bash") &&
        rebuiltCapabilities.includes("python") &&
        events.some((event) => event.eventType === "dispatch:ticket_rebuilt"),
      summary: "after queue reconnect, the repair job rebuilds a missing dispatch ticket from authoritative DB truth and plan metadata",
      details: {
        created,
        issues,
        repaired,
        tickets,
        rebuiltCapabilities,
        eventTypes: events.map((event) => event.eventType),
      },
    };
  });
}

/**
 * Scenario 3: Authoritative writeback fails closed during DB outage.
 *
 * Verifies that writeback operations properly handle DB unavailability:
 * - Successfully claims execution lease
 * - First writeback attempt fails with "authoritative_store_unavailable"
 * - After simulated recovery, second writeback succeeds
 * - Task reaches "done" status and lease is released
 * - Both rejection and success events are recorded
 */
async function runAuthoritativeWritebackFailureScenario(
  outputDir: string,
): Promise<StableDbQueueDisconnectScenarioResult> {
  return measureScenario("authoritative_writeback_failure_fails_closed_until_store_recovers", async () => {
    const dbPath = join(outputDir, "queue-disconnect-writeback.db");
    rmSync(dbPath, { force: true });

    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const dispatch = new ExecutionDispatchService(db, store);
    const handshake = new ExecutionWorkerHandshakeService(db, store);
    const writeback = new ExecutionWorkerWritebackService(db, store);
    seedTaskExecutionWorkflowAndSession(db, store, {
      taskId: "task-queue-disconnect-writeback",
      executionId: "exec-queue-disconnect-writeback",
      traceId: "trace-queue-disconnect-writeback",
    });
    seedWorker(store, "2026-04-07T12:20:00.000Z");

    // Create and dispatch ticket
    const created = dispatch.createTicket({
      executionId: "exec-queue-disconnect-writeback",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-07T12:20:05.000Z",
    });
    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-07T12:20:06.000Z",
    });

    // Worker claims the execution
    const claim = handshake.claimExecution({
      ticketId: created.ticket.id,
      workerId: "worker-db-queue-disconnect",
      leaseId: dispatched.leaseId ?? "",
      fencingToken: 1,
      runtimeInstanceId: "runtime-db-queue-disconnect-1",
      occurredAt: "2026-04-07T12:20:07.000Z",
    });

    // Inject failure into writeback by temporarily modifying applyTaskTerminalState
    const transitionService = (writeback as unknown as {
      transitions: { applyTaskTerminalState: (...args: unknown[]) => unknown };
    }).transitions;
    const originalApplyTaskTerminalState = transitionService.applyTaskTerminalState.bind(transitionService);
    transitionService.applyTaskTerminalState = (() => {
      throw new StorageError(
        "db_queue_disconnect_drill:authoritative_store_unavailable",
        "db_queue_disconnect_drill:authoritative_store_unavailable",
        {
          retryable: true,
        },
      );
    }) as typeof transitionService.applyTaskTerminalState;

    // First writeback fails due to injected DB error
    const failed = writeback.recordWriteback({
      executionId: "exec-queue-disconnect-writeback",
      workerId: "worker-db-queue-disconnect",
      leaseId: dispatched.leaseId ?? "",
      fencingToken: 1,
      runtimeInstanceId: "runtime-db-queue-disconnect-1",
      terminalStatus: "done",
      occurredAt: "2026-04-07T12:20:10.000Z",
    });

    // Restore normal behavior for subsequent writeback
    transitionService.applyTaskTerminalState = originalApplyTaskTerminalState;

    // Second writeback succeeds after recovery
    const recovered = writeback.recordWriteback({
      executionId: "exec-queue-disconnect-writeback",
      workerId: "worker-db-queue-disconnect",
      leaseId: dispatched.leaseId ?? "",
      fencingToken: 1,
      runtimeInstanceId: "runtime-db-queue-disconnect-1",
      terminalStatus: "done",
      occurredAt: "2026-04-07T12:20:11.000Z",
    });

    // Verify final state
    const snapshot = store.operations.loadTaskSnapshot("task-queue-disconnect-writeback");
    const lease = store.worker.getExecutionLease(dispatched.leaseId ?? "");
    const events = store.event.listEventsForTask("task-queue-disconnect-writeback");
    db.close();

    return {
      passed:
        claim.accepted &&
        failed.accepted === false &&
        failed.reasonCode === "authoritative_store_unavailable" &&
        recovered.accepted &&
        snapshot.execution?.status === "succeeded" &&
        snapshot.task.status === "done" &&
        lease?.status === "released" &&
        events.filter((event) => event.eventType === "worker:writeback_rejected").some((event) => {
          const payload = JSON.parse(event.payloadJson) as { reasonCode?: string | null };
          return payload.reasonCode === "authoritative_store_unavailable";
        }) &&
        events.some((event) => event.eventType === "worker:writeback_recorded"),
      summary: "authoritative writeback fails closed during DB outage and succeeds only after the store recovers",
      details: {
        created,
        dispatched,
        claim,
        failed,
        recovered,
        snapshot,
        lease,
        eventTypes: events.map((event) => event.eventType),
      },
    };
  });
}

/**
 * Runs all DB queue disconnect rehearsal scenarios.
 *
 * Executes three scenarios sequentially:
 * 1. Queue disconnect degrades gracefully
 * 2. Missing ticket rebuild after reconnect
 * 3. Writeback failure handling
 *
 * Returns an aggregated report with results from all scenarios.
 */
export async function runStableDbQueueDisconnectRehearsal(
  options: StableDbQueueDisconnectRehearsalOptions,
): Promise<StableDbQueueDisconnectRehearsalReport> {
  const startedAt = new Date().toISOString();
  const scenarios = [
    await runQueueDisconnectDegradeScenario(options.outputDir),
    await runMissingTicketRepairScenario(options.outputDir),
    await runAuthoritativeWritebackFailureScenario(options.outputDir),
  ];
  const finishedAt = new Date().toISOString();

  return {
    startedAt,
    finishedAt,
    outputDir: options.outputDir,
    totalScenarios: scenarios.length,
    passedScenarios: scenarios.filter((scenario) => scenario.passed).length,
    failedScenarios: scenarios.filter((scenario) => !scenario.passed).length,
    scenarios,
  };
}

/**
 * Writes the DB queue disconnect rehearsal report to a JSON file.
 */
export function writeStableDbQueueDisconnectRehearsalReport(path: string, report: StableDbQueueDisconnectRehearsalReport): void {
  writeJson(path, report);
}
