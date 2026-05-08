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
  parameters: z.array(TemplateParameterSchema).default([]),
  requiredCapabilities: z.array(z.string().min(1)).default([]),
  steps: z.array(TemplateStepSchema).default([]),
});

export type InteractionTemplate = z.infer<typeof InteractionTemplateSchema>;
export type InteractionTemplateStep = z.infer<typeof StructuredTemplateStepSchema>;
export type InteractionTemplateParameter = z.infer<typeof TemplateParameterSchema>;

export interface TemplateInstantiationResult {
  readonly workflowConfig: InteractionTemplate;
  readonly boundSteps: readonly string[];
}

export interface TemplateDomainValidationResult {
  readonly compatible: boolean;
  readonly missingCapabilities: readonly string[];
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
  const resolvedParameters = normalized.parameters.map((parameter) => {
    const provided = parameterValues[parameter.name];
    if (provided === undefined && parameter.required && parameter.defaultValue === undefined) {
      throw new Error("template.missing_required_parameters");
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
