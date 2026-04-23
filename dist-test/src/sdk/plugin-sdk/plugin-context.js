/**
 * @fileoverview Plugin Context - Runtime context injection
 *
 * Implements §22.4 Plugin lifecycle: PluginContext for runtime context injection.
 */
/**
 * PluginContext provides runtime context to plugins during execution.
 * Plugins receive injected context without needing to fetch it themselves.
 */
export class PluginContext {
    values = new Map();
    config;
    constructor(config) {
        if (!config.pluginId?.trim()) {
            throw new Error("PluginContext requires pluginId");
        }
        this.config = {
            pluginId: config.pluginId,
            packId: config.packId ?? "unknown",
            executionId: config.executionId ?? "unknown",
            taskId: config.taskId ?? "unknown",
            tenantId: config.tenantId ?? "default",
            userId: config.userId ?? "anonymous",
            sessionId: config.sessionId ?? "none",
            sandboxTier: config.sandboxTier ?? "process",
            resourceLimits: config.resourceLimits ?? {},
        };
        // Initialize with system context
        this.setValue("system.plugin_id", config.pluginId, "system");
        this.setValue("system.timestamp", new Date().toISOString(), "system");
    }
    /**
     * Get the plugin ID.
     */
    get pluginId() {
        return this.config.pluginId;
    }
    /**
     * Get the current execution ID.
     */
    get executionId() {
        return this.config.executionId;
    }
    /**
     * Get the current task ID.
     */
    get taskId() {
        return this.config.taskId;
    }
    /**
     * Get the tenant ID.
     */
    get tenantId() {
        return this.config.tenantId;
    }
    /**
     * Get the user ID.
     */
    get userId() {
        return this.config.userId;
    }
    /**
     * Get the sandbox tier.
     */
    get sandboxTier() {
        return this.config.sandboxTier;
    }
    /**
     * Get a context value by key.
     */
    get(key) {
        const entry = this.values.get(key);
        return entry?.value;
    }
    /**
     * Set a context value.
     */
    set(key, value, source = "plugin") {
        this.setValue(key, value, source);
    }
    /**
     * Set multiple context values.
     */
    setValues(entries, source = "plugin") {
        for (const [key, value] of Object.entries(entries)) {
            this.setValue(key, value, source);
        }
    }
    /**
     * Get all context keys.
     */
    keys() {
        return Array.from(this.values.keys());
    }
    /**
     * Check if a key exists.
     */
    has(key) {
        return this.values.has(key);
    }
    /**
     * Get resource limits.
     */
    getResourceLimits() {
        return {
            maxMemoryMb: this.config.resourceLimits.maxMemoryMb ?? 512,
            maxCpuMs: this.config.resourceLimits.maxCpuMs ?? 5000,
            maxDurationMs: this.config.resourceLimits.maxDurationMs ?? 30000,
        };
    }
    /**
     * Create a child context for sub-execution.
     */
    fork(overrides) {
        return new PluginContext({
            pluginId: this.config.pluginId,
            packId: overrides.packId ?? this.config.packId,
            executionId: overrides.executionId ?? this.config.executionId,
            taskId: overrides.taskId ?? this.config.taskId,
            tenantId: overrides.tenantId ?? this.config.tenantId,
            userId: overrides.userId ?? this.config.userId,
            sessionId: overrides.sessionId ?? this.config.sessionId,
            sandboxTier: overrides.sandboxTier ?? this.config.sandboxTier,
            resourceLimits: overrides.resourceLimits ?? this.config.resourceLimits,
        });
    }
    /**
     * Get all values as a plain object.
     */
    toRecord() {
        const record = {};
        for (const [key, entry] of this.values.entries()) {
            record[key] = entry.value;
        }
        return record;
    }
    setValue(key, value, source) {
        this.values.set(key, {
            key,
            value,
            timestamp: new Date().toISOString(),
            source,
        });
    }
}
//# sourceMappingURL=plugin-context.js.map