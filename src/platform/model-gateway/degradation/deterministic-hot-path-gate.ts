import type { InteractionAutonomyMode } from "../../contracts/types/unified-runtime-mode.js";
import { enforceResponsibilityBoundary, type ResponsibilityBoundary } from "../../../domains/domain-specs.js";

export interface HotPathExecutionRequest {
  readonly routeId: string;
  readonly latencyClass: "normal" | "low_latency";
  readonly usesLlmHotPath: boolean;
  readonly deterministicFallbackAvailable: boolean;
  /** Allowed autonomy level per §3.2 responsibility boundary */
  readonly allowedAutonomyLevel: InteractionAutonomyMode;
  /** Responsibility boundary for the domain per §3.2 */
  readonly responsibilityBoundary?: ResponsibilityBoundary;
}

export interface HotPathExecutionDecision {
  readonly allowed: boolean;
  readonly routeMode: "llm_allowed" | "deterministic_hot_path_only";
  readonly reasonCode:
    | "hot_path.allowed"
    | "hot_path.llm_blocked"
    | "hot_path.no_deterministic_fallback"
    | "hot_path.autonomy_exceeded"
    | "hot_path.responsibility_boundary_blocked";
}

/** Autonomy levels that permit LLM hot path execution */
const LLM_AUTONOMY_LEVELS = new Set<InteractionAutonomyMode>(["full_auto", "semi_auto"]);

/** Autonomy levels that require deterministic fallback in low-latency scenarios */
const SUPERVISED_AUTONOMY_LEVELS = new Set<InteractionAutonomyMode>(["supervised", "suggestion", "frozen"]);

export class DeterministicHotPathGate {
  public evaluate(request: HotPathExecutionRequest): HotPathExecutionDecision {
    // R13-41 FIX: Enforce responsibility boundary per §3.2
    // Map allowedAutonomyLevel to the corresponding autonomy proposal
    const autonomyProposal = this.mapAutonomyLevel(request.allowedAutonomyLevel);

    // If a responsibility boundary is specified, enforce it
    if (request.responsibilityBoundary) {
      const boundaryViolation = enforceResponsibilityBoundary(
        request.responsibilityBoundary,
        autonomyProposal,
      );
      if (boundaryViolation !== null) {
        return {
          allowed: false,
          routeMode: "deterministic_hot_path_only",
          reasonCode: "hot_path.responsibility_boundary_blocked",
        };
      }
    }

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

  /**
   * Maps InteractionAutonomyMode to the autonomy proposal expected by enforceResponsibilityBoundary.
   */
  private mapAutonomyLevel(level: InteractionAutonomyMode): "full_auto" | "llm_assisted" | "human_required" {
    switch (level) {
      case "full_auto":
        return "full_auto";
      case "semi_auto":
        return "llm_assisted";
      case "supervised":
      case "suggestion":
      case "frozen":
        return "human_required";
      default:
        return "human_required";
    }
  }
}
