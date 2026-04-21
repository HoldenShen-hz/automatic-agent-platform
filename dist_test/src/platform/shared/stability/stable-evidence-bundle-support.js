/**
 * Stable Evidence Bundle
 *
 * Orchestrates comprehensive stability testing by running multiple rehearsal scenarios
 * and aggregating results into a single evidence bundle. This is the top-level
 * entry point for generating system stability evidence.
 *
 * The bundle runs these rehearsals in sequence:
 * - Chaos smoke tests: Fault injection scenarios
 * - Prompt injection red-team: Security testing
 * - Concurrency rehearsal: Locking and race conditions
 * - Lease rehearsal: Lease lifecycle and fencing
 * - Rollback rehearsal: Runtime repair and manual takeover
 * - Backup/restore rehearsal: Disaster recovery
 * - Rolling upgrade rehearsal: Version-aware dispatch
 * - Maintenance rehearsal: Graceful drain and handover
 * - Gray release rehearsal: Tenant cohort routing
 * - Event replay rehearsal: Failed consumer ack recovery
 * - DB/queue disconnect rehearsal: Fail-closed behavior
 * - DB writability rehearsal: Read-only admission control
 * - Queue delivery rehearsal: Queue replay and deduplication
 * - Migration compatibility rehearsal: PostgreSQL portability
 * - Validation: Golden task execution with integrity checks
 * - Soak: Long-duration execution with continuous validation
 *
 * After all rehearsals, it also:
 * - Runs doctor health checks
 * - Performs startup consistency repairs
 * - Generates diagnostic snapshots
 * - Executes a full human takeover workflow sample
 * - Drains event consumers and verifies backlog clearance
 *
 * @see stable-release-gate.ts for the gate that evaluates bundle results
 * @see docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md for chaos testing
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { InspectService } from "../observability/inspect-service.js";
import { HumanTakeoverService } from "../../control-plane/incident-control/human-takeover-service.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
/**
 * Predefined evidence collection profiles.
 * Each profile balances test thoroughness against execution time.
 */
export const STABLE_EVIDENCE_PROFILES = {
    /** Quick smoke test: 2 validations, 5 second soak */
    smoke: {
        name: "smoke",
        validationIterations: 2,
        soakDurationMs: 5_000,
        soakIntervalMs: 500,
        soakIterationsPerCycle: 1,
    },
    /** Full day soak test: 5 validations, 24 hour soak */
    "24h": {
        name: "24h",
        validationIterations: 5,
        soakDurationMs: 24 * 60 * 60 * 1000,
        soakIntervalMs: 5 * 60 * 1000,
        soakIterationsPerCycle: 3,
    },
    /** Extended stress test: 8 validations, 72 hour soak */
    "72h": {
        name: "72h",
        validationIterations: 8,
        soakDurationMs: 72 * 60 * 60 * 1000,
        soakIntervalMs: 10 * 60 * 1000,
        soakIterationsPerCycle: 3,
    },
};
/** Writes a value as formatted JSON to a file, creating parent directories as needed */
export function writeJson(path, value) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(value, null, 2));
}
/**
 * Resolves a stable evidence profile by name, with optional overrides.
 * Merges the base profile with any provided overrides.
 */
export function resolveStableEvidenceProfile(profileName = "smoke", overrides = {}) {
    const base = STABLE_EVIDENCE_PROFILES[profileName];
    return {
        ...base,
        ...overrides,
    };
}
/**
 * Creates a minimal task, execution, and session in the database
 * to serve as the basis for a human takeover evidence scenario.
 */
export function seedTakeoverEvidenceScenario(db, store) {
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    db.transaction(() => {
        store.task.insertTask({
            id: taskId,
            parentId: null,
            rootId: taskId,
            divisionId: "general_ops",
            title: "Stable evidence takeover sample",
            status: "in_progress",
            source: "system",
            priority: "normal",
            inputJson: JSON.stringify({ request: "Prepare manual takeover evidence." }),
            normalizedInputJson: JSON.stringify({ request: "Prepare manual takeover evidence." }),
            outputJson: null,
            estimatedCostUsd: 0,
            actualCostUsd: 0,
            errorCode: null,
            createdAt: now,
            updatedAt: now,
            completedAt: null,
        });
        store.workflow.insertWorkflowState({
            taskId,
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
            id: executionId,
            taskId,
            workflowId: "single_agent_minimal",
            parentExecutionId: null,
            agentId: "agent_general_executor",
            roleId: "general_executor",
            runKind: "task_run",
            status: "executing",
            inputRef: null,
            traceId,
            attempt: 1,
            timeoutMs: 1_000,
            budgetUsdLimit: 1,
            requiresApproval: 0,
            sandboxMode: "workspace_write",
            allowedToolsJson: JSON.stringify(["analysis"]),
            allowedPathsJson: JSON.stringify([]),
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
            id: sessionId,
            taskId,
            channel: "cli",
            status: "open",
            externalSessionId: null,
            createdAt: now,
            updatedAt: now,
        });
    });
    return {
        taskId,
        executionId,
        sessionId,
    };
}
/**
 * Builds a complete human takeover evidence sample by executing
 * a full takeover workflow.
 */
export function buildTakeoverEvidenceSample(db, store, logger) {
    const scenario = seedTakeoverEvidenceScenario(db, store);
    const takeover = new HumanTakeoverService(db, store);
    const inspect = new InspectService(store);
    // Open takeover session
    const opened = takeover.openSession({
        taskId: scenario.taskId,
        operatorId: "operator-stable-evidence",
        reasonCode: "stable_evidence.takeover_open",
    });
    // Modify task input
    takeover.modifyInput({
        takeoverSessionId: opened.takeoverSessionId,
        inputJson: JSON.stringify({ request: "Manually adjusted evidence request." }),
        reasonCode: "stable_evidence.modify_input",
    });
    // Switch to manual worker
    takeover.switchWorker({
        takeoverSessionId: opened.takeoverSessionId,
        agentId: "agent_manual_override",
        reasonCode: "stable_evidence.switch_worker",
    });
    // Complete the task
    takeover.completeTask({
        takeoverSessionId: opened.takeoverSessionId,
        terminalStatus: "done",
        reasonCode: "stable_evidence.complete_task",
        outputJson: JSON.stringify({
            summary: "Manual takeover closed the task successfully.",
            result: "Stable evidence bundle recorded a full takeover closure.",
        }),
    });
    const executionTraceId = store.dispatch.getExecution(scenario.executionId)?.traceId;
    logger.log({
        level: "info",
        message: "stable evidence takeover sample completed",
        taskId: scenario.taskId,
        ...(executionTraceId ? { traceId: executionTraceId } : {}),
    });
    const snapshot = inspect.getTaskInspectView(scenario.taskId);
    return {
        taskId: scenario.taskId,
        takeoverSessionId: opened.takeoverSessionId,
        executionId: snapshot.execution?.id ?? null,
        finalTaskStatus: snapshot.task.status,
        finalExecutionStatus: snapshot.execution?.status ?? null,
        finalSessionStatus: snapshot.session?.status ?? null,
        operatorActionCount: snapshot.operatorActions.length,
    };
}
/**
 * Creates a comprehensive stable evidence bundle by running all stability
 * rehearsals and aggregating results into a single report.
 *
 * @param options - Bundle creation options including output directory and profile
 * @returns Complete evidence bundle report with all test results and artifact paths
 */
//# sourceMappingURL=stable-evidence-bundle-support.js.map