/**
 * PromptVersionManager
 *
 * Implements integer version management for prompt bundles per §16.2.
 * Supports integer incrementing versions, version lineage, and deprecation tracking.
 * Display version (semver format) is stored separately in PromptBundle.displayVersion.
 */
import { nowIso } from "../../contracts/types/ids.js";
const DEFAULT_VERSION_CONFIG = {
    maxVersionsPerBundle: 50,
    autoDeprecateOldVersions: false,
    deprecationThresholdDays: 90,
};
/**
 * §16.2: Integer version manager for deterministic ordering.
 * Display version (semver) is handled separately via PromptBundle.displayVersion.
 */
export class PromptVersionManager {
    config;
    bundleVersions = new Map();
    constructor(config = {}) {
        this.config = { ...DEFAULT_VERSION_CONFIG, ...config };
    }
    /**
     * Validates that a version is a positive integer.
     */
    isValidVersion(version) {
        return Number.isInteger(version) && version > 0;
    }
    /**
     * Compares two integer versions.
     * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
     */
    compareVersions(v1, v2) {
        if (v1 < v2)
            return -1;
        if (v1 > v2)
            return 1;
        return 0;
    }
    /**
     * Gets the next version by incrementing the current version.
     */
    getNextVersion(currentVersion) {
        return currentVersion + 1;
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
     * Checks if a version is considered "current" (latest).
     */
    isCurrentVersion(bundleName, version) {
        const versions = this.getSortedVersions(bundleName);
        if (versions.length === 0)
            return true;
        return versions[versions.length - 1] === version;
    }
    /**
     * Gets all versions for a bundle sorted by version order.
     */
    getSortedVersions(bundleName) {
        const bundleVersionMap = this.bundleVersions.get(bundleName);
        if (!bundleVersionMap)
            return [];
        return Array.from(bundleVersionMap.keys()).sort((a, b) => a - b);
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
            if (oldest !== undefined) {
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
                displayVersion: entry.bundle.displayVersion,
                isCurrent: version === current,
                isDefault: entry.bundle.metadata.trafficAllocation.weight === 100,
                trafficWeight: entry.bundle.metadata.trafficAllocation.weight,
                createdAt: entry.createdAt,
                deprecated: entry.bundle.metadata.deprecated,
            };
        });
    }
    /**
     * Validates PromptBundleCompatibilityMatrix.
     * §16.4: Must cover Tool schema, Evaluator schema, DomainDescriptor schema, and Model routing profile.
     */
    validateCompatibilityMatrix(bundle) {
        const errors = [];
        const matrix = bundle.compatibilityMatrix;
        if (!matrix.toolSchemaVersions || matrix.toolSchemaVersions.length === 0) {
            errors.push("compatibilityMatrix.toolSchemaVersions is required");
        }
        if (!matrix.evaluatorSchemaVersions || matrix.evaluatorSchemaVersions.length === 0) {
            errors.push("compatibilityMatrix.evaluatorSchemaVersions is required");
        }
        if (!matrix.domainDescriptorVersions || matrix.domainDescriptorVersions.length === 0) {
            errors.push("compatibilityMatrix.domainDescriptorVersions is required");
        }
        if (!matrix.modelRoutingProfiles || matrix.modelRoutingProfiles.length === 0) {
            errors.push("compatibilityMatrix.modelRoutingProfiles is required");
        }
        return { valid: errors.length === 0, errors };
    }
}
