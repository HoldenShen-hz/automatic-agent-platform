export interface ModelFallbackCandidate {
    profileName: string;
    provider: string;
    tier: "fast" | "balanced" | "reasoning" | "coding";
    healthy: boolean;
    inputCostPer1kUsd: number;
}
export interface ModelFallbackDecision {
    selectedProfileName: string | null;
    reasonCode: string;
    degradedFromProfileName: string | null;
    attemptedProfiles: string[];
}
export declare class ModelGatewayFallbackService {
    selectFallback(input: {
        primaryProfileName: string;
        candidates: ModelFallbackCandidate[];
        excludedProfiles?: readonly string[];
        maxInputCostPer1kUsd?: number | null;
    }): ModelFallbackDecision;
}
