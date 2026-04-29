import { z } from "zod";

/**
 * §44.3: Workflow template with domain binding, parameters, and marketplace metadata.
 * Supports parametric workflows where steps can have input/output bindings.
 */
export const WorkflowParameterSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["string", "number", "boolean", "select", "multiselect"]),
  required: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
});

export type WorkflowParameter = z.infer<typeof WorkflowParameterSchema>;

export const WorkflowStepBindingSchema = z.object({
  stepId: z.string().min(1),
  inputMappings: z.record(z.string(), z.string()).default({}),
  outputMappings: z.record(z.string(), z.string()).default({}),
});

export const InteractionTemplateSchema = z.object({
  templateId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  /** Domain this template belongs to */
  domainId: z.string().min(1),
  /** Risk profile of tasks created from this template */
  riskProfile: z.enum(["low", "medium", "high", "critical"]).default("low"),
  /** Template version for marketplace compatibility */
  version: z.string().default("1.0.0"),
  /** Parameters for parametric workflow instantiation */
  parameters: z.array(WorkflowParameterSchema).default([]),
  /** Step definitions with bindings for parameter injection */
  steps: z.array(WorkflowStepBindingSchema).default([]),
  /** Estimated cost range for template execution */
  estimatedCostUsd: z.number().optional(),
  /** Required capabilities for executing this template */
  requiredCapabilities: z.array(z.string()).default([]),
  /** Template marketplace metadata */
  marketplace: z.object({
    listingId: z.string().optional(),
    author: z.string().optional(),
    tags: z.array(z.string()).default([]),
    popularityScore: z.number().optional(),
    certifiedAt: z.string().optional(),
  }).optional(),
});

export type InteractionTemplate = z.infer<typeof InteractionTemplateSchema>;

/**
 * §44.3: Instantiate a template with provided parameter values
 */
export function instantiateTemplate(
  template: InteractionTemplate,
  parameterValues: Record<string, unknown> = {},
): { workflowConfig: InteractionTemplate; boundSteps: string[] } {
  // Validate required parameters are provided
  const missingRequired = template.parameters
    .filter((p) => p.required && parameterValues[p.name] === undefined && p.defaultValue === undefined)
    .map((p) => p.name);

  if (missingRequired.length > 0) {
    throw new Error(`template.missing_required_parameters:${missingRequired.join(",")}`);
  }

  // Merge defaults with provided values
  const resolvedParams: Record<string, unknown> = {};
  for (const param of template.parameters) {
    resolvedParams[param.name] = parameterValues[param.name] ?? param.defaultValue;
  }

  return {
    workflowConfig: {
      ...template,
      parameters: template.parameters.map((p) => ({
        ...p,
        defaultValue: resolvedParams[p.name],
      })),
    },
    boundSteps: template.steps.map((s) => s.stepId),
  };
}

/**
 * §44.3: Validate template compatibility with target domain
 */
export function validateTemplateForDomain(
  template: InteractionTemplate,
  domainId: string,
  availableCapabilities: string[],
): { compatible: boolean; missingCapabilities: string[] } {
  const missingCapabilities = template.requiredCapabilities.filter(
    (cap) => !availableCapabilities.includes(cap),
  );
  return {
    compatible: template.domainId === domainId && missingCapabilities.length === 0,
    missingCapabilities,
  };
}

export function applyInteractionTemplate(
  template: InteractionTemplate,
  overrides: Partial<InteractionTemplate> = {},
): InteractionTemplate {
  return InteractionTemplateSchema.parse({
    ...template,
    ...overrides,
  });
}