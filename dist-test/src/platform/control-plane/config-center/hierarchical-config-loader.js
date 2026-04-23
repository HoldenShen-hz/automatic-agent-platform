/**
 * Hierarchical Configuration Loader
 *
 * Loads and merges configuration from multiple hierarchy levels:
 * platform → tenant → pack → task-type
 *
 * Each subsequent layer can override values from previous layers.
 * This enables tenant-specific, pack-specific, and task-type-specific config overrides.
 */
/**
 * Service for loading and merging hierarchical configuration.
 *
 * Applies the principle that more specific layers override less specific:
 * platform < tenant < pack < task_type
 */
export class HierarchicalConfigLoader {
    eventBus;
    emitChangeEvents;
    constructor(options = {}) {
        this.eventBus = options.eventBus ?? null;
        this.emitChangeEvents = options.emitChangeEvents ?? true;
    }
    /**
     * Loads and merges configurations from all hierarchy levels.
     *
     * @param platformConfig - Base platform configuration
     * @param tenantConfigs - Map of tenantId to tenant config
     * @param packConfigs - Map of packId to pack config
     * @param taskTypeConfigs - Map of taskTypeId to task-type config
     * @param activeTenantId - Currently active tenant ID (for tenant override)
     * @param activePackId - Currently active pack ID (for pack override)
     * @param activeTaskTypeId - Currently active task type ID (for task-type override)
     */
    loadConfig(platformConfig, tenantConfigs = {}, packConfigs = {}, taskTypeConfigs = {}, activeTenantId = null, activePackId = null, activeTaskTypeId = null) {
        const sources = [];
        const layerMap = {};
        const now = new Date().toISOString();
        // Platform layer (base)
        const platformSource = {
            layer: "platform",
            sourceId: null,
            config: platformConfig,
            version: this.computeVersion(platformConfig),
            updatedAt: now,
        };
        sources.push(platformSource);
        // Tenant layer
        if (activeTenantId && tenantConfigs[activeTenantId]) {
            const tenantSource = {
                layer: "tenant",
                sourceId: activeTenantId,
                config: tenantConfigs[activeTenantId],
                version: this.computeVersion(tenantConfigs[activeTenantId]),
                updatedAt: now,
            };
            sources.push(tenantSource);
        }
        // Pack layer
        if (activePackId && packConfigs[activePackId]) {
            const packSource = {
                layer: "pack",
                sourceId: activePackId,
                config: packConfigs[activePackId],
                version: this.computeVersion(packConfigs[activePackId]),
                updatedAt: now,
            };
            sources.push(packSource);
        }
        // Task-type layer (most specific, highest priority)
        if (activeTaskTypeId && taskTypeConfigs[activeTaskTypeId]) {
            const taskTypeSource = {
                layer: "task_type",
                sourceId: activeTaskTypeId,
                config: taskTypeConfigs[activeTaskTypeId],
                version: this.computeVersion(taskTypeConfigs[activeTaskTypeId]),
                updatedAt: now,
            };
            sources.push(taskTypeSource);
        }
        // Merge configs: later sources override earlier ones
        const merged = this.mergeConfigs(sources, layerMap);
        return {
            merged,
            sources,
            layerMap,
            version: this.computeVersion(merged),
        };
    }
    /**
     * Emits a config.changed event for a specific layer.
     *
     * @param layer - The hierarchy layer that changed
     * @param sourceId - The source ID that changed (e.g., tenantId)
     * @param oldConfig - Previous configuration
     * @param newConfig - New configuration
     */
    emitConfigChange(layer, sourceId, oldConfig, newConfig) {
        if (!this.emitChangeEvents || !this.eventBus) {
            return;
        }
        this.eventBus.publish({
            eventType: "config.changed",
            payload: {
                layer,
                sourceId,
                changes: this.computeDiff(oldConfig, newConfig),
                previousVersion: this.computeVersion(oldConfig),
                newVersion: this.computeVersion(newConfig),
                changedAt: new Date().toISOString(),
            },
        });
    }
    /**
     * Merges configs from multiple sources with later sources overriding earlier.
     */
    mergeConfigs(sources, layerMap) {
        const merged = {};
        for (const source of sources) {
            for (const [key, value] of Object.entries(source.config)) {
                if (this.isObject(value) && this.isObject(merged[key])) {
                    // Deep merge for nested objects
                    merged[key] = this.deepMerge(merged[key], value);
                }
                else {
                    merged[key] = value;
                }
                // Track which layer provided this key (most recent wins)
                layerMap[key] = source.layer;
            }
        }
        return merged;
    }
    /**
     * Deep merges two objects, with override values taking precedence.
     */
    deepMerge(base, override) {
        const result = { ...base };
        for (const [key, value] of Object.entries(override)) {
            if (this.isObject(value) && this.isObject(result[key])) {
                result[key] = this.deepMerge(result[key], value);
            }
            else {
                result[key] = value;
            }
        }
        return result;
    }
    /**
     * Checks if a value is a plain object.
     */
    isObject(value) {
        return value != null && typeof value === "object" && !Array.isArray(value);
    }
    /**
     * Computes a simple version hash from config content.
     */
    computeVersion(config) {
        const str = JSON.stringify(config, Object.keys(config).sort());
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
    /**
     * Computes differences between old and new config.
     */
    computeDiff(oldConfig, newConfig) {
        const diffs = [];
        const allKeys = new Set([...Object.keys(oldConfig), ...Object.keys(newConfig)]);
        for (const key of allKeys) {
            const before = oldConfig[key];
            const after = newConfig[key];
            if (JSON.stringify(before) !== JSON.stringify(after)) {
                diffs.push({ path: key, before, after });
            }
        }
        return diffs;
    }
}
//# sourceMappingURL=hierarchical-config-loader.js.map