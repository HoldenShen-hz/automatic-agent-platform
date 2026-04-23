/**
 * Runtime Recovery Replay Service
 *
 * Provides replay and diagnostic capabilities for recovery operations.
 * This service reconstructs the history of recovery activities for
 * executions and tasks, enabling debugging, auditing, and analysis
 * of recovery patterns.
 *
 * The service builds timeline reports showing:
 * - All recovery decisions made for an execution
 * - All repair actions applied
 * - The chronological sequence of recovery events
 * - The final outcome of recovery attempts
 *
 * These reports are useful for:
 * - Debugging failed recovery attempts
 * - Understanding recovery patterns
 * - Auditing recovery operations
 * - Generating operational metrics
 *
 * @see {@link docs_zh/contracts/runtime_state_machine_contract.md}
 * @see {@link docs_zh/contracts/runtime_execution_contract.md}
 * @see {@link docs_zh/architecture/00-platform-architecture.md}
 * @see {@link docs_zh/governance/glossary_and_terminology.md}
 */
import type { DeadLetterRecord, ExecutionRecord } from "../../contracts/types/domain.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { type RecoverySuggestedAction, type RuntimeRecoveryCandidate } from "./runtime-recovery-service.js";
/**
 * Possible outcomes for an execution's recovery replay.
 * Indicates the current state after all recovery activities.
 */
export type RecoveryReplayExecutionOutcome = 
/** Execution is still active and may need recovery */
"active"
/** Repairs have been applied and are pending verification */
 | "repair_pending"
/** Requires manual human intervention to resolve */
 | "manual_handoff"
/** Execution was moved to dead letter queue */
 | "dead_lettered"
/** Execution was cancelled */
 | "cancelled"
/** No recovery activity has occurred */
 | "no_recovery_activity";
/**
 * Possible outcomes for a task's recovery replay.
 * Can be a specific execution outcome or "mixed" if
 * multiple executions have different outcomes.
 */
export type RecoveryReplayTaskOutcome = RecoveryReplayExecutionOutcome
/** Task has multiple executions with different outcomes */
 | "mixed";
/**
 * A recovery decision that was recorded during replay analysis.
 * Represents a point where the system decided on a course of action.
 */
export interface RecoveryReplayDecision {
    /** Event ID where the decision was recorded */
    eventId: string;
    /** Associated decision ID */
    decisionId: string | null;
    /** When the decision was made */
    createdAt: string;
    /** The action that was decided */
    action: RecoverySuggestedAction;
    /** The reason for the decision */
    reason: string | null;
    /** Who/what made the decision */
    decidedBy: string | null;
}
/**
 * A repair action that was applied during replay analysis.
 * Represents an actual state modification.
 */
export interface RecoveryReplayRepair {
    /** Event ID where the repair was recorded */
    eventId: string;
    /** When the repair was applied */
    createdAt: string;
    /** Type of repair action */
    repairAction: string;
    /** Target entity ID the repair was applied to */
    targetId: string | null;
    /** Human-readable summary of the repair */
    detail: string;
}
/**
 * A single event in the recovery timeline for an execution.
 * Combines raw event data with extracted decision and repair information.
 */
export interface RecoveryReplayTimelineEvent {
    /** Event identifier */
    eventId: string;
    /** Type of the event */
    eventType: string;
    /** When the event was created */
    createdAt: string;
    /** Associated trace ID for correlation */
    traceId: string | null;
    /** Human-readable summary of the event */
    summary: string;
    /** Associated decision ID */
    decisionId: string | null;
    /** Extracted decision action if applicable */
    decisionAction: RecoverySuggestedAction | null;
    /** Extracted reason if applicable */
    reason: string | null;
    /** Extracted decidedBy if applicable */
    decidedBy: string | null;
    /** Extracted repair action if applicable */
    repairAction: string | null;
    /** Extracted target ID if applicable */
    targetId: string | null;
    /** Extracted dead letter ID if applicable */
    deadLetterId: string | null;
}
/**
 * Comprehensive replay report for a single execution's recovery history.
 * Includes timeline, decisions, repairs, and final outcome determination.
 */
export interface ExecutionRecoveryReplayReport {
    /** Execution identifier */
    executionId: string;
    /** Associated trace ID */
    traceId: string;
    /** Current attempt number */
    attempt: number;
    /** Current execution status */
    status: ExecutionRecord["status"];
    /** Error code from most recent failure */
    latestErrorCode: string | null;
    /** Precheck results if available */
    latestPrecheck: RuntimeRecoveryCandidate["latestPrecheck"];
    /** Current recovery reason */
    currentReason: string | null;
    /** Suggested recovery action */
    suggestedAction: RecoverySuggestedAction | null;
    /** Dead letter record if moved to DLQ */
    deadLetter: DeadLetterRecord | null;
    /** All recovery decisions in timeline order */
    decisions: RecoveryReplayDecision[];
    /** All repair actions in timeline order */
    repairs: RecoveryReplayRepair[];
    /** Full chronological timeline of events */
    timeline: RecoveryReplayTimelineEvent[];
    /** Final determined outcome */
    finalOutcome: RecoveryReplayExecutionOutcome;
}
/**
 * Comprehensive replay report for a task's recovery history.
 * Aggregates information across all executions of the task.
 */
export interface TaskRecoveryReplayReport {
    /** When this report was generated */
    generatedAt: string;
    /** Task identifier */
    taskId: string;
    /** Division/tenant that owns this task */
    divisionId: string | null;
    /** Execution ID of the currently active execution, if any */
    activeExecutionId: string | null;
    /** Number of recovery candidates across all executions */
    candidateCount: number;
    /** Number of pending approval requests */
    requestedApprovalCount: number;
    /** Number of dead letter records */
    deadLetterCount: number;
    /** Number of recovery-related events */
    recoveryEventCount: number;
    /** Overall outcome across all executions */
    outcome: RecoveryReplayTaskOutcome;
    /** Individual execution reports */
    executions: ExecutionRecoveryReplayReport[];
}
/**
 * Service for replaying and analyzing recovery histories.
 * Constructs detailed timeline reports from recovery events
 * and determines outcomes based on the observed history.
 */
export declare class RuntimeRecoveryReplayService {
    private readonly store;
    private readonly recoveryService;
    /**
     * Creates a new RuntimeRecoveryReplayService instance.
     * @param store - AuthoritativeTaskStore for querying execution and event data
     */
    constructor(store: AuthoritativeTaskStore);
    /**
     * Builds a complete replay report for a task, including all its
     * executions. This is the main entry point for task-level
     * recovery analysis.
     *
     * The report includes:
     * - Summary statistics (candidates, approvals, dead letters)
     * - Per-execution detailed reports
     * - Overall task outcome determination
     *
     * @param taskId - The task to build report for
     * @param generatedAt - Timestamp for report generation (defaults to now)
     * @returns Complete task recovery replay report
     * @throws Error if task is not found
     */
    buildTaskReplayReport(taskId: string, generatedAt?: string): TaskRecoveryReplayReport;
    /**
     * Builds a replay report for a single execution by delegating
     * to buildTaskReplayReport and extracting the specific execution.
     *
     * @param executionId - The execution to build report for
     * @param generatedAt - Timestamp for report generation (defaults to now)
     * @returns Execution recovery replay report
     * @throws Error if execution is not found
     */
    buildExecutionReplayReport(executionId: string, generatedAt?: string): ExecutionRecoveryReplayReport;
    /**
     * Builds a detailed replay report for a single execution.
     * Constructs timeline, extracts decisions and repairs, and
     * determines the final outcome.
     *
     * @param execution - The execution record
     * @param candidate - The recovery candidate if available
     * @param recoveryEvents - Filtered recovery events for this execution
     * @param deadLetter - Dead letter record if moved to DLQ
     * @param precheck - Precheck record if available
     * @returns Execution recovery replay report
     */
    private buildExecutionReport;
}
