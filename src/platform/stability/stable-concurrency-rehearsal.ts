/**
 * Stable Concurrency Rehearsal Module
 *
 * This module validates concurrency control mechanisms in the runtime system.
 * It tests two critical scenarios:
 *
 * 1. Expired Lock Release: Verifies that file locks that have exceeded their
 *    expiration time are properly detected and released by the repair service.
 *    This prevents resource leaks from orphaned locks.
 *
 * 2. Active Execution Conflict (Fail-Closed): Verifies that when multiple
 *    executions exist for the same task in conflicting states (e.g., one
 *    executing, another in prechecking), the system fails closed and requires
 *    manual intervention rather than attempting automatic resolution.
 *
 * These tests ensure the system's concurrency safety guarantees.
 *
 * @see {@link docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md}
 *   Quality engineering contract defining concurrency and fail-closed behavior tests
 * @see {@link docs_zh/contracts/file_lock_contract.md}
 *   File lock contract defining lock lifecycle and expiration semantics
 * @see {@link docs_zh/architecture/00-platform-architecture.md}
 *   Architecture document for concurrency control design
 * @see {@link docs_zh/governance/glossary_and_terminology.md}
 *   Glossary defining concurrency-related terminology (locks, leases, fencing)
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { RuntimeRepairService } from "../execution/recovery/runtime-repair-service-root.js";
import { StartupConsistencyChecker } from "../execution/startup/startup-consistency-checker.js";
import { AuthoritativeTaskStore } from "../state-evidence/truth/authoritative-task-store.js";
import { isSqliteWriteContentionError, SqliteDatabase } from "../state-evidence/truth/sqlite-database.js";
import { nowIso } from "../contracts/types/ids.js";

/**
 * Options for the concurrency rehearsal test runner.
 */
export interface StableConcurrencyRehearsalOptions {
  /** Directory where test databases and reports will be written */
  outputDir: string;
}

/**
 * Result of a single concurrency scenario test.
 */
export interface StableConcurrencyScenarioResult {
  /** Unique identifier for the scenario tested */
  scenarioId: "expired_lock_released" | "active_execution_conflict_fail_closed" | "competing_write_transactions_fail_closed";
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
 * Aggregated report from all concurrency rehearsal scenarios.
 */
export interface StableConcurrencyRehearsalReport {
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
  scenarios: StableConcurrencyScenarioResult[];
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
  scenarioId: StableConcurrencyScenarioResult["scenarioId"],
  run: () => Promise<Omit<StableConcurrencyScenarioResult, "scenarioId" | "durationMs">>,
): Promise<StableConcurrencyScenarioResult> {
  const started = performance.now();
  const result = await run();
  return {
    scenarioId,
    durationMs: Math.round((performance.now() - started) * 100) / 100,
    ...result,
  };
}

/**
 * Seeds the database with a task, workflow state, and execution record.
 * Creates a complete task execution context for concurrency testing.
 * 
 * The function is idempotent - it only inserts the task if it doesn't exist,
 * allowing multiple executions to be seeded for the same task.
 * 
 * @param db - SQLite database instance
 * @param store - Authoritative task store for database operations
 * @param input - Object containing taskId, executionId, traceId, and optional status/attempt
 */
function seedTaskAndExecution(
  db: SqliteDatabase,
  store: AuthoritativeTaskStore,
  input: {
    taskId: string;
    executionId: string;
    traceId: string;
    status?: "created" | "prechecking" | "executing" | "blocked";
    attempt?: number;
  },
): void {
  const now = nowIso();
  db.transaction(() => {
    if (!store.task.getTask(input.taskId)) {
      store.task.insertTask({
        id: input.taskId,
        parentId: null,
        rootId: input.taskId,
        divisionId: "general_ops",
        title: "Stable concurrency rehearsal task",
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
    }

    store.execution.insertExecution({
      id: input.executionId,
      taskId: input.taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-concurrency",
      roleId: "general_executor",
      runKind: "task_run",
      status: input.status ?? "executing",
      inputRef: null,
      traceId: input.traceId,
      attempt: input.attempt ?? 1,
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
 * Scenario: Expired file locks are detected and released during runtime repair.
 * 
 * Creates a task with a file lock that expired in the past. Runs the startup
 * consistency checker and repair service to verify that:
 * - The expired lock is detected by the consistency checker
 * - The repair service applies a "release_stale_lock" action
 * - After repair, no expired locks remain in the system
 */
async function runExpiredLockReleased(outputDir: string): Promise<StableConcurrencyScenarioResult> {
  return measureScenario("expired_lock_released", async () => {
    const dbPath = join(outputDir, "expired-lock.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-lock",
      executionId: "exec-lock",
      traceId: "trace-lock",
    });
    store.lock.insertFileLock({
      id: "lock-expired",
      taskId: "task-lock",
      executionId: "exec-lock",
      lockScope: "workspace_path",
      resourcePath: "/tmp/stable-concurrency.txt",
      lockMode: "write",
      ownerId: "exec-lock",
      expiresAt: "2026-04-03T10:01:00.000Z",
      createdAt: "2026-04-03T10:00:00.000Z",
      updatedAt: "2026-04-03T10:00:00.000Z",
    });

    const checker = new StartupConsistencyChecker(db, store);
    const repair = new RuntimeRepairService(db, store);
    const before = checker.run({ now: "2026-04-03T10:10:00.000Z" });
    const applied = await repair.apply(before);
    const after = checker.run({ now: "2026-04-03T10:10:00.000Z" });
    const remainingLocks = store.lock.listExpiredFileLocks("2026-04-03T10:10:00.000Z");
    db.close();

    return {
      passed:
        before.findings.some((finding) => finding.code === "expired_file_lock") &&
        applied.some((item) => item.action === "release_stale_lock" && item.applied) &&
        after.findings.every((finding) => finding.code !== "expired_file_lock") &&
        remainingLocks.length === 0,
      summary: "expired file locks are detected and released during runtime repair",
      details: {
        beforeStatus: before.status,
        afterStatus: after.status,
        applied,
        remainingLocks: remainingLocks.length,
      },
    };
  });
}

/**
 * Scenario: Active execution conflicts fail closed and require manual intervention.
 * 
 * Creates two executions for the same task: one in "executing" state (attempt 1)
 * and another in "prechecking" state (attempt 2). This represents a conflict where
 * the system cannot safely auto-resolve. Verifies that:
 * - The consistency checker reports "fail_closed" status
 * - An "active_execution_conflict" finding is recorded
 * - The repair actions require manual intervention (no automatic fix attempted)
 */
async function runActiveExecutionConflictFailClosed(outputDir: string): Promise<StableConcurrencyScenarioResult> {
  return measureScenario("active_execution_conflict_fail_closed", async () => {
    const dbPath = join(outputDir, "execution-conflict.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-conflict-rehearsal",
      executionId: "exec-conflict-a",
      traceId: "trace-conflict",
      status: "executing",
      attempt: 1,
    });
    seedTaskAndExecution(db, store, {
      taskId: "task-conflict-rehearsal",
      executionId: "exec-conflict-b",
      traceId: "trace-conflict",
      status: "prechecking",
      attempt: 2,
    });

    const checker = new StartupConsistencyChecker(db, store);
    const report = checker.run({ now: "2026-04-03T10:10:00.000Z" });
    db.close();

    return {
      passed:
        report.status === "fail_closed" &&
        report.findings.some((finding) => finding.code === "active_execution_conflict") &&
        report.repairActions.some((action) => action.action === "manual_intervention_required"),
      summary: "active execution conflicts fail-close and require manual intervention",
      details: {
        status: report.status,
        findings: report.findings,
        repairActions: report.repairActions,
      },
    };
  });
}

async function runCompetingWriteTransactionsFailClosed(outputDir: string): Promise<StableConcurrencyScenarioResult> {
  return measureScenario("competing_write_transactions_fail_closed", async () => {
    const dbPath = join(outputDir, "write-contention.db");
    rmSync(dbPath, { force: true });
    const primaryDb = new SqliteDatabase(dbPath, { busyTimeoutMs: 50 });
    primaryDb.migrate();
    const primaryStore = new AuthoritativeTaskStore(primaryDb);
    const contenderDb = new SqliteDatabase(dbPath, { busyTimeoutMs: 1 });
    contenderDb.migrate();
    const contenderStore = new AuthoritativeTaskStore(contenderDb);

    const createdAt = "2026-04-03T10:00:00.000Z";
    let contentionError: unknown = null;

    primaryDb.transaction(() => {
      primaryStore.insertTask({
        id: "task-write-contention-primary",
        parentId: null,
        rootId: "task-write-contention-primary",
        divisionId: "general_ops",
        title: "Stable concurrency primary writer",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt,
        updatedAt: createdAt,
        completedAt: null,
      });

      try {
        contenderDb.transaction(() => {
          contenderStore.insertTask({
            id: "task-write-contention-contender",
            parentId: null,
            rootId: "task-write-contention-contender",
            divisionId: "general_ops",
            title: "Stable concurrency contender writer",
            status: "queued",
            source: "user",
            priority: "normal",
            inputJson: "{}",
            normalizedInputJson: "{}",
            outputJson: null,
            estimatedCostUsd: 0,
            actualCostUsd: 0,
            errorCode: null,
            createdAt,
            updatedAt: createdAt,
            completedAt: null,
          });
        });
      } catch (error) {
        contentionError = error;
      }
    });

    contenderDb.transaction(() => {
      contenderStore.insertTask({
        id: "task-write-contention-contender",
        parentId: null,
        rootId: "task-write-contention-contender",
        divisionId: "general_ops",
        title: "Stable concurrency contender writer",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt,
        updatedAt: createdAt,
        completedAt: null,
      });
    });

    const primaryTask = primaryStore.getTask("task-write-contention-primary");
    const contenderTask = contenderStore.getTask("task-write-contention-contender");
    primaryDb.close();
    contenderDb.close();

    return {
      passed:
        isSqliteWriteContentionError(contentionError) &&
        primaryTask?.title === "Stable concurrency primary writer" &&
        contenderTask?.title === "Stable concurrency contender writer",
      summary: "competing root write transactions fail-close with a stable contention error and preserve committed writes",
      details: {
        errorName: contentionError instanceof Error ? contentionError.name : null,
        errorMessage: contentionError instanceof Error ? contentionError.message : null,
        primaryTaskId: primaryTask?.id ?? null,
        contenderTaskId: contenderTask?.id ?? null,
      },
    };
  });
}

/**
 * Runs all concurrency rehearsal scenarios and produces an aggregated report.
 * 
 * Executes three scenarios:
 * 1. Expired lock release - verifies stale locks are cleaned up
 * 2. Active execution conflict - verifies fail-closed behavior
 * 3. Competing write transactions - verifies SQLite write contention fails closed with a stable error
 * 
 * @param options - Rehearsal options including output directory
 * @returns Aggregated report with all scenario results
 */
export async function runStableConcurrencyRehearsal(
  options: StableConcurrencyRehearsalOptions,
): Promise<StableConcurrencyRehearsalReport> {
  mkdirSync(options.outputDir, { recursive: true });
  const startedAt = new Date().toISOString();

  const scenarios = [
    await runExpiredLockReleased(options.outputDir),
    await runActiveExecutionConflictFailClosed(options.outputDir),
    await runCompetingWriteTransactionsFailClosed(options.outputDir),
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
 * Writes the concurrency rehearsal report to a JSON file.
 * 
 * @param outputFile - Path where the report JSON should be written
 * @param report - The report data to serialize and write
 */
export function writeStableConcurrencyRehearsalReport(
  outputFile: string,
  report: StableConcurrencyRehearsalReport,
): void {
  writeJson(outputFile, report);
}
