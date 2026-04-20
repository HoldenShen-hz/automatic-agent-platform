import { z } from "zod";

export const RegionDescriptorSchema = z.object({
  regionId: z.string().min(1),
  jurisdiction: z.string().min(1),
  latencyScore: z.number().nonnegative(),
  residencyAllowed: z.boolean().default(true),
});

export type RegionDescriptor = z.infer<typeof RegionDescriptorSchema>;

export function selectPreferredRegion(regions: readonly RegionDescriptor[]): RegionDescriptor | null {
  return regions
    .filter((item) => item.residencyAllowed)
    .sort((left, right) => left.latencyScore - right.latencyScore)[0] ?? null;
}
