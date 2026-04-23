import type { JudgeProfileRecord, JudgeProfileStatus } from "./eval-dataset-judge-service.js";
export type JudgeIsolationLevel = "cross_provider_required" | "cross_family_preferred" | "same_provider_allowed";
export interface JudgeProviderDescriptor {
    readonly providerId: string;
    readonly provider: string;
    readonly providerFamily: string;
    readonly modelId: string;
    readonly supportedCapabilities: readonly string[];
    readonly maxCostUsd: number;
    readonly trustScore: number;
    readonly latencyTier: "low" | "medium" | "high";
    readonly isolationLevel: JudgeIsolationLevel;
    readonly status: JudgeProfileStatus;
}
export declare class JudgeProviderRegistryService {
    private readonly descriptors;
    registerDescriptor(descriptor: JudgeProviderDescriptor): JudgeProviderDescriptor;
    syncJudgeProfile(profile: JudgeProfileRecord, overrides?: Partial<Pick<JudgeProviderDescriptor, "trustScore" | "latencyTier" | "isolationLevel">>): JudgeProviderDescriptor;
    registerDefaults(): JudgeProviderDescriptor[];
    listDescriptors(status?: JudgeProfileStatus): JudgeProviderDescriptor[];
    selectDescriptor(input: {
        capability: string;
        candidateProviderFamily?: string | null;
        maxCostUsd?: number | null;
        requireIsolation?: boolean;
    }): JudgeProviderDescriptor | null;
}
