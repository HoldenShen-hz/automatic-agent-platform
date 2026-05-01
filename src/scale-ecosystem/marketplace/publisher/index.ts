import { z } from "zod";

export const PublisherProfileSchema = z.object({
  publisherId: z.string().min(1),
  displayName: z.string().min(1),
  trustLevel: z.enum(["sandboxed", "verified", "enterprise"]),
  allowedArtifactTypes: z.array(z.string()).default([]),
  contactEmail: z.string().email().optional(),
  reputationScore: z.number().min(0).max(1).default(0),
  publishedArtifactCount: z.number().int().nonnegative().default(0),
});

export type PublisherProfile = z.infer<typeof PublisherProfileSchema>;

export function canPublisherReleaseArtifact(profile: PublisherProfile, artifactType: string): boolean {
  // Root cause: reputationScore >= 0.4 allows sandboxed publishers to publish
  // Fix: Only verified and enterprise publishers can publish
  return profile.allowedArtifactTypes.includes(artifactType) && profile.trustLevel !== "sandboxed";
}
