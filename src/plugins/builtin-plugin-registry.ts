import type { RegisteredPlugin } from "../domains/registry/plugin-spi.js";
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
    const result = this.taintService.computePropagation({
      sourceObjectType: "ToolOutput",
      sourceObjectId: newId("plugin_taint"),
      inputDataClasses: input.inputDataClasses as import("../platform/five-plane-state-evidence/truth/data-taint-propagation.js").DataClassificationLevel[],
      inputTaintLabels: input.inputTaintLabels,
      sourcePluginId: input.pluginId,
      description: input.description ?? `Plugin ${input.pluginId} execution output`,
    });

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

export function createBuiltinPlugin(pluginId: string): RegisteredPlugin | null {
  return BUILTIN_PLUGIN_FACTORIES.get(pluginId)?.() ?? null;
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
