/**
 * PromptVersionManager
 *
 * Implements semantic version management for prompt bundles.
 * Supports: v{major}.{minor} format, version lineage, and deprecation tracking.
 */
import type { PromptBundle, PromptBundleVersion } from "../../contracts/prompt-bundle/index.js";
export interface SemanticVersion {
    major: number;
    minor: number;
    patch?: number;
}
export interface VersionLineage {
    current: string;
    previous?: string;
    next?: string;
}
export interface VersionManagerConfig {
    allowPrerelease: boolean;
    maxVersionsPerBundle: number;
    autoDeprecateOldVersions: boolean;
    deprecationThresholdDays: number;
}
export declare class PromptVersionManager {
    private readonly config;
    private readonly versionCache;
    private readonly bundleVersions;
    constructor(config?: Partial<VersionManagerConfig>);
    /**
     * Parses a version string into a SemanticVersion.
     * Supports formats: v1.0, v1.0.0, 1.0, 1.0.0
     */
    parseVersion(version: string): SemanticVersion;
    /**
     * Formats a SemanticVersion back to a version string.
     */
    formatVersion(version: SemanticVersion, includePatch?: boolean): string;
    /**
     * Compares two version strings.
     * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
     */
    compareVersions(v1: string, v2: string): number;
    /**
     * Determines the next version based on current version and update type.
     */
    getNextVersion(currentVersion: string, updateType: "major" | "minor" | "patch"): SemanticVersion;
    /**
     * Gets the version lineage (previous, current, next candidate).
     */
    getVersionLineage(bundleName: string, currentVersion: string): VersionLineage;
    /**
     * Checks if a version is considered "current" (latest minor for a major).
     */
    isCurrentVersion(bundleName: string, version: string): boolean;
    /**
     * Validates version format without throwing.
     */
    isValidVersionFormat(version: string): boolean;
    /**
     * Gets all versions for a bundle sorted by version order.
     */
    getSortedVersions(bundleName: string): string[];
    /**
     * Registers a bundle version for tracking.
     */
    registerBundleVersion(bundle: PromptBundle): void;
    /**
     * Lists all versions for a bundle with metadata.
     */
    listBundleVersions(bundleName: string): PromptBundleVersion[];
}
export interface VersionLineage {
    current: string;
    previous?: string;
    next?: string;
}
