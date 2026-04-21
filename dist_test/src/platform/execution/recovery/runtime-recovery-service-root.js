/**
 * Runtime Recovery Service
 *
 * ## Overview
 *
 * Provides read-only recovery analysis and diagnostic capabilities for tasks and executions
 * that have stalled, failed, or require intervention.
 *
 * ## Important
 *
 * This service only ANalyzes and recommends - it does NOT apply recovery actions.
 * Actual recovery execution is handled by:
 * - RuntimeRepairService: Applies repair actions from startup consistency checker
 * - RuntimeRecoveryDecisionService: Decides and applies recovery for dead-letter scenarios
 *
 * ## Key Concepts
 *
 * - **Dead Letter**: Record for failures that cannot auto-recover or should not retry
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: dead-letter}
 *
 * - **Checkpoint**: State snapshot at recoverable boundary
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: checkpoint}
 *
 * - **Partial Result**:阶段性结果可保留可审计
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: partial result}
 *
 * - **Compensation**: 回滚对账或人工修复
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: compensation}
 *
 * ## Recovery Suggested Actions
 *
 * - resume_same_worker: Resume on original worker if available
 * - retry_new_ticket: Cancel and create new ticket for retry
 * - escalate_takeover: Requires human operator intervention
 * - move_dead_letter: Move to DLQ for manual inspection
 * - cancel: Permanently cancel execution
 * - none: No recovery possible
 *
 * @see Runtime Recovery Contract: docs_zh/contracts/runtime_recovery_contract.md
 * @see Startup Consistency Contract: docs_zh/contracts/startup_consistency_and_recovery_drill_contract.md
 * @see Glossary: docs_zh/governance/glossary_and_terminology.md
 */
import { nowIso } from "../../contracts/types/ids.js";
import { readWorkflowStepCheckpoint, summarizeWorkflowStepCheckpoint, } from "../../state-evidence/checkpoints/workflow-step-checkpoint.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { StorageError } from "../../contracts/errors.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
/**
 * Main service for runtime recovery analysis. Provides methods to
 * identify recoverable executions, build diagnostic views, and
 * generate recovery overviews by division.
 *
 * This service is read-only - it queries the store for recovery
 * candidates and builds analysis views but does not modify state.
 * State modifications are performed by RuntimeRepairService.
 */
export class RuntimeRecoveryService {
    store;
    /**
     * Creates a new RuntimeRecoveryService instance.
     * @param store - The AuthoritativeTaskStore used for querying execution and task data
     */
    constructor(store) {
        this.store = store;
    }
    /**
     * Lists all executions that are currently in an active state (executing,
     * prechecking, or created) but may need recovery attention. These are
     * executions that appear to be running but have no recent heartbeat
     * or show signs of being stuck.
     *
     * @param now - Current timestamp for staleness calculation (defaults to now)
     * @returns Array of recovery candidates that are in active execution states
     */
    listRecoverableExecutingRuns(now = nowIso(), tenantId) {
        return this.store.operations.listRecoverableExecutingRuns(now, tenantId).map((record) => toCandidate(record, "active_execution"));
    }
    /**
     * Lists executions that are blocked because they are waiting for
     * human approval. These executions cannot proceed until an operator
     * approves the requested action.
     *
     * @returns Array of recovery candidates blocked on approval
     */
    listBlockedRunsAwaitingApproval(tenantId) {
        return this.store
            .listBlockedRunsAwaitingApproval(tenantId)
            .map((record) => toCandidate(record, "approval_pending"));
    }
    /**
     * Lists executions that are considered stale - they have not shown
     * progress (no heartbeat) within the specified threshold time.
     * Stale executions may have been abandoned by workers and are
     * candidates for retry with a new ticket.
     *
     * @param staleBefore - Timestamp threshold; executions not updated after this are stale
     * @returns Array of stale recovery candidates
     */
    listStaleRuns(staleBefore, tenantId) {
        return this.store.operations.listStaleRuns(staleBefore, tenantId).map((record) => toCandidate(record, "stale_execution"));
    }
    /**
     * Builds a comprehensive recovery view for a specific task,
     * including all its execution candidates, pending approvals,
     * dead letters, and recent recovery events.
     *
     * This is the primary method for diagnosing task-level recovery
     * scenarios as it provides the complete picture.
     *
     * @param taskId - The task to build recovery view for
     * @returns Complete recovery view including candidates, approvals, and events
     * @throws Error if task is not found
     */
    buildRuntimeRecoveryView(taskId, tenantId) {
        const task = this.store.task.getTask(taskId, tenantId);
        if (!task) {
            throw new StorageError("storage.task_not_found", `Task not found: ${taskId}`, {
                details: { taskId },
                taskId,
            });
        }
        const taskEvents = this.store.event.listEventsForTask(taskId, tenantId);
        return {
            taskId,
            divisionId: task.divisionId,
            candidates: this.store.operations.buildRuntimeRecoveryView(taskId, tenantId).map((record) => toCandidate(record, inferReason(record))),
            requestedApprovals: this.store.approval.listApprovalsByTask(taskId, tenantId).filter((approval) => approval.status === "requested"),
            deadLetters: this.store.dispatch.listDeadLettersByTask(taskId, tenantId),
            latestCheckpoint: findLatestCheckpoint(this.store.artifact.listArtifactsByTask(taskId, tenantId)),
            recentRecoveryEvents: taskEvents
                .filter((event) => event.eventType.startsWith("recovery:"))
                .slice(-10)
                .map((event) => toRecoveryEvent(event)),
        };
    }
    /**
     * Generates recovery overviews for all divisions, showing aggregate
     * counts of different recovery scenarios. This is useful for
     * operational dashboards and monitoring.
     *
     * The overview groups candidates by division and calculates:
     * - Active candidates (may need resume)
     * - Blocked on approval
     * - Stale (abandoned by worker)
     *
     * @param staleBefore - Timestamp threshold for staleness calculation
     * @param now - Current timestamp (defaults to far future to include all)
     * @returns Array of division overviews sorted by division ID
     */
    listDivisionRecoveryOverview(staleBefore, now = "9999-12-31T23:59:59.999Z", tenantId) {
        const active = this.listRecoverableExecutingRuns(now, tenantId);
        const stale = new Set(this.listStaleRuns(staleBefore, tenantId).map((candidate) => candidate.executionId));
        const blocked = new Set(this.listBlockedRunsAwaitingApproval(tenantId).map((candidate) => candidate.executionId));
        const divisions = new Map();
        for (const candidate of active) {
            // Use "unassigned" for null division IDs to group them together
            const divisionId = candidate.divisionId ?? "unassigned";
            const current = divisions.get(divisionId) ?? {
                divisionId,
                taskIds: [],
                activeCandidateCount: 0,
                blockedApprovalCount: 0,
                staleExecutionCount: 0,
                newestCandidateAt: null,
            };
            current.activeCandidateCount += 1;
            // Track unique task IDs per division
            if (!current.taskIds.includes(candidate.taskId)) {
                current.taskIds.push(candidate.taskId);
            }
            // Check if this candidate is also in the stale set
            if (blocked.has(candidate.executionId)) {
                current.blockedApprovalCount += 1;
            }
            // Check if this candidate is in the stale set
            if (stale.has(candidate.executionId)) {
                current.staleExecutionCount += 1;
            }
            // Track the newest candidate timestamp for age monitoring
            current.newestCandidateAt =
                current.newestCandidateAt == null || current.newestCandidateAt < candidate.updatedAt
                    ? candidate.updatedAt
                    : current.newestCandidateAt;
            divisions.set(divisionId, current);
        }
        // Sort by division ID for consistent ordering
        return [...divisions.values()].sort((left, right) => left.divisionId.localeCompare(right.divisionId));
    }
}
/**
 * Determines the human-readable reason why an execution needs recovery.
 * Analyzes the execution record's state to identify the root cause.
 *
 * @param record - The runtime recovery record to analyze
 * @returns A reason string describing why recovery is needed
 */
function inferReason(record) {
    // Check if blocked waiting for human approval
    if (record.pendingApprovalId) {
        return "approval_pending";
    }
    // Check if precheck was denied (budget, timeout, tools, paths issue)
    if (record.latestPrecheck && !record.latestPrecheck.allowed) {
        return `precheck_denied:${record.latestPrecheck.reasonCode ?? "unknown"}`;
    }
    // Check if blocked without pending approval (inconsistent state)
    if (record.status === "blocked") {
        return "blocked_without_approval";
    }
    // Check for execution errors
    if (record.latestErrorCode) {
        return `execution_error:${record.latestErrorCode}`;
    }
    // Default: execution appears active (might just need monitoring)
    return "active_execution";
}
/**
 * Converts a raw RuntimeRecoveryRecord from the store into a
 * RuntimeRecoveryCandidate with typed precheck data and inferred reason.
 *
 * @param record - Raw record from the database
 * @param reason - Pre-computed reason string
 * @returns Typed recovery candidate interface
 */
function toCandidate(record, reason) {
    return {
        executionId: record.executionId,
        taskId: record.taskId,
        divisionId: record.divisionId,
        taskStatus: record.taskStatus,
        status: record.status,
        attempt: record.attempt,
        traceId: record.traceId,
        workflowId: record.workflowId,
        latestErrorCode: record.latestErrorCode,
        updatedAt: record.updatedAt,
        lastHeartbeatAt: record.lastHeartbeatAt,
        pendingApprovalId: record.pendingApprovalId,
        latestPrecheck: record.latestPrecheck == null
            ? null
            : {
                // Convert numeric 1/0 to boolean for allowed field
                allowed: record.latestPrecheck.allowed === 1,
                reasonCode: record.latestPrecheck.reasonCode,
                resolvedBudgetUsd: record.latestPrecheck.resolvedBudgetUsd,
                resolvedTimeoutMs: record.latestPrecheck.resolvedTimeoutMs,
                resolvedSandboxMode: record.latestPrecheck.resolvedSandboxMode,
                // Parse JSON string arrays for tools and paths
                resolvedTools: safeParseStringArray(record.latestPrecheck.resolvedToolsJson),
                resolvedPaths: safeParseStringArray(record.latestPrecheck.resolvedPathsJson),
                checkedAt: record.latestPrecheck.checkedAt,
            },
        reason,
        suggestedAction: inferSuggestedAction(record, reason),
    };
}
/**
 * Determines the appropriate recovery action based on the reason
 * and execution state. Maps failure modes to recovery strategies.
 *
 * @param record - The runtime recovery record
 * @param reason - The inferred reason string
 * @returns The suggested recovery action
 */
function inferSuggestedAction(record, reason) {
    // Approval blocked or inconsistent blocked state requires escalation
    if (reason === "approval_pending" || reason === "blocked_without_approval") {
        return "escalate_takeover";
    }
    // Stale executions should be retried with a new ticket
    if (reason === "stale_execution") {
        return "retry_new_ticket";
    }
    // Precheck denials cannot be automatically recovered
    if (reason.startsWith("precheck_denied:")) {
        return "cancel";
    }
    // Execution errors after multiple attempts go to dead letter
    if (reason.startsWith("execution_error:") && record.attempt >= 2) {
        return "move_dead_letter";
    }
    // Active statuses can potentially be resumed
    if (record.status === "executing" || record.status === "prechecking" || record.status === "created") {
        return "resume_same_worker";
    }
    // Default: no action recommended
    return "none";
}
/**
 * Converts an EventRecord to the simplified recovery event format
 * used in TaskRuntimeRecoveryView.
 *
 * @param event - Raw event record from database
 * @returns Simplified recovery event object
 */
function toRecoveryEvent(event) {
    const payload = safeParseRecord(event.payloadJson);
    return {
        eventId: event.id,
        eventType: event.eventType,
        createdAt: event.createdAt,
        traceId: event.traceId,
        repairAction: typeof payload?.repairAction === "string" ? payload.repairAction : null,
        // Safely extract and validate the action from payload
        decisionAction: isSuggestedAction(payload?.action) ? payload.action : null,
        targetId: typeof payload?.targetId === "string" ? payload.targetId : null,
        deadLetterId: typeof payload?.deadLetterId === "string" ? payload.deadLetterId : null,
    };
}
function findLatestCheckpoint(artifacts) {
    for (const artifact of [...artifacts].sort((left, right) => right.createdAt.localeCompare(left.createdAt))) {
        const checkpoint = readWorkflowStepCheckpoint(artifact);
        if (checkpoint) {
            return summarizeWorkflowStepCheckpoint(artifact.artifactId, checkpoint);
        }
    }
    return null;
}
/**
 * Safely parses a JSON string as a string array, returning an empty
 * array if parsing fails or the value is not an array of strings.
 *
 * @param raw - Raw JSON string from database (may be null)
 * @returns Parsed array of strings or empty array on failure
 */
function safeParseStringArray(raw) {
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        // Ensure the parsed value is actually an array of strings
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    }
    catch (err) {
        logger.log({
            level: "warn",
            message: "Failed to parse string array",
            data: { error: err instanceof Error ? err.message : String(err), raw: raw.substring(0, 100) },
        });
        return [];
    }
}
/**
 * Safely parses a JSON string as a record object, returning null
 * if parsing fails or the value is not a plain object.
 *
 * @param raw - Raw JSON string from database
 * @returns Parsed record object or null on failure
 */
function safeParseRecord(raw) {
    try {
        const parsed = JSON.parse(raw);
        // Ensure the parsed value is a plain object (not array, not null)
        return parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed
            : null;
    }
    catch (err) {
        logger.log({
            level: "warn",
            message: "Failed to parse record",
            data: { error: err instanceof Error ? err.message : String(err), raw: raw.substring(0, 100) },
        });
        return null;
    }
}
/**
 * Type guard to validate that a value is a valid RecoverySuggestedAction.
 * Used to safely extract action values from untyped payloads.
 *
 * @param value - Unknown value to check
 * @returns True if the value is a valid RecoverySuggestedAction
 */
function isSuggestedAction(value) {
    return (value === "resume_same_worker" ||
        value === "retry_new_ticket" ||
        value === "escalate_takeover" ||
        value === "move_dead_letter" ||
        value === "cancel" ||
        value === "none");
}
//# sourceMappingURL=runtime-recovery-service-root.js.map