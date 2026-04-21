import { z } from "zod";
export const PublisherProfileSchema = z.object({
    publisherId: z.string().min(1),
    displayName: z.string().min(1),
    trustLevel: z.enum(["sandboxed", "verified", "enterprise"]),
    allowedArtifactTypes: z.array(z.string()).default([]),
});
export function canPublisherReleaseArtifact(profile, artifactType) {
    return profile.allowedArtifactTypes.includes(artifactType);
}
//# sourceMappingURL=index.js.map