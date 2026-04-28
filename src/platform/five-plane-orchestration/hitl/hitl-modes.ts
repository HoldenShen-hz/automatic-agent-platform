export const HITL_MODES = [
  "single_approval",
  "multi_party_approval",
  "delegated_approval",
  "iterative_feedback",
  "collaborative_edit",
  "informed_confirmation",
  "circuit_breaker_human",
] as const;

export type HitlMode = typeof HITL_MODES[number];

export interface HitlModeConstraint {
  readonly mode: HitlMode;
  readonly summary: string;
}

export function validateHitlModeRequest(input: {
  readonly mode: HitlMode;
  readonly options: readonly { optionId: string }[];
  readonly riskLevel: "low" | "medium" | "high" | "critical";
  readonly timeoutPolicy: "reject" | "approve" | "remain_pending";
  readonly context?: Record<string, unknown> & {
    readonly breakGlassApproved?: boolean;
  };
}): HitlModeConstraint {
  switch (input.mode) {
    case "single_approval":
      if (input.options.length < 1) {
        throw new Error("hitl_mode.single_approval_requires_option");
      }
      return { mode: input.mode, summary: "Single approval request is ready for dispatch." };
    case "multi_party_approval":
      if (!Number.isInteger(Number(input.context?.requiredApprovals)) || Number(input.context?.requiredApprovals) < 2) {
        throw new Error("hitl_mode.multi_party_required_approvals_invalid");
      }
      return { mode: input.mode, summary: "Multi-party approval requires multiple approvers." };
    case "delegated_approval":
      if (typeof input.context?.delegationTarget !== "string" || input.context.delegationTarget.length === 0) {
        throw new Error("hitl_mode.delegation_target_required");
      }
      return { mode: input.mode, summary: "Delegated approval will route to a designated delegate." };
    case "iterative_feedback":
      if (input.options.length < 2) {
        throw new Error("hitl_mode.iterative_feedback_requires_revision_option");
      }
      return { mode: input.mode, summary: "Iterative feedback mode supports revision-oriented loops." };
    case "collaborative_edit":
      if (typeof input.context?.sharedArtifactRef !== "string" || input.context.sharedArtifactRef.length === 0) {
        throw new Error("hitl_mode.shared_artifact_required");
      }
      return { mode: input.mode, summary: "Collaborative edit mode is bound to a shared artifact." };
    case "informed_confirmation":
      if (input.options.length !== 1) {
        throw new Error("hitl_mode.informed_confirmation_single_option_required");
      }
      return { mode: input.mode, summary: "Informed confirmation requires a single confirmation decision." };
    case "circuit_breaker_human":
      if (input.riskLevel !== "high" && input.riskLevel !== "critical") {
        throw new Error("hitl_mode.circuit_breaker_requires_high_risk");
      }
      if (input.timeoutPolicy === "approve" && input.context?.breakGlassApproved !== true) {
        throw new Error("hitl_mode.circuit_breaker_auto_approve_forbidden");
      }
      return { mode: input.mode, summary: "Circuit-breaker mode requires a blocking human decision." };
  }
}
