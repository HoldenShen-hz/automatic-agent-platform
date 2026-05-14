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

import type {
  DeadLetterRecord,
  EventRecord,
  ExecutionPrecheckRecord,
  ExecutionRecord,
} from "../../contracts/types/domain.js";

import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { nowIso } from "../../contracts/types/ids.js";
import {
  RuntimeRecoveryService,
  type RecoverySuggestedAction,
  type RuntimeRecoveryCandidate,
} from "./runtime-recovery-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { StorageError } from "../../contracts/errors.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Possible outcomes for an execution's recovery replay.
 * Indicates the current state after all recovery activities.
 */
export type RecoveryReplayExecutionOutcome =
  /** Execution is still active and may need recovery */
  | "active"
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
export type RecoveryReplayTaskOutcome =
  | RecoveryReplayExecutionOutcome
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
export class RuntimeRecoveryReplayService {
  private readonly recoveryService: RuntimeRecoveryService;

  /**
   * Creates a new RuntimeRecoveryReplayService instance.
   * @param store - AuthoritativeTaskStore for querying execution and event data
   */
  public constructor(private readonly store: AuthoritativeTaskStore) {
    // Initialize the recovery service for candidate analysis
    this.recoveryService = new RuntimeRecoveryService(store);
  }

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
  public buildTaskReplayReport(taskId: string, generatedAt: string = nowIso()): TaskRecoveryReplayReport {
    const task = this.store.task.getTask(taskId);
    if (!task) {
      throw new StorageError("storage.task_not_found", `Task not found: ${taskId}`, {
        details: { taskId },
        taskId,
      });
    }

    // Get comprehensive recovery view from the recovery service
    const view = this.recoveryService.buildRuntimeRecoveryView(taskId);

    // Get all recovery events for this task, sorted chronologically
    const recoveryEvents = this.store
      .listEventsForTask(taskId)
      .filter((event) => event.eventType.startsWith("recovery:"))
      .sort(compareRecoveryEventOrder);

    // Get all executions for this task
    const executions = this.store.execution.listExecutionsByTask(taskId);

    // Build a report for each execution
    const reports = executions.map((execution) =>
      this.buildExecutionReport(
        execution,
        // Find matching recovery candidate if any
        view.candidates.find((candidate) => candidate.executionId === execution.id) ?? null,
        // Filter events to this execution
        recoveryEvents.filter((event) => matchesExecution(event, execution.id)),
        // Get dead letter if exists
        this.store.dispatch.getDeadLetterByExecutionId(execution.id),
        // Get precheck record if exists
        this.store.dispatch.getExecutionPrecheck(execution.id),
      ),
    );

    return {
      generatedAt,
      taskId,
      divisionId: task.divisionId,
      // Find the active execution (first with active status)
      activeExecutionId: reports.find((report) => isActiveStatus(report.status))?.executionId ?? null,
      candidateCount: view.candidates.length,
      requestedApprovalCount: view.requestedApprovals.length,
      deadLetterCount: view.deadLetters.length,
      recoveryEventCount: recoveryEvents.length,
      // Determine overall task outcome
      outcome: inferTaskOutcome(reports),
      executions: reports,
    };
  }

  /**
   * Builds a replay report for a single execution by delegating
   * to buildTaskReplayReport and extracting the specific execution.
   *
   * @param executionId - The execution to build report for
   * @param generatedAt - Timestamp for report generation (defaults to now)
   * @returns Execution recovery replay report
   * @throws Error if execution is not found
   */
  public buildExecutionReplayReport(executionId: string, generatedAt: string = nowIso()): ExecutionRecoveryReplayReport {
    const execution = this.store.dispatch.getExecution(executionId);
    if (!execution) {
      throw new StorageError("storage.execution_not_found", `Execution not found: ${executionId}`, {
        details: { executionId },
        executionId,
      });
    }

    // Build task report and find the specific execution's report
    const report = this.buildTaskReplayReport(execution.taskId, generatedAt);
    return report.executions.find((report) => report.executionId === executionId)!;
  }

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
  private buildExecutionReport(
    execution: ExecutionRecord,
    candidate: RuntimeRecoveryCandidate | null,
    recoveryEvents: EventRecord[],
    deadLetter: DeadLetterRecord | null,
    precheck: ExecutionPrecheckRecord | null,
  ): ExecutionRecoveryReplayReport {
    // Convert raw events to timeline events
    const timeline = recoveryEvents.map(toTimelineEvent);

    // Extract decision events from timeline
    const decisions = timeline
      .filter((event): event is RecoveryReplayTimelineEvent & { decisionAction: RecoverySuggestedAction } => event.decisionAction !== null)
      .map((event) => ({
        eventId: event.eventId,
        decisionId: event.decisionId,
        createdAt: event.createdAt,
        action: event.decisionAction,
        reason: event.reason,
        decidedBy: event.decidedBy,
      }));

    // Extract repair events from timeline
    const repairs = timeline
      .filter((event): event is RecoveryReplayTimelineEvent & { repairAction: string } => event.repairAction !== null)
      .map((event) => ({
        eventId: event.eventId,
        createdAt: event.createdAt,
        repairAction: event.repairAction,
        targetId: event.targetId,
        detail: event.summary,
      }));

    return {
      executionId: execution.id,
      traceId: execution.traceId,
      attempt: execution.attempt,
      status: execution.status,
      latestErrorCode: candidate?.latestErrorCode ?? execution.lastErrorCode,
      latestPrecheck: candidate?.latestPrecheck ?? toPrecheckView(precheck),
      currentReason: candidate?.reason ?? null,
      suggestedAction: candidate?.suggestedAction ?? null,
      deadLetter,
      decisions,
      repairs,
      timeline,
      // Determine final outcome based on history
      finalOutcome: inferExecutionOutcome(execution, candidate, deadLetter, decisions, repairs, timeline),
    };
  }
}

/**
 * Determines if an event belongs to a specific execution.
 * Checks both direct executionId and payload targetId for robustness.
 *
 * @param event - The event to check
 * @param executionId - The execution ID to match
 * @returns True if the event belongs to the execution
 */
function matchesExecution(event: EventRecord, executionId: string): boolean {
  // Direct match on executionId field
  if (event.executionId === executionId) {
    return true;
  }

  // Check if the event targets this execution in its payload
  const payload = safeParseRecord(event.payloadJson);
  return typeof payload?.targetId === "string" && payload.targetId === executionId;
}

/**
 * Converts an EventRecord to a RecoveryReplayTimelineEvent with
 * extracted payload fields and a human-readable summary.
 *
 * @param event - Raw event record from database
 * @returns Timeline event with extracted fields and summary
 */
function toTimelineEvent(event: EventRecord): RecoveryReplayTimelineEvent {
  const payload = safeParseRecord(event.payloadJson);

  // Safely extract typed fields from payload
  const decisionAction = isSuggestedAction(payload?.action) ? payload.action : null;
  const repairAction = typeof payload?.repairAction === "string" ? payload.repairAction : null;
  const reason = typeof payload?.reason === "string" ? payload.reason : null;
  const decidedBy = typeof payload?.decidedBy === "string" ? payload.decidedBy : null;
  const decisionId = typeof payload?.decisionId === "string" ? payload.decisionId : null;
  const targetId = typeof payload?.targetId === "string" ? payload.targetId : null;
  const deadLetterId = typeof payload?.deadLetterId === "string" ? payload.deadLetterId : null;

  return {
    eventId: event.id,
    eventType: event.eventType,
    createdAt: event.createdAt,
    traceId: event.traceId,
    // Generate human-readable summary
    summary: summarizeEvent(event.eventType, {
      decisionAction,
      repairAction,
      reason,
      decidedBy,
      targetId,
      deadLetterId,
    }),
    decisionId,
    decisionAction,
    reason,
    decidedBy,
    repairAction,
    targetId,
    deadLetterId,
  };
}

/**
 * Generates a human-readable summary for a recovery event.
 * Provides context-aware messages based on event type and payload.
 *
 * @param eventType - The type of event
 * @param input - Extracted payload fields
 * @returns Human-readable summary string
 */
function summarizeEvent(
  eventType: string,
  input: {
    decisionAction: RecoverySuggestedAction | null;
    repairAction: string | null;
    reason: string | null;
    decidedBy: string | null;
    targetId: string | null;
    deadLetterId: string | null;
  },
): string {
  switch (eventType) {
    case "recovery:repair_applied":
      return `repair ${input.repairAction ?? "unknown"} applied to ${input.targetId ?? "unknown_target"}`;
    case "recovery:decision_recorded":
      return `decision ${input.decisionAction ?? "unknown"} recorded${input.reason ? ` for ${input.reason}` : ""}`;
    case "recovery:dead_lettered":
      return `execution moved to dead letter${input.deadLetterId ? ` (${input.deadLetterId})` : ""}`;
    case "recovery:cancelled":
      return `execution cancelled${input.decidedBy ? ` by ${input.decidedBy}` : ""}`;
    default:
      // For unknown event types, just return the event type
      return eventType;
  }
}

/**
 * Compares two recovery events for chronological ordering.
 * Sorts by createdAt first, then by event priority, then by ID.
 *
 * @param left - First event to compare
 * @param right - Second event to compare
 * @returns Sort order indicator (-1, 0, or 1)
 */
function compareRecoveryEventOrder(left: EventRecord, right: EventRecord): number {
  // Primary sort: by creation time
  const byCreatedAt = left.createdAt.localeCompare(right.createdAt);
  if (byCreatedAt !== 0) {
    return byCreatedAt;
  }

  // Secondary sort: by event priority (repairs first, then decisions, etc.)
  const byPriority = recoveryEventPriority(left.eventType) - recoveryEventPriority(right.eventType);
  if (byPriority !== 0) {
    return byPriority;
  }

  // Tertiary sort: by event ID for stable ordering
  return left.id.localeCompare(right.id);
}

/**
 * Returns the priority level for a recovery event type.
 * Lower numbers indicate higher priority (processed first).
 *
 * @param eventType - The event type to get priority for
 * @returns Priority number (1 = highest)
 */
function recoveryEventPriority(eventType: string): number {
  switch (eventType) {
    case "recovery:repair_applied":
      return 1;
    case "recovery:decision_recorded":
      return 2;
    case "recovery:cancelled":
      return 3;
    case "recovery:dead_lettered":
      return 4;
    default:
      return 99;
  }
}

/**
 * Determines the final outcome for an execution based on its
 * recovery history, current state, and candidate information.
 *
 * Outcome priority:
 * 1. dead_lettered - If moved to DLQ
 * 2. cancelled - If explicitly cancelled
 * 3. manual_handoff - If requires escalation
 * 4. repair_pending - If repairs were applied or retry/resume decided
 * 5. active - If still potentially recoverable
 * 6. no_recovery_activity - Default if nothing observed
 *
 * @param execution - The execution record
 * @param candidate - Recovery candidate if available
 * @param deadLetter - Dead letter record if moved to DLQ
 * @param decisions - Extracted decision events
 * @param repairs - Extracted repair events
 * @param timeline - Full timeline events
 * @returns The determined final outcome
 */
function inferExecutionOutcome(
  execution: ExecutionRecord,
  candidate: RuntimeRecoveryCandidate | null,
  deadLetter: DeadLetterRecord | null,
  decisions: RecoveryReplayDecision[],
  repairs: RecoveryReplayRepair[],
  timeline: RecoveryReplayTimelineEvent[],
): RecoveryReplayExecutionOutcome {
  // Check for dead letter outcome
  if (deadLetter || timeline.some((event) => event.eventType === "recovery:dead_lettered")) {
    return "dead_lettered";
  }
  // Check for cancelled outcome
  if (execution.status === "cancelled" || timeline.some((event) => event.eventType === "recovery:cancelled")) {
    return "cancelled";
  }

  // Get the most recent decision action or fallback to candidate suggestion
  const lastDecision = decisions.at(-1)?.action ?? candidate?.suggestedAction ?? null;

  // Check for escalation requiring manual intervention
  if (lastDecision === "escalate_takeover") {
    return "manual_handoff";
  }

  // Check if repairs were applied or retry/resume was decided
  if (repairs.length > 0 || lastDecision === "retry_new_ticket" || lastDecision === "resume_same_worker") {
    return "repair_pending";
  }

  // Check if still potentially active or has candidate data
  if (candidate || isActiveStatus(execution.status)) {
    return "active";
  }

  // Default: no recovery activity observed
  return "no_recovery_activity";
}

/**
 * Determines the overall outcome for a task based on its
 * executions' outcomes. If all executions have the same
 * non-default outcome, returns that; otherwise returns "mixed".
 *
 * @param executions - Array of execution reports
 * @returns The task outcome
 */
function inferTaskOutcome(executions: ExecutionRecoveryReplayReport[]): RecoveryReplayTaskOutcome {
  // Filter out executions with no recovery activity
  const effective = executions
    .map((execution) => execution.finalOutcome)
    .filter((outcome) => outcome !== "no_recovery_activity");

  // If no executions had recovery activity, return default
  if (effective.length === 0) {
    return "no_recovery_activity";
  }

  // Check if all outcomes are the same
  const distinct = [...new Set(effective)];
  return distinct.length === 1 ? distinct[0]! : "mixed";
}

/**
 * Checks if an execution status represents an active state.
 * Active states are those where the execution may still be running.
 *
 * @param status - The execution status to check
 * @returns True if the status is active
 */
function isActiveStatus(status: ExecutionRecord["status"]): boolean {
  return status === "created" || status === "prechecking" || status === "executing" || status === "blocked";
}

/**
 * Converts an ExecutionPrecheckRecord to the RuntimeRecoveryCandidate
 * precheck format for consistent reporting.
 *
 * @param precheck - Raw precheck record from database
 * @returns Typed precheck view or null if input was null
 */
function toPrecheckView(precheck: ExecutionPrecheckRecord | null): RuntimeRecoveryCandidate["latestPrecheck"] {
  if (!precheck) {
    return null;
  }

  return {
    // Convert numeric representation to boolean
    allowed: precheck.allowed === 1,
    reasonCode: precheck.reasonCode,
    resolvedBudgetUsd: precheck.resolvedBudgetUsd,
    resolvedTimeoutMs: precheck.resolvedTimeoutMs,
    resolvedSandboxMode: precheck.resolvedSandboxMode,
    // Parse JSON string arrays for tools and paths
    resolvedTools: safeParseStringArray(precheck.resolvedToolsJson),
    resolvedPaths: safeParseStringArray(precheck.resolvedPathsJson),
    checkedAt: precheck.checkedAt,
  };
}

/**
 * Safely parses a JSON string as a string array, returning an empty
 * array if parsing fails or the value is not an array of strings.
 *
 * @param raw - Raw JSON string from database (may be null)
 * @returns Parsed array of strings or empty array on failure
 */
function safeParseStringArray(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    // Ensure the parsed value is actually an array of strings
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch (err) {
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
function safeParseRecord(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    // Ensure the parsed value is a plain object (not array, not null)
    return parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch (err) {
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
function isSuggestedAction(value: unknown): value is RecoverySuggestedAction {
  return (
    value === "resume_same_worker" ||
    value === "retry_new_ticket" ||
    value === "escalate_takeover" ||
    value === "move_dead_letter" ||
    value === "cancel" ||
    value === "none"
  );
}
