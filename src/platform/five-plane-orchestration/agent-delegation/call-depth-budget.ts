export interface CallDepthBudgetRequest {
  readonly currentCallDepth: number;
  readonly goalDecompositionDepth: number;
  readonly delegationDepth: number;
}

export interface CallDepthBudgetDecision {
  readonly allowed: boolean;
  readonly effectiveCallDepth: number;
  readonly maxCallDepth: 8;
  readonly reasonCode: "call_depth.allowed" | "call_depth.exceeded";
}

export class CallDepthBudget {
  private readonly maxCallDepth = 8 as const;

  public evaluate(request: CallDepthBudgetRequest): CallDepthBudgetDecision {
    const effectiveCallDepth = Math.max(
      request.currentCallDepth,
      request.goalDecompositionDepth,
      request.delegationDepth,
    );
    return {
      allowed: effectiveCallDepth <= this.maxCallDepth,
      effectiveCallDepth,
      maxCallDepth: this.maxCallDepth,
      reasonCode: effectiveCallDepth <= this.maxCallDepth ? "call_depth.allowed" : "call_depth.exceeded",
    };
  }
}
