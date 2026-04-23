export type ExecutionCapabilityId = "dispatcher" | "distributed-lock" | "execution-engine" | "ha" | "hot-upgrade" | "lease" | "plugin-executor" | "queue" | "recovery" | "resource" | "startup" | "state-transition" | "tool-executor" | "worker-pool";
export interface ExecutionCapabilityBaseline {
    readonly capabilityId: ExecutionCapabilityId;
    readonly entryModule: string;
    readonly description: string;
    readonly baselineServices: readonly string[];
}
export declare const EXECUTION_CAPABILITY_BASELINES: readonly ExecutionCapabilityBaseline[];
export declare function listExecutionCapabilityBaselines(): readonly ExecutionCapabilityBaseline[];
export declare function resolveExecutionCapabilityBaseline(capabilityId: ExecutionCapabilityId): ExecutionCapabilityBaseline;
