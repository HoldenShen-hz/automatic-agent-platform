import { type ConnectorManifest } from "./integration/connector-registry/index.js";
import { type ConnectorHealthReport } from "./integration/health-monitor/index.js";
import { type RegionDescriptor } from "./multi-region/region-router/index.js";
import { type FairQueueItem } from "./resource-manager/fair-queue/index.js";
import { type PreemptionCandidate } from "./resource-manager/preemption/index.js";
import { type QuotaPolicy } from "./resource-manager/quota-enforcer/index.js";
import { type ReservedCapacityAllocation } from "./sla-engine/resource-allocator/index.js";
import { type SlaCommitment, type SlaObservation } from "./sla-engine/breach-detector/index.js";
import { type SlaTier } from "./sla-engine/tier-resolver/index.js";
export interface RuntimeGovernanceRequest {
    readonly capability: string;
    readonly connectors: readonly ConnectorManifest[];
    readonly connectorHealthReports: readonly ConnectorHealthReport[];
    readonly regions: readonly RegionDescriptor[];
    readonly primaryRegionHealthy: boolean;
    readonly quotaPolicy: QuotaPolicy;
    readonly requestedUnits: number;
    readonly queueItems: readonly FairQueueItem[];
    readonly preemptionCandidates: readonly PreemptionCandidate[];
    readonly tiers: readonly SlaTier[];
    readonly reservedCapacityPlan: readonly ReservedCapacityAllocation[];
    readonly totalCapacityUnits: number;
    readonly observation: SlaObservation;
    readonly commitment: SlaCommitment;
}
export interface RuntimeGovernanceDecision {
    readonly connectorId: string | null;
    readonly regionId: string | null;
    readonly failoverRegionId: string | null;
    readonly quotaAllowed: boolean;
    readonly queueOrder: readonly string[];
    readonly preemptionVictimId: string | null;
    readonly highestTierId: string | null;
    readonly reservedCapacity: Readonly<Record<string, number>>;
    readonly breaches: readonly string[];
}
export declare class RuntimeGovernanceService {
    evaluate(input: RuntimeGovernanceRequest): RuntimeGovernanceDecision;
}
