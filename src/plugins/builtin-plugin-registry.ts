import type { RegisteredPlugin, PluginManifest } from "../domains/registry/plugin-spi.js";
import { PluginManifestSchema } from "../domains/registry/plugin-spi.js";
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
import { createBasicEvaluatorPlugin, createBasicValidatorPlugin } from "./validators/basic-evaluator.js";
import { DataTaintPropagationService, type DataTaintLabel } from "../platform/five-plane-state-evidence/truth/data-taint-propagation.js";
import { newId, nowIso } from "../platform/contracts/types/ids.js";

type PluginFactory = () => RegisteredPlugin;

/**
 * R2-5: Plugin Taint Tracking Record - tracks data taint propagation through plugin execution
 */
interface PluginTaintRecord {
  pluginId: string;
  taintLabels: readonly DataTaintLabel[];
  inputDataClass: string;
  outputDataClass: string;
  createdAt: string;
}

/**
 * R2-5: DataTaintPropagation integration for plugin system
 * Tracks taint labels as they propagate through plugin chains
 */
class PluginTaintTracker {
  private readonly taintService: DataTaintPropagationService;
  private readonly pluginTaintRecords = new Map<string, PluginTaintRecord[]>();

  public constructor() {
    this.taintService = new DataTaintPropagationService();
  }

  /**
   * Record taint propagation for a plugin execution
   */
  public recordPluginTaintPropagation(input: {
    pluginId: string;
    inputDataClasses: readonly string[];
    outputDataClass: string;
    inputTaintLabels?: readonly DataTaintLabel[];
    description?: string;
  }): import("../platform/five-plane-state-evidence/truth/data-taint-propagation.js").DataTaintPropagationRecord {
    const propagationOptions: import("../platform/five-plane-state-evidence/truth/data-taint-propagation.js").ComputeTaintPropagationOptions = {
      sourceObjectType: "ToolOutput",
      sourceObjectId: newId("plugin_taint"),
      inputDataClasses: input.inputDataClasses as import("../platform/five-plane-state-evidence/truth/data-taint-propagation.js").DataClassificationLevel[],
      sourcePluginId: input.pluginId,
      description: input.description ?? `Plugin ${input.pluginId} execution output`,
      ...(input.inputTaintLabels ? { inputTaintLabels: input.inputTaintLabels } : {}),
    };
    const result = this.taintService.computePropagation(propagationOptions);

    const record: PluginTaintRecord = {
      pluginId: input.pluginId,
      taintLabels: result.record.taintLabels,
      inputDataClass: input.inputDataClasses[0] ?? "public",
      outputDataClass: input.outputDataClass,
      createdAt: nowIso(),
    };
    const existing = this.pluginTaintRecords.get(input.pluginId) ?? [];
    this.pluginTaintRecords.set(input.pluginId, [...existing, record]);

    this.taintService.recordPropagation(result.record);
    return result.record;
  }

  public getPluginTaintLabels(pluginId: string): readonly DataTaintLabel[] {
    const records = this.pluginTaintRecords.get(pluginId) ?? [];
    return records.flatMap((r) => r.taintLabels);
  }

  public hasTaintLabel(pluginId: string, label: string): boolean {
    return this.taintService.hasTaintLabel(pluginId, label);
  }
}

const globalPluginTaintTracker = new PluginTaintTracker();

const BUILTIN_PLUGIN_FACTORIES = new Map<string, PluginFactory>([
  ["plugin.coding.retriever", createCodingRetrieverPlugin],
  ["plugin.coding.presenter", createCodingPresenterPlugin],
  ["plugin.core.basic-validator", createBasicValidatorPlugin],
  ["plugin.core.basic-evaluator", createBasicEvaluatorPlugin],
  ["plugin.core.basic-planner", createBasicPlannerPlugin],
  ["plugin.shared.github_adapter", createGithubAdapterPlugin],
  // §G8: Operations domain plugins
  ["plugin.operations.retriever", createOperationsRetrieverPlugin],
  ["plugin.operations.presenter", createOperationsPresenterPlugin],
  // §G8: Growth domain plugins (M2 Phase 2)
  ["plugin.growth.retriever", createGrowthRetrieverPlugin],
  ["plugin.growth.presenter", createGrowthPresenterPlugin],
  ["plugin.growth.crm_adapter", createCrmAdapterPlugin],
  // §G8: Game Dev domain plugins (M2 Phase 3)
  ["plugin.gamedev.retriever", createGameDevRetrieverPlugin],
  ["plugin.gamedev.unity_adapter", createGameDevAdapterPlugin],
  // §G8: Asset Production domain plugins (M2 Phase 4)
  ["plugin.assetproduction.retriever", createAssetProductionRetrieverPlugin],
  ["plugin.assetproduction.figma_adapter", createAssetProductionAdapterPlugin],
  // §G8: Livestream domain plugins (M2 Phase 5)
  ["plugin.livestream.retriever", createLivestreamRetrieverPlugin],
  ["plugin.livestream.obs_adapter", createLivestreamAdapterPlugin],
]);

// R8-24 FIX: Built-in plugin manifests for proper plugin metadata
// Using PluginManifestSchema.parse to ensure type safety with exactOptionalPropertyTypes
const BUILTIN_PLUGIN_MANIFESTS = new Map<string, PluginManifest>([
  ["plugin.coding.retriever", PluginManifestSchema.parse({
    pluginId: "plugin.coding.retriever",
    name: "Coding Retriever",
    version: "1.0.0",
    owner: "platform-team",
    domainIds: ["coding"],
    capabilityIds: ["code_search", "documentation_lookup"],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "internal",
    publicSdkSurface: "@platform/retriever.coding",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 5000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: ["code", "docs"],
      maxConcurrentInvocations: 4,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  })],
  ["plugin.coding.presenter", PluginManifestSchema.parse({
    pluginId: "plugin.coding.presenter",
    name: "Coding Presenter",
    version: "1.0.0",
    owner: "platform-team",
    domainIds: ["coding"],
    capabilityIds: ["code_formatting", "diff_generation"],
    spiTypes: ["presenter"],
    extensionKind: "domain_plugin",
    trustLevel: "internal",
    publicSdkSurface: "@platform/presenter.coding",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 5000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 4,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  })],
  ["plugin.core.basic-validator", PluginManifestSchema.parse({
    pluginId: "plugin.core.basic-validator",
    name: "Basic Validator",
    version: "1.0.0",
    owner: "platform-team",
    domainIds: [],
    capabilityIds: ["validation"],
    spiTypes: ["validator"],
    extensionKind: "domain_plugin",
    trustLevel: "internal",
    publicSdkSurface: "@platform/validator.core",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 5000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 8,
      maxQueuedInvocations: 16,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  })],
  ["plugin.core.basic-evaluator", PluginManifestSchema.parse({
    pluginId: "plugin.core.basic-evaluator",
    name: "Basic Evaluator",
    version: "1.0.0",
    owner: "platform-team",
    domainIds: [],
    capabilityIds: ["output.validate", "output.evaluate", "output.harness-decision"],
    // R15-13 FIX: spiType was incorrectly "evaluator" but actual plugin implements "validator"
    spiTypes: ["validator", "evaluator"],
    extensionKind: "domain_plugin",
    trustLevel: "internal",
    publicSdkSurface: "@platform/evaluator.core",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 5000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 8,
      maxQueuedInvocations: 16,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  })],
  ["plugin.core.basic-planner", PluginManifestSchema.parse({
    pluginId: "plugin.core.basic-planner",
    name: "Basic Planner",
    version: "1.0.0",
    owner: "platform-team",
    domainIds: [],
    capabilityIds: ["planning"],
    spiTypes: ["planner"],
    extensionKind: "domain_plugin",
    trustLevel: "internal",
    publicSdkSurface: "@platform/planner.core",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 5000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 4,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  })],
  ["plugin.shared.github_adapter", PluginManifestSchema.parse({
    pluginId: "plugin.shared.github_adapter",
    name: "GitHub Adapter",
    version: "1.0.0",
    owner: "platform-team",
    domainIds: [],
    capabilityIds: ["external.github", "external.github.issue", "external.github.workflow"],
    spiTypes: ["adapter"],
    extensionKind: "external_adapter",
    trustLevel: "trusted",
    publicSdkSurface: "@platform/adapter.github",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 10000,
      allowFilesystemWrite: false,
      allowNetworkEgress: true,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 2,
      maxQueuedInvocations: 4,
      runtimeIsolation: "forked_process",
      cooldownMs: 1000,
      allowedExternalDomains: ["api.github.com", "github.com"],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  })],
  ["plugin.operations.retriever", PluginManifestSchema.parse({
    pluginId: "plugin.operations.retriever",
    name: "Operations Retriever",
    version: "1.0.0",
    owner: "platform-team",
    domainIds: ["it-operations"],
    capabilityIds: ["ops_search"],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "internal",
    publicSdkSurface: "@platform/retriever.operations",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 5000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: ["ops"],
      maxConcurrentInvocations: 4,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  })],
  ["plugin.operations.presenter", PluginManifestSchema.parse({
    pluginId: "plugin.operations.presenter",
    name: "Operations Presenter",
    version: "1.0.0",
    owner: "platform-team",
    domainIds: ["it-operations"],
    capabilityIds: ["ops_formatting"],
    spiTypes: ["presenter"],
    extensionKind: "domain_plugin",
    trustLevel: "internal",
    publicSdkSurface: "@platform/presenter.operations",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 5000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 4,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  })],
  ["plugin.growth.retriever", PluginManifestSchema.parse({
    pluginId: "plugin.growth.retriever",
    name: "Growth Retriever",
    version: "1.0.0",
    owner: "platform-team",
    domainIds: ["growth"],
    capabilityIds: ["growth_search"],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "internal",
    publicSdkSurface: "@platform/retriever.growth",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 5000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: ["growth"],
      maxConcurrentInvocations: 4,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  })],
  ["plugin.growth.presenter", PluginManifestSchema.parse({
    pluginId: "plugin.growth.presenter",
    name: "Growth Presenter",
    version: "1.0.0",
    owner: "platform-team",
    domainIds: ["growth"],
    capabilityIds: ["growth_formatting"],
    spiTypes: ["presenter"],
    extensionKind: "domain_plugin",
    trustLevel: "internal",
    publicSdkSurface: "@platform/presenter.growth",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 5000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 4,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  })],
  ["plugin.growth.crm_adapter", PluginManifestSchema.parse({
    pluginId: "plugin.growth.crm_adapter",
    name: "CRM Adapter",
    version: "1.0.0",
    owner: "platform-team",
    domainIds: ["growth"],
    capabilityIds: ["crm_integration"],
    spiTypes: ["adapter"],
    extensionKind: "external_adapter",
    trustLevel: "trusted",
    publicSdkSurface: "@platform/adapter.crm",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 10000,
      allowFilesystemWrite: false,
      allowNetworkEgress: true,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 2,
      maxQueuedInvocations: 4,
      runtimeIsolation: "forked_process",
      cooldownMs: 1000,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  })],
  ["plugin.gamedev.retriever", PluginManifestSchema.parse({
    pluginId: "plugin.gamedev.retriever",
    name: "Game Dev Retriever",
    version: "1.0.0",
    owner: "platform-team",
    domainIds: ["game-dev"],
    capabilityIds: ["gamedev_search"],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "internal",
    publicSdkSurface: "@platform/retriever.gamedev",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 5000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: ["gamedev"],
      maxConcurrentInvocations: 4,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  })],
  ["plugin.gamedev.unity_adapter", PluginManifestSchema.parse({
    pluginId: "plugin.gamedev.unity_adapter",
    name: "Unity Adapter",
    version: "1.0.0",
    owner: "platform-team",
    domainIds: ["game-dev"],
    capabilityIds: ["unity_integration"],
    spiTypes: ["adapter"],
    extensionKind: "external_adapter",
    trustLevel: "trusted",
    publicSdkSurface: "@platform/adapter.unity",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 10000,
      allowFilesystemWrite: false,
      allowNetworkEgress: true,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 2,
      maxQueuedInvocations: 4,
      runtimeIsolation: "forked_process",
      cooldownMs: 1000,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  })],
  ["plugin.assetproduction.retriever", PluginManifestSchema.parse({
    pluginId: "plugin.assetproduction.retriever",
    name: "Asset Production Retriever",
    version: "1.0.0",
    owner: "platform-team",
    domainIds: ["asset-production"],
    capabilityIds: ["asset_search"],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "internal",
    publicSdkSurface: "@platform/retriever.assetproduction",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 5000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: ["assets"],
      maxConcurrentInvocations: 4,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  })],
  ["plugin.assetproduction.figma_adapter", PluginManifestSchema.parse({
    pluginId: "plugin.assetproduction.figma_adapter",
    name: "Figma Adapter",
    version: "1.0.0",
    owner: "platform-team",
    domainIds: ["asset-production"],
    capabilityIds: ["figma_integration"],
    spiTypes: ["adapter"],
    extensionKind: "external_adapter",
    trustLevel: "trusted",
    publicSdkSurface: "@platform/adapter.figma",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 10000,
      allowFilesystemWrite: false,
      allowNetworkEgress: true,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 2,
      maxQueuedInvocations: 4,
      runtimeIsolation: "forked_process",
      cooldownMs: 1000,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  })],
  ["plugin.livestream.retriever", PluginManifestSchema.parse({
    pluginId: "plugin.livestream.retriever",
    name: "Livestream Retriever",
    version: "1.0.0",
    owner: "platform-team",
    domainIds: ["livestream"],
    capabilityIds: ["livestream_search"],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "internal",
    publicSdkSurface: "@platform/retriever.livestream",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 5000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: ["livestream"],
      maxConcurrentInvocations: 4,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  })],
  ["plugin.livestream.obs_adapter", PluginManifestSchema.parse({
    pluginId: "plugin.livestream.obs_adapter",
    name: "OBS Adapter",
    version: "1.0.0",
    owner: "platform-team",
    domainIds: ["livestream"],
    capabilityIds: ["obs_integration"],
    spiTypes: ["adapter"],
    extensionKind: "external_adapter",
    trustLevel: "trusted",
    publicSdkSurface: "@platform/adapter.obs",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 10000,
      allowFilesystemWrite: false,
      allowNetworkEgress: true,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 2,
      maxQueuedInvocations: 4,
      runtimeIsolation: "forked_process",
      cooldownMs: 1000,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  })],
]);

function normalizeManifest(manifest: PluginManifest): PluginManifest {
  if (manifest.publicSdkSurface.startsWith("@automatic-agent/")) {
    return manifest;
  }
  return {
    ...manifest,
    publicSdkSurface: manifest.publicSdkSurface.replace(/^@platform\//, "@automatic-agent/"),
  };
}

/**
 * R8-24 FIX: Get the PluginManifest for a built-in plugin.
 */
export function getBuiltinPluginManifest(pluginId: string): PluginManifest | null {
  const manifest = BUILTIN_PLUGIN_MANIFESTS.get(pluginId);
  return manifest ? normalizeManifest(manifest) : null;
}

/**
 * R8-24 FIX: List all built-in plugin manifests.
 */
export function listBuiltinPluginManifests(): readonly PluginManifest[] {
  return [...BUILTIN_PLUGIN_MANIFESTS.values()].map((manifest) => normalizeManifest(manifest));
}

export function createBuiltinPlugin(pluginId: string): RegisteredPlugin | null {
  return BUILTIN_PLUGIN_FACTORIES.get(pluginId)?.() ?? null;
}

/**
 * R8-24 FIX: Create a built-in plugin with its manifest attached.
 */
export function createBuiltinPluginWithManifest(pluginId: string): (RegisteredPlugin & { manifest: PluginManifest }) | null {
  const plugin = createBuiltinPlugin(pluginId);
  const manifest = BUILTIN_PLUGIN_MANIFESTS.get(pluginId);
  if (plugin === null || manifest === undefined) {
    return null;
  }
  return {
    ...plugin,
    manifest,
  };
}

export function hasBuiltinPlugin(pluginId: string): boolean {
  return BUILTIN_PLUGIN_FACTORIES.has(pluginId);
}

export function listBuiltinPluginIds(): string[] {
  return [...BUILTIN_PLUGIN_FACTORIES.keys()];
}

/**
 * R2-5: Get the global plugin taint tracker for DataTaintPropagation integration
 */
export function getPluginTaintTracker(): PluginTaintTracker {
  return globalPluginTaintTracker;
}

/**
 * R2-5: Record taint propagation when a plugin processes data
 */
export function recordPluginTaint(input: {
  pluginId: string;
  inputDataClasses: readonly string[];
  outputDataClass: string;
  inputTaintLabels?: readonly DataTaintLabel[];
  description?: string;
}): import("../platform/five-plane-state-evidence/truth/data-taint-propagation.js").DataTaintPropagationRecord {
  return globalPluginTaintTracker.recordPluginTaintPropagation(input);
}

/**
 * R2-9: BundleRevocationSeverity - severity levels for plugin bundle revocation
 */
export enum BundleRevocationSeverity {
  INFO = "info",
  WARNING = "warning",
  MODERATE = "moderate",
  SEVERE = "severe",
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}

export interface BundleRevocationRecord {
  bundleId: string;
  severity: BundleRevocationSeverity;
  reason: string;
  affectedPluginIds: readonly string[];
  revokedAt: string;
  deadline: string;
  metadata?: Record<string, unknown>;
}

class BundleRevocationRegistry {
  private readonly revocations = new Map<string, BundleRevocationRecord[]>();

  public registerRevocation(record: BundleRevocationRecord): void {
    const existing = this.revocations.get(record.bundleId) ?? [];
    this.revocations.set(record.bundleId, [...existing, record]);
  }

  public getRevocations(bundleId: string): readonly BundleRevocationRecord[] {
    return this.revocations.get(bundleId) ?? [];
  }

  public isRevoked(bundleId: string, asOfDate: Date = new Date()): boolean {
    const records = this.revocations.get(bundleId) ?? [];
    return records.some((r) => new Date(r.deadline) <= asOfDate);
  }

  public getActiveRevocation(bundleId: string): BundleRevocationRecord | null {
    const records = this.revocations.get(bundleId) ?? [];
    const now = new Date();
    return records.find((r) => new Date(r.deadline) > now) ?? null;
  }
}

const globalRevocationRegistry = new BundleRevocationRegistry();

export function registerBundleRevocation(record: BundleRevocationRecord): void {
  globalRevocationRegistry.registerRevocation(record);
}

export function isBundleRevoked(bundleId: string, asOfDate?: Date): boolean {
  return globalRevocationRegistry.isRevoked(bundleId, asOfDate);
}

export function getBundleRevocation(bundleId: string): BundleRevocationRecord | null {
  return globalRevocationRegistry.getActiveRevocation(bundleId);
}

export interface PluginRevocationRecord {
  pluginId: string;
  severity: BundleRevocationSeverity;
  reason: string;
  affectedVersions: readonly string[];
  revokedAt: string;
}

export interface MarketplacePluginEntry {
  pluginId: string;
  name: string;
  version: string;
  owner: string;
  trustLevel: "verified" | "community" | "certified" | "trusted" | "internal" | "unverified";
  source: string;
}

export interface DynamicPluginLoader {
  supportsSource(source: string): boolean;
  loadFromSource(source: string): Promise<RegisteredPlugin | null> | RegisteredPlugin | null;
}

const pluginRevocations = new Map<string, PluginRevocationRecord>();
const dataTaintIndex = new Map<string, DataTaintLabel[]>();

export function revokePluginBundle(
  pluginId: string,
  severity: BundleRevocationSeverity,
  reason: string,
  affectedVersions: readonly string[] = ["*"],
): PluginRevocationRecord {
  const record: PluginRevocationRecord = {
    pluginId,
    severity,
    reason,
    affectedVersions: [...affectedVersions],
    revokedAt: nowIso(),
  };
  pluginRevocations.set(pluginId, record);
  return record;
}

export function getPluginRevocationStatus(pluginId: string): PluginRevocationRecord | null {
  return pluginRevocations.get(pluginId) ?? null;
}

export function isPluginRevoked(pluginId: string): boolean {
  return pluginRevocations.has(pluginId);
}

export function listRevokedPlugins(): PluginRevocationRecord[] {
  return [...pluginRevocations.values()];
}

export function removePluginRevocation(pluginId: string): boolean {
  return pluginRevocations.delete(pluginId);
}

export function propagateDataTaint(
  dataId: string,
  originPluginId: string,
  labels: readonly string[],
): { originPluginId: string; originatingDataId: string; labels: DataTaintLabel[] } {
  const propagatedLabels: DataTaintLabel[] = labels.map((label) => ({
    label,
    severity: "medium",
    sourcePluginId: originPluginId,
    propagatedAt: nowIso(),
    propagationChain: [dataId],
  }));
  const existing = dataTaintIndex.get(dataId) ?? [];
  dataTaintIndex.set(dataId, [...existing, ...propagatedLabels]);
  return {
    originPluginId,
    originatingDataId: dataId,
    labels: propagatedLabels,
  };
}

export function getDataTaintLabels(dataId: string): DataTaintLabel[] {
  return [...(dataTaintIndex.get(dataId) ?? [])];
}

export function hasDataTaintLabel(dataId: string, label: string): boolean {
  return getDataTaintLabels(dataId).some((item) => item.label === label);
}

export class PluginMarketplaceRegistry {
  private readonly loaders = new Map<string, DynamicPluginLoader>();
  private readonly entries = new Map<string, MarketplacePluginEntry>();
  private readonly sessions = new Set<string>();

  registerLoader(scheme: string, loader: DynamicPluginLoader): void {
    this.loaders.set(scheme, loader);
  }

  registerMarketplaceEntry(entry: MarketplacePluginEntry): void {
    this.entries.set(entry.pluginId, entry);
  }

  hasMarketplacePlugin(pluginId: string): boolean {
    return this.entries.has(pluginId);
  }

  getMarketplaceEntry(pluginId: string): MarketplacePluginEntry | null {
    return this.entries.get(pluginId) ?? null;
  }

  listMarketplacePlugins(): MarketplacePluginEntry[] {
    return [...this.entries.values()];
  }

  async authenticate(_marketplaceUrl: string, credentials: { apiKey?: string }): Promise<string> {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey) {
      throw new Error("Marketplace API key is required");
    }
    const sessionToken = `session_${newId("marketplace")}`;
    this.sessions.add(sessionToken);
    return sessionToken;
  }

  isAuthenticated(sessionToken: string): boolean {
    return this.sessions.has(sessionToken);
  }

  async loadPlugin(pluginId: string, source: string, sessionToken?: string): Promise<RegisteredPlugin | null> {
    const entry = this.entries.get(pluginId);
    if (!entry) {
      return null;
    }
    if (!sessionToken || !this.isAuthenticated(sessionToken)) {
      throw new Error("Authentication required to load marketplace plugin");
    }
    const loader = [...this.loaders.values()].find((candidate) => candidate.supportsSource(source));
    if (!loader) {
      return null;
    }
    return loader.loadFromSource(source);
  }
}

const globalMarketplaceRegistry = new PluginMarketplaceRegistry();

export function getMarketplaceRegistry(): PluginMarketplaceRegistry {
  return globalMarketplaceRegistry;
}
