import type {
  BoundaryAction,
  ResponsibilityActorType,
} from "../../contracts/types/responsibility-boundary.js";

export interface HotPathExecutionRequest {
  readonly routeId: string;
  readonly latencyClass: "normal" | "low_latency";
  readonly usesLlmHotPath: boolean;
  readonly deterministicFallbackAvailable: boolean;
  readonly responsibilityBoundaryId?: string;
  readonly actorType?: ResponsibilityActorType;
  readonly boundaryAction?: BoundaryAction;
  readonly responsibilityBoundaryService?: {
    assertActionAllowed(boundaryId: string, action: BoundaryAction, actorType: ResponsibilityActorType): void;
  };
  readonly allowedAutonomyLevel?: "frozen" | "suggestion" | "supervised" | "semi_auto" | "full_auto";
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

export class DeterministicHotPathGate {
  public evaluate(request: HotPathExecutionRequest): HotPathExecutionDecision {
    if (
      request.usesLlmHotPath
      && request.responsibilityBoundaryId != null
      && request.responsibilityBoundaryService != null
      && request.actorType != null
    ) {
      try {
        request.responsibilityBoundaryService.assertActionAllowed(
          request.responsibilityBoundaryId,
          request.boundaryAction ?? "execute_ai_action",
          request.actorType,
        );
      } catch {
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
    if (
      request.usesLlmHotPath
      && request.allowedAutonomyLevel != null
      && request.allowedAutonomyLevel !== "semi_auto"
      && request.allowedAutonomyLevel !== "full_auto"
    ) {
      return {
        allowed: false,
        routeMode: "deterministic_hot_path_only",
        reasonCode: "hot_path.autonomy_exceeded",
      };
    }
    if (
      !request.usesLlmHotPath
      && (request.allowedAutonomyLevel === "semi_auto" || request.allowedAutonomyLevel === "full_auto")
    ) {
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
