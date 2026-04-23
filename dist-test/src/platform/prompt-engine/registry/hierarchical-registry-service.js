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
const DEFAULT_CONFIG = {
    enableVersioning: true,
    enableTrafficSplit: true,
    defaultMaxTokens: 4096,
    defaultTemperature: 0.7,
};
export class HierarchicalPromptRegistryService {
    // global → domain → pack → task-type hierarchy
    globalBundles = new Map();
    domainBundles = new Map();
    packBundles = new Map();
    taskTypeBundles = new Map();
    versionsByName = new Map();
    versionsByScope = new Map();
    config;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Registers a new prompt bundle at the specified level.
     */
    registerBundle(input, level, domain, packId) {
        this.validateRegistrationInput(input);
        const bundleId = this.buildBundleId(input, level, domain, packId);
        const bundle = {
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
        this.storeVersion(bundle, level, domain, packId);
        return bundle;
    }
    /**
     * Retrieves a prompt bundle with hierarchical lookup.
     * Looks up in order: task-type → pack → domain → global
     */
    getBundle(name, taskType, packId, domain) {
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
    listBundleVersions(name) {
        const bundles = [...(this.versionsByName.get(name)?.values() ?? [])];
        return bundles
            .map((bundle) => ({
            version: bundle.version,
            isCurrent: bundle.metadata.deprecated !== true,
            isDefault: bundle.metadata.trafficAllocation.weight === 100,
            trafficWeight: bundle.metadata.trafficAllocation.weight,
            createdAt: bundle.createdAt,
            deprecated: bundle.metadata.deprecated,
        }))
            .sort((a, b) => a.version.localeCompare(b.version));
    }
    /**
     * Lists all bundles, optionally filtered by level.
     */
    listBundles(level, domain, packId) {
        const results = [];
        const seen = new Set();
        const addFromMap = (map) => {
            for (const bundle of map.values()) {
                if (seen.has(bundle.bundleId))
                    continue;
                seen.add(bundle.bundleId);
                results.push(this.buildListResult(bundle));
            }
        };
        if (!level || level === "global") {
            addFromMap(this.globalBundles);
        }
        if ((!level || level === "domain") && domain) {
            const domainMap = this.domainBundles.get(domain);
            if (domainMap)
                addFromMap(domainMap);
        }
        if ((!level || level === "pack") && packId) {
            const packMap = this.packBundles.get(packId);
            if (packMap)
                addFromMap(packMap);
        }
        return results;
    }
    /**
     * Deprecates a specific version of a bundle.
     */
    deprecateBundle(name, version, level, domain, packId) {
        const bundle = this.findBundle(name, version, level, domain, packId);
        if (!bundle) {
            throw new ValidationError("prompt_bundle.not_found", `Prompt bundle ${name}@${version} not found at ${level} level`);
        }
        bundle.metadata.deprecated = true;
        bundle.updatedAt = nowIso();
    }
    removeBundle(name, version, level, domain, packId) {
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
        return removedFromScope;
    }
    /**
     * Gets the resolved prompt bundle considering traffic allocation.
     * Used for A/B testing scenarios.
     */
    resolveBundleForTraffic(name, taskType, packId, domain, trafficKey) {
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
        const slot = this.computeTrafficSlot(trafficKey ?? `${name}:${taskType}:${packId ?? ""}:${domain ?? ""}`);
        let cursor = 0;
        for (const bundle of eligible) {
            cursor += Math.max(0, bundle.metadata.trafficAllocation.weight);
            if (slot < cursor) {
                return bundle;
            }
        }
        return this.selectDefaultBundle(eligible);
    }
    buildBundleId(input, level, domain, packId) {
        const parts = [level];
        if (domain)
            parts.push(domain);
        if (packId)
            parts.push(packId);
        parts.push(input.name);
        parts.push(input.version);
        return parts.join(":");
    }
    validateRegistrationInput(input) {
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
    normalizeConstraints(input) {
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
    buildMetadata(input) {
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
    storeBundle(bundle, level, domain, packId) {
        switch (level) {
            case "global":
                this.globalBundles.set(bundle.name, bundle);
                break;
            case "domain":
                if (!domain)
                    throw new ValidationError("prompt_bundle.missing_domain", "Domain required for domain-level registration");
                if (!this.domainBundles.has(domain)) {
                    this.domainBundles.set(domain, new Map());
                }
                this.domainBundles.get(domain).set(bundle.name, bundle);
                break;
            case "pack":
                if (!packId)
                    throw new ValidationError("prompt_bundle.missing_pack_id", "PackId required for pack-level registration");
                if (!this.packBundles.has(packId)) {
                    this.packBundles.set(packId, new Map());
                }
                this.packBundles.get(packId).set(bundle.name, bundle);
                break;
            case "task-type":
                if (!packId || !domain) {
                    throw new ValidationError("prompt_bundle.missing_context", "PackId and domain required for task-type level registration");
                }
                if (!this.taskTypeBundles.has(packId)) {
                    this.taskTypeBundles.set(packId, new Map());
                }
                if (!this.taskTypeBundles.get(packId).has(bundle.taskType)) {
                    this.taskTypeBundles.get(packId).set(bundle.taskType, new Map());
                }
                this.taskTypeBundles.get(packId).get(bundle.taskType).set(bundle.name, bundle);
                break;
        }
    }
    storeVersion(bundle, level, domain, packId) {
        if (!this.versionsByName.has(bundle.name)) {
            this.versionsByName.set(bundle.name, new Map());
        }
        this.versionsByName.get(bundle.name).set(bundle.bundleId, bundle);
        const scopeKey = this.buildScopeKey(bundle.name, level, bundle.taskType, domain ?? bundle.domain, packId ?? bundle.packId);
        if (!this.versionsByScope.has(scopeKey)) {
            this.versionsByScope.set(scopeKey, new Map());
        }
        this.versionsByScope.get(scopeKey).set(bundle.version, bundle);
    }
    findBundle(name, version, level, domain, packId) {
        switch (level) {
            case "global":
                return this.findCurrentScopeBundle(this.buildScopeKey(name, level, undefined, domain, packId));
            case "domain":
                return domain ? this.findCurrentScopeBundle(this.buildScopeKey(name, level, undefined, domain, packId)) : null;
            case "pack":
                return packId ? this.findCurrentScopeBundle(this.buildScopeKey(name, level, undefined, domain, packId)) : null;
            case "task-type":
                if (packId && domain) {
                    const scopeKey = this.buildScopeKey(name, level, domain, domain, packId);
                    return this.findCurrentScopeBundle(scopeKey);
                }
                return null;
        }
    }
    buildListResult(bundle) {
        return {
            bundle,
            availableVersions: this.listBundleVersions(bundle.name),
            currentVersion: bundle.version,
        };
    }
    getResolvedScopeBundles(name, taskType, packId, domain) {
        const scopeKeys = [];
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
                .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
            if (bundles.length > 0) {
                return bundles;
            }
        }
        return [];
    }
    buildScopeKey(name, level, taskType, domain, packId) {
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
    selectDefaultBundle(bundles) {
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
    computeTrafficSlot(key) {
        let hash = 0;
        for (const char of key) {
            hash = ((hash << 5) - hash + char.charCodeAt(0)) >>> 0;
        }
        return hash % 100;
    }
    isBundleTrafficActive(bundle, now = new Date()) {
        const allocation = bundle.metadata.trafficAllocation;
        if (allocation.startTime != null && Date.parse(allocation.startTime) > now.getTime()) {
            return false;
        }
        if (allocation.endTime != null && Date.parse(allocation.endTime) < now.getTime()) {
            return false;
        }
        return allocation.weight > 0;
    }
    findCurrentScopeBundle(scopeKey) {
        return this.selectDefaultBundle([...(this.versionsByScope.get(scopeKey)?.values() ?? [])]);
    }
}
//# sourceMappingURL=hierarchical-registry-service.js.map