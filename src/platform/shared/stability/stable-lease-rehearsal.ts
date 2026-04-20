/**
 * Stable lease rehearsal suite.
 *
 * This module provides scenarios that exercise the {@link ExecutionLeaseService} and
 * {@link WorkerRegistryService} to validate lease lifecycle, fencing token integrity, and
 * worker registry capacity semantics under the task-lease / fencing contract.
 *
 * **Scenarios covered:**
 * - `lease_reclaim_increments_fencing`: After a lease expires and is reclaimed, a subsequent
 *   lease grant for the same execution increments the `fencing_token`. Any writeback using the
 *   old token must be rejected.
 * - `stale_write_rejected_after_failover`: A worker acquires a lease (token=1), the lease expires,
 *   and a different worker acquires a new lease (token=2). The first worker's attempt to write
 *   with token=1 is rejected as `stale_fencing_token`.
 * - `lease_handover_preserves_lineage`: A draining worker hands an active lease to a replacement
 *   worker, producing an explicit handover lineage event while incrementing the fencing token.
 * - `worker_registry_capacity_visible`: The worker registry surfaces only workers whose
 *   capabilities and queue affinity match the dispatch criteria, and correctly identifies workers
 *   that have gone stale (missed heartbeats beyond the threshold).
 *
 * **Design contract:**
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/task_lease_and_fencing_contract.md | task_lease_and_fencing_contract.md}
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/runtime_execution_contract.md | runtime_execution_contract.md}
 * - {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/startup_consistency_and_recovery_drill_contract.md | startup_consistency_and_recovery_drill_contract.md}
 *
 * **Glossary terms:** `lease`, `fencing token`, `lease reclaim`, `lease reacquisition`,
 * `stale worker`, `worker registry`, `queue affinity`, `dispatch`, `heartbeat`
 *
 * **Architecture:** {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/automatic_agent_patform_arthitecture_design.md | 01_architecture_and_technical_design.md}
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { ExecutionLeaseService } from "../../execution/lease/execution-lease-service.js";
import { WorkerRegistryService } from "../../execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../state-evidence/truth/sqlite-database.js";
import { nowIso } from "../../contracts/types/ids.js";

export interface StableLeaseRehearsalOptions {
  outputDir: string;
}

export interface StableLeaseScenarioResult {
  scenarioId:
    | "lease_reclaim_increments_fencing"
    | "stale_write_rejected_after_failover"
    | "lease_handover_preserves_lineage"
    | "worker_registry_capacity_visible";
  passed: boolean;
  durationMs: number;
  summary: string;
  details: Record<string, unknown>;
}

export interface StableLeaseRehearsalReport {
  startedAt: string;
  finishedAt: string;
  outputDir: string;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  scenarios: StableLeaseScenarioResult[];
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

async function measureScenario(
  scenarioId: StableLeaseScenarioResult["scenarioId"],
  run: () => Promise<Omit<StableLeaseScenarioResult, "scenarioId" | "durationMs">>,
): Promise<StableLeaseScenarioResult> {
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
      title: "Stable lease rehearsal task",
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
    store.execution.insertExecution({
      id: input.executionId,
      taskId: input.taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-lease-rehearsal",
      roleId: "general_executor",
      runKind: "task_run",
      status: "executing",
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

async function runLeaseReclaimScenario(outputDir: string): Promise<StableLeaseScenarioResult> {
  return measureScenario("lease_reclaim_increments_fencing", async () => {
    const dbPath = join(outputDir, "lease-reclaim.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const leases = new ExecutionLeaseService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-lease-reclaim",
      executionId: "exec-lease-reclaim",
      traceId: "trace-lease-reclaim",
    });

    const first = leases.acquireLease({
      executionId: "exec-lease-reclaim",
      workerId: "worker-a",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T10:00:00.000Z",
    });
    const blocked = leases.acquireLease({
      executionId: "exec-lease-reclaim",
      workerId: "worker-b",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T10:00:10.000Z",
    });
    const reclaimed = leases.reclaimExpiredLeases("2026-04-03T10:01:00.000Z");
    const second = leases.acquireLease({
      executionId: "exec-lease-reclaim",
      workerId: "worker-b",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T10:01:00.000Z",
    });
    const leaseChain = store.worker.listExecutionLeases("exec-lease-reclaim");
    const audits = store.lease.listLeaseAudits("exec-lease-reclaim");
    db.close();

    return {
      passed:
        first.outcome === "granted" &&
        first.lease?.fencingToken === 1 &&
        blocked.outcome === "blocked" &&
        reclaimed.length === 1 &&
        second.outcome === "granted" &&
        second.lease?.fencingToken === 2 &&
        leaseChain.length === 2 &&
        audits.some((audit) => audit.eventType === "lease_reclaimed"),
      summary: "expired leases are reclaimed and the next grant increments fencing tokens",
      details: {
        first,
        blocked,
        reclaimed,
        second,
        leaseChain,
        auditEvents: audits.map((audit) => audit.eventType),
      },
    };
  });
}

async function runStaleWriteScenario(outputDir: string): Promise<StableLeaseScenarioResult> {
  return measureScenario("stale_write_rejected_after_failover", async () => {
    const dbPath = join(outputDir, "stale-write.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const leases = new ExecutionLeaseService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-stale-write",
      executionId: "exec-stale-write",
      traceId: "trace-stale-write",
    });

    const first = leases.acquireLease({
      executionId: "exec-stale-write",
      workerId: "worker-a",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T10:00:00.000Z",
    });
    leases.reclaimExpiredLeases("2026-04-03T10:01:00.000Z");
    const second = leases.acquireLease({
      executionId: "exec-stale-write",
      workerId: "worker-b",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T10:01:00.000Z",
    });
    const staleWrite = leases.validateWriteAccess({
      executionId: "exec-stale-write",
      workerId: "worker-a",
      fencingToken: first.lease?.fencingToken ?? 0,
      leaseId: first.lease?.id ?? null,
      occurredAt: "2026-04-03T10:01:05.000Z",
    });
    const validWrite = leases.validateWriteAccess({
      executionId: "exec-stale-write",
      workerId: "worker-b",
      fencingToken: second.lease?.fencingToken ?? 0,
      leaseId: second.lease?.id ?? null,
      occurredAt: "2026-04-03T10:01:05.000Z",
    });
    const audits = store.lease.listLeaseAudits("exec-stale-write");
    db.close();

    return {
      passed:
        first.outcome === "granted" &&
        second.outcome === "granted" &&
        staleWrite.allowed === false &&
        staleWrite.reasonCode === "stale_fencing_token" &&
        validWrite.allowed === true &&
        audits.some((audit) => audit.eventType === "stale_write_rejected"),
      summary: "stale workers are fenced off from execution writes after failover",
      details: {
        first,
        second,
        staleWrite,
        validWrite,
        auditEvents: audits.map((audit) => ({
          eventType: audit.eventType,
          reasonCode: audit.reasonCode,
        })),
      },
    };
  });
}

async function runLeaseHandoverScenario(outputDir: string): Promise<StableLeaseScenarioResult> {
  return measureScenario("lease_handover_preserves_lineage", async () => {
    const dbPath = join(outputDir, "lease-handover.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const leases = new ExecutionLeaseService(db, store);
    const registry = new WorkerRegistryService(store);
    seedTaskAndExecution(db, store, {
      taskId: "task-lease-handover",
      executionId: "exec-lease-handover",
      traceId: "trace-lease-handover",
    });

    registry.recordHeartbeat({
      workerId: "worker-a",
      status: "draining",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-lease-handover"],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-03T10:00:00.000Z",
    });
    registry.recordHeartbeat({
      workerId: "worker-b",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-03T10:00:00.000Z",
    });

    const first = leases.acquireLease({
      executionId: "exec-lease-handover",
      workerId: "worker-a",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T10:00:00.000Z",
    });
    const handover = leases.handoverLease({
      leaseId: first.lease?.id ?? "",
      workerId: "worker-a",
      newWorkerId: "worker-b",
      ttlMs: 30_000,
      reasonCode: "worker_draining_handover",
      occurredAt: "2026-04-03T10:00:10.000Z",
    });
    const audits = store.lease.listLeaseAudits("exec-lease-handover");
    const events = store.event.listEventsForTask("task-lease-handover");
    db.close();

    return {
      passed:
        first.outcome === "granted" &&
        handover.outcome === "handed_over" &&
        handover.previousLease?.status === "released" &&
        handover.lease?.fencingToken === 2 &&
        audits.some((audit) => audit.eventType === "lease_handover") &&
        events.some((event) => event.eventType === "lease:handover_recorded"),
      summary: "controlled handover transfers execution rights with explicit lease lineage",
      details: {
        first,
        handover,
        auditEvents: audits.map((audit) => ({
          eventType: audit.eventType,
          workerId: audit.workerId,
          reasonCode: audit.reasonCode,
        })),
        eventTypes: events.map((event) => event.eventType),
      },
    };
  });
}

async function runWorkerRegistryScenario(outputDir: string): Promise<StableLeaseScenarioResult> {
  return measureScenario("worker_registry_capacity_visible", async () => {
    const dbPath = join(outputDir, "worker-registry.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const registry = new WorkerRegistryService(store);

    registry.recordHeartbeat({
      workerId: "worker-a",
      status: "idle",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: "2026-04-03T10:00:00.000Z",
    });
    registry.recordHeartbeat({
      workerId: "worker-b",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-b-1"],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-03T10:00:00.000Z",
    });
    registry.recordHeartbeat({
      workerId: "worker-c",
      status: "idle",
      capabilities: ["read"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "research",
      occurredAt: "2026-04-03T10:09:30.000Z",
    });

    const eligible = registry.listEligibleWorkers({
      requiredCapabilities: ["bash"],
      queueAffinity: "default",
    });
    const staleWorkers = registry.listStaleWorkers("2026-04-03T10:10:00.000Z", 2 * 60 * 1000);
    db.close();

    return {
      passed:
        eligible.length === 1 &&
        eligible[0]?.workerId === "worker-a" &&
        staleWorkers.some((worker) => worker.workerId === "worker-a") &&
        staleWorkers.some((worker) => worker.workerId === "worker-b") &&
        staleWorkers.every((worker) => worker.workerId !== "worker-c"),
      summary: "worker registry surfaces capacity-constrained and stale workers deterministically",
      details: {
        eligible,
        staleWorkers,
      },
    };
  });
}

export async function runStableLeaseRehearsal(
  options: StableLeaseRehearsalOptions,
): Promise<StableLeaseRehearsalReport> {
  mkdirSync(options.outputDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const scenarios = [
    await runLeaseReclaimScenario(options.outputDir),
    await runStaleWriteScenario(options.outputDir),
    await runLeaseHandoverScenario(options.outputDir),
    await runWorkerRegistryScenario(options.outputDir),
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

export function writeStableLeaseRehearsalReport(
  outputFile: string,
  report: StableLeaseRehearsalReport,
): void {
  writeJson(outputFile, report);
}
