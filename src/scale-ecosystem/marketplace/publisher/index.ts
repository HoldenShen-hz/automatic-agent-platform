import { z } from "zod";

export const PublisherProfileSchema = z.object({
  publisherId: z.string().min(1),
  displayName: z.string().min(1),
  trustLevel: z.enum(["sandboxed", "verified", "enterprise"]),
  allowedArtifactTypes: z.array(z.string()).default([]),
});

export type PublisherProfile = z.infer<typeof PublisherProfileSchema>;

export function canPublisherReleaseArtifact(profile: PublisherProfile, artifactType: string): boolean {
  return profile.allowedArtifactTypes.includes(artifactType);
}
