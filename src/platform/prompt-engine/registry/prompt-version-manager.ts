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

const DEFAULT_VERSION_CONFIG: VersionManagerConfig = {
  allowPrerelease: false,
  maxVersionsPerBundle: 50,
  autoDeprecateOldVersions: false,
  deprecationThresholdDays: 90,
};

const VERSION_REGEX = /^v?(\d+)\.(\d+)(?:\.(\d+))?$/;

export class PromptVersionManager {
  private readonly config: VersionManagerConfig;
  private readonly versionCache = new Map<string, SemanticVersion>();
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
    // Handle number versions directly (per §16.2)
    if (typeof v1 === "number" && typeof v2 === "number") {
      return v1 - v2;
    }
    // Handle string versions (semver format for display)
    const strV1 = String(v1);
    const strV2 = String(v2);
    const parsed1 = this.parseVersion(strV1);
    const parsed2 = this.parseVersion(strV2);

    if (parsed1.major !== parsed2.major) {
      return parsed1.major - parsed2.major;
    }
    if (parsed1.minor !== parsed2.minor) {
      return parsed1.minor - parsed2.minor;
    }
    if (parsed1.patch !== undefined && parsed2.patch !== undefined) {
      return parsed1.patch - parsed2.patch;
    }
    return 0;
  }

  /**
   * Determines the next version based on current version and update type.
   */
  public getNextVersion(currentVersion: string, updateType: "major" | "minor" | "patch"): SemanticVersion {
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
  public getVersionLineage(bundleName: string, currentVersion: string): VersionLineage {
    const versions = this.getSortedVersions(bundleName);
    const currentIndex = versions.indexOf(currentVersion);

    const previous: string | undefined = currentIndex > 0 ? versions[currentIndex - 1]! : undefined;
    const next: string | undefined = currentIndex < versions.length - 1 ? versions[currentIndex + 1]! : undefined;
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
  public isCurrentVersion(bundleName: string, version: string): boolean {
    const versions = this.getSortedVersions(bundleName);
    if (versions.length === 0) return true;

    const latestVersion = versions[versions.length - 1]!;
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
  public isValidVersionFormat(version: string): boolean {
    try {
      this.parseVersion(version);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets all versions for a bundle sorted by version order.
   */
  public getSortedVersions(bundleName: string): string[] {
    const bundleVersionMap = this.bundleVersions.get(bundleName);
    if (!bundleVersionMap) return [];

    return [...bundleVersionMap.keys()].sort((a, b) => this.compareVersions(a, b));
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
    const versions = this.getSortedVersions(bundle.name);
    while (versions.length > this.config.maxVersionsPerBundle) {
      const oldest = versions.shift();
      if (oldest) {
        this.bundleVersions.get(bundle.name)!.delete(oldest);
      }
    }
  }

  /**
   * Lists all versions for a bundle with metadata.
   */
  public listBundleVersions(bundleName: string): PromptBundleVersion[] {
    const bundleVersionMap = this.bundleVersions.get(bundleName);
    if (!bundleVersionMap) return [];

    const sorted = this.getSortedVersions(bundleName);
    const current = sorted.length > 0 ? sorted[sorted.length - 1] : null;

    return sorted.map((versionStr) => {
      const entry = bundleVersionMap.get(versionStr)!;
      return {
        version: Number(versionStr),
        displayVersion: entry.bundle.displayVersion,
        isCurrent: versionStr === current,
        isDefault: entry.bundle.metadata.trafficAllocation.weight === 100,
        trafficWeight: entry.bundle.metadata.trafficAllocation.weight,
        createdAt: entry.createdAt,
        deprecated: entry.bundle.metadata.deprecated,
        lifecycleStatus: entry.bundle.metadata.lifecycleStatus as "draft" | "active" | "deprecated" | "archived",
      };
    });
  }
}

/**
 * R2-8: Prompt lifecycle now includes deprecated phase
 */
export interface VersionLineage {
  current: string;
  previous?: string;
  next?: string;
}
