import { z } from "zod";

export const DomainGovernanceRolloutSchema = z.object({
  strategy: z.enum(["manual", "canary", "shadow", "supervised_auto"]).default("canary"),
  approvalRequired: z.boolean().default(true),
  rollbackWindowMinutes: z.number().int().positive().default(60),
});

export const DomainGovernancePolicySchema = z.object({
  policyId: z.string().min(1),
  domainId: z.string().min(1),
  ownerRoles: z.array(z.string().min(1)).min(1),
  operatorRoles: z.array(z.string().min(1)).min(1),
  approvalRoles: z.array(z.string().min(1)).min(1),
  restrictedDataClasses: z.array(z.string().min(1)).default([]),
  rollout: DomainGovernanceRolloutSchema,
  mandatoryEvidence: z.array(z.string().min(1)).default([]),
});

export type DomainGovernanceRollout = z.infer<typeof DomainGovernanceRolloutSchema>;
export type DomainGovernancePolicy = z.infer<typeof DomainGovernancePolicySchema>;
