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

  private readonly config: HierarchicalPromptRegistryConfig;

  public constructor(config: Partial<HierarchicalPromptRegistryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Registers a new prompt bundle at the specified level.
   */
  public registerBundle(
    input: PromptBundleRegistrationInput,
    level: RegistryLevel,
    domain?: string,
    packId?: string,
  ): PromptBundle {
    this.validateRegistrationInput(input);

    const bundleId = this.buildBundleId(input, level, domain, packId);
    const bundle: PromptBundle = {
      bundleId,
      name: input.name,
      version: input.version,
      domain: domain ?? input.domain,
      taskType: input.taskType,
      packId: packId ?? input.packId,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      fewShotExamples: input.fewShotExamples ?? [],
      constraints: this.normalizeConstraints(input.constraints),
      metadata: this.buildMetadata(input),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    this.storeBundle(bundle, level, domain, packId);
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
      if (domainEntry && !domainEntry.metadata.deprecated) {
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
    const versions: PromptBundleVersion[] = [];

    // Global versions
    for (const [version, bundle] of this.globalBundles.entries()) {
      if (bundle.name === name) {
        versions.push({
          version,
          isCurrent: version === bundle.version,
          isDefault: bundle.metadata.trafficAllocation.weight === 100,
          trafficWeight: bundle.metadata.trafficAllocation.weight,
          createdAt: bundle.createdAt,
          deprecated: bundle.metadata.deprecated,
        });
      }
    }

    return versions.sort((a, b) => a.version.localeCompare(b.version));
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
    version: string,
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

    bundle.metadata.deprecated = true;
    bundle.updatedAt = nowIso();
  }

  /**
   * Gets the resolved prompt bundle considering traffic allocation.
   * Used for A/B testing scenarios.
   */
  public resolveBundleForTraffic(
    name: string,
    taskType: string,
    packId?: string,
    domain?: string,
  ): PromptBundle | null {
    const candidate = this.getBundle(name, taskType, packId, domain);
    if (!candidate) return null;

    // If versioning disabled or single version, return as-is
    if (!this.config.enableTrafficSplit) {
      return candidate;
    }

    // For now, return the candidate as-is
    // Traffic split logic would be implemented here based on traffic allocation config
    return candidate;
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
    parts.push(input.version);
    return parts.join(":");
  }

  private validateRegistrationInput(input: PromptBundleRegistrationInput): void {
    if (!input.name?.trim()) {
      throw new ValidationError("prompt_bundle.invalid_name", "Bundle name must be non-empty");
    }
    if (!input.version?.trim()) {
      throw new ValidationError("prompt_bundle.invalid_version", "Bundle version must be non-empty");
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

  private findBundle(
    name: string,
    version: string,
    level: RegistryLevel,
    domain?: string,
    packId?: string,
  ): PromptBundle | null {
    switch (level) {
      case "global":
        return this.globalBundles.get(name) ?? null;
      case "domain":
        return domain ? this.domainBundles.get(domain)?.get(name) ?? null : null;
      case "pack":
        return packId ? this.packBundles.get(packId)?.get(name) ?? null : null;
      case "task-type":
        if (packId && domain) {
          return this.taskTypeBundles.get(packId)?.get(domain)?.get(name) ?? null;
        }
        return null;
    }
  }

  private buildListResult(bundle: PromptBundle): PromptBundleListResult {
    return {
      bundle,
      availableVersions: this.listBundleVersions(bundle.name),
      currentVersion: bundle.version,
    };
  }
}
