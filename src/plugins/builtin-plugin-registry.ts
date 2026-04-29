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

const BUILTIN_PLUGIN_ENTRIES: ReadonlyMap<string, BuiltinPluginEntry> = new Map([
  ["plugin.coding.retriever", {
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
      trustLevel: "internal",
      publicSdkSurface: "@automatic-agent/plugin-coding-retriever",
      settingsSchema: {},
    },
  }],
  ["plugin.coding.presenter", {
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
      trustLevel: "internal",
      publicSdkSurface: "@automatic-agent/plugin-coding-presenter",
      settingsSchema: {},
    },
  }],
  ["plugin.core.basic-evaluator", {
    factory: createBasicEvaluatorPlugin,
    manifest: {
      pluginId: "plugin.core.basic-evaluator",
      name: "Basic Evaluator",
      version: "1.0.0",
      owner: "platform-team",
      domainIds: [],
      capabilityIds: ["evaluator.core"],
      spiTypes: ["evaluator"],
      extensionKind: "domain_plugin",
      trustLevel: "internal",
      publicSdkSurface: "@automatic-agent/plugin-basic-evaluator",
      settingsSchema: {},
    },
  }],
  ["plugin.core.basic-planner", {
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
      trustLevel: "internal",
      publicSdkSurface: "@automatic-agent/plugin-basic-planner",
      settingsSchema: {},
    },
  }],
  ["plugin.shared.github_adapter", {
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
      publicSdkSurface: "@automatic-agent/plugin-github-adapter",
      settingsSchema: {},
    },
  }],
  // §G8: Operations domain plugins
  ["plugin.operations.retriever", {
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
      trustLevel: "internal",
      publicSdkSurface: "@automatic-agent/plugin-operations-retriever",
      settingsSchema: {},
    },
  }],
  ["plugin.operations.presenter", {
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
      trustLevel: "internal",
      publicSdkSurface: "@automatic-agent/plugin-operations-presenter",
      settingsSchema: {},
    },
  }],
  // §G8: Growth domain plugins (M2 Phase 2)
  ["plugin.growth.retriever", {
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
      trustLevel: "internal",
      publicSdkSurface: "@automatic-agent/plugin-growth-retriever",
      settingsSchema: {},
    },
  }],
  ["plugin.growth.presenter", {
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
      trustLevel: "internal",
      publicSdkSurface: "@automatic-agent/plugin-growth-presenter",
      settingsSchema: {},
    },
  }],
  ["plugin.growth.crm_adapter", {
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
      publicSdkSurface: "@automatic-agent/plugin-crm-adapter",
      settingsSchema: {},
    },
  }],
  // §G8: Game Dev domain plugins (M2 Phase 3)
  ["plugin.gamedev.retriever", {
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
      trustLevel: "internal",
      publicSdkSurface: "@automatic-agent/plugin-gamedev-retriever",
      settingsSchema: {},
    },
  }],
  ["plugin.gamedev.unity_adapter", {
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
      publicSdkSurface: "@automatic-agent/plugin-unity-adapter",
      settingsSchema: {},
    },
  }],
  // §G8: Asset Production domain plugins (M2 Phase 4)
  ["plugin.assetproduction.retriever", {
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
      trustLevel: "internal",
      publicSdkSurface: "@automatic-agent/plugin-assetproduction-retriever",
      settingsSchema: {},
    },
  }],
  ["plugin.assetproduction.figma_adapter", {
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
      publicSdkSurface: "@automatic-agent/plugin-figma-adapter",
      settingsSchema: {},
    },
  }],
  // §G8: Livestream domain plugins (M2 Phase 5)
  ["plugin.livestream.retriever", {
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
      trustLevel: "internal",
      publicSdkSurface: "@automatic-agent/plugin-livestream-retriever",
      settingsSchema: {},
    },
  }],
  ["plugin.livestream.obs_adapter", {
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
      publicSdkSurface: "@automatic-agent/plugin-obs-adapter",
      settingsSchema: {},
    },
  }],
]);

/**
 * Create a built-in plugin by plugin ID.
 * Returns null if the plugin ID is not a known built-in.
 */
export function createBuiltinPlugin(pluginId: string): RegisteredPlugin | null {
  const entry = BUILTIN_PLUGIN_ENTRIES.get(pluginId);
  if (!entry) return null;
  return entry.factory();
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

export function listBuiltinPluginIds(): string[] {
  return [...BUILTIN_PLUGIN_ENTRIES.keys()];
}

// §23.4: DataTaintPropagation - Track cross-plugin data contamination labels
const DATA_TAINT_LABELS = new Map<string, DataTaintLabel>();

/**
 * §23.4: Propagate data taint labels when data flows between plugins.
 * When a plugin uses data from another plugin, taint labels must be tracked.
 */
export function propagateDataTaint(
  dataId: string,
  targetPluginId: string,
  labels: readonly string[],
): DataTaintPropagation {
  const now = new Date().toISOString();
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
  const record: BundleRevocationRecord = {
    pluginId,
    severity,
    reason,
    revokedAt: new Date().toISOString(),
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
