/**
 * @fileoverview Pack Registry Service - Pack registration and discovery
 *
 * Implements pack registry as defined in architecture doc §30:
 * - Pack registration and versioning
 * - Discovery by domain, status, or filters
 * - Multiple packs can share the same DomainDescriptor
 *
 * @see docs_zh/architecture/00-platform-architecture.md §30
 */

import { ValidationError } from "../../platform/contracts/errors.js";
import { nowIso } from "../../platform/contracts/types/ids.js";
import {
  BusinessPackManifestSchema,
  type BusinessPackLifecycleStage,
  type BusinessPackManifest,
  type NormalizedBusinessPackManifest,
} from "./business-pack-manifest.js";
import {
  assertPackCompatibleWithDomain,
  type DomainPackCompatibilityDomain,
} from "./pack-domain-compatibility.js";

// ============================================================================
// Registry Types
// ============================================================================

/**
 * Pack version record for tracking history.
 */
export interface PackVersion {
  versionId: string;
  packId: string;
  version: string;
  manifest: NormalizedBusinessPackManifest;
  createdAt: string;
  changelog: string;
}

/**
 * Filter options for listing packs.
 */
export interface ListPacksFilter {
  status?: BusinessPackLifecycleStage[];
  domainId?: string;
  tags?: string[];
  author?: string;
}

/**
 * Pack registry entry with version history.
 */
export interface PackRegistryEntry {
  packId: string;
  currentManifest: NormalizedBusinessPackManifest;
  versions: readonly PackVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface PackRegistryServiceOptions {
  readonly domainResolver?: ((domainId: string) => DomainPackCompatibilityDomain | null) | null;
}

// ============================================================================
// Registry Service
// ============================================================================

/**
 * Pack Registry Service
 *
 * Manages registration and discovery of Business Packs:
 * - Register new packs with manifests
 * - Track version history
 * - Filter and search packs by various criteria
 * - Support multiple packs per domain
 */
export class PackRegistryService {
  private readonly registry = new Map<string, PackRegistryEntry>();
  private readonly versions = new Map<string, PackVersion[]>();
  private readonly domainResolver: ((domainId: string) => DomainPackCompatibilityDomain | null) | null;

  public constructor(options: PackRegistryServiceOptions = {}) {
    this.domainResolver = options.domainResolver ?? null;
  }

  /**
   * Registers a new pack with its manifest.
   * Creates initial version 1.0.0.
   */
  public registerPack(packId: string, manifest: BusinessPackManifest): PackRegistryEntry {
    if (this.registry.has(packId)) {
      throw this.validationError(
        "pack_registry.already_registered",
        `Pack ${packId} is already registered.`,
      );
    }

    const normalizedManifest = BusinessPackManifestSchema.parse(manifest);
    this.assertDomainCompatibility(normalizedManifest);
    const now = nowIso();
    const version: PackVersion = {
      versionId: `${packId}_v1.0.0`,
      packId,
      version: normalizedManifest.version,
      manifest: { ...normalizedManifest },
      createdAt: now,
      changelog: "Initial registration",
    };

    const entry: PackRegistryEntry = {
      packId,
      currentManifest: { ...normalizedManifest },
      versions: [version],
      createdAt: now,
      updatedAt: now,
    };

    this.registry.set(packId, entry);
    this.versions.set(packId, [version]);

    return entry;
  }

  /**
   * Gets a pack by its ID.
   */
  public getPack(packId: string): PackRegistryEntry | null {
    return this.registry.get(packId) ?? null;
  }

  /**
   * Gets the current manifest for a pack.
   */
  public getPackManifest(packId: string): NormalizedBusinessPackManifest | null {
    return this.registry.get(packId)?.currentManifest ?? null;
  }

  /**
   * Gets all versions of a pack.
   */
  public getPackVersions(packId: string): readonly PackVersion[] {
    return this.versions.get(packId) ?? [];
  }

  /**
   * Lists packs with optional filtering.
   */
  public listPacks(filters?: ListPacksFilter): PackRegistryEntry[] {
    let results = [...this.registry.values()];

    if (!filters) {
      return results;
    }

    if (filters.status && filters.status.length > 0) {
      const statusSet = new Set(filters.status);
      results = results.filter((entry) => statusSet.has(entry.currentManifest.lifecycleStage));
    }

    if (filters.domainId) {
      const domain = this.resolveDomain(filters.domainId);
      if (domain?.status === "archived") {
        return [];
      }
      results = results.filter((entry) => entry.currentManifest.domainId === filters.domainId);
    }

    if (filters.tags && filters.tags.length > 0) {
      const tagSet = new Set(filters.tags);
      results = results.filter((entry) =>
        entry.currentManifest.tags.some((tag) => tagSet.has(tag)),
      );
    }

    if (filters.author) {
      results = results.filter((entry) => entry.currentManifest.author === filters.author);
    }

    return results;
  }

  /**
   * Finds all packs associated with a domain.
   */
  public findPacksByDomain(domainId: string): PackRegistryEntry[] {
    return this.listPacks({ domainId });
  }

  /**
   * Lists all pack IDs.
   */
  public listPackIds(): string[] {
    return [...this.registry.keys()];
  }

  /**
   * Lists all registered packs (no filter).
   */
  public listAllPacks(): PackRegistryEntry[] {
    return [...this.registry.values()];
  }

  /**
   * Checks if a pack is registered.
   */
  public isRegistered(packId: string): boolean {
    return this.registry.has(packId);
  }

  /**
   * Updates a pack's manifest and creates a new version.
   */
  public updatePack(packId: string, manifest: BusinessPackManifest): PackVersion {
    const entry = this.registry.get(packId);
    if (!entry) {
      throw this.validationError(
        "pack_registry.not_found",
        `Pack ${packId} not found.`,
      );
    }

    const normalizedManifest = BusinessPackManifestSchema.parse(manifest);
    this.assertDomainCompatibility(normalizedManifest);
    const now = nowIso();
    const prevVersion = this.getLatestVersion(packId);
    const newVersionStr = prevVersion
      ? this.bumpVersion(prevVersion.version)
      : "1.0.0";

    const version: PackVersion = {
      versionId: `${packId}_v${newVersionStr}`,
      packId,
      version: newVersionStr,
      manifest: { ...normalizedManifest },
      createdAt: now,
      changelog: `Updated from ${entry.currentManifest.version} to ${newVersionStr}`,
    };

    const versionList = this.versions.get(packId) ?? [];
    this.versions.set(packId, [...versionList, version]);

    entry.currentManifest = { ...normalizedManifest };
    entry.updatedAt = now;

    return version;
  }

  /**
   * Removes a pack from the registry.
   */
  public unregisterPack(packId: string): boolean {
    const existed = this.registry.has(packId);
    if (existed) {
      this.registry.delete(packId);
      this.versions.delete(packId);
    }
    return existed;
  }

  private getLatestVersion(packId: string): PackVersion | null {
    const versions = this.versions.get(packId) ?? [];
    if (versions.length === 0) {
      return null;
    }
    const sorted = [...versions].sort((a, b) => b.version.localeCompare(a.version));
    return sorted[0] ?? null;
  }

  private bumpVersion(version: string): string {
    const parts = version.split(".");
    const major = Number.parseInt(parts[0] ?? "1", 10);
    const minor = Number.parseInt(parts[1] ?? "0", 10);
    const patch = Number.parseInt(parts[2] ?? "0", 10);
    return `${major}.${minor}.${patch + 1}`;
  }

  private validationError(code: string, message: string): ValidationError {
    return new ValidationError(code, message, {
      category: "validation",
      source: "internal",
    });
  }

  private resolveDomain(domainId: string): DomainPackCompatibilityDomain | null {
    return this.domainResolver?.(domainId) ?? null;
  }

  private assertDomainCompatibility(manifest: NormalizedBusinessPackManifest): void {
    const domain = this.resolveDomain(manifest.domainId);
    if (domain == null) {
      if (this.domainResolver != null) {
        throw this.validationError(
          "pack_registry.domain_not_found",
          `Referenced domain ${manifest.domainId} is not registered.`,
        );
      }
      return;
    }
    assertPackCompatibleWithDomain(manifest, domain);
  }
}
