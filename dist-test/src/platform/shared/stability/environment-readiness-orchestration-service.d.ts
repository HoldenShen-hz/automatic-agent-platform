import type { StableGateTargetStatus, StableGateVerdict } from "./stable-release-gate.js";
export type EnvironmentName = "dev" | "test" | "staging" | "pre-prod" | "prod";
export type EnvironmentComponentType = "provider" | "gateway" | "sandbox" | "worker_fleet" | "artifact_store" | "notification_channel" | "external_service";
export type EnvironmentSecondaryGateName = "network_ready" | "webhook_ready" | "moderation_ready" | "quota_ready" | "attestation_ready" | "artifact_namespace_ready";
export type EnvironmentDrillType = "backup_restore" | "rolling_upgrade" | "maintenance_drain" | "tenant_gray_rollout" | "regional_failover" | "worker_reassignment" | "queue_repair";
export type EnvironmentDrillStatus = "passed" | "partial" | "failed";
export type EnvironmentSloComparator = "min" | "max";
export type ResourcePoolType = "execution" | "queue" | "artifact" | "sandbox";
export interface EnvironmentReadinessRecord {
    readinessId: string;
    environment: EnvironmentName;
    componentType: EnvironmentComponentType;
    componentId: string;
    credentialReady: boolean;
    secondaryGates: Partial<Record<EnvironmentSecondaryGateName, boolean>>;
    owner: string;
    lastVerifiedAt: string;
    isActive: boolean;
    notes: string | null;
}
export interface EnvironmentReadinessSummary {
    environment: EnvironmentName;
    componentType: EnvironmentComponentType;
    total: number;
    ready: number;
    notReady: number;
    stale: number;
    allReady: boolean;
}
export interface EnvironmentDrillRecord {
    drillId: string;
    environment: EnvironmentName;
    drillType: EnvironmentDrillType;
    status: EnvironmentDrillStatus;
    owner: string;
    verifiedAt: string;
    evidenceRefs: string[];
    notes: string | null;
}
export interface EnvironmentSloRecord {
    sloId: string;
    environment: EnvironmentName;
    metric: string;
    comparator: EnvironmentSloComparator;
    target: number;
    observed: number;
    unit: "ratio" | "ms" | "count";
    measuredAt: string;
    owner: string;
}
export interface EnvironmentResourcePoolRecord {
    poolId: string;
    environment: EnvironmentName;
    poolType: ResourcePoolType;
    region: string;
    totalCapacityUnits: number;
    reservedCapacityUnits: number;
    availableCapacityUnits: number;
    queueDepth: number;
    maxQueueDepth: number;
    failoverReady: boolean;
    admissionReady: boolean;
    owner: string;
    updatedAt: string;
}
export interface EnvironmentPromotionReport {
    reportId: string;
    environment: EnvironmentName;
    targetStatus: StableGateTargetStatus;
    currentStatus: "partial" | "contract_frozen" | "canary" | "tenant_gray" | "production_ready";
    verdict: StableGateVerdict;
    requiredComponentTypes: EnvironmentComponentType[];
    requiredDrills: EnvironmentDrillType[];
    requiredSloMetrics: string[];
    readinessSummaries: EnvironmentReadinessSummary[];
    blockedComponents: EnvironmentReadinessRecord[];
    staleComponents: EnvironmentReadinessRecord[];
    drillFindings: string[];
    sloFindings: string[];
    resourcePoolFindings: string[];
    runbookRefs: string[];
    blockers: string[];
    advisories: string[];
    createdAt: string;
}
export declare class EnvironmentReadinessOrchestrationService {
    private readonly readinessRecords;
    private readonly drillRecords;
    private readonly sloRecords;
    private readonly resourcePools;
    upsertReadiness(input: {
        environment: EnvironmentName;
        componentType: EnvironmentComponentType;
        componentId: string;
        credentialReady: boolean;
        secondaryGates?: Partial<Record<EnvironmentSecondaryGateName, boolean>> | undefined;
        owner: string;
        lastVerifiedAt?: string | undefined;
        isActive?: boolean | undefined;
        notes?: string | null | undefined;
    }): EnvironmentReadinessRecord;
    recordDrill(input: {
        environment: EnvironmentName;
        drillType: EnvironmentDrillType;
        status: EnvironmentDrillStatus;
        owner: string;
        verifiedAt?: string | undefined;
        evidenceRefs?: readonly string[] | undefined;
        notes?: string | null | undefined;
    }): EnvironmentDrillRecord;
    recordSlo(input: {
        environment: EnvironmentName;
        metric: string;
        comparator: EnvironmentSloComparator;
        target: number;
        observed: number;
        unit?: "ratio" | "ms" | "count" | undefined;
        measuredAt?: string | undefined;
        owner: string;
    }): EnvironmentSloRecord;
    upsertResourcePool(input: {
        environment: EnvironmentName;
        poolType: ResourcePoolType;
        region: string;
        totalCapacityUnits: number;
        reservedCapacityUnits: number;
        availableCapacityUnits: number;
        queueDepth: number;
        maxQueueDepth: number;
        failoverReady: boolean;
        admissionReady: boolean;
        owner: string;
        updatedAt?: string | undefined;
    }): EnvironmentResourcePoolRecord;
    listReadiness(environment?: EnvironmentName): EnvironmentReadinessRecord[];
    summarizeEnvironment(input: {
        environment: EnvironmentName;
        staleAfterHours?: number | undefined;
        asOf?: string | undefined;
    }): EnvironmentReadinessSummary[];
    evaluatePromotion(input: {
        environment: EnvironmentName;
        targetStatus: StableGateTargetStatus;
        staleAfterHours?: number | undefined;
        asOf?: string | undefined;
    }): EnvironmentPromotionReport;
    private isReady;
    private isStale;
    private sloPasses;
}
