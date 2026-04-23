/**
 * @fileoverview Plugin Context - Runtime context injection
 *
 * Implements §22.4 Plugin lifecycle: PluginContext for runtime context injection.
 */
export interface PluginContextConfig {
    pluginId: string;
    packId?: string;
    executionId?: string;
    taskId?: string;
    tenantId?: string;
    userId?: string;
    sessionId?: string;
    sandboxTier?: "none" | "process" | "container" | "scoped_external_access";
    resourceLimits?: {
        maxMemoryMb?: number;
        maxCpuMs?: number;
        maxDurationMs?: number;
    };
}
export interface ContextValue {
    key: string;
    value: unknown;
    timestamp: string;
    source: "system" | "plugin" | "pack" | "user";
}
/**
 * PluginContext provides runtime context to plugins during execution.
 * Plugins receive injected context without needing to fetch it themselves.
 */
export declare class PluginContext {
    private readonly values;
    private readonly config;
    constructor(config: PluginContextConfig);
    /**
     * Get the plugin ID.
     */
    get pluginId(): string;
    /**
     * Get the current execution ID.
     */
    get executionId(): string;
    /**
     * Get the current task ID.
     */
    get taskId(): string;
    /**
     * Get the tenant ID.
     */
    get tenantId(): string;
    /**
     * Get the user ID.
     */
    get userId(): string;
    /**
     * Get the sandbox tier.
     */
    get sandboxTier(): string;
    /**
     * Get a context value by key.
     */
    get(key: string): unknown;
    /**
     * Set a context value.
     */
    set(key: string, value: unknown, source?: ContextValue["source"]): void;
    /**
     * Set multiple context values.
     */
    setValues(entries: Record<string, unknown>, source?: ContextValue["source"]): void;
    /**
     * Get all context keys.
     */
    keys(): string[];
    /**
     * Check if a key exists.
     */
    has(key: string): boolean;
    /**
     * Get resource limits.
     */
    getResourceLimits(): Required<NonNullable<PluginContextConfig["resourceLimits"]>>;
    /**
     * Create a child context for sub-execution.
     */
    fork(overrides: Partial<PluginContextConfig>): PluginContext;
    /**
     * Get all values as a plain object.
     */
    toRecord(): Record<string, unknown>;
    private setValue;
}
