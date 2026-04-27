export interface DeploymentInventoryRecord {
  readonly deploymentId: string;
  readonly environment: "dev" | "test" | "staging" | "pre-prod" | "prod";
  readonly rolloutStrategy: "direct" | "shadow" | "canary" | "tenant_gray";
  readonly readinessStatus: "ready" | "conditional" | "blocked";
  readonly requiresLiveInfra: boolean;
  readonly s4Mode: "contract_only" | "live_required";
  readonly requiredDrills: readonly string[];
}

const DEFAULT_DEPLOYMENTS: readonly DeploymentInventoryRecord[] = [
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
] as const;

export class DeploymentInventoryService {
  public listDeployments(): DeploymentInventoryRecord[] {
    return Object.freeze([...DEFAULT_DEPLOYMENTS]) as DeploymentInventoryRecord[];
  }

  public buildSummary(): {
    total: number;
    ready: number;
    conditional: number;
    blocked: number;
    contractOnly: number;
  } {
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
