import { z } from "zod";
import {
  DomainCoreDescriptorSchema,
  DomainExecutionProfileSchema,
  DomainRiskSpecSchema,
  DomainKnowledgeSpecSchema,
  DomainEvalSpecSchema,
  DomainGovernanceSpecSchema,
  DomainInteractionSpecSchema,
} from "../domain-specs.js";

const NonEmptyTrimmedStringSchema = z.string().trim().min(1);

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

/**
 * §37.2 v4.3: DomainDescriptorBundle represents the 7 independent descriptors
 * that constitute a complete domain definition. Each descriptor can be
 * validated and versioned independently.
 */
export const DomainDescriptorBundleSchema = z.object({
  core: DomainCoreDescriptorSchema,
  risk: DomainRiskSpecSchema,
  knowledge: DomainKnowledgeSpecSchema,
  eval: DomainEvalSpecSchema,
  governance: DomainGovernanceSpecSchema,
  interaction: DomainInteractionSpecSchema,
  executionProfile: DomainExecutionProfileSchema.optional(),
});

export type DomainDescriptorBundle = z.infer<typeof DomainDescriptorBundleSchema>;

// §37 DomainManifest - required per §37 for capability matrix/risk classification/schema registry reference
export const DomainManifestSchema = z.object({
  domainId: NonEmptyTrimmedStringSchema,
  name: NonEmptyTrimmedStringSchema,
  version: NonEmptyTrimmedStringSchema,
  owner: NonEmptyTrimmedStringSchema,
  description: NonEmptyTrimmedStringSchema,
  // Capability matrix - lists all capabilities this domain provides
  capabilityMatrix: z.object({
    providedCapabilities: z.array(z.object({
      capabilityId: z.string().min(1),
      name: z.string().min(1),
      description: z.string().min(1),
      inputs: z.record(z.string(), z.unknown()),
      outputs: z.record(z.string(), z.unknown()),
    })).default([]),
    consumedCapabilities: z.array(z.string()).default([]),
  }).default({ providedCapabilities: [], consumedCapabilities: [] }),
  // Risk classification per §3.2
  riskClassification: z.object({
    riskClass: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    advisoryOnly: z.boolean().default(false),
    humanAccountable: z.boolean().default(false),
    deterministicHotPathOnly: z.boolean().default(false),
  }).default({ riskClass: "medium", advisoryOnly: false, humanAccountable: false, deterministicHotPathOnly: false }),
  // Schema registry reference for domain input/output schema version management
  schemaRegistryRef: z.string().nullable().default(null),
  // Lifecycle state: draft→canary→active→deprecated→archived per spec
  lifecycleState: z.enum(["draft", "canary", "active", "deprecated", "archived"]).default("draft"),
  // Trust level for the domain
  trustLevel: z.enum(["internal", "trusted", "community", "unverified"]).default("trusted"),
  // R34-36 FIX #1976: DomainManifest missing resource quotas.
  // Resource quotas enforce CPU/memory/storage limits per domain.
  resourceQuotas: z.object({
    maxCpuCores: z.number().positive().default(8),
    maxMemoryMb: z.number().positive().default(16384),
    maxStorageMb: z.number().positive().default(102400),
    maxConcurrentTasks: z.number().positive().default(100),
    maxTasksPerHour: z.number().positive().default(10000),
  }).default({}),
});

export type DomainManifest = z.infer<typeof DomainManifestSchema>;

export const StepTemplateConfigSchema = z.object({
  stepName: NonEmptyTrimmedStringSchema,
  toolHints: z.array(z.string()).default([]),
  modelHints: z.object({
    preferredModel: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
  }).default({}),
  outputSchema: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).nullable().default(null),
  retryPolicy: z.object({
    maxRetries: z.number().int().nonnegative(),
    backoffMs: z.number().int().nonnegative(),
  }).default({ maxRetries: 0, backoffMs: 0 }),
  requiresReview: z.boolean().default(false),
  timeoutMs: z.number().int().positive().default(60000),
  dependsOn: z.array(z.string()).default([]),
});

const WorkflowPlanNodeSchema = z.object({
  nodeId: NonEmptyTrimmedStringSchema,
  nodeType: z.enum(["tool", "llm", "hitl_wait", "subgraph", "evaluator", "router", "compensation"]),
  inputRefs: z.array(z.string()).default([]),
  outputSchemaRef: NonEmptyTrimmedStringSchema,
  riskClass: z.enum(["low", "medium", "high", "critical"]),
  budgetIntent: z.object({
    amount: z.number().nonnegative(),
    currency: NonEmptyTrimmedStringSchema,
    resourceKinds: z.array(z.string()).default([]),
  }),
  sideEffectProfile: z.object({
    mayCommitExternalEffect: z.boolean(),
    reversible: z.boolean(),
  }),
  retryPolicyRef: NonEmptyTrimmedStringSchema,
  timeoutMs: z.number().int().positive(),
});

const WorkflowPlanEdgeSchema = z.object({
  edgeId: NonEmptyTrimmedStringSchema,
  sourceNodeId: NonEmptyTrimmedStringSchema,
  targetNodeId: NonEmptyTrimmedStringSchema,
  condition: z.unknown().default("always"),
  dependencyType: z.enum(["hard", "soft", "compensation", "retry", "replan"]).default("hard"),
});

const WorkflowPlanGraphSchema = z.object({
  graphId: NonEmptyTrimmedStringSchema,
  nodes: z.array(WorkflowPlanNodeSchema).default([]),
  edges: z.array(WorkflowPlanEdgeSchema).default([]),
  entryNodeIds: z.array(z.string()).default([]),
  terminalNodeIds: z.array(z.string()).default([]),
  joinStrategy: z.enum(["all", "any", "first_success", "policy"]).default("all"),
  graphHash: NonEmptyTrimmedStringSchema,
});

// §13 WorkflowConfigSchema supports non-linear steps (not just linear z.array(StepTemplateConfigSchema))
// Support branching/conditional steps via when/condition fields
export const WorkflowConfigSchema = z.object({
  workflowId: NonEmptyTrimmedStringSchema,
  name: NonEmptyTrimmedStringSchema,
  triggerConditions: z.record(z.string(), z.unknown()).default({}),
  // Non-linear steps: steps can reference dependsOn for DAG execution
  // Supports branching via condition/when fields on each step
  steps: z.array(StepTemplateConfigSchema).default([]),
  // Canonical DAG representation retained from domain config so loaders do not silently
  // erase graph structure when parsing workflow definitions.
  planGraph: WorkflowPlanGraphSchema.optional(),
  // Optional step graph for explicit non-linear control flow
  // When provided, steps[] provides node definitions and stepGraph provides edges
  stepGraph: z.object({
    edges: z.array(z.object({
      fromStep: z.string(),
      toStep: z.string(),
      condition: z.record(z.string(), z.unknown()).nullable().default(null),
    })).default([]),
  }).optional(),
});

export const ToolBundleEntrySchema = z.object({
  toolName: NonEmptyTrimmedStringSchema.refine(
    (value) => !value.includes("/") && !value.includes("\\") && !value.includes(".."),
    "toolName must not contain path separators or traversal markers",
  ),
  enabled: z.boolean().default(true),
  configOverrides: z.record(z.string(), z.unknown()).default({}),
});

export const ToolBundleConfigSchema = z.object({
  bundleId: NonEmptyTrimmedStringSchema,
  tools: z.array(ToolBundleEntrySchema).default([]),
});

export const OutputContractConfigSchema = z.object({
  contractId: NonEmptyTrimmedStringSchema,
  name: NonEmptyTrimmedStringSchema,
  schema: z.record(z.string(), z.unknown()).default({}),
  validationLevel: z.enum(["strict", "lenient", "none"]).default("strict"),
});

export const DomainCapabilityProfileSchema = z.object({
  supportedTaskTypes: z.array(z.string()).default([]),
  requiredTools: z.array(z.string()).default([]),
  optionalTools: z.array(z.string()).default([]),
  modelPreferences: z.record(z.string(), z.string()).default({}),
  budgetLimits: z.object({
    maxTokensPerTask: z.number().int().nonnegative(),
    maxCostPerTask: z.number().nonnegative(),
  }).default({ maxTokensPerTask: 4000, maxCostPerTask: 5 }),
  securityLevel: z.enum(["standard", "elevated", "restricted"]).default("standard"),
});

export const PluginBindingSchema = z.preprocess((value) => {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const record = { ...(value as Record<string, unknown>) };
  if (record.bindingRole == null && typeof record.pluginType === "string") {
    const originalPluginType = record.pluginType;
    if (DOMAIN_PLUGIN_ROLE_ALIASES[originalPluginType as keyof typeof DOMAIN_PLUGIN_ROLE_ALIASES] != null) {
      record.bindingRole = originalPluginType;
    }
  }
  return record;
}, z.object({
  bindingId: NonEmptyTrimmedStringSchema,
  domainId: NonEmptyTrimmedStringSchema,
  pluginType: z.preprocess(
    (value) => typeof value === "string"
      ? DOMAIN_PLUGIN_TYPE_ALIASES[value as keyof typeof DOMAIN_PLUGIN_TYPE_ALIASES] ?? value
      : value,
    z.enum(["tool", "adapter", "retriever", "evaluator"]),
  ),
  bindingRole: z.preprocess(
    (value) => {
      if (value == null) {
        return undefined;
      }
      if (typeof value !== "string") {
        return null;
      }
      const normalized = DOMAIN_PLUGIN_ROLE_ALIASES[value as keyof typeof DOMAIN_PLUGIN_ROLE_ALIASES];
      if (normalized === undefined && !["tool", "adapter", "retriever", "evaluator", "planner", "presenter", "validator"].includes(value)) {
        return null;
      }
      return normalized ?? value;
    },
    z.enum(["tool", "adapter", "retriever", "evaluator", "planner", "presenter", "validator"]).optional(),
  ),
  pluginId: NonEmptyTrimmedStringSchema,
  priority: z.number().int().nonnegative().default(0),
  enabled: z.boolean().default(true),
  config: z.record(z.string(), z.unknown()).default({}),
}));

/**
 * DomainDefinitionSchema - Legacy monolithic schema for backward compatibility.
 * §37.2 v4.3: New code should use DomainDescriptorBundleSchema with 7 independent descriptors.
 * This schema is maintained for existing consumers and gradual migration.
 */
export const DomainDefinitionSchema = z.object({
  domainId: NonEmptyTrimmedStringSchema,
  name: NonEmptyTrimmedStringSchema,
  description: NonEmptyTrimmedStringSchema,
  version: z.number().int().positive().default(1),
  // §37.2 v4.3: Descriptors bundle - contains the 7 independent descriptors
  descriptors: DomainDescriptorBundleSchema.optional(),
  workflows: z.array(WorkflowConfigSchema).default([]),
  toolBundles: z.array(ToolBundleConfigSchema).default([]),
  outputContracts: z.array(OutputContractConfigSchema).default([]),
  promptOverrides: z.record(z.string(), z.string()).default({}),
  capabilities: DomainCapabilityProfileSchema.default({}),
  // Status: draft→canary→active→inactive→deprecated→archived per spec
  status: z.preprocess(
    (value) => typeof value === "string"
      ? DOMAIN_STATUS_ALIASES[value as keyof typeof DOMAIN_STATUS_ALIASES] ?? value
      : value,
    z.enum(["draft", "registered", "canary", "active", "inactive", "updating", "deprecated", "archived", "validated"]),
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
  /** §37.2 v4.3: 7 independent descriptors bundle */
  descriptors?: DomainDescriptorBundle;
};
export type DomainDefinitionExtended = DomainDefinition;
