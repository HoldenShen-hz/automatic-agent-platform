export const INTERACTION_CAPABILITY_BASELINES = Object.freeze([
    {
        capabilityId: "nl-gateway",
        entryModule: "src/interaction/nl-gateway/index.ts",
        description: "Natural-language task intake, intent detection, clarification, and request envelope construction.",
        architectureSections: ["§39", "§44"],
        baselineServices: ["NlEntryService", "ConversationContextManager"],
    },
    {
        capabilityId: "goal-decomposer",
        entryModule: "src/interaction/goal-decomposer/index.ts",
        description: "Goal decomposition, dependency analysis, parallel grouping, and critical path derivation.",
        architectureSections: ["§40"],
        baselineServices: ["GoalDecompositionService"],
    },
    {
        capabilityId: "proactive-agent",
        entryModule: "src/interaction/proactive-agent/index.ts",
        description: "Event and schedule driven proactive triggers, suggestion queueing, and guarded activation.",
        architectureSections: ["§41"],
        baselineServices: ["ProactiveAgentService"],
    },
    {
        capabilityId: "autonomy",
        entryModule: "src/interaction/autonomy/index.ts",
        description: "Progressive autonomy, trust scoring, demotion, and autonomy audit baselines.",
        architectureSections: ["§42"],
        baselineServices: ["ProgressiveAutonomyService", "AutonomyGovernanceService"],
    },
    {
        capabilityId: "dashboard",
        entryModule: "src/interaction/dashboard/index.ts",
        description: "Operator, domain-admin, platform-ops, and fleet dashboards with attention aggregation.",
        architectureSections: ["§43"],
        baselineServices: ["DashboardAggregationService", "DashboardProjectionService"],
    },
    {
        capabilityId: "ux",
        entryModule: "src/interaction/ux/index.ts",
        description: "User portal, onboarding, wizard, workflow builder, and UX orchestration baselines.",
        architectureSections: ["§44"],
        baselineServices: ["UserPortalService", "WorkflowBuilderService", "UserExperienceOrchestrationService"],
    },
]);
export function listInteractionCapabilityBaselines() {
    return INTERACTION_CAPABILITY_BASELINES;
}
export function resolveInteractionCapabilityBaseline(capabilityId) {
    const baseline = INTERACTION_CAPABILITY_BASELINES.find((item) => item.capabilityId === capabilityId);
    if (baseline == null) {
        throw new Error(`interaction_capability.not_found:${capabilityId}`);
    }
    return baseline;
}
//# sourceMappingURL=interaction-baseline-catalog.js.map