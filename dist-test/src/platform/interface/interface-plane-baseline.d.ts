export type InterfaceCapabilityId = "api" | "channel-gateway" | "console-backend" | "ingress" | "scheduler" | "webhook";
export interface InterfaceCapabilityBaseline {
    readonly capabilityId: InterfaceCapabilityId;
    readonly entryModule: string;
    readonly description: string;
    readonly baselineServices: readonly string[];
}
export declare const INTERFACE_CAPABILITY_BASELINES: readonly InterfaceCapabilityBaseline[];
export declare function listInterfaceCapabilityBaselines(): readonly InterfaceCapabilityBaseline[];
export declare function resolveInterfaceCapabilityBaseline(capabilityId: InterfaceCapabilityId): InterfaceCapabilityBaseline;
