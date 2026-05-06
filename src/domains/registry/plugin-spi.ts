import { z } from "zod";

import type { ArtifactRef, KnowledgeRef } from "../../platform/orchestration/oapeflir/ref-types.js";
import type { UnifiedAssessment } from "../../platform/orchestration/oapeflir/types/unified-assessment.js";
import type { StepTemplateConfig } from "./domain-model.js";

export interface MachineOutput {
  nodeId?: string | null;
  nodeRunId?: string | null;
  attemptId?: string | null;
  /** @deprecated legacy projection identifier; use nodeId/nodeRunId */
  stepId?: string | null;
  outputRef: string | null;
  payload: Record<string, unknown>;
}

export interface HumanOutput {
  summary: string;
  sections: string[];
  citations: string[];
}

export const PluginSpiTypeSchema = z.enum(["tool", "retriever", "validator", "planner", "presenter", "adapter", "evaluator"]);
/**
 * Plugin lifecycle states per contract §4.
 * States: suspended/loading/initialized map to code's degraded/disabled in operational sense.
 * Code uses more granular states for internal tracking; contract defines canonical set.
 */
export const PluginLifecycleStateSchema = z.enum([
  "registered",   // Plugin registered but not loaded
  "validated",     // Plugin validated
  "loading",       // Plugin is being loaded (code: loaded)
  "active",        // Plugin fully loaded and active (code: active)
  "inactive",      // Plugin loaded but inactive
  "unloaded",      // Plugin unloaded
  "suspended",     // Plugin suspended (code: degraded)
  "disabled",      // Plugin disabled (code: disabled)
]);
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
  /** External domains allowed for scoped_external_access sandbox tier */
  allowedExternalDomains: z.array(z.string().min(1)).optional().default([]),
  /** Maximum response size in bytes for external API calls */
  maxResponseSizeBytes: z.number().int().positive().optional().default(5 * 1024 * 1024),
  /** Rate limit per minute for each external domain */
  rateLimitPerMinute: z.number().int().positive().optional().default(60),
});

/**
 * R8-25: PluginSignature holds cryptographic signature data for plugin integrity verification.
 * When loading a plugin, the signature must be verified using the corresponding public key.
 */
export interface PluginSignature {
  /** Unique identifier for the key used to create this signature */
  keyId: string;
  /** Base64-encoded cryptographic signature of the plugin manifest */
  signature: string;
  /** Algorithm used for signature creation/verification (e.g., "RS256", "RS384", "RS512") */
  algorithm: "RS256" | "RS384" | "RS512" | "ES256" | "ES384" | "ES512" | "HS256" | "HS384" | "HS512";
}

export const PluginSignatureSchema = z.object({
  keyId: z.string().min(1),
  signature: z.string().min(1),
  algorithm: z.enum(["RS256", "RS384", "RS512", "ES256", "ES384", "ES512", "HS256", "HS384", "HS512"]),
});

export type PluginSignatureData = z.infer<typeof PluginSignatureSchema>;

export const PluginManifestSchema = z.object({
  pluginId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  owner: z.string().min(1),
  domainIds: z.array(z.string().min(1)).default([]),
  capabilityIds: z.array(z.string().min(1)).default([]),
  spiTypes: z.array(PluginSpiTypeSchema).min(1),
  extensionKind: z.enum(["domain_plugin", "external_adapter"]).default("domain_plugin"),
  trustLevel: z.enum(["internal", "trusted", "community", "unverified", "verified", "untrusted"]).default("trusted"),
  publicSdkSurface: z.array(z.string().min(1)).default([]),
  /** R18-7: Plugin dependencies - list of plugin IDs this plugin depends on */
  dependencies: z.array(z.string().min(1)).default([]),
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
  /** R8-25: Optional cryptographic signature for plugin integrity verification */
  signature: PluginSignatureSchema.optional(),
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
  /** Suspend plugin operations - called when transitioning to suspended state per contract §4 */
  suspend?(reason: string): Promise<void> | void;
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
    nodeId?: string;
    /** @deprecated legacy projection identifier; use nodeId */
    stepId?: string;
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
    planGraphBundleId?: string;
    /** @deprecated legacy projection identifier; use planGraphBundleId */
    workflowId?: string;
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

export interface DomainToolPlugin extends PluginLifecycleHooks {
  pluginId: string;
  domainId: string;
  spiType: "tool";
  capabilityIds?: readonly string[];
  execute(params: {
    taskId: string;
    toolName: string;
    arguments: Record<string, unknown>;
    context: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    output: unknown;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface DomainEvaluatorPlugin extends PluginLifecycleHooks {
  pluginId: string;
  domainId: string;
  spiType: "evaluator";
  capabilityIds?: readonly string[];
  evaluate(input: {
    taskId: string;
    nodeId?: string;
    /** @deprecated legacy projection identifier; use nodeId */
    stepId?: string;
    machineOutput: MachineOutput;
    criteria: Record<string, unknown>;
    context: Record<string, unknown>;
  }): Promise<{
    passed: boolean;
    score: number;
    feedback: string;
    details: Array<{ criterion: string; passed: boolean; score: number; reason: string }>;
  }>;
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
  | DomainToolPlugin
  | DomainEvaluatorPlugin
  | ExternalAdapterPlugin;
