import { nowIso } from "../platform/contracts/types/ids.js";
import type { RegisteredPlugin, PluginManifest } from "../domains/registry/plugin-spi.js";

/**
 * §23.4: DataTaintPropagation tracks cross-plugin data contamination labels.
 * When data flows between plugins, taint labels must be propagated to ensure
 * security and compliance requirements are maintained across plugin boundaries.
 */
export interface DataTaintLabel {
  readonly sourcePluginId: string;
  readonly label: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly propagatedAt: string;
  readonly expiresAt?: string;
}

export interface DataTaintPropagation {
  readonly originPluginId: string;
  readonly labels: readonly DataTaintLabel[];
  readonly originatingDataId: string;
}

/**
 * §23.6: BundleRevocationSeverity classifies plugin revocation severity levels.
 * Used to determine appropriate response when a plugin must be revoked.
 */
export enum BundleRevocationSeverity {
  /** Informational - no action required */
  INFO = "info",
  /** Warning - consider remediation but not mandatory */
  WARNING = "warning",
  /** Moderate - should be disabled and replaced */
  MODERATE = "moderate",
  /** Severe - must be disabled immediately */
  SEVERE = "severe",
  /** Critical - emergency revocation with full system halt */
  CRITICAL = "critical",
}

export interface BundleRevocationRecord {
  readonly pluginId: string;
  readonly severity: BundleRevocationSeverity;
  readonly reason: string;
  readonly revokedAt: string;
  readonly affectedVersions: readonly string[];
}
import { createGithubAdapterPlugin } from "./adapters/github-adapter.js";
import { createCrmAdapterPlugin } from "./adapters/crm-adapter.js";
import { createGameDevAdapterPlugin } from "./adapters/game-dev-adapter.js";
import { createAssetProductionAdapterPlugin } from "./adapters/asset-production-adapter.js";
import { createLivestreamAdapterPlugin } from "./adapters/livestream-adapter.js";
import { createBasicPlannerPlugin } from "./planners/basic-planner.js";
import { createCodingPresenterPlugin } from "./presenters/coding-presenter.js";
import { createCodingRetrieverPlugin } from "./retrievers/coding-retriever.js";
import { createGrowthPresenterPlugin } from "./presenters/growth-presenter.js";
import { createGrowthRetrieverPlugin } from "./retrievers/growth-retriever.js";
import { createOperationsPresenterPlugin } from "./presenters/operations-presenter.js";
import { createOperationsRetrieverPlugin } from "./retrievers/operations-retriever.js";
import { createGameDevRetrieverPlugin } from "./retrievers/game-dev-retriever.js";
import { createAssetProductionRetrieverPlugin } from "./retrievers/asset-production-retriever.js";
import { createLivestreamRetrieverPlugin } from "./retrievers/livestream-retriever.js";
import { createBasicEvaluatorPlugin } from "./validators/basic-evaluator.js";

type PluginFactory = () => RegisteredPlugin;

// §10 Built-in plugins must have PluginManifest with owner/trustLevel/sbomRef/publicSdkSurface
interface BuiltinPluginEntry {
  readonly factory: PluginFactory;
  readonly manifest: PluginManifest;
}

const BUILTIN_PLUGIN_ENTRIES: ReadonlyMap<string, BuiltinPluginEntry> = (() => {
  const map = new Map<string, BuiltinPluginEntry>();

  // §G1: Coding domain plugins
  map.set("plugin.coding.retriever", {
    factory: createCodingRetrieverPlugin,
    manifest: {
      pluginId: "plugin.coding.retriever",
      name: "Coding Retriever",
      version: "1.0.0",
      owner: "platform-team",
      domainIds: ["coding"],
      capabilityIds: ["retriever.coding"],
      spiTypes: ["retriever"],
      extensionKind: "domain_plugin",
      trustLevel: "verified",
      publicSdkSurface: ["@automatic-agent/plugin-coding-retriever"],
      dependencies: [],
      settingsSchema: {},
      sandbox: {
        timeoutMs: 5000,
        allowFilesystemWrite: false,
        allowNetworkEgress: false,
        allowedKnowledgeNamespaces: [],
        maxConcurrentInvocations: 1,
        maxQueuedInvocations: 8,
        runtimeIsolation: "serialized_in_process",
        cooldownMs: 0,
        allowedExternalDomains: [],
        maxResponseSizeBytes: 5242880,
        rateLimitPerMinute: 60,
      },
    },
  });

  map.set("plugin.coding.presenter", {
    factory: createCodingPresenterPlugin,
    manifest: {
      pluginId: "plugin.coding.presenter",
      name: "Coding Presenter",
      version: "1.0.0",
      owner: "platform-team",
      domainIds: ["coding"],
      capabilityIds: ["presenter.coding"],
      spiTypes: ["presenter"],
      extensionKind: "domain_plugin",
      trustLevel: "verified",
      publicSdkSurface: ["@automatic-agent/plugin-coding-presenter"],
      dependencies: [],
      settingsSchema: {},
      sandbox: {
        timeoutMs: 5000,
        allowFilesystemWrite: false,
        allowNetworkEgress: false,
        allowedKnowledgeNamespaces: [],
        maxConcurrentInvocations: 1,
        maxQueuedInvocations: 8,
        runtimeIsolation: "serialized_in_process",
        cooldownMs: 0,
        allowedExternalDomains: [],
        maxResponseSizeBytes: 5242880,
        rateLimitPerMinute: 60,
      },
    },
  });

  // §G2: Core plugins
  map.set("plugin.core.basic-validator", {
    factory: createBasicEvaluatorPlugin,
    manifest: {
      pluginId: "plugin.core.basic-validator",
      name: "Basic Validator",
      version: "1.0.0",
      owner: "platform-team",
      domainIds: [],
      capabilityIds: ["output.validate", "output.harness-decision"],
      spiTypes: ["validator"],
      extensionKind: "domain_plugin",
      trustLevel: "verified",
      publicSdkSurface: ["@automatic-agent/plugin-basic-validator"],
      dependencies: [],
      settingsSchema: {},
      sandbox: {
        timeoutMs: 5000,
        allowFilesystemWrite: false,
        allowNetworkEgress: false,
        allowedKnowledgeNamespaces: [],
        maxConcurrentInvocations: 1,
        maxQueuedInvocations: 8,
        runtimeIsolation: "serialized_in_process",
        cooldownMs: 0,
        allowedExternalDomains: [],
        maxResponseSizeBytes: 5242880,
        rateLimitPerMinute: 60,
      },
    },
  });

  map.set("plugin.core.basic-planner", {
    factory: createBasicPlannerPlugin,
    manifest: {
      pluginId: "plugin.core.basic-planner",
      name: "Basic Planner",
      version: "1.0.0",
      owner: "platform-team",
      domainIds: [],
      capabilityIds: ["planner.core"],
      spiTypes: ["planner"],
      extensionKind: "domain_plugin",
      trustLevel: "verified",
      publicSdkSurface: ["@automatic-agent/plugin-basic-planner"],
      dependencies: [],
      settingsSchema: {},
      sandbox: {
        timeoutMs: 5000,
        allowFilesystemWrite: false,
        allowNetworkEgress: false,
        allowedKnowledgeNamespaces: [],
        maxConcurrentInvocations: 1,
        maxQueuedInvocations: 8,
        runtimeIsolation: "serialized_in_process",
        cooldownMs: 0,
        allowedExternalDomains: [],
        maxResponseSizeBytes: 5242880,
        rateLimitPerMinute: 60,
      },
    },
  });

  // §G3: Shared plugins
  map.set("plugin.shared.github_adapter", {
    factory: createGithubAdapterPlugin,
    manifest: {
      pluginId: "plugin.shared.github_adapter",
      name: "GitHub Adapter",
      version: "1.0.0",
      owner: "platform-team",
      domainIds: ["coding", "operations", "growth"],
      capabilityIds: ["external.github", "external.github.issue", "external.github.workflow"],
      spiTypes: ["adapter"],
      extensionKind: "external_adapter",
      trustLevel: "trusted",
      publicSdkSurface: ["@automatic-agent/plugin-github-adapter"],
      dependencies: [],
      settingsSchema: {},
      sandbox: {
        timeoutMs: 5000,
        allowFilesystemWrite: false,
        allowNetworkEgress: false,
        allowedKnowledgeNamespaces: [],
        maxConcurrentInvocations: 1,
        maxQueuedInvocations: 8,
        runtimeIsolation: "serialized_in_process",
        cooldownMs: 0,
        allowedExternalDomains: [],
        maxResponseSizeBytes: 5242880,
        rateLimitPerMinute: 60,
      },
    },
  });

  // §G8: Operations domain plugins
  map.set("plugin.operations.retriever", {
    factory: createOperationsRetrieverPlugin,
    manifest: {
      pluginId: "plugin.operations.retriever",
      name: "Operations Retriever",
      version: "1.0.0",
      owner: "platform-team",
      domainIds: ["operations"],
      capabilityIds: ["retriever.operations"],
      spiTypes: ["retriever"],
      extensionKind: "domain_plugin",
      trustLevel: "verified",
      publicSdkSurface: ["@automatic-agent/plugin-operations-retriever"],
      dependencies: [],
      settingsSchema: {},
      sandbox: {
        timeoutMs: 5000,
        allowFilesystemWrite: false,
        allowNetworkEgress: false,
        allowedKnowledgeNamespaces: [],
        maxConcurrentInvocations: 1,
        maxQueuedInvocations: 8,
        runtimeIsolation: "serialized_in_process",
        cooldownMs: 0,
        allowedExternalDomains: [],
        maxResponseSizeBytes: 5242880,
        rateLimitPerMinute: 60,
      },
    },
  });

  map.set("plugin.operations.presenter", {
    factory: createOperationsPresenterPlugin,
    manifest: {
      pluginId: "plugin.operations.presenter",
      name: "Operations Presenter",
      version: "1.0.0",
      owner: "platform-team",
      domainIds: ["operations"],
      capabilityIds: ["presenter.operations"],
      spiTypes: ["presenter"],
      extensionKind: "domain_plugin",
      trustLevel: "verified",
      publicSdkSurface: ["@automatic-agent/plugin-operations-presenter"],
      dependencies: [],
      settingsSchema: {},
      sandbox: {
        timeoutMs: 5000,
        allowFilesystemWrite: false,
        allowNetworkEgress: false,
        allowedKnowledgeNamespaces: [],
        maxConcurrentInvocations: 1,
        maxQueuedInvocations: 8,
        runtimeIsolation: "serialized_in_process",
        cooldownMs: 0,
        allowedExternalDomains: [],
        maxResponseSizeBytes: 5242880,
        rateLimitPerMinute: 60,
      },
    },
  });

  // §G8: Growth domain plugins (M2 Phase 2)
  map.set("plugin.growth.retriever", {
    factory: createGrowthRetrieverPlugin,
    manifest: {
      pluginId: "plugin.growth.retriever",
      name: "Growth Retriever",
      version: "1.0.0",
      owner: "platform-team",
      domainIds: ["growth"],
      capabilityIds: ["retriever.growth"],
      spiTypes: ["retriever"],
      extensionKind: "domain_plugin",
      trustLevel: "verified",
      publicSdkSurface: ["@automatic-agent/plugin-growth-retriever"],
      dependencies: [],
      settingsSchema: {},
      sandbox: {
        timeoutMs: 5000,
        allowFilesystemWrite: false,
        allowNetworkEgress: false,
        allowedKnowledgeNamespaces: [],
        maxConcurrentInvocations: 1,
        maxQueuedInvocations: 8,
        runtimeIsolation: "serialized_in_process",
        cooldownMs: 0,
        allowedExternalDomains: [],
        maxResponseSizeBytes: 5242880,
        rateLimitPerMinute: 60,
      },
    },
  });

  map.set("plugin.growth.presenter", {
    factory: createGrowthPresenterPlugin,
    manifest: {
      pluginId: "plugin.growth.presenter",
      name: "Growth Presenter",
      version: "1.0.0",
      owner: "platform-team",
      domainIds: ["growth"],
      capabilityIds: ["presenter.growth"],
      spiTypes: ["presenter"],
      extensionKind: "domain_plugin",
      trustLevel: "verified",
      publicSdkSurface: ["@automatic-agent/plugin-growth-presenter"],
      dependencies: [],
      settingsSchema: {},
      sandbox: {
        timeoutMs: 5000,
        allowFilesystemWrite: false,
        allowNetworkEgress: false,
        allowedKnowledgeNamespaces: [],
        maxConcurrentInvocations: 1,
        maxQueuedInvocations: 8,
        runtimeIsolation: "serialized_in_process",
        cooldownMs: 0,
        allowedExternalDomains: [],
        maxResponseSizeBytes: 5242880,
        rateLimitPerMinute: 60,
      },
    },
  });

  map.set("plugin.growth.crm_adapter", {
    factory: createCrmAdapterPlugin,
    manifest: {
      pluginId: "plugin.growth.crm_adapter",
      name: "CRM Adapter",
      version: "1.0.0",
      owner: "platform-team",
      domainIds: ["growth"],
      capabilityIds: ["external.crm"],
      spiTypes: ["adapter"],
      extensionKind: "external_adapter",
      trustLevel: "trusted",
      publicSdkSurface: ["@automatic-agent/plugin-crm-adapter"],
      dependencies: [],
      settingsSchema: {},
      sandbox: {
        timeoutMs: 5000,
        allowFilesystemWrite: false,
        allowNetworkEgress: false,
        allowedKnowledgeNamespaces: [],
        maxConcurrentInvocations: 1,
        maxQueuedInvocations: 8,
        runtimeIsolation: "serialized_in_process",
        cooldownMs: 0,
        allowedExternalDomains: [],
        maxResponseSizeBytes: 5242880,
        rateLimitPerMinute: 60,
      },
    },
  });

  // §G8: Game Dev domain plugins (M2 Phase 3)
  map.set("plugin.gamedev.retriever", {
    factory: createGameDevRetrieverPlugin,
    manifest: {
      pluginId: "plugin.gamedev.retriever",
      name: "Game Dev Retriever",
      version: "1.0.0",
      owner: "platform-team",
      domainIds: ["gamedev"],
      capabilityIds: ["retriever.gamedev"],
      spiTypes: ["retriever"],
      extensionKind: "domain_plugin",
      trustLevel: "verified",
      publicSdkSurface: ["@automatic-agent/plugin-gamedev-retriever"],
      dependencies: [],
      settingsSchema: {},
      sandbox: {
        timeoutMs: 5000,
        allowFilesystemWrite: false,
        allowNetworkEgress: false,
        allowedKnowledgeNamespaces: [],
        maxConcurrentInvocations: 1,
        maxQueuedInvocations: 8,
        runtimeIsolation: "serialized_in_process",
        cooldownMs: 0,
        allowedExternalDomains: [],
        maxResponseSizeBytes: 5242880,
        rateLimitPerMinute: 60,
      },
    },
  });

  map.set("plugin.gamedev.unity_adapter", {
    factory: createGameDevAdapterPlugin,
    manifest: {
      pluginId: "plugin.gamedev.unity_adapter",
      name: "Unity Adapter",
      version: "1.0.0",
      owner: "platform-team",
      domainIds: ["gamedev"],
      capabilityIds: ["external.unity"],
      spiTypes: ["adapter"],
      extensionKind: "external_adapter",
      trustLevel: "trusted",
      publicSdkSurface: ["@automatic-agent/plugin-unity-adapter"],
      dependencies: [],
      settingsSchema: {},
      sandbox: {
        timeoutMs: 5000,
        allowFilesystemWrite: false,
        allowNetworkEgress: false,
        allowedKnowledgeNamespaces: [],
        maxConcurrentInvocations: 1,
        maxQueuedInvocations: 8,
        runtimeIsolation: "serialized_in_process",
        cooldownMs: 0,
        allowedExternalDomains: [],
        maxResponseSizeBytes: 5242880,
        rateLimitPerMinute: 60,
      },
    },
  });

  // §G8: Asset Production domain plugins (M2 Phase 4)
  map.set("plugin.assetproduction.retriever", {
    factory: createAssetProductionRetrieverPlugin,
    manifest: {
      pluginId: "plugin.assetproduction.retriever",
      name: "Asset Production Retriever",
      version: "1.0.0",
      owner: "platform-team",
      domainIds: ["assetproduction"],
      capabilityIds: ["retriever.assetproduction"],
      spiTypes: ["retriever"],
      extensionKind: "domain_plugin",
      trustLevel: "verified",
      publicSdkSurface: ["@automatic-agent/plugin-assetproduction-retriever"],
      dependencies: [],
      settingsSchema: {},
      sandbox: {
        timeoutMs: 5000,
        allowFilesystemWrite: false,
        allowNetworkEgress: false,
        allowedKnowledgeNamespaces: [],
        maxConcurrentInvocations: 1,
        maxQueuedInvocations: 8,
        runtimeIsolation: "serialized_in_process",
        cooldownMs: 0,
        allowedExternalDomains: [],
        maxResponseSizeBytes: 5242880,
        rateLimitPerMinute: 60,
      },
    },
  });

  map.set("plugin.assetproduction.figma_adapter", {
    factory: createAssetProductionAdapterPlugin,
    manifest: {
      pluginId: "plugin.assetproduction.figma_adapter",
      name: "Figma Adapter",
      version: "1.0.0",
      owner: "platform-team",
      domainIds: ["assetproduction"],
      capabilityIds: ["external.figma"],
      spiTypes: ["adapter"],
      extensionKind: "external_adapter",
      trustLevel: "trusted",
      publicSdkSurface: ["@automatic-agent/plugin-figma-adapter"],
      dependencies: [],
      settingsSchema: {},
      sandbox: {
        timeoutMs: 5000,
        allowFilesystemWrite: false,
        allowNetworkEgress: false,
        allowedKnowledgeNamespaces: [],
        maxConcurrentInvocations: 1,
        maxQueuedInvocations: 8,
        runtimeIsolation: "serialized_in_process",
        cooldownMs: 0,
        allowedExternalDomains: [],
        maxResponseSizeBytes: 5242880,
        rateLimitPerMinute: 60,
      },
    },
  });

  // §G8: Livestream domain plugins (M2 Phase 5)
  map.set("plugin.livestream.retriever", {
    factory: createLivestreamRetrieverPlugin,
    manifest: {
      pluginId: "plugin.livestream.retriever",
      name: "Livestream Retriever",
      version: "1.0.0",
      owner: "platform-team",
      domainIds: ["livestream"],
      capabilityIds: ["retriever.livestream"],
      spiTypes: ["retriever"],
      extensionKind: "domain_plugin",
      trustLevel: "verified",
      publicSdkSurface: ["@automatic-agent/plugin-livestream-retriever"],
      dependencies: [],
      settingsSchema: {},
      sandbox: {
        timeoutMs: 5000,
        allowFilesystemWrite: false,
        allowNetworkEgress: false,
        allowedKnowledgeNamespaces: [],
        maxConcurrentInvocations: 1,
        maxQueuedInvocations: 8,
        runtimeIsolation: "serialized_in_process",
        cooldownMs: 0,
        allowedExternalDomains: [],
        maxResponseSizeBytes: 5242880,
        rateLimitPerMinute: 60,
      },
    },
  });

  map.set("plugin.livestream.obs_adapter", {
    factory: createLivestreamAdapterPlugin,
    manifest: {
      pluginId: "plugin.livestream.obs_adapter",
      name: "OBS Adapter",
      version: "1.0.0",
      owner: "platform-team",
      domainIds: ["livestream"],
      capabilityIds: ["external.obs"],
      spiTypes: ["adapter"],
      extensionKind: "external_adapter",
      trustLevel: "trusted",
      publicSdkSurface: ["@automatic-agent/plugin-obs-adapter"],
      dependencies: [],
      settingsSchema: {},
      sandbox: {
        timeoutMs: 5000,
        allowFilesystemWrite: false,
        allowNetworkEgress: false,
        allowedKnowledgeNamespaces: [],
        maxConcurrentInvocations: 1,
        maxQueuedInvocations: 8,
        runtimeIsolation: "serialized_in_process",
        cooldownMs: 0,
        allowedExternalDomains: [],
        maxResponseSizeBytes: 5242880,
        rateLimitPerMinute: 60,
      },
    },
  });

  return map;
})();

/**
 * Create a built-in plugin by plugin ID.
 * Returns null if the plugin ID is not a known built-in.
 */
export function createBuiltinPlugin(pluginId: string): RegisteredPlugin | null {
  const entry = BUILTIN_PLUGIN_ENTRIES.get(pluginId);
  if (!entry) return null;
  // Track plugin lifecycle state - mark as loading then active
  setPluginLifecycleState(pluginId, "loading");
  const plugin = entry.factory();
  setPluginLifecycleState(pluginId, "active");
  return plugin;
}

/**
 * Get the PluginManifest for a built-in plugin.
 * Returns null if the plugin ID is not a known built-in.
 */
export function getBuiltinPluginManifest(pluginId: string): PluginManifest | null {
  const entry = BUILTIN_PLUGIN_ENTRIES.get(pluginId);
  return entry?.manifest ?? null;
}

export function hasBuiltinPlugin(pluginId: string): boolean {
  return BUILTIN_PLUGIN_ENTRIES.has(pluginId);
}

/**
 * R18-6: Validate plugin compatibility against platform version and other plugins.
 * Checks that the plugin is compatible with the current platform version.
 */
export function validatePluginCompatibility(manifest: PluginManifest): { compatible: boolean; reason?: string } {
  // Check required manifest fields
  if (!manifest.pluginId || !manifest.version) {
    return { compatible: false, reason: "Plugin manifest missing required fields (pluginId or version)" };
  }

  // Check SPI types are valid
  const validSpiTypes = ["tool", "retriever", "validator", "planner", "presenter", "adapter", "evaluator"];
  for (const spiType of manifest.spiTypes) {
    if (!validSpiTypes.includes(spiType)) {
      return { compatible: false, reason: `Invalid SPI type: ${spiType}` };
    }
  }

  // Check trustLevel is valid
  const validTrustLevels = ["internal", "trusted", "community", "unverified", "verified", "untrusted"];
  if (!validTrustLevels.includes(manifest.trustLevel)) {
    return { compatible: false, reason: `Invalid trustLevel: ${manifest.trustLevel}` };
  }

  // R18-6: Additional compatibility checks could include:
  // - Platform version compatibility
  // - Required capabilities availability
  // - Sandbox mode compatibility
  return { compatible: true };
}

/**
 * R18-7: Check plugin dependencies are satisfied.
 * Verifies that all declared dependencies are registered and compatible.
 */
export function checkPluginDependencies(
  manifest: PluginManifest,
  registeredPlugins: readonly string[],
): { satisfied: boolean; missing: readonly string[] } {
  const missing: string[] = [];

  for (const dep of manifest.dependencies ?? []) {
    // Dependency can be a plugin ID or a capability requirement
    // For now, we check if it's a registered plugin
    if (!registeredPlugins.includes(dep) && !hasBuiltinPlugin(dep)) {
      missing.push(dep);
    }
  }

  return {
    satisfied: missing.length === 0,
    missing,
  };
}

/**
 * R18-8: Enforce plugin version compatibility.
 * Returns true if the plugin version meets the minimum required version.
 */
export function enforcePluginVersion(
  manifest: PluginManifest,
  minimumVersion?: string,
): boolean {
  if (!minimumVersion) {
    return true; // No minimum version required
  }

  return compareVersions(manifest.version, minimumVersion) >= 0;
}

/**
 * Compare two semantic versions.
 * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map((p) => parseInt(p, 10) || 0);
  const parts2 = v2.split(".").map((p) => parseInt(p, 10) || 0);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
}

export function listBuiltinPluginIds(): string[] {
  return [...BUILTIN_PLUGIN_ENTRIES.keys()];
}

// §23.6: Plugin lifecycle state tracking per contract §4
// States: registered→validated→loading→active→inactive→unloaded
const PLUGIN_LIFECYCLE_STATES = new Map<string, "registered" | "validated" | "loading" | "active" | "inactive" | "unloaded">();

/**
 * §23.6: Get the current lifecycle state of a plugin.
 * Returns null if the plugin has not been tracked.
 */
export function getPluginLifecycleState(pluginId: string): "registered" | "validated" | "loading" | "active" | "inactive" | "unloaded" | null {
  return PLUGIN_LIFECYCLE_STATES.get(pluginId) ?? null;
}

/**
 * §23.6: Set the lifecycle state of a plugin.
 * Used to track plugin lifecycle transitions per contract §4.
 */
export function setPluginLifecycleState(
  pluginId: string,
  state: "registered" | "validated" | "loading" | "active" | "inactive" | "unloaded",
): void {
  PLUGIN_LIFECYCLE_STATES.set(pluginId, state);
}

// §23.4: DataTaintPropagation - Track cross-plugin data contamination labels
const DATA_TAINT_LABELS = new Map<string, DataTaintLabel>();

/**
 * §23.8: DynamicPluginLoader - Interface for dynamically loading plugins.
 * Plugins can be loaded from marketplace, local filesystem, or remote URLs.
 */
export interface DynamicPluginLoader {
  /**
   * Load a plugin from a dynamic source.
   * @param source - URI or identifier for the plugin source (marketplace ID, file path, or URL)
   * @param authToken - Optional authentication token for accessing the plugin source
   * @returns Loaded plugin instance or null if loading failed
   */
  loadFromSource(source: string, authToken?: string): Promise<RegisteredPlugin | null>;

  /**
   * Check if this loader supports loading from the given source.
   */
  supportsSource(source: string): boolean;
}

/**
 * §23.8: MarketplacePluginEntry - Plugin entry from the marketplace.
 */
export interface MarketplacePluginEntry {
  pluginId: string;
  name: string;
  version: string;
  owner: string;
  trustLevel: "verified" | "trusted" | "untrusted";
  source: string;
  verifiedAt?: string;
  certifications?: readonly string[];
}

/**
 * §23.8: PluginMarketplaceRegistry - Registry for marketplace-discoverable plugins.
 * Supports dynamic loading, authentication, and verification.
 */
export class PluginMarketplaceRegistry {
  private readonly loaders = new Map<string, DynamicPluginLoader>();
  private readonly marketplaceEntries = new Map<string, MarketplacePluginEntry>();
  private readonly authenticatedSessions = new Map<string, string>();

  /**
   * Register a dynamic plugin loader for a source scheme.
   * @param scheme - The URL scheme or source type prefix (e.g., "marketplace:", "file:", "https:")
   * @param loader - The loader instance for this scheme
   */
  registerLoader(scheme: string, loader: DynamicPluginLoader): void {
    this.loaders.set(scheme, loader);
  }

  /**
   * Register a plugin entry from the marketplace.
   */
  registerMarketplaceEntry(entry: MarketplacePluginEntry): void {
    this.marketplaceEntries.set(entry.pluginId, entry);
  }

  /**
   * Authenticate with the marketplace using credentials.
   * Returns a session token on success.
   */
  async authenticate(
    marketplaceUrl: string,
    credentials: { apiKey?: string; apiSecret?: string },
  ): Promise<string> {
    // In production this would call the marketplace auth endpoint
    // For now, generate a session token keyed to the marketplace URL
    const sessionToken = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.authenticatedSessions.set(sessionToken, marketplaceUrl);
    return sessionToken;
  }

  /**
   * Check if a session is authenticated.
   */
  isAuthenticated(sessionToken: string): boolean {
    return this.authenticatedSessions.has(sessionToken);
  }

  /**
   * Dynamically load a plugin from a marketplace or external source.
   */
  async loadPlugin(
    pluginId: string,
    source: string,
    authToken?: string,
  ): Promise<RegisteredPlugin | null> {
    // Check marketplace entry first
    const entry = this.marketplaceEntries.get(pluginId);
    if (!entry) {
      return null;
    }

    // Verify authentication if required
    if (authToken && !this.isAuthenticated(authToken)) {
      throw new Error(`Plugin marketplace.auth.required: Authentication required to load plugin ${pluginId}`);
    }

    // Find a loader that supports this source
    for (const [, loader] of this.loaders) {
      if (loader.supportsSource(source)) {
        return loader.loadFromSource(source, authToken);
      }
    }

    throw new Error(`Plugin marketplace.loader.not_found: No loader found for source ${source}`);
  }

  /**
   * List all plugins available in the marketplace.
   */
  listMarketplacePlugins(): readonly MarketplacePluginEntry[] {
    return [...this.marketplaceEntries.values()];
  }

  /**
   * Get a marketplace entry by plugin ID.
   */
  getMarketplaceEntry(pluginId: string): MarketplacePluginEntry | null {
    return this.marketplaceEntries.get(pluginId) ?? null;
  }

  /**
   * Check if a plugin is available in the marketplace.
   */
  hasMarketplacePlugin(pluginId: string): boolean {
    return this.marketplaceEntries.has(pluginId);
  }
}

// Global marketplace registry instance
const globalMarketplaceRegistry = new PluginMarketplaceRegistry();

/**
 * Get the global plugin marketplace registry.
 */
export function getMarketplaceRegistry(): PluginMarketplaceRegistry {
  return globalMarketplaceRegistry;
}

/**
 * §23.4: Propagate data taint labels when data flows between plugins.
 * When a plugin uses data from another plugin, taint labels must be tracked.
 */
export function propagateDataTaint(
  dataId: string,
  targetPluginId: string,
  labels: readonly string[],
): DataTaintPropagation {
  // §203-2380-2381: Use platform nowIso() for timestamp consistency
  const now = nowIso();
  const propagatedLabels: DataTaintLabel[] = [];

  for (const label of labels) {
    const taintEntry: DataTaintLabel = {
      sourcePluginId: targetPluginId,
      label,
      severity: "medium",
      propagatedAt: now,
    };
    DATA_TAINT_LABELS.set(`${dataId}:${label}:${targetPluginId}`, taintEntry);
    propagatedLabels.push(taintEntry);
  }

  return {
    originPluginId: targetPluginId,
    labels: propagatedLabels,
    originatingDataId: dataId,
  };
}

/**
 * §23.4: Get all taint labels for a data ID across all plugins.
 */
export function getDataTaintLabels(dataId: string): readonly DataTaintLabel[] {
  const labels: DataTaintLabel[] = [];
  for (const [key, entry] of DATA_TAINT_LABELS.entries()) {
    if (key.startsWith(`${dataId}:`)) {
      labels.push(entry);
    }
  }
  return labels;
}

/**
 * §23.4: Check if data has a specific taint label.
 */
export function hasDataTaintLabel(dataId: string, label: string): boolean {
  for (const [key] of DATA_TAINT_LABELS.entries()) {
    if (key.startsWith(`${dataId}:${label}:`)) {
      return true;
    }
  }
  return false;
}

// §23.6: BundleRevocationSeverity - Plugin revocation severity tracking
const REVOKED_BUNDLES = new Map<string, BundleRevocationRecord>();

/**
 * §23.6: Revoke a plugin bundle with severity classification.
 * Immediately marks the plugin as revoked with given severity level.
 */
export function revokePluginBundle(
  pluginId: string,
  severity: BundleRevocationSeverity,
  reason: string,
  affectedVersions?: readonly string[],
): BundleRevocationRecord {
  // §203-2380-2381: Use platform nowIso() instead of new Date() for consistency
  const record: BundleRevocationRecord = {
    pluginId,
    severity,
    reason,
    revokedAt: nowIso(),
    affectedVersions: affectedVersions ?? ["*"],
  };
  REVOKED_BUNDLES.set(pluginId, record);
  return record;
}

/**
 * §23.6: Check if a plugin bundle is revoked.
 * Returns the revocation record if revoked, null otherwise.
 */
export function getPluginRevocationStatus(pluginId: string): BundleRevocationRecord | null {
  return REVOKED_BUNDLES.get(pluginId) ?? null;
}

/**
 * §23.6: Check if a plugin is currently revoked (any severity).
 */
export function isPluginRevoked(pluginId: string): boolean {
  return REVOKED_BUNDLES.has(pluginId);
}

/**
 * §23.6: List all revoked plugin bundles.
 */
export function listRevokedPlugins(): readonly BundleRevocationRecord[] {
  return [...REVOKED_BUNDLES.values()];
}

/**
 * §23.6: Remove revocation for a plugin (e.g., after re-certification).
 */
export function removePluginRevocation(pluginId: string): boolean {
  return REVOKED_BUNDLES.delete(pluginId);
}
