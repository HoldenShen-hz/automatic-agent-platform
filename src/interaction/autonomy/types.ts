export type AutonomyLevel =
  | "manual"
  | "suggestion"
  | "supervised"
  | "semi_auto"
  | "auto"
  | "full_auto"
  | "frozen";

export interface AutonomyDecision {
  readonly decisionId: string;
  readonly taskId: string;
  readonly level: AutonomyLevel;
  readonly reason: string;
  readonly timestamp: string;
  readonly actor: string;
}

export interface EscalationRequest {
  readonly taskId: string;
  readonly reason: string;
  readonly targetLevel: "manual" | "supervised" | "semi_auto" | "auto" | "full_auto";
}
