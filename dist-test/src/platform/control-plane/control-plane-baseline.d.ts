export type ControlPlaneCapabilityId = "approval-center" | "audit-export" | "compliance" | "config-center" | "cost-alert" | "iam" | "incident-control" | "policy-center" | "replay-repair-control" | "risk-control" | "rollout-controller" | "tenant";
export interface ControlPlaneCapabilityBaseline {
    readonly capabilityId: ControlPlaneCapabilityId;
    readonly entryModule: string;
    readonly description: string;
    readonly baselineServices: readonly string[];
}
export declare const CONTROL_PLANE_CAPABILITY_BASELINES: readonly ControlPlaneCapabilityBaseline[];
export declare function listControlPlaneCapabilityBaselines(): readonly ControlPlaneCapabilityBaseline[];
export declare function resolveControlPlaneCapabilityBaseline(capabilityId: ControlPlaneCapabilityId): ControlPlaneCapabilityBaseline;
