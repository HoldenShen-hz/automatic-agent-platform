import { z } from "zod";

import type { ArtifactRef, KnowledgeRef } from "../../platform/orchestration/oapeflir/ref-types.js";
import type { UnifiedAssessment } from "../../platform/orchestration/oapeflir/types/unified-assessment.js";
import type { StepTemplateConfig } from "./domain-model.js";

export interface MachineOutput {
  stepId: string;
  outputRef: string | null;
  payload: Record<string, unknown>;
}

export interface HumanOutput {
  summary: string;
  sections: string[];
  citations: string[];
}

export const PluginSpiTypeSchema = z.enum(["retriever", "validator", "planner", "presenter", "adapter"]);
export const PluginLifecycleStateSchema = z.enum(["registered", "loaded", "active", "inactive", "unloaded", "degraded", "disabled"]);
export const PluginRuntimeIsolationSchema = z.enum([
  "shared_process",
  "serialized_in_process",
  "forked_process",
  "sandboxed_process",
  "containerized_process",
]);
export const PluginSandboxPolicySchema = z.object({
  timeoutMs: z.number().int().positive().default(5000),
  allowFilesystemWrite: z.boolean().default(false),
  allowNetworkEgress: z.boolean().default(false),
  allowedKnowledgeNamespaces: z.array(z.string().min(1)).default([]),
  maxConcurrentInvocations: z.number().int().positive().default(1),
  maxQueuedInvocations: z.number().int().nonnegative().default(8),
  runtimeIsolation: PluginRuntimeIsolationSchema.default("serialized_in_process"),
  runtimeContainerImage: z.string().min(1).optional(),
  cooldownMs: z.number().int().nonnegative().default(0),
});

export const PluginManifestSchema = z.object({
  pluginId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  owner: z.string().min(1),
  domainIds: z.array(z.string().min(1)).default([]),
  capabilityIds: z.array(z.string().min(1)).default([]),
  spiTypes: z.array(PluginSpiTypeSchema).min(1),
  extensionKind: z.enum(["domain_plugin", "external_adapter"]).default("domain_plugin"),
  trustLevel: z.enum(["internal", "trusted", "community", "unverified"]).default("trusted"),
  publicSdkSurface: z.string().min(1),
  settingsSchema: z.record(z.string(), z.unknown()).default({}),
  sandbox: PluginSandboxPolicySchema.default({
    timeoutMs: 5000,
    allowFilesystemWrite: false,
    allowNetworkEgress: false,
    allowedKnowledgeNamespaces: [],
    maxConcurrentInvocations: 1,
    maxQueuedInvocations: 8,
    runtimeIsolation: "serialized_in_process",
    cooldownMs: 0,
  }),
});

export type PluginSpiType = z.infer<typeof PluginSpiTypeSchema>;
export type PluginLifecycleState = z.infer<typeof PluginLifecycleStateSchema>;
export type PluginRuntimeIsolation = z.infer<typeof PluginRuntimeIsolationSchema>;
export type PluginSandboxPolicy = z.infer<typeof PluginSandboxPolicySchema>;
export type PluginManifest = z.infer<typeof PluginManifestSchema>;

export interface PluginLifecycleContext {
  pluginId: string;
  domainId: string | null;
  capabilityIds: string[];
  bindingId: string | null;
  config: Record<string, unknown>;
}

export interface PluginLifecycleHooks {
  manifest?: PluginManifest;
  onLoad?(context: PluginLifecycleContext): Promise<void> | void;
  onActivate?(context: PluginLifecycleContext): Promise<void> | void;
  onDeactivate?(context: PluginLifecycleContext): Promise<void> | void;
  onUnload?(context: PluginLifecycleContext): Promise<void> | void;
  initialize?(): Promise<void> | void;
  healthCheck?(): Promise<boolean> | boolean;
  shutdown?(): Promise<void> | void;
}

/**
 * Result type returned by DomainRetrieverPlugin.retrieve().
 *
 * Union of:
 * - KnowledgeRef: complete structured result with all metadata
 * - string: simple knowledge:XXX reference string
 * - Partial<KnowledgeRef> via anonymous object: plugin-returned result with available fields
 *
 * Note: string is not a direct union member to avoid ambiguity with knowledgeRef field typing.
 * Callers should narrow the type as needed.
 */
export type RetrieverKnowledgeResult =
  | KnowledgeRef
  | {
      knowledgeRef: string;
      snippet?: string;
      score?: number;
      namespace?: string;
      chunkId?: string;
      documentId?: string;
      matchType?: "semantic" | "keyword" | "structural";
    };

export interface DomainRetrieverPlugin extends PluginLifecycleHooks {
  pluginId: string;
  domainId: string;
  spiType: "retriever";
  capabilityIds?: readonly string[];
  retrieve(query: {
    taskId: string;
    intent: string;
    context: Record<string, unknown>;
    tokenBudget: number;
  }): Promise<readonly RetrieverKnowledgeResult[]>;
}

export interface DomainValidatorPlugin extends PluginLifecycleHooks {
  pluginId: string;
  domainId: string;
  spiType: "validator";
  capabilityIds?: readonly string[];
  validate(output: {
    stepId: string;
    machineOutput: MachineOutput;
    contract: Record<string, unknown>;
  }): Promise<{
    valid: boolean;
    errors: Array<{ field: string; message: string; severity: "error" | "warning" }>;
    suggestions: string[];
  }>;
}

export interface DomainPlannerPlugin extends PluginLifecycleHooks {
  pluginId: string;
  domainId: string;
  spiType: "planner";
  capabilityIds?: readonly string[];
  suggestWorkflow(task: {
    taskId: string;
    intent: string;
    assessment: UnifiedAssessment;
  }): Promise<{
    workflowId: string;
    overrides: Partial<StepTemplateConfig>[];
    rationale: string;
  } | null>;
}

export interface DomainPresenterPlugin extends PluginLifecycleHooks {
  pluginId: string;
  domainId: string;
  spiType: "presenter";
  capabilityIds?: readonly string[];
  formatOutput(input: {
    machineOutputs: MachineOutput[];
    artifacts: ArtifactRef[];
    audience: "end_user" | "developer" | "reviewer" | "operator";
  }): Promise<HumanOutput>;
}

export interface ExternalAdapterPlugin extends PluginLifecycleHooks {
  pluginId: string;
  spiType: "adapter";
  capabilityIds?: readonly string[];
  adapterType:
    | "github"
    | "jira"
    | "notion"
    | "figma"
    | "unity_cloud_build"
    | "obs_streaming"
    | "ad_platform"
    | "crm_analytics";
  authenticate(credentials: Record<string, unknown>): Promise<void>;
  execute(action: string, params: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export type RegisteredPlugin =
  | DomainRetrieverPlugin
  | DomainValidatorPlugin
  | DomainPlannerPlugin
  | DomainPresenterPlugin
  | ExternalAdapterPlugin;
