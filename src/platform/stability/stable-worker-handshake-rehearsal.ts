/**
 * Stable Worker Handshake Rehearsal Module
 *
 * This module validates the worker handshake protocol - the mechanism by which
 * workers claim execution leases and maintain them through heartbeat signals.
 * It tests three critical scenarios:
 *
 * 1. Worker Claim: Verifies that when a worker claims an execution:
 *    - The ticket is consumed
 *    - The execution transitions to "executing" status
 *    - The worker's running executions list is updated
 *
 * 2. Heartbeat Renewal: Verifies that worker heartbeats:
 *    - Are accepted by the handshake service
 *    - Update the lease's lastHeartbeatAt timestamp
 *    - Are persisted as heartbeat snapshots in storage
 *
 * 3. Stale Fencing Rejection: Verifies that after a lease expires and is
 *    re-acquired by another party (with a new fencing token), the original
 *    worker cannot continue with heartbeats using the stale token.
 *
 * These tests ensure the integrity of the worker-to-execution ownership protocol.
 *
 * @see {@link docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md}
 *   Quality engineering contract defining handshake and lease lifecycle tests
 * @see {@link docs_zh/architecture/00-platform-architecture.md}
 *   Architecture document for worker handshake protocol design
 * @see {@link docs_zh/governance/glossary_and_terminology.md}
 *   Glossary defining handshake, lease, fencing token, and heartbeat terminology
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { ExecutionDispatchService } from "../execution/dispatcher/execution-dispatch-service.js";
import { ExecutionLeaseService } from "../execution/lease/execution-lease-service.js";
import { ExecutionWorkerHandshakeService } from "../execution/worker-pool/execution-worker-handshake-service.js";
import { WorkerRegistryService } from "../execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../state-evidence/truth/sqlite-database.js";
import { nowIso } from "../contracts/types/ids.js";

/**
 * Options for the worker handshake rehearsal test runner.
 */
export interface StableWorkerHandshakeRehearsalOptions {
  /** Directory where test databases and reports will be written */
  outputDir: string;
}

/**
 * Result of a single worker handshake scenario test.
 */
export interface StableWorkerHandshakeScenarioResult {
  /** Unique identifier for the scenario tested */
  scenarioId:
    | "worker_claim_consumes_ticket"
    | "worker_heartbeat_renews_lease"
    | "stale_fencing_handshake_rejected";
  /** Whether the scenario passed all assertions */
  passed: boolean;
  /** Time taken to run the scenario in milliseconds */
  durationMs: number;
  /** Human-readable summary of what was tested and the outcome */
  summary: string;
  /** Detailed results and state snapshots from the scenario */
  details: Record<string, unknown>;
}

/**
 * Aggregated report from all worker handshake rehearsal scenarios.
 */
export interface StableWorkerHandshakeRehearsalReport {
  /** ISO timestamp when the rehearsal started */
  startedAt: string;
  /** ISO timestamp when the rehearsal finished */
  finishedAt: string;
  /** Directory containing all generated artifacts */
  outputDir: string;
  /** Total number of scenarios run */
  totalScenarios: number;
  /** Number of scenarios that passed */
  passedScenarios: number;
  /** Number of scenarios that failed */
  failedScenarios: number;
  /** Individual results for each scenario */
  scenarios: StableWorkerHandshakeScenarioResult[];
}

/**
 * Writes a value as formatted JSON to a file, creating parent directories as needed.
 * @param path - File path to write to
 * @param value - Serializable value to write as JSON
 */
function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

/**
 * Executes a scenario function and measures its duration.
 * Wraps scenario results with timing information.
 * 
 * @param scenarioId - Identifier for the scenario being measured
 * @param run - Async function containing the scenario logic
 * @returns Scenario result with timing information
 */
async function measureScenario(
  scenarioId: StableWorkerHandshakeScenarioResult["scenarioId"],
  run: () => Promise<Omit<StableWorkerHandshakeScenarioResult, "scenarioId" | "durationMs">>,
): Promise<StableWorkerHandshakeScenarioResult> {
  const started = performance.now();
  const result = await run();
  return {
    scenarioId,
    durationMs: Math.round((performance.now() - started) * 100) / 100,
    ...result,
  };
}

/**
 * Seeds the database with a task and execution record for handshake testing.
 * Creates a minimal task/execution pair in "created" status that can be
 * used to test the worker claiming and handshake workflow.
 * 
 * @param db - SQLite database instance
 * @param store - Authoritative task store for database operations
 * @param input - Object containing taskId, executionId, and traceId
 */
function seedTaskAndExecution(
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
      title: "Stable worker handshake rehearsal task",
      status: "pending",
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
    store.execution.insertExecution({
      id: input.executionId,
      taskId: input.taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-worker-handshake",
      roleId: "general_executor",
      runKind: "task_run",
      status: "created",
      inputRef: null,
      traceId: input.traceId,
      attempt: 1,
      timeoutMs: 1_000,
      budgetUsdLimit: 1,
      budgetReservationId: null,
      budgetLedgerId: null,
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
 * Seeds a complete dispatched execution scenario by:
 * 1. Creating a task and execution
 * 2. Registering a worker with the registry
 * 3. Creating a dispatch ticket
 * 4. Dispatching the ticket to the worker
 * 
 * Returns the ticket ID, lease ID, and initial fencing token needed
 * for subsequent handshake operations. The database is closed before
 * returning since this is a setup function for other scenarios.
 * 
 * @param dbPath - Path to the SQLite database file
 * @returns Object containing ticketId, leaseId, and initial fencingToken
 */
function seedDispatchedExecution(dbPath: string): {
  ticketId: string;
  leaseId: string;
  fencingToken: number;
} {
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const workers = new WorkerRegistryService(store);
  const dispatch = new ExecutionDispatchService(db, store);
  seedTaskAndExecution(db, store, {
    taskId: "task-worker-handshake",
    executionId: "exec-worker-handshake",
    traceId: "trace-worker-handshake",
  });
  workers.recordHeartbeat({
    workerId: "worker-handshake",
    status: "idle",
    capabilities: ["bash"],
    runningExecutionIds: [],
    maxConcurrency: 1,
    queueAffinity: "default",
    occurredAt: "2026-04-04T11:00:00.000Z",
  });
  const created = dispatch.createTicket({
    executionId: "exec-worker-handshake",
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

  return {
    ticketId: created.ticket.id,
    leaseId: dispatched.leaseId ?? "",
    fencingToken: 1,
  };
}

/**
 * Scenario: Worker claim consumes the ticket and promotes execution to active runtime.
 * 
 * Sets up a dispatched execution and verifies that claiming it:
 * - Results in the handshake accepting the claim (accepted=true)
 * - Transitions the ticket from "created" to "consumed" status
 * - Changes the execution status to "executing"
 * - Updates the worker's running executions list to include this execution
 */
async function runClaimScenario(outputDir: string): Promise<StableWorkerHandshakeScenarioResult> {
  return measureScenario("worker_claim_consumes_ticket", async () => {
    const dbPath = join(outputDir, "worker-claim.db");
    rmSync(dbPath, { force: true });
    const seeded = seedDispatchedExecution(dbPath);

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    const handshake = new ExecutionWorkerHandshakeService(db, store);
    const decision = handshake.claimExecution({
      ticketId: seeded.ticketId,
      workerId: "worker-handshake",
      leaseId: seeded.leaseId,
      fencingToken: seeded.fencingToken,
      occurredAt: "2026-04-04T11:00:07.000Z",
    });
    const ticket = store.worker.getExecutionTicket(seeded.ticketId);
    const execution = store.dispatch.getExecution("exec-worker-handshake");
    const worker = store.worker.getWorkerSnapshot("worker-handshake");
    db.close();

    return {
      passed:
        decision.accepted &&
        ticket?.status === "consumed" &&
        execution?.status === "executing" &&
        worker != null &&
        worker.runningExecutionsJson.includes("exec-worker-handshake"),
      summary: "worker claim consumes the claimed ticket and promotes the execution into active runtime ownership",
      details: {
        decision,
        ticket,
        executionStatus: execution?.status ?? null,
        worker,
      },
    };
  });
}

/**
 * Scenario: Worker heartbeat renews the lease and records execution liveness.
 * 
 * Claims an execution, then sends a heartbeat. Verifies that:
 * - The heartbeat is accepted
 * - The lease's lastHeartbeatAt timestamp is updated to the heartbeat time
 * - Multiple heartbeat snapshots exist (from claim + heartbeat)
 * - The latest heartbeat's progress message is correctly recorded
 */
async function runHeartbeatScenario(outputDir: string): Promise<StableWorkerHandshakeScenarioResult> {
  return measureScenario("worker_heartbeat_renews_lease", async () => {
    const dbPath = join(outputDir, "worker-heartbeat.db");
    rmSync(dbPath, { force: true });
    const seeded = seedDispatchedExecution(dbPath);

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    const handshake = new ExecutionWorkerHandshakeService(db, store);
    handshake.claimExecution({
      ticketId: seeded.ticketId,
      workerId: "worker-handshake",
      leaseId: seeded.leaseId,
      fencingToken: seeded.fencingToken,
      occurredAt: "2026-04-04T11:00:07.000Z",
    });
    const decision = handshake.recordHeartbeat({
      executionId: "exec-worker-handshake",
      workerId: "worker-handshake",
      leaseId: seeded.leaseId,
      fencingToken: seeded.fencingToken,
      ttlMs: 30_000,
      occurredAt: "2026-04-04T11:00:10.000Z",
      progressMessage: "still running",
    });
    const lease = store.worker.getExecutionLease(seeded.leaseId);
    const heartbeats = store.worker.listHeartbeatSnapshotsByExecution("exec-worker-handshake");
    db.close();

    return {
      passed:
        decision.accepted &&
        lease?.lastHeartbeatAt === "2026-04-04T11:00:10.000Z" &&
        heartbeats.length >= 2 &&
        heartbeats.at(-1)?.progressMessage === "still running",
      summary: "worker heartbeat renews the lease and records execution liveness in storage",
      details: {
        decision,
        lease,
        heartbeats,
      },
    };
  });
}

/**
 * Scenario: Stale workers cannot continue heartbeat writes after lease failover.
 * 
 * Claims an execution, then simulates a lease expiration and re-acquisition
 * by another party (which increments the fencing token). Verifies that:
 * - The new lease is granted with a new fencing token (token = 2)
 * - The original worker's heartbeat is rejected with "stale_fencing_token"
 * - This prevents a stale worker from continuing to write progress for
 *   an execution that has been handed off to another worker
 */
async function runStaleFencingScenario(outputDir: string): Promise<StableWorkerHandshakeScenarioResult> {
  return measureScenario("stale_fencing_handshake_rejected", async () => {
    const dbPath = join(outputDir, "worker-stale-fencing.db");
    rmSync(dbPath, { force: true });
    const seeded = seedDispatchedExecution(dbPath);

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    const handshake = new ExecutionWorkerHandshakeService(db, store);
    const leases = new ExecutionLeaseService(db, store);
    handshake.claimExecution({
      ticketId: seeded.ticketId,
      workerId: "worker-handshake",
      leaseId: seeded.leaseId,
      fencingToken: seeded.fencingToken,
      occurredAt: "2026-04-04T11:00:07.000Z",
    });
    leases.reclaimExpiredLeases("2026-04-04T11:01:00.000Z");
    const renewed = leases.acquireLease({
      executionId: "exec-worker-handshake",
      workerId: "worker-handshake",
      ttlMs: 30_000,
      queueName: "default",
      occurredAt: "2026-04-04T11:01:00.000Z",
    });
    const decision = handshake.recordHeartbeat({
      executionId: "exec-worker-handshake",
      workerId: "worker-handshake",
      leaseId: seeded.leaseId,
      fencingToken: seeded.fencingToken,
      ttlMs: 30_000,
      occurredAt: "2026-04-04T11:01:05.000Z",
    });
    db.close();

    return {
      passed:
        renewed.outcome === "granted" &&
        renewed.lease?.fencingToken === 2 &&
        !decision.accepted &&
        decision.reasonCode === "stale_fencing_token",
      summary: "stale workers cannot continue heartbeat writes after lease failover changes the fencing token",
      details: {
        renewed,
        decision,
      },
    };
  });
}

/**
 * Runs all worker handshake rehearsal scenarios and produces an aggregated report.
 * 
 * Executes three scenarios:
 * 1. Worker claim - verifies ticket consumption and execution state transition
 * 2. Heartbeat renewal - verifies lease renewal and liveness recording
 * 3. Stale fencing - verifies that stale workers are rejected after failover
 * 
 * @param options - Rehearsal options including output directory
 * @returns Aggregated report with all scenario results
 */
export async function runStableWorkerHandshakeRehearsal(
  options: StableWorkerHandshakeRehearsalOptions,
): Promise<StableWorkerHandshakeRehearsalReport> {
  mkdirSync(options.outputDir, { recursive: true });
  const startedAt = nowIso();
  const scenarios = [
    await runClaimScenario(options.outputDir),
    await runHeartbeatScenario(options.outputDir),
    await runStaleFencingScenario(options.outputDir),
  ];

  return {
    startedAt,
    finishedAt: nowIso(),
    outputDir: options.outputDir,
    totalScenarios: scenarios.length,
    passedScenarios: scenarios.filter((scenario) => scenario.passed).length,
    failedScenarios: scenarios.filter((scenario) => !scenario.passed).length,
    scenarios,
  };
}

/**
 * Writes the worker handshake rehearsal report to a JSON file.
 * 
 * @param outputFile - Path where the report JSON should be written
 * @param report - The report data to serialize and write
 */
export function writeStableWorkerHandshakeRehearsalReport(
  outputFile: string,
  report: StableWorkerHandshakeRehearsalReport,
): void {
  writeJson(outputFile, report);
}
