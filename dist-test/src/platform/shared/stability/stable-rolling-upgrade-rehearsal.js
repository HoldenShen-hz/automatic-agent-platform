/**
 * Stable rolling upgrade rehearsal: validates repo-version-aware dispatch and step-boundary handover.
 *
 * @documentation
 * - Architecture: docs_zh/architecture/00-platform-architecture.md
 * - Version governance: docs_zh/contracts/architecture_governance_and_versioning_contract.md
 * - Runtime execution: docs_zh/contracts/runtime_execution_contract.md
 * - Lease and fencing: docs_zh/contracts/task_lease_and_fencing_contract.md
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildRuntimeVersionSnapshot } from "../../control-plane/incident-control/runtime-version-snapshot.js";
import { ExecutionDispatchService } from "../../execution/dispatcher/execution-dispatch-service.js";
import { ExecutionLeaseService } from "../../execution/lease/execution-lease-service.js";
import { WorkerRegistryService } from "../../execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../state-evidence/truth/sqlite-database.js";
import { nowIso } from "../../contracts/types/ids.js";
export const REQUIRED_STABLE_ROLLING_UPGRADE_TARGETS = [
    "coordinator_release",
    "worker_pool",
    "active_leases",
    "dispatch_policy",
];
function writeJson(path, value) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(value, null, 2));
}
async function measureScenario(scenarioId, run) {
    const started = performance.now();
    const result = await run();
    return {
        scenarioId,
        durationMs: Math.round((performance.now() - started) * 100) / 100,
        ...result,
    };
}
function buildRollingUpgradeRuntimeVersionSnapshot(outputDir) {
    const dbPath = join(outputDir, "stable-rolling-upgrade-playbook.db");
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
function seedTaskAndExecution(db, store, input) {
    const now = nowIso();
    db.transaction(() => {
        store.task.insertTask({
            id: input.taskId,
            parentId: null,
            rootId: input.taskId,
            divisionId: "general_ops",
            title: "Stable rolling upgrade rehearsal task",
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
            agentId: "agent-upgrade-rehearsal",
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
export function buildStableRollingUpgradePlaybook(input) {
    const runtimeVersionSnapshot = buildRollingUpgradeRuntimeVersionSnapshot(input.outputDir);
    const upgradeOwner = "release_manager_oncall";
    const targetVersion = runtimeVersionSnapshot.buildCommit
        ?? runtimeVersionSnapshot.applicationVersion
        ?? runtimeVersionSnapshot.configVersion;
    const previousVersion = runtimeVersionSnapshot.buildCommit != null
        ? `${runtimeVersionSnapshot.buildCommit}-previous`
        : runtimeVersionSnapshot.applicationVersion != null
            ? `${runtimeVersionSnapshot.applicationVersion}-previous`
            : `${runtimeVersionSnapshot.configVersion}-previous`;
    return {
        generatedAt: new Date().toISOString(),
        upgradeOwner,
        reportPath: input.reportPath,
        playbookPath: input.playbookPath,
        runtimeVersionSnapshot,
        compatibilityWindow: "allow N/N-1 worker repo versions during canary rollout; require explicit repo-version routing before promotion",
        canaryStrategy: [
            "upgrade one canary worker to the target repo version before broadening rollout",
            "dispatch explicitly version-pinned canary tickets to upgraded workers only",
            "mark old-version workers draining before transferring in-flight executions at step boundaries",
        ],
        prechecks: [
            "confirm current schema version is up to date and no incompatible migration is pending",
            "confirm repo-version-aware dispatch gating is enabled for upgraded workloads",
            "capture the current application, build, config, and prompt bundle version snapshot",
            "confirm replacement workers are healthy before draining older workers",
        ],
        rolloutProcedure: [
            "upgrade a canary worker to the target repo version and verify pinned dispatch selects it",
            "move older workers into draining mode before any in-flight lease transfer",
            "handover active executions only at step boundaries using controlled lease lineage",
            "promote repo-version requirements from canary to the wider worker pool after health validation passes",
        ],
        healthValidation: [
            "confirm repo-version-pinned dispatch rejects stale workers and selects upgraded workers",
            "confirm controlled lease handover increments fencing tokens and preserves lineage",
            "confirm no active execution remains attached to a drained worker after handover completes",
            "confirm doctor and runtime health remain non-degraded after the staged upgrade",
        ],
        rollbackTriggers: [
            "repo-version-pinned dispatch cannot find a healthy upgraded worker",
            "controlled handover fails or leaves in-flight work attached to a draining worker",
            "schema, config, or remote session readiness diverges during rollout",
        ],
        auditRequirements: [
            "record rollout batch id, source version, target version, and operator identity",
            "persist the rolling upgrade report and playbook artifacts",
            "retain dispatch traces proving old-version workers were rejected during version-pinned canary routing",
            "retain lease handover evidence showing previous worker, new worker, and fencing token lineage",
        ],
        scenarioEvidence: input.scenarios.map((scenario) => ({
            scenarioId: scenario.scenarioId,
            passed: scenario.passed,
            summary: scenario.summary,
        })),
        targets: [
            {
                targetId: "coordinator_release",
                owner: upgradeOwner,
                currentVersion: previousVersion,
                targetVersion,
                rolloutGuardrails: [
                    "promote the coordinator only after canary worker routing passes",
                    "keep rollback-ready release evidence available throughout the rollout window",
                ],
                healthValidation: [
                    "dispatch traces show target-version workers receive pinned canary tickets",
                    "runtime version snapshot stays internally consistent after promotion",
                ],
            },
            {
                targetId: "worker_pool",
                owner: upgradeOwner,
                currentVersion: previousVersion,
                targetVersion,
                rolloutGuardrails: [
                    "upgrade workers gradually and keep older workers draining instead of hard-stopping them",
                    "do not expand rollout while worker health or remote session readiness is degraded",
                ],
                healthValidation: [
                    "worker heartbeats report the intended repo version after each batch",
                    "draining workers stop receiving new dispatch assignments",
                ],
            },
            {
                targetId: "active_leases",
                owner: "runtime_reliability_oncall",
                currentVersion: previousVersion,
                targetVersion,
                rolloutGuardrails: [
                    "transfer in-flight executions only through controlled lease handover",
                    "preserve fencing-token monotonicity during every step-boundary transfer",
                ],
                healthValidation: [
                    "handover events retain previous worker, new worker, and fencing lineage",
                    "previous workers no longer list the handed-over execution as running",
                ],
            },
            {
                targetId: "dispatch_policy",
                owner: "runtime_reliability_oncall",
                currentVersion: previousVersion,
                targetVersion,
                rolloutGuardrails: [
                    "use explicit required repo version routing during canary and staged expansion",
                    "block promotion if old-version workers are still eligible for target-version-only work",
                ],
                healthValidation: [
                    "dispatch traces show old-version workers rejected with repo-version mismatch",
                    "selected workers match the required repo version for pinned tickets",
                ],
            },
        ],
    };
}
async function runRepoVersionCanaryScenario(outputDir) {
    return measureScenario("repo_version_canary_routes_to_upgraded_worker", async () => {
        const dbPath = join(outputDir, "rolling-upgrade-canary.db");
        rmSync(dbPath, { force: true });
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const registry = new WorkerRegistryService(store);
        const dispatch = new ExecutionDispatchService(db, store);
        const requiredRepoVersion = "repo-2026-04-06";
        const previousRepoVersion = "repo-2026-04-05";
        seedTaskAndExecution(db, store, {
            taskId: "task-upgrade-canary",
            executionId: "exec-upgrade-canary",
            traceId: "trace-upgrade-canary",
            priority: "urgent",
        });
        registry.recordHeartbeat({
            workerId: "worker-old-version",
            status: "idle",
            repoVersion: previousRepoVersion,
            capabilities: ["bash"],
            runningExecutionIds: [],
            maxConcurrency: 1,
            queueAffinity: "default",
            occurredAt: "2026-04-06T10:00:00.000Z",
        });
        registry.recordHeartbeat({
            workerId: "worker-new-version",
            status: "idle",
            repoVersion: requiredRepoVersion,
            capabilities: ["bash"],
            runningExecutionIds: [],
            maxConcurrency: 1,
            queueAffinity: "default",
            occurredAt: "2026-04-06T10:00:00.000Z",
        });
        const ticket = dispatch.createTicket({
            executionId: "exec-upgrade-canary",
            priority: "urgent",
            queueName: "default",
            requiredCapabilities: ["bash"],
            requiredRepoVersion,
            occurredAt: "2026-04-06T10:00:01.000Z",
        });
        const decision = dispatch.dispatchNext({
            queueName: "default",
            leaseTtlMs: 30_000,
            occurredAt: "2026-04-06T10:00:02.000Z",
        });
        db.close();
        return {
            passed: ticket.outcome === "created"
                && decision.outcome === "dispatched"
                && decision.worker?.workerId === "worker-new-version"
                && decision.worker.repoVersion === requiredRepoVersion
                && decision.trace?.evaluations.some((evaluation) => evaluation.workerId === "worker-old-version"
                    && evaluation.accepted === false
                    && evaluation.rejectionReason === "worker_repo_version_mismatch") === true,
            summary: "repo-version-pinned canary dispatch prefers upgraded workers and rejects stale worker versions",
            details: {
                ticket,
                decision,
            },
        };
    });
}
async function runStepBoundaryHandoverScenario(outputDir) {
    return measureScenario("lease_handover_supports_step_boundary_upgrade", async () => {
        const dbPath = join(outputDir, "rolling-upgrade-handover.db");
        rmSync(dbPath, { force: true });
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const registry = new WorkerRegistryService(store);
        const leases = new ExecutionLeaseService(db, store);
        const targetRepoVersion = "repo-2026-04-06";
        seedTaskAndExecution(db, store, {
            taskId: "task-upgrade-handover",
            executionId: "exec-upgrade-handover",
            traceId: "trace-upgrade-handover",
            priority: "high",
        });
        registry.recordHeartbeat({
            workerId: "worker-upgrade-source",
            status: "draining",
            repoVersion: "repo-2026-04-05",
            capabilities: ["bash"],
            runningExecutionIds: ["exec-upgrade-handover"],
            maxConcurrency: 1,
            queueAffinity: "default",
            currentStepId: "draft_response",
            lastProgressAt: "2026-04-06T10:00:05.000Z",
            occurredAt: "2026-04-06T10:00:05.000Z",
        });
        registry.recordHeartbeat({
            workerId: "worker-upgrade-target",
            status: "idle",
            repoVersion: targetRepoVersion,
            capabilities: ["bash"],
            runningExecutionIds: [],
            maxConcurrency: 1,
            queueAffinity: "default",
            occurredAt: "2026-04-06T10:00:05.000Z",
        });
        const granted = leases.acquireLease({
            executionId: "exec-upgrade-handover",
            workerId: "worker-upgrade-source",
            ttlMs: 30_000,
            queueName: "default",
            occurredAt: "2026-04-06T10:00:05.000Z",
        });
        const handover = leases.handoverLease({
            leaseId: granted.lease?.id ?? "",
            workerId: "worker-upgrade-source",
            newWorkerId: "worker-upgrade-target",
            ttlMs: 30_000,
            reasonCode: "rolling_upgrade_step_boundary_handover",
            occurredAt: "2026-04-06T10:00:15.000Z",
        });
        const audits = store.lease.listLeaseAudits("exec-upgrade-handover");
        const events = store.event.listEventsForTask("task-upgrade-handover");
        const previousWorker = store.worker.getWorkerSnapshot("worker-upgrade-source");
        const nextWorker = store.worker.getWorkerSnapshot("worker-upgrade-target");
        db.close();
        return {
            passed: granted.outcome === "granted"
                && handover.outcome === "handed_over"
                && handover.previousLease?.status === "released"
                && handover.previousLease?.reasonCode === "rolling_upgrade_step_boundary_handover"
                && handover.lease?.workerId === "worker-upgrade-target"
                && handover.lease?.fencingToken === 2
                && previousWorker?.runningExecutionsJson === "[]"
                && (nextWorker?.runningExecutionsJson.includes("exec-upgrade-handover") ?? false)
                && audits.some((audit) => audit.eventType === "lease_handover")
                && events.some((event) => event.eventType === "lease:handover_recorded"),
            summary: "step-boundary rolling upgrades can hand over active leases without losing lineage",
            details: {
                granted,
                handover,
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
export async function runStableRollingUpgradeRehearsal(options) {
    mkdirSync(options.outputDir, { recursive: true });
    const startedAt = new Date().toISOString();
    const reportPath = join(options.outputDir, "stable-rolling-upgrade-report.json");
    const playbookPath = join(options.outputDir, "stable-rolling-upgrade-playbook.json");
    const scenarios = [
        await runRepoVersionCanaryScenario(options.outputDir),
        await runStepBoundaryHandoverScenario(options.outputDir),
    ];
    const playbook = buildStableRollingUpgradePlaybook({
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
export function writeStableRollingUpgradeRehearsalReport(outputFile, report) {
    writeJson(outputFile, report);
}
//# sourceMappingURL=stable-rolling-upgrade-rehearsal.js.map