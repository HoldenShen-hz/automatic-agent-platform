import { z } from "zod";

export const RegionDescriptorSchema = z.object({
  regionId: z.string().min(1),
  provider: z.string().min(1),
  endpoints: z.object({
    api: z.string().url(),
    grpc: z.string().url().optional(),
    metrics: z.string().url().optional(),
  }),
  dataResidencyPolicy: z.enum(["local_only", "regional", "global"]),
  countryCode: z.string().min(2).default("XX"),
  jurisdiction: z.string().min(1),
  capabilities: z.array(z.string()).default([]),
  status: z.enum(["active", "standby", "draining"]).default("active"),
  latencyScore: z.number().nonnegative().default(0),
  residencyAllowed: z.boolean().default(true),
});

export type RegionDescriptor = z.input<typeof RegionDescriptorSchema>;

export function selectPreferredRegion(regions: readonly RegionDescriptor[]): RegionDescriptor | null {
  return regions
    .filter((item) => (item.residencyAllowed ?? true) && (item.status ?? "active") !== "disabled")
    .sort((left, right) => (left.latencyScore ?? 0) - (right.latencyScore ?? 0))[0] ?? null;
}
