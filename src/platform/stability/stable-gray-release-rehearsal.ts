/**
 * Stable tenant-gray release rehearsal: validates scoped cohort rollout and rollback switches.
 *
 * @documentation
 * - Release lifecycle: docs_zh/contracts/release_rollout_and_rollback_contract.md
 * - Promotion criteria: docs_zh/contracts/platform_promote_criteria_contract.md
 * - Version governance: docs_zh/contracts/architecture_governance_and_versioning_contract.md
 * - Runtime execution: docs_zh/contracts/runtime_execution_contract.md
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { buildRuntimeVersionSnapshot, type RuntimeVersionSnapshot } from "../control-plane/incident-control/runtime-version-snapshot.js";
import { ExecutionDispatchService } from "../execution/dispatcher/execution-dispatch-service.js";
import { AuthoritativeTaskStore } from "../state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../state-evidence/truth/sqlite-database.js";
import { nowIso } from "../contracts/types/ids.js";
import { WorkerRegistryService } from "../execution/worker-pool/worker-registry-service.js";

export interface StableGrayReleaseRehearsalOptions {
  outputDir: string;
}

export interface StableGrayReleaseScenarioResult {
  scenarioId:
    | "gray_cohort_routes_only_to_canary_worker_group"
    | "gray_rollback_switch_restores_stable_routing";
  passed: boolean;
  durationMs: number;
  summary: string;
  details: Record<string, unknown>;
}

export const REQUIRED_STABLE_GRAY_RELEASE_TARGETS = [
  "feature_flag_bundle",
  "gray_target_registry",
  "canary_workers",
  "rollback_switches",
] as const;

export type StableGrayReleaseTargetId = (typeof REQUIRED_STABLE_GRAY_RELEASE_TARGETS)[number];

export interface StableGrayReleaseTarget {
  targetId: StableGrayReleaseTargetId;
  owner: string;
  currentVersion: string | null;
  targetVersion: string | null;
  rolloutGuardrails: string[];
  healthValidation: string[];
}

export interface StableGrayCohortDefinition {
  cohortId: string;
  cohortKind: "division" | "tenant_group";
  targetRef: string;
  queueAffinity: string | null;
  requiredRepoVersion: string | null;
  featureFlags: string[];
}

export interface StableGrayReleasePlaybook {
  generatedAt: string;
  rolloutOwner: string;
  reportPath: string;
  playbookPath: string;
  runtimeVersionSnapshot: RuntimeVersionSnapshot;
  grayTargetKind: "division_and_partner_ring";
  cohorts: StableGrayCohortDefinition[];
  featureFlagPlan: string[];
  canaryWorkerPolicy: string[];
  healthValidation: string[];
  rollbackSwitches: string[];
  auditRequirements: string[];
  scenarioEvidence: Array<{
    scenarioId: StableGrayReleaseScenarioResult["scenarioId"];
    passed: boolean;
    summary: string;
  }>;
  targets: StableGrayReleaseTarget[];
}

export interface StableGrayReleaseRehearsalReport {
  startedAt: string;
  finishedAt: string;
  outputDir: string;
  artifacts: {
    reportPath: string;
    playbookPath: string;
  };
  playbook: StableGrayReleasePlaybook;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  scenarios: StableGrayReleaseScenarioResult[];
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

async function measureScenario(
  scenarioId: StableGrayReleaseScenarioResult["scenarioId"],
  run: () => Promise<Omit<StableGrayReleaseScenarioResult, "scenarioId" | "durationMs">>,
): Promise<StableGrayReleaseScenarioResult> {
  const started = performance.now();
  const result = await run();
  return {
    scenarioId,
    durationMs: Math.round((performance.now() - started) * 100) / 100,
    ...result,
  };
}

function buildGrayReleaseRuntimeVersionSnapshot(outputDir: string): RuntimeVersionSnapshot {
  const dbPath = join(outputDir, "stable-gray-release-playbook.db");
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
  },
): void {
  const now = nowIso();
  db.transaction(() => {
    store.task.insertTask({
      id: input.taskId,
      parentId: null,
      rootId: input.taskId,
      divisionId: "general_ops",
      title: "Stable gray release rehearsal task",
      status: "in_progress",
      source: "system",
      priority: "high",
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
      agentId: "agent-gray-rehearsal",
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

export function buildStableGrayReleasePlaybook(input: {
  outputDir: string;
  reportPath: string;
  playbookPath: string;
  scenarios: StableGrayReleaseScenarioResult[];
}): StableGrayReleasePlaybook {
  const runtimeVersionSnapshot = buildGrayReleaseRuntimeVersionSnapshot(input.outputDir);
  const rolloutOwner = "release_manager_oncall";
  const targetVersion =
    runtimeVersionSnapshot.buildCommit
    ?? runtimeVersionSnapshot.applicationVersion
    ?? runtimeVersionSnapshot.configVersion;
  const previousVersion =
    runtimeVersionSnapshot.buildCommit != null
      ? `${runtimeVersionSnapshot.buildCommit}-previous`
      : runtimeVersionSnapshot.applicationVersion != null
        ? `${runtimeVersionSnapshot.applicationVersion}-previous`
        : `${runtimeVersionSnapshot.configVersion}-previous`;

  return {
    generatedAt: new Date().toISOString(),
    rolloutOwner,
    reportPath: input.reportPath,
    playbookPath: input.playbookPath,
    runtimeVersionSnapshot,
    grayTargetKind: "division_and_partner_ring",
    cohorts: [
      {
        cohortId: "tenant_gray_design_partners",
        cohortKind: "tenant_group",
        targetRef: "design_partners",
        queueAffinity: "tenant-gray-design-partners",
        requiredRepoVersion: targetVersion,
        featureFlags: ["release.gray.design_partners", "release.gray.rollback_switch"],
      },
      {
        cohortId: "division_gray_research",
        cohortKind: "division",
        targetRef: "research_ops",
        queueAffinity: "division-gray-research",
        requiredRepoVersion: targetVersion,
        featureFlags: ["release.gray.research_ops"],
      },
    ],
    featureFlagPlan: [
      "enable gray cohort feature flags only for the named tenant group or division ring",
      "bind gray cohorts to a dedicated queue affinity and explicit target repo version",
      "expand feature flags only after health validation and rollback switch verification pass",
    ],
    canaryWorkerPolicy: [
      "assign dedicated canary workers to gray queues before opening cohort traffic",
      "require canary workers to advertise the target repo version and compatible capability set",
      "keep general workers eligible for non-gray traffic while gray cohorts remain isolated",
    ],
    healthValidation: [
      "verify gray cohort dispatch traces always point at the intended canary worker group",
      "verify stable cohorts continue routing to the general worker pool during gray rollout",
      "confirm rollback switches can clear gray routing without leaving stale queue affinity behind",
      "capture runtime version snapshots and release gate evidence before widening traffic",
    ],
    rollbackSwitches: [
      "disable the gray cohort feature flags before draining canary workers",
      "clear explicit gray queue affinity and repo-version pinning when reverting to the stable pool",
      "drain canary workers at step boundaries before withdrawing them from service",
    ],
    auditRequirements: [
      "record the cohort definition, feature flag set, and queue affinity for every gray batch",
      "retain dispatch traces proving stable workers were excluded from gray-only traffic",
      "retain rollback evidence showing gray switches returned traffic to the stable pool",
      "archive the release package and gate artifacts alongside the gray rehearsal report",
    ],
    scenarioEvidence: input.scenarios.map((scenario) => ({
      scenarioId: scenario.scenarioId,
      passed: scenario.passed,
      summary: scenario.summary,
    })),
    targets: [
      {
        targetId: "feature_flag_bundle",
        owner: rolloutOwner,
        currentVersion: previousVersion,
        targetVersion,
        rolloutGuardrails: [
          "enable only named gray cohort flags before tenant expansion",
          "treat gray rollback switches as first-class kill switches",
        ],
        healthValidation: [
          "gray-only feature flags resolve to the intended partner ring",
          "stable cohorts remain on the previous release while gray is active",
        ],
      },
      {
        targetId: "gray_target_registry",
        owner: rolloutOwner,
        currentVersion: previousVersion,
        targetVersion,
        rolloutGuardrails: [
          "keep explicit tenant or division cohort definitions under change control",
          "do not widen the gray target list without a fresh package review",
        ],
        healthValidation: [
          "gray cohort membership is deterministic and auditable",
          "release batch records list every cohort and scope override",
        ],
      },
      {
        targetId: "canary_workers",
        owner: rolloutOwner,
        currentVersion: previousVersion,
        targetVersion,
        rolloutGuardrails: [
          "gray traffic routes only to canary workers that advertise the target repo version",
          "general workers remain eligible only for non-gray traffic during rollout",
        ],
        healthValidation: [
          "dispatch traces show queue affinity and repo-version gating working together",
          "canary workers can be drained cleanly when rollback switches are flipped",
        ],
      },
      {
        targetId: "rollback_switches",
        owner: rolloutOwner,
        currentVersion: previousVersion,
        targetVersion,
        rolloutGuardrails: [
          "rollback switches must clear gray routing before stable traffic is resumed",
          "rollback switches must not require schema downgrades or out-of-band edits",
        ],
        healthValidation: [
          "stable traffic can resume on the general worker pool immediately after rollback",
          "gray worker draining does not strand in-flight work after rollback",
        ],
      },
    ],
  };
}

async function runGrayCohortRoutingScenario(outputDir: string): Promise<StableGrayReleaseScenarioResult> {
  return measureScenario("gray_cohort_routes_only_to_canary_worker_group", async () => {
    const dbPath = join(outputDir, "gray-cohort-routing.db");
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });

    const targetRepoVersion = "repo-gray-2026-04-06";
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-gray-routing",
      executionId: "exec-gray-routing",
      traceId: "trace-gray-routing",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-gray-routing");

    workers.recordHeartbeat({
      workerId: "worker-general-stable",
      status: "idle",
      repoVersion: "repo-stable-2026-04-01",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-06T09:00:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-gray-old-version",
      status: "idle",
      repoVersion: "repo-stable-2026-04-01",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "tenant-gray-design-partners",
      occurredAt: "2026-04-06T09:00:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-gray-canary",
      status: "idle",
      repoVersion: targetRepoVersion,
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "tenant-gray-design-partners",
      occurredAt: "2026-04-06T09:00:00.000Z",
    });

    dispatch.createTicket({
      executionId: "exec-gray-routing",
      queueName: "tenant-gray-design-partners",
      requiredCapabilities: ["bash"],
      requiredRepoVersion: targetRepoVersion,
      occurredAt: "2026-04-06T09:00:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "tenant-gray-design-partners",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-06T09:00:06.000Z",
    });
    db.close();

    const generalRejected = decision.trace?.evaluations.some(
      (evaluation) =>
        evaluation.workerId === "worker-general-stable" && evaluation.rejectionReason === "queue_affinity_mismatch",
    ) ?? false;
    const oldGrayRejected = decision.trace?.evaluations.some(
      (evaluation) =>
        evaluation.workerId === "worker-gray-old-version" && evaluation.rejectionReason === "worker_repo_version_mismatch",
    ) ?? false;
    const selectedGrayCanary = decision.worker?.workerId === "worker-gray-canary";
    const passed = decision.outcome === "dispatched" && selectedGrayCanary && generalRejected && oldGrayRejected;

    return {
      passed,
      summary: "gray cohort traffic routes only to the dedicated canary worker group and excludes stale workers",
      details: {
        selectedWorkerId: decision.worker?.workerId ?? null,
        reasonCode: decision.reasonCode,
        evaluations:
          decision.trace?.evaluations.map((evaluation) => ({
            workerId: evaluation.workerId,
            accepted: evaluation.accepted,
            rejectionReason: evaluation.rejectionReason,
          })) ?? [],
      },
    };
  });
}

async function runGrayRollbackScenario(outputDir: string): Promise<StableGrayReleaseScenarioResult> {
  return measureScenario("gray_rollback_switch_restores_stable_routing", async () => {
    const dbPath = join(outputDir, "gray-rollback-switch.db");
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });

    const targetRepoVersion = "repo-gray-2026-04-06";
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-gray-before-rollback",
      executionId: "exec-gray-before-rollback",
      traceId: "trace-gray-before-rollback",
    });
    seedTaskAndExecution(db, store, {
      taskId: "task-gray-after-rollback",
      executionId: "exec-gray-after-rollback",
      traceId: "trace-gray-after-rollback",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-gray-before-rollback");
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-gray-after-rollback");

    workers.recordHeartbeat({
      workerId: "worker-stable-pool",
      status: "idle",
      repoVersion: "repo-stable-2026-04-01",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: null,
      occurredAt: "2026-04-06T10:00:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-gray-pool",
      status: "idle",
      repoVersion: targetRepoVersion,
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "tenant-gray-design-partners",
      occurredAt: "2026-04-06T10:00:00.000Z",
    });

    dispatch.createTicket({
      executionId: "exec-gray-before-rollback",
      queueName: "tenant-gray-design-partners",
      requiredCapabilities: ["bash"],
      requiredRepoVersion: targetRepoVersion,
      occurredAt: "2026-04-06T10:00:05.000Z",
    });
    const beforeRollback = dispatch.dispatchNext({
      queueName: "tenant-gray-design-partners",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-06T10:00:06.000Z",
    });

    workers.recordHeartbeat({
      workerId: "worker-gray-pool",
      status: "draining",
      repoVersion: targetRepoVersion,
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "tenant-gray-design-partners",
      occurredAt: "2026-04-06T10:01:00.000Z",
    });

    dispatch.createTicket({
      executionId: "exec-gray-after-rollback",
      queueName: null,
      requiredCapabilities: ["bash"],
      requiredRepoVersion: null,
      occurredAt: "2026-04-06T10:01:05.000Z",
    });
    const afterRollback = dispatch.dispatchNext({
      queueName: null,
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-06T10:01:06.000Z",
    });
    db.close();

    const drainingRejected = afterRollback.trace?.evaluations.some(
      (evaluation) => evaluation.workerId === "worker-gray-pool" && evaluation.rejectionReason === "worker_draining",
    ) ?? false;
    const passed =
      beforeRollback.worker?.workerId === "worker-gray-pool"
      && afterRollback.worker?.workerId === "worker-stable-pool"
      && drainingRejected;

    return {
      passed,
      summary: "gray rollback switches restore stable routing and drain the gray worker pool without widening blast radius",
      details: {
        beforeRollbackWorkerId: beforeRollback.worker?.workerId ?? null,
        afterRollbackWorkerId: afterRollback.worker?.workerId ?? null,
        afterRollbackReasonCode: afterRollback.reasonCode,
        afterRollbackEvaluations:
          afterRollback.trace?.evaluations.map((evaluation) => ({
            workerId: evaluation.workerId,
            accepted: evaluation.accepted,
            rejectionReason: evaluation.rejectionReason,
          })) ?? [],
      },
    };
  });
}

export async function runStableGrayReleaseRehearsal(
  options: StableGrayReleaseRehearsalOptions,
): Promise<StableGrayReleaseRehearsalReport> {
  mkdirSync(options.outputDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const reportPath = join(options.outputDir, "stable-gray-release-report.json");
  const playbookPath = join(options.outputDir, "stable-gray-release-playbook.json");
  const scenarios = await Promise.all([
    runGrayCohortRoutingScenario(options.outputDir),
    runGrayRollbackScenario(options.outputDir),
  ]);
  const playbook = buildStableGrayReleasePlaybook({
    outputDir: options.outputDir,
    reportPath,
    playbookPath,
    scenarios,
  });
  writeJson(playbookPath, playbook);

  const report: StableGrayReleaseRehearsalReport = {
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

export function writeStableGrayReleaseRehearsalReport(
  outputFile: string,
  report: StableGrayReleaseRehearsalReport,
): void {
  writeJson(outputFile, report);
}
