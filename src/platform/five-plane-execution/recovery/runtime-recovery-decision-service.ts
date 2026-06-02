/**
 * Runtime Recovery Decision Service
 *
 * Makes and applies recovery decisions for problematic executions.
 * This service bridges the analysis provided by RuntimeRecoveryService
 * and the actual state modifications performed by RuntimeRepairService.
 *
 * The service operates in two phases:
 * 1. Decide - Analyze an execution and record a recovery decision
 * 2. Apply - Execute the decided action (cancel or move to dead letter)
 *
 * Recovery decisions are recorded as events for audit trails and
 * are used by external systems to understand recovery history.
 *
 * Supported actions:
 * - cancel: Permanently cancel the execution with an error
 * - move_dead_letter: Move to dead letter queue for manual inspection
 *
 * @see {@link docs_zh/contracts/runtime_state_machine_contract.md}
 * @see {@link docs_zh/contracts/runtime_execution_contract.md}
 * @see {@link docs_zh/contracts/startup_consistency_and_recovery_drill_contract.md}
 * @see {@link docs_zh/architecture/00-platform-architecture.md}
 * @see {@link docs_zh/governance/glossary_and_terminology.md}
 */

import type { DeadLetterRecord, ExecutionRecord } from "../../contracts/types/domain.js";

import { MemoryService } from "../../five-plane-state-evidence/memory-gateway/index.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import {
  RuntimeRecoveryService,
  type RecoverySuggestedAction,
  type RuntimeRecoveryCandidate,
} from "./runtime-recovery-service.js";
import { StorageError } from "../../contracts/errors.js";
import { executionStateMachine } from "../state-transition/transition-service-model.js";

/**
 * Represents a single recovery decision made for an execution.
 * Records the reason, action taken, when it was decided, and by whom.
 */
export interface RecoveryDecisionRecord {
  /** Unique identifier for this decision */
  decisionId: string;
  /** The execution this decision applies to */
  executionId: string;
  /** The parent task of the execution */
  taskId: string;
  /** The reason why recovery is needed */
  reason: string;
  /** The recovery action that was decided */
  action: RecoverySuggestedAction;
  /** ISO timestamp when the decision was made */
  decidedAt: string;
  /** Identifier of the component/system that made the decision */
  decidedBy: string;
}

/**
 * Result of applying a recovery decision, including whether
 * the action was successfully applied and any resulting dead letter.
 */
export interface RecoveryDecisionApplyResult {
  /** The decision record that was created */
  decision: RecoveryDecisionRecord;
  /** The dead letter record if action was move_dead_letter */
  deadLetter: DeadLetterRecord | null;
  /** Whether the action was successfully applied */
  applied: boolean;
}

/**
 * Service responsible for making and applying recovery decisions.
 * Uses RuntimeRecoveryService to analyze candidates and determine
 * appropriate actions, then applies those actions to the system state.
 *
 * This service ensures all recovery operations are properly recorded
 * with decision events for traceability and auditing.
 */
export class RuntimeRecoveryDecisionService {
  private readonly recoveryService: RuntimeRecoveryService;

  /**
   * Creates a new RuntimeRecoveryDecisionService instance.
   * @param db - SQLite database for transaction support
   * @param store - AuthoritativeTaskStore for data access and modifications
   */
  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
  ) {
    // Create internal recovery service for candidate analysis
    this.recoveryService = new RuntimeRecoveryService(store);
  }

  /**
   * Makes a recovery decision for an execution without applying it.
   * Analyzes the execution's current state and recovery candidate
   * information to determine the appropriate action.
   *
   * The decision is recorded as an event but no state modifications
   * are made. Use apply() if you want to both decide and execute.
   *
   * @param executionId - The execution to make a decision for
   * @param decidedBy - Identifier of the caller (defaults to service name)
   * @returns The recovery decision record
   * @throws Error if execution or candidate not found
   */
  public decide(executionId: string, decidedBy: string = "runtime_recovery_decision_service"): RecoveryDecisionRecord {
    let decision: RecoveryDecisionRecord | null = null;
    this.db.transaction(() => {
      const execution = this.requireExecution(executionId);
      const candidate = this.requireRecoveryCandidate(execution.taskId, executionId);
      decision = {
        decisionId: newId("rdec"),
        executionId,
        taskId: execution.taskId,
        reason: candidate.reason,
        action: candidate.suggestedAction,
        decidedAt: nowIso(),
        decidedBy,
      };
      this.recordDecision(decision, execution);
    });
    return decision!;
  }

  /**
   * Makes and applies a recovery decision for an execution.
   * This is the main entry point for automated recovery - it
   * analyzes the execution, creates a decision, and applies
   * the appropriate state changes.
   *
   * Currently supports:
   * - move_dead_letter: Moves execution to dead letter queue
   * - cancel: Marks execution as cancelled with error info
   *
   * @param executionId - The execution to apply recovery for
   * @param decidedBy - Identifier of the caller (defaults to service name)
   * @returns Result containing the decision, dead letter (if any), and applied status
   * @throws Error if execution or candidate not found
   */
  public apply(executionId: string, decidedBy: string = "runtime_recovery_decision_service"): RecoveryDecisionApplyResult {
    let deadLetter: DeadLetterRecord | null = null;
    let applied = false;
    let decision: RecoveryDecisionRecord | null = null;
    let failureMemoryInput: FailureMemoryInput | null = null;

    // Contract shape for async transaction adapters: await this.db.transaction(async () => {
    this.db.transaction(() => {
      const execution = this.requireExecution(executionId);
      const candidate = this.requireRecoveryCandidate(execution.taskId, executionId);

      // Build the decision record
      decision = {
        decisionId: newId("rdec"),
        executionId,
        taskId: execution.taskId,
        reason: candidate.reason,
        action: candidate.suggestedAction,
        decidedAt: nowIso(),
        decidedBy,
      };

      // Always record the decision first for audit
      // Pass execution directly to avoid TOCTOU - we use the execution already read
      // inside the transaction rather than re-reading in recordDecision
      this.recordDecision(decision, execution);

      // Handle move to dead letter action
      if (decision.action === "move_dead_letter") {
        const moveResult = moveExecutionToDeadLetter(this.store, execution, candidate, decision);
        deadLetter = moveResult.deadLetter;
        failureMemoryInput = moveResult.failureMemoryInput;
        applied = true;
        return;
      }

      // Handle cancellation action
      if (decision.action === "cancel") {
        transitionExecutionToTerminalStatus(this.store, execution, {
          nextStatus: "cancelled",
          occurredAt: decision.decidedAt,
          reasonCode: candidate.latestPrecheck?.reasonCode ?? execution.lastErrorCode ?? null,
          errorMessage:
            candidate.reason.startsWith("precheck_denied:")
              ? `precheck denied: ${candidate.latestPrecheck?.reasonCode ?? "unknown"}`
              : execution.lastErrorMessage ?? null,
        });
        // Emit cancellation event for audit trail
        this.store.event.insertEvent({
          id: newId("evt"),
          taskId: execution.taskId,
          executionId: execution.id,
          eventType: "recovery:cancelled",
          eventTier: "tier_2",
          payloadJson: JSON.stringify({
            decisionId: decision.decisionId,
            action: decision.action,
            reason: decision.reason,
            decidedBy: decision.decidedBy,
          }),
          traceId: execution.traceId,
          createdAt: decision.decidedAt,
        });
        applied = true;
      }
    });

    if (failureMemoryInput != null) {
      new MemoryService(this.store).recordFailureMemory(failureMemoryInput);
    }

    // decision must be set if we got here without throwing
    return {
      decision: decision!,
      deadLetter,
      applied,
    };
  }

  /**
   * Records a recovery decision as an event for audit purposes.
   * The event includes all decision metadata for later analysis
   * and replay.
   *
   * @param decision - The decision record to persist
   * @param execution - Optional execution record to use for traceId (avoids TOCTOU if passed)
   */
  private recordDecision(decision: RecoveryDecisionRecord, execution?: ExecutionRecord): void {
    // Use passed execution to avoid TOCTOU, only fall back to store read if not provided
    const executionRecord = execution ?? this.store.dispatch.getExecution(decision.executionId);
    this.store.event.insertEvent({
      id: newId("evt"),
      taskId: decision.taskId,
      executionId: decision.executionId,
      eventType: "recovery:decision_recorded",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({
        decisionId: decision.decisionId,
        action: decision.action,
        reason: decision.reason,
        decidedAt: decision.decidedAt,
        decidedBy: decision.decidedBy,
      }),
      traceId: executionRecord?.traceId ?? null,
      createdAt: decision.decidedAt,
    });
  }

  private requireExecution(executionId: string): ExecutionRecord {
    const execution = this.store.dispatch.getExecution(executionId);
    if (!execution) {
      throw new StorageError("storage.execution_not_found", `Execution not found: ${executionId}`, {
        details: { executionId },
        executionId,
      });
    }
    return execution;
  }

  private requireRecoveryCandidate(taskId: string, executionId: string): RuntimeRecoveryCandidate {
    const recoveryView = this.recoveryService.buildRuntimeRecoveryView(taskId);
    const candidate = recoveryView.candidates.find((item) => item.executionId === executionId);
    if (!candidate) {
      throw new StorageError("runtime.recovery_candidate_not_found", `Recovery candidate not found: ${executionId}`, {
        details: { executionId },
        executionId,
      });
    }
    return candidate;
  }
}

/**
 * Moves an execution to the dead letter queue, preserving all
 * error information and creating a record for manual inspection.
 *
 * The execution is marked as failed, a dead letter record is
 * created with retry count and error details, and an event is
 * emitted for the transition.
 *
 * @param store - Data store for modifications
 * @param execution - The execution to move
 * @param candidate - The recovery candidate with error details
 * @param decision - The decision that triggered this action
 * @returns The created dead letter record
 */
function moveExecutionToDeadLetter(
  store: AuthoritativeTaskStore,
  execution: ExecutionRecord,
  candidate: RuntimeRecoveryCandidate,
  decision: RecoveryDecisionRecord,
): {
  deadLetter: DeadLetterRecord;
  failureMemoryInput: FailureMemoryInput;
} {
  // Determine error code from various sources (precheck denial takes precedence)
  const errorCode = candidate.latestErrorCode ?? candidate.latestPrecheck?.reasonCode ?? "runtime.recovery_required";

  // Build error message based on the reason type
  const errorMessage =
    candidate.reason.startsWith("execution_error:")
      ? execution.lastErrorMessage
      : candidate.reason.startsWith("precheck_denied:")
        ? `precheck denied: ${candidate.latestPrecheck?.reasonCode ?? "unknown"}`
        : `execution moved to dead letter: ${candidate.reason}`;

  transitionExecutionToTerminalStatus(store, execution, {
    nextStatus: "failed",
    occurredAt: decision.decidedAt,
    reasonCode: errorCode,
    errorMessage: errorMessage ?? null,
  });

  // Create the dead letter record with all context
  const existingDeadLetter = findDeadLetterByExecutionId(store, execution);
  const deadLetter: DeadLetterRecord = existingDeadLetter ?? {
    id: newId("dlq"),
    executionId: execution.id,
    taskId: execution.taskId,
    finalReasonCode: errorCode,
    retryCount: execution.attempt,
    lastErrorMessage: errorMessage,
    movedAt: decision.decidedAt,
  };
  if (existingDeadLetter == null) {
    store.execution.insertDeadLetter(deadLetter);
  }

  const failureMemoryInput: FailureMemoryInput = {
    taskId: execution.taskId,
    executionId: execution.id,
    agentId: execution.agentId,
    reasonCode: deadLetter.finalReasonCode,
    errorMessage: errorMessage ?? null,
    occurredAt: decision.decidedAt,
  };

  // Emit the dead letter event for audit trail
  store.event.insertEvent({
    id: newId("evt"),
    taskId: execution.taskId,
    executionId: execution.id,
    eventType: "recovery:dead_lettered",
    eventTier: "tier_2",
    payloadJson: JSON.stringify({
      decisionId: decision.decisionId,
      deadLetterId: deadLetter.id,
      finalReasonCode: deadLetter.finalReasonCode,
      retryCount: deadLetter.retryCount,
    }),
    traceId: execution.traceId,
    createdAt: decision.decidedAt,
  });

  return { deadLetter, failureMemoryInput };
}

interface FailureMemoryInput {
  taskId: string;
  executionId: string;
  agentId: string;
  reasonCode: string;
  errorMessage: string | null;
  occurredAt: string;
}

function transitionExecutionToTerminalStatus(
  store: AuthoritativeTaskStore,
  execution: ExecutionRecord,
  input: {
    nextStatus: "failed" | "cancelled";
    occurredAt: string;
    reasonCode: string | null;
    errorMessage: string | null;
  },
): void {
  executionStateMachine.assertTransition(execution.status, input.nextStatus);
  const executionRepository = store.execution as typeof store.execution & Partial<{
    updateExecutionStatusCas: (
      executionId: string,
      expectedStatus: string,
      status: string,
      updatedAt: string,
      startedAt?: string | null,
      finishedAt?: string | null,
      lastErrorCode?: string | null,
    ) => number;
    updateExecutionFailureDetails: (payload: {
      executionId: string;
      updatedAt: string;
      finishedAt: string | null;
      lastErrorCode: string | null;
      lastErrorMessage: string | null;
    }) => void;
  }>;
  if (typeof executionRepository.updateExecutionStatusCas === "function") {
    const affected = executionRepository.updateExecutionStatusCas(
      execution.id,
      execution.status,
      input.nextStatus,
      input.occurredAt,
      null,
      input.occurredAt,
      input.reasonCode,
    );
    if (affected === 0) {
      throw new StorageError(
        "runtime.recovery.execution_transition_conflict",
        `Execution transition conflict: ${execution.id} ${execution.status} -> ${input.nextStatus}`,
        {
          executionId: execution.id,
          details: { fromStatus: execution.status, toStatus: input.nextStatus },
          retryable: true,
        },
      );
    }
    if (typeof executionRepository.updateExecutionFailureDetails === "function") {
      executionRepository.updateExecutionFailureDetails({
        executionId: execution.id,
        updatedAt: input.occurredAt,
        finishedAt: input.occurredAt,
        lastErrorCode: input.reasonCode,
        lastErrorMessage: input.errorMessage,
      });
    } else {
      executionRepository.updateExecutionFailure({
        executionId: execution.id,
        status: input.nextStatus,
        updatedAt: input.occurredAt,
        finishedAt: input.occurredAt,
        lastErrorCode: input.reasonCode,
        lastErrorMessage: input.errorMessage,
      });
    }
  } else {
    executionRepository.updateExecutionFailure({
      executionId: execution.id,
      status: input.nextStatus,
      updatedAt: input.occurredAt,
      finishedAt: input.occurredAt,
      lastErrorCode: input.reasonCode,
      lastErrorMessage: input.errorMessage,
    });
  }
}

function findDeadLetterByExecutionId(store: AuthoritativeTaskStore, execution: ExecutionRecord): DeadLetterRecord | null {
  const executionRepository = store.execution as typeof store.execution & Partial<{
    getDeadLetterByExecutionId: (executionId: string) => DeadLetterRecord | null | undefined;
  }>;
  if (typeof executionRepository.getDeadLetterByExecutionId === "function") {
    return executionRepository.getDeadLetterByExecutionId(execution.id) ?? null;
  }
  return store.dispatch
    .listDeadLettersByTask(execution.taskId)
    .find((deadLetter) => deadLetter.executionId === execution.id) ?? null;
}
