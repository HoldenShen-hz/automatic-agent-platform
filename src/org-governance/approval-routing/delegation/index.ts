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
  const nowMs = Date.parse(nowIso);
  const match = delegations.find((item) => {
    const startsAtMs = Date.parse(item.startsAt);
    const expiresAtMs = Date.parse(item.expiresAt);
    return item.active
      && item.approverId === approverId
      && Number.isFinite(nowMs)
      && Number.isFinite(startsAtMs)
      && Number.isFinite(expiresAtMs)
      && startsAtMs <= nowMs
      && expiresAtMs >= nowMs
      && (item.scopeNodeIds.length === 0 || item.scopeNodeIds.includes(orgNodeId))
      && (
        item.delegationType !== "peer_cover"
        || (item.coiReviewStatus === "passed"
          && !item.conflictOfInterestApproverIds.includes(item.delegateApproverId))
      );
  });
  return match?.delegateApproverId ?? approverId;
}
