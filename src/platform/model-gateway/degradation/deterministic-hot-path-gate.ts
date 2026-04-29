import type { InteractionAutonomyMode } from "../../contracts/types/unified-runtime-mode.js";

export interface HotPathExecutionRequest {
  readonly routeId: string;
  readonly latencyClass: "normal" | "low_latency";
  readonly usesLlmHotPath: boolean;
  readonly deterministicFallbackAvailable: boolean;
  /** Allowed autonomy level per §3.2 responsibility boundary */
  readonly allowedAutonomyLevel: InteractionAutonomyMode;
}

export interface HotPathExecutionDecision {
  readonly allowed: boolean;
  readonly routeMode: "llm_allowed" | "deterministic_hot_path_only";
  readonly reasonCode:
    | "hot_path.allowed"
    | "hot_path.llm_blocked"
    | "hot_path.no_deterministic_fallback"
    | "hot_path.autonomy_exceeded";
}

/** Autonomy levels that permit LLM hot path execution */
const LLM_AUTONOMY_LEVELS = new Set<InteractionAutonomyMode>(["full_auto", "semi_auto"]);

/** Autonomy levels that require deterministic fallback in low-latency scenarios */
const SUPERVISED_AUTONOMY_LEVELS = new Set<InteractionAutonomyMode>(["supervised", "suggestion", "frozen"]);

export class DeterministicHotPathGate {
  public evaluate(request: HotPathExecutionRequest): HotPathExecutionDecision {
    if (request.latencyClass !== "low_latency") {
      return { allowed: true, routeMode: "llm_allowed", reasonCode: "hot_path.allowed" };
    }

    // R13-41: Runtime enforcement of autonomy boundary per §3.2
    // Block LLM hot path if agent's allowed autonomy level does not permit it
    if (request.usesLlmHotPath) {
      if (!LLM_AUTONOMY_LEVELS.has(request.allowedAutonomyLevel)) {
        return {
          allowed: false,
          routeMode: "deterministic_hot_path_only",
          reasonCode: "hot_path.autonomy_exceeded",
        };
      }
      // Latency routing: LLM hot path not permitted in low_latency class
      return {
        allowed: false,
        routeMode: "deterministic_hot_path_only",
        reasonCode: "hot_path.llm_blocked",
      };
    }

    // Validate deterministic fallback is available for supervised autonomy levels
    if (SUPERVISED_AUTONOMY_LEVELS.has(request.allowedAutonomyLevel)) {
      if (!request.deterministicFallbackAvailable) {
        return {
          allowed: false,
          routeMode: "deterministic_hot_path_only",
          reasonCode: "hot_path.no_deterministic_fallback",
        };
      }
    }

    // R16-23 FIX: When LLM hot path is not used and no blocking condition applies,
    // allowed=true with routeMode="llm_allowed" (not "deterministic_hot_path_only")
    // The contradiction was: allowed:true + routeMode:"deterministic_hot_path_only"
    // when LLM wasn't even being blocked (usesLlmHotPath=false).
    // Now routeMode correctly reflects that LLM is allowed when not explicitly blocked.
    return { allowed: true, routeMode: "llm_allowed", reasonCode: "hot_path.allowed" };
  }
}
