/**
 * @fileoverview Cross-Region Deployment Service
 *
 * Provides:
 * - Multi-region topology management
 * - Cross-region routing with health-aware selection
 * - Traffic weight management
 * - Region failover and health monitoring
 * - Cross-region replication coordination
 *
 * @see docs_zh/contracts/multi_region_deployment_contract.md
 */
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
export type RegionStatus = "active" | "draining" | "failing_over" | "offline" | "degraded";
export type RoutingStrategy = "latency_based" | "weighted" | "failover" | "geo" | "custom";
export interface Region {
    regionId: string;
    name: string;
    endpoint: string;
    status: RegionStatus;
    priority: number;
    weight: number;
    latencyMs: number | null;
    healthScore: number;
    maxConcurrency: number;
    currentLoad: number;
    metadata: Record<string, unknown> | null;
    lastHealthCheckAt: string;
    createdAt: string;
    updatedAt: string;
}
export interface RegionTopology {
    topologyId: string;
    name: string;
    description: string;
    regions: Region[];
    defaultRoutingStrategy: RoutingStrategy;
    failoverRegionId: string | null;
    activeRegionId: string;
    createdAt: string;
    updatedAt: string;
}
export interface RoutingDecision {
    selectedRegionId: string;
    routingStrategy: RoutingStrategy;
    reasonCode: string;
    allRegionEvaluations: RegionEvaluation[];
    fallbackUsed: boolean;
}
export interface RegionEvaluation {
    regionId: string;
    eligible: boolean;
    score: number | null;
    reasonCode: string;
    latencyMs: number | null;
    healthScore: number | null;
}
export interface TrafficWeight {
    regionId: string;
    weight: number;
    effectiveAt: string;
    expiresAt: string | null;
}
export interface RegionHealthCheck {
    checkId: string;
    regionId: string;
    status: RegionStatus;
    latencyMs: number | null;
    healthScore: number;
    errorMessage: string | null;
    checkedAt: string;
}
export interface FailoverPlan {
    planId: string;
    sourceRegionId: string;
    targetRegionId: string;
    cause: "health_check_failed" | "manual" | "load_shedding" | "network_partition";
    initiatedAt: string;
    completedAt: string | null;
    status: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
    steps: FailoverStep[];
}
export interface FailoverStep {
    stepId: string;
    stepType: "drain_traffic" | "verify_target" | "switch_primary" | "update_routing" | "verify_failover" | "rollback";
    status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
    completedAt: string | null;
    errorMessage: string | null;
}
export declare const CROSS_REGION_DDL = "\nCREATE TABLE IF NOT EXISTS regions (\n  region_id TEXT PRIMARY KEY,\n  name TEXT NOT NULL,\n  endpoint TEXT NOT NULL,\n  status TEXT NOT NULL DEFAULT 'active',\n  priority INTEGER NOT NULL DEFAULT 100,\n  weight INTEGER NOT NULL DEFAULT 100,\n  latency_ms REAL,\n  health_score REAL NOT NULL DEFAULT 100,\n  max_concurrency INTEGER NOT NULL DEFAULT 1000,\n  current_load INTEGER NOT NULL DEFAULT 0,\n  metadata_json TEXT,\n  last_health_check_at TEXT NOT NULL,\n  created_at TEXT NOT NULL,\n  updated_at TEXT NOT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_regions_status ON regions(status);\n\nCREATE TABLE IF NOT EXISTS region_topologies (\n  topology_id TEXT PRIMARY KEY,\n  name TEXT NOT NULL,\n  description TEXT,\n  regions_json TEXT NOT NULL,\n  default_routing_strategy TEXT NOT NULL DEFAULT 'latency_based',\n  failover_region_id TEXT,\n  active_region_id TEXT NOT NULL,\n  created_at TEXT NOT NULL,\n  updated_at TEXT NOT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_topologies_active ON region_topologies(active_region_id);\n\nCREATE TABLE IF NOT EXISTS traffic_weights (\n  id TEXT PRIMARY KEY,\n  region_id TEXT NOT NULL,\n  weight INTEGER NOT NULL,\n  effective_at TEXT NOT NULL,\n  expires_at TEXT,\n  FOREIGN KEY (region_id) REFERENCES regions(region_id)\n);\nCREATE INDEX IF NOT EXISTS idx_traffic_weights_region ON traffic_weights(region_id, effective_at);\n\nCREATE TABLE IF NOT EXISTS region_health_checks (\n  check_id TEXT PRIMARY KEY,\n  region_id TEXT NOT NULL,\n  status TEXT NOT NULL,\n  latency_ms REAL,\n  health_score REAL NOT NULL,\n  error_message TEXT,\n  checked_at TEXT NOT NULL,\n  FOREIGN KEY (region_id) REFERENCES regions(region_id)\n);\nCREATE INDEX IF NOT EXISTS idx_health_checks_region ON region_health_checks(region_id, checked_at);\n\nCREATE TABLE IF NOT EXISTS failover_plans (\n  plan_id TEXT PRIMARY KEY,\n  source_region_id TEXT NOT NULL,\n  target_region_id TEXT NOT NULL,\n  cause TEXT NOT NULL,\n  initiated_at TEXT NOT NULL,\n  completed_at TEXT,\n  status TEXT NOT NULL DEFAULT 'pending',\n  steps_json TEXT NOT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_failover_plans_region ON failover_plans(source_region_id);\n";
export interface CrossRegionDeploymentServiceOptions {
    defaultRoutingStrategy?: RoutingStrategy;
    healthCheckIntervalMs?: number;
    latencyThresholdMs?: number;
    minHealthScoreForTraffic?: number;
}
export declare class CrossRegionDeploymentService {
    private readonly db;
    private readonly defaultRoutingStrategy;
    private readonly latencyThresholdMs;
    private readonly minHealthScoreForTraffic;
    constructor(db: AuthoritativeSqlDatabase, options?: CrossRegionDeploymentServiceOptions);
    registerRegion(region: Omit<Region, "createdAt" | "updatedAt" | "lastHealthCheckAt">): Region;
    getRegion(regionId: string): Region | null;
    listRegions(status?: RegionStatus): Region[];
    updateRegionHealth(check: RegionHealthCheck): void;
    updateRegionStatus(regionId: string, status: RegionStatus): Region | null;
    setRegionWeight(regionId: string, weight: number, effectiveAt?: string, expiresAt?: string): void;
    getEffectiveWeights(): TrafficWeight[];
    createTopology(topology: Omit<RegionTopology, "createdAt" | "updatedAt">): RegionTopology;
    getTopology(topologyId: string): RegionTopology | null;
    listTopologies(): RegionTopology[];
    setActiveRegion(topologyId: string, regionId: string): RegionTopology | null;
    selectRegion(context?: {
        topologyId?: string;
        preferredRegionId?: string | null;
        requiredCapabilities?: string[];
        tenantId?: string | null;
    }): RoutingDecision;
    private evaluateRegion;
    initiateFailover(sourceRegionId: string, cause: FailoverPlan["cause"], targetRegionId?: string): FailoverPlan | null;
    completeFailoverStep(planId: string, stepType: FailoverStep["stepType"], success: boolean, errorMessage?: string): boolean;
    getFailoverPlan(planId: string): FailoverPlan | null;
    getActiveFailoverPlans(): FailoverPlan[];
    recordRegionHealth(record: Omit<RegionHealthCheck, "checkId">): void;
    getRegionHealthHistory(regionId: string, limit?: number): RegionHealthCheck[];
    private mapRegion;
    private mapTopology;
}
