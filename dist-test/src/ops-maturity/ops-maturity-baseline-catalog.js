export const OPS_MATURITY_CAPABILITY_BASELINES = Object.freeze([
    {
        capabilityId: "agent-lifecycle",
        entryModule: "src/ops-maturity/agent-lifecycle/index.ts",
        description: "Agent lifecycle, registry, canary rollout, retirement, and version evolution baselines.",
        architectureSections: ["§61"],
        baselineServices: ["AgentLifecycleService"],
    },
    {
        capabilityId: "capacity-planner",
        entryModule: "src/ops-maturity/capacity-planner/index.ts",
        description: "Capacity forecasting, scenario simulation, and trend analysis baselines.",
        architectureSections: ["§67"],
        baselineServices: ["CapacityPlanningService"],
    },
    {
        capabilityId: "compliance-reporter",
        entryModule: "src/ops-maturity/compliance-reporter/index.ts",
        description: "Compliance report rendering, evidence mapping, and reporting pipeline baselines.",
        architectureSections: ["§66"],
        baselineServices: ["ComplianceReportPipelineService"],
    },
    {
        capabilityId: "cost-optimizer",
        entryModule: "src/ops-maturity/cost-optimizer/index.ts",
        description: "Cost attribution, recommendation, and simulation baselines.",
        architectureSections: ["§64"],
        baselineServices: ["CostOptimizationService"],
    },
    {
        capabilityId: "drift-detection",
        entryModule: "src/ops-maturity/drift-detection/index.ts",
        description: "Behavior drift, evolution, rollout gating, and changepoint analysis baselines.",
        architectureSections: ["§63"],
        baselineServices: ["EvolutionMvpService", "ChangepointDetectorService", "CrossAgentAnalyzerService"],
    },
    {
        capabilityId: "edge-runtime",
        entryModule: "src/ops-maturity/edge-runtime/index.ts",
        description: "Offline execution, sync queueing, edge orchestration, and local-model baselines.",
        architectureSections: ["§62"],
        baselineServices: ["EdgeRuntimeSyncService"],
    },
    {
        capabilityId: "emergency",
        entryModule: "src/ops-maturity/emergency/index.ts",
        description: "Platform panic, resume protocol, and forensic snapshot baselines.",
        architectureSections: ["§60"],
        baselineServices: ["PlatformPanicService"],
    },
    {
        capabilityId: "explainability",
        entryModule: "src/ops-maturity/explainability/index.ts",
        description: "Explanation pipeline, evidence collection, and causal-chain rendering baselines.",
        architectureSections: ["§59"],
        baselineServices: ["ExplanationPipelineService"],
    },
    {
        capabilityId: "monitoring",
        entryModule: "src/ops-maturity/monitoring/index.ts",
        description: "Anomaly detection and SLO-oriented monitoring baselines.",
        architectureSections: ["§67", "§69"],
        baselineServices: ["AnomalyDetectionService"],
    },
    {
        capabilityId: "multimodal",
        entryModule: "src/ops-maturity/multimodal/index.ts",
        description: "Multimodal routing, image, speech, video, and document parsing baselines.",
        architectureSections: ["§68"],
        baselineServices: ["MultimodalGatewayService", "VideoProcessor"],
    },
    {
        capabilityId: "platform-ops-agent",
        entryModule: "src/ops-maturity/platform-ops-agent/index.ts",
        description: "Platform self-operations, health monitoring, runbook automation, and self-healing baselines.",
        architectureSections: ["§69"],
        baselineServices: ["PlatformOpsAgentService", "RunbookAutomationService", "SelfHealingService"],
    },
    {
        capabilityId: "workflow-debugger",
        entryModule: "src/ops-maturity/workflow-debugger/index.ts",
        description: "Timeline rendering, comparison, breakpoints, and time-travel debugging baselines.",
        architectureSections: ["§65"],
        baselineServices: ["WorkflowDebuggerService", "TimeTravelDebugService"],
    },
]);
export function listOpsMaturityCapabilityBaselines() {
    return OPS_MATURITY_CAPABILITY_BASELINES;
}
export function resolveOpsMaturityCapabilityBaseline(capabilityId) {
    const baseline = OPS_MATURITY_CAPABILITY_BASELINES.find((item) => item.capabilityId === capabilityId);
    if (baseline == null) {
        throw new Error(`ops_maturity_capability.not_found:${capabilityId}`);
    }
    return baseline;
}
//# sourceMappingURL=ops-maturity-baseline-catalog.js.map