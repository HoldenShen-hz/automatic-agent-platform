/**
 * Version Compatibility Matrix
 *
 * Maintains a compatibility matrix for pack versions and their dependencies.
 * Supports installation-time compatibility checks.
 *
 * Architecture: §57 版本管理 - Version Compatibility Matrix
 * @see docs_zh/architecture/00-platform-architecture.md §57
 */
import { SemverValidator } from "./semver-validator.js";
export type CompatibilityLevel = "compatible" | "warning" | "incompatible";
export interface VersionCompatibilityEntry {
    entryId: string;
    sourcePackId: string;
    sourceVersion: string;
    targetPackId: string;
    targetVersionRange: string;
    compatibilityLevel: CompatibilityLevel;
    reason: string;
    introducedAt: string;
    deprecatedAt: string | null;
}
export interface CompatibilityCheckResult {
    compatible: boolean;
    level: CompatibilityLevel;
    sourcePackId: string;
    sourceVersion: string;
    targetPackId: string;
    targetVersion: string;
    reason?: string;
}
export interface PackVersion {
    packId: string;
    version: string;
}
export interface CompatibilityMatrixConfig {
    strictMode: boolean;
    allowWildcardVersions: boolean;
}
export declare class VersionCompatibilityMatrix {
    private readonly config;
    private readonly entries;
    private readonly indexBySource;
    private readonly semver;
    constructor(config?: Partial<CompatibilityMatrixConfig>, semverValidator?: SemverValidator);
    /**
     * Registers a compatibility entry.
     *
     * @param entry - Compatibility entry to register
     */
    register(entry: Omit<VersionCompatibilityEntry, "entryId" | "introducedAt">): VersionCompatibilityEntry;
    /**
     * Registers a batch of compatibility entries.
     *
     * @param entries - Entries to register
     */
    registerBatch(entries: Omit<VersionCompatibilityEntry, "entryId" | "introducedAt">[]): VersionCompatibilityEntry[];
    /**
     * Checks compatibility between two pack versions.
     *
     * @param source - Source pack and version
     * @param target - Target pack and version
     * @returns Compatibility check result
     */
    checkCompatibility(source: PackVersion, target: PackVersion): CompatibilityCheckResult;
    /**
     * Checks compatibility for a list of packs.
     *
     * @param packs - Array of packs to check
     * @returns Array of compatibility results
     */
    checkCompatibilityBatch(packs: PackVersion[]): CompatibilityCheckResult[];
    /**
     * Gets all compatibility entries for a source pack.
     *
     * @param packId - Pack ID
     * @returns Array of compatibility entries
     */
    getEntriesForPack(packId: string): VersionCompatibilityEntry[];
    /**
     * Gets all active compatibility entries.
     *
     * @returns Array of active entries
     */
    getActiveEntries(): VersionCompatibilityEntry[];
    /**
     * Deprecates a specific entry.
     *
     * @param entryId - Entry ID to deprecate
     */
    deprecateEntry(entryId: string): boolean;
    /**
     * Gets compatibility matrix summary.
     *
     * @returns Summary statistics
     */
    getSummary(): {
        totalEntries: number;
        activeEntries: number;
        deprecatedEntries: number;
        uniqueSourcePacks: number;
        uniqueTargetPacks: number;
        compatibilityBreakdown: Record<CompatibilityLevel, number>;
    };
    /**
     * Validates version formats in all entries.
     *
     * @returns Validation result
     */
    validateEntries(): {
        valid: boolean;
        errors: string[];
    };
    private makeKey;
    private isValidVersionRange;
}
export declare function createDefaultCompatibilityMatrix(): VersionCompatibilityMatrix;
