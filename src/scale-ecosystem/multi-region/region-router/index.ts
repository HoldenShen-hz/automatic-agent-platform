import { z } from "zod";

export const RegionDescriptorSchema = z.object({
  regionId: z.string().min(1),
  // R3-16 FIX: §46.1 requires provider/endpoints/dataResidencyPolicy
  provider: z.string().min(1),
  endpoints: z.object({
    api: z.string().url(),
    grpc: z.string().url().optional(),
    metrics: z.string().url().optional(),
  }).nullable().default(null),
  dataResidencyPolicy: z.enum(["local_only", "regional", "global"]),
  countryCode: z.string().min(2).default("XX"),
  jurisdiction: z.string().min(1),
  capabilities: z.array(z.string()).default([]),
  // R3-16 FIX: status enum must include "degraded" and "maintenance" per §46.1
  status: z.enum(["active", "standby", "draining", "degraded", "maintenance"]).default("active"),
  latencyScore: z.number().nonnegative().default(0),
  residencyAllowed: z.boolean().default(true),
  // R3-16 FIX: fencing epoch for region-level leader election
  fencingEpoch: z.number().int().nonnegative().default(0),
  // R13-24 FIX: §52 requires explicit topology mode declaration
  // active_active: all regions serve reads/writes, conflicts resolved via consensus
  // active_passive: only primary serves writes, standby serves reads after failover
  // single_region: no multi-region replication, single point of deployment
  topologyMode: z.enum(["active_active", "active_passive", "single_region"]).default("single_region"),
  // R13-24 FIX: promotion priority for active-passive failover - lower number = higher priority
  // Used to determine promotion order when primary fails
  promotionPriority: z.number().int().nonnegative().default(0),
  // R13-24 FIX: conflict resolution mode for active-active topology
  conflictResolutionMode: z.enum(["lww", "vector_clock", "quorum", "none"]).default("none"),
});

export type RegionDescriptor = z.output<typeof RegionDescriptorSchema>;

export function selectPreferredRegion(regions: readonly RegionDescriptor[]): RegionDescriptor | null {
  return regions
    .filter((item) => (item.residencyAllowed ?? true) && (item.status ?? "active") !== "draining")
    .sort((left, right) => (left.latencyScore ?? 0) - (right.latencyScore ?? 0))[0] ?? null;
}
