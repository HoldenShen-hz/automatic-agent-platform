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
 * - **Partial Result**: Stage results that can be preserved for audit
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: partial result}
 *
 * - **Compensation**: Rollback reconciliation or manual repair
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
import type { ApprovalRecord, DeadLetterRecord } from "../../contracts/types/domain.js";
import { AuthoritativeTaskStore, type RuntimeRecoveryRecord } from "../../state-evidence/truth/authoritative-task-store.js";
import { type WorkflowStepCheckpointSummary } from "../../state-evidence/checkpoints/workflow-step-checkpoint.js";
/**
 * Recovery action suggested by the system after analyzing a stuck or failed execution.
 * Each action represents a different recovery strategy with varying degrees of invasiveness.
 */
export type RecoverySuggestedAction = 
/** Resume execution on the same worker that was handling it (if still available) */
"resume_same_worker"
/** Cancel and create a new execution ticket for retry */
 | "retry_new_ticket"
/** Requires human operator intervention to resolve */
 | "escalate_takeover"
/** Move to dead letter queue for manual inspection */
 | "move_dead_letter"
/** Permanently cancel the execution */
 | "cancel"
/** No recovery action possible or necessary */
 | "none";
/**
 * Represents an execution that is a candidate for recovery analysis.
 * Combines execution state, task context, and recovery recommendation
 * into a single view for decision-making.
 */
export interface RuntimeRecoveryCandidate {
    /** Unique identifier for the execution */
    executionId: string;
    /** Parent task this execution belongs to */
    taskId: string;
    /** Division/tenant that owns this task (null if unassigned) */
    divisionId: string | null;
    /** Current task status */
    taskStatus: RuntimeRecoveryRecord["taskStatus"];
    /** Current execution status */
    status: RuntimeRecoveryRecord["status"];
    /** Number of retry attempts made */
    attempt: number;
    /** Distributed trace identifier for correlation */
    traceId: string;
    /** Workflow ID if this execution is part of a workflow */
    workflowId: string | null;
    /** Error code from the last failure, if any */
    latestErrorCode: string | null;
    /** ISO timestamp of last state change */
    updatedAt: string;
    /** Last heartbeat from the worker (null if never received) */
    lastHeartbeatAt: string | null;
    /** Pending approval ID if blocked waiting for approval */
    pendingApprovalId: string | null;
    /** Precheck results showing budget, timeout, sandbox, and tool resolution */
    latestPrecheck: {
        /** Whether the precheck passed */
        allowed: boolean;
        /** Reason code if denied */
        reasonCode: string | null;
        /** Resolved execution budget in USD */
        resolvedBudgetUsd: number | null;
        /** Resolved execution timeout in milliseconds */
        resolvedTimeoutMs: number;
        /** Resolved sandbox mode */
        resolvedSandboxMode: string;
        /** List of tools available to the execution */
        resolvedTools: string[];
        /** List of accessible paths/directories */
        resolvedPaths: string[];
        /** When the precheck was performed */
        checkedAt: string;
    } | null;
    /** Human-readable reason why recovery is needed */
    reason: string;
    /** System-suggested recovery action */
    suggestedAction: RecoverySuggestedAction;
}
/**
 * Comprehensive recovery view for a single task, including all its
 * execution candidates, pending approvals, dead letters, and recent
 * recovery events for audit and debugging purposes.
 */
export interface TaskRuntimeRecoveryView {
    /** Task identifier */
    taskId: string;
    /** Division/tenant that owns this task */
    divisionId: string | null;
    /** All execution candidates for this task */
    candidates: RuntimeRecoveryCandidate[];
    /** Approval requests that are still pending */
    requestedApprovals: ApprovalRecord[];
    /** Dead letter records associated with this task */
    deadLetters: DeadLetterRecord[];
    /** Latest stable step checkpoint available for recovery */
    latestCheckpoint: WorkflowStepCheckpointSummary | null;
    /** Recent recovery-related events (up to 10, most recent first) */
    recentRecoveryEvents: Array<{
        /** Event identifier */
        eventId: string;
        /** Type of recovery event */
        eventType: string;
        /** When the event was created */
        createdAt: string;
        /** Trace ID for correlation */
        traceId: string | null;
        /** Repair action that was applied, if any */
        repairAction: string | null;
        /** Decision action that was recorded */
        decisionAction: RecoverySuggestedAction | null;
        /** Target entity ID the action was applied to */
        targetId: string | null;
        /** Dead letter ID if moved to dead letter queue */
        deadLetterId: string | null;
    }>;
}
/**
 * Aggregated recovery statistics for a division, used for dashboard
 * displays and operational monitoring. Shows counts of various
 * recovery scenarios across all tasks in a division.
 */
export interface DivisionRecoveryOverview {
    /** Division/tenant identifier */
    divisionId: string;
    /** List of task IDs with recovery activity */
    taskIds: string[];
    /** Number of active recovery candidates */
    activeCandidateCount: number;
    /** Number of candidates blocked on pending approvals */
    blockedApprovalCount: number;
    /** Number of candidates with stale (old) executions */
    staleExecutionCount: number;
    /** Timestamp of the newest candidate, or null if none */
    newestCandidateAt: string | null;
}
/**
 * Main service for runtime recovery analysis. Provides methods to
 * identify recoverable executions, build diagnostic views, and
 * generate recovery overviews by division.
 *
 * This service is read-only - it queries the store for recovery
 * candidates and builds analysis views but does not modify state.
 * State modifications are performed by RuntimeRepairService.
 */
export declare class RuntimeRecoveryService {
    private readonly store;
    /**
     * Creates a new RuntimeRecoveryService instance.
     * @param store - The AuthoritativeTaskStore used for querying execution and task data
     */
    constructor(store: AuthoritativeTaskStore);
    /**
     * Lists all executions that are currently in an active state (executing,
     * prechecking, or created) but may need recovery attention. These are
     * executions that appear to be running but have no recent heartbeat
     * or show signs of being stuck.
     *
     * @param now - Current timestamp for staleness calculation (defaults to now)
     * @returns Array of recovery candidates that are in active execution states
     */
    listRecoverableExecutingRuns(now?: string, tenantId?: string | null): RuntimeRecoveryCandidate[];
    /**
     * Lists executions that are blocked because they are waiting for
     * human approval. These executions cannot proceed until an operator
     * approves the requested action.
     *
     * @returns Array of recovery candidates blocked on approval
     */
    listBlockedRunsAwaitingApproval(tenantId?: string | null): RuntimeRecoveryCandidate[];
    /**
     * Lists executions that are considered stale - they have not shown
     * progress (no heartbeat) within the specified threshold time.
     * Stale executions may have been abandoned by workers and are
     * candidates for retry with a new ticket.
     *
     * @param staleBefore - Timestamp threshold; executions not updated after this are stale
     * @returns Array of stale recovery candidates
     */
    listStaleRuns(staleBefore: string, tenantId?: string | null): RuntimeRecoveryCandidate[];
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
    buildRuntimeRecoveryView(taskId: string, tenantId?: string | null): TaskRuntimeRecoveryView;
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
    listDivisionRecoveryOverview(staleBefore: string, now?: string, tenantId?: string | null): DivisionRecoveryOverview[];
}
