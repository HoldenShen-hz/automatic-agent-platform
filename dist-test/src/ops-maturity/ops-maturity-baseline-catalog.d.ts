export type OpsMaturityCapabilityId = "agent-lifecycle" | "capacity-planner" | "compliance-reporter" | "cost-optimizer" | "drift-detection" | "edge-runtime" | "emergency" | "explainability" | "monitoring" | "multimodal" | "platform-ops-agent" | "workflow-debugger";
export interface OpsMaturityCapabilityBaseline {
    readonly capabilityId: OpsMaturityCapabilityId;
    readonly entryModule: string;
    readonly description: string;
    readonly architectureSections: readonly string[];
    readonly baselineServices: readonly string[];
}
export declare const OPS_MATURITY_CAPABILITY_BASELINES: readonly OpsMaturityCapabilityBaseline[];
export declare function listOpsMaturityCapabilityBaselines(): readonly OpsMaturityCapabilityBaseline[];
export declare function resolveOpsMaturityCapabilityBaseline(capabilityId: OpsMaturityCapabilityId): OpsMaturityCapabilityBaseline;
