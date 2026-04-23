const DEFAULT_DEPLOYMENTS = [
    {
        deploymentId: "deploy.dev.direct",
        environment: "dev",
        rolloutStrategy: "direct",
        readinessStatus: "ready",
        requiresLiveInfra: false,
        s4Mode: "contract_only",
        requiredDrills: ["backup_restore"],
    },
    {
        deploymentId: "deploy.staging.shadow",
        environment: "staging",
        rolloutStrategy: "shadow",
        readinessStatus: "ready",
        requiresLiveInfra: false,
        s4Mode: "contract_only",
        requiredDrills: ["rolling_upgrade", "queue_repair"],
    },
    {
        deploymentId: "deploy.preprod.canary",
        environment: "pre-prod",
        rolloutStrategy: "canary",
        readinessStatus: "conditional",
        requiresLiveInfra: false,
        s4Mode: "contract_only",
        requiredDrills: ["rolling_upgrade", "regional_failover"],
    },
    {
        deploymentId: "deploy.prod.tenant-gray",
        environment: "prod",
        rolloutStrategy: "tenant_gray",
        readinessStatus: "conditional",
        requiresLiveInfra: false,
        s4Mode: "contract_only",
        requiredDrills: ["backup_restore", "regional_failover", "worker_reassignment"],
    },
];
export class DeploymentInventoryService {
    listDeployments() {
        return [...DEFAULT_DEPLOYMENTS];
    }
    buildSummary() {
        const records = this.listDeployments();
        return {
            total: records.length,
            ready: records.filter((record) => record.readinessStatus === "ready").length,
            conditional: records.filter((record) => record.readinessStatus === "conditional").length,
            blocked: records.filter((record) => record.readinessStatus === "blocked").length,
            contractOnly: records.filter((record) => record.s4Mode === "contract_only").length,
        };
    }
}
//# sourceMappingURL=deployment-inventory-service.js.map