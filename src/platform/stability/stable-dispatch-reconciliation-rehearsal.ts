/**
 * Stable dispatch-reconciliation rehearsal suite.
 *
 * This module provides targeted scenarios that exercise the
 * {@link ExecutionDispatchReconciliationService} ability to detect and repair dispatch-level
 * anomalies. Dispatch reconciliation runs as a periodic scan that identifies tickets which are
 * in an inconsistent state relative to their authoritative execution lease.
 *
 * **Scenarios covered:**
 * - `orphan_claim_requeued`: A dispatch ticket was claimed by a worker, but the lease was released
 *   without a writeback. The reconciliation scan detects the `orphan_queue_claim` issue and
 *   creates a replacement ticket in `pending` state while marking the original as `expired`.
 * - `terminal_execution_ticket_cancelled`: An execution reached a terminal state (`succeeded`,
 *   `failed`, etc.) but an active dispatch ticket still points to it. Reconciliation cancels
 *   the stale ticket.
 *
 * These scenarios validate the reconciliation loop described in the execution plane contract and
 * the task-lease / fencing contract.
 *
 * **Design contract:**
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/execution_plane_contract.md | execution_plane_contract.md}
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/runtime_execution_contract.md | runtime_execution_contract.md}
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/task_lease_and_fencing_contract.md | task_lease_and_fencing_contract.md}
 *
 * **Glossary terms:** `execution ticket`, `lease`, `fencing token`, `orphan queue claim`,
 * `dispatch`, `terminal execution`, `reconciliation scan`, `reconciliation repair`
 *
 * **Architecture:** {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/architecture/00-platform-architecture.md | 01_architecture_and_technical_design.md}
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { ExecutionDispatchService } from "../execution/dispatcher/execution-dispatch-service.js";
import { ExecutionDispatchReconciliationService } from "../execution/dispatcher/execution-dispatch-reconciliation-service.js";
import { ExecutionLeaseService } from "../execution/lease/execution-lease-service.js";
import { WorkerRegistryService } from "../execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../state-evidence/truth/sqlite-database.js";
import { nowIso } from "../contracts/types/ids.js";

export interface StableDispatchReconciliationRehearsalOptions {
  outputDir: string;
}

export interface StableDispatchReconciliationScenarioResult {
  scenarioId: "orphan_claim_requeued" | "terminal_execution_ticket_cancelled";
  passed: boolean;
  durationMs: number;
  summary: string;
  details: Record<string, unknown>;
}

export interface StableDispatchReconciliationRehearsalReport {
  startedAt: string;
  finishedAt: string;
  outputDir: string;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  scenarios: StableDispatchReconciliationScenarioResult[];
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

async function measureScenario(
  scenarioId: StableDispatchReconciliationScenarioResult["scenarioId"],
  run: () => Promise<Omit<StableDispatchReconciliationScenarioResult, "scenarioId" | "durationMs">>,
): Promise<StableDispatchReconciliationScenarioResult> {
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
      title: "Stable dispatch reconciliation rehearsal task",
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
      agentId: "agent-dispatch-reconcile",
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

async function runOrphanClaimScenario(outputDir: string): Promise<StableDispatchReconciliationScenarioResult> {
  return measureScenario("orphan_claim_requeued", async () => {
    const dbPath = join(outputDir, "dispatch-reconcile-orphan.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const leases = new ExecutionLeaseService(db, store);
    const reconcile = new ExecutionDispatchReconciliationService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-reconcile-orphan",
      executionId: "exec-dispatch-reconcile-orphan",
      traceId: "trace-dispatch-reconcile-orphan",
    });
    workers.recordHeartbeat({
      workerId: "worker-dispatch-reconcile",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T14:00:00.000Z",
    });
    const created = dispatch.createTicket({
      executionId: "exec-dispatch-reconcile-orphan",
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
      workerId: "worker-dispatch-reconcile",
      reasonCode: "reconcile.seed",
      occurredAt: "2026-04-04T14:00:07.000Z",
    });

    const before = reconcile.scan("2026-04-04T14:00:08.000Z");
    const repaired = reconcile.repair("2026-04-04T14:00:08.000Z");
    const tickets = store.worker.listExecutionTicketsByExecution("exec-dispatch-reconcile-orphan");
    db.close();

    return {
      passed:
        before.some((issue) => issue.issueType === "orphan_queue_claim") &&
        repaired.applied.some((item) => item.applied && item.replacementTicketId != null) &&
        tickets.length === 2 &&
        tickets[0]?.status === "expired" &&
        tickets[1]?.status === "pending" &&
        tickets[1]?.id !== created.ticket.id,
      summary: "dispatch reconciliation requeues claimed tickets that lost their authoritative lease",
      details: {
        before,
        repaired,
        tickets,
      },
    };
  });
}

async function runTerminalTicketScenario(outputDir: string): Promise<StableDispatchReconciliationScenarioResult> {
  return measureScenario("terminal_execution_ticket_cancelled", async () => {
    const dbPath = join(outputDir, "dispatch-reconcile-terminal.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const dispatch = new ExecutionDispatchService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-reconcile-terminal",
      executionId: "exec-dispatch-reconcile-terminal",
      traceId: "trace-dispatch-reconcile-terminal",
    });
    const created = dispatch.createTicket({
      executionId: "exec-dispatch-reconcile-terminal",
      queueName: "default",
      occurredAt: "2026-04-04T14:10:05.000Z",
    });
    store.execution.updateExecutionStatus(
      "exec-dispatch-reconcile-terminal",
      "succeeded",
      "2026-04-04T14:10:06.000Z",
      null,
      "2026-04-04T14:10:06.000Z",
      null,
    );

    const reconcile = new ExecutionDispatchReconciliationService(db, store);
    const before = reconcile.scan("2026-04-04T14:10:07.000Z");
    const repaired = reconcile.repair("2026-04-04T14:10:07.000Z");
    const ticket = store.worker.getExecutionTicket(created.ticket.id);
    db.close();

    return {
      passed:
        before.some((issue) => issue.issueType === "terminal_execution_ticket") &&
        repaired.applied.some((item) => item.applied && item.resolutionAction === "invalidate_ticket") &&
        ticket?.status === "cancelled",
      summary: "dispatch reconciliation cancels active tickets that still point at terminal executions",
      details: {
        before,
        repaired,
        ticket,
      },
    };
  });
}

export async function runStableDispatchReconciliationRehearsal(
  options: StableDispatchReconciliationRehearsalOptions,
): Promise<StableDispatchReconciliationRehearsalReport> {
  mkdirSync(options.outputDir, { recursive: true });
  const startedAt = nowIso();
  const scenarios = await Promise.all([
    runOrphanClaimScenario(options.outputDir),
    runTerminalTicketScenario(options.outputDir),
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

export function writeStableDispatchReconciliationRehearsalReport(
  path: string,
  report: StableDispatchReconciliationRehearsalReport,
): void {
  writeJson(path, report);
}
