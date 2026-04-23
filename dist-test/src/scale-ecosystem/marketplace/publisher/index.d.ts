import { z } from "zod";
export declare const PublisherProfileSchema: z.ZodObject<{
    publisherId: z.ZodString;
    displayName: z.ZodString;
    trustLevel: z.ZodEnum<["sandboxed", "verified", "enterprise"]>;
    allowedArtifactTypes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    contactEmail: z.ZodOptional<z.ZodString>;
    reputationScore: z.ZodDefault<z.ZodNumber>;
    publishedArtifactCount: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    displayName: string;
    trustLevel: "verified" | "enterprise" | "sandboxed";
    publisherId: string;
    allowedArtifactTypes: string[];
    reputationScore: number;
    publishedArtifactCount: number;
    contactEmail?: string | undefined;
}, {
    displayName: string;
    trustLevel: "verified" | "enterprise" | "sandboxed";
    publisherId: string;
    allowedArtifactTypes?: string[] | undefined;
    contactEmail?: string | undefined;
    reputationScore?: number | undefined;
    publishedArtifactCount?: number | undefined;
}>;
export type PublisherProfile = z.infer<typeof PublisherProfileSchema>;
export declare function canPublisherReleaseArtifact(profile: PublisherProfile, artifactType: string): boolean;
