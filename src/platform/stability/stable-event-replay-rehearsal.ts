/**
 * Stable event replay rehearsal: verifies failed consumer acknowledgements can be replayed cleanly.
 *
 * @documentation
 * - Architecture: docs_zh/architecture/00-platform-architecture.md
 * - Event reliability: docs_zh/contracts/event_reliability_matrix_contract.md
 * - Event bus: docs_zh/contracts/event_bus_contract.md
 * - Terminology: docs_zh/governance/glossary_and_terminology.md
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { WorkflowStateError } from "../contracts/errors.js";
import { EventOpsService } from "../state-evidence/events/event-ops-service.js";
import { AuthoritativeTaskStore } from "../state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../state-evidence/truth/sqlite-database.js";
import { nowIso } from "../contracts/types/ids.js";

export interface StableEventReplayRehearsalOptions {
  outputDir: string;
}

export interface StableEventReplayScenarioResult {
  scenarioId: "failed_consumer_ack_replay";
  passed: boolean;
  durationMs: number;
  summary: string;
  details: Record<string, unknown>;
}

export interface StableEventReplayRehearsalReport {
  startedAt: string;
  finishedAt: string;
  outputDir: string;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  scenarios: StableEventReplayScenarioResult[];
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function seedTaskAndExecution(db: SqliteDatabase, store: AuthoritativeTaskStore): void {
  const now = nowIso();
  db.transaction(() => {
    store.task.insertTask({
      id: "task-replay-rehearsal",
      parentId: null,
      rootId: "task-replay-rehearsal",
      divisionId: "general_ops",
      title: "Stable event replay rehearsal task",
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
      id: "exec-replay-rehearsal",
      taskId: "task-replay-rehearsal",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-replay",
      roleId: "general_executor",
      runKind: "task_run",
      status: "executing",
      inputRef: null,
      traceId: "trace-replay-rehearsal",
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

async function measureScenario(
  run: () => Promise<Omit<StableEventReplayScenarioResult, "scenarioId" | "durationMs">>,
): Promise<StableEventReplayScenarioResult> {
  const started = performance.now();
  const result = await run();
  return {
    scenarioId: "failed_consumer_ack_replay",
    durationMs: Math.round((performance.now() - started) * 100) / 100,
    ...result,
  };
}

async function runFailedConsumerAckReplay(outputDir: string): Promise<StableEventReplayScenarioResult> {
  return measureScenario(async () => {
    const dbPath = join(outputDir, "event-replay.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store);

    store.event.createTier1StatusEvent({
      taskId: "task-replay-rehearsal",
      executionId: "exec-replay-rehearsal",
      eventType: "task:status_changed",
      traceId: "trace-replay-rehearsal",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const ops = new EventOpsService(db, store);
    ops.subscribe("task_projection", async () => {
      throw new WorkflowStateError(
        "projection replay rehearsal failure",
        "projection replay rehearsal failure",
        {
          retryable: false,
        },
      );
    });

    const firstAttempt = await ops.replayConsumer("task_projection");
    ops.subscribe("task_projection", async () => {
      // Successful replay clears the failed ack.
    });
    const secondAttempt = await ops.replayConsumer("task_projection");
    const inspectReplay = await ops.replayConsumer("inspect_projection");
    const failedAfterReplay = store.event.countFailedTier1Acks();
    const pendingAfterReplay = store.event.countPendingTier1Acks();
    ops.dispose();
    db.close();

    return {
      passed:
        firstAttempt.outcome === "failed" &&
        firstAttempt.failedAfter >= 1 &&
        secondAttempt.outcome === "delivered" &&
        secondAttempt.pendingAfter === 0 &&
        secondAttempt.failedAfter === 0 &&
        inspectReplay.outcome === "delivered" &&
        inspectReplay.pendingAfter === 0 &&
        failedAfterReplay === 0 &&
        pendingAfterReplay === 0,
      summary: "failed tier1 consumer acknowledgements can be replayed into a clean ack state",
      details: {
        firstAttempt,
        secondAttempt,
        inspectReplay,
        failedAfterReplay,
        pendingAfterReplay,
      },
    };
  });
}

export async function runStableEventReplayRehearsal(
  options: StableEventReplayRehearsalOptions,
): Promise<StableEventReplayRehearsalReport> {
  mkdirSync(options.outputDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const scenarios = [await runFailedConsumerAckReplay(options.outputDir)];

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

export function writeStableEventReplayRehearsalReport(
  outputFile: string,
  report: StableEventReplayRehearsalReport,
): void {
  writeJson(outputFile, report);
}
