/**
 * HierarchicalPromptRegistryService
 *
 * Implements a hierarchical prompt registry with lookup precedence:
 * global → domain → pack → task-type
 *
 * Each level can override prompts from higher levels, enabling:
 * - Global defaults with domain overrides
 * - Pack-specific customizations
 * - Task-type specific prompts
 */

import { ValidationError } from "../../contracts/errors.js";
import { nowIso } from "../../contracts/types/ids.js";
import type {
  PromptBundle,
  PromptBundleConstraints,
  PromptBundleListResult,
  PromptBundleMetadata,
  PromptBundleRegistrationInput,
  PromptBundleSegment,
  PromptBundleVersion,
} from "../../contracts/prompt-bundle/index.js";
import type * as PromptBundleContracts from "../../contracts/prompt-bundle/index.js";

export interface HierarchicalPromptRegistryConfig {
  enableVersioning: boolean;
  enableTrafficSplit: boolean;
  defaultMaxTokens?: number;
  defaultTemperature?: number;
}

const DEFAULT_CONFIG: HierarchicalPromptRegistryConfig = {
  enableVersioning: true,
  enableTrafficSplit: true,
  defaultMaxTokens: 4096,
  defaultTemperature: 0.7,
};

interface RegistryEntry {
  bundle: PromptBundle;
  deprecated: boolean;
}

interface VersionEntry {
  bundle: PromptBundle;
  isDefault: boolean;
  trafficWeight: number;
}

type RegistryLevel = "global" | "domain" | "pack" | "task-type";

export class HierarchicalPromptRegistryService {
  // global → domain → pack → task-type hierarchy
  private readonly globalBundles = new Map<string, PromptBundle>();
  private readonly domainBundles = new Map<string, Map<string, PromptBundle>>();
  private readonly packBundles = new Map<string, Map<string, PromptBundle>>();
  private readonly taskTypeBundles = new Map<string, Map<string, Map<string, PromptBundle>>>();
  private readonly versionsByName = new Map<string, Map<string, PromptBundle>>();
  private readonly versionsByScope = new Map<string, Map<number, PromptBundle>>();

  private readonly config: HierarchicalPromptRegistryConfig;

  public constructor(config: Partial<HierarchicalPromptRegistryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Registers a new prompt bundle at the specified level.
   * §16.4: Validates compatibility matrix before registration.
   */
  public registerBundle(
    input: PromptBundleRegistrationInput,
    level: RegistryLevel,
    domain?: string,
    packId?: string,
  ): PromptBundle {
    this.validateRegistrationInput(input);

    // §16.4 FIX: Validate compatibility matrix before registration
    this.validateBundleCompatibilityMatrix(input.compatibilityMatrix);

    const bundleId = this.buildBundleId(input, level, domain, packId);
    const bundle: PromptBundle = {
      bundleId,
      name: input.name,
      version: input.version,
      displayVersion: input.displayVersion,
      domain: domain ?? input.domain,
      taskType: input.taskType,
      packId: packId ?? input.packId,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      fewShotExamples: input.fewShotExamples ?? [],
      constraints: this.normalizeConstraints(input.constraints),
      compatibilityMatrix: input.compatibilityMatrix,
      metadata: this.buildMetadata(input),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    this.storeBundle(bundle, level, domain, packId);
    this.storeVersion(bundle, level, domain, packId);
    return bundle;
  }

  /**
   * Retrieves a prompt bundle with hierarchical lookup.
   * Looks up in order: task-type → pack → domain → global
   */
  public getBundle(
    name: string,
    taskType: string,
    packId?: string,
    domain?: string,
  ): PromptBundle | null {
    // Try task-type level first
    if (packId && domain) {
      const taskTypeEntry = this.taskTypeBundles.get(packId)?.get(taskType)?.get(name);
      if (taskTypeEntry && !taskTypeEntry.metadata.deprecated) {
        return taskTypeEntry;
      }
    }

    // Try pack level
    if (packId) {
      const packEntry = this.packBundles.get(packId)?.get(name);
      if (packEntry && !packEntry.metadata.deprecated) {
        return packEntry;
      }
    }

    // Try domain level
    if (domain) {
      const domainEntry = this.domainBundles.get(domain)?.get(name);
      if (domainEntry) {
        if (domainEntry.metadata.deprecated) {
          return null;
        }
        return domainEntry;
      }
    }

    // Fall back to global
    const globalEntry = this.globalBundles.get(name);
    if (globalEntry && !globalEntry.metadata.deprecated) {
      return globalEntry;
    }

    return null;
  }

  /**
   * Lists all versions of a bundle across all levels.
   */
  public listBundleVersions(name: string): PromptBundleVersion[] {
    const bundles = [...(this.versionsByName.get(name)?.values() ?? [])];
    return bundles
      .map((bundle) => ({
        version: bundle.version,
        displayVersion: bundle.displayVersion,
        isCurrent: bundle.metadata.deprecated !== true,
        isDefault: bundle.metadata.trafficAllocation.weight === 100,
        trafficWeight: bundle.metadata.trafficAllocation.weight,
        createdAt: bundle.createdAt,
        deprecated: bundle.metadata.deprecated,
      }))
      .sort((a, b) => b.version - a.version);
  }

  /**
   * Lists all bundles, optionally filtered by level.
   */
  public listBundles(level?: RegistryLevel, domain?: string, packId?: string): PromptBundleListResult[] {
    const results: PromptBundleListResult[] = [];
    const seen = new Set<string>();

    const addFromMap = (map: Map<string, PromptBundle>) => {
      for (const bundle of map.values()) {
        if (seen.has(bundle.bundleId)) continue;
        if (bundle.metadata.deprecated) continue;
        seen.add(bundle.bundleId);
        results.push(this.buildListResult(bundle));
      }
    };

    if (!level || level === "global") {
      addFromMap(this.globalBundles);
    }

    if ((!level || level === "domain") && domain) {
      const domainMap = this.domainBundles.get(domain);
      if (domainMap) addFromMap(domainMap);
    }

    if ((!level || level === "pack") && packId) {
      const packMap = this.packBundles.get(packId);
      if (packMap) addFromMap(packMap);
    }

    return results;
  }

  /**
   * Deprecates a specific version of a bundle.
   */
  public deprecateBundle(
    name: string,
    version: number,
    level: RegistryLevel,
    domain?: string,
    packId?: string,
  ): void {
    const bundle = this.findBundle(name, version, level, domain, packId);
    if (!bundle) {
      throw new ValidationError(
        "prompt_bundle.not_found",
        `Prompt bundle ${name}@${version} not found at ${level} level`,
      );
    }

    // §58: Do not directly mutate "immutable" snapshot objects (issue #1955).
    // Create a new object instead of mutating the existing bundle's metadata.
    // R2-8 FIX: Set both deprecated flag AND lifecycleStatus per §20.6
    const updatedBundle: PromptBundle = {
      ...bundle,
      metadata: {
        ...bundle.metadata,
        deprecated: true,
        lifecycleStatus: "deprecated",
      },
      updatedAt: nowIso(),
    };
    this.storeVersion(updatedBundle, level, domain, packId);
    this.refreshScopeBundle(level, updatedBundle.name, updatedBundle.taskType, domain ?? updatedBundle.domain, packId ?? updatedBundle.packId);
  }

  public removeBundle(
    name: string,
    version: number,
    level: RegistryLevel,
    domain?: string,
    packId?: string,
  ): boolean {
    const scopeKey = this.buildScopeKey(name, level, level === "task-type" ? domain : undefined, domain, packId);
    const removedFromScope = this.versionsByScope.get(scopeKey)?.delete(version) ?? false;
    const versions = this.versionsByName.get(name);
    if (versions) {
      for (const [bundleId, bundle] of versions.entries()) {
        if (bundle.version === version) {
          versions.delete(bundleId);
        }
      }
    }
    this.refreshScopeBundle(level, name, undefined, domain, packId);
    return removedFromScope;
  }

  /**
   * Gets the resolved prompt bundle considering traffic allocation.
   * Used for A/B testing scenarios.
   * R16-15 FIX: Incorporates runVersionLock to ensure consistent bundle selection per run.
   */
  public resolveBundleForTraffic(
    name: string,
    taskType: string,
    packId?: string,
    domain?: string,
    trafficKey?: string,
    runVersionLock?: { runVersionLockId: string } | null,
  ): PromptBundle | null {
    const candidates = this.getResolvedScopeBundles(name, taskType, packId, domain);
    if (candidates.length === 0) {
      return null;
    }

    if (!this.config.enableTrafficSplit || candidates.length === 1) {
      return this.selectDefaultBundle(candidates);
    }

    const activeCandidates = candidates.filter((bundle) => this.isBundleTrafficActive(bundle));
    const eligible = activeCandidates.length > 0 ? activeCandidates : candidates;
    // §16.2: Normalize weights so they sum to 100, preventing slots above total from永不匹配
    const rawWeights = eligible.map((bundle) => Math.max(0, bundle.metadata.trafficAllocation.weight));
    const totalWeight = rawWeights.reduce((sum, w) => sum + w, 0);
    if (totalWeight <= 0) {
      return this.selectDefaultBundle(eligible);
    }

    const normalizedWeights = rawWeights.map((w) => (w / totalWeight) * 100);
    const slot = this.computeTrafficSlot(trafficKey ?? `${name}:${taskType}:${packId ?? ""}:${domain ?? ""}`, runVersionLock);
    let cursor = 0;
    for (let i = 0; i < eligible.length; i++) {
      cursor += normalizedWeights[i]!;
      if (slot < cursor) {
        return eligible[i]!;
      }
    }
    return this.selectDefaultBundle(eligible);
  }

  private buildBundleId(
    input: PromptBundleRegistrationInput,
    level: RegistryLevel,
    domain?: string,
    packId?: string,
  ): string {
    const parts: string[] = [level];
    if (domain) parts.push(domain);
    if (packId) parts.push(packId);
    parts.push(input.name);
    parts.push(String(input.version));
    return parts.join(":");
  }

  private validateRegistrationInput(input: PromptBundleRegistrationInput): void {
    if (!input.name?.trim()) {
      throw new ValidationError("prompt_bundle.invalid_name", "Bundle name must be non-empty");
    }
    if (!Number.isInteger(input.version) || input.version <= 0) {
      throw new ValidationError("prompt_bundle.invalid_version", "Bundle version must be a positive integer");
    }
    if (!input.domain?.trim()) {
      throw new ValidationError("prompt_bundle.invalid_domain", "Bundle domain must be non-empty");
    }
    if (!input.taskType?.trim()) {
      throw new ValidationError("prompt_bundle.invalid_task_type", "Bundle taskType must be non-empty");
    }
    if (!input.systemPrompt?.content?.trim()) {
      throw new ValidationError("prompt_bundle.invalid_system_prompt", "System prompt content must be non-empty");
    }
  }

  /**
   * §16.4 FIX: Validates compatibility matrix covers all required dimensions.
   * Raises ValidationError if any required matrix dimension is missing or empty.
   */
  private validateBundleCompatibilityMatrix(matrix: PromptBundleContracts.PromptBundleCompatibilityMatrix): void {
    if (!matrix.toolSchemaVersions || matrix.toolSchemaVersions.length === 0) {
      throw new ValidationError(
        "prompt_bundle.missing_compatibility_matrix",
        "compatibilityMatrix.toolSchemaVersions is required per §16.4",
      );
    }
    if (!matrix.evaluatorSchemaVersions || matrix.evaluatorSchemaVersions.length === 0) {
      throw new ValidationError(
        "prompt_bundle.missing_compatibility_matrix",
        "compatibilityMatrix.evaluatorSchemaVersions is required per §16.4",
      );
    }
    if (!matrix.domainDescriptorVersions || matrix.domainDescriptorVersions.length === 0) {
      throw new ValidationError(
        "prompt_bundle.missing_compatibility_matrix",
        "compatibilityMatrix.domainDescriptorVersions is required per §16.4",
      );
    }
    if (!matrix.modelRoutingProfiles || matrix.modelRoutingProfiles.length === 0) {
      throw new ValidationError(
        "prompt_bundle.missing_compatibility_matrix",
        "compatibilityMatrix.modelRoutingProfiles is required per §16.4",
      );
    }
  }

  private normalizeConstraints(input?: PromptBundleConstraints): PromptBundleConstraints {
    if (!input) {
      return {
        maxTokens: this.config.defaultMaxTokens,
        temperature: this.config.defaultTemperature,
        topP: undefined,
        stopSequences: undefined,
        responseFormat: undefined,
        customConstraints: {},
      };
    }

    return {
      maxTokens: input.maxTokens,
      temperature: input.temperature,
      topP: input.topP,
      stopSequences: input.stopSequences,
      responseFormat: input.responseFormat,
      customConstraints: input.customConstraints ?? {},
    };
  }

  private buildMetadata(input: PromptBundleRegistrationInput): PromptBundleMetadata {
    return {
      owner: input.metadata?.owner ?? "system",
      deprecated: input.metadata?.deprecated ?? false,
      lifecycleStatus: input.metadata?.lifecycleStatus
        ?? (input.metadata?.deprecated ? "deprecated" : "active"),
      tags: input.metadata?.tags ?? [],
      compatibilityTags: input.metadata?.compatibilityTags ?? [],
      trafficAllocation: input.metadata?.trafficAllocation ?? {
        weight: 100,
        startTime: undefined,
        endTime: undefined,
        targeting: undefined,
      },
    };
  }

  private storeBundle(bundle: PromptBundle, level: RegistryLevel, domain?: string, packId?: string): void {
    switch (level) {
      case "global":
        this.globalBundles.set(bundle.name, bundle);
        break;
      case "domain":
        if (!domain) throw new ValidationError("prompt_bundle.missing_domain", "Domain required for domain-level registration");
        if (!this.domainBundles.has(domain)) {
          this.domainBundles.set(domain, new Map());
        }
        this.domainBundles.get(domain)!.set(bundle.name, bundle);
        break;
      case "pack":
        if (!packId) throw new ValidationError("prompt_bundle.missing_pack_id", "PackId required for pack-level registration");
        if (!this.packBundles.has(packId)) {
          this.packBundles.set(packId, new Map());
        }
        this.packBundles.get(packId)!.set(bundle.name, bundle);
        break;
      case "task-type":
        if (!packId || !domain) {
          throw new ValidationError("prompt_bundle.missing_context", "PackId and domain required for task-type level registration");
        }
        if (!this.taskTypeBundles.has(packId)) {
          this.taskTypeBundles.set(packId, new Map());
        }
        if (!this.taskTypeBundles.get(packId)!.has(bundle.taskType)) {
          this.taskTypeBundles.get(packId)!.set(bundle.taskType, new Map());
        }
        this.taskTypeBundles.get(packId)!.get(bundle.taskType)!.set(bundle.name, bundle);
        break;
    }
  }

  private storeVersion(bundle: PromptBundle, level: RegistryLevel, domain?: string, packId?: string): void {
    if (!this.versionsByName.has(bundle.name)) {
      this.versionsByName.set(bundle.name, new Map());
    }
    this.versionsByName.get(bundle.name)!.set(bundle.bundleId, bundle);

    const scopeKey = this.buildScopeKey(bundle.name, level, bundle.taskType, domain ?? bundle.domain, packId ?? bundle.packId);
    if (!this.versionsByScope.has(scopeKey)) {
      this.versionsByScope.set(scopeKey, new Map());
    }
    this.versionsByScope.get(scopeKey)!.set(bundle.version, bundle);
  }

  private findBundle(
    name: string,
    version: number,
    level: RegistryLevel,
    domain?: string,
    packId?: string,
  ): PromptBundle | null {
    const scopeKey = this.buildScopeKey(name, level, undefined, domain, packId);
    const scopeBundles = this.versionsByScope.get(scopeKey);
    if (!scopeBundles) {
      return null;
    }
    // R16-16 FIX: Respect version parameter when deprecating — only mark the exact version
    const bundle = scopeBundles.get(version);
    return bundle && !bundle.metadata.deprecated ? bundle : null;
  }

  private buildListResult(bundle: PromptBundle): PromptBundleListResult {
    return {
      bundle,
      availableVersions: this.listBundleVersions(bundle.name),
      currentVersion: bundle.displayVersion,
    };
  }

  private getResolvedScopeBundles(
    name: string,
    taskType: string,
    packId?: string,
    domain?: string,
  ): PromptBundle[] {
    const scopeKeys: string[] = [];
    if (packId && domain) {
      scopeKeys.push(this.buildScopeKey(name, "task-type", taskType, domain, packId));
    }
    if (packId) {
      scopeKeys.push(this.buildScopeKey(name, "pack", undefined, domain, packId));
    }
    if (domain) {
      scopeKeys.push(this.buildScopeKey(name, "domain", undefined, domain, undefined));
    }
    scopeKeys.push(this.buildScopeKey(name, "global", undefined, domain, undefined));

    for (const scopeKey of scopeKeys) {
      const bundles = [...(this.versionsByScope.get(scopeKey)?.values() ?? [])]
        .filter((bundle) => bundle.metadata.deprecated !== true)
        .sort((left, right) => {
          const createdAtOrder = right.createdAt.localeCompare(left.createdAt);
          if (createdAtOrder !== 0) {
            return createdAtOrder;
          }
          return right.version - left.version;
        });
      if (bundles.length > 0) {
        return bundles;
      }
    }
    return [];
  }

  private buildScopeKey(
    name: string,
    level: RegistryLevel,
    taskType?: string,
    domain?: string,
    packId?: string,
  ): string {
    switch (level) {
      case "global":
        return [level, name].join(":");
      case "domain":
        return [level, domain ?? "", name].join(":");
      case "pack":
        return [level, packId ?? "", name].join(":");
      case "task-type":
        return [level, domain ?? "", packId ?? "", taskType ?? "", name].join(":");
    }
  }

  private selectDefaultBundle(bundles: readonly PromptBundle[]): PromptBundle | null {
    const eligible = bundles
      .filter((bundle) => bundle.metadata.deprecated !== true)
      .sort((left, right) => {
        const weightOrder = right.metadata.trafficAllocation.weight - left.metadata.trafficAllocation.weight;
        if (weightOrder !== 0) {
          return weightOrder;
        }
        const createdAtOrder = right.createdAt.localeCompare(left.createdAt);
        if (createdAtOrder !== 0) {
          return createdAtOrder;
        }
        return right.version - left.version;
      });
    return eligible[0] ?? null;
  }

  private computeTrafficSlot(key: string, runVersionLock?: { runVersionLockId: string } | null): number {
    let hash = 0;
    // R16-15 FIX: Include runVersionLock in hash for consistent bundle selection per run
    const effectiveKey = runVersionLock ? `${key}:${runVersionLock.runVersionLockId}` : key;
    for (const char of effectiveKey) {
      hash = ((hash << 5) - hash + char.charCodeAt(0)) >>> 0;
    }
    return hash % 100;
  }

  private isBundleTrafficActive(bundle: PromptBundle, now: Date = new Date()): boolean {
    const allocation = bundle.metadata.trafficAllocation;
    if (allocation.startTime != null && Date.parse(allocation.startTime) > now.getTime()) {
      return false;
    }
    if (allocation.endTime != null && Date.parse(allocation.endTime) < now.getTime()) {
      return false;
    }
    return allocation.weight > 0;
  }

  private findCurrentScopeBundle(scopeKey: string): PromptBundle | null {
    return this.selectDefaultBundle([...(this.versionsByScope.get(scopeKey)?.values() ?? [])]);
  }

  private refreshScopeBundle(
    level: RegistryLevel,
    name: string,
    taskType?: string,
    domain?: string,
    packId?: string,
  ): void {
    const scopeKey = this.buildScopeKey(name, level, taskType, domain, packId);
    const current = this.findCurrentScopeBundle(scopeKey);
    switch (level) {
      case "global":
        if (current == null) {
          this.globalBundles.delete(name);
        } else {
          this.globalBundles.set(name, current);
        }
        break;
      case "domain": {
        const key = domain ?? "";
        const scope = this.domainBundles.get(key);
        if (scope == null) {
          break;
        }
        if (current == null) {
          scope.delete(name);
        } else {
          scope.set(name, current);
        }
        if (scope.size === 0) {
          this.domainBundles.delete(key);
        }
        break;
      }
      case "pack": {
        const key = packId ?? "";
        const scope = this.packBundles.get(key);
        if (scope == null) {
          break;
        }
        if (current == null) {
          scope.delete(name);
        } else {
          scope.set(name, current);
        }
        if (scope.size === 0) {
          this.packBundles.delete(key);
        }
        break;
      }
      case "task-type": {
        const packKey = packId ?? "";
        const typeKey = taskType ?? "";
        const packScope = this.taskTypeBundles.get(packKey);
        const typeScope = packScope?.get(typeKey);
        if (typeScope == null) {
          break;
        }
        if (current == null) {
          typeScope.delete(name);
        } else {
          typeScope.set(name, current);
        }
        if (typeScope.size === 0) {
          packScope?.delete(typeKey);
        }
        if (packScope?.size === 0) {
          this.taskTypeBundles.delete(packKey);
        }
        break;
      }
    }
  }
}
