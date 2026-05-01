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
 * - **Partial Result**: Preservable and auditable stage results
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

import type { ApprovalRecord, ArtifactRecord, DeadLetterRecord, EventRecord } from "../../contracts/types/domain.js";

import { nowIso } from "../../contracts/types/ids.js";
import { AuthoritativeTaskStore, type RuntimeRecoveryRecord } from "../../state-evidence/truth/authoritative-task-store.js";
import {
  readWorkflowStepCheckpoint,
  summarizeWorkflowStepCheckpoint,
  type WorkflowStepCheckpointSummary,
} from "../../state-evidence/checkpoints/workflow-step-checkpoint.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { StorageError, AppError, isAppError } from "../../contracts/errors.js";
import {
  loadExceptionRecoveryConfig,
  type ExceptionRecoveryConfig,
} from "./exception-recovery-config-loader.js";
import {
  type ExceptionType,
  ERROR_CLASS_TO_EXCEPTION_TYPE,
  CATEGORY_TO_EXCEPTION_TYPE,
} from "./exception-recovery-types.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Recovery action suggested by the system after analyzing a stuck or failed execution.
 * Each action represents a different recovery strategy with varying degrees of invasiveness.
 */
export type RecoverySuggestedAction =
  /** Resume execution on the same worker that was handling it (if still available) */
  | "resume_same_worker"
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

export interface LegacyRecoveryCandidate extends RuntimeRecoveryCandidate {
  errorClassification: "E7" | "E8" | "EC" | "unknown";
}

export interface LegacyRecoveryCandidateQuery {
  includeStatuses?: RuntimeRecoveryRecord["status"][];
  divisionId?: string | null;
  tenantId?: string | null;
}

export interface LegacyStaleExecutionQuery {
  stalenessThresholdMs?: number;
  tenantId?: string | null;
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
export class RuntimeRecoveryService {
  private readonly config: ExceptionRecoveryConfig;

  /**
   * Creates a new RuntimeRecoveryService instance.
   * @param store - The AuthoritativeTaskStore used for querying execution and task data
   * @param config - Optional exception recovery configuration (defaults to loading from config/exception-recovery/default.json)
   */
  public constructor(
    private readonly store: AuthoritativeTaskStore,
    config?: ExceptionRecoveryConfig,
  ) {
    this.config = config ?? loadExceptionRecoveryConfig();
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
  public listRecoverableExecutingRuns(now: string = nowIso(), tenantId?: string | null): RuntimeRecoveryCandidate[] {
    return this.store.operations.listRecoverableExecutingRuns(now, tenantId).map((record) => toCandidate(record, "active_execution", this.config));
  }

  /**
   * Lists executions that are blocked because they are waiting for
   * human approval. These executions cannot proceed until an operator
   * approves the requested action.
   *
   * @returns Array of recovery candidates blocked on approval
   */
  public listBlockedRunsAwaitingApproval(tenantId?: string | null): RuntimeRecoveryCandidate[] {
    return this.store
      .listBlockedRunsAwaitingApproval(tenantId)
      .map((record) => toCandidate(record, "approval_pending", this.config));
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
  public listStaleRuns(staleBefore: string, tenantId?: string | null): RuntimeRecoveryCandidate[] {
    return this.store.operations.listStaleRuns(staleBefore, tenantId).map((record) => toCandidate(record, "stale_execution", this.config));
  }

  public findRecoveryCandidates(query: LegacyRecoveryCandidateQuery = {}): LegacyRecoveryCandidate[] {
    const statuses = query.includeStatuses?.length ? query.includeStatuses : ["created", "prechecking", "executing", "blocked", "failed"];
    const whereParts = [`e.status IN (${statuses.map(() => "?").join(", ")})`];
    const params: string[] = [...statuses];

    if (query.divisionId !== undefined) {
      if (query.divisionId == null) {
        whereParts.push("t.division_id IS NULL");
      } else {
        whereParts.push("t.division_id = ?");
        params.push(query.divisionId);
      }
    }

    return this.store.operations
      .listRuntimeRecoveryRecords(whereParts.join(" AND "), params)
      .map((record) => toLegacyCandidate(record, inferReason(record), this.config));
  }

  public findStaleExecuting(query: LegacyStaleExecutionQuery = {}): LegacyRecoveryCandidate[] {
    const thresholdMs = Math.max(0, query.stalenessThresholdMs ?? this.config.staleExecutionThresholdMs);
    const staleBefore = new Date(Date.now() - thresholdMs).toISOString();
    return this.listStaleRuns(staleBefore, query.tenantId).map((candidate) => ({
      ...candidate,
      errorClassification: classifyLegacyError(candidate.latestErrorCode),
    }));
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
  public buildRuntimeRecoveryView(taskId: string, tenantId?: string | null): TaskRuntimeRecoveryView {
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
      candidates: this.store.operations.buildRuntimeRecoveryView(taskId, tenantId).map((record) => toCandidate(record, inferReason(record), this.config)),
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
  public listDivisionRecoveryOverview(
    staleBefore: string,
    now: string = "9999-12-31T23:59:59.999Z",
    tenantId?: string | null,
  ): DivisionRecoveryOverview[] {
    const active = this.listRecoverableExecutingRuns(now, tenantId);
    const stale = new Set(this.listStaleRuns(staleBefore, tenantId).map((candidate) => candidate.executionId));
    const blocked = new Set(this.listBlockedRunsAwaitingApproval(tenantId).map((candidate) => candidate.executionId));
    const divisions = new Map<string, DivisionRecoveryOverview>();

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
function inferReason(record: RuntimeRecoveryRecord): string {
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
 * @param config - The exception recovery configuration
 * @returns Typed recovery candidate interface
 */
function toCandidate(record: RuntimeRecoveryRecord, reason: string, config: ExceptionRecoveryConfig): RuntimeRecoveryCandidate {
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
    latestPrecheck:
      record.latestPrecheck == null
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
    suggestedAction: inferSuggestedAction(record, reason, config),
  };
}

function toLegacyCandidate(
  record: RuntimeRecoveryRecord,
  reason: string,
  config: ExceptionRecoveryConfig,
): LegacyRecoveryCandidate {
  const candidate = toCandidate(record, reason, config);
  const errorClassification = classifyLegacyError(record.latestErrorCode);
  return {
    ...candidate,
    errorClassification,
    suggestedAction: inferLegacySuggestedAction(candidate, errorClassification),
  };
}

function classifyLegacyError(errorCode: string | null): LegacyRecoveryCandidate["errorClassification"] {
  if (errorCode?.startsWith("E7")) {
    return "E7";
  }
  if (errorCode?.startsWith("E8")) {
    return "E8";
  }
  if (errorCode?.startsWith("EC")) {
    return "EC";
  }
  return "unknown";
}

function inferLegacySuggestedAction(
  candidate: RuntimeRecoveryCandidate,
  errorClassification: LegacyRecoveryCandidate["errorClassification"],
): RecoverySuggestedAction {
  if (candidate.suggestedAction === "move_dead_letter" || candidate.suggestedAction === "cancel") {
    return candidate.suggestedAction;
  }
  if (errorClassification === "E7") {
    return "retry_new_ticket";
  }
  if (errorClassification === "E8") {
    return "escalate_takeover";
  }
  if (errorClassification === "EC" && candidate.attempt <= 1) {
    return "resume_same_worker";
  }
  return candidate.suggestedAction;
}

/**
 * Determines the appropriate recovery action based on the reason
 * and execution state. Maps failure modes to recovery strategies.
 * Uses the configurable recovery strategy table from config/exception-recovery/default.json.
 *
 * @param record - The runtime recovery record
 * @param reason - The inferred reason string
 * @param config - The exception recovery configuration
 * @returns The suggested recovery action
 */
function inferSuggestedAction(
  record: RuntimeRecoveryRecord,
  reason: string,
  config: ExceptionRecoveryConfig,
): RecoverySuggestedAction {
  const thresholds = config.recoveryStrategyTable.byAttemptThreshold;

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
  // Execution errors - use configurable strategy based on error type
  if (reason.startsWith("execution_error:")) {
    const errorCode = reason.split(":")[1] ?? "unknown_error";
    const exceptionType = resolveExceptionType(record.latestErrorCode, errorCode);
    const strategy = config.recoveryStrategyTable.byExceptionType[exceptionType];

    // Check attempt thresholds for action determination
    if (record.attempt >= thresholds.moveToDeadLetterMinAttempts) {
      return "move_dead_letter";
    }
    if (record.attempt >= thresholds.retryNewTicketMaxAttempts) {
      return "move_dead_letter";
    }
    return strategy.action;
  }
  // Active statuses can potentially be resumed
  if (record.status === "executing" || record.status === "prechecking" || record.status === "created") {
    if (record.attempt >= thresholds.resumeSameWorkerMaxAttempts) {
      return "retry_new_ticket";
    }
    return "resume_same_worker";
  }
  // Default: no action recommended
  return "none";
}

/**
 * Resolves the exception type from an error code and error class.
 *
 * @param errorCode - The error code from the execution record
 * @param reasonCode - The reason code extracted from the error
 * @returns The resolved exception type
 */
function resolveExceptionType(errorCode: string | null, reasonCode: string): ExceptionType {
  // First try to map from error code prefix
  if (errorCode) {
    // E7 = LockingError
    if (errorCode.startsWith("E7")) {
      return "locking_error";
    }
    // E8 = MemoryError
    if (errorCode.startsWith("E8")) {
      return "memory_error";
    }
    // EC = RuntimeError
    if (errorCode.startsWith("EC")) {
      return "runtime_error";
    }
  }

  // Try to map from reason code
  const normalizedReason = reasonCode.toLowerCase().replace(/[._-]/g, "_");
  for (const [key, value] of Object.entries(ERROR_CLASS_TO_EXCEPTION_TYPE)) {
    if (normalizedReason.includes(key.toLowerCase())) {
      return value;
    }
  }

  // Default to unknown_error if no match found
  return "unknown_error";
}

/**
 * Converts an EventRecord to the simplified recovery event format
 * used in TaskRuntimeRecoveryView.
 *
 * @param event - Raw event record from database
 * @returns Simplified recovery event object
 */
function toRecoveryEvent(event: EventRecord): TaskRuntimeRecoveryView["recentRecoveryEvents"][number] {
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

function findLatestCheckpoint(artifacts: ArtifactRecord[]): WorkflowStepCheckpointSummary | null {
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
