import { z } from "zod";
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
    /** External domains allowed for scoped_external_access sandbox tier */
    allowedExternalDomains: z.array(z.string().min(1)).optional().default([]),
    /** Maximum response size in bytes for external API calls */
    maxResponseSizeBytes: z.number().int().positive().optional().default(5 * 1024 * 1024),
    /** Rate limit per minute for each external domain */
    rateLimitPerMinute: z.number().int().positive().optional().default(60),
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
//# sourceMappingURL=plugin-spi.js.map