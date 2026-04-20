/**
 * Stable rollback rehearsal: validates runtime repair and manual takeover rollback paths.
 *
 * @documentation
 * - Architecture: docs_zh/architecture/00-platform-architecture.md
 * - Release lifecycle: docs_zh/contracts/release_rollout_and_rollback_contract.md
 * - Startup & recovery drills: docs_zh/contracts/startup_consistency_and_recovery_drill_contract.md
 * - Terminology: docs_zh/governance/glossary_and_terminology.md
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { HumanTakeoverService } from "../../control-plane/incident-control/human-takeover-service.js";
import { buildRuntimeVersionSnapshot, type RuntimeVersionSnapshot } from "../../control-plane/incident-control/runtime-version-snapshot.js";
import { RuntimeRepairService } from "../../execution/recovery/runtime-repair-service-root.js";
import { StartupConsistencyChecker } from "../../execution/startup/startup-consistency-checker.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../state-evidence/truth/sqlite-database.js";
import { nowIso } from "../../contracts/types/ids.js";

export interface StableRollbackRehearsalOptions {
  outputDir: string;
}

export interface StableRollbackScenarioResult {
  scenarioId: "runtime_repair_rehearsal" | "manual_takeover_rehearsal";
  passed: boolean;
  durationMs: number;
  summary: string;
  details: Record<string, unknown>;
}

export const REQUIRED_STABLE_ROLLBACK_TARGETS = [
  "application_binary",
  "config_bundle",
  "feature_flag",
  "worker_version",
  "prompt_bundle",
] as const;

export type StableRollbackTargetId = (typeof REQUIRED_STABLE_ROLLBACK_TARGETS)[number];

export interface StableRollbackEntryPoint {
  entryPointId: "stable_rollback_cli" | "runtime_repair_service" | "human_takeover_service";
  description: string;
  command: string | null;
}

export interface StableRollbackTarget {
  targetId: StableRollbackTargetId;
  currentVersion: string | null;
  rollbackOwner: string;
  rollbackTrigger: string;
  entryPointId: StableRollbackEntryPoint["entryPointId"];
  rollbackSteps: string[];
  healthValidation: string[];
  auditRequirements: string[];
}

export interface StableRollbackPlaybook {
  generatedAt: string;
  rollbackOwner: string;
  reportPath: string;
  playbookPath: string;
  runtimeVersionSnapshot: RuntimeVersionSnapshot;
  prechecks: string[];
  healthValidation: string[];
  auditRequirements: string[];
  rollbackEntryPoints: StableRollbackEntryPoint[];
  scenarioEvidence: Array<{
    scenarioId: StableRollbackScenarioResult["scenarioId"];
    passed: boolean;
    summary: string;
  }>;
  targets: StableRollbackTarget[];
}

export interface StableRollbackRehearsalReport {
  startedAt: string;
  finishedAt: string;
  outputDir: string;
  artifacts: {
    reportPath: string;
    playbookPath: string;
  };
  playbook: StableRollbackPlaybook;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  scenarios: StableRollbackScenarioResult[];
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function formatFeatureFlagVersion(flags: string[]): string {
  return flags.length > 0 ? flags.join(",") : "none_enabled";
}

function buildRollbackRuntimeVersionSnapshot(outputDir: string): RuntimeVersionSnapshot {
  const snapshotDbPath = join(outputDir, "stable-rollback-playbook.db");
  rmSync(snapshotDbPath, { force: true });
  rmSync(`${snapshotDbPath}-wal`, { force: true });
  rmSync(`${snapshotDbPath}-shm`, { force: true });

  const db = new SqliteDatabase(snapshotDbPath);
  db.migrate();
  const snapshot = buildRuntimeVersionSnapshot(db.getSchemaStatus());
  db.close();

  rmSync(snapshotDbPath, { force: true });
  rmSync(`${snapshotDbPath}-wal`, { force: true });
  rmSync(`${snapshotDbPath}-shm`, { force: true });
  return snapshot;
}

export function buildStableRollbackPlaybook(input: {
  outputDir: string;
  reportPath: string;
  playbookPath: string;
  scenarios: StableRollbackScenarioResult[];
}): StableRollbackPlaybook {
  const runtimeVersionSnapshot = buildRollbackRuntimeVersionSnapshot(input.outputDir);
  const rollbackOwner = "release_manager_oncall";

  return {
    generatedAt: new Date().toISOString(),
    rollbackOwner,
    reportPath: input.reportPath,
    playbookPath: input.playbookPath,
    runtimeVersionSnapshot,
    prechecks: [
      "freeze new rollout expansion and record the release batch or incident reference",
      "confirm schema compatibility state is unchanged and no irreversible migration is in progress",
      "capture the current application, config, prompt, and feature-flag versions before any rollback step",
      "verify runtime repair and manual takeover entry points are available for fallback remediation",
    ],
    healthValidation: [
      "rerun doctor and confirm runtime health is not degraded",
      "confirm rollback rehearsal scenarios still pass or are not regressing",
      "verify task execution, session closeout, and approval state transitions remain resumable",
      "confirm schema version is current and no checksum mismatch is present",
    ],
    auditRequirements: [
      "record the triggering incident or release batch identifier",
      "persist the generated rollback report and rollback playbook artifacts",
      "capture operator identity and reason codes for any manual takeover activity",
      "retain before and after version snapshots for application, config, prompt, worker, and feature-flag state",
    ],
    rollbackEntryPoints: [
      {
        entryPointId: "stable_rollback_cli",
        description: "local rollback rehearsal report used to validate release rollback readiness",
        command: "npm run rollback:stable",
      },
      {
        entryPointId: "runtime_repair_service",
        description: "repair stale or orphaned runtime state before resuming queued work",
        command: null,
      },
      {
        entryPointId: "human_takeover_service",
        description: "manual operator takeover path for input correction, worker switching, and controlled task closure",
        command: null,
      },
    ],
    scenarioEvidence: input.scenarios.map((scenario) => ({
      scenarioId: scenario.scenarioId,
      passed: scenario.passed,
      summary: scenario.summary,
    })),
    targets: [
      {
        targetId: "application_binary",
        currentVersion: runtimeVersionSnapshot.applicationVersion,
        rollbackOwner,
        rollbackTrigger: "deploy regression or incompatible binary rollout",
        entryPointId: "stable_rollback_cli",
        rollbackSteps: [
          "pin the previous stable application package before resuming rollout traffic",
          "re-run rollback rehearsal evidence and doctor checks after the binary swap",
        ],
        healthValidation: [
          "confirm application version matches the intended rollback candidate",
          "confirm the rollback report still shows zero failed scenarios",
        ],
        auditRequirements: [
          "record previous and restored application version identifiers",
        ],
      },
      {
        targetId: "config_bundle",
        currentVersion: runtimeVersionSnapshot.configVersion,
        rollbackOwner,
        rollbackTrigger: "config regression, invalid governance bundle, or unsafe default change",
        entryPointId: "runtime_repair_service",
        rollbackSteps: [
          "restore the prior config bundle version and restart affected runtime paths in a controlled window",
          "run runtime repair to requeue stale executions created under the bad config state",
        ],
        healthValidation: [
          "confirm config issues are empty or understood after the rollback",
          "confirm pending work returns to a resumable state instead of remaining stuck",
        ],
        auditRequirements: [
          "capture previous and restored config bundle versions",
        ],
      },
      {
        targetId: "feature_flag",
        currentVersion: formatFeatureFlagVersion(runtimeVersionSnapshot.featureFlags),
        rollbackOwner,
        rollbackTrigger: "unsafe flag exposure, rollout overreach, or partial-availability mitigation",
        entryPointId: "stable_rollback_cli",
        rollbackSteps: [
          "disable or narrow the offending feature flags to the last known safe set",
          "verify remote and local dispatch paths return to the expected readiness state",
        ],
        healthValidation: [
          "confirm feature flag inventory matches the intended rollback set",
          "confirm health and doctor no longer report the triggering degradation",
        ],
        auditRequirements: [
          "record the exact before and after feature flag sets",
        ],
      },
      {
        targetId: "worker_version",
        currentVersion: runtimeVersionSnapshot.buildCommit ?? runtimeVersionSnapshot.applicationVersion,
        rollbackOwner,
        rollbackTrigger: "worker fleet mismatch, restart chain regression, or writeback incompatibility",
        entryPointId: "human_takeover_service",
        rollbackSteps: [
          "drain mismatched workers and switch queued or active executions to the last known safe worker runtime",
          "use manual takeover when an in-flight task needs operator-directed worker reassignment",
        ],
        healthValidation: [
          "confirm worker reassignment leaves executions resumable and sessions closable",
          "confirm no stale execution remains after the worker version rollback",
        ],
        auditRequirements: [
          "capture the affected worker identities and restored runtime version",
        ],
      },
      {
        targetId: "prompt_bundle",
        currentVersion: runtimeVersionSnapshot.promptBundleVersion,
        rollbackOwner,
        rollbackTrigger: "prompt regression, unsafe instruction change, or degraded operator workflow",
        entryPointId: "human_takeover_service",
        rollbackSteps: [
          "restore the previous prompt bundle version for the affected workflow set",
          "use manual takeover to correct any in-flight task inputs that were mutated by the bad prompt bundle",
        ],
        healthValidation: [
          "confirm prompt bundle version matches the intended rollback candidate",
          "confirm manual takeover can still close adjusted tasks with a complete audit trail",
        ],
        auditRequirements: [
          "capture previous and restored prompt bundle versions plus any corrected task ids",
        ],
      },
    ],
  };
}

async function measureScenario(
  scenarioId: StableRollbackScenarioResult["scenarioId"],
  run: () => Promise<Omit<StableRollbackScenarioResult, "scenarioId" | "durationMs">>,
): Promise<StableRollbackScenarioResult> {
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
    sessionId: string;
  },
): void {
  const now = nowIso();
  db.transaction(() => {
    store.task.insertTask({
      id: input.taskId,
      parentId: null,
      rootId: input.taskId,
      divisionId: "general_ops",
      title: "Stable rollback rehearsal task",
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
      agentId: "agent-general",
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
    store.session.insertSession({
      id: input.sessionId,
      taskId: input.taskId,
      channel: "cli",
      status: "open",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function runRuntimeRepairRehearsal(outputDir: string): Promise<StableRollbackScenarioResult> {
  return measureScenario("runtime_repair_rehearsal", async () => {
    const dbPath = join(outputDir, "runtime-repair-rehearsal.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-runtime-repair",
      executionId: "exec-runtime-repair",
      traceId: "trace-runtime-repair",
      sessionId: "sess-runtime-repair",
    });
    db.connection
      .prepare(`UPDATE executions SET updated_at = ? WHERE id = ?`)
      .run("2026-04-03T10:00:00.000Z", "exec-runtime-repair");
    db.connection
      .prepare(`UPDATE workflow_state SET updated_at = ? WHERE task_id = ?`)
      .run("2026-04-03T10:00:00.000Z", "task-runtime-repair");

    const checker = new StartupConsistencyChecker(db, store);
    const repair = new RuntimeRepairService(db, store);
    const before = checker.run({
      now: "2026-04-03T10:10:00.000Z",
      staleExecutionAfterMs: 5 * 60 * 1000,
    });
    const applied = await repair.apply(before);
    const after = checker.run({
      now: "2026-04-03T10:10:00.000Z",
      staleExecutionAfterMs: 5 * 60 * 1000,
    });
    const snapshot = store.operations.loadTaskSnapshot("task-runtime-repair");
    db.close();

    return {
      passed:
        before.findings.some((finding) => finding.code === "stale_execution") &&
        applied.some((item) => item.action === "requeue_execution" && item.applied) &&
        after.status === "pass" &&
        snapshot.task.status === "pending" &&
        snapshot.execution?.status === "created",
      summary: "runtime repair rehearsal requeues a stale execution into a resumable state",
      details: {
        beforeStatus: before.status,
        afterStatus: after.status,
        applied,
        taskStatusAfter: snapshot.task.status,
        executionStatusAfter: snapshot.execution?.status ?? null,
      },
    };
  });
}

async function runManualTakeoverRehearsal(outputDir: string): Promise<StableRollbackScenarioResult> {
  return measureScenario("manual_takeover_rehearsal", async () => {
    const dbPath = join(outputDir, "manual-takeover-rehearsal.db");
    rmSync(dbPath, { force: true });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-manual-takeover",
      executionId: "exec-manual-takeover",
      traceId: "trace-manual-takeover",
      sessionId: "sess-manual-takeover",
    });

    const takeover = new HumanTakeoverService(db, store);
    const opened = takeover.openSession({
      taskId: "task-manual-takeover",
      operatorId: "operator-rehearsal",
      reasonCode: "rollback_rehearsal.open",
    });
    takeover.modifyInput({
      takeoverSessionId: opened.takeoverSessionId,
      inputJson: JSON.stringify({ request: "rollback rehearsal adjusted input" }),
      reasonCode: "rollback_rehearsal.modify_input",
    });
    takeover.switchWorker({
      takeoverSessionId: opened.takeoverSessionId,
      agentId: "agent-rollback-rehearsal",
      reasonCode: "rollback_rehearsal.switch_worker",
    });
    takeover.completeTask({
      takeoverSessionId: opened.takeoverSessionId,
      terminalStatus: "done",
      reasonCode: "rollback_rehearsal.complete_task",
      outputJson: JSON.stringify({
        summary: "manual takeover completed the rollback rehearsal",
        result: "task closed cleanly after manual intervention",
      }),
    });

    const snapshot = store.operations.loadTaskSnapshot("task-manual-takeover");
    const operatorActions = store.approval.listOperatorActionsByTask("task-manual-takeover");
    db.close();

    return {
      passed:
        snapshot.task.status === "done" &&
        snapshot.execution?.status === "succeeded" &&
        snapshot.session?.status === "completed" &&
        operatorActions.length >= 4,
      summary: "manual takeover rehearsal closes the task cleanly with a complete audit trail",
      details: {
        taskStatus: snapshot.task.status,
        executionStatus: snapshot.execution?.status ?? null,
        sessionStatus: snapshot.session?.status ?? null,
        operatorActionCount: operatorActions.length,
      },
    };
  });
}

export async function runStableRollbackRehearsal(
  options: StableRollbackRehearsalOptions,
): Promise<StableRollbackRehearsalReport> {
  mkdirSync(options.outputDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const reportPath = join(options.outputDir, "stable-rollback-report.json");
  const playbookPath = join(options.outputDir, "stable-rollback-playbook.json");

  const scenarios = [
    await runRuntimeRepairRehearsal(options.outputDir),
    await runManualTakeoverRehearsal(options.outputDir),
  ];
  const playbook = buildStableRollbackPlaybook({
    outputDir: options.outputDir,
    reportPath,
    playbookPath,
    scenarios,
  });
  writeJson(playbookPath, playbook);

  return {
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
}

export function writeStableRollbackRehearsalReport(
  outputFile: string,
  report: StableRollbackRehearsalReport,
): void {
  writeJson(outputFile, report);
}
