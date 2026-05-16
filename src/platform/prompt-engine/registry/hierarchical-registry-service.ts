/**
 * HierarchicalPromptRegistryService
 *
 * Implements a hierarchical prompt registry with lookup precedence:
 * global → domain → task-type
 *
 * Each level can override prompts from higher levels, enabling:
 * - Global defaults with domain overrides
 * - Task-type specific prompts
 */

import { ValidationError } from "../../contracts/errors.js";
import { nowIso } from "../../contracts/types/ids.js";
import {
  createPromptBundle,
  type PromptBundle,
  type PromptBundleConstraints,
  type PromptBundleListResult,
  type PromptBundleMetadata,
  type PromptBundleRegistrationInput,
  type PromptBundleSegment,
  type PromptBundleVersion,
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

/**
 * R23-48 fix: Hierarchical registry now uses 3 levels per spec:
 * global → domain → task-type (not 4 levels with pack as separate level).
 *
 * For backward compatibility, packId is still accepted but stored under domain.
 */
export class HierarchicalPromptRegistryService {
  // R23-48 fix: Consolidated to 3-level hierarchy: global → domain → task-type
  private readonly globalBundles = new Map<string, PromptBundle>();
  private readonly domainBundles = new Map<string, Map<string, PromptBundle>>();
  private readonly taskTypeBundles = new Map<string, Map<string, Map<string, PromptBundle>>>();
  private readonly versionsByName = new Map<string, Map<string, PromptBundle>>();
  private readonly versionsByScope = new Map<string, Map<string, PromptBundle>>();

  private readonly config: HierarchicalPromptRegistryConfig;

  public constructor(config: Partial<HierarchicalPromptRegistryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Registers a new prompt bundle at the specified level.
   * R23-48 fix: packId is deprecated, use domain instead. For backward compatibility,
   * if packId is provided with domain, bundles are stored at domain level.
   */
  public registerBundle(
    input: PromptBundleRegistrationInput,
    level: RegistryLevel,
    domain?: string,
    packId?: string,
  ): PromptBundle {
    const normalizedInput = this.normalizeRegistrationInput(input, domain, packId);
    const effectiveDomain = level === "pack"
      ? normalizedInput.domain
      : (domain ?? normalizedInput.domain);
    const effectivePackId = packId ?? normalizedInput.packId;
    const timestamp = nowIso();
    // Ensure displayVersion is provided (may come from input.version semver formatting)
    const displayVersion = normalizedInput.displayVersion
      ?? (typeof normalizedInput.version === "string" && normalizedInput.version.startsWith("v") ? normalizedInput.version : `v${normalizedInput.version}`);
    const bundle = createPromptBundle({
      ...normalizedInput,
      displayVersion,
      bundleId: this.buildBundleId(normalizedInput, level, effectiveDomain),
      domain: effectiveDomain ?? normalizedInput.domain,
      packId: effectivePackId,
      constraints: this.normalizeConstraints(normalizedInput.constraints),
      createdAt: timestamp,
      updatedAt: timestamp,
    }) as PromptBundle;

    this.storeBundle(bundle, level, effectiveDomain);
    this.storeVersion(bundle, level, effectiveDomain, effectivePackId);
    return bundle;
  }

  private normalizeRegistrationInput(
    input: PromptBundleRegistrationInput,
    domain?: string,
    packId?: string,
  ): PromptBundleRegistrationInput {
    const legacy = input as PromptBundleRegistrationInput & {
      prompts?: readonly { readonly role?: string; readonly content: string }[];
      variables?: readonly string[];
      trafficAllocation?: { readonly weight?: number };
    };
    const variables = [...(legacy.variables ?? [])];
    const systemPrompt = input.systemPrompt ?? {
      content: legacy.prompts?.find((prompt) => prompt.role === "system")?.content ?? legacy.prompts?.[0]?.content ?? "",
      templateVariables: variables,
      channel: "system" as const,
    };
    return {
      ...input,
      displayVersion: input.displayVersion ?? (typeof input.version === "string" ? input.version : `${input.version}.0.0`),
      domain: input.domain ?? domain ?? "global",
      taskType: input.taskType ?? "default",
      packId: input.packId ?? packId,
      systemPrompt,
      userPrompt: input.userPrompt,
      fewShotExamples: input.fewShotExamples ?? [],
      constraints: input.constraints,
      compatibilityMatrix: input.compatibilityMatrix ?? {
        toolSchemaVersions: [],
        evaluatorSchemaVersions: [],
        domainDescriptorVersions: [],
        modelRoutingProfiles: [],
      },
      metadata: {
        ...(input.metadata ?? {}),
        trafficAllocation: {
          weight: legacy.trafficAllocation?.weight ?? input.metadata?.trafficAllocation?.weight ?? 100,
          startTime: input.metadata?.trafficAllocation?.startTime,
          endTime: input.metadata?.trafficAllocation?.endTime,
          targeting: input.metadata?.trafficAllocation?.targeting,
        },
      } as PromptBundleMetadata,
    };
  }

  /**
   * Retrieves a prompt bundle with hierarchical lookup.
   * R23-48 fix: Looks up in order: task-type → domain → global (3-level hierarchy)
   */
  public getBundle(
    name: string,
    taskType: string,
    packId?: string,
    domain?: string,
  ): PromptBundle | null {
    // R23-48 fix: Normalize packId to domain for backward compatibility.
    // Prefer explicit domain so pack no longer becomes a standalone hierarchy level.
    const effectiveDomain = domain ?? packId;

    // Try task-type level first (uses domain as context)
    if (effectiveDomain) {
      const taskTypeEntry = this.taskTypeBundles.get(effectiveDomain)?.get(taskType)?.get(name);
      if (taskTypeEntry) {
        return taskTypeEntry.metadata.deprecated ? null : taskTypeEntry;
      }
    }

    // Try domain level
    if (effectiveDomain) {
      const domainEntry = this.domainBundles.get(effectiveDomain)?.get(name);
      if (domainEntry) {
        return domainEntry.metadata.deprecated ? null : domainEntry;
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
        lifecycleStatus: (bundle.metadata as { lifecycleStatus?: string }).lifecycleStatus as "draft" | "active" | "deprecated" | "archived" ?? "active",
      }))
      .sort((a, b) => b.version - a.version);
  }

  /**
   * Lists all bundles, optionally filtered by level.
   * R23-48 fix: Removed pack level, only supports global/domain/task-type
   */
  public listBundles(level?: RegistryLevel, domain?: string, _packId?: string): PromptBundleListResult[] {
    const results: PromptBundleListResult[] = [];
    const seen = new Set<string>();

    const addFromMap = (map: Map<string, PromptBundle>) => {
      for (const bundle of map.values()) {
        if (bundle.metadata.deprecated === true) continue;
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

    // R23-48 fix: Removed pack level listing (now handled via domain)

    return results;
  }

  /**
   * Deprecates a specific version of a bundle.
   */
  public deprecateBundle(
    name: string,
    version: string | number,
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

    const timestamp = nowIso();
    const newMetadata: PromptBundleMetadata = {
      ...bundle.metadata,
      deprecated: true,
      lifecycleStatus: "deprecated",
    };
    const newBundle: PromptBundle = {
      ...bundle,
      metadata: newMetadata,
      updatedAt: timestamp,
    };

    // Update all references to preserve immutability contract
    this.updateBundleReference(newBundle, level, domain ?? bundle.domain, packId ?? bundle.packId);
  }

  public removeBundle(
    name: string,
    version: string | number,
    level: RegistryLevel,
    domain?: string,
    packId?: string,
  ): boolean {
    const normalizedVersion = this.normalizeVersionKey(version);
    const effectiveDomain = domain ?? (level === "pack" ? packId : undefined);
    const removedFromScope = level === "task-type"
      ? this.removeTaskTypeVersion(name, normalizedVersion, effectiveDomain)
      : (this.versionsByScope.get(this.buildScopeKey(name, level, undefined, effectiveDomain, packId))?.delete(normalizedVersion) ?? false);
    const versions = this.versionsByName.get(name);
    if (versions) {
      for (const [bundleId, bundle] of versions.entries()) {
        if (this.normalizeVersionKey(bundle.version) === normalizedVersion) {
          versions.delete(bundleId);
        }
      }
    }
    return removedFromScope;
  }

  /**
   * Gets the resolved prompt bundle considering traffic allocation.
   * Used for A/B testing scenarios.
   * R16-15 fix: Added runVersion parameter to lock bundle selection for a given run,
   * ensuring consistent bundle assignment even if bundle configurations change mid-run.
   */
  public resolveBundleForTraffic(
    name: string,
    taskType: string,
    packId?: string,
    domain?: string,
    trafficKey?: string,
    runVersion?: string,
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
    const totalWeight = eligible.reduce((sum, bundle) => sum + Math.max(0, bundle.metadata.trafficAllocation.weight), 0);
    if (totalWeight <= 0) {
      return this.selectDefaultBundle(eligible);
    }

    // R16-15 fix: Incorporate runVersion into traffic key to lock bundle selection
    // When runVersion is provided, the same run will consistently get the same bundle
    // even if bundle configurations change mid-run
    const effectiveTrafficKey = runVersion != null
      ? `${trafficKey ?? `${name}:${taskType}:${packId ?? ""}:${domain ?? ""}`}:rv=${runVersion}`
      : (trafficKey ?? `${name}:${taskType}:${packId ?? ""}:${domain ?? ""}`);
    // R34-12 fix: Normalize slot to [0, totalWeight) using proportional scaling
    // This ensures fair distribution even when weights don't sum to 100.
    // Former code: slot = hash % totalWeight (caused unfair wrapping when weights < 100)
    const rawSlot = this.computeTrafficSlot(effectiveTrafficKey);
    const slot = totalWeight > 0 ? Math.floor((rawSlot * totalWeight) / 100) : 0;
    let normalizedCursor = 0;
    for (const bundle of eligible) {
      const weight = Math.max(0, bundle.metadata.trafficAllocation.weight);
      normalizedCursor += weight / totalWeight;
      if (slot / totalWeight < normalizedCursor) {
        return bundle;
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

  private storeBundle(bundle: PromptBundle, level: RegistryLevel, domain?: string, _packId?: string): void {
    switch (level) {
      case "global":
        this.globalBundles.set(bundle.name, bundle);
        break;
      case "domain":
      case "pack":
        if (!domain) throw new ValidationError("prompt_bundle.missing_domain", "Domain required for domain-level registration");
        this.getOrCreateMap(this.domainBundles, domain).set(bundle.name, bundle);
        break;
      case "task-type":
        // R23-48 fix: task-type uses domain as the pack/context identifier
        if (!domain) {
          throw new ValidationError("prompt_bundle.missing_context", "Domain required for task-type level registration");
        }
        const taskTypeBuckets = this.getOrCreateMap(this.taskTypeBundles, domain);
        this.getOrCreateMap(taskTypeBuckets, bundle.taskType).set(bundle.name, bundle);
        break;
    }
  }

  private storeVersion(bundle: PromptBundle, level: RegistryLevel, domain?: string, packId?: string): void {
    if (!this.versionsByName.has(bundle.name)) {
      this.versionsByName.set(bundle.name, new Map());
    }
    this.requireMap(this.versionsByName, bundle.name).set(bundle.bundleId, bundle);

    const scopeKey = this.buildScopeKey(bundle.name, level, bundle.taskType, domain ?? bundle.domain, packId ?? bundle.packId);
    if (!this.versionsByScope.has(scopeKey)) {
      this.versionsByScope.set(scopeKey, new Map());
    }
    this.requireMap(this.versionsByScope, scopeKey).set(this.normalizeVersionKey(bundle.version), bundle);
  }

  private findBundle(
    name: string,
    version: string | number,
    level: RegistryLevel,
    domain?: string,
    packId?: string,
  ): PromptBundle | null {
    const effectiveDomain = domain ?? (level === "pack" ? packId : undefined);
    if (level === "task-type") {
      const scopeEntries = this.getTaskTypeScopeEntries(name, effectiveDomain);
      if (scopeEntries.length === 0) {
        return null;
      }
      if (version !== undefined && version !== "") {
        const normalizedVersion = this.normalizeVersionKey(version);
        for (const bundles of scopeEntries) {
          const bundle = bundles.get(normalizedVersion);
          if (bundle && bundle.metadata.deprecated !== true) {
            return bundle;
          }
        }
        return null;
      }
      return this.selectDefaultBundle(scopeEntries.flatMap((bundles) => [...bundles.values()]));
    }

    const scopeKey = this.buildScopeKey(name, level, undefined, effectiveDomain, packId);
    const bundles = this.versionsByScope.get(scopeKey);
    if (!bundles) return null;

    if (version !== undefined && version !== "") {
      const bundle = bundles.get(this.normalizeVersionKey(version));
      return bundle && bundle.metadata.deprecated !== true ? bundle : null;
    }

    return this.selectDefaultBundle([...bundles.values()]);
  }

  /**
   * Updates bundle reference in all storage maps after a deprecation operation.
   * Preserves immutability by replacing entries rather than mutating.
   */
  private updateBundleReference(
    bundle: PromptBundle,
    level: RegistryLevel,
    domain?: string,
    _packId?: string,
  ): void {
    const existingVersions = this.versionsByName.get(bundle.name);
    if (existingVersions) {
      existingVersions.set(bundle.bundleId, bundle);
    }

    const scopeKey = this.buildScopeKey(
      bundle.name,
      level,
      level === "task-type" ? bundle.taskType : undefined,
      domain,
      _packId,
    );
    const scopeVersions = this.versionsByScope.get(scopeKey);
    if (scopeVersions) {
      scopeVersions.set(this.normalizeVersionKey(bundle.version), bundle);
    }

    const currentBundle =
      scopeVersions == null
        ? (bundle.metadata.deprecated ? null : bundle)
        : this.selectDefaultBundle([...scopeVersions.values()]);

    switch (level) {
      case "global":
        if (currentBundle) {
          this.globalBundles.set(bundle.name, currentBundle);
        } else {
          this.globalBundles.delete(bundle.name);
        }
        break;
      case "domain":
      case "pack":
        if (!domain) {
          break;
        }
        if (currentBundle) {
          this.domainBundles.get(domain)?.set(bundle.name, currentBundle);
        } else {
          this.domainBundles.get(domain)?.delete(bundle.name);
        }
        break;
      case "task-type":
        if (!domain) {
          break;
        }
        const taskTypeBundles = this.taskTypeBundles.get(domain)?.get(bundle.taskType);
        if (!taskTypeBundles) {
          break;
        }
        if (currentBundle) {
          taskTypeBundles.set(bundle.name, currentBundle);
        } else {
          taskTypeBundles.delete(bundle.name);
        }
        break;
    }
  }

  private buildListResult(bundle: PromptBundle): PromptBundleListResult {
    return {
      bundle,
      availableVersions: this.listBundleVersions(bundle.name),
      currentVersion: String(bundle.version),
    };
  }

  private getResolvedScopeBundles(
    name: string,
    taskType: string,
    packId?: string,
    domain?: string,
  ): PromptBundle[] {
    // R23-48 fix: Normalize packId to domain for backward compatibility
    const effectiveDomain = domain ?? packId;
    const scopeKeys: string[] = [];
    if (effectiveDomain) {
      scopeKeys.push(this.buildScopeKey(name, "task-type", taskType, effectiveDomain));
    }
    if (effectiveDomain) {
      scopeKeys.push(this.buildScopeKey(name, "domain", undefined, effectiveDomain));
    }
    scopeKeys.push(this.buildScopeKey(name, "global", undefined, undefined));

    for (const scopeKey of scopeKeys) {
      const bundles = [...(this.versionsByScope.get(scopeKey)?.values() ?? [])]
        .filter((bundle) => bundle.metadata.deprecated !== true)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
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
    _packId?: string,
  ): string {
    switch (level) {
      case "global":
        return [level, name].join(":");
      case "domain":
      case "pack":
        return [level, domain ?? "", name].join(":");
      case "task-type":
        // R23-48 fix: task-type uses domain as the pack/context identifier
        return [level, domain ?? "", taskType ?? "", name].join(":");
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
        return right.createdAt.localeCompare(left.createdAt);
      });
    return eligible[0] ?? null;
  }

  private normalizeVersionKey(version: string | number): string {
    if (typeof version === "number") {
      return String(version);
    }

    const normalized = version.trim();
    const fullSemverMatch = normalized.match(/^v?(\d+)\.(\d+)(?:\.(\d+))?$/);
    if (fullSemverMatch) {
      const major = parseInt(fullSemverMatch[1]!, 10);
      const minor = parseInt(fullSemverMatch[2]!, 10);
      const patch = fullSemverMatch[3] !== undefined ? parseInt(fullSemverMatch[3]!, 10) : 0;
      return String(major * 100 + minor * 10 + patch);
    }

    const plainIntegerMatch = normalized.match(/^(\d+)$/);
    if (plainIntegerMatch) {
      return String(parseInt(plainIntegerMatch[1]!, 10));
    }

    const simpleMatch = normalized.match(/^v(\d+)$/);
    if (simpleMatch) {
      return String(parseInt(simpleMatch[1]!, 10) * 10);
    }

    return normalized;
  }

  private getTaskTypeScopeEntries(name: string, domain?: string): Array<Map<string, PromptBundle>> {
    if (!domain) {
      return [];
    }
    const prefix = `task-type:${domain}:`;
    const suffix = `:${name}`;
    return [...this.versionsByScope.entries()]
      .filter(([scopeKey]) => scopeKey.startsWith(prefix) && scopeKey.endsWith(suffix))
      .map(([, bundles]) => bundles);
  }

  private removeTaskTypeVersion(name: string, normalizedVersion: string, domain?: string): boolean {
    let removed = false;
    for (const bundles of this.getTaskTypeScopeEntries(name, domain)) {
      removed = bundles.delete(normalizedVersion) || removed;
    }
    return removed;
  }

  private computeTrafficSlot(key: string): number {
    let hash = 0;
    for (const char of key) {
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

  /**
   * R10-32 fix: Render template variables in a prompt segment.
   *
   * Replaces template variables in the format {{variableName}} with provided values.
   * Supports default values via {{variableName:defaultValue}} syntax.
   *
   * @param content - The content string with template variables
   * @param variables - Map of variable names to values
   * @returns Rendered content with variables replaced
   */
  public renderTemplateVariables(
    content: string,
    variables: Record<string, string | number | boolean>,
  ): string {
    return content.replace(/\{\{(\w+)(?::([^}]*))?\}\}/g, (match, varName, defaultValue) => {
      if (varName in variables) {
        const value = variables[varName];
        return value !== undefined && value !== null ? String(value) : match;
      }
      // Use default value if provided, otherwise keep the template variable
      return defaultValue ?? match;
    });
  }

  /**
   * R10-32 fix: Render a prompt bundle segment with variables.
   *
   * @param segment - The prompt segment to render
   * @param variables - Variables to substitute
   * @returns Rendered segment content
   */
  public renderPromptSegment(
    segment: PromptBundleSegment,
    variables: Record<string, string | number | boolean>,
  ): string {
    const renderedContent = this.renderTemplateVariables(segment.content, variables);
    // Also render in templateVariables array if present
    const renderedVariables = segment.templateVariables.map((v) =>
      this.renderTemplateVariables(v, variables),
    );
    return renderedContent;
  }

  /**
   * R10-33 fix: Validate PromptBundleCompatibilityMatrix.
   *
   * Ensures all required compatibility dimensions are covered:
   * - Tool schema versions
   * - Evaluator schema versions
   * - Domain descriptor versions
   * - Model routing profiles
   *
   * @param bundle - The bundle to validate
   * @throws ValidationError if compatibility matrix is incomplete
   */
  public validateCompatibilityMatrix(bundle: PromptBundle): void {
    const matrix = bundle.compatibilityMatrix;

    if (!matrix) {
      throw new ValidationError(
        "prompt_bundle.missing_compatibility_matrix",
        `Prompt bundle ${bundle.name}@${bundle.version} must have a compatibility matrix`,
      );
    }

    const errors: string[] = [];

    // Validate tool schema versions
    if (!matrix.toolSchemaVersions || matrix.toolSchemaVersions.length === 0) {
      errors.push("toolSchemaVersions is required and must not be empty");
    } else {
      for (const tool of matrix.toolSchemaVersions) {
        if (!tool.toolName || typeof tool.schemaVersion !== "number") {
          errors.push(`Invalid tool schema entry: ${JSON.stringify(tool)}`);
        }
      }
    }

    // Validate evaluator schema versions
    if (!matrix.evaluatorSchemaVersions || matrix.evaluatorSchemaVersions.length === 0) {
      errors.push("evaluatorSchemaVersions is required and must not be empty");
    } else {
      for (const evalEntry of matrix.evaluatorSchemaVersions) {
        if (!evalEntry.evaluatorName || typeof evalEntry.schemaVersion !== "number") {
          errors.push(`Invalid evaluator schema entry: ${JSON.stringify(evalEntry)}`);
        }
      }
    }

    // Validate domain descriptor versions
    if (!matrix.domainDescriptorVersions || matrix.domainDescriptorVersions.length === 0) {
      errors.push("domainDescriptorVersions is required and must not be empty");
    } else {
      for (const domain of matrix.domainDescriptorVersions) {
        if (!domain.domainId || typeof domain.version !== "number") {
          errors.push(`Invalid domain descriptor entry: ${JSON.stringify(domain)}`);
        }
      }
    }

    // Validate model routing profiles
    if (!matrix.modelRoutingProfiles || matrix.modelRoutingProfiles.length === 0) {
      errors.push("modelRoutingProfiles is required and must not be empty");
    } else {
      for (const model of matrix.modelRoutingProfiles) {
        if (!model.modelId || typeof model.profileVersion !== "number") {
          errors.push(`Invalid model routing profile entry: ${JSON.stringify(model)}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(
        "prompt_bundle.invalid_compatibility_matrix",
        `Prompt bundle ${bundle.name}@${bundle.version} has invalid compatibility matrix: ${errors.join("; ")}`,
      );
    }
  }

  /**
   * R10-33 fix: Check if a bundle is compatible with given versions.
   *
   * @param bundle - The bundle to check
   * @param toolSchemaVersions - Required tool schema versions
   * @param evaluatorSchemaVersions - Required evaluator schema versions
   * @param domainDescriptorVersions - Required domain descriptor versions
   * @param modelRoutingProfiles - Required model routing profiles
   * @returns true if compatible, false otherwise
   */
  public isCompatibleWith(
    bundle: PromptBundle,
    toolSchemaVersions: ReadonlyArray<{ toolName: string; schemaVersion: number }>,
    evaluatorSchemaVersions: ReadonlyArray<{ evaluatorName: string; schemaVersion: number }>,
    domainDescriptorVersions: ReadonlyArray<{ domainId: string; version: number }>,
    modelRoutingProfiles: ReadonlyArray<{ modelId: string; profileVersion: number }>,
  ): boolean {
    const matrix = bundle.compatibilityMatrix;

    if (!matrix) return false;

    const hasTool = toolSchemaVersions.every((required) =>
      matrix.toolSchemaVersions.some(
        (available) =>
          available.toolName === required.toolName && available.schemaVersion >= required.schemaVersion,
      ),
    );

    const hasEvaluator = evaluatorSchemaVersions.every((required) =>
      matrix.evaluatorSchemaVersions.some(
        (available) =>
          available.evaluatorName === required.evaluatorName &&
          available.schemaVersion >= required.schemaVersion,
      ),
    );

    const hasDomain = domainDescriptorVersions.every((required) =>
      matrix.domainDescriptorVersions.some(
        (available) =>
          available.domainId === required.domainId && available.version >= required.version,
      ),
    );

    const hasModel = modelRoutingProfiles.every((required) =>
      matrix.modelRoutingProfiles.some(
        (available) =>
          available.modelId === required.modelId && available.profileVersion >= required.profileVersion,
      ),
    );

    return hasTool && hasEvaluator && hasDomain && hasModel;
  }

  private getOrCreateMap<K, NestedKey, NestedValue>(
    index: Map<K, Map<NestedKey, NestedValue>>,
    key: K,
  ): Map<NestedKey, NestedValue>;
  private getOrCreateMap<K, V>(index: Map<K, V>, key: K, factory: () => V): V;
  private getOrCreateMap<K, V>(index: Map<K, V>, key: K, factory?: () => V): V {
    const existing = index.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const created = factory ? factory() : new Map() as V;
    index.set(key, created);
    return created;
  }

  private requireMap<K, V>(index: Map<K, V>, key: K): V {
    const value = index.get(key);
    if (value === undefined) {
      throw new ValidationError("prompt_bundle.map_missing", `Missing registry bucket for ${String(key)}`);
    }
    return value;
  }
}
