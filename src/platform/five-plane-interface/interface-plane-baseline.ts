export type InterfaceCapabilityId =
  | "api"
  | "channel-gateway"
  | "console-backend"
  | "ingress"
  | "scheduler"
  | "webhook";

export interface InterfaceCapabilityBaseline {
  readonly capabilityId: InterfaceCapabilityId;
  readonly entryModule: string;
  readonly description: string;
  readonly baselineServices: readonly string[];
}

export const INTERFACE_CAPABILITY_BASELINES: readonly InterfaceCapabilityBaseline[] = Object.freeze([
  {
    capabilityId: "api",
    entryModule: "src/platform/five-plane-interface/api/index.ts",
    description: "HTTP and typed API facade, route catalog, and API server resources.",
    baselineServices: ["HttpApiServer", "ApiResourceCatalogService"],
  },
  {
    capabilityId: "channel-gateway",
    entryModule: "src/platform/five-plane-interface/channel-gateway/index.ts",
    description: "Channel delivery, retry, stream bridge, and gateway target directory baselines.",
    baselineServices: ["ChannelGatewayService"],
  },
  {
    capabilityId: "console-backend",
    entryModule: "src/platform/five-plane-interface/console-backend/index.ts",
    description: "Operator console snapshot and human takeover planning baselines.",
    baselineServices: ["OperatorConsoleBackendService"],
  },
  {
    capabilityId: "ingress",
    entryModule: "src/platform/five-plane-interface/ingress/index.ts",
    description: "Ingress governance, tenant isolation, and route gating baselines.",
    baselineServices: ["IngressGovernanceService"],
  },
  {
    capabilityId: "scheduler",
    entryModule: "src/platform/five-plane-interface/scheduler/index.ts",
    description: "Long-running workflow scheduling and wake-up orchestration baselines.",
    baselineServices: ["LongRunningWorkflowService"],
  },
  {
    capabilityId: "webhook",
    entryModule: "src/platform/five-plane-interface/webhook/index.ts",
    description: "Inbound webhook verification, idempotency, and dispatch envelope baselines.",
    baselineServices: ["WebhookIngressService"],
  },
]);

export function listInterfaceCapabilityBaselines(): readonly InterfaceCapabilityBaseline[] {
  return INTERFACE_CAPABILITY_BASELINES;
}

export function resolveInterfaceCapabilityBaseline(capabilityId: InterfaceCapabilityId): InterfaceCapabilityBaseline {
  const baseline = INTERFACE_CAPABILITY_BASELINES.find((item) => item.capabilityId === capabilityId);
  if (baseline == null) {
    throw new Error(`interface_capability.not_found:${capabilityId}`);
  }
  return baseline;
}
