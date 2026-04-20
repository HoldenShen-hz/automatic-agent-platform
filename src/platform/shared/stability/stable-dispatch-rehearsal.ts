/**
 * Stable Dispatch Rehearsal Module
 *
 * This module validates the execution dispatch service behavior through
 * scenario-based testing. It verifies that the dispatcher correctly:
 * - Selects capable workers based on required capabilities
 * - Respects dispatch_after timing constraints
 * - Handles capability gaps by leaving tickets pending
 *
 * Each scenario is measured for duration and produces detailed results
 * for post-analysis of dispatch decisions.
 *
 * @see {@link docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md}
 *   Quality engineering contract defining dispatch and capability-based routing tests
 * @see {@link docs_zh/automatic_agent_patform_arthitecture_design.md}
 *   Main architecture document for dispatch service design
 * @see {@link docs_zh/governance/glossary_and_terminology.md}
 *   Glossary defining dispatch-related terminology (tickets, leases, capabilities)
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { ExecutionDispatchService } from "../../execution/dispatcher/execution-dispatch-service.js";
import { WorkerRegistryService } from "../../execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../state-evidence/truth/sqlite-database.js";
import { nowIso } from "../../contracts/types/ids.js";

/**
 * Options for the dispatch rehearsal test runner.
 */
export interface StableDispatchRehearsalOptions {
  /** Directory where test databases and reports will be written */
  outputDir: string;
}

/**
 * Result of a single dispatch scenario test.
 */
export interface StableDispatchScenarioResult {
  /** Unique identifier for the scenario tested */
  scenarioId:
    | "dispatch_claims_capable_worker"
    | "dispatch_balances_affinity_against_hotspot_load"
    | "dispatch_respects_dispatch_after"
    | "dispatch_reports_no_worker_for_capability_gap";
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
 * Aggregated report from all dispatch rehearsal scenarios.
 */
export interface StableDispatchRehearsalReport {
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
  scenarios: StableDispatchScenarioResult[];
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
  scenarioId: StableDispatchScenarioResult["scenarioId"],
  run: () => Promise<Omit<StableDispatchScenarioResult, "scenarioId" | "durationMs">>,
): Promise<StableDispatchScenarioResult> {
  const started = performance.now();
  const result = await run();
  return {
    scenarioId,
    durationMs: Math.round((performance.now() - started) * 100) / 100,
    ...result,
  };
}

/**
 * Seeds the database with a task and execution record for dispatch testing.
 * Creates a minimal task/execution pair that can be used to test dispatch behavior.
 * 
 * @param db - SQLite database instance
 * @param store - Authoritative task store for database operations
 * @param input - Object containing taskId, executionId, traceId, and optional priority
 */
function seedTaskAndExecution(
  db: SqliteDatabase,
  store: AuthoritativeTaskStore,
  input: {
    taskId: string;
    executionId: string;
    traceId: string;
    priority?: "low" | "normal" | "high" | "urgent";
  },
): void {
  const now = nowIso();
  db.transaction(() => {
    store.task.insertTask({
      id: input.taskId,
      parentId: null,
      rootId: input.taskId,
      divisionId: "general_ops",
      title: "Stable dispatch rehearsal task",
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
      agentId: "agent-dispatch-rehearsal",
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
 * Scenario: Dispatch selects a capable worker and properly routes the ticket.
 * 
 * Sets up two workers (one with "bash,edit", one with only "bash") and creates
 * a ticket requiring "bash,edit". Verifies that:
 * - The ticket is created successfully
 * - Dispatch selects the worker with matching capabilities
 * - A lease is granted to the selected worker
 * - The ticket is claimed
 * - The dispatch decision event records the correct worker selection
 * - The unqualified worker is rejected with "missing_capabilities"
 */
async function runCapableWorkerDispatch(outputDir: string): Promise<StableDispatchScenarioResult> {
  return measureScenario("dispatch_claims_capable_worker", async () => {
    const dbPath = join(outputDir, "dispatch-capable-worker.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-capable",
      executionId: "exec-dispatch-capable",
      traceId: "trace-dispatch-capable",
      priority: "high",
    });
    workers.recordHeartbeat({
      workerId: "worker-capable",
      status: "idle",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:00:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-readonly",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:00:00.000Z",
    });

    const ticket = dispatch.createTicket({
      executionId: "exec-dispatch-capable",
      queueName: "default",
      requiredCapabilities: ["bash", "edit"],
      occurredAt: "2026-04-04T10:00:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:00:06.000Z",
    });
    const lease = decision.leaseId ? store.worker.getExecutionLease(decision.leaseId) : null;
    const claimedTicket = store.worker.getExecutionTicket(ticket.ticket.id);
    const decisionEvent = store
      .listEventsForTask("task-dispatch-capable")
      .find((event) => event.eventType === "dispatch:decision_recorded");
    const decisionPayload = decisionEvent
      ? (JSON.parse(decisionEvent.payloadJson) as { selectedWorkerId: string | null; evaluations: Array<{ workerId: string; rejectionReason: string | null }> })
      : null;
    db.close();

    return {
      passed:
        ticket.outcome === "created" &&
        decision.outcome === "dispatched" &&
        decision.worker?.workerId === "worker-capable" &&
        claimedTicket?.status === "claimed" &&
        lease?.workerId === "worker-capable" &&
        decision.trace?.selectedWorkerId === "worker-capable" &&
        decisionPayload?.selectedWorkerId === "worker-capable" &&
        decisionPayload?.evaluations.some(
          (item) => item.workerId === "worker-readonly" && item.rejectionReason === "missing_capabilities",
        ) === true,
      summary: "dispatch selects a capable worker, grants a lease, and claims the ticket",
      details: {
        ticket,
        decision,
        decisionPayload,
        claimedTicket,
        lease,
      },
    };
  });
}

async function runAffinityLoadBalancingScenario(outputDir: string): Promise<StableDispatchScenarioResult> {
  return measureScenario("dispatch_balances_affinity_against_hotspot_load", async () => {
    const dbPath = join(outputDir, "dispatch-affinity-load-balance.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-affinity-balance",
      executionId: "exec-dispatch-affinity-balance",
      traceId: "trace-dispatch-affinity-balance",
      priority: "high",
    });
    workers.recordHeartbeat({
      workerId: "worker-affinity-hotspot",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-other-1"],
      maxConcurrency: 4,
      queueAffinity: "default",
      activeLeaseCount: 3,
      saturation: 0.95,
      cpuPct: 83,
      toolBacklogCount: 3,
      occurredAt: "2026-04-07T18:30:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-general-spare",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: null,
      activeLeaseCount: 0,
      saturation: 0.05,
      cpuPct: 9,
      toolBacklogCount: 0,
      occurredAt: "2026-04-07T18:30:00.000Z",
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-affinity-balance",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-07T18:30:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-07T18:30:06.000Z",
    });
    db.close();

    return {
      passed:
        decision.outcome === "dispatched" &&
        decision.worker?.workerId === "worker-general-spare" &&
        decision.trace?.evaluations.some(
          (item) =>
            item.workerId === "worker-affinity-hotspot" &&
            item.affinityMatched === true &&
            item.loadSkewPenaltyApplied === true,
        ) === true,
      summary: "dispatch sheds sticky affinity load when a hotspot worker dominates active leases and spare capacity exists",
      details: {
        decision,
      },
    };
  });
}

/**
 * Scenario: Dispatch respects dispatch_after timing constraints.
 * 
 * Creates a ticket with a dispatch_after timestamp in the future and verifies that:
 * - Early dispatch attempts (before dispatch_after time) return "no_ticket"
 * - Dispatch attempts after the dispatch_after time successfully dispatch
 * - Only one dispatch decision event is recorded (when timing is right)
 */
async function runDispatchAfterScenario(outputDir: string): Promise<StableDispatchScenarioResult> {
  return measureScenario("dispatch_respects_dispatch_after", async () => {
    const dbPath = join(outputDir, "dispatch-after.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-after",
      executionId: "exec-dispatch-after",
      traceId: "trace-dispatch-after",
    });
    workers.recordHeartbeat({
      workerId: "worker-delay",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:00:00.000Z",
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-after",
      queueName: "default",
      requiredCapabilities: ["bash"],
      dispatchAfter: "2026-04-04T10:05:00.000Z",
      occurredAt: "2026-04-04T10:00:05.000Z",
    });
    const early = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:01:00.000Z",
    });
    const later = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:05:01.000Z",
    });
    const decisionEvents = store
      .listEventsForTask("task-dispatch-after")
      .filter((event) => event.eventType === "dispatch:decision_recorded");
    db.close();

    return {
      passed:
        early.outcome === "no_ticket" &&
        later.outcome === "dispatched" &&
        later.worker?.workerId === "worker-delay" &&
        decisionEvents.length === 1,
      summary: "dispatch_after prevents early routing and allows routing once the release time is reached",
      details: {
        early,
        later,
        decisionEvents: decisionEvents.map((event) => JSON.parse(event.payloadJson)),
      },
    };
  });
}

/**
 * Scenario: Dispatch handles capability gaps by leaving tickets pending.
 * 
 * Creates a ticket requiring "mcp" capability but only has a worker with "bash".
 * Verifies that:
 * - Dispatch returns "no_worker" outcome
 * - The ticket remains in "pending" status
 * - The dispatch decision event records the outcome as "no_worker"
 * - The worker is rejected with "missing_capabilities" reason
 */
async function runCapabilityGapScenario(outputDir: string): Promise<StableDispatchScenarioResult> {
  return measureScenario("dispatch_reports_no_worker_for_capability_gap", async () => {
    const dbPath = join(outputDir, "dispatch-capability-gap.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-gap",
      executionId: "exec-dispatch-gap",
      traceId: "trace-dispatch-gap",
    });
    workers.recordHeartbeat({
      workerId: "worker-basic",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:00:00.000Z",
    });

    const ticket = dispatch.createTicket({
      executionId: "exec-dispatch-gap",
      queueName: "default",
      requiredCapabilities: ["mcp"],
      occurredAt: "2026-04-04T10:00:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:00:06.000Z",
    });
    const pendingTicket = store.worker.getExecutionTicket(ticket.ticket.id);
    const decisionEvent = store
      .listEventsForTask("task-dispatch-gap")
      .find((event) => event.eventType === "dispatch:decision_recorded");
    const decisionPayload = decisionEvent
      ? (JSON.parse(decisionEvent.payloadJson) as { outcome: string; evaluations: Array<{ workerId: string; rejectionReason: string | null }> })
      : null;
    db.close();

    return {
      passed:
        decision.outcome === "no_worker" &&
        pendingTicket?.status === "pending" &&
        decision.trace?.outcome === "no_worker" &&
        decisionPayload?.outcome === "no_worker" &&
        decisionPayload?.evaluations.some(
          (item) => item.workerId === "worker-basic" && item.rejectionReason === "missing_capabilities",
        ) === true,
      summary: "dispatch leaves the ticket pending when no worker satisfies the capability contract",
      details: {
        ticket,
        decision,
        decisionPayload,
        pendingTicket,
      },
    };
  });
}

/**
 * Runs all dispatch rehearsal scenarios and produces an aggregated report.
 * 
 * Executes three scenarios:
 * 1. Capable worker dispatch - verifies correct worker selection
 * 2. Affinity load balancing - verifies hot affinity workers do not monopolize healthy capacity
 * 3. Dispatch after timing - verifies dispatch_after constraint
 * 4. Capability gap - verifies proper handling when no worker matches
 * 
 * @param options - Rehearsal options including output directory
 * @returns Aggregated report with all scenario results
 */
export async function runStableDispatchRehearsal(
  options: StableDispatchRehearsalOptions,
): Promise<StableDispatchRehearsalReport> {
  mkdirSync(options.outputDir, { recursive: true });
  const startedAt = nowIso();
  const scenarios = [
    await runCapableWorkerDispatch(options.outputDir),
    await runAffinityLoadBalancingScenario(options.outputDir),
    await runDispatchAfterScenario(options.outputDir),
    await runCapabilityGapScenario(options.outputDir),
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
 * Writes the dispatch rehearsal report to a JSON file.
 * 
 * @param outputFile - Path where the report JSON should be written
 * @param report - The report data to serialize and write
 */
export function writeStableDispatchRehearsalReport(
  outputFile: string,
  report: StableDispatchRehearsalReport,
): void {
  writeJson(outputFile, report);
}
