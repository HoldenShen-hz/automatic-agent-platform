import { z } from "zod";

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

export const DomainLifecycleStateSchema = z.enum([
  "draft",
  "validating",
  "testing",
  "certified",
  "registered",
  "canary",
  "active",
  "deprecated",
  "retired",
  "archived",
  "updating",
  "validated",
]);

export const DomainPlanningModeSchema = z.enum(["llm_assisted", "deterministic_only"]);
export const DomainHotPathModeSchema = z.enum(["deterministic_only", "llm_allowed"]);

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
  latencyTier: z.enum(["realtime", "near_realtime", "interactive", "batch"]).default("interactive"),
  compiledArtifactRef: z.string().trim().min(1).nullable().default(null),
});

export const DomainCoreDescriptorSchema = z.object({
  domainId: z.string().min(1),
  ownerOrgNodeId: z.string().min(1),
  primaryEntities: z.array(z.string().min(1)).default([]),
  recipeArchetype: DomainRecipeArchetypeSchemaInternal,
  lifecycleState: DomainLifecycleStateSchema.default("draft"),
});

const DomainRiskSpecSchemaBase = z.object({
  domainId: z.string().min(1),
  riskClass: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  advisoryOnly: z.boolean().default(false),
  humanAccountable: z.boolean().default(false),
  deterministicHotPathOnly: z.boolean().default(false),
  allowedCapabilityOverrides: z.array(z.string().min(1)).default([]),
  requiredApprovalPolicies: z.array(z.string().min(1)).default([]),
  liabilityOwner: z.array(z.string().min(1)).min(1),
  compensationModel: z.array(z.enum(["refund", "reversal", "appeal", "manual_repair", "no_compensation"])).min(1),
  sideEffectTypes: z.array(z.string().min(1)).default([]),
  approvalThresholds: z.record(z.string(), z.number().nonnegative()).default({}),
});

function normalizeDomainRiskSpecInput(input: unknown): unknown {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }
  const record = input as Record<string, unknown>;
  return {
    ...record,
    advisoryOnly: record.advisoryOnly ?? record.advisory_only,
    humanAccountable: record.humanAccountable ?? record.human_accountable,
    deterministicHotPathOnly: record.deterministicHotPathOnly ?? record.deterministic_hot_path_only,
    allowedCapabilityOverrides: record.allowedCapabilityOverrides ?? record.allowed_capability_overrides,
    requiredApprovalPolicies: record.requiredApprovalPolicies ?? record.required_approval_policies,
  };
}

export const DomainRiskSpecSchema = z.preprocess(normalizeDomainRiskSpecInput, DomainRiskSpecSchemaBase);

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
export type DomainExecutionProfile = z.infer<typeof DomainExecutionProfileSchema>;
export type DomainCoreDescriptor = z.infer<typeof DomainCoreDescriptorSchema>;
export type DomainRiskSpec = z.infer<typeof DomainRiskSpecSchema>;
export type DomainKnowledgeSpec = z.infer<typeof DomainKnowledgeSpecSchema>;
export type DomainEvalSpec = z.infer<typeof DomainEvalSpecSchema>;
export type DomainGovernanceSpec = z.infer<typeof DomainGovernanceSpecSchema>;
export type DomainInteractionSpec = z.infer<typeof DomainInteractionSpecSchema>;

/**
 * ResponsibilityBoundary defines how a domain constrains agent autonomy.
 * - advisory_only: domain is informational; no blocking enforcement
 * - human_accountable: domain requires human acknowledgment before autonomous action
 * - deterministic_hot_path_only: domain permits only deterministic (non-LLM) execution in hot path
 * - fully_autonomous: domain permits full autonomous execution
 */
export type ResponsibilityBoundary =
  | "advisory_only"
  | "human_accountable"
  | "deterministic_hot_path_only"
  | "fully_autonomous";

/**
 * Maps DomainRiskSpec flags to a single ResponsibilityBoundary for runtime evaluation.
 */
export function toResponsibilityBoundary(spec: DomainRiskSpec): ResponsibilityBoundary {
  if (spec.deterministicHotPathOnly) {
    return "deterministic_hot_path_only";
  }
  if (spec.humanAccountable) {
    return "human_accountable";
  }
  if (spec.advisoryOnly) {
    return "advisory_only";
  }
  return "fully_autonomous";
}

/**
 * Enforces that a given boundary level is respected at runtime.
 * Returns an error code string if violated, or null if permitted.
 */
export function enforceResponsibilityBoundary(
  boundary: ResponsibilityBoundary,
  proposedAutonomy: "full_auto" | "llm_assisted" | "human_required",
): string | null {
  switch (boundary) {
    case "deterministic_hot_path_only":
      if (proposedAutonomy !== "human_required") {
        return "domain.responsibility_boundary.deterministic_only_violation";
      }
      return null;
    case "human_accountable":
      if (proposedAutonomy === "full_auto") {
        return "domain.responsibility_boundary.human_accountable_violation";
      }
      return null;
    case "advisory_only":
    case "fully_autonomous":
      return null;
  }
}

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
