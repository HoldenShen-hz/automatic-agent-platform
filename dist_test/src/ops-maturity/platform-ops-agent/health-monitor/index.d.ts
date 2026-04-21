export interface OpsHealthProbe {
    readonly component: string;
    readonly status: "healthy" | "degraded" | "failed";
}
export declare function summarizeOpsHealth(probes: readonly OpsHealthProbe[]): "healthy" | "degraded" | "failed";
