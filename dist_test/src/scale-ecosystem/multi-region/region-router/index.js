import { z } from "zod";
export const RegionDescriptorSchema = z.object({
    regionId: z.string().min(1),
    countryCode: z.string().min(2).default("XX"),
    jurisdiction: z.string().min(1),
    capabilities: z.array(z.string()).default([]),
    status: z.enum(["active", "degraded", "disabled"]).default("active"),
    latencyScore: z.number().nonnegative(),
    residencyAllowed: z.boolean().default(true),
});
export function selectPreferredRegion(regions) {
    return regions
        .filter((item) => (item.residencyAllowed ?? true) && (item.status ?? "active") !== "disabled")
        .sort((left, right) => left.latencyScore - right.latencyScore)[0] ?? null;
}
//# sourceMappingURL=index.js.map