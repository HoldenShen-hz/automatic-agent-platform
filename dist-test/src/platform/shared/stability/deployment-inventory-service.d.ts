export interface DeploymentInventoryRecord {
    readonly deploymentId: string;
    readonly environment: "dev" | "test" | "staging" | "pre-prod" | "prod";
    readonly rolloutStrategy: "direct" | "shadow" | "canary" | "tenant_gray";
    readonly readinessStatus: "ready" | "conditional" | "blocked";
    readonly requiresLiveInfra: boolean;
    readonly s4Mode: "contract_only" | "live_required";
    readonly requiredDrills: readonly string[];
}
export declare class DeploymentInventoryService {
    listDeployments(): DeploymentInventoryRecord[];
    buildSummary(): {
        total: number;
        ready: number;
        conditional: number;
        blocked: number;
        contractOnly: number;
    };
}
