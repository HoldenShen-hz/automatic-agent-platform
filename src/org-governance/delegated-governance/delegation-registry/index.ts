import { z } from "zod";

export const GovernanceDelegationSchema = z.object({
  delegationId: z.string().min(1),
  grantorId: z.string().min(1),
  granteeId: z.string().min(1),
  orgNodeIds: z.array(z.string()).default([]),
  domainIds: z.array(z.string()).default([]),
  capabilities: z.array(z.string()).default([]),
  expiresAt: z.string().min(1),
  revocable: z.boolean().default(true),
  status: z.enum(["active", "revoked", "expired"]).default("active"),
});

export type GovernanceDelegation = z.infer<typeof GovernanceDelegationSchema>;

export function listActiveGovernanceDelegations(
  delegations: readonly GovernanceDelegation[],
  nowIso: string,
): GovernanceDelegation[] {
  return delegations.filter((item) => item.status === "active" && item.expiresAt >= nowIso);
}
