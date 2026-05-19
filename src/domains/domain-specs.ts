import { z } from "zod";

const DOMAIN_LIFECYCLE_STATE_ALIASES = {
  draft: "validating",
  Draft: "validating",
  validated: "certified",
  Validated: "certified",
  registered: "canary",
  Registered: "canary",
  updating: "canary",
  Updating: "canary",
  Active: "active",
  Deprecated: "deprecated",
  archived: "retired",
  Archived: "retired",
} as const;

const DomainRecipeArchetypeSchemaInternal = z.enum([
  "crud_heavy",
  "analytics",
  "creative",
  "realtime",
  "trading",
  "compliance",
  "research",
  "adversarial",
  "moderation",
  "logistics",
  "conversational",
  "incident_ops",
]);

export const DomainLifecycleStateSchema = z.preprocess(
  (value) => typeof value === "string"
    ? DOMAIN_LIFECYCLE_STATE_ALIASES[value as keyof typeof DOMAIN_LIFECYCLE_STATE_ALIASES] ?? value
    : value,
  z.enum([
    "validating",
    "certified",
    "canary",
    "active",
    "deprecated",
    "retired",
  ]),
);

export const DomainPlanningModeSchema = z.enum(["llm_assisted", "deterministic_only"]);
export const DomainHotPathModeSchema = z.enum(["deterministic_only", "llm_allowed"]);
export const DomainLatencyTierSchema = z.preprocess(
  (value) => {
    if (value === "interactive") {
      return "near_realtime";
    }
    return value;
  },
  z.enum(["realtime", "near_realtime", "batch"]),
);

export const DomainExecutionProfileSchema = z.object({
  executionMode: z.object({
    planningMode: DomainPlanningModeSchema.default("llm_assisted"),
    hotPathMode: DomainHotPathModeSchema.default("llm_allowed"),
    llmInHotPathAllowed: z.boolean().default(true),
    maxHotPathLatencyMs: z.number().int().positive().default(1000),
  }).default({
    planningMode: "llm_assisted",
    hotPathMode: "llm_allowed",
    llmInHotPathAllowed: true,
    maxHotPathLatencyMs: 1000,
  }),
  latencyTier: DomainLatencyTierSchema.default("near_realtime"),
  compiledArtifactRef: z.string().trim().min(1).nullable().default(null),
});

export const DomainCoreDescriptorSchema = z.object({
  domainId: z.string().min(1),
  ownerOrgNodeId: z.string().min(1),
  primaryEntities: z.array(z.string().min(1)).default([]),
  recipeArchetype: DomainRecipeArchetypeSchemaInternal,
  lifecycleState: DomainLifecycleStateSchema.default("validating"),
});

export const DomainRiskSpecSchema = z.object({
  domainId: z.string().min(1),
  riskClass: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  advisoryOnly: z.boolean().default(false),
  humanAccountable: z.boolean().default(false),
  deterministicHotPathOnly: z.boolean().default(false),
  allowedCapabilityOverrides: z.array(z.string().min(1)).default([]),
  requiredApprovalPolicies: z.array(z.string().min(1)).default([]),
  evidenceRequirements: z.array(z.string().min(1)).default([]),
  liabilityOwner: z.array(z.string().min(1)).min(1),
  compensationModel: z.array(z.enum(["refund", "reversal", "appeal", "manual_repair", "no_compensation"])).min(1),
  sideEffectTypes: z.array(z.string().min(1)).default([]),
  approvalThresholds: z.record(z.string(), z.number().nonnegative()).default({}),
});

export const DomainKnowledgeSpecSchema = z.object({
  domainId: z.string().min(1),
  knowledgeSources: z.array(z.string().min(1)).default([]),
  accessControlPolicy: z.string().trim().min(1).default("platform_default"),
  freshnessPolicy: z.string().trim().min(1).default("scheduled_refresh"),
  conflictResolutionPolicy: z.string().trim().min(1).default("trust_priority"),
});

export const DomainEvalSpecSchema = z.object({
  domainId: z.string().min(1),
  evalBaselines: z.array(z.string().min(1)).default([]),
  criticalCases: z.array(z.string().min(1)).default([]),
  acceptanceThresholds: z.record(z.string(), z.number()).default({}),
  adversarialScenarios: z.array(z.string().min(1)).default([]),
});

export const DomainGovernanceSpecSchema = z.object({
  domainId: z.string().min(1),
  hitlPolicy: z.string().trim().min(1).default("platform_default"),
  recertificationPolicy: z.string().trim().min(1).default("annual"),
  waiverPolicy: z.string().trim().min(1).default("explicit_waiver_required"),
  policyRefs: z.array(z.string().min(1)).default([]),
});

export const DomainInteractionSpecSchema = z.object({
  domainId: z.string().min(1),
  nlEntryPolicy: z.string().trim().min(1).default("clarify_before_execute"),
  dashboardPolicy: z.string().trim().min(1).default("evidence_backed"),
  proactiveTriggerPolicy: z.string().trim().min(1).default("budget_gated"),
  userExperiencePolicy: z.string().trim().min(1).default("operator_friendly"),
});

export type DomainLifecycleState = z.infer<typeof DomainLifecycleStateSchema>;
export type DomainPlanningMode = z.infer<typeof DomainPlanningModeSchema>;
export type DomainHotPathMode = z.infer<typeof DomainHotPathModeSchema>;
export type DomainLatencyTier = z.infer<typeof DomainLatencyTierSchema>;
export type DomainExecutionProfile = z.infer<typeof DomainExecutionProfileSchema>;
export type DomainCoreDescriptor = z.infer<typeof DomainCoreDescriptorSchema>;
export type DomainRiskSpec = z.infer<typeof DomainRiskSpecSchema>;
export type DomainKnowledgeSpec = z.infer<typeof DomainKnowledgeSpecSchema>;
export type DomainEvalSpec = z.infer<typeof DomainEvalSpecSchema>;
export type DomainGovernanceSpec = z.infer<typeof DomainGovernanceSpecSchema>;
export type DomainInteractionSpec = z.infer<typeof DomainInteractionSpecSchema>;

const DEFAULT_DOMAIN_RISK_SPECS = {
  healthcare: {
    domainId: "healthcare",
    riskClass: "critical",
    advisoryOnly: true,
    humanAccountable: true,
    deterministicHotPathOnly: true,
    liabilityOwner: ["healthcare-owners"],
    compensationModel: ["manual_repair", "appeal"],
  },
  "quant-trading": {
    domainId: "quant-trading",
    riskClass: "high",
    advisoryOnly: false,
    humanAccountable: true,
    deterministicHotPathOnly: true,
    liabilityOwner: ["quant-trading-owners"],
    compensationModel: ["reversal", "manual_repair"],
  },
  "financial-services": {
    domainId: "financial-services",
    riskClass: "high",
    advisoryOnly: false,
    humanAccountable: true,
    deterministicHotPathOnly: true,
    liabilityOwner: ["financial-services-owners"],
    compensationModel: ["reversal", "manual_repair"],
  },
  legal: {
    domainId: "legal",
    riskClass: "critical",
    advisoryOnly: true,
    humanAccountable: true,
    deterministicHotPathOnly: true,
    liabilityOwner: ["legal-owners"],
    compensationModel: ["appeal", "manual_repair"],
  },
} as const satisfies Record<string, Pick<DomainRiskSpec, "domainId" | "riskClass" | "advisoryOnly" | "humanAccountable" | "deterministicHotPathOnly" | "liabilityOwner" | "compensationModel">>;

export function resolveDomainRiskSpec(domainId: string): DomainRiskSpec | null {
  const normalized = domainId.trim().toLowerCase();
  const spec = DEFAULT_DOMAIN_RISK_SPECS[normalized as keyof typeof DEFAULT_DOMAIN_RISK_SPECS];
  if (spec == null) {
    return null;
  }
  return DomainRiskSpecSchema.parse({
    ...spec,
    sideEffectTypes: [],
    approvalThresholds: {},
  });
}
