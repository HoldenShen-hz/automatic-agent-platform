export const ORCHESTRATION_CAPABILITY_BASELINES = Object.freeze([
    { capabilityId: "agent-delegation", entryModule: "src/platform/orchestration/agent-delegation/index.ts", description: "Delegation topology, context isolation, and collaboration governance baselines.", baselineServices: ["DelegationManagerService"] },
    { capabilityId: "escalation", entryModule: "src/platform/orchestration/escalation/index.ts", description: "Escalation policies and override routing baselines.", baselineServices: ["EscalationPolicyService"] },
    { capabilityId: "harness", entryModule: "src/platform/orchestration/harness/index.ts", description: "ConstraintPack, HarnessRun, HarnessDecision, and loop runtime baselines.", baselineServices: ["HarnessRuntimeService"] },
    { capabilityId: "hitl", entryModule: "src/platform/orchestration/hitl/index.ts", description: "HITL approval, explainability, and operator console baselines.", baselineServices: ["HitlApprovalOrchestrationService"] },
    { capabilityId: "oapeflir", entryModule: "src/platform/orchestration/oapeflir/index.ts", description: "Observe-assess-plan-execute-feedback-learn-improve-release loop baselines.", baselineServices: ["OapeflirLoopService"] },
    { capabilityId: "planner", entryModule: "src/platform/orchestration/planner/index.ts", description: "Task decomposition, plan building, evaluation, and repository baselines.", baselineServices: ["TaskDecompositionService"] },
    { capabilityId: "replan", entryModule: "src/platform/orchestration/replan/index.ts", description: "Replanning and plan migration baselines.", baselineServices: ["ReplanningCoordinatorService"] },
    { capabilityId: "routing", entryModule: "src/platform/orchestration/routing/index.ts", description: "Intake routing, workflow planner, and team routing baselines.", baselineServices: ["IntakeRouter"] },
]);
export function listOrchestrationCapabilityBaselines() {
    return ORCHESTRATION_CAPABILITY_BASELINES;
}
export function resolveOrchestrationCapabilityBaseline(capabilityId) {
    const baseline = ORCHESTRATION_CAPABILITY_BASELINES.find((item) => item.capabilityId === capabilityId);
    if (baseline == null) {
        throw new Error(`orchestration_capability.not_found:${capabilityId}`);
    }
    return baseline;
}
//# sourceMappingURL=orchestration-plane-baseline.js.map