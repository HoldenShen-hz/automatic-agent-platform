/**
 * Hierarchical Configuration Loader
 *
 * Loads and merges configuration from multiple hierarchy levels:
 * platform → tenant → pack → task-type
 *
 * Each subsequent layer can override values from previous layers.
 * This enables tenant-specific, pack-specific, and task-type-specific config overrides.
 */
import { DurableEventBus } from "../../state-evidence/events/durable-event-bus.js";
/**
 * Configuration source type in the hierarchy.
 */
export type ConfigHierarchyLayer = "platform" | "tenant" | "pack" | "task_type";
/**
 * Represents a configuration value at a specific hierarchy level.
 */
export interface HierarchyConfigSource {
    layer: ConfigHierarchyLayer;
    sourceId: string | null;
    config: Record<string, unknown>;
    version: string;
    updatedAt: string;
}
/**
 * Options for hierarchical config loading.
 */
export interface HierarchicalConfigLoaderOptions {
    eventBus?: DurableEventBus | null;
    emitChangeEvents?: boolean;
}
/**
 * Result of loading hierarchical config.
 */
export interface HierarchicalConfigResult {
    /** Merged configuration with layer precedence applied */
    merged: Record<string, unknown>;
    /** All sources in hierarchy order (platform first, task_type last) */
    sources: HierarchyConfigSource[];
    /** The most specific layer that provided each top-level key */
    layerMap: Record<string, ConfigHierarchyLayer>;
    /** Version of the merged config */
    version: string;
}
/**
 * Service for loading and merging hierarchical configuration.
 *
 * Applies the principle that more specific layers override less specific:
 * platform < tenant < pack < task_type
 */
export declare class HierarchicalConfigLoader {
    private readonly eventBus;
    private readonly emitChangeEvents;
    constructor(options?: HierarchicalConfigLoaderOptions);
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
    loadConfig(platformConfig: Record<string, unknown>, tenantConfigs?: Record<string, Record<string, unknown>>, packConfigs?: Record<string, Record<string, unknown>>, taskTypeConfigs?: Record<string, Record<string, unknown>>, activeTenantId?: string | null, activePackId?: string | null, activeTaskTypeId?: string | null): HierarchicalConfigResult;
    /**
     * Emits a config.changed event for a specific layer.
     *
     * @param layer - The hierarchy layer that changed
     * @param sourceId - The source ID that changed (e.g., tenantId)
     * @param oldConfig - Previous configuration
     * @param newConfig - New configuration
     */
    emitConfigChange(layer: ConfigHierarchyLayer, sourceId: string | null, oldConfig: Record<string, unknown>, newConfig: Record<string, unknown>): void;
    /**
     * Merges configs from multiple sources with later sources overriding earlier.
     */
    private mergeConfigs;
    /**
     * Deep merges two objects, with override values taking precedence.
     */
    private deepMerge;
    /**
     * Checks if a value is a plain object.
     */
    private isObject;
    /**
     * Computes a simple version hash from config content.
     */
    private computeVersion;
    /**
     * Computes differences between old and new config.
     */
    private computeDiff;
}
