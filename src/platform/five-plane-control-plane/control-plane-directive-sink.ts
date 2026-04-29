import type { DecisionDirective, OperationalDirective } from "../contracts/control-directive/index.js";

export interface ControlPlaneDirectiveSink {
  emitOperationalDirective(directive: OperationalDirective): void;
  emitDecisionDirective(directive: DecisionDirective): void;
}

/**
 * No-op implementation of ControlPlaneDirectiveSink.
 * Used when P2 modules operate without downstream P3/P4 directive consumers.
 * This enables P2 modules to emit directives conditionally without null checks.
 *
 * @example
 * ```ts
 * const directiveSink = isProductionEnvironment()
 *   ? createRealDirectiveSink()
 *   : createNoOpDirectiveSink();
 * ```
 */
export class NoOpControlPlaneDirectiveSink implements ControlPlaneDirectiveSink {
  emitOperationalDirective(_directive: OperationalDirective): void {
    // No-op: directives are dropped in environments without P3/P4 consumers
  }

  emitDecisionDirective(_directive: DecisionDirective): void {
    // No-op: directives are dropped in environments without P3/P4 consumers
  }
}

/**
 * Creates a no-op directive sink.
 * Convenience factory for cases where P2 operates standalone without P3/P4.
 */
export function createNoOpDirectiveSink(): ControlPlaneDirectiveSink {
  return new NoOpControlPlaneDirectiveSink();
}

