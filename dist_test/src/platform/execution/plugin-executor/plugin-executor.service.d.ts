/**
 * Plugin Executor Service
 *
 * Complete plugin execution service with lifecycle management, sandbox isolation,
 * resource limits, and evidence collection.
 *
 * Architecture: §4 P4 Execution Plane
 * @see docs_zh/architecture/00-platform-architecture.md §4
 * @see src/domains/registry/plugin-spi.ts (PluginManifest, PluginLifecycleHooks)
 * @see src/platform/control-plane/iam/sandbox-policy.ts (SandboxPolicy)
 */
import { type PluginManifest, type PluginLifecycleHooks } from "../../../domains/registry/plugin-spi.js";
import { type SandboxPolicy } from "../../control-plane/iam/sandbox-policy.js";
import { ArtifactStore } from "../../state-evidence/artifacts/artifact-store.js";
export interface ExecutionContext {
    executionId: string;
    taskId: string;
    tenantId: string | null;
    correlationId: string;
    sandboxTier: SandboxTier;
}
export type SandboxTier = "none" | "process" | "container" | "scoped_external_access";
export interface ExecutionResult {
    executionId: string;
    pluginId: string;
    status: "ok" | "error" | "timeout" | "rejected";
    output: unknown;
    artifactRef?: string;
    durationMs: number;
    timestamp: string;
    error?: string;
}
export interface PluginExecutorOptions {
    pluginDir?: string;
    sandboxPolicy?: SandboxPolicy;
    artifactStore?: ArtifactStore;
}
type LifecycleState = "registered" | "loaded" | "active" | "inactive" | "degraded" | "disabled";
export declare class PluginExecutorService {
    private readonly plugins;
    private readonly sandboxPolicy;
    private readonly artifactStore;
    private readonly pluginDir;
    constructor(options?: PluginExecutorOptions);
    /**
     * Registers a plugin with the executor.
     *
     * @param manifest - Plugin manifest from registry
     * @param hooks - Plugin lifecycle hooks instance
     */
    register(manifest: PluginManifest, hooks: PluginLifecycleHooks): void;
    /**
     * Unregisters a plugin, calling onUnload if present.
     *
     * @param pluginId - Plugin to unregister
     */
    unregister(pluginId: string): Promise<void>;
    /**
     * Returns all registered plugins.
     */
    listPlugins(): PluginManifest[];
    /**
     * Loads a plugin into memory, calling onLoad hook.
     *
     * @param pluginId - Plugin to load
     */
    load(pluginId: string): Promise<void>;
    /**
     * Activates a loaded plugin, calling onActivate hook.
     *
     * @param pluginId - Plugin to activate
     */
    activate(pluginId: string): Promise<void>;
    /**
     * Deactivates an active plugin, calling onDeactivate hook.
     *
     * @param pluginId - Plugin to deactivate
     */
    deactivate(pluginId: string): Promise<void>;
    /**
     * Executes a plugin action with sandbox isolation and resource limits.
     *
     * @param pluginId - Plugin to execute
     * @param action - SPI type action to invoke (retriever/validator/planner/presenter/adapter)
     * @param context - Execution context
     * @param params - Action parameters
     * @returns Execution result with artifact reference
     */
    execute(pluginId: string, action: string, context: ExecutionContext, params: Record<string, unknown>): Promise<ExecutionResult>;
    /**
     * Health check for a plugin.
     *
     * @param pluginId - Plugin to check
     * @returns true if healthy
     */
    healthCheck(pluginId: string): Promise<boolean>;
    /**
     * Gets the current state of a plugin.
     *
     * @param pluginId - Plugin to check
     */
    getState(pluginId: string): LifecycleState | null;
    private buildContext;
    private createPluginSandbox;
    private createSandboxContext;
    private invokePluginAction;
    private executeWithTimeout;
    private writeExecutionArtifact;
}
export {};
