/**
 * PromptVersionManager
 *
 * Implements semantic version management for prompt bundles.
 * Supports: v{major}.{minor} format, version lineage, and deprecation tracking.
 */
import { ValidationError } from "../../contracts/errors.js";
import { nowIso } from "../../contracts/types/ids.js";
const DEFAULT_VERSION_CONFIG = {
    allowPrerelease: false,
    maxVersionsPerBundle: 50,
    autoDeprecateOldVersions: false,
    deprecationThresholdDays: 90,
};
const VERSION_REGEX = /^v?(\d+)\.(\d+)(?:\.(\d+))?$/;
export class PromptVersionManager {
    config;
    versionCache = new Map();
    bundleVersions = new Map();
    constructor(config = {}) {
        this.config = { ...DEFAULT_VERSION_CONFIG, ...config };
    }
    /**
     * Parses a version string into a SemanticVersion.
     * Supports formats: v1.0, v1.0.0, 1.0, 1.0.0
     */
    parseVersion(version) {
        const normalized = version.trim().toLowerCase();
        const match = normalized.match(VERSION_REGEX);
        if (!match) {
            throw new ValidationError("prompt_version.invalid_format", `Version "${version}" does not match semantic version format (v{major}.{minor} or v{major}.{minor}.{patch})`);
        }
        const major = parseInt(match[1], 10);
        const minor = parseInt(match[2], 10);
        const patchMatch = match[3];
        const patch = patchMatch !== undefined ? parseInt(patchMatch, 10) : undefined;
        const result = { major, minor };
        if (patch !== undefined) {
            result.patch = patch;
        }
        return result;
    }
    /**
     * Formats a SemanticVersion back to a version string.
     */
    formatVersion(version, includePatch = false) {
        if (includePatch && version.patch !== undefined) {
            return `v${version.major}.${version.minor}.${version.patch}`;
        }
        return `v${version.major}.${version.minor}`;
    }
    /**
     * Compares two version strings.
     * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
     */
    compareVersions(v1, v2) {
        const parsed1 = this.parseVersion(v1);
        const parsed2 = this.parseVersion(v2);
        if (parsed1.major !== parsed2.major) {
            return parsed1.major - parsed2.major;
        }
        if (parsed1.minor !== parsed2.minor) {
            return parsed1.minor - parsed2.minor;
        }
        if (parsed1.patch !== undefined && parsed2.patch !== undefined) {
            return parsed1.patch - parsed2.patch;
        }
        if (parsed1.patch !== undefined)
            return 1;
        if (parsed2.patch !== undefined)
            return -1;
        return 0;
    }
    /**
     * Determines the next version based on current version and update type.
     */
    getNextVersion(currentVersion, updateType) {
        const current = this.parseVersion(currentVersion);
        switch (updateType) {
            case "major":
                return { major: current.major + 1, minor: 0, patch: 0 };
            case "minor":
                return { major: current.major, minor: current.minor + 1, patch: 0 };
            case "patch":
                return {
                    major: current.major,
                    minor: current.minor,
                    patch: (current.patch ?? 0) + 1,
                };
        }
    }
    /**
     * Gets the version lineage (previous, current, next candidate).
     */
    getVersionLineage(bundleName, currentVersion) {
        const versions = this.getSortedVersions(bundleName);
        const currentIndex = versions.indexOf(currentVersion);
        const previous = currentIndex > 0 ? versions[currentIndex - 1] : undefined;
        const next = currentIndex < versions.length - 1 ? versions[currentIndex + 1] : undefined;
        const lineage = { current: currentVersion };
        if (previous !== undefined) {
            lineage.previous = previous;
        }
        if (next !== undefined) {
            lineage.next = next;
        }
        return lineage;
    }
    /**
     * Checks if a version is considered "current" (latest minor for a major).
     */
    isCurrentVersion(bundleName, version) {
        const versions = this.getSortedVersions(bundleName);
        if (versions.length === 0)
            return true;
        const latestVersion = versions[versions.length - 1];
        const current = this.parseVersion(version);
        const latest = this.parseVersion(latestVersion);
        // Same major, same minor (or patch exists and version is without patch)
        if (current.major === latest.major && current.minor === latest.minor) {
            return true;
        }
        return false;
    }
    /**
     * Validates version format without throwing.
     */
    isValidVersionFormat(version) {
        try {
            this.parseVersion(version);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Gets all versions for a bundle sorted by version order.
     */
    getSortedVersions(bundleName) {
        const bundleVersionMap = this.bundleVersions.get(bundleName);
        if (!bundleVersionMap)
            return [];
        return [...bundleVersionMap.keys()].sort((a, b) => this.compareVersions(a, b));
    }
    /**
     * Registers a bundle version for tracking.
     */
    registerBundleVersion(bundle) {
        if (!this.bundleVersions.has(bundle.name)) {
            this.bundleVersions.set(bundle.name, new Map());
        }
        this.bundleVersions.get(bundle.name).set(bundle.version, {
            bundle,
            createdAt: nowIso(),
        });
        // Enforce max versions limit
        const versions = this.getSortedVersions(bundle.name);
        while (versions.length > this.config.maxVersionsPerBundle) {
            const oldest = versions.shift();
            if (oldest) {
                this.bundleVersions.get(bundle.name).delete(oldest);
            }
        }
    }
    /**
     * Lists all versions for a bundle with metadata.
     */
    listBundleVersions(bundleName) {
        const bundleVersionMap = this.bundleVersions.get(bundleName);
        if (!bundleVersionMap)
            return [];
        const sorted = this.getSortedVersions(bundleName);
        const current = sorted.length > 0 ? sorted[sorted.length - 1] : null;
        return sorted.map((version) => {
            const entry = bundleVersionMap.get(version);
            return {
                version,
                isCurrent: version === current,
                isDefault: entry.bundle.metadata.trafficAllocation.weight === 100,
                trafficWeight: entry.bundle.metadata.trafficAllocation.weight,
                createdAt: entry.createdAt,
                deprecated: entry.bundle.metadata.deprecated,
            };
        });
    }
}
//# sourceMappingURL=prompt-version-manager.js.map