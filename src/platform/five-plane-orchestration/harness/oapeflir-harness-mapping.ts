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
    return "feedback";
  }
  if (role === "loop_controller") {
    return "improve";
  }
  return "observe";
}
