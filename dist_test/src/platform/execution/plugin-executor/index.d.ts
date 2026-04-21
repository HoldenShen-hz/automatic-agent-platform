/**
 * Plugin Executor - Entry Point
 *
 * Re-exports PluginExecutionService (legacy) for backward compatibility,
 * and the new PluginExecutorService with full lifecycle management.
 */
export interface PluginExecutionRequest {
    pluginId: string;
    action: string;
    tenantId: string | null;
    payload: Record<string, unknown>;
}
export interface PluginExecutionResult {
    pluginId: string;
    action: string;
    status: "ok" | "rejected";
    output: Record<string, unknown>;
}
export interface PluginRegistration {
    pluginId: string;
    actions: string[];
    execute: (request: PluginExecutionRequest) => PluginExecutionResult | Promise<PluginExecutionResult>;
}
export declare class PluginExecutionService {
    private readonly plugins;
    register(plugin: PluginRegistration): void;
    execute(request: PluginExecutionRequest): Promise<PluginExecutionResult>;
    listPlugins(): PluginRegistration[];
}
export { PluginExecutorService, type ExecutionContext, type ExecutionResult, type PluginExecutorOptions, type SandboxTier, } from "./plugin-executor.service.js";
export { ScopedExternalAccessSandbox, createScopedExternalAccessSandbox, type ScopedExternalAccessConfig, type ExternalAccessRequest, type ExternalAccessResponse, type DomainRateLimit, } from "./scoped-external-access-sandbox.js";
