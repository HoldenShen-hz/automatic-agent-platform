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
import { sha256, stableStringify } from "./config-governance-support.js";

/**
 * Configuration source type in the hierarchy.
 * Per §24.1: platform→environment→tenant→pack→runtime 5层
 */
export type ConfigHierarchyLayer =
  | "platform"
  | "environment"
  | "tenant"
  | "pack"
  | "runtime";

/**
 * Represents a configuration value at a specific hierarchy level.
 */
export interface HierarchyConfigSource {
  layer: ConfigHierarchyLayer;
  sourceId: string | null; // tenantId, packId, or taskTypeId
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
  /** All sources in hierarchy order (platform first, runtime last) */
  sources: HierarchyConfigSource[];
  /** The most specific layer that provided each top-level key */
  layerMap: Record<string, ConfigHierarchyLayer>;
  /** Version of the merged config */
  version: string;
}

/**
 * Service for loading and merging hierarchical configuration.
 * Per §24.1: platform→environment→tenant→pack→runtime 5层
 *
 * Applies the principle that more specific layers override less specific:
 * platform < environment < tenant < pack < runtime
 */
export class HierarchicalConfigLoader {
  private readonly eventBus: DurableEventBus | null;
  private readonly emitChangeEvents: boolean;

  public constructor(options: HierarchicalConfigLoaderOptions = {}) {
    this.eventBus = options.eventBus ?? null;
    this.emitChangeEvents = options.emitChangeEvents ?? true;
  }

  /**
   * Loads and merges configurations from all hierarchy levels.
   * Per §24.1: platform→environment→tenant→pack→runtime 5层
   *
   * @param platformConfig - Base platform configuration
   * @param environmentConfigs - Map of environmentId to environment config (dev/staging/prod)
   * @param tenantConfigs - Map of tenantId to tenant config
   * @param packConfigs - Map of packId to pack config
   * @param runtimeConfigs - Map of runtimeId to runtime config (dynamic runtime overrides)
   * @param activeEnvironmentId - Currently active environment ID (for environment override)
   * @param activeTenantId - Currently active tenant ID (for tenant override)
   * @param activePackId - Currently active pack ID (for pack override)
   * @param activeRuntimeId - Currently active runtime ID (for runtime override)
   */
  public loadConfig(
    platformConfig: Record<string, unknown>,
    environmentConfigs: Record<string, Record<string, unknown>> = {},
    tenantConfigs: Record<string, Record<string, unknown>> = {},
    packConfigs: Record<string, Record<string, unknown>> = {},
    runtimeConfigs: Record<string, Record<string, unknown>> = {},
    activeEnvironmentId: string | null = null,
    activeTenantId: string | null = null,
    activePackId: string | null = null,
    activeRuntimeId: string | null = null,
  ): HierarchicalConfigResult {
    const sources: HierarchyConfigSource[] = [];
    const layerMap: Record<string, ConfigHierarchyLayer> = {};
    const now = new Date().toISOString();

    // Platform layer (base, least specific)
    const platformSource: HierarchyConfigSource = {
      layer: "platform",
      sourceId: null,
      config: platformConfig,
      version: this.computeVersion(platformConfig),
      updatedAt: now,
    };
    sources.push(platformSource);

    // Environment layer (e.g., dev/staging/prod)
    if (activeEnvironmentId && environmentConfigs[activeEnvironmentId]) {
      const envSource: HierarchyConfigSource = {
        layer: "environment",
        sourceId: activeEnvironmentId,
        config: environmentConfigs[activeEnvironmentId],
        version: this.computeVersion(environmentConfigs[activeEnvironmentId]),
        updatedAt: now,
      };
      sources.push(envSource);
    }

    // Tenant layer
    if (activeTenantId && tenantConfigs[activeTenantId]) {
      const tenantSource: HierarchyConfigSource = {
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
      const packSource: HierarchyConfigSource = {
        layer: "pack",
        sourceId: activePackId,
        config: packConfigs[activePackId],
        version: this.computeVersion(packConfigs[activePackId]),
        updatedAt: now,
      };
      sources.push(packSource);
    }

    // Runtime layer (most specific, highest priority, dynamic overrides)
    if (activeRuntimeId && runtimeConfigs[activeRuntimeId]) {
      const runtimeSource: HierarchyConfigSource = {
        layer: "runtime",
        sourceId: activeRuntimeId,
        config: runtimeConfigs[activeRuntimeId],
        version: this.computeVersion(runtimeConfigs[activeRuntimeId]),
        updatedAt: now,
      };
      sources.push(runtimeSource);
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
  public emitConfigChange(
    layer: ConfigHierarchyLayer,
    sourceId: string | null,
    oldConfig: Record<string, unknown>,
    newConfig: Record<string, unknown>,
  ): void {
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
  private mergeConfigs(
    sources: HierarchyConfigSource[],
    layerMap: Record<string, ConfigHierarchyLayer>,
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = {};

    for (const source of sources) {
      for (const [key, value] of Object.entries(source.config)) {
        if (this.isObject(value) && this.isObject(merged[key])) {
          // Deep merge for nested objects
          merged[key] = this.deepMerge(
            merged[key] as Record<string, unknown>,
            value as Record<string, unknown>,
          );
        } else {
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
  private deepMerge(
    base: Record<string, unknown>,
    override: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...base };

    for (const [key, value] of Object.entries(override)) {
      if (this.isObject(value) && this.isObject(result[key])) {
        result[key] = this.deepMerge(
          result[key] as Record<string, unknown>,
          value as Record<string, unknown>,
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Checks if a value is a plain object.
   */
  private isObject(value: unknown): value is Record<string, unknown> {
    return value != null && typeof value === "object" && !Array.isArray(value);
  }

  /**
   * Computes a SHA-256 version hash from config content.
   * Uses the same hashing approach as ConfigVersioningService for consistency.
   */
  private computeVersion(config: Record<string, unknown>): string {
    return sha256(stableStringify(config));
  }

  /**
   * Computes differences between old and new config.
   */
  private computeDiff(
    oldConfig: Record<string, unknown>,
    newConfig: Record<string, unknown>,
  ): Array<{ path: string; before: unknown; after: unknown }> {
    const diffs: Array<{ path: string; before: unknown; after: unknown }> = [];
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
