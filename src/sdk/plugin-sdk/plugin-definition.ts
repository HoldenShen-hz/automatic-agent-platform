/**
 * @fileoverview Plugin SDK - definePlugin DSL
 *
 * Implements §22.4 Plugin lifecycle: definePlugin() for plugin definition.
 */

import { ValidationError } from "../../platform/contracts/errors.js";

export type PluginType = "tool" | "adapter" | "retriever" | "evaluator" | "presenter";

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
  sandboxTier: "none" | "process" | "container" | "scoped_external_access";
  egressDomains: string[];
}

export interface PluginDefinition {
  pluginId: string;
  name: string;
  version: string;
  type: PluginType;
  description?: string;
  capabilities: PluginCapability[];
  resourceLimits: PluginResourceLimits;
  dependencies: string[];
  security: PluginSecurityConfig;
}

export interface DefinePluginOptions {
  pluginId?: string;
  name?: string;
  version?: string;
  type?: PluginType;
  description?: string;
  capabilities?: PluginCapability[];
  resourceLimits?: PluginResourceLimits;
  dependencies?: string[];
  security?: PluginSecurityConfig;
}

const DEFAULT_RESOURCE_LIMITS: PluginResourceLimits = {
  maxMemoryMb: 512,
  maxCpuMs: 5000,
  maxDurationMs: 30000,
};

const DEFAULT_SECURITY: PluginSecurityConfig = {
  sandboxTier: "process",
  egressDomains: [],
};

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
    throw new ValidationError("plugin_sdk.missing_plugin_id", "Plugin ID is required.");
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
    throw new ValidationError("plugin_sdk.empty_capabilities", "Plugin must declare at least one capability.");
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
    capabilities: options.capabilities,
    resourceLimits: options.resourceLimits ?? DEFAULT_RESOURCE_LIMITS,
    dependencies: options.dependencies ?? [],
    security: options.security ?? DEFAULT_SECURITY,
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
    description: definition.description,
    capabilities: definition.capabilities,
    resourceLimits: definition.resourceLimits,
    dependencies: definition.dependencies,
    security: definition.security,
  });
}