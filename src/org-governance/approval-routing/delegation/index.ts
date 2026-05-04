import { z } from "zod";

export const ApprovalDelegationSchema = z.object({
  delegationId: z.string().min(1),
  approverId: z.string().min(1),
  delegateApproverId: z.string().min(1),
  delegationType: z.enum(["manager_cover", "peer_cover", "temporary_cover"]).default("temporary_cover"),
  scopeNodeIds: z.array(z.string()).default([]),
  conflictOfInterestApproverIds: z.array(z.string()).default([]),
  coiReviewStatus: z.enum(["pending", "passed", "failed"]).default("pending"),
  startsAt: z.string().min(1),
  expiresAt: z.string().min(1),
  active: z.boolean().default(true),
});

export type ApprovalDelegation = z.infer<typeof ApprovalDelegationSchema>;

export function resolveDelegatedApprover(
  delegations: readonly ApprovalDelegation[],
  approverId: string,
  orgNodeId: string,
  nowIso: string,
): string {
  const match = delegations.find((item) => {
    // R30-35 FIX: Compare dates as Date objects, not lexicographic ISO strings.
    // Root cause: ISO date strings with different timezone offsets (Z, +00:00, +08:00)
    // cannot be correctly compared using string comparison. For example, "12:00:00Z" and
    // "20:00:00+08:00" represent the same instant but compare incorrectly as strings.
    // Fix: Convert to Date objects which properly handle timezone-aware comparison.
    const startsAtDate = new Date(item.startsAt);
    const expiresAtDate = new Date(item.expiresAt);
    const nowDate = new Date(nowIso);
    return item.active
      && item.approverId === approverId
      && startsAtDate.getTime() <= nowDate.getTime()
      && expiresAtDate.getTime() >= nowDate.getTime()
      && (item.scopeNodeIds.length === 0 || item.scopeNodeIds.includes(orgNodeId))
      && item.coiReviewStatus !== "failed" // SECURITY FIX: Reject delegations with failed COI review
      && (
        item.delegationType !== "peer_cover"
        || (item.coiReviewStatus === "passed"
          && !item.conflictOfInterestApproverIds.includes(item.delegateApproverId))
      );
  });
  return match?.delegateApproverId ?? approverId;
}
