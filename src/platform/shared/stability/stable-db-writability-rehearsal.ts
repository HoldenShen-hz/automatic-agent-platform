/**
 * Stable DB Writability Rehearsal
 *
 * Tests the system's behavior when the authoritative database transitions to
 * read-only mode or becomes unwritable. Validates fail-close behavior across
 * multiple system components:
 *
 * 1. Health and Doctor fail-close when DB is not writable
 *    - Health service reports dbWritable=false with read_only_operations_only mode
 *    - Doctor service enters fail_closed status
 *    - DB check specifically reports db_write_probe_failed
 *
 * 2. Multi-step admission rejects new work in read-only mode
 *    - New task requests are cancelled before execution
 *    - Workflow and session are also cancelled
 *    - Admission rejection event is emitted
 *    - No execution is created
 *
 * 3. Dispatch blocks claims without dropping pending tickets in read-only mode
 *    - Dispatch decisions return "blocked" with backpressure.read_only_mode
 *    - The pending ticket is preserved (not dropped or completed)
 *    - Decision event records the blocked outcome
 *
 * These scenarios verify QA-73 contract requirements for database writability
 * failure handling and system-wide fail-close behavior.
 *
 * @see docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md for QA-73
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { HealthService } from "../observability/health-service.js";
import { DoctorService } from "../../control-plane/incident-control/doctor-service.js";
import { StartupConsistencyChecker } from "../../execution/startup/startup-consistency-checker.js";
import { runMultiStepOrchestration } from "../../execution/execution-engine/multi-step-orchestration.js";
import { ExecutionDispatchService } from "../../execution/dispatcher/execution-dispatch-service.js";
import { WorkerRegistryService } from "../../execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../state-evidence/truth/sqlite-database.js";
import { SqliteReliabilityService } from "../../state-evidence/truth/sqlite/sqlite-reliability-service.js";
import { nowIso } from "../../contracts/types/ids.js";
import type { AdmissionBackpressureSnapshot } from "../../execution/dispatcher/admission-controller.js";

/** Options for running the DB writability rehearsal */
export interface StableDbWritabilityRehearsalOptions {
  outputDir: string;
}

/** Result of a single writability scenario */
export interface StableDbWritabilityScenarioResult {
  scenarioId:
    | "health_and_doctor_fail_close_when_db_is_not_writable"
    | "multi_step_admission_rejects_new_work_in_read_only_mode"
    | "dispatch_blocks_claims_without_dropping_pending_ticket_in_read_only_mode";
  passed: boolean;
  durationMs: number;
  summary: string;
  details: Record<string, unknown>;
}

/** Complete report from the DB writability rehearsal */
export interface StableDbWritabilityRehearsalReport {
  startedAt: string;
  finishedAt: string;
  outputDir: string;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  scenarios: StableDbWritabilityScenarioResult[];
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
  scenarioId: StableDbWritabilityScenarioResult["scenarioId"],
  run: () => Promise<Omit<StableDbWritabilityScenarioResult, "scenarioId" | "durationMs">>,
): Promise<StableDbWritabilityScenarioResult> {
  const started = performance.now();
  const result = await run();
  return {
    scenarioId,
    durationMs: Math.round((performance.now() - started) * 100) / 100,
    ...result,
  };
}

/**
 * Builds a backpressure snapshot indicating read-only mode.
 * Used to simulate DB unavailability conditions for testing.
 */
function buildReadOnlyBackpressureSnapshot(): AdmissionBackpressureSnapshot {
  return {
    status: "unhealthy",
    degradationMode: "read_only_operations_only",
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: ["db_not_writable"],
  };
}

/**
 * Seeds the database with a minimal task, execution, workflow, and session.
 * Creates the authoritative records needed for dispatch testing.
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
      title: "Stable DB writability rehearsal task",
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
      agentId: "agent-db-writability",
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
 * Scenario 1: Health and Doctor services fail-close when DB is not writable.
 *
 * Tests that the health monitoring system properly detects and reports
 * database writability issues, and that the Doctor service responds
 * appropriately by entering fail-closed state.
 *
 * This validates the first line of defense against degraded database state.
 */
async function runHealthAndDoctorScenario(outputDir: string): Promise<StableDbWritabilityScenarioResult> {
  return measureScenario("health_and_doctor_fail_close_when_db_is_not_writable", async () => {
    const dbPath = join(outputDir, "db-writability-health.db");
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}.backup`, { force: true });

    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const healthService = new HealthService(db, store);

    // Inject failure by making checkDbWritable return false
    const healthInternals = healthService as unknown as {
      checkDbWritableSync: () => boolean;
    };
    const originalCheckDbWritable = healthInternals.checkDbWritableSync.bind(healthService);
    healthInternals.checkDbWritableSync = () => false;

    // Doctor service runs with the injected health state
    const doctor = new DoctorService(
      healthService,
      new StartupConsistencyChecker(db, store),
      null,
      null,
      new SqliteReliabilityService(db),
      `${dbPath}.backup`,
      null,
      null,
      new WorkerRegistryService(store),
      null,
      null,
      null,
      { store },
    );

    const healthReport = healthService.getReport();
    const doctorReport = doctor.run();
    const dbCheck = doctorReport.checks.find((check) => check.checkId === "db") ?? null;

    // Restore original behavior
    healthInternals.checkDbWritableSync = originalCheckDbWritable;
    db.close();

    return {
      passed:
        healthReport.dbWritable === false &&
        healthReport.status === "unhealthy" &&
        healthReport.degradationMode === "read_only_operations_only" &&
        healthReport.findings.includes("db_not_writable") &&
        doctorReport.status === "fail_closed" &&
        dbCheck?.status === "fail_closed" &&
        (dbCheck?.findings ?? []).includes("db_write_probe_failed"),
      summary: "health and doctor fail close the runtime when the authoritative store is no longer writable",
      details: {
        healthReport,
        doctorStatus: doctorReport.status,
        dbCheck,
      },
    };
  });
}

/**
 * Scenario 2: Multi-step admission rejects new work when DB is read-only.
 *
 * Tests that when the database is in read-only mode, the multi-step orchestration
 * layer properly rejects new work at admission time rather than allowing
 * execution to proceed and fail later.
 *
 * Validates that:
 * - Task is cancelled before execution starts
 * - Workflow and session are also cancelled
 * - No execution record is created
 * - Admission rejection event is emitted
 */
async function runMultiStepAdmissionScenario(outputDir: string): Promise<StableDbWritabilityScenarioResult> {
  return measureScenario("multi_step_admission_rejects_new_work_in_read_only_mode", async () => {
    const dbPath = join(outputDir, "db-writability-multi-step.db");
    rmSync(dbPath, { force: true });

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Stable DB writability admission drill",
      request: "Reject new authoritative work while the store is read-only.",
      admissionBackpressureSnapshot: buildReadOnlyBackpressureSnapshot,
    });

    return {
      passed:
        result.snapshot.task.status === "cancelled" &&
        result.snapshot.workflow?.status === "cancelled" &&
        result.snapshot.session?.status === "cancelled" &&
        result.snapshot.execution == null &&
        result.snapshot.events.some((event) => event.eventType === "admission:rejected") &&
        result.snapshot.stepOutputs.length === 0 &&
        result.streamFrames.length === 0,
      summary: "multi-step intake fails closed before execution when the authoritative store is read-only",
      details: {
        taskStatus: result.snapshot.task.status,
        workflowStatus: result.snapshot.workflow?.status ?? null,
        sessionStatus: result.snapshot.session?.status ?? null,
        executionId: result.snapshot.execution?.id ?? null,
        eventTypes: result.snapshot.events.map((event) => event.eventType),
      },
    };
  });
}

/**
 * Scenario 3: Dispatch blocks claims without dropping pending tickets in read-only mode.
 *
 * Tests that when the database becomes read-only during dispatch operations:
 * - Dispatch decisions return "blocked" outcome with backpressure reason
 * - The pending ticket is preserved (remains in pending status)
 * - No work is silently dropped
 * - Decision events properly record the blocked state
 *
 * This ensures the system maintains data integrity during degraded conditions.
 */
async function runDispatchReadOnlyScenario(outputDir: string): Promise<StableDbWritabilityScenarioResult> {
  return measureScenario("dispatch_blocks_claims_without_dropping_pending_ticket_in_read_only_mode", async () => {
    const dbPath = join(outputDir, "db-writability-dispatch.db");
    rmSync(dbPath, { force: true });

    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store, buildReadOnlyBackpressureSnapshot);

    // Seed test data
    seedTaskExecutionWorkflowAndSession(db, store, {
      taskId: "task-db-writability-dispatch",
      executionId: "exec-db-writability-dispatch",
      traceId: "trace-db-writability-dispatch",
    });
    workers.recordHeartbeat({
      workerId: "worker-db-writability",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-db-writability-1",
      occurredAt: "2026-04-07T13:10:00.000Z",
    });

    // Create ticket and attempt dispatch
    const created = dispatch.createTicket({
      executionId: "exec-db-writability-dispatch",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-07T13:10:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-07T13:10:06.000Z",
    });
    const ticket = store.worker.getExecutionTicket(created.ticket.id);
    const events = store.event.listEventsForTask("task-db-writability-dispatch");
    const decisionEvent = events.find((event) => event.eventType === "dispatch:decision_recorded");
    const decisionPayload = decisionEvent
      ? (JSON.parse(decisionEvent.payloadJson) as { outcome: string; reasonCode: string | null })
      : null;
    db.close();

    return {
      passed:
        decision.outcome === "blocked" &&
        decision.reasonCode === "backpressure.read_only_mode" &&
        ticket?.status === "pending" &&
        decision.trace?.reasonCode === "backpressure.read_only_mode" &&
        decisionPayload?.outcome === "blocked" &&
        decisionPayload?.reasonCode === "backpressure.read_only_mode",
      summary: "dispatch blocks new claims and preserves the pending ticket while the authoritative store is read-only",
      details: {
        created,
        decision,
        ticket,
        eventTypes: events.map((event) => event.eventType),
        decisionPayload,
      },
    };
  });
}

/**
 * Runs all DB writability rehearsal scenarios.
 *
 * Executes three scenarios sequentially:
 * 1. Health and Doctor fail-close behavior
 * 2. Multi-step admission rejection in read-only mode
 * 3. Dispatch blocking without dropping tickets
 *
 * Returns an aggregated report with results from all scenarios.
 */
export async function runStableDbWritabilityRehearsal(
  options: StableDbWritabilityRehearsalOptions,
): Promise<StableDbWritabilityRehearsalReport> {
  mkdirSync(options.outputDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const scenarios = [
    await runHealthAndDoctorScenario(options.outputDir),
    await runMultiStepAdmissionScenario(options.outputDir),
    await runDispatchReadOnlyScenario(options.outputDir),
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
 * Writes the DB writability rehearsal report to a JSON file.
 */
export function writeStableDbWritabilityRehearsalReport(path: string, report: StableDbWritabilityRehearsalReport): void {
  writeJson(path, report);
}
