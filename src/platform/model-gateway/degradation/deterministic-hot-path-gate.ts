export interface HotPathExecutionRequest {
  readonly routeId: string;
  readonly latencyClass: "normal" | "low_latency";
  readonly usesLlmHotPath: boolean;
  readonly deterministicFallbackAvailable: boolean;
}

export interface HotPathExecutionDecision {
  readonly allowed: boolean;
  readonly routeMode: "llm_allowed" | "deterministic_hot_path_only";
  readonly reasonCode: "hot_path.allowed" | "hot_path.llm_blocked" | "hot_path.no_deterministic_fallback";
}

export class DeterministicHotPathGate {
  public evaluate(request: HotPathExecutionRequest): HotPathExecutionDecision {
    if (request.latencyClass !== "low_latency") {
      return { allowed: true, routeMode: "llm_allowed", reasonCode: "hot_path.allowed" };
    }
    if (!request.deterministicFallbackAvailable) {
      return {
        allowed: false,
        routeMode: "deterministic_hot_path_only",
        reasonCode: "hot_path.no_deterministic_fallback",
      };
    }
    // R16-23 fix: allowed:true with routeMode:"deterministic_hot_path_only" is contradictory.
    // When LLM hot path is not used but fallback is available, the request should be allowed
    // with routeMode "llm_allowed" since the LLM path is still available (just not being used).
    if (request.usesLlmHotPath) {
      return {
        allowed: false,
        routeMode: "deterministic_hot_path_only",
        reasonCode: "hot_path.llm_blocked",
      };
    }
    return { allowed: true, routeMode: "llm_allowed", reasonCode: "hot_path.allowed" };
  }
}
