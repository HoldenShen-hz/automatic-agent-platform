export type ModelGatewayCapabilityId = "provider-registry" | "router" | "fallback" | "degradation" | "cost-tracker" | "messages";
export interface ModelGatewayCapabilityBaseline {
    readonly capabilityId: ModelGatewayCapabilityId;
    readonly entryModule: string;
    readonly description: string;
    readonly baselineServices: readonly string[];
}
export declare const MODEL_GATEWAY_CAPABILITY_BASELINES: readonly ModelGatewayCapabilityBaseline[];
export declare function listModelGatewayCapabilityBaselines(): readonly ModelGatewayCapabilityBaseline[];
export declare function resolveModelGatewayCapabilityBaseline(capabilityId: ModelGatewayCapabilityId): ModelGatewayCapabilityBaseline;
