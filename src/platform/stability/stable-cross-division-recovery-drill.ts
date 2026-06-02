/**
 * Stable cross-division recovery drill: validates stale, blocked, and dead-letter recovery per division.
 *
 * @documentation
 * - Architecture: docs_zh/architecture/00-platform-architecture.md
 * - Startup & recovery drills: docs_zh/contracts/startup_consistency_and_recovery_drill_contract.md
 * - Disaster recovery: docs_zh/contracts/remote_coordination_and_disaster_recovery_contract.md
 * - Division definitions: docs_zh/contracts/division_definition_contract.md
 * - Terminology: docs_zh/governance/glossary_and_terminology.md
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { ApprovalService } from "../five-plane-control-plane/approval-center/approval-service.js";
import { RuntimeRecoveryDecisionService } from "../five-plane-execution/recovery/runtime-recovery-decision-service.js";
import { RuntimeRecoveryReplayService } from "../five-plane-execution/recovery/runtime-recovery-replay-service.js";
import { RuntimeRecoveryService } from "../five-plane-execution/recovery/runtime-recovery-service.js";
import { AuthoritativeTaskStore } from "../five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../five-plane-state-evidence/truth/sqlite-database.js";
import { nowIso } from "../contracts/types/ids.js";

export interface StableCrossDivisionRecoveryDrillOptions {
  outputDir: string;
}

export interface StableCrossDivisionRecoveryScenarioResult {
  scenarioId: "cross_division_overview" | "cross_division_replay_matrix";
  passed: boolean;
  durationMs: number;
  summary: string;
  details: Record<string, unknown>;
}

export interface StableCrossDivisionRecoveryDrillReport {
  startedAt: string;
  finishedAt: string;
  outputDir: string;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  scenarios: StableCrossDivisionRecoveryScenarioResult[];
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

async function measureScenario(
  scenarioId: StableCrossDivisionRecoveryScenarioResult["scenarioId"],
  run: () => Promise<Omit<StableCrossDivisionRecoveryScenarioResult, "scenarioId" | "durationMs">>,
): Promise<StableCrossDivisionRecoveryScenarioResult> {
  const started = performance.now();
  const result = await run();
  return {
    scenarioId,
    durationMs: Math.round((performance.now() - started) * 100) / 100,
    ...result,
  };
}

function seedExecution(
  db: SqliteDatabase,
  store: AuthoritativeTaskStore,
  input: {
    taskId: string;
    executionId: string;
    divisionId: string;
    workflowId: string;
    roleId: string;
    agentId: string;
    title: string;
    status: "created" | "prechecking" | "executing" | "blocked";
    attempt?: number;
    requiresApproval?: 0 | 1;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    updatedAt: string;
    heartbeatAt?: string | null;
    precheck: {
      allowed: 0 | 1;
      reasonCode: string | null;
      checkedAt: string;
    };
  },
): void {
  db.transaction(() => {
    store.task.insertTask({
      id: input.taskId,
      parentId: null,
      rootId: input.taskId,
      divisionId: input.divisionId,
      title: input.title,
      status: "in_progress",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: input.updatedAt,
      updatedAt: input.updatedAt,
      completedAt: null,
    });
    store.execution.insertExecution({
      id: input.executionId,
      taskId: input.taskId,
      workflowId: input.workflowId,
      parentExecutionId: null,
      harnessRunId: null,
      agentId: input.agentId,
      roleId: input.roleId,
      runKind: "task_run",
      status: input.status,
      inputRef: null,
      traceId: `trace-${input.executionId}`,
      attempt: input.attempt ?? 1,
      timeoutMs: 1_500,
      budgetUsdLimit: 1,
      budgetReservationId: null,
      budgetLedgerId: null,
      requiresApproval: input.requiresApproval ?? 0,
      sandboxMode: "workspace_write",
      allowedToolsJson: JSON.stringify(["analysis"]),
      allowedPathsJson: JSON.stringify([]),
      maxRetries: 1,
      retryBackoff: "linear",
      lastErrorCode: input.lastErrorCode ?? null,
      lastErrorMessage: input.lastErrorMessage ?? null,
      startedAt: input.updatedAt,
      finishedAt: null,
      createdAt: input.updatedAt,
      updatedAt: input.updatedAt,
    });
    store.execution.insertExecutionPrecheck({
      id: `precheck-${input.executionId}`,
      executionId: input.executionId,
      allowed: input.precheck.allowed,
      reasonCode: input.precheck.reasonCode,
      resolvedBudgetUsd: 1,
      resolvedTimeoutMs: 1_500,
      resolvedSandboxMode: "workspace_write",
      resolvedToolsJson: JSON.stringify(["analysis"]),
      resolvedPathsJson: JSON.stringify([]),
      checkedAt: input.precheck.checkedAt,
    });
    if (input.heartbeatAt) {
      store.worker.insertHeartbeatSnapshot({
        id: `hb-${input.executionId}`,
        executionId: input.executionId,
        agentId: input.agentId,
        runtimeInstanceId: null,
        restartGeneration: 0,
        status: input.status,
        progressMessage: "still running",
        cpuPct: 12,
        memoryMb: 64,
        sampledAt: input.heartbeatAt,
      });
    }
  });
}

async function seedCrossDivisionRecoveryDataset(dbPath: string): Promise<void> {
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const approvals = new ApprovalService(db, store);

  seedExecution(db, store, {
    taskId: "task-general-stale-drill",
    executionId: "exec-general-stale-drill",
    divisionId: "general-ops",
    workflowId: "single_agent_minimal",
    roleId: "general_executor",
    agentId: "agent-general-drill",
    title: "General stale drill task",
    status: "executing",
    updatedAt: "2026-04-04T09:00:00.000Z",
    heartbeatAt: "2026-04-04T09:01:00.000Z",
    precheck: {
      allowed: 1,
      reasonCode: null,
      checkedAt: "2026-04-04T09:00:05.000Z",
    },
  });

  seedExecution(db, store, {
    taskId: "task-engineering-blocked-drill",
    executionId: "exec-engineering-blocked-drill",
    divisionId: "engineering-ops",
    workflowId: "engineering_single_agent_minimal",
    roleId: "engineer",
    agentId: "agent-engineering-drill",
    title: "Engineering blocked drill task",
    status: "blocked",
    requiresApproval: 1,
    lastErrorCode: "approval_required",
    lastErrorMessage: "approval pending",
    updatedAt: "2026-04-04T09:10:00.000Z",
    precheck: {
      allowed: 1,
      reasonCode: null,
      checkedAt: "2026-04-04T09:10:05.000Z",
    },
  });
  approvals.createRequest({
    taskId: "task-engineering-blocked-drill",
    executionId: "exec-engineering-blocked-drill",
    sourceAgentId: "agent-engineering-drill",
    reason: "Need engineering approval during drill",
    riskLevel: "high",
    options: ["approve", "reject"],
    context: { source: "stable-cross-division-recovery-drill" },
    timeoutPolicy: "reject",
  });

  seedExecution(db, store, {
    taskId: "task-engineering-dead-letter-drill",
    executionId: "exec-engineering-dead-letter-drill",
    divisionId: "engineering-ops",
    workflowId: "engineering_single_agent_minimal",
    roleId: "engineer",
    agentId: "agent-engineering-drill",
    title: "Engineering dead letter drill task",
    status: "executing",
    attempt: 3,
    lastErrorCode: "unexpected_runtime_error",
    lastErrorMessage: "tool crashed twice",
    updatedAt: "2026-04-04T09:20:00.000Z",
    precheck: {
      allowed: 1,
      reasonCode: null,
      checkedAt: "2026-04-04T09:20:05.000Z",
    },
  });

  const decisions = new RuntimeRecoveryDecisionService(db, store);
  await decisions.apply("exec-engineering-dead-letter-drill", "stable_cross_division_recovery_drill");

  db.close();
}

async function runCrossDivisionOverviewScenario(
  outputDir: string,
): Promise<StableCrossDivisionRecoveryScenarioResult> {
  return measureScenario("cross_division_overview", async () => {
    const dbPath = join(outputDir, "cross-division-overview.db");
    rmSync(dbPath, { force: true });
    await seedCrossDivisionRecoveryDataset(dbPath);

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    const recovery = new RuntimeRecoveryService(store);
    const staleRuns = recovery.listStaleRuns("2026-04-04T09:05:00.000Z");
    const blockedRuns = recovery.listBlockedRunsAwaitingApproval();
    const overview = recovery.listDivisionRecoveryOverview("2026-04-04T09:05:00.000Z");
    db.close();

    return {
      passed:
        staleRuns.some((item) => item.executionId === "exec-general-stale-drill") &&
        blockedRuns.some((item) => item.executionId === "exec-engineering-blocked-drill") &&
        overview.length === 2 &&
        overview.some(
          (item) =>
            item.divisionId === "engineering-ops" &&
            item.activeCandidateCount === 1 &&
            item.blockedApprovalCount === 1 &&
            item.staleExecutionCount === 0,
        ) &&
        overview.some(
          (item) =>
            item.divisionId === "general-ops" &&
            item.activeCandidateCount === 1 &&
            item.blockedApprovalCount === 0 &&
            item.staleExecutionCount === 1,
        ),
      summary: "cross-division recovery overview keeps stale, blocked, and repeated-failure candidates partitioned by division",
      details: {
        staleExecutionIds: staleRuns.map((item) => item.executionId),
        blockedExecutionIds: blockedRuns.map((item) => item.executionId),
        overview,
      },
    };
  });
}

async function runCrossDivisionReplayScenario(
  outputDir: string,
): Promise<StableCrossDivisionRecoveryScenarioResult> {
  return measureScenario("cross_division_replay_matrix", async () => {
    const dbPath = join(outputDir, "cross-division-replay.db");
    rmSync(dbPath, { force: true });
    await seedCrossDivisionRecoveryDataset(dbPath);

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    const replay = new RuntimeRecoveryReplayService(store);
    const generatedAt = "2026-04-04T09:30:00.000Z";
    const general = await replay.buildTaskReplayReport("task-general-stale-drill", generatedAt);
    const blocked = await replay.buildTaskReplayReport("task-engineering-blocked-drill", generatedAt);
    const deadLetter = await replay.buildTaskReplayReport("task-engineering-dead-letter-drill", generatedAt);
    db.close();

    return {
      passed:
        general.outcome === "repair_pending" &&
        general.executions[0]?.suggestedAction === "resume_same_worker" &&
        blocked.outcome === "manual_handoff" &&
        blocked.executions[0]?.suggestedAction === "escalate_takeover" &&
        deadLetter.outcome === "dead_lettered" &&
        deadLetter.executions[0]?.finalOutcome === "dead_lettered" &&
        deadLetter.executions[0]?.suggestedAction === "move_dead_letter" &&
        deadLetter.executions[0]?.timeline.some((event) => event.eventType === "recovery:dead_lettered") === true,
      summary: "cross-division recovery replay reports deterministic outcomes for stale, manual-handoff, and dead-letter paths",
      details: {
        reports: [general, blocked, deadLetter].map((report) => ({
          taskId: report.taskId,
          divisionId: report.divisionId,
          outcome: report.outcome,
          executionOutcomes: report.executions.map((execution) => ({
            executionId: execution.executionId,
            finalOutcome: execution.finalOutcome,
            suggestedAction: execution.suggestedAction,
          })),
          executions: report.executions.map((execution) => ({
            executionId: execution.executionId,
            finalOutcome: execution.finalOutcome,
            suggestedAction: execution.suggestedAction,
            timeline: execution.timeline,
          })),
        })),
      },
    };
  });
}

export async function runStableCrossDivisionRecoveryDrill(
  options: StableCrossDivisionRecoveryDrillOptions,
): Promise<StableCrossDivisionRecoveryDrillReport> {
  mkdirSync(options.outputDir, { recursive: true });
  const startedAt = nowIso();
  const scenarios = [
    await runCrossDivisionOverviewScenario(options.outputDir),
    await runCrossDivisionReplayScenario(options.outputDir),
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

export function writeStableCrossDivisionRecoveryDrillReport(
  outputFile: string,
  report: StableCrossDivisionRecoveryDrillReport,
): void {
  writeJson(outputFile, report);
}
