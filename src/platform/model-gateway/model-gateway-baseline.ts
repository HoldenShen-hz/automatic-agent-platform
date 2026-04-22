export type ModelGatewayCapabilityId =
  | "provider-registry"
  | "router"
  | "fallback"
  | "degradation"
  | "cost-tracker"
  | "messages";

export interface ModelGatewayCapabilityBaseline {
  readonly capabilityId: ModelGatewayCapabilityId;
  readonly entryModule: string;
  readonly description: string;
  readonly baselineServices: readonly string[];
}

export const MODEL_GATEWAY_CAPABILITY_BASELINES: readonly ModelGatewayCapabilityBaseline[] = Object.freeze([
  {
    capabilityId: "provider-registry",
    entryModule: "src/platform/model-gateway/provider-registry/index.ts",
    description: "Provider registration, capability metadata, and vendor lifecycle baselines.",
    baselineServices: ["ProviderCredentialPool", "UnifiedChatProvider"],
  },
  {
    capabilityId: "router",
    entryModule: "src/platform/model-gateway/router/index.ts",
    description: "Primary routing, policy-aware model selection, and request dispatch baselines.",
    baselineServices: ["ModelRoutingService"],
  },
  {
    capabilityId: "fallback",
    entryModule: "src/platform/model-gateway/fallback/index.ts",
    description: "Fallback chains, downgrade routing, and recovery model baselines.",
    baselineServices: ["ModelGatewayFallbackService"],
  },
  {
    capabilityId: "degradation",
    entryModule: "src/platform/model-gateway/degradation/index.ts",
    description: "Degradation control, budget-aware throttling, and model availability baselines.",
    baselineServices: ["DegradationController"],
  },
  {
    capabilityId: "cost-tracker",
    entryModule: "src/platform/model-gateway/cost-tracker/index.ts",
    description: "Token attribution, cost reporting, and chargeback baselines.",
    baselineServices: ["BudgetGuard"],
  },
  {
    capabilityId: "messages",
    entryModule: "src/platform/model-gateway/messages/index.ts",
    description: "Typed request/response message shaping and transport payload baselines.",
    baselineServices: ["buildMessageParts", "estimateMessageTokens"],
  },
]);

export function listModelGatewayCapabilityBaselines(): readonly ModelGatewayCapabilityBaseline[] {
  return MODEL_GATEWAY_CAPABILITY_BASELINES;
}

export function resolveModelGatewayCapabilityBaseline(
  capabilityId: ModelGatewayCapabilityId,
): ModelGatewayCapabilityBaseline {
  const baseline = MODEL_GATEWAY_CAPABILITY_BASELINES.find((item) => item.capabilityId === capabilityId);
  if (baseline == null) {
    throw new Error(`model_gateway_capability.not_found:${capabilityId}`);
  }
  return baseline;
}
