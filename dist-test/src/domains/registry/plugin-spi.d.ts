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
export declare const PluginSpiTypeSchema: z.ZodEnum<["retriever", "validator", "planner", "presenter", "adapter"]>;
export declare const PluginLifecycleStateSchema: z.ZodEnum<["registered", "loaded", "active", "inactive", "unloaded", "degraded", "disabled"]>;
export declare const PluginRuntimeIsolationSchema: z.ZodEnum<["shared_process", "serialized_in_process", "forked_process", "sandboxed_process", "containerized_process"]>;
export declare const PluginSandboxPolicySchema: z.ZodObject<{
    timeoutMs: z.ZodDefault<z.ZodNumber>;
    allowFilesystemWrite: z.ZodDefault<z.ZodBoolean>;
    allowNetworkEgress: z.ZodDefault<z.ZodBoolean>;
    allowedKnowledgeNamespaces: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    maxConcurrentInvocations: z.ZodDefault<z.ZodNumber>;
    maxQueuedInvocations: z.ZodDefault<z.ZodNumber>;
    runtimeIsolation: z.ZodDefault<z.ZodEnum<["shared_process", "serialized_in_process", "forked_process", "sandboxed_process", "containerized_process"]>>;
    runtimeContainerImage: z.ZodOptional<z.ZodString>;
    cooldownMs: z.ZodDefault<z.ZodNumber>;
    /** External domains allowed for scoped_external_access sandbox tier */
    allowedExternalDomains: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    /** Maximum response size in bytes for external API calls */
    maxResponseSizeBytes: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    /** Rate limit per minute for each external domain */
    rateLimitPerMinute: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    runtimeIsolation: "shared_process" | "serialized_in_process" | "forked_process" | "sandboxed_process" | "containerized_process";
    timeoutMs: number;
    allowFilesystemWrite: boolean;
    allowNetworkEgress: boolean;
    allowedKnowledgeNamespaces: string[];
    maxConcurrentInvocations: number;
    maxQueuedInvocations: number;
    cooldownMs: number;
    allowedExternalDomains: string[];
    maxResponseSizeBytes: number;
    rateLimitPerMinute: number;
    runtimeContainerImage?: string | undefined;
}, {
    runtimeIsolation?: "shared_process" | "serialized_in_process" | "forked_process" | "sandboxed_process" | "containerized_process" | undefined;
    timeoutMs?: number | undefined;
    allowFilesystemWrite?: boolean | undefined;
    allowNetworkEgress?: boolean | undefined;
    allowedKnowledgeNamespaces?: string[] | undefined;
    maxConcurrentInvocations?: number | undefined;
    maxQueuedInvocations?: number | undefined;
    runtimeContainerImage?: string | undefined;
    cooldownMs?: number | undefined;
    allowedExternalDomains?: string[] | undefined;
    maxResponseSizeBytes?: number | undefined;
    rateLimitPerMinute?: number | undefined;
}>;
export declare const PluginManifestSchema: z.ZodObject<{
    pluginId: z.ZodString;
    name: z.ZodString;
    version: z.ZodString;
    owner: z.ZodString;
    domainIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    capabilityIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    spiTypes: z.ZodArray<z.ZodEnum<["retriever", "validator", "planner", "presenter", "adapter"]>, "many">;
    extensionKind: z.ZodDefault<z.ZodEnum<["domain_plugin", "external_adapter"]>>;
    trustLevel: z.ZodDefault<z.ZodEnum<["internal", "trusted", "community", "unverified"]>>;
    publicSdkSurface: z.ZodString;
    settingsSchema: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    sandbox: z.ZodDefault<z.ZodObject<{
        timeoutMs: z.ZodDefault<z.ZodNumber>;
        allowFilesystemWrite: z.ZodDefault<z.ZodBoolean>;
        allowNetworkEgress: z.ZodDefault<z.ZodBoolean>;
        allowedKnowledgeNamespaces: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        maxConcurrentInvocations: z.ZodDefault<z.ZodNumber>;
        maxQueuedInvocations: z.ZodDefault<z.ZodNumber>;
        runtimeIsolation: z.ZodDefault<z.ZodEnum<["shared_process", "serialized_in_process", "forked_process", "sandboxed_process", "containerized_process"]>>;
        runtimeContainerImage: z.ZodOptional<z.ZodString>;
        cooldownMs: z.ZodDefault<z.ZodNumber>;
        /** External domains allowed for scoped_external_access sandbox tier */
        allowedExternalDomains: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        /** Maximum response size in bytes for external API calls */
        maxResponseSizeBytes: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        /** Rate limit per minute for each external domain */
        rateLimitPerMinute: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        runtimeIsolation: "shared_process" | "serialized_in_process" | "forked_process" | "sandboxed_process" | "containerized_process";
        timeoutMs: number;
        allowFilesystemWrite: boolean;
        allowNetworkEgress: boolean;
        allowedKnowledgeNamespaces: string[];
        maxConcurrentInvocations: number;
        maxQueuedInvocations: number;
        cooldownMs: number;
        allowedExternalDomains: string[];
        maxResponseSizeBytes: number;
        rateLimitPerMinute: number;
        runtimeContainerImage?: string | undefined;
    }, {
        runtimeIsolation?: "shared_process" | "serialized_in_process" | "forked_process" | "sandboxed_process" | "containerized_process" | undefined;
        timeoutMs?: number | undefined;
        allowFilesystemWrite?: boolean | undefined;
        allowNetworkEgress?: boolean | undefined;
        allowedKnowledgeNamespaces?: string[] | undefined;
        maxConcurrentInvocations?: number | undefined;
        maxQueuedInvocations?: number | undefined;
        runtimeContainerImage?: string | undefined;
        cooldownMs?: number | undefined;
        allowedExternalDomains?: string[] | undefined;
        maxResponseSizeBytes?: number | undefined;
        rateLimitPerMinute?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    sandbox: {
        runtimeIsolation: "shared_process" | "serialized_in_process" | "forked_process" | "sandboxed_process" | "containerized_process";
        timeoutMs: number;
        allowFilesystemWrite: boolean;
        allowNetworkEgress: boolean;
        allowedKnowledgeNamespaces: string[];
        maxConcurrentInvocations: number;
        maxQueuedInvocations: number;
        cooldownMs: number;
        allowedExternalDomains: string[];
        maxResponseSizeBytes: number;
        rateLimitPerMinute: number;
        runtimeContainerImage?: string | undefined;
    };
    name: string;
    version: string;
    pluginId: string;
    trustLevel: "trusted" | "internal" | "community" | "unverified";
    owner: string;
    domainIds: string[];
    capabilityIds: string[];
    spiTypes: ("retriever" | "validator" | "planner" | "presenter" | "adapter")[];
    extensionKind: "domain_plugin" | "external_adapter";
    publicSdkSurface: string;
    settingsSchema: Record<string, unknown>;
}, {
    name: string;
    version: string;
    pluginId: string;
    owner: string;
    spiTypes: ("retriever" | "validator" | "planner" | "presenter" | "adapter")[];
    publicSdkSurface: string;
    sandbox?: {
        runtimeIsolation?: "shared_process" | "serialized_in_process" | "forked_process" | "sandboxed_process" | "containerized_process" | undefined;
        timeoutMs?: number | undefined;
        allowFilesystemWrite?: boolean | undefined;
        allowNetworkEgress?: boolean | undefined;
        allowedKnowledgeNamespaces?: string[] | undefined;
        maxConcurrentInvocations?: number | undefined;
        maxQueuedInvocations?: number | undefined;
        runtimeContainerImage?: string | undefined;
        cooldownMs?: number | undefined;
        allowedExternalDomains?: string[] | undefined;
        maxResponseSizeBytes?: number | undefined;
        rateLimitPerMinute?: number | undefined;
    } | undefined;
    trustLevel?: "trusted" | "internal" | "community" | "unverified" | undefined;
    domainIds?: string[] | undefined;
    capabilityIds?: string[] | undefined;
    extensionKind?: "domain_plugin" | "external_adapter" | undefined;
    settingsSchema?: Record<string, unknown> | undefined;
}>;
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
export type RetrieverKnowledgeResult = KnowledgeRef | {
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
        errors: Array<{
            field: string;
            message: string;
            severity: "error" | "warning";
        }>;
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
    adapterType: "github" | "jira" | "notion" | "figma" | "unity_cloud_build" | "obs_streaming" | "ad_platform" | "crm_analytics";
    authenticate(credentials: Record<string, unknown>): Promise<void>;
    execute(action: string, params: Record<string, unknown>): Promise<Record<string, unknown>>;
}
export type RegisteredPlugin = DomainRetrieverPlugin | DomainValidatorPlugin | DomainPlannerPlugin | DomainPresenterPlugin | ExternalAdapterPlugin;
