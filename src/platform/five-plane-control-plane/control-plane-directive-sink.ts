import type { DecisionDirective, OperationalDirective } from "../contracts/control-directive/index.js";

export interface ControlPlaneDirectiveSink {
  emitOperationalDirective(directive: OperationalDirective): void;
  emitDecisionDirective(directive: DecisionDirective): void;
}

