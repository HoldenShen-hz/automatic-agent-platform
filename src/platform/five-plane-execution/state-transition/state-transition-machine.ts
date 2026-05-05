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
   * Allows no-op transitions (current === next) when either:
   * - The state explicitly allows self-transition (e.g., running: ["running", "completed"])
   * - The state is terminal (has no outbound transitions)
   *
   * For non-terminal states without explicit self-transition, noop transitions
   * are denied since they may indicate a logic error in the caller.
   */
  public assertTransition(current: TState, next: TState): void {
    if (current === next) {
      // Allow noop transitions when:
      // 1. The state explicitly allows self-transition (self in allowed list)
      // 2. The state is terminal (no outbound transitions at all)
      const allowed = this.transitions[current];
      const isTerminalState = !allowed || allowed.length === 0;
      if (isTerminalState || (allowed && allowed.includes(next))) {
        return;
      }
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
