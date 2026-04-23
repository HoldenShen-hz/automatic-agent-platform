import type { StableEvidenceProfileName } from "../../shared/stability/stable-evidence-bundle.js";
export interface StableCampaignCliEnvConfig {
    profile: StableEvidenceProfileName;
    outputDir: string;
    targetDurationMs: number | null;
    segmentDurationMs: number | null;
    intervalMs: number | null;
    iterationsPerCycle: number | null;
    validationIterations: number | null;
}
export interface StableSequenceCliEnvConfig {
    evidenceRootDir: string;
    profileNames: StableEvidenceProfileName[];
    sharedProfileOptions: {
        targetDurationMs?: number;
        segmentDurationMs?: number;
        intervalMs?: number;
        iterationsPerCycle?: number;
        validationIterations?: number;
        enforceWallClockDuration?: boolean;
    };
    runUntilComplete: boolean;
    sleepMs: number;
    maxPasses: number | null;
}
export interface StableEvidenceCliEnvConfig {
    profile: StableEvidenceProfileName;
    outputDir: string;
    validationIterations: number | null;
    durationMs: number | null;
    intervalMs: number | null;
    iterationsPerCycle: number | null;
}
export interface StableGateCliEnvConfig {
    outputDir: string;
    evidenceRootDir: string | null;
    targetStatus: "canary" | "tenant_gray" | "production_ready";
}
export interface StablePackageCliEnvConfig {
    outputDir: string;
    evidenceRootDir: string | null;
    targetStatus: "canary" | "tenant_gray" | "production_ready";
}
export interface StableValidateCliEnvConfig {
    iterations: number;
}
export interface StableSoakCliEnvConfig {
    durationMs: number;
    intervalMs: number;
    iterationsPerCycle: number;
}
export declare function loadStableCampaignCliEnv(env?: NodeJS.ProcessEnv): StableCampaignCliEnvConfig;
export declare function loadStableSequenceCliEnv(env?: NodeJS.ProcessEnv): StableSequenceCliEnvConfig;
export declare function loadStableEvidenceCliEnv(env?: NodeJS.ProcessEnv): StableEvidenceCliEnvConfig;
export declare function loadStableGateCliEnv(env?: NodeJS.ProcessEnv): StableGateCliEnvConfig;
export declare function loadStablePackageCliEnv(env?: NodeJS.ProcessEnv): StablePackageCliEnvConfig;
export declare function loadStableValidateCliEnv(env?: NodeJS.ProcessEnv): StableValidateCliEnvConfig;
export declare function loadStableSoakCliEnv(env?: NodeJS.ProcessEnv): StableSoakCliEnvConfig;
