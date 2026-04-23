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
import { MemoryService } from "../../state-evidence/memory/memory-service.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { RuntimeRecoveryService, } from "./runtime-recovery-service-root.js";
import { StorageError } from "../../contracts/errors.js";
/**
 * Service responsible for making and applying recovery decisions.
 * Uses RuntimeRecoveryService to analyze candidates and determine
 * appropriate actions, then applies those actions to the system state.
 *
 * This service ensures all recovery operations are properly recorded
 * with decision events for traceability and auditing.
 */
export class RuntimeRecoveryDecisionService {
    db;
    store;
    recoveryService;
    /**
     * Creates a new RuntimeRecoveryDecisionService instance.
     * @param db - SQLite database for transaction support
     * @param store - AuthoritativeTaskStore for data access and modifications
     */
    constructor(db, store) {
        this.db = db;
        this.store = store;
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
    decide(executionId, decidedBy = "runtime_recovery_decision_service") {
        const execution = this.store.dispatch.getExecution(executionId);
        if (!execution) {
            throw new StorageError("storage.execution_not_found", `Execution not found: ${executionId}`, {
                details: { executionId },
                executionId,
            });
        }
        // Find the recovery candidate for this execution
        const candidate = this.recoveryService
            .buildRuntimeRecoveryView(execution.taskId)
            .candidates.find((item) => item.executionId === executionId);
        if (!candidate) {
            throw new StorageError("runtime.recovery_candidate_not_found", `Recovery candidate not found: ${executionId}`, {
                details: { executionId },
                executionId,
            });
        }
        // Build the decision record from candidate's suggested action
        const decision = {
            decisionId: newId("rdec"),
            executionId,
            taskId: execution.taskId,
            reason: candidate.reason,
            action: candidate.suggestedAction,
            decidedAt: nowIso(),
            decidedBy,
        };
        // Record the decision for audit trail
        this.recordDecision(decision);
        return decision;
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
    apply(executionId, decidedBy = "runtime_recovery_decision_service") {
        const execution = this.store.dispatch.getExecution(executionId);
        if (!execution) {
            throw new StorageError("storage.execution_not_found", `Execution not found: ${executionId}`, {
                details: { executionId },
                executionId,
            });
        }
        // Find the recovery candidate for this execution
        const candidate = this.recoveryService
            .buildRuntimeRecoveryView(execution.taskId)
            .candidates.find((item) => item.executionId === executionId);
        if (!candidate) {
            throw new StorageError("runtime.recovery_candidate_not_found", `Recovery candidate not found: ${executionId}`, {
                details: { executionId },
                executionId,
            });
        }
        // Build the decision record
        const decision = {
            decisionId: newId("rdec"),
            executionId,
            taskId: execution.taskId,
            reason: candidate.reason,
            action: candidate.suggestedAction,
            decidedAt: nowIso(),
            decidedBy,
        };
        let deadLetter = null;
        let applied = false;
        // Execute the action within a transaction
        this.db.transaction(() => {
            // Always record the decision first for audit
            this.recordDecision(decision);
            // Handle move to dead letter action
            if (decision.action === "move_dead_letter") {
                deadLetter = moveExecutionToDeadLetter(this.store, execution, candidate, decision);
                applied = true;
                return;
            }
            // Handle cancellation action
            if (decision.action === "cancel") {
                // Determine the appropriate error code and message
                this.store.execution.updateExecutionFailure({
                    executionId: execution.id,
                    status: "cancelled",
                    updatedAt: decision.decidedAt,
                    finishedAt: decision.decidedAt,
                    lastErrorCode: candidate.latestPrecheck?.reasonCode ?? execution.lastErrorCode,
                    lastErrorMessage: candidate.reason.startsWith("precheck_denied:")
                        ? `precheck denied: ${candidate.latestPrecheck?.reasonCode ?? "unknown"}`
                        : execution.lastErrorMessage,
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
        return {
            decision,
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
     */
    recordDecision(decision) {
        const execution = this.store.dispatch.getExecution(decision.executionId);
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
            traceId: execution?.traceId ?? null,
            createdAt: decision.decidedAt,
        });
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
function moveExecutionToDeadLetter(store, execution, candidate, decision) {
    // Determine error code from various sources (precheck denial takes precedence)
    const errorCode = candidate.latestErrorCode ?? candidate.latestPrecheck?.reasonCode ?? "runtime.recovery_required";
    // Build error message based on the reason type
    const errorMessage = candidate.reason.startsWith("execution_error:")
        ? execution.lastErrorMessage
        : candidate.reason.startsWith("precheck_denied:")
            ? `precheck denied: ${candidate.latestPrecheck?.reasonCode ?? "unknown"}`
            : `execution moved to dead letter: ${candidate.reason}`;
    // Mark the execution as failed
    store.execution.updateExecutionFailure({
        executionId: execution.id,
        status: "failed",
        updatedAt: decision.decidedAt,
        finishedAt: decision.decidedAt,
        lastErrorCode: errorCode,
        lastErrorMessage: errorMessage,
    });
    // Create the dead letter record with all context
    const deadLetter = {
        id: newId("dlq"),
        executionId: execution.id,
        taskId: execution.taskId,
        finalReasonCode: errorCode,
        retryCount: execution.attempt,
        lastErrorMessage: errorMessage,
        movedAt: decision.decidedAt,
    };
    store.execution.insertDeadLetter(deadLetter);
    new MemoryService(store).recordFailureMemory({
        taskId: execution.taskId,
        executionId: execution.id,
        agentId: execution.agentId,
        reasonCode: deadLetter.finalReasonCode,
        errorMessage: errorMessage ?? null,
        occurredAt: decision.decidedAt,
    });
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
    return deadLetter;
}
//# sourceMappingURL=runtime-recovery-decision-service-root.js.map