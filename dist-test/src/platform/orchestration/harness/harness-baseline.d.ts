export type HarnessCapabilityId = "constraint-pack" | "planner-generator-evaluator-loop" | "hitl" | "governance";
export interface HarnessCapabilityBaseline {
    readonly capabilityId: HarnessCapabilityId;
    readonly entryModule: string;
    readonly description: string;
    readonly baselineServices: readonly string[];
}
export declare const HARNESS_CAPABILITY_BASELINES: readonly HarnessCapabilityBaseline[];
export declare function listHarnessCapabilityBaselines(): readonly HarnessCapabilityBaseline[];
export declare function resolveHarnessCapabilityBaseline(capabilityId: HarnessCapabilityId): HarnessCapabilityBaseline;
