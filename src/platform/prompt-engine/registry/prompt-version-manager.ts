/**
 * PromptVersionManager
 *
 * Implements semantic version management for prompt bundles.
 * Supports: v{major}.{minor} format, version lineage, and deprecation tracking.
 */

import { ValidationError } from "../../contracts/errors.js";
import { nowIso } from "../../contracts/types/ids.js";
import type { PromptBundle, PromptBundleVersion } from "../../contracts/prompt-bundle/index.js";

export interface SemanticVersion {
  major: number;
  minor: number;
  patch?: number;
}

export interface VersionLineage {
  current: string | number;
  previous?: string | number;
  next?: string | number;
}

export interface VersionManagerConfig {
  allowPrerelease: boolean;
  maxVersionsPerBundle: number;
  autoDeprecateOldVersions: boolean;
  deprecationThresholdDays: number;
}

const DEFAULT_VERSION_CONFIG: VersionManagerConfig = {
  allowPrerelease: false,
  maxVersionsPerBundle: 50,
  autoDeprecateOldVersions: false,
  deprecationThresholdDays: 90,
};

const VERSION_REGEX = /^v?(\d+)\.(\d+)(?:\.(\d+))?$/;
const INTEGER_REGEX = /^\d+$/;

export class PromptVersionManager {
  private readonly config: VersionManagerConfig;
  private readonly bundleVersions = new Map<string, Map<string, { bundle: PromptBundle; createdAt: string }>>();

  public constructor(config: Partial<VersionManagerConfig> = {}) {
    this.config = { ...DEFAULT_VERSION_CONFIG, ...config };
  }

  /**
   * Parses a version string into a SemanticVersion.
   * Supports formats: v1.0, v1.0.0, 1.0, 1.0.0
   */
  public parseVersion(version: string): SemanticVersion {
    const normalized = version.trim().toLowerCase();
    const match = normalized.match(VERSION_REGEX);

    if (!match) {
      throw new ValidationError(
        "prompt_version.invalid_format",
        `Version "${version}" does not match semantic version format (v{major}.{minor} or v{major}.{minor}.{patch})`,
      );
    }

    const major = parseInt(match[1]!, 10);
    const minor = parseInt(match[2]!, 10);
    const patchMatch = match[3];
    const patch = patchMatch !== undefined ? parseInt(patchMatch, 10) : undefined;
    const result: SemanticVersion = { major, minor };
    if (patch !== undefined) {
      result.patch = patch;
    }
    return result;
  }

  private isIntegerLike(version: string | number): boolean {
    return typeof version === "number" || INTEGER_REGEX.test(version.trim());
  }

  private normalizeIntegerVersion(version: string | number): number {
    if (typeof version === "number") {
      return version;
    }
    return parseInt(version.trim(), 10);
  }

  private normalizeComparableVersion(version: string | number): number {
    if (this.isIntegerLike(version)) {
      return this.normalizeIntegerVersion(version);
    }
    const parsed = this.parseVersion(String(version));
    return parsed.major * 100 + parsed.minor * 10 + (parsed.patch ?? 0);
  }

  private getSortedVersionValues(bundleName: string): Array<string | number> {
    const bundleVersionMap = this.bundleVersions.get(bundleName);
    if (!bundleVersionMap) {
      return [];
    }

    return [...bundleVersionMap.values()]
      .map((entry) => entry.bundle.version as string | number)
      .sort((left, right) => this.compareVersions(left, right));
  }

  /**
   * Formats a SemanticVersion back to a version string.
   */
  public formatVersion(version: SemanticVersion, includePatch = false): string {
    if (includePatch && version.patch !== undefined) {
      return `v${version.major}.${version.minor}.${version.patch}`;
    }
    return `v${version.major}.${version.minor}`;
  }

  /**
   * Compares two version strings.
   * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
   *
   * R10-31 fix: Now handles both string versions (displayVersion) and number versions.
   * Per §16.2, version should be an incrementing integer for deterministic ordering,
   * while displayVersion provides human-readable semver format.
   */
  public compareVersions(v1: string | number, v2: string | number): number {
    const comparableV1 = this.normalizeComparableVersion(v1);
    const comparableV2 = this.normalizeComparableVersion(v2);
    if (comparableV1 < comparableV2) return -1;
    if (comparableV1 > comparableV2) return 1;
    return 0;
  }

  /**
   * Determines the next version based on current version and update type.
   */
  public getNextVersion(currentVersion: number): number;
  public getNextVersion(currentVersion: string, updateType: "major" | "minor" | "patch"): SemanticVersion;
  public getNextVersion(currentVersion: string | number, updateType?: "major" | "minor" | "patch"): SemanticVersion | number {
    if (typeof currentVersion === "number" && updateType === undefined) {
      return currentVersion + 1;
    }

    if (typeof currentVersion === "string" && updateType === undefined && this.isIntegerLike(currentVersion)) {
      return this.normalizeIntegerVersion(currentVersion) + 1;
    }

    if (typeof currentVersion !== "string" || updateType === undefined) {
      throw new ValidationError(
        "prompt_version.invalid_next_version_request",
        "Semantic version next-version calculation requires a string version and explicit update type.",
      );
    }

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
  public getVersionLineage(bundleName: string, currentVersion: string | number): VersionLineage {
    const versions = this.getSortedVersionValues(bundleName);
    const currentIndex = versions.findIndex((version) => this.compareVersions(version, currentVersion) === 0);

    const previous = currentIndex > 0 ? versions[currentIndex - 1] : undefined;
    const next = currentIndex >= 0 && currentIndex < versions.length - 1 ? versions[currentIndex + 1] : undefined;
    const lineage: VersionLineage = { current: currentVersion };
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
  public isCurrentVersion(bundleName: string, version: string | number): boolean {
    const versions = this.getSortedVersionValues(bundleName);
    if (versions.length === 0) return true;

    const latestVersion = versions[versions.length - 1]!;
    if (this.isIntegerLike(version) && this.isIntegerLike(latestVersion)) {
      return this.normalizeIntegerVersion(version) === this.normalizeIntegerVersion(latestVersion);
    }
    const current = this.parseVersion(String(version));
    const latest = this.parseVersion(String(latestVersion));

    // Same major, same minor (or patch exists and version is without patch)
    if (current.major === latest.major && current.minor === latest.minor) {
      return true;
    }

    return false;
  }

  /**
   * Validates version format without throwing.
   */
  public isValidVersionFormat(version: string): boolean {
    try {
      this.parseVersion(version);
      return true;
    } catch {
      return false;
    }
  }

  public isValidVersion(version: string | number): boolean {
    if (typeof version === "number") {
      return Number.isInteger(version) && version > 0;
    }
    if (this.isIntegerLike(version)) {
      return this.normalizeIntegerVersion(version) > 0;
    }
    return this.isValidVersionFormat(version);
  }

  /**
   * Gets all versions for a bundle sorted by version order.
   */
  public getSortedVersions(bundleName: string): Array<string | number> {
    return this.getSortedVersionValues(bundleName);
  }

  /**
   * Registers a bundle version for tracking.
   */
  public registerBundleVersion(bundle: PromptBundle): void {
    if (!this.bundleVersions.has(bundle.name)) {
      this.bundleVersions.set(bundle.name, new Map());
    }

    this.bundleVersions.get(bundle.name)!.set(String(bundle.version), {
      bundle,
      createdAt: nowIso(),
    });

    // Enforce max versions limit
    const versions = this.getSortedVersionValues(bundle.name);
    while (versions.length > this.config.maxVersionsPerBundle) {
      const oldest = versions.shift();
      if (oldest) {
        this.bundleVersions.get(bundle.name)!.delete(String(oldest));
      }
    }
  }

  public validateCompatibilityMatrix(bundle: PromptBundle): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if ((bundle.compatibilityMatrix.toolSchemaVersions?.length ?? 0) === 0) {
      errors.push("compatibilityMatrix.toolSchemaVersions must contain at least one tool schema version.");
    }
    if ((bundle.compatibilityMatrix.evaluatorSchemaVersions?.length ?? 0) === 0) {
      errors.push("compatibilityMatrix.evaluatorSchemaVersions must contain at least one evaluator schema version.");
    }
    if ((bundle.compatibilityMatrix.domainDescriptorVersions?.length ?? 0) === 0) {
      errors.push("compatibilityMatrix.domainDescriptorVersions must contain at least one domain descriptor version.");
    }
    if ((bundle.compatibilityMatrix.modelRoutingProfiles?.length ?? 0) === 0) {
      errors.push("compatibilityMatrix.modelRoutingProfiles must contain at least one model routing profile.");
    }
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Lists all versions for a bundle with metadata.
   */
  public listBundleVersions(bundleName: string): PromptBundleVersion[] {
    const bundleVersionMap = this.bundleVersions.get(bundleName);
    if (!bundleVersionMap) return [];

    const sorted = this.getSortedVersionValues(bundleName);
    const current = sorted.length > 0 ? sorted[sorted.length - 1] : null;

    return [...sorted].reverse().map((versionStr) => {
      const entry = bundleVersionMap.get(String(versionStr))!;
      const numericVersion = typeof entry.bundle.version === "number"
        ? entry.bundle.version
        : this.normalizeComparableVersion(entry.bundle.version);
      return {
        version: numericVersion,
        displayVersion: entry.bundle.displayVersion,
        isCurrent: current != null && this.compareVersions(versionStr, current) === 0,
        isDefault: entry.bundle.metadata.trafficAllocation.weight === 100,
        trafficWeight: entry.bundle.metadata.trafficAllocation.weight,
        createdAt: entry.createdAt,
        deprecated: entry.bundle.metadata.deprecated,
        lifecycleStatus: entry.bundle.metadata.lifecycleStatus as "draft" | "active" | "deprecated" | "archived",
      };
    });
  }
}
