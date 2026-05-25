export type OrchestrationCapabilityId =
  | "agent-delegation"
  | "escalation"
  | "harness"
  | "hitl"
  | "oapeflir"
  | "planner"
  | "replan"
  | "routing";

export interface OrchestrationCapabilityBaseline {
  readonly capabilityId: OrchestrationCapabilityId;
  readonly entryModule: string;
  readonly description: string;
  readonly baselineServices: readonly string[];
}

export const ORCHESTRATION_CAPABILITY_BASELINES: readonly OrchestrationCapabilityBaseline[] = Object.freeze([
  { capabilityId: "agent-delegation", entryModule: "src/platform/five-plane-orchestration/agent-delegation/index.ts", description: "Delegation topology, context isolation, and collaboration governance baselines.", baselineServices: ["DelegationManagerService"] },
  { capabilityId: "escalation", entryModule: "src/platform/five-plane-orchestration/escalation/index.ts", description: "Escalation policies and override routing baselines.", baselineServices: ["EscalationService"] },
  { capabilityId: "harness", entryModule: "src/platform/five-plane-orchestration/harness/index.ts", description: "ConstraintPack, HarnessRun, HarnessDecision, and loop runtime baselines.", baselineServices: ["HarnessRuntimeService"] },
  { capabilityId: "hitl", entryModule: "src/platform/five-plane-orchestration/hitl/index.ts", description: "HITL approval, explainability, and operator console baselines.", baselineServices: ["HitlApprovalOrchestrationService"] },
  { capabilityId: "oapeflir", entryModule: "src/platform/five-plane-orchestration/oapeflir/index.ts", description: "Observe-assess-plan-execute-feedback-learn-improve-release loop baselines.", baselineServices: ["OapeflirLoopService"] },
  { capabilityId: "planner", entryModule: "src/platform/five-plane-orchestration/planner/index.ts", description: "Task decomposition, plan building, evaluation, and repository baselines.", baselineServices: ["TaskDecompositionService"] },
  { capabilityId: "replan", entryModule: "src/platform/five-plane-orchestration/replan/index.ts", description: "Replanning and plan migration baselines.", baselineServices: ["ReplanningService"] },
  { capabilityId: "routing", entryModule: "src/platform/five-plane-orchestration/routing/index.ts", description: "Intake routing, workflow planner, and team routing baselines.", baselineServices: ["IntakeRouter"] },
]);

export function listOrchestrationCapabilityBaselines(): readonly OrchestrationCapabilityBaseline[] {
  return ORCHESTRATION_CAPABILITY_BASELINES;
}

export function resolveOrchestrationCapabilityBaseline(capabilityId: OrchestrationCapabilityId): OrchestrationCapabilityBaseline {
  const baseline = ORCHESTRATION_CAPABILITY_BASELINES.find((item) => item.capabilityId === capabilityId);
  if (baseline == null) {
    throw new Error(`orchestration_capability.not_found:${capabilityId}`);
  }
  return baseline;
}
