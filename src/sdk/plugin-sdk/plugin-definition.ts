/**
 * @fileoverview Plugin SDK - definePlugin DSL
 *
 * Implements §22.4 Plugin lifecycle: definePlugin() for plugin definition.
 */

import { ValidationError } from "../../platform/contracts/errors.js";
import { normalizeSandboxMode, type SandboxMode, type SandboxModeLike } from "../../platform/control-plane/iam/sandbox-policy.js";

export type PluginType = "tool" | "adapter" | "retriever" | "evaluator" | "validator" | "planner" | "presenter";
export type PluginRole = "tool" | "adapter" | "retriever" | "evaluator" | "planner" | "presenter" | "validator";

export interface PluginCapability {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

export interface PluginResourceLimits {
  maxMemoryMb: number;
  maxCpuMs: number;
  maxDurationMs: number;
}

export interface PluginSecurityConfig {
  sandboxTier: SandboxMode;
  egressDomains: string[];
}

export interface PluginSecurityInput {
  sandboxTier?: SandboxModeLike;
  egressDomains?: string[];
}

export interface PluginDefinition {
  pluginId: string;
  name: string;
  version: string;
  type: PluginType;
  role?: PluginRole;
  description?: string;
  capabilities: PluginCapability[];
  resourceLimits: PluginResourceLimits;
  dependencies: string[];
  security: PluginSecurityConfig;
  spiTypes: Array<PluginType | "planner" | "presenter" | "validator">;
  domainIds: string[];
  sbomRef: string | null;
  signing: {
    keyId: string;
    signature: string;
    algorithm: string;
  } | null;
}

export interface DefinePluginOptions {
  pluginId?: string;
  name?: string;
  version?: string;
  type?: PluginType;
  role?: PluginRole;
  description?: string;
  capabilities?: PluginCapability[];
  resourceLimits?: PluginResourceLimits;
  dependencies?: string[];
  security?: PluginSecurityInput;
  spiTypes?: PluginType[];
  domainIds?: string[];
  sbomRef?: string | null;
  signing?: {
    keyId: string;
    signature: string;
    algorithm?: string;
  } | null;
}

const DEFAULT_RESOURCE_LIMITS: PluginResourceLimits = {
  maxMemoryMb: 512,
  maxCpuMs: 5000,
  maxDurationMs: 30000,
};

const DEFAULT_SECURITY: PluginSecurityConfig = {
  sandboxTier: "read_only",
  egressDomains: [],
};

function normalizeResourceLimits(resourceLimits: PluginResourceLimits | undefined): PluginResourceLimits {
  const normalized = resourceLimits ?? DEFAULT_RESOURCE_LIMITS;
  for (const [key, value] of Object.entries(normalized)) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new ValidationError(
        "plugin_sdk.invalid_resource_limits",
        `Plugin resource limit "${key}" must be a positive finite number.`,
      );
    }
  }
  return normalized;
}

function normalizeSecurityConfig(security: PluginSecurityInput | PluginSecurityConfig | undefined): PluginSecurityConfig {
  const requestedSandboxTier = security?.sandboxTier;
  if (typeof requestedSandboxTier === "string" && requestedSandboxTier.trim().toLowerCase() === "none") {
    throw new ValidationError(
      "plugin_sdk.insecure_sandbox_tier",
      "Plugin security sandboxTier 'none' is forbidden; use an explicit constrained sandbox tier instead.",
    );
  }

  return {
    sandboxTier: normalizeSandboxMode(requestedSandboxTier ?? DEFAULT_SECURITY.sandboxTier),
    egressDomains: security?.egressDomains ?? DEFAULT_SECURITY.egressDomains,
  };
}

/**
 * Define a plugin using the Plugin SDK DSL.
 *
 * @example
 * ```typescript
 * const myTool = definePlugin({
 *   pluginId: "my-pack.query-tool",
 *   name: "Query Tool",
 *   version: "1.0.0",
 *   type: "tool",
 *   capabilities: [{
 *     name: "execute",
 *     description: "Execute a query",
 *     inputSchema: { type: "object", properties: { query: { type: "string" } } },
 *     outputSchema: { type: "object", properties: { result: { type: "string" } } },
 *   }],
 * });
 * ```
 */
export function definePlugin(options: DefinePluginOptions): PluginDefinition {
  if (!options.pluginId?.trim()) {
    throw new ValidationError("plugin_sdk.missing_plugin_id", "Plugin ID is required (plugin_sdk.missing_plugin_id).");
  }
  if (!options.name?.trim()) {
    throw new ValidationError("plugin_sdk.missing_name", "Plugin name is required.");
  }
  if (!options.version?.trim()) {
    throw new ValidationError("plugin_sdk.missing_version", "Plugin version is required.");
  }
  if (!options.type) {
    throw new ValidationError("plugin_sdk.missing_type", "Plugin type is required.");
  }
  if (!options.capabilities || options.capabilities.length === 0) {
    throw new ValidationError("plugin_sdk.empty_capabilities", "Plugin must declare at least one capability (plugin_sdk.empty_capabilities).");
  }

  for (const cap of options.capabilities) {
    if (!cap.name?.trim()) {
      throw new ValidationError("plugin_sdk.invalid_capability_name", "Capability name is required.");
    }
    if (!cap.inputSchema) {
      throw new ValidationError("plugin_sdk.missing_input_schema", `Capability ${cap.name} requires inputSchema.`);
    }
    if (!cap.outputSchema) {
      throw new ValidationError("plugin_sdk.missing_output_schema", `Capability ${cap.name} requires outputSchema.`);
    }
  }

  const result: PluginDefinition = {
    pluginId: options.pluginId.trim(),
    name: options.name.trim(),
    version: options.version.trim(),
    type: options.type,
    ...(options.role !== undefined ? { role: options.role } : {}),
    capabilities: options.capabilities,
    resourceLimits: normalizeResourceLimits(options.resourceLimits),
    dependencies: options.dependencies ?? [],
    security: normalizeSecurityConfig(options.security),
    spiTypes: [...new Set((options.spiTypes ?? [options.type]).filter((type): type is PluginType => type !== undefined))],
    domainIds: [...new Set((options.domainIds ?? []).map((domainId) => domainId.trim()).filter((domainId) => domainId.length > 0))],
    sbomRef: options.sbomRef?.trim() ? options.sbomRef.trim() : null,
    signing: options.signing == null ? null : {
      keyId: options.signing.keyId.trim(),
      signature: options.signing.signature.trim(),
      algorithm: options.signing.algorithm?.trim() || "ed25519",
    },
  };
  if (options.description?.trim()) {
    result.description = options.description.trim();
  }
  return result;
}

/**
 * Define a tool plugin (convenience function).
 */
export function defineTool(options: Omit<DefinePluginOptions, "type"> & { pluginId: string; name: string; version: string }): PluginDefinition {
  return definePlugin({ ...options, type: "tool" });
}

/**
 * Define an adapter plugin (convenience function).
 */
export function defineAdapter(options: Omit<DefinePluginOptions, "type"> & { pluginId: string; name: string; version: string }): PluginDefinition {
  return definePlugin({ ...options, type: "adapter" });
}

/**
 * Define a retriever plugin (convenience function).
 */
export function defineRetriever(options: Omit<DefinePluginOptions, "type"> & { pluginId: string; name: string; version: string }): PluginDefinition {
  return definePlugin({ ...options, type: "retriever" });
}

/**
 * Define an evaluator plugin (convenience function).
 */
export function defineEvaluator(options: Omit<DefinePluginOptions, "type"> & { pluginId: string; name: string; version: string }): PluginDefinition {
  return definePlugin({ ...options, type: "evaluator" });
}

/**
 * Validate a plugin manifest.
 */
export function validatePluginDefinition(definition: PluginDefinition): PluginDefinition {
  return definePlugin({
    pluginId: definition.pluginId,
    name: definition.name,
    version: definition.version,
    type: definition.type,
    ...(definition.role !== undefined ? { role: definition.role } : {}),
    description: definition.description ?? "Plugin description",
    capabilities: definition.capabilities,
    resourceLimits: definition.resourceLimits,
    dependencies: definition.dependencies,
    security: definition.security,
    spiTypes: definition.spiTypes.filter((type): type is PluginType => {
      const validTypes: PluginType[] = ["tool", "adapter", "retriever", "evaluator"];
      return typeof type === "string" && validTypes.includes(type as PluginType);
    }),
    domainIds: definition.domainIds,
    sbomRef: definition.sbomRef,
    signing: definition.signing,
  });
}
