/**
 * Human Takeover Service
 *
 * Enables human operators to intervene in task execution by opening takeover sessions,
 * modifying inputs, switching workers, retrying executions, skipping steps, and
 * completing tasks with manual terminal states.
 *
 * All actions are recorded as audit events for accountability and traceability.
 * This service is the primary interface for the admin console to interact with
 * running tasks and workflows during incident response or manual intervention.
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/admin_console_and_human_takeover_contract.md | Human Takeover Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 */
import type { StepOutputRecord } from "../../contracts/types/domain.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { TaskTerminalStatus } from "../../contracts/types/status.js";
/**
 * Result of a takeover action operation.
 * Contains identifiers needed to track the action and its effects.
 */
export interface TakeoverActionResult {
    taskId: string;
    executionId: string | null;
    takeoverSessionId: string;
    operatorActionId: string;
}
/**
 * HumanTakeoverService manages operator interventions in task execution.
 * Operators can take over tasks, modify their state, and guide them to completion.
 * All actions are recorded as audit events for accountability.
 *
 * The service maintains a session-based model where operators open a session
 * before performing multiple actions on a task. Each action is atomic and
 * recorded with before/after state snapshots for audit purposes.
 */
export declare class HumanTakeoverService {
    private readonly db;
    private readonly store;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore);
    /**
     * Opens a new takeover session for a task, enabling an operator to intervene.
     * Creates a session record, initial operator action, and tier-2 event for tracking.
     *
     * @param input - Contains taskId, operatorId making the takeover, and reasonCode
     * @returns TakeoverActionResult with session and action identifiers
     */
    openSession(input: {
        taskId: string;
        operatorId: string;
        reasonCode: string;
        tenantId?: string | null;
    }): TakeoverActionResult;
    /**
     * Modifies the input JSON for a task within an active takeover session.
     * The input is normalized to ensure valid JSON before storage.
     */
    modifyInput(input: {
        takeoverSessionId: string;
        inputJson: string;
        normalizedInputJson?: string;
        reasonCode: string;
        tenantId?: string | null;
    }): TakeoverActionResult;
    /**
     * Switches the worker agent assigned to the current execution.
     * Updates the execution record with the new agent ID while preserving execution history.
     */
    switchWorker(input: {
        takeoverSessionId: string;
        agentId: string;
        reasonCode: string;
        tenantId?: string | null;
    }): TakeoverActionResult;
    /**
     * Retries the current execution by creating a new execution record.
     * Supersedes the previous execution and increments the attempt counter.
     * The task is reset to pending state to allow re-processing.
     *
     * This allows operators to re-run a failed or stuck workflow from the
     * beginning or from a specific step, depending on the workflow's resume state.
     */
    retryExecution(input: {
        takeoverSessionId: string;
        reasonCode: string;
        tenantId?: string | null;
    }): TakeoverActionResult;
    /**
     * Moves the workflow to a different step, either by step ID or step index.
     * The workflow will resume from the specified step on next processing.
     * Useful for operators to skip problematic steps or redo steps out of order.
     */
    setCurrentStep(input: {
        takeoverSessionId: string;
        reasonCode: string;
        stepId?: string;
        stepIndex?: number;
        tenantId?: string | null;
    }): TakeoverActionResult;
    /**
     * Writes a manual step output for the current or specified step.
     * Allows operators to provide outputs directly, bypassing normal execution.
     * This is used when the operator wants to manually complete a step's work.
     */
    writeStepOutput(input: {
        takeoverSessionId: string;
        outputJson: string;
        reasonCode: string;
        stepId?: string;
        stepIndex?: number;
        status?: StepOutputRecord["status"];
        summary?: string;
        tenantId?: string | null;
    }): TakeoverActionResult;
    /**
     * Skips the current workflow step, recording it as partial success.
     * If this was the final step, transitions the entire task to done.
     * Otherwise, advances the workflow to the next step.
     *
     * This allows operators to bypass steps that cannot be executed in the
     * current environment or are otherwise not needed.
     */
    skipCurrentStep(input: {
        takeoverSessionId: string;
        note?: string;
        reasonCode: string;
        tenantId?: string | null;
    }): TakeoverActionResult;
    /**
     * Completes a task with a specified terminal status (done, failed, or cancelled).
     * The operator can optionally provide output JSON to store with the task.
     * Closes the takeover session after completing the task.
     *
     * This is the primary mechanism for operators to terminate tasks
     * that cannot be completed through normal execution.
     */
    completeTask(input: {
        takeoverSessionId: string;
        terminalStatus: TaskTerminalStatus;
        reasonCode: string;
        outputJson?: string;
        tenantId?: string | null;
    }): TakeoverActionResult;
    /**
     * Internal helper that records an operator action within a takeover session.
     * Captures before/after state snapshots and emits audit events.
     * All public action methods delegate to this to ensure consistent audit trails.
     *
     * The method loads the current state before the mutation, applies the mutation
     * within a database transaction, then captures the after state for comparison.
     */
    private recordAction;
    /**
     * Retrieves an active takeover session, throwing if not found or already closed.
     * Only open sessions can accept operator actions.
     */
    private requireOpenSession;
}
