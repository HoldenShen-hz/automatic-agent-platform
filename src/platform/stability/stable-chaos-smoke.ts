/**
 * Stable chaos smoke test suite for runtime integrity and recovery scenarios.
 *
 * This module provides end-to-end "smoke tests" that verify the system's ability to detect
 * and repair inconsistent runtime state under adversarial conditions. Each scenario seeds a
 * specific broken state (stale execution, orphan session, orphan queue claim, duplicate approval,
 * missing ack) and validates that the startup consistency checker and runtime repair service
 * restore the system to a clean state.
 *
 * **Chaos scenarios covered:**
 * - `stale_execution_repair`: Detects executions stuck in `executing` beyond the stale threshold
 *   and requeues them into a safe `pending` state.
 * - `orphan_session_cleanup`: Detects sessions that outlive their parent task and closes them.
 * - `orphan_queue_claim_reconciled_via_runtime_repair`: Detects dispatch tickets whose authoritative
 *   lease was released without a corresponding writeback and replaces them with new pending tickets.
 * - `duplicate_approval_response_idempotent`: Verifies that applying the same approval decision twice
 *   does not double-advance the approval state machine.
 * - `missing_ack_rebuild_and_replay`: Detects event-consumer ack gaps and rebuilds the missing rows.
 *
 * **Design contract:**
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md | quality_engineering_and_chaos_testing_contract.md}
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/startup_consistency_and_recovery_drill_contract.md | startup_consistency_and_recovery_drill_contract.md}
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/runtime_execution_contract.md | runtime_execution_contract.md}
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/task_lease_and_fencing_contract.md | task_lease_and_fencing_contract.md}
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/approval_and_hitl_contract.md | approval_and_hitl_contract.md}
 *
 * **Glossary terms:** `task`, `execution`, `session`, `lease`, `fencing token`, `execution ticket`,
 * `orphan queue claim`, `stale execution`, `startup consistency checker`, `runtime repair service`
 *
 * **Architecture:** {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/architecture/00-platform-architecture.md | 01_architecture_and_technical_design.md}
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { ApprovalService } from "../control-plane/approval-center/approval-service.js";
import { ExecutionDispatchService } from "../execution/dispatcher/execution-dispatch-service.js";
import { ExecutionLeaseService } from "../execution/lease/execution-lease-service.js";
import { RuntimeRepairService } from "../execution/recovery/runtime-repair-service-root.js";
import { StartupConsistencyChecker } from "../execution/startup/startup-consistency-checker.js";
import { WorkerRegistryService } from "../execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../state-evidence/truth/sqlite-database.js";
import { nowIso } from "../contracts/types/ids.js";

export interface StableChaosSmokeOptions {
  outputDir: string;
}

export interface StableChaosScenarioResult {
  scenarioId: string;
  passed: boolean;
  durationMs: number;
  summary: string;
  details: Record<string, unknown>;
}

export interface StableChaosSmokeReport {
  startedAt: string;
  finishedAt: string;
  outputDir: string;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  scenarios: StableChaosScenarioResult[];
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

async function measureScenario(
  scenarioId: string,
  run: () => Promise<Omit<StableChaosScenarioResult, "scenarioId" | "durationMs">> | Omit<StableChaosScenarioResult, "scenarioId" | "durationMs">,
): Promise<StableChaosScenarioResult> {
  const started = performance.now();
  const result = await run();
  return {
    scenarioId,
    durationMs: Math.round((performance.now() - started) * 100) / 100,
    ...result,
  };
}

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
      title: "Chaos smoke seed task",
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
    store.execution.insertExecution({
      id: input.executionId,
      taskId: input.taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "task_run",
      status: "executing",
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
    store.session.insertSession({
      id: `sess-${input.taskId}`,
      taskId: input.taskId,
      channel: "cli",
      status: "open",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function runStaleExecutionRepairScenario(outputDir: string): Promise<StableChaosScenarioResult> {
  return measureScenario("stale_execution_repair", async () => {
    const dbPath = join(outputDir, "stale-execution-repair.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-stale-chaos",
      executionId: "exec-stale-chaos",
      traceId: "trace-stale-chaos",
    });
    db.connection
      .prepare(`UPDATE executions SET updated_at = ? WHERE id = ?`)
      .run("2026-04-03T10:00:00.000Z", "exec-stale-chaos");
    db.connection
      .prepare(`UPDATE workflow_state SET updated_at = ? WHERE task_id = ?`)
      .run("2026-04-03T10:00:00.000Z", "task-stale-chaos");

    const checker = new StartupConsistencyChecker(db, store);
    const repair = new RuntimeRepairService(db, store);
    const before = checker.run({
      now: "2026-04-03T10:10:00.000Z",
      staleExecutionAfterMs: 5 * 60 * 1000,
    });

    const snapshotBefore = store.operations.loadTaskSnapshot("task-stale-chaos");
    const applied = await repair.apply(before);
    const after = checker.run({
      now: "2026-04-03T10:10:00.000Z",
      staleExecutionAfterMs: 5 * 60 * 1000,
    });
    const snapshotAfter = store.operations.loadTaskSnapshot("task-stale-chaos");
    db.close();

    return {
      passed:
        before.findings.some((finding) => finding.code === "stale_execution") &&
        applied.some((item) => item.action === "requeue_execution" && item.applied) &&
        after.status === "pass" &&
        snapshotBefore.execution?.status === "executing" &&
        snapshotAfter.execution?.status === "created" &&
        snapshotAfter.task.status === "pending",
      summary: "stale execution is detected and requeued into a safe pending state",
      details: {
        beforeStatus: before.status,
        afterStatus: after.status,
        applied,
        executionStatusAfter: snapshotAfter.execution?.status ?? null,
        taskStatusAfter: snapshotAfter.task.status,
      },
    };
  });
}

async function runOrphanSessionRepairScenario(outputDir: string): Promise<StableChaosScenarioResult> {
  return measureScenario("orphan_session_cleanup", async () => {
    const dbPath = join(outputDir, "orphan-session.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const now = nowIso();

    store.task.insertTask({
      id: "task-orphan-chaos",
      parentId: null,
      rootId: "task-orphan-chaos",
      divisionId: "general_ops",
      title: "Orphan session chaos",
      status: "done",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: "{}",
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: now,
    });
    store.session.insertSession({
      id: "sess-orphan-chaos",
      taskId: "task-orphan-chaos",
      channel: "cli",
      status: "open",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });

    const checker = new StartupConsistencyChecker(db, store);
    const repair = new RuntimeRepairService(db, store);
    const before = checker.run({ now });

    const applied = await repair.apply(before);
    const after = checker.run({ now });
    const session = store.dispatch.getSession("sess-orphan-chaos");
    db.close();

    return {
      passed:
        before.findings.some((finding) => finding.code === "orphan_session") &&
        applied.some((item) => item.action === "close_orphan_session" && item.applied) &&
        after.status === "pass" &&
        session?.status === "completed",
      summary: "orphan session is closed during repair and leaves no startup findings",
      details: {
        beforeStatus: before.status,
        afterStatus: after.status,
        applied,
        sessionStatusAfter: session?.status ?? null,
      },
    };
  });
}

async function runOrphanQueueClaimRepairScenario(outputDir: string): Promise<StableChaosScenarioResult> {
  return measureScenario("orphan_queue_claim_reconciled_via_runtime_repair", async () => {
    const dbPath = join(outputDir, "orphan-queue-claim.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const leases = new ExecutionLeaseService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-chaos",
      executionId: "exec-dispatch-chaos",
      traceId: "trace-dispatch-chaos",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-chaos");
    workers.recordHeartbeat({
      workerId: "worker-dispatch-chaos",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T15:00:00.000Z",
    });

    const created = dispatch.createTicket({
      executionId: "exec-dispatch-chaos",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T15:00:05.000Z",
    });
    const claimed = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T15:00:06.000Z",
    });
    leases.releaseLease({
      leaseId: claimed.leaseId ?? "",
      workerId: "worker-dispatch-chaos",
      reasonCode: "chaos.seed",
      occurredAt: "2026-04-04T15:00:07.000Z",
    });

    const checker = new StartupConsistencyChecker(db, store);
    const repair = new RuntimeRepairService(db, store);
    const before = checker.run({ now: "2026-04-04T15:00:08.000Z" });
    const applied = await repair.apply(before);
    const after = checker.run({ now: "2026-04-04T15:00:08.000Z" });
    const tickets = store.worker.listExecutionTicketsByExecution("exec-dispatch-chaos");
    const originalTicket = tickets.find((ticket) => ticket.id === created.ticket.id) ?? null;
    const replacementTicket = tickets.find((ticket) => ticket.id !== created.ticket.id && ticket.status === "pending") ?? null;
    db.close();

    return {
      passed:
        before.findings.some((finding) => finding.code === "orphan_queue_claim") &&
        applied.some((item) => item.action === "reconcile_dispatch_ticket" && item.applied) &&
        after.status === "pass" &&
        tickets.length === 2 &&
        originalTicket?.status === "expired" &&
        replacementTicket?.status === "pending",
      summary: "orphan claimed dispatch tickets are surfaced by startup checks and requeued by runtime repair",
      details: {
        beforeStatus: before.status,
        afterStatus: after.status,
        applied,
        ticketStatuses: tickets.map((ticket) => ({
          ticketId: ticket.id,
          status: ticket.status,
          leaseId: ticket.leaseId,
        })),
      },
    };
  });
}

async function runDuplicateApprovalIdempotencyScenario(outputDir: string): Promise<StableChaosScenarioResult> {
  return measureScenario("duplicate_approval_response_idempotent", () => {
    const dbPath = join(outputDir, "duplicate-approval.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvals = new ApprovalService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-approval-chaos",
      executionId: "exec-approval-chaos",
      traceId: "trace-approval-chaos",
    });

    const request = approvals.createRequest({
      taskId: "task-approval-chaos",
      executionId: "exec-approval-chaos",
      sourceAgentId: "agent-approval-chaos",
      reason: "Need idempotent approval handling",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: { source: "chaos-smoke" },
      timeoutPolicy: "reject",
    });

    const decision = {
      approvalId: request.approvalId,
      decisionType: "option_selected" as const,
      selectedOptionId: "approve",
      respondedBy: "operator-chaos",
      respondedAt: nowIso(),
    };
    approvals.applyDecision(decision);
    approvals.applyDecision(decision);

    const approval = store.approval.getApproval(request.approvalId);
    const eventsResult = store.event.listEventsForTask("task-approval-chaos");
    db.close();

    const respondedEvents = eventsResult.events.filter((event) => event.eventType === "decision:responded");
    return {
      passed: approval?.status === "approved" && respondedEvents.length === 1,
      summary: "duplicate approval responses do not double-advance the decision state",
      details: {
        approvalStatus: approval?.status ?? null,
        eventTypes: eventsResult.events.map((event) => event.eventType),
        respondedEventCount: respondedEvents.length,
      },
    };
  });
}

async function runMissingAckReplayScenario(outputDir: string): Promise<StableChaosScenarioResult> {
  return measureScenario("missing_ack_rebuild_and_replay", async () => {
    const dbPath = join(outputDir, "missing-ack.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-ack-chaos",
      executionId: "exec-ack-chaos",
      traceId: "trace-ack-chaos",
    });

    const event = store.event.createTier1StatusEvent({
      taskId: "task-ack-chaos",
      executionId: "exec-ack-chaos",
      eventType: "task:status_changed",
      traceId: "trace-ack-chaos",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });
    db.connection
      .prepare(`DELETE FROM event_consumer_acks WHERE event_id = ? AND consumer_id = ?`)
      .run(event.id, "inspect_projection");

    const checker = new StartupConsistencyChecker(db, store);
    const repair = new RuntimeRepairService(db, store);
    const before = checker.run({ now: nowIso() });

    const applied = await repair.apply(before);
    const after = checker.run({ now: nowIso() });
    const coverage = store.event.listTier1EventRegistryCoverage().find((item) => item.eventId === event.id);
    const pendingAckBacklog = store.event.countPendingTier1Acks();
    db.close();

    return {
      passed:
        before.findings.some((finding) => finding.code === "event_consumer_mismatch") &&
        applied.some((item) => item.action === "rebuild_ack") &&
        after.status === "pass" &&
        coverage?.ackConsumers.includes("inspect_projection") === true &&
        pendingAckBacklog === 0,
      summary: "missing critical consumer ack rows are rebuilt and drained successfully",
      details: {
        beforeStatus: before.status,
        afterStatus: after.status,
        applied,
        ackConsumers: coverage?.ackConsumers ?? [],
        pendingAckBacklog,
      },
    };
  });
}

export async function runStableChaosSmoke(options: StableChaosSmokeOptions): Promise<StableChaosSmokeReport> {
  mkdirSync(options.outputDir, { recursive: true });
  const startedAt = new Date().toISOString();

  const scenarios = [
    await runStaleExecutionRepairScenario(options.outputDir),
    await runOrphanSessionRepairScenario(options.outputDir),
    await runOrphanQueueClaimRepairScenario(options.outputDir),
    await runDuplicateApprovalIdempotencyScenario(options.outputDir),
    await runMissingAckReplayScenario(options.outputDir),
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

export function writeStableChaosSmokeReport(outputFile: string, report: StableChaosSmokeReport): void {
  writeJson(outputFile, report);
}
