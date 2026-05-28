import { z } from "zod";

export const RegionDescriptorSchema = z.object({
  regionId: z.string().min(1),
  provider: z.string().min(1).default("unknown"),
  endpoints: z.object({
    api: z.string().url().optional(),
    grpc: z.string().url().optional(),
    metrics: z.string().url().optional(),
  }).default({}),
  dataResidencyPolicy: z.enum(["local_only", "regional", "global"]).default("regional"),
  countryCode: z.string().min(2).default("XX"),
  jurisdiction: z.string().min(1),
  capabilities: z.array(z.string()).default([]),
  status: z.enum(["active", "standby", "draining", "disabled", "degraded"]).default("active"),
  latencyScore: z.number().nonnegative().default(0),
  residencyAllowed: z.boolean().default(true),
  /** Whether this region is the partition leader for truth writes */
  isPartitionLeader: z.boolean().default(false),
});

export type RegionDescriptor = z.input<typeof RegionDescriptorSchema>;

export function selectPreferredRegion(regions: readonly RegionDescriptor[]): RegionDescriptor | null {
  return regions
    .filter((item) => (item.residencyAllowed ?? true) && item.status !== "disabled" && item.status !== "draining")
    .sort((left, right) => (left.latencyScore ?? 0) - (right.latencyScore ?? 0))[0] ?? null;
}
