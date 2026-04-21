import { z } from "zod";
export declare const RegionDescriptorSchema: z.ZodObject<{
    regionId: z.ZodString;
    countryCode: z.ZodDefault<z.ZodString>;
    jurisdiction: z.ZodString;
    capabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodDefault<z.ZodEnum<["active", "degraded", "disabled"]>>;
    latencyScore: z.ZodNumber;
    residencyAllowed: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    status: "degraded" | "active" | "disabled";
    capabilities: string[];
    regionId: string;
    jurisdiction: string;
    countryCode: string;
    latencyScore: number;
    residencyAllowed: boolean;
}, {
    regionId: string;
    jurisdiction: string;
    latencyScore: number;
    status?: "degraded" | "active" | "disabled" | undefined;
    capabilities?: string[] | undefined;
    countryCode?: string | undefined;
    residencyAllowed?: boolean | undefined;
}>;
export type RegionDescriptor = z.input<typeof RegionDescriptorSchema>;
export declare function selectPreferredRegion(regions: readonly RegionDescriptor[]): RegionDescriptor | null;
