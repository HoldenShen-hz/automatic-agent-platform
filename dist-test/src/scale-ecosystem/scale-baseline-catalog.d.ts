export type ScaleCapabilityId = "multi-region" | "resource-manager" | "sla-engine" | "marketplace" | "feedback-loop" | "integration";
export interface ScaleCapabilityBaseline {
    readonly capabilityId: ScaleCapabilityId;
    readonly entryModule: string;
    readonly description: string;
    readonly architectureSections: readonly string[];
    readonly baselineServices: readonly string[];
}
export declare const SCALE_CAPABILITY_BASELINES: readonly ScaleCapabilityBaseline[];
export declare function listScaleCapabilityBaselines(): readonly ScaleCapabilityBaseline[];
export declare function resolveScaleCapabilityBaseline(capabilityId: ScaleCapabilityId): ScaleCapabilityBaseline;
