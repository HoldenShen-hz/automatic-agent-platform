export const HITL_MODES = [
  "single_approval",
  "multi_party_approval",
  "delegated_approval",
  "iterative_feedback",
  "collaborative_edit",
  "informed_confirmation",
  "circuit_breaker_human",
  // R13-34/R13-37/R13-38: Add §45.18 HITL 5-capability modes
  "modify_and_approve",
  "override_decision",
  "force_terminate",
] as const;

export type HitlMode = typeof HITL_MODES[number];

export type HitlCapability =
  | "approve"
  | "escalate"
  | "delegate"
  | "revise"
  | "collaborate"
  | "confirm"
  | "circuit_breaker"
  | "modify_and_approve"
  | "override_decision"
  | "force_terminate";

export interface HitlModeConstraint {
  readonly mode: HitlMode;
  readonly capability: HitlCapability;
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
      return { mode: input.mode, capability: "approve", summary: "Single approval request is ready for dispatch." };
    case "multi_party_approval":
      if (!Number.isInteger(Number(input.context?.requiredApprovals)) || Number(input.context?.requiredApprovals) < 2) {
        throw new Error("hitl_mode.multi_party_required_approvals_invalid");
      }
      return { mode: input.mode, capability: "escalate", summary: "Multi-party approval requires multiple approvers." };
    case "delegated_approval":
      if (typeof input.context?.delegationTarget !== "string" || input.context.delegationTarget.length === 0) {
        throw new Error("hitl_mode.delegation_target_required");
      }
      return { mode: input.mode, capability: "delegate", summary: "Delegated approval will route to a designated delegate." };
    case "iterative_feedback":
      if (input.options.length < 2) {
        throw new Error("hitl_mode.iterative_feedback_requires_revision_option");
      }
      return { mode: input.mode, capability: "revise", summary: "Iterative feedback mode supports revision-oriented loops." };
    case "collaborative_edit":
      if (typeof input.context?.sharedArtifactRef !== "string" || input.context.sharedArtifactRef.length === 0) {
        throw new Error("hitl_mode.shared_artifact_required");
      }
      return { mode: input.mode, capability: "collaborate", summary: "Collaborative edit mode is bound to a shared artifact." };
    case "informed_confirmation":
      if (input.options.length !== 1) {
        throw new Error("hitl_mode.informed_confirmation_single_option_required");
      }
      return { mode: input.mode, capability: "confirm", summary: "Informed confirmation requires a single confirmation decision." };
    case "circuit_breaker_human":
      if (input.riskLevel !== "high" && input.riskLevel !== "critical") {
        throw new Error("hitl_mode.circuit_breaker_requires_high_risk");
      }
      if (input.timeoutPolicy === "approve" && input.context?.breakGlassApproved !== true) {
        throw new Error("hitl_mode.circuit_breaker_auto_approve_forbidden");
      }
      return { mode: input.mode, capability: "circuit_breaker", summary: "Circuit-breaker mode requires a blocking human decision." };
    // R13-34/R13-37/R13-38: Add §45.18 HITL 5-capability modes
    case "modify_and_approve":
      // modify_and_approve requires at least one option for the modified version
      if (input.options.length < 1) {
        throw new Error("hitl_mode.modify_and_approve_requires_option");
      }
      return { mode: input.mode, capability: "modify_and_approve", summary: "Modify-and-approve mode allows human modification before approval." };
    case "override_decision":
      // override_decision requires at least one option to override
      if (input.options.length < 1) {
        throw new Error("hitl_mode.override_decision_requires_option");
      }
      return { mode: input.mode, capability: "override_decision", summary: "Human overrides a prior system or approval decision." };
    case "force_terminate":
      // force_terminate is a critical capability - high/critical risk only
      if (input.riskLevel !== "high" && input.riskLevel !== "critical") {
        throw new Error("hitl_mode.force_terminate_requires_high_risk");
      }
      return { mode: input.mode, capability: "force_terminate", summary: "Force-terminate mode immediately terminates execution." };
  }
}
