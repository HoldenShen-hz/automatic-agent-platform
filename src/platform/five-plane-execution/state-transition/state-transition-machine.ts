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

import { WorkflowStateError } from "../../contracts/errors.js";

/**
 * Generic state transition machine for validating entity state changes.
 *
 * Takes an entity kind name and a map of allowed transitions, then validates
 * any proposed transition against that map. Throws if the transition
 * is not allowed.
 */
export class StateTransitionMachine<TState extends string> {
  public constructor(
    private readonly entityKind: string,
    private readonly transitions: Record<TState, readonly TState[]>,
  ) {}

  /**
   * Asserts that a transition is valid, throwing WorkflowStateError if not.
   *
   * No-op transitions (current === next) are only allowed when the state
   * explicitly includes self in its allowed transitions list.
   * This prevents accidental noop transitions that may indicate a logic error.
   */
  public assertTransition(current: TState, next: TState): void {
    if (current === next) {
      // No-op transitions are never allowed, even if self-transition is listed
      // in the allowed list. This matches RuntimeStateMachine behavior which
      // always rejects no-op transitions (see assertTransitionAllowed).
      throw new WorkflowStateError(`${this.entityKind}.noop_transition_denied`, `${this.entityKind}.noop_transition_denied: No-op transition is not allowed: ${current} -> ${next}`, {
        details: { entityKind: this.entityKind, current, next },
      });
    } else if (!this.transitions[current]?.includes(next)) {
      throw new WorkflowStateError(`${this.entityKind}.invalid_transition`, `${this.entityKind}.invalid_transition: Invalid transition: ${current} -> ${next}`, {
        details: { entityKind: this.entityKind, current, next },
      });
    }
  }
}
