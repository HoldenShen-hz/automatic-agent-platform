export type PlatformMainlineCapabilityId = "interface" | "control-plane" | "orchestration" | "execution" | "state-evidence" | "model-gateway" | "prompt-engine" | "compliance";
export interface PlatformMainlineCapability {
    readonly capabilityId: PlatformMainlineCapabilityId;
    readonly entryModule: string;
    readonly architectureSections: readonly string[];
    readonly criticalSubmodules: readonly string[];
}
export declare const PLATFORM_MAINLINE_CAPABILITIES: readonly PlatformMainlineCapability[];
export declare function listPlatformMainlineCapabilities(): readonly PlatformMainlineCapability[];
export declare function resolvePlatformMainlineCapability(capabilityId: PlatformMainlineCapabilityId): PlatformMainlineCapability;
