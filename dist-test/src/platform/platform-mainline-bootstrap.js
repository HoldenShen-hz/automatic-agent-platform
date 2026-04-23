export const PLATFORM_MAINLINE_CAPABILITIES = Object.freeze([
    {
        capabilityId: "interface",
        entryModule: "src/platform/interface/index.ts",
        architectureSections: ["§4", "§6", "§7"],
        criticalSubmodules: ["api", "webhook", "scheduler", "console-backend", "ingress"],
    },
    {
        capabilityId: "control-plane",
        entryModule: "src/platform/control-plane/index.ts",
        architectureSections: ["§10", "§11", "§12", "§24"],
        criticalSubmodules: ["approval-center", "config-center", "iam", "incident-control", "policy-center", "risk-control", "rollout-controller", "tenant"],
    },
    {
        capabilityId: "orchestration",
        entryModule: "src/platform/orchestration/index.ts",
        architectureSections: ["§13", "§19", "§21", "§45"],
        criticalSubmodules: ["agent-delegation", "harness", "hitl", "oapeflir", "planner", "replan", "routing"],
    },
    {
        capabilityId: "execution",
        entryModule: "src/platform/execution/index.ts",
        architectureSections: ["§14", "§31"],
        criticalSubmodules: ["dispatcher", "distributed-lock", "execution-engine", "ha", "lease", "queue", "recovery", "tool-executor", "worker-pool"],
    },
    {
        capabilityId: "state-evidence",
        entryModule: "src/platform/state-evidence/index.ts",
        architectureSections: ["§25", "§26", "§28", "§29"],
        criticalSubmodules: ["truth", "events", "projections", "audit", "artifacts", "memory", "knowledge", "dlq"],
    },
    {
        capabilityId: "model-gateway",
        entryModule: "src/platform/model-gateway/index.ts",
        architectureSections: ["§15", "§18"],
        criticalSubmodules: ["provider-registry", "router", "fallback", "degradation", "cost-tracker", "messages"],
    },
    {
        capabilityId: "prompt-engine",
        entryModule: "src/platform/prompt-engine/index.ts",
        architectureSections: ["§16", "§17"],
        criticalSubmodules: ["eval", "registry", "renderer", "rollout", "conversation-template"],
    },
    {
        capabilityId: "compliance",
        entryModule: "src/platform/compliance/index.ts",
        architectureSections: ["§23"],
        criticalSubmodules: ["crypto-shredding", "data-residency", "encryption", "erasure", "lineage"],
    },
]);
export function listPlatformMainlineCapabilities() {
    return PLATFORM_MAINLINE_CAPABILITIES;
}
export function resolvePlatformMainlineCapability(capabilityId) {
    const capability = PLATFORM_MAINLINE_CAPABILITIES.find((item) => item.capabilityId === capabilityId);
    if (capability == null) {
        throw new Error(`platform_mainline.not_found:${capabilityId}`);
    }
    return capability;
}
//# sourceMappingURL=platform-mainline-bootstrap.js.map