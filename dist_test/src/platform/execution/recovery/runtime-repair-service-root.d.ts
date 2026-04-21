/**
 * Runtime Repair Service
 *
 * Applies repair actions identified by the startup consistency checker to fix
 * various runtime inconsistencies. This service is responsible for executing
 * recovery operations such as requeueing executions, reconciling dispatch
 * tickets, releasing stale locks, and rebuilding missing acknowledgements.
 *
 * The service operates transactionally where possible, ensuring that repair
 * operations are atomic and leave the system in a consistent state. Each
 * repair action generates a "recovery:repair_applied" event for audit trails.
 *
 * This service is typically invoked during startup or scheduled recovery
 * sweeps to automatically fix known consistency issues.
 *
 * @see {@link docs_zh/contracts/startup_consistency_and_recovery_drill_contract.md}
 * @see {@link docs_zh/contracts/runtime_state_machine_contract.md}
 * @see {@link docs_zh/contracts/runtime_execution_contract.md}
 * @see {@link docs_zh/contracts/event_bus_contract.md}
 * @see {@link docs_zh/architecture/00-platform-architecture.md}
 * @see {@link docs_zh/governance/glossary_and_terminology.md}
 */
import type { RepairAction, StartupConsistencyReport } from "../startup/startup-consistency-checker.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
/**
 * Result of applying a single repair action, including whether
 * the repair was successfully applied and details about the outcome.
 */
export interface RepairExecutionResult {
    /** The type of repair action that was applied */
    action: RepairAction["action"];
    /** The target entity ID the action was applied to */
    targetId: string;
    /** Whether the repair was successfully applied */
    applied: boolean;
    /** Human-readable description of the result */
    detail: string;
}
/**
 * Service responsible for applying repair actions to fix runtime
 * inconsistencies. Maintains an audit trail by emitting events
 * for each repair operation.
 *
 * The service uses a command pattern where each repair action type
 * has a dedicated handler method. All operations are transactional
 * where supported.
 */
export declare class RuntimeRepairService {
    private readonly db;
    private readonly store;
    private readonly eventOps;
    private readonly dispatch;
    private readonly dispatchReconciliation;
    private readonly leases;
    /**
     * Creates a new RuntimeRepairService instance.
     * @param db - SQLite database for transaction support
     * @param store - AuthoritativeTaskStore for data access and modifications
     */
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore);
    /**
     * Applies all repair actions from a startup consistency report.
     * Processes actions sequentially and returns results for each.
     *
     * @param report - The consistency report containing repair actions
     * @returns Array of results for each repair action that was attempted
     */
    apply(report: StartupConsistencyReport): Promise<RepairExecutionResult[]>;
    /**
     * Routes an action to the appropriate handler method based on action type.
     * Each action type has a dedicated private method for execution.
     *
     * @param action - The repair action to apply
     * @returns Result of the repair attempt
     */
    private applyAction;
    /**
     * Requeues an execution that was found to be in an inconsistent state.
     * Resets the execution to "created" status, updates the task to "pending",
     * restores workflow state if applicable, and reopens any closed sessions.
     *
     * @param action - The repair action targeting an execution
     * @param occurredAt - Timestamp for the operation
     * @returns Result indicating whether requeue was applied
     */
    private requeueExecution;
    private ensurePendingDispatchTicket;
    /**
     * Reconciles a dispatch ticket that is out of sync with the execution state.
     * Delegates to the ExecutionDispatchReconciliationService which determines
     * the appropriate resolution (requeue or invalidate).
     *
     * @param action - The repair action targeting a dispatch ticket
     * @param occurredAt - Timestamp for the operation
     * @returns Result with details about ticket reconciliation
     */
    private reconcileDispatchTicket;
    private reconcileTerminalState;
    /**
     * Closes an orphan session that has no associated active execution.
     * An orphan session is one that was left in a non-terminal state
     * after its execution ended.
     *
     * @param action - The repair action targeting a session
     * @param occurredAt - Timestamp for the operation
     * @returns Result indicating whether session was closed
     */
    private closeOrphanSession;
    private replaceTerminalSession;
    /**
     * Releases a stale file lock that was left behind by a crashed worker.
     * File locks prevent concurrent access to resources and must be
     * released when workers crash to avoid resource leaks.
     *
     * @param action - The repair action targeting a file lock
     * @param occurredAt - Timestamp for the operation
     * @returns Result indicating whether lock was released
     */
    private releaseStaleLock;
    /**
     * Rebuilds missing acknowledgements for tier-1 events. Tier-1 events
     * require explicit acknowledgement from registered consumers. If a
     * consumer crashed before acknowledging, this repair ensures the
     * acknowledgement is pending again so it can be processed.
     *
     * The repair drains the default consumers after rebuilding acks to
     * ensure pending work is processed.
     *
     * @param action - The repair action targeting an event
     * @param occurredAt - Timestamp for the operation
     * @returns Result with before/after pending acknowledgement counts
     */
    private rebuildAck;
}
