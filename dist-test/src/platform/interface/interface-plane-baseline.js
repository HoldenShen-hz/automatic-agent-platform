export const INTERFACE_CAPABILITY_BASELINES = Object.freeze([
    {
        capabilityId: "api",
        entryModule: "src/platform/interface/api/index.ts",
        description: "HTTP and typed API facade, route catalog, and API server resources.",
        baselineServices: ["HttpApiServer", "ApiResourceCatalogService"],
    },
    {
        capabilityId: "channel-gateway",
        entryModule: "src/platform/interface/channel-gateway/index.ts",
        description: "Channel delivery, retry, stream bridge, and gateway target directory baselines.",
        baselineServices: ["ChannelGatewayService"],
    },
    {
        capabilityId: "console-backend",
        entryModule: "src/platform/interface/console-backend/index.ts",
        description: "Operator console snapshot and human takeover planning baselines.",
        baselineServices: ["OperatorConsoleBackendService"],
    },
    {
        capabilityId: "ingress",
        entryModule: "src/platform/interface/ingress/index.ts",
        description: "Ingress governance, tenant isolation, and route gating baselines.",
        baselineServices: ["IngressGovernanceService"],
    },
    {
        capabilityId: "scheduler",
        entryModule: "src/platform/interface/scheduler/index.ts",
        description: "Long-running workflow scheduling and wake-up orchestration baselines.",
        baselineServices: ["LongRunningWorkflowService"],
    },
    {
        capabilityId: "webhook",
        entryModule: "src/platform/interface/webhook/index.ts",
        description: "Inbound webhook verification, idempotency, and dispatch envelope baselines.",
        baselineServices: ["WebhookIngressService"],
    },
]);
export function listInterfaceCapabilityBaselines() {
    return INTERFACE_CAPABILITY_BASELINES;
}
export function resolveInterfaceCapabilityBaseline(capabilityId) {
    const baseline = INTERFACE_CAPABILITY_BASELINES.find((item) => item.capabilityId === capabilityId);
    if (baseline == null) {
        throw new Error(`interface_capability.not_found:${capabilityId}`);
    }
    return baseline;
}
//# sourceMappingURL=interface-plane-baseline.js.map