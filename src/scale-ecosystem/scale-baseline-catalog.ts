export type ScaleCapabilityId =
  | "multi-region"
  | "resource-manager"
  | "sla-engine"
  | "marketplace"
  | "feedback-loop"
  | "integration";

export interface ScaleCapabilityBaseline {
  readonly capabilityId: ScaleCapabilityId;
  readonly entryModule: string;
  readonly description: string;
  readonly architectureSections: readonly string[];
  readonly baselineServices: readonly string[];
}

export const SCALE_CAPABILITY_BASELINES: readonly ScaleCapabilityBaseline[] = Object.freeze([
  {
    capabilityId: "multi-region",
    entryModule: "src/scale-ecosystem/multi-region/index.ts",
    description: "Cross-region routing, replication, failover, and region-health orchestration baselines.",
    architectureSections: ["§52"],
    baselineServices: ["CrossRegionRoutingService", "DataReplicatorService", "RegionHealthCheckService"],
  },
  {
    capabilityId: "resource-manager",
    entryModule: "src/scale-ecosystem/resource-manager/index.ts",
    description: "Quota, fair scheduling, preemption, and shared resource-pool management baselines.",
    architectureSections: ["§53"],
    baselineServices: ["FairSchedulingService", "ResourcePoolService"],
  },
  {
    capabilityId: "sla-engine",
    entryModule: "src/scale-ecosystem/sla-engine/index.ts",
    description: "SLA tiering, breach detection, and reserved-capacity allocation baselines.",
    architectureSections: ["§54"],
    baselineServices: ["SlaOperationsService"],
  },
  {
    capabilityId: "marketplace",
    entryModule: "src/scale-ecosystem/marketplace/index.ts",
    description: "Marketplace governance, pack security, PMF validation, billing, and tenant platform baselines.",
    architectureSections: ["§55"],
    baselineServices: ["MarketplaceGovernanceService", "PackSecurityService", "TenantPlatformService"],
  },
  {
    capabilityId: "feedback-loop",
    entryModule: "src/scale-ecosystem/feedback-loop/index.ts",
    description: "Feedback collection, grading, analysis, and improvement tracking baselines.",
    architectureSections: ["§56"],
    baselineServices: ["FeedbackImprovementService", "FeedbackCollector", "FeedbackQualityGrader"],
  },
  {
    capabilityId: "integration",
    entryModule: "src/scale-ecosystem/integration/index.ts",
    description: "Connector framework, runtime, health monitoring, and first-party connector baselines.",
    architectureSections: ["§57"],
    baselineServices: ["ConnectorFrameworkService", "GitHubConnector", "JiraConnector", "SlackConnector"],
  },
]);

export function listScaleCapabilityBaselines(): readonly ScaleCapabilityBaseline[] {
  return SCALE_CAPABILITY_BASELINES;
}

export function resolveScaleCapabilityBaseline(capabilityId: ScaleCapabilityId): ScaleCapabilityBaseline {
  const baseline = SCALE_CAPABILITY_BASELINES.find((item) => item.capabilityId === capabilityId);
  if (baseline == null) {
    throw new Error(`scale_capability.not_found:${capabilityId}`);
  }
  return baseline;
}
