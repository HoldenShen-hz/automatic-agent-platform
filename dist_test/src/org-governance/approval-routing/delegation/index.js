import { z } from "zod";
export const ApprovalDelegationSchema = z.object({
    delegationId: z.string().min(1),
    approverId: z.string().min(1),
    delegateApproverId: z.string().min(1),
    scopeNodeIds: z.array(z.string()).default([]),
    startsAt: z.string().min(1),
    expiresAt: z.string().min(1),
    active: z.boolean().default(true),
});
export function resolveDelegatedApprover(delegations, approverId, orgNodeId, nowIso) {
    const match = delegations.find((item) => item.active
        && item.approverId === approverId
        && item.startsAt <= nowIso
        && item.expiresAt >= nowIso
        && (item.scopeNodeIds.length === 0 || item.scopeNodeIds.includes(orgNodeId)));
    return match?.delegateApproverId ?? approverId;
}
