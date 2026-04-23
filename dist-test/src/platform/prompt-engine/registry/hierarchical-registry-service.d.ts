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
import type { PromptBundle, PromptBundleListResult, PromptBundleRegistrationInput, PromptBundleVersion } from "../../contracts/prompt-bundle/index.js";
export interface HierarchicalPromptRegistryConfig {
    enableVersioning: boolean;
    enableTrafficSplit: boolean;
    defaultMaxTokens?: number;
    defaultTemperature?: number;
}
type RegistryLevel = "global" | "domain" | "pack" | "task-type";
export declare class HierarchicalPromptRegistryService {
    private readonly globalBundles;
    private readonly domainBundles;
    private readonly packBundles;
    private readonly taskTypeBundles;
    private readonly versionsByName;
    private readonly versionsByScope;
    private readonly config;
    constructor(config?: Partial<HierarchicalPromptRegistryConfig>);
    /**
     * Registers a new prompt bundle at the specified level.
     */
    registerBundle(input: PromptBundleRegistrationInput, level: RegistryLevel, domain?: string, packId?: string): PromptBundle;
    /**
     * Retrieves a prompt bundle with hierarchical lookup.
     * Looks up in order: task-type → pack → domain → global
     */
    getBundle(name: string, taskType: string, packId?: string, domain?: string): PromptBundle | null;
    /**
     * Lists all versions of a bundle across all levels.
     */
    listBundleVersions(name: string): PromptBundleVersion[];
    /**
     * Lists all bundles, optionally filtered by level.
     */
    listBundles(level?: RegistryLevel, domain?: string, packId?: string): PromptBundleListResult[];
    /**
     * Deprecates a specific version of a bundle.
     */
    deprecateBundle(name: string, version: string, level: RegistryLevel, domain?: string, packId?: string): void;
    removeBundle(name: string, version: string, level: RegistryLevel, domain?: string, packId?: string): boolean;
    /**
     * Gets the resolved prompt bundle considering traffic allocation.
     * Used for A/B testing scenarios.
     */
    resolveBundleForTraffic(name: string, taskType: string, packId?: string, domain?: string, trafficKey?: string): PromptBundle | null;
    private buildBundleId;
    private validateRegistrationInput;
    private normalizeConstraints;
    private buildMetadata;
    private storeBundle;
    private storeVersion;
    private findBundle;
    private buildListResult;
    private getResolvedScopeBundles;
    private buildScopeKey;
    private selectDefaultBundle;
    private computeTrafficSlot;
    private isBundleTrafficActive;
    private findCurrentScopeBundle;
}
export {};
