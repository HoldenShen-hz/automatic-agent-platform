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
import type { BusinessPackLifecycleStage, BusinessPackManifest } from "./business-pack-manifest.js";
/**
 * Pack version record for tracking history.
 */
export interface PackVersion {
    versionId: string;
    packId: string;
    version: string;
    manifest: BusinessPackManifest;
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
    currentManifest: BusinessPackManifest;
    versions: readonly PackVersion[];
    createdAt: string;
    updatedAt: string;
}
/**
 * Pack Registry Service
 *
 * Manages registration and discovery of Business Packs:
 * - Register new packs with manifests
 * - Track version history
 * - Filter and search packs by various criteria
 * - Support multiple packs per domain
 */
export declare class PackRegistryService {
    private readonly registry;
    private readonly versions;
    /**
     * Registers a new pack with its manifest.
     * Creates initial version 1.0.0.
     */
    registerPack(packId: string, manifest: BusinessPackManifest): PackRegistryEntry;
    /**
     * Gets a pack by its ID.
     */
    getPack(packId: string): PackRegistryEntry | null;
    /**
     * Gets the current manifest for a pack.
     */
    getPackManifest(packId: string): BusinessPackManifest | null;
    /**
     * Gets all versions of a pack.
     */
    getPackVersions(packId: string): readonly PackVersion[];
    /**
     * Lists packs with optional filtering.
     */
    listPacks(filters?: ListPacksFilter): PackRegistryEntry[];
    /**
     * Finds all packs associated with a domain.
     */
    findPacksByDomain(domainId: string): PackRegistryEntry[];
    /**
     * Lists all pack IDs.
     */
    listPackIds(): string[];
    /**
     * Lists all registered packs (no filter).
     */
    listAllPacks(): PackRegistryEntry[];
    /**
     * Checks if a pack is registered.
     */
    isRegistered(packId: string): boolean;
    /**
     * Updates a pack's manifest and creates a new version.
     */
    updatePack(packId: string, manifest: BusinessPackManifest): PackVersion;
    /**
     * Removes a pack from the registry.
     */
    unregisterPack(packId: string): boolean;
    private getLatestVersion;
    private bumpVersion;
    private validationError;
}
