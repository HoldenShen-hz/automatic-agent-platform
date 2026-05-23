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
export type ApprovalDelegationInput = z.input<typeof ApprovalDelegationSchema>;

export function resolveDelegatedApprover(
  delegations: readonly ApprovalDelegationInput[],
  approverId: string,
  orgNodeId: string,
  nowIso: string,
): string {
  const nowMs = Date.parse(nowIso);
  const match = delegations.find((item) => {
    const normalized = ApprovalDelegationSchema.parse(item);
    const startsAtMs = Date.parse(normalized.startsAt);
    const expiresAtMs = Date.parse(normalized.expiresAt);
    return normalized.active
      && normalized.approverId === approverId
      && Number.isFinite(nowMs)
      && Number.isFinite(startsAtMs)
      && Number.isFinite(expiresAtMs)
      && startsAtMs <= nowMs
      && expiresAtMs >= nowMs
      && (normalized.scopeNodeIds.length === 0 || normalized.scopeNodeIds.includes(orgNodeId))
      && (
        normalized.delegationType !== "peer_cover"
        || (normalized.coiReviewStatus === "passed"
          && !normalized.conflictOfInterestApproverIds.includes(normalized.delegateApproverId))
      );
  });
  return match == null ? approverId : ApprovalDelegationSchema.parse(match).delegateApproverId;
}
