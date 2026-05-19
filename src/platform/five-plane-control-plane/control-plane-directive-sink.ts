import type { DecisionDirective, OperationalDirective } from "../contracts/control-directive/index.js";
import { StructuredLogger } from "../shared/observability/structured-logger.js";

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
  private readonly logger = new StructuredLogger({ retentionLimit: 50 });

  emitOperationalDirective(directive: OperationalDirective): void {
    this.logger.warn("control_plane.directive_dropped", {
      data: {
        directiveType: directive.type,
        directiveId: directive.operationalDirectiveId,
        scope: directive.scope,
        kind: "operational",
      },
    });
  }

  emitDecisionDirective(directive: DecisionDirective): void {
    this.logger.warn("control_plane.directive_dropped", {
      data: {
        directiveType: directive.type,
        directiveId: directive.decisionDirectiveId,
        targetRef: directive.targetRef,
        kind: "decision",
      },
    });
  }
}

/**
 * Creates a no-op directive sink.
 * Convenience factory for cases where P2 operates standalone without P3/P4.
 */
export function createNoOpDirectiveSink(): ControlPlaneDirectiveSink {
  return new NoOpControlPlaneDirectiveSink();
}
