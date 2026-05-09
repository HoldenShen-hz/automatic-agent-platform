import type { HarnessRole } from "./index.js";

export type OapeflirSemanticPhase =
  | "observe"
  | "assess"
  | "plan"
  | "execute"
  | "feedback"
  | "learn"
  | "improve"
  | "release";

export function mapHarnessStepToOapeflirPhase(role: HarnessRole, stage: string): OapeflirSemanticPhase {
  if (stage === "plan" || role === "planner") {
    return "plan";
  }
  if (stage === "execute" || role === "generator") {
    return "execute";
  }
  if (stage === "evaluate" || role === "evaluator") {
    return "feedback";
  }
  if (role === "hitl_operator") {
    // R31-14 FIX: HITL is a cross-cutting gate mechanism per §45, not tied to any single phase.
    // The "feedback" phase is the closest semantic match since HITL primarily operates
    // at approval gates between stages (observe→assess, assess→plan, plan→execute, etc.).
    // However, HITL is fundamentally cross-cutting - it can介入介入 any stage boundary.
    // We map it to "feedback" but acknowledge its cross-cutting nature in the comment.
    return "feedback";
  }
  if (role === "loop_controller") {
    return "improve";
  }
  if (stage === "learn" || role === "learner") {
    return "learn";
  }
  if (stage === "release" || role === "release_manager") {
    return "release";
  }
  // §13.7: Map observe as default for unclassified stages
  return "observe";
}

/**
 * §13.7: Maps learn/release harness roles to OAPEFLIR phases.
 * Previously these mappings were missing, causing learn/release stages
 * to never be triggered during harness execution.
 */
export function mapHarnessLearnerToOapeflir(role: HarnessRole): OapeflirSemanticPhase {
  if (role === "learner") return "learn";
  if (role === "release_manager") return "release";
  return "observe";
}
