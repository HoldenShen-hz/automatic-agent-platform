import { z } from "zod";

const TemplateParameterOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

const TemplateParameterSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "select", "multiselect"]),
  required: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  options: z.array(TemplateParameterOptionSchema).default([]),
});

const TemplateMarketplaceBindingSchema = z.object({
  listingId: z.string().min(1),
  packId: z.string().min(1).optional(),
  publisherId: z.string().min(1).optional(),
  channel: z.enum(["built_in", "marketplace", "private_catalog"]).default("built_in"),
});

const TemplateWorkflowDefaultsSchema = z.object({
  divisionId: z.string().min(1).optional(),
  workflowId: z.string().min(1).optional(),
  executionMode: z.enum(["auto", "supervised", "manual"]).optional(),
  approvalMode: z.enum(["none", "simple", "full"]).optional(),
});

const StructuredTemplateStepSchema = z.object({
  stepId: z.string().min(1),
  inputMappings: z.record(z.string(), z.unknown()).default({}),
  outputMappings: z.record(z.string(), z.unknown()).default({}),
});

const TemplateStepSchema = z.union([z.string().min(1), StructuredTemplateStepSchema]);

export const InteractionTemplateSchema = z.object({
  templateId: z.string().min(1),
  title: z.string().min(1),
  domainId: z.string().min(1).optional(),
  riskProfile: z.enum(["low", "medium", "high", "critical"]).optional(),
  version: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  parameters: z.array(TemplateParameterSchema).default([]),
  requiredCapabilities: z.array(z.string().min(1)).default([]),
  catalogTags: z.array(z.string().min(1)).default([]),
  marketplaceBinding: TemplateMarketplaceBindingSchema.optional(),
  workflowDefaults: TemplateWorkflowDefaultsSchema.optional(),
  steps: z.array(TemplateStepSchema).default([]),
});

export type InteractionTemplate = z.infer<typeof InteractionTemplateSchema>;
export type InteractionTemplateStep = z.infer<typeof StructuredTemplateStepSchema>;
export type InteractionTemplateParameter = z.infer<typeof TemplateParameterSchema>;

export interface TemplateInstantiationResult {
  readonly workflowConfig: InteractionTemplate;
  readonly boundSteps: readonly string[];
  readonly parameterValues: Readonly<Record<string, unknown>>;
}

export interface TemplateDomainValidationResult {
  readonly compatible: boolean;
  readonly missingCapabilities: readonly string[];
}

export interface TemplateRecommendation {
  readonly templateId: string;
  readonly score: number;
  readonly reasons: readonly string[];
}

function normalizeTemplateStep(step: InteractionTemplate["steps"][number]): InteractionTemplateStep {
  if (typeof step === "string") {
    return {
      stepId: step,
      inputMappings: {},
      outputMappings: {},
    };
  }
  return StructuredTemplateStepSchema.parse(step);
}

export function applyInteractionTemplate(template: InteractionTemplate, overrides: Partial<InteractionTemplate> = {}): InteractionTemplate {
  return InteractionTemplateSchema.parse({
    ...template,
    ...overrides,
  });
}

export function instantiateTemplate(
  template: InteractionTemplate,
  parameterValues: Record<string, unknown> = {},
): TemplateInstantiationResult {
  const normalized = InteractionTemplateSchema.parse(template);
  const resolvedParameterValues: Record<string, unknown> = {};
  const resolvedParameters = normalized.parameters.map((parameter) => {
    const provided = parameterValues[parameter.name];
    if (provided === undefined && parameter.required && parameter.defaultValue === undefined) {
      throw new Error("template.missing_required_parameters");
    }
    const resolvedValue = provided ?? parameter.defaultValue;
    if (resolvedValue !== undefined) {
      resolvedParameterValues[parameter.name] = resolvedValue;
    }
    return {
      ...parameter,
      ...(provided === undefined ? {} : { defaultValue: provided }),
    };
  });

  return {
    workflowConfig: {
      ...normalized,
      parameters: resolvedParameters,
      steps: normalized.steps.map((step) => normalizeTemplateStep(step)),
    },
    boundSteps: normalized.steps.map((step) => normalizeTemplateStep(step).stepId),
    parameterValues: resolvedParameterValues,
  };
}

export function validateTemplateForDomain(
  template: InteractionTemplate,
  domainId: string,
  availableCapabilities: readonly string[],
): TemplateDomainValidationResult {
  const normalized = InteractionTemplateSchema.parse(template);
  const missingCapabilities = normalized.requiredCapabilities.filter((capability) => !availableCapabilities.includes(capability));
  return {
    compatible: (normalized.domainId == null || normalized.domainId === domainId) && missingCapabilities.length === 0,
    missingCapabilities,
  };
}

export function recommendTemplatesForDomain(
  templates: readonly InteractionTemplate[],
  input: {
    readonly domainId: string;
    readonly availableCapabilities?: readonly string[];
    readonly desiredRiskProfile?: InteractionTemplate["riskProfile"];
    readonly desiredTags?: readonly string[];
  },
): readonly TemplateRecommendation[] {
  const capabilities = new Set(input.availableCapabilities ?? []);
  const desiredTags = new Set(input.desiredTags ?? []);

  return templates
    .map((template) => InteractionTemplateSchema.parse(template))
    .map((template) => {
      let score = 0;
      const reasons: string[] = [];
      if (template.domainId == null || template.domainId === input.domainId) {
        score += 5;
        reasons.push("domain_match");
      }
      if (input.desiredRiskProfile != null && template.riskProfile === input.desiredRiskProfile) {
        score += 2;
        reasons.push("risk_profile_match");
      }
      const matchedTags = template.catalogTags.filter((tag) => desiredTags.has(tag));
      if (matchedTags.length > 0) {
        score += matchedTags.length;
        reasons.push(`tag_match:${matchedTags.join(",")}`);
      }
      const missingCapabilities = template.requiredCapabilities.filter((capability) => !capabilities.has(capability));
      if (missingCapabilities.length === 0) {
        score += template.requiredCapabilities.length > 0 ? 2 : 1;
        reasons.push("capability_ready");
      }
      return {
        templateId: template.templateId,
        score,
        reasons,
      } satisfies TemplateRecommendation;
    })
    .sort((left, right) => right.score - left.score || left.templateId.localeCompare(right.templateId));
}
