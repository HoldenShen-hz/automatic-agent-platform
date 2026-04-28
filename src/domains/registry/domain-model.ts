import { z } from "zod";
import { DomainExecutionProfileSchema } from "../domain-specs.js";

const DOMAIN_STATUS_ALIASES = {
  testing: "validated",
} as const;

const DOMAIN_PLUGIN_TYPE_ALIASES = {
  planner: "tool",
  presenter: "tool",
  validator: "evaluator",
} as const;

const DOMAIN_PLUGIN_ROLE_ALIASES = {
  tool: "tool",
  adapter: "adapter",
  retriever: "retriever",
  evaluator: "evaluator",
  planner: "planner",
  presenter: "presenter",
  validator: "validator",
} as const;

export const StepTemplateConfigSchema = z.object({
  stepName: z.string().min(1),
  toolHints: z.array(z.string()).default([]),
  modelHints: z.object({
    preferredModel: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
  }).default({}),
  outputSchema: z.record(z.string(), z.unknown()).nullable().default(null),
  retryPolicy: z.object({
    maxRetries: z.number().int().nonnegative(),
    backoffMs: z.number().int().nonnegative(),
  }).default({ maxRetries: 0, backoffMs: 0 }),
  requiresReview: z.boolean().default(false),
  timeoutMs: z.number().int().positive().default(60000),
  dependsOn: z.array(z.string()).default([]),
});

export const WorkflowConfigSchema = z.object({
  workflowId: z.string().min(1),
  name: z.string().min(1),
  triggerConditions: z.record(z.string(), z.unknown()).default({}),
  steps: z.array(StepTemplateConfigSchema).default([]),
});

export const ToolBundleEntrySchema = z.object({
  toolName: z.string().min(1),
  enabled: z.boolean().default(true),
  configOverrides: z.record(z.string(), z.unknown()).default({}),
});

export const ToolBundleConfigSchema = z.object({
  bundleId: z.string().min(1),
  tools: z.array(ToolBundleEntrySchema).default([]),
});

export const OutputContractConfigSchema = z.object({
  contractId: z.string().min(1),
  name: z.string().min(1),
  schema: z.record(z.string(), z.unknown()).default({}),
  validationLevel: z.enum(["strict", "lenient", "none"]).default("strict"),
});

export const DomainCapabilityProfileSchema = z.object({
  supportedTaskTypes: z.array(z.string()).default([]),
  requiredTools: z.array(z.string()).default([]),
  optionalTools: z.array(z.string()).default([]),
  modelPreferences: z.record(z.string(), z.string()).default({}),
  budgetLimits: z.object({
    maxTokensPerTask: z.number().int().positive(),
    maxCostPerTask: z.number().positive(),
  }).default({ maxTokensPerTask: 4000, maxCostPerTask: 5 }),
  securityLevel: z.enum(["standard", "elevated", "restricted"]).default("standard"),
});

export const PluginBindingSchema = z.object({
  bindingId: z.string().min(1),
  domainId: z.string().min(1),
  pluginType: z.preprocess(
    (value) => typeof value === "string"
      ? DOMAIN_PLUGIN_TYPE_ALIASES[value as keyof typeof DOMAIN_PLUGIN_TYPE_ALIASES] ?? value
      : value,
    z.enum(["tool", "adapter", "retriever", "evaluator"]),
  ),
  bindingRole: z.preprocess(
    (value) => typeof value === "string"
      ? DOMAIN_PLUGIN_ROLE_ALIASES[value as keyof typeof DOMAIN_PLUGIN_ROLE_ALIASES] ?? value
      : undefined,
    z.enum(["tool", "adapter", "retriever", "evaluator", "planner", "presenter", "validator"]).optional(),
  ),
  pluginId: z.string().min(1),
  priority: z.number().int().default(0),
  enabled: z.boolean().default(true),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const DomainDefinitionSchema = z.object({
  domainId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.number().int().positive().default(1),
  workflows: z.array(WorkflowConfigSchema).default([]),
  toolBundles: z.array(ToolBundleConfigSchema).default([]),
  outputContracts: z.array(OutputContractConfigSchema).default([]),
  promptOverrides: z.record(z.string(), z.string()).default({}),
  capabilities: DomainCapabilityProfileSchema.default({}),
  status: z.preprocess(
    (value) => typeof value === "string"
      ? DOMAIN_STATUS_ALIASES[value as keyof typeof DOMAIN_STATUS_ALIASES] ?? value
      : value,
    z.enum(["draft", "validated", "registered", "active", "updating", "deprecated", "archived"]),
  ).default("draft"),
  executionProfile: DomainExecutionProfileSchema.default({}),
  externalAdapters: z.array(z.string()).default([]),
  pluginBindings: z.array(PluginBindingSchema).default([]),
});

export type StepTemplateConfig = z.infer<typeof StepTemplateConfigSchema>;
export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;
export type ToolBundleEntry = z.infer<typeof ToolBundleEntrySchema>;
export type ToolBundleConfig = z.infer<typeof ToolBundleConfigSchema>;
export type OutputContractConfig = z.infer<typeof OutputContractConfigSchema>;
export type DomainCapabilityProfile = z.infer<typeof DomainCapabilityProfileSchema>;
type PluginBindingParsed = z.infer<typeof PluginBindingSchema>;
export type PluginBinding = Omit<PluginBindingParsed, "pluginType"> & {
  pluginType: PluginBindingParsed["pluginType"] | "planner" | "presenter" | "validator";
};
type DomainDefinitionParsed = z.infer<typeof DomainDefinitionSchema>;
export type DomainDefinition = Omit<DomainDefinitionParsed, "status" | "pluginBindings" | "executionProfile"> & {
  status: DomainDefinitionParsed["status"] | "testing";
  pluginBindings: PluginBinding[];
  executionProfile?: DomainDefinitionParsed["executionProfile"];
};
export type DomainDefinitionExtended = DomainDefinition;
