/**
 * @fileoverview Generic State Transition Machine - Validates entity state transitions.
 *
 * A simple state machine that validates transitions against an allowed transition map.
 * Used by TransitionService to enforce valid state transitions for tasks, workflows,
 * sessions, executions, and approvals.
 *
 * ## Usage
 *
 * Create a state machine with allowed transitions:
 * ```
 * const machine = new StateTransitionMachine("task", {
 *   queued: ["pending", "in_progress", "cancelled"],
 *   in_progress: ["done", "failed", "cancelled"],
 *   // ...
 * });
 * machine.assertTransition("queued", "in_progress"); // ok
 * machine.assertTransition("queued", "done"); // throws
 * ```
 *
 * @see Transition Service Contract: docs_zh/contracts/transition_service_contract.md
 */
/**
 * Generic state transition machine for validating entity state changes.
 *
 * Takes an entity kind name and a map of allowed transitions, then validates
 * any proposed transition against that map. Throws if the transition
 * is not allowed.
 */
export declare class StateTransitionMachine<TState extends string> {
    private readonly entityKind;
    private readonly transitions;
    constructor(entityKind: string, transitions: Record<TState, readonly TState[]>);
    /**
     * Asserts that a transition is valid, throwing WorkflowStateError if not.
     * Idempotent - returns without error if current === next (no-op transition).
     */
    assertTransition(current: TState, next: TState): void;
}
