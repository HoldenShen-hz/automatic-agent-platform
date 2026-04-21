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
import type { DeadLetterRecord } from "../../contracts/types/domain.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { type RecoverySuggestedAction } from "./runtime-recovery-service-root.js";
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
export declare class RuntimeRecoveryDecisionService {
    private readonly db;
    private readonly store;
    private readonly recoveryService;
    /**
     * Creates a new RuntimeRecoveryDecisionService instance.
     * @param db - SQLite database for transaction support
     * @param store - AuthoritativeTaskStore for data access and modifications
     */
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore);
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
    decide(executionId: string, decidedBy?: string): RecoveryDecisionRecord;
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
    apply(executionId: string, decidedBy?: string): RecoveryDecisionApplyResult;
    /**
     * Records a recovery decision as an event for audit purposes.
     * The event includes all decision metadata for later analysis
     * and replay.
     *
     * @param decision - The decision record to persist
     */
    private recordDecision;
}
