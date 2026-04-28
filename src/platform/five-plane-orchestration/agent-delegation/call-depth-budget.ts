import { DEFAULT_MAX_DEPTH } from "./topology-validator.js";

export interface CallDepthBudgetRequest {
  readonly currentCallDepth: number;
  readonly goalDecompositionDepth: number;
  readonly delegationDepth: number;
}

export interface CallDepthBudgetDecision {
  readonly allowed: boolean;
  readonly effectiveCallDepth: number;
  readonly maxCallDepth: typeof DEFAULT_MAX_DEPTH;
  readonly reasonCode: "call_depth.allowed" | "call_depth.exceeded";
}

export class CallDepthBudget {
  private readonly maxCallDepth = DEFAULT_MAX_DEPTH;

  public evaluate(request: CallDepthBudgetRequest): CallDepthBudgetDecision {
    // §19.2: Proper summation for call depth (not Math.max)
    const effectiveCallDepth =
      request.currentCallDepth +
      request.goalDecompositionDepth +
      request.delegationDepth;
    return {
      allowed: effectiveCallDepth <= this.maxCallDepth,
      effectiveCallDepth,
      maxCallDepth: this.maxCallDepth,
      reasonCode: effectiveCallDepth <= this.maxCallDepth ? "call_depth.allowed" : "call_depth.exceeded",
    };
  }
}
