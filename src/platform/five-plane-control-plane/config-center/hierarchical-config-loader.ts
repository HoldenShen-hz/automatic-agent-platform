/**
 * Hierarchical Configuration Loader
 *
 * Loads and merges configuration from multiple hierarchy levels:
 * platform → tenant → pack → task-type
 *
 * Each subsequent layer can override values from previous layers.
 * This enables tenant-specific, pack-specific, and task-type-specific config overrides.
 */

import { sha256, stableStringify } from "./config-governance-support.js";
import { DurableEventBus } from "../../five-plane-state-evidence/events/durable-event-bus.js";

/**
 * Configuration source type in the hierarchy.
 * R10-06: Added "environment" and "runtime" layers for dynamic config.
 * Order: platform < tenant < pack < task_type < environment < runtime
 */
export type ConfigHierarchyLayer =
  | "platform"
  | "tenant"
  | "pack"
  | "task_type"
  | "environment"
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
export class HierarchicalConfigLoader {
  private readonly eventBus: DurableEventBus | null;
  private readonly emitChangeEvents: boolean;

  public constructor(options: HierarchicalConfigLoaderOptions = {}) {
    this.eventBus = options.eventBus ?? null;
    this.emitChangeEvents = options.emitChangeEvents ?? true;
  }

  /**
   * Loads and merges configurations from all hierarchy levels.
   * R10-06: Added environment and runtime layers for dynamic config.
   *
   * @param platformConfig - Base platform configuration
   * @param tenantConfigs - Map of tenantId to tenant config
   * @param packConfigs - Map of packId to pack config
   * @param taskTypeConfigs - Map of taskTypeId to task-type config
   * @param activeTenantId - Currently active tenant ID (for tenant override)
   * @param activePackId - Currently active pack ID (for pack override)
   * @param activeTaskTypeId - Currently active task type ID (for task-type override)
   * @param environmentConfigs - Map of environmentId to environment config (e.g., dev/staging/prod)
   * @param runtimeConfigs - Map of runtimeId to runtime config (e.g., instance-specific overrides)
   * @param activeEnvironmentId - Currently active environment ID
   * @param activeRuntimeId - Currently active runtime ID
   */
  public loadConfig(
    platformConfig: Record<string, unknown>,
    tenantConfigs: Record<string, Record<string, unknown>> = {},
    packConfigs: Record<string, Record<string, unknown>> = {},
    taskTypeConfigs: Record<string, Record<string, unknown>> = {},
    activeTenantId: string | null = null,
    activePackId: string | null = null,
    activeTaskTypeId: string | null = null,
    environmentConfigs: Record<string, Record<string, unknown>> = {},
    runtimeConfigs: Record<string, Record<string, unknown>> = {},
    activeEnvironmentId: string | null = null,
    activeRuntimeId: string | null = null,
  ): HierarchicalConfigResult {
    const sources: HierarchyConfigSource[] = [];
    const layerMap: Record<string, ConfigHierarchyLayer> = {};
    const now = new Date().toISOString();

    // Platform layer (base)
    const platformSource: HierarchyConfigSource = {
      layer: "platform",
      sourceId: null,
      config: cloneConfig(platformConfig),
      version: this.computeVersion(platformConfig),
      updatedAt: now,
    };
    sources.push(platformSource);

    // Tenant layer
    if (activeTenantId && tenantConfigs[activeTenantId]) {
      const tenantSource: HierarchyConfigSource = {
        layer: "tenant",
        sourceId: activeTenantId,
        config: cloneConfig(tenantConfigs[activeTenantId]!),
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
        config: cloneConfig(packConfigs[activePackId]!),
        version: this.computeVersion(packConfigs[activePackId]),
        updatedAt: now,
      };
      sources.push(packSource);
    }

    // Task-type layer (more specific, higher priority)
    if (activeTaskTypeId && taskTypeConfigs[activeTaskTypeId]) {
      const taskTypeSource: HierarchyConfigSource = {
        layer: "task_type",
        sourceId: activeTaskTypeId,
        config: cloneConfig(taskTypeConfigs[activeTaskTypeId]!),
        version: this.computeVersion(taskTypeConfigs[activeTaskTypeId]),
        updatedAt: now,
      };
      sources.push(taskTypeSource);
    }

    // Environment layer (R10-06: dynamic environment/runtime overrides)
    if (activeEnvironmentId && environmentConfigs[activeEnvironmentId]) {
      const environmentSource: HierarchyConfigSource = {
        layer: "environment",
        sourceId: activeEnvironmentId,
        config: cloneConfig(environmentConfigs[activeEnvironmentId]!),
        version: this.computeVersion(environmentConfigs[activeEnvironmentId]),
        updatedAt: now,
      };
      sources.push(environmentSource);
    }

    // Runtime layer (most specific, highest priority)
    if (activeRuntimeId && runtimeConfigs[activeRuntimeId]) {
      const runtimeSource: HierarchyConfigSource = {
        layer: "runtime",
        sourceId: activeRuntimeId,
        config: cloneConfig(runtimeConfigs[activeRuntimeId]!),
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
   * Computes a stable SHA-256 version hash from config content.
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

function cloneConfig(config: Record<string, unknown>): Record<string, unknown> {
  const cloned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      cloned[key] = cloneConfig(value as Record<string, unknown>);
      continue;
    }
    if (Array.isArray(value)) {
      cloned[key] = value.map((item) => (
        item != null && typeof item === "object" && !Array.isArray(item)
          ? cloneConfig(item as Record<string, unknown>)
          : item
      ));
      continue;
    }
    cloned[key] = value;
  }
  return cloned;
}
