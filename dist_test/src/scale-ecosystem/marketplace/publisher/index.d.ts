import { z } from "zod";
export declare const PublisherProfileSchema: z.ZodObject<{
    publisherId: z.ZodString;
    displayName: z.ZodString;
    trustLevel: z.ZodEnum<["sandboxed", "verified", "enterprise"]>;
    allowedArtifactTypes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    displayName: string;
    trustLevel: "verified" | "enterprise" | "sandboxed";
    publisherId: string;
    allowedArtifactTypes: string[];
}, {
    displayName: string;
    trustLevel: "verified" | "enterprise" | "sandboxed";
    publisherId: string;
    allowedArtifactTypes?: string[] | undefined;
}>;
export type PublisherProfile = z.infer<typeof PublisherProfileSchema>;
export declare function canPublisherReleaseArtifact(profile: PublisherProfile, artifactType: string): boolean;
