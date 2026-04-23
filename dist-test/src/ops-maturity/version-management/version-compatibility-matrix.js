/**
 * Version Compatibility Matrix
 *
 * Maintains a compatibility matrix for pack versions and their dependencies.
 * Supports installation-time compatibility checks.
 *
 * Architecture: §57 Version Management - Version Compatibility Matrix
 * @see docs_zh/architecture/00-platform-architecture.md §57
 */
import { createSemverValidator } from "./semver-validator.js";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
// ─────────────────────────────────────────────────────────────────────────────
// Default Compatibility Rules
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
    strictMode: true,
    allowWildcardVersions: false,
};
// ─────────────────────────────────────────────────────────────────────────────
// Version Compatibility Matrix Service
// ─────────────────────────────────────────────────────────────────────────────
export class VersionCompatibilityMatrix {
    config;
    entries = new Map();
    indexBySource = new Map();
    semver;
    constructor(config, semverValidator) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.semver = semverValidator ?? createSemverValidator();
    }
    /**
     * Registers a compatibility entry.
     *
     * @param entry - Compatibility entry to register
     */
    register(entry) {
        const fullEntry = {
            ...entry,
            entryId: newId("compat"),
            introducedAt: nowIso(),
        };
        const key = this.makeKey(entry.sourcePackId, entry.sourceVersion, entry.targetPackId, entry.targetVersionRange);
        this.entries.set(key, fullEntry);
        // Update index
        if (!this.indexBySource.has(entry.sourcePackId)) {
            this.indexBySource.set(entry.sourcePackId, new Map());
        }
        const sourceIndex = this.indexBySource.get(entry.sourcePackId);
        if (!sourceIndex.has(entry.sourceVersion)) {
            sourceIndex.set(entry.sourceVersion, []);
        }
        sourceIndex.get(entry.sourceVersion).push(fullEntry);
        return fullEntry;
    }
    /**
     * Registers a batch of compatibility entries.
     *
     * @param entries - Entries to register
     */
    registerBatch(entries) {
        return entries.map((e) => this.register(e));
    }
    /**
     * Checks compatibility between two pack versions.
     *
     * @param source - Source pack and version
     * @param target - Target pack and version
     * @returns Compatibility check result
     */
    checkCompatibility(source, target) {
        // First check explicit entries
        const key = this.makeKey(source.packId, source.version, target.packId, target.version);
        const entry = this.entries.get(key);
        if (entry) {
            return {
                compatible: entry.compatibilityLevel !== "incompatible",
                level: entry.compatibilityLevel,
                sourcePackId: source.packId,
                sourceVersion: source.version,
                targetPackId: target.packId,
                targetVersion: target.version,
                reason: entry.reason,
            };
        }
        // Check for wildcard source version entries
        const sourceIndex = this.indexBySource.get(source.packId);
        if (sourceIndex) {
            const wildcardEntries = sourceIndex.get("*");
            if (wildcardEntries) {
                for (const entry of wildcardEntries) {
                    // Check if target version satisfies the registered range
                    if (this.semver.satisfies(target.version, entry.targetVersionRange)) {
                        return {
                            compatible: entry.compatibilityLevel !== "incompatible",
                            level: entry.compatibilityLevel,
                            sourcePackId: source.packId,
                            sourceVersion: source.version,
                            targetPackId: target.packId,
                            targetVersion: target.version,
                            reason: entry.reason,
                        };
                    }
                }
            }
        }
        // Check version range compatibility
        if (sourceIndex) {
            for (const [versionPattern, entries] of sourceIndex) {
                if (versionPattern === "*")
                    continue;
                if (this.semver.satisfies(source.version, versionPattern)) {
                    for (const e of entries) {
                        if (this.semver.satisfies(target.version, e.targetVersionRange)) {
                            return {
                                compatible: e.compatibilityLevel !== "incompatible",
                                level: e.compatibilityLevel,
                                sourcePackId: source.packId,
                                sourceVersion: source.version,
                                targetPackId: target.packId,
                                targetVersion: target.version,
                                reason: e.reason,
                            };
                        }
                    }
                }
            }
        }
        // No compatibility rule found
        if (this.config.strictMode) {
            return {
                compatible: false,
                level: "incompatible",
                sourcePackId: source.packId,
                sourceVersion: source.version,
                targetPackId: target.packId,
                targetVersion: target.version,
                reason: `No compatibility rule found for ${source.packId}@${source.version} with ${target.packId}@${target.version}`,
            };
        }
        // Non-strict mode: assume compatible with warning
        return {
            compatible: true,
            level: "warning",
            sourcePackId: source.packId,
            sourceVersion: source.version,
            targetPackId: target.packId,
            targetVersion: target.version,
            reason: "No compatibility rule found, assuming compatible with caution",
        };
    }
    /**
     * Checks compatibility for a list of packs.
     *
     * @param packs - Array of packs to check
     * @returns Array of compatibility results
     */
    checkCompatibilityBatch(packs) {
        const results = [];
        for (let i = 0; i < packs.length; i++) {
            for (let j = i + 1; j < packs.length; j++) {
                results.push(this.checkCompatibility(packs[i], packs[j]));
            }
        }
        return results;
    }
    /**
     * Gets all compatibility entries for a source pack.
     *
     * @param packId - Pack ID
     * @returns Array of compatibility entries
     */
    getEntriesForPack(packId) {
        const sourceIndex = this.indexBySource.get(packId);
        if (!sourceIndex)
            return [];
        const entries = [];
        for (const versionEntries of sourceIndex.values()) {
            entries.push(...versionEntries);
        }
        return entries;
    }
    /**
     * Gets all active compatibility entries.
     *
     * @returns Array of active entries
     */
    getActiveEntries() {
        return [...this.entries.values()].filter((e) => e.deprecatedAt === null);
    }
    /**
     * Deprecates a specific entry.
     *
     * @param entryId - Entry ID to deprecate
     */
    deprecateEntry(entryId) {
        for (const [key, entry] of this.entries) {
            if (entry.entryId === entryId) {
                const updated = {
                    ...entry,
                    deprecatedAt: nowIso(),
                };
                this.entries.set(key, updated);
                return true;
            }
        }
        return false;
    }
    /**
     * Gets compatibility matrix summary.
     *
     * @returns Summary statistics
     */
    getSummary() {
        const entries = [...this.entries.values()];
        const active = entries.filter((e) => e.deprecatedAt === null);
        const deprecated = entries.filter((e) => e.deprecatedAt !== null);
        const sourcePacks = new Set();
        const targetPacks = new Set();
        const breakdown = {
            compatible: 0,
            warning: 0,
            incompatible: 0,
        };
        for (const entry of entries) {
            sourcePacks.add(entry.sourcePackId);
            targetPacks.add(entry.targetPackId);
            breakdown[entry.compatibilityLevel]++;
        }
        return {
            totalEntries: entries.length,
            activeEntries: active.length,
            deprecatedEntries: deprecated.length,
            uniqueSourcePacks: sourcePacks.size,
            uniqueTargetPacks: targetPacks.size,
            compatibilityBreakdown: breakdown,
        };
    }
    /**
     * Validates version formats in all entries.
     *
     * @returns Validation result
     */
    validateEntries() {
        const errors = [];
        for (const entry of this.entries.values()) {
            if (!this.semver.isValid(entry.sourceVersion)) {
                errors.push(`Invalid source version in entry ${entry.entryId}: ${entry.sourceVersion}`);
            }
            if (!this.isValidVersionRange(entry.targetVersionRange)) {
                errors.push(`Invalid target version range in entry ${entry.entryId}: ${entry.targetVersionRange}`);
            }
        }
        return { valid: errors.length === 0, errors };
    }
    // ─── Private Methods ─────────────────────────────────────────────────────
    makeKey(sourcePackId, sourceVersion, targetPackId, targetVersionRange) {
        return `${sourcePackId}@${sourceVersion}:${targetPackId}@${targetVersionRange}`;
    }
    isValidVersionRange(range) {
        // Handle wildcards
        if (range === "*" || range === "x" || range === "X") {
            return this.config.allowWildcardVersions;
        }
        // Handle npm-style ranges
        const validRangeOperators = ["^", "~", ">=", "<=", ">", "<", "=", ""];
        for (const op of validRangeOperators) {
            if (range.startsWith(op)) {
                const version = range.slice(op.length);
                return this.semver.isValid(version) || this.isValidVersionRange(version);
            }
        }
        // Handle compound ranges
        if (range.includes(" ")) {
            return range.split(/\s+/).every((part) => this.isValidVersionRange(part));
        }
        // Handle OR ranges
        if (range.includes("||")) {
            return range.split("||").every((part) => this.isValidVersionRange(part.trim()));
        }
        return this.semver.isValid(range);
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Default Compatibility Rules Registry
// ─────────────────────────────────────────────────────────────────────────────
export function createDefaultCompatibilityMatrix() {
    const matrix = new VersionCompatibilityMatrix();
    // Register default compatibility rules for common pack patterns
    // These would typically come from a configuration file in production
    return matrix;
}
//# sourceMappingURL=version-compatibility-matrix.js.map