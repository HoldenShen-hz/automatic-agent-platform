import { z } from "zod";

export const ReplicationPolicySchema = z.object({
  sourceRegionId: z.string().min(1),
  targetRegionIds: z.array(z.string()).default([]),
  residencyMode: z.enum(["same_jurisdiction", "allowed_cross_border", "blocked"]),
});

export type ReplicationPolicy = z.infer<typeof ReplicationPolicySchema>;

export function shouldReplicateToRegion(policy: ReplicationPolicy, targetRegionId: string): boolean {
  return policy.residencyMode !== "blocked" && policy.targetRegionIds.includes(targetRegionId);
}
