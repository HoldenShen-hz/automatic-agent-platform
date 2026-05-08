/**
 * Stable maintenance rehearsal: validates graceful drain and controlled lease handover.
 *
 * @documentation
 * - Runtime execution: docs_zh/contracts/runtime_execution_contract.md
 * - Lease and fencing: docs_zh/contracts/task_lease_and_fencing_contract.md
 * - Release lifecycle: docs_zh/contracts/release_rollout_and_rollback_contract.md
 * - Remote coordination: docs_zh/contracts/remote_coordination_and_disaster_recovery_contract.md
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { buildRuntimeVersionSnapshot, type RuntimeVersionSnapshot } from "../control-plane/incident-control/runtime-version-snapshot.js";
import { ExecutionDispatchService } from "../execution/dispatcher/execution-dispatch-service.js";
import { ExecutionLeaseService } from "../execution/lease/execution-lease-service.js";
import { WorkerRegistryService } from "../execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../state-evidence/truth/sqlite-database.js";
import { nowIso } from "../contracts/types/ids.js";

export interface StableMaintenanceRehearsalOptions {
  outputDir: string;
}

export interface StableMaintenanceScenarioResult {
  scenarioId:
    | "draining_worker_rejects_new_dispatches"
    | "step_boundary_handover_preserves_execution_lineage";
  passed: boolean;
  durationMs: number;
  summary: string;
  details: Record<string, unknown>;
}

export const REQUIRED_STABLE_MAINTENANCE_TARGETS = [
  "maintenance_window",
  "worker_pool",
  "active_leases",
  "dispatch_policy",
] as const;

export type StableMaintenanceTargetId = (typeof REQUIRED_STABLE_MAINTENANCE_TARGETS)[number];

export interface StableMaintenanceTarget {
  targetId: StableMaintenanceTargetId;
  owner: string;
  currentVersion: string | null;
  targetVersion: string | null;
  guardrails: string[];
  healthValidation: string[];
}

export interface StableMaintenancePlaybook {
  generatedAt: string;
  maintenanceOwner: string;
  reportPath: string;
  playbookPath: string;
  runtimeVersionSnapshot: RuntimeVersionSnapshot;
  maintenanceWindow: string;
  drainPolicy: string[];
  replacementReadinessChecks: string[];
  handoverProcedure: string[];
  healthValidation: string[];
  rollbackTriggers: string[];
  auditRequirements: string[];
  scenarioEvidence: Array<{
    scenarioId: StableMaintenanceScenarioResult["scenarioId"];
    passed: boolean;
    summary: string;
  }>;
  targets: StableMaintenanceTarget[];
}

export interface StableMaintenanceRehearsalReport {
  startedAt: string;
  finishedAt: string;
  outputDir: string;
  artifacts: {
    reportPath: string;
    playbookPath: string;
  };
  playbook: StableMaintenancePlaybook;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  scenarios: StableMaintenanceScenarioResult[];
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

async function measureScenario(
  scenarioId: StableMaintenanceScenarioResult["scenarioId"],
  run: () => Promise<Omit<StableMaintenanceScenarioResult, "scenarioId" | "durationMs">>,
): Promise<StableMaintenanceScenarioResult> {
  const started = performance.now();
  const result = await run();
  return {
    scenarioId,
    durationMs: Math.round((performance.now() - started) * 100) / 100,
    ...result,
  };
}

function buildMaintenanceRuntimeVersionSnapshot(outputDir: string): RuntimeVersionSnapshot {
  const dbPath = join(outputDir, "stable-maintenance-playbook.db");
  rmSync(dbPath, { force: true });
  rmSync(`${dbPath}-wal`, { force: true });
  rmSync(`${dbPath}-shm`, { force: true });

  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const snapshot = buildRuntimeVersionSnapshot(db.getSchemaStatus());
  db.close();

  rmSync(dbPath, { force: true });
  rmSync(`${dbPath}-wal`, { force: true });
  rmSync(`${dbPath}-shm`, { force: true });
  return snapshot;
}

function seedTaskAndExecution(
  db: SqliteDatabase,
  store: AuthoritativeTaskStore,
  input: {
    taskId: string;
    executionId: string;
    traceId: string;
    title: string;
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
      title: input.title,
      status: "in_progress",
      source: "system",
      priority: input.priority ?? "high",
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
      agentId: "agent-maintenance-rehearsal",
      roleId: "general_executor",
      runKind: "task_run",
      status: "executing",
      inputRef: null,
      traceId: input.traceId,
      attempt: 1,
      timeoutMs: 60_000,
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

export function buildStableMaintenancePlaybook(input: {
  outputDir: string;
  reportPath: string;
  playbookPath: string;
  scenarios: StableMaintenanceScenarioResult[];
}): StableMaintenancePlaybook {
  const runtimeVersionSnapshot = buildMaintenanceRuntimeVersionSnapshot(input.outputDir);
  const maintenanceOwner = "runtime_reliability_oncall";
  const currentVersion =
    runtimeVersionSnapshot.buildCommit
    ?? runtimeVersionSnapshot.applicationVersion
    ?? runtimeVersionSnapshot.configVersion;
  const targetVersion = currentVersion;

  return {
    generatedAt: new Date().toISOString(),
    maintenanceOwner,
    reportPath: input.reportPath,
    playbookPath: input.playbookPath,
    runtimeVersionSnapshot,
    maintenanceWindow: "15m controlled drain window with step-boundary handover only",
    drainPolicy: [
      "mark the source worker draining before opening the maintenance window",
      "deny all new dispatches to draining workers and route queued work to healthy replacements only",
      "allow active executions to continue until an operator-approved step boundary is reached",
    ],
    replacementReadinessChecks: [
      "confirm at least one healthy replacement worker is registered with matching capability and queue affinity",
      "confirm replacement workers have available capacity before initiating handover",
      "confirm replacement workers are on the expected repo and config version snapshot",
      "confirm no remote session or health finding is blocking the replacement pool",
    ],
    handoverProcedure: [
      "freeze new admissions to the draining worker while keeping the active lease valid",
      "wait for the current execution to reach a safe step boundary recorded in worker progress telemetry",
      "handover the active lease to the replacement worker with a new fencing token",
      "verify the drained worker no longer owns the execution before ending the maintenance window",
    ],
    healthValidation: [
      "confirm draining workers are rejected for new dispatches with an explicit rejection trace",
      "confirm replacement workers claim queued work while the drained worker keeps only its in-flight execution",
      "confirm controlled handover increments fencing tokens and records lineage evidence",
      "confirm stale writes from the drained worker are rejected after handover completes",
    ],
    rollbackTriggers: [
      "no healthy replacement worker is available during the maintenance window",
      "dispatch continues selecting the draining worker for new work",
      "lease handover fails or leaves split ownership on the execution",
    ],
    auditRequirements: [
      "record the maintenance ticket, operator identity, and maintenance window bounds",
      "persist the maintenance rehearsal report and playbook artifacts",
      "retain dispatch traces showing the draining worker rejection path",
      "retain lease handover evidence with previous worker, replacement worker, and fencing lineage",
    ],
    scenarioEvidence: input.scenarios.map((scenario) => ({
      scenarioId: scenario.scenarioId,
      passed: scenario.passed,
      summary: scenario.summary,
    })),
    targets: [
      {
        targetId: "maintenance_window",
        owner: maintenanceOwner,
        currentVersion,
        targetVersion,
        guardrails: [
          "time-box the maintenance window and keep rollback ownership explicit",
          "do not start maintenance until a replacement pool is healthy",
        ],
        healthValidation: [
          "maintenance window metadata is attached to the report and playbook",
          "maintenance owner is declared for operator follow-through",
        ],
      },
      {
        targetId: "worker_pool",
        owner: maintenanceOwner,
        currentVersion,
        targetVersion,
        guardrails: [
          "draining workers stay available only for in-flight completions",
          "replacement workers must remain healthy and capacity-available before handover",
        ],
        healthValidation: [
          "queued work routes only to healthy replacement workers",
          "the drained worker keeps its running execution until controlled transfer",
        ],
      },
      {
        targetId: "active_leases",
        owner: maintenanceOwner,
        currentVersion,
        targetVersion,
        guardrails: [
          "handover only at a declared step boundary",
          "fencing tokens must advance across every maintenance transfer",
        ],
        healthValidation: [
          "lease lineage is preserved during handover",
          "stale writes from the drained worker are rejected",
        ],
      },
      {
        targetId: "dispatch_policy",
        owner: maintenanceOwner,
        currentVersion,
        targetVersion,
        guardrails: [
          "dispatch must fail closed on draining workers for new work",
          "rejection traces must remain available for audit and incident review",
        ],
        healthValidation: [
          "draining workers surface explicit worker_draining rejection reasons",
          "replacement routing is visible in dispatch decision traces",
        ],
      },
    ],
  };
}

async function runDrainRejectsDispatchScenario(outputDir: string): Promise<StableMaintenanceScenarioResult> {
  return measureScenario("draining_worker_rejects_new_dispatches", async () => {
    const dbPath = join(outputDir, "maintenance-drain-dispatch.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const leases = new ExecutionLeaseService(db, store);
    const dispatch = new ExecutionDispatchService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-maintenance-active",
      executionId: "exec-maintenance-active",
      traceId: "trace-maintenance-active",
      title: "Stable maintenance active task",
    });
    seedTaskAndExecution(db, store, {
      taskId: "task-maintenance-queued",
      executionId: "exec-maintenance-queued",
      traceId: "trace-maintenance-queued",
      title: "Stable maintenance queued task",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-maintenance-queued");

    workers.recordHeartbeat({
      workerId: "worker-maintenance-draining",
      status: "draining",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      currentStepId: "step-2",
      progressMessage: "finishing current step before maintenance handover",
      occurredAt: "2026-04-06T10:00:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-maintenance-replacement",
      status: "idle",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: "2026-04-06T10:00:00.000Z",
    });

    const activeLease = leases.acquireLease({
      executionId: "exec-maintenance-active",
      workerId: "worker-maintenance-draining",
      ttlMs: 60_000,
      queueName: "default",
      occurredAt: "2026-04-06T10:00:05.000Z",
    });
    dispatch.createTicket({
      executionId: "exec-maintenance-queued",
      queueName: "default",
      requiredCapabilities: ["bash", "edit"],
      occurredAt: "2026-04-06T10:00:10.000Z",
    });
    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 60_000,
      occurredAt: "2026-04-06T10:00:15.000Z",
    });

    const drainingWorker = workers.getWorker("worker-maintenance-draining");
    const replacementWorker = workers.getWorker("worker-maintenance-replacement");
    const activeLeaseAfterDispatch = store.worker.getActiveExecutionLease("exec-maintenance-active");
    const queuedLease = store.worker.getActiveExecutionLease("exec-maintenance-queued");
    db.close();

    const drainingEvaluation = dispatched.trace?.evaluations.find(
      (evaluation) => evaluation.workerId === "worker-maintenance-draining",
    );
    const passed =
      activeLease.outcome === "granted"
      && dispatched.outcome === "dispatched"
      && dispatched.worker?.workerId === "worker-maintenance-replacement"
      && drainingEvaluation?.rejectionReason === "worker_draining"
      && activeLeaseAfterDispatch?.workerId === "worker-maintenance-draining"
      && activeLeaseAfterDispatch?.status === "active"
      && drainingWorker?.status === "draining"
      && queuedLease?.workerId === "worker-maintenance-replacement";

    return {
      passed,
      summary: "draining workers stop receiving new dispatches while their active execution remains owned until maintenance handover",
      details: {
        activeLease,
        dispatched: {
          outcome: dispatched.outcome,
          reasonCode: dispatched.reasonCode,
          workerId: dispatched.worker?.workerId ?? null,
          leaseId: dispatched.leaseId,
        },
        drainingEvaluation:
          drainingEvaluation == null
            ? null
            : {
              workerId: drainingEvaluation.workerId,
              accepted: drainingEvaluation.accepted,
              rejectionReason: drainingEvaluation.rejectionReason,
            },
        activeLeaseAfterDispatch,
        drainingWorker,
        replacementWorker,
      },
    };
  });
}

async function runStepBoundaryHandoverScenario(outputDir: string): Promise<StableMaintenanceScenarioResult> {
  return measureScenario("step_boundary_handover_preserves_execution_lineage", async () => {
    const dbPath = join(outputDir, "maintenance-handover.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const leases = new ExecutionLeaseService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-maintenance-handover",
      executionId: "exec-maintenance-handover",
      traceId: "trace-maintenance-handover",
      title: "Stable maintenance handover task",
    });

    workers.recordHeartbeat({
      workerId: "worker-maintenance-source",
      status: "draining",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      currentStepId: "step-3",
      progressMessage: "reached safe boundary for maintenance",
      occurredAt: "2026-04-06T11:00:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-maintenance-target",
      status: "idle",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-06T11:00:00.000Z",
    });

    const granted = leases.acquireLease({
      executionId: "exec-maintenance-handover",
      workerId: "worker-maintenance-source",
      ttlMs: 60_000,
      queueName: "default",
      occurredAt: "2026-04-06T11:00:05.000Z",
    });
    const handover = leases.handoverLease({
      leaseId: granted.lease?.id ?? "",
      workerId: "worker-maintenance-source",
      newWorkerId: "worker-maintenance-target",
      ttlMs: 60_000,
      reasonCode: "maintenance_drain_handover",
      occurredAt: "2026-04-06T11:00:20.000Z",
    });

    const staleWrite = leases.validateWriteAccess({
      executionId: "exec-maintenance-handover",
      workerId: "worker-maintenance-source",
      fencingToken: granted.lease?.fencingToken ?? 0,
      leaseId: granted.lease?.id ?? null,
      occurredAt: "2026-04-06T11:00:25.000Z",
    });
    const validWrite = leases.validateWriteAccess({
      executionId: "exec-maintenance-handover",
      workerId: "worker-maintenance-target",
      fencingToken: handover.lease?.fencingToken ?? 0,
      leaseId: handover.lease?.id ?? null,
      occurredAt: "2026-04-06T11:00:25.000Z",
    });

    const execution = store.dispatch.getExecution("exec-maintenance-handover");
    const previousWorker = workers.getWorker("worker-maintenance-source");
    const nextWorker = workers.getWorker("worker-maintenance-target");
    const audits = store.lease.listLeaseAudits("exec-maintenance-handover");
    const events = store.event.listEventsForTask("task-maintenance-handover");
    db.close();

    const passed =
      granted.outcome === "granted"
      && handover.outcome === "handed_over"
      && handover.previousLease?.reasonCode === "maintenance_drain_handover"
      && handover.lease?.workerId === "worker-maintenance-target"
      && (handover.lease?.fencingToken ?? 0) > (granted.lease?.fencingToken ?? 0)
      && staleWrite.allowed === false
      && staleWrite.reasonCode === "stale_fencing_token"
      && validWrite.allowed === true
      && execution?.agentId === "worker-maintenance-target"
      && previousWorker?.status === "draining"
      && previousWorker?.runningExecutionIds.length === 0
      && (nextWorker?.runningExecutionIds.includes("exec-maintenance-handover") ?? false)
      && audits.some(
        (audit) => audit.eventType === "lease_handover" && audit.reasonCode === "maintenance_drain_handover",
      )
      && events.some((event) => event.eventType === "lease:handover_recorded");

    return {
      passed,
      summary: "maintenance handover transfers the active execution at a safe boundary without losing fencing or lineage",
      details: {
        granted,
        handover,
        staleWrite,
        validWrite,
        executionAgentId: execution?.agentId ?? null,
        previousWorker,
        nextWorker,
        auditEvents: audits.map((audit) => ({
          eventType: audit.eventType,
          workerId: audit.workerId,
          reasonCode: audit.reasonCode,
          fencingToken: audit.fencingToken,
        })),
        eventTypes: events.map((event) => event.eventType),
      },
    };
  });
}

export async function runStableMaintenanceRehearsal(
  options: StableMaintenanceRehearsalOptions,
): Promise<StableMaintenanceRehearsalReport> {
  mkdirSync(options.outputDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const reportPath = join(options.outputDir, "stable-maintenance-report.json");
  const playbookPath = join(options.outputDir, "stable-maintenance-playbook.json");
  const scenarios = await Promise.all([
    runDrainRejectsDispatchScenario(options.outputDir),
    runStepBoundaryHandoverScenario(options.outputDir),
  ]);
  const playbook = buildStableMaintenancePlaybook({
    outputDir: options.outputDir,
    reportPath,
    playbookPath,
    scenarios,
  });
  writeJson(playbookPath, playbook);

  const report: StableMaintenanceRehearsalReport = {
    startedAt,
    finishedAt: new Date().toISOString(),
    outputDir: options.outputDir,
    artifacts: {
      reportPath,
      playbookPath,
    },
    playbook,
    totalScenarios: scenarios.length,
    passedScenarios: scenarios.filter((scenario) => scenario.passed).length,
    failedScenarios: scenarios.filter((scenario) => !scenario.passed).length,
    scenarios,
  };
  writeJson(reportPath, report);
  return report;
}

export function writeStableMaintenanceRehearsalReport(
  outputFile: string,
  report: StableMaintenanceRehearsalReport,
): void {
  writeJson(outputFile, report);
}
