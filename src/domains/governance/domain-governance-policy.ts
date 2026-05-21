import { z } from "zod";

const DomainGovernanceRoleSchema = z.string().trim().min(1);

export const DomainGovernanceRolloutSchema = z.object({
  strategy: z.enum(["manual", "canary", "shadow", "supervised_auto"]).default("canary"),
  approvalRequired: z.boolean().default(true),
  rollbackWindowMinutes: z.number().int().positive().default(60),
});

export const DomainGovernancePolicySchema = z.object({
  policyId: z.string().trim().min(1),
  domainId: z.string().trim().min(1),
  ownerRoles: z.array(DomainGovernanceRoleSchema).min(1),
  operatorRoles: z.array(DomainGovernanceRoleSchema).min(1),
  approvalRoles: z.array(DomainGovernanceRoleSchema).min(1),
  restrictedDataClasses: z.array(z.string().min(1)).default([]),
  sloProfile: z.object({
    latencySloMs: z.number().int().positive().optional(),
    availabilityTarget: z.number().min(0).max(1).optional(),
    freshnessSloMinutes: z.number().int().positive().optional(),
  }).default({}),
  budgetConstraints: z.object({
    maxCostUsdPerDay: z.number().nonnegative().optional(),
    maxTokensPerDay: z.number().int().nonnegative().optional(),
    maxConcurrentRuns: z.number().int().positive().optional(),
  }).default({}),
  maxHibernationRenewals: z.number().int().nonnegative().default(0),
  complianceRules: z.array(z.string().min(1)).default([]),
  recertification: z.object({
    cadence: z.enum(["quarterly", "semi_annual", "annual", "on_change"]).default("annual"),
    requiredEvidence: z.array(z.string().min(1)).default([]),
  }).default({
    cadence: "annual",
    requiredEvidence: [],
  }),
  waiver: z.object({
    allowed: z.boolean().default(false),
    approvalRoles: z.array(DomainGovernanceRoleSchema).default([]),
    maxDurationDays: z.number().int().positive().default(30),
  }).default({
    allowed: false,
    approvalRoles: [],
    maxDurationDays: 30,
  }),
  rollout: DomainGovernanceRolloutSchema.default({
    strategy: "canary",
    approvalRequired: true,
    rollbackWindowMinutes: 60,
  }),
  mandatoryEvidence: z.array(z.string().min(1)).default([]),
});

export type DomainGovernanceRollout = z.infer<typeof DomainGovernanceRolloutSchema>;
export type DomainGovernancePolicy = z.infer<typeof DomainGovernancePolicySchema>;
