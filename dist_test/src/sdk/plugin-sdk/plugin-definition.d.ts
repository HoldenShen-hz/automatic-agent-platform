/**
 * @fileoverview Plugin SDK - definePlugin DSL
 *
 * Implements §22.4 Plugin lifecycle: definePlugin() for plugin definition.
 */
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
export declare function definePlugin(options: DefinePluginOptions): PluginDefinition;
/**
 * Define a tool plugin (convenience function).
 */
export declare function defineTool(options: Omit<DefinePluginOptions, "type"> & {
    pluginId: string;
    name: string;
    version: string;
}): PluginDefinition;
/**
 * Define an adapter plugin (convenience function).
 */
export declare function defineAdapter(options: Omit<DefinePluginOptions, "type"> & {
    pluginId: string;
    name: string;
    version: string;
}): PluginDefinition;
/**
 * Define a retriever plugin (convenience function).
 */
export declare function defineRetriever(options: Omit<DefinePluginOptions, "type"> & {
    pluginId: string;
    name: string;
    version: string;
}): PluginDefinition;
/**
 * Define an evaluator plugin (convenience function).
 */
export declare function defineEvaluator(options: Omit<DefinePluginOptions, "type"> & {
    pluginId: string;
    name: string;
    version: string;
}): PluginDefinition;
/**
 * Validate a plugin manifest.
 */
export declare function validatePluginDefinition(definition: PluginDefinition): PluginDefinition;
