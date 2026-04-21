/**
 * Config Versioning Service
 *
 * Provides configuration versioning with diff and rollback capabilities.
 * Stores snapshots of configuration at each version, enabling comparison
 * and restoration to previous states.
 *
 * Features:
 * - Store version snapshots with content hashes
 * - Track rollback points
 * - Compute diffs between any two versions
 * - Rollback to previous versions
 */
import { DurableEventBus } from "../../state-evidence/events/durable-event-bus.js";
import { type ConfigDiffEntry } from "./config-governance-support.js";
/**
 * Represents a configuration version snapshot.
 */
export interface ConfigVersionSnapshot {
    /** Unique version identifier */
    versionId: string;
    /** Dot-notation config path */
    configPath: string;
    /** Hierarchy layer (platform, tenant, pack, task_type) */
    layer: string;
    /** Source ID (e.g., tenantId) if applicable */
    sourceId: string | null;
    /** Full configuration content at this version */
    content: Record<string, unknown>;
    /** SHA-256 hash of the content */
    contentHash: string;
    /** ISO timestamp when version was created */
    createdAt: string;
    /** Actor who created this version (user ID or system) */
    createdBy: string | null;
    /** Reason for the change */
    reason: string | null;
    /** Parent version ID (previous version) */
    parentVersionId: string | null;
}
/**
 * Represents a rollback point that can be restored to.
 */
export interface ConfigRollbackPoint {
    /** Unique rollback point identifier */
    rollbackId: string;
    /** Version ID this rollback point references */
    versionId: string;
    /** Config path this rollback point is for */
    configPath: string;
    /** Hierarchy layer */
    layer: string;
    /** When this rollback point was created */
    createdAt: string;
    /** Who created this rollback point */
    createdBy: string;
}
/**
 * Represents a diff between two configuration versions.
 */
export interface ConfigVersionDiff {
    /** First version ID */
    versionA: string;
    /** Second version ID */
    versionB: string;
    /** Changes between the two versions */
    changes: ConfigDiffEntry[];
    /** Number of additions */
    additions: number;
    /** Number of removals */
    removals: number;
    /** Number of modifications */
    modifications: number;
}
/**
 * Options for ConfigVersioningService.
 */
export interface ConfigVersioningServiceOptions {
    /** Optional event bus for emitting version events */
    eventBus?: DurableEventBus | null;
    /** Maximum number of versions to retain per config path (default: 50) */
    maxVersionsPerPath?: number;
    /** Maximum age of versions in milliseconds (default: 30 days) */
    maxVersionAgeMs?: number;
}
/**
 * Service for managing configuration versioning, diffs, and rollbacks.
 *
 * Stores snapshots of configuration at each change, enabling:
 * - Tracking configuration history
 * - Comparing any two versions
 * - Rolling back to previous configurations
 * - Audit trail of changes
 */
export declare class ConfigVersioningService {
    private readonly eventBus;
    private readonly maxVersionsPerPath;
    private readonly maxVersionAgeMs;
    /** In-memory storage for version snapshots */
    private readonly snapshots;
    /** In-memory storage for rollback points */
    private readonly rollbackPoints;
    constructor(options?: ConfigVersioningServiceOptions);
    /**
     * Creates a new version snapshot for a configuration.
     *
     * @param configPath - Dot-notation path to the config
     * @param layer - Hierarchy layer
     * @param sourceId - Source ID if applicable
     * @param content - Full configuration content
     * @param createdBy - Actor who created this version
     * @param reason - Reason for the change
     * @returns The created version snapshot
     */
    createVersion(configPath: string, layer: string, sourceId: string | null, content: Record<string, unknown>, createdBy?: string | null, reason?: string | null): ConfigVersionSnapshot;
    /**
     * Gets the current (latest) version for a config path.
     *
     * @param configPath - Dot-notation config path
     * @param layer - Hierarchy layer
     * @param sourceId - Source ID if applicable
     * @returns The latest version snapshot or null if none exists
     */
    getCurrentVersion(configPath: string, layer: string, sourceId: string | null): ConfigVersionSnapshot | null;
    /**
     * Gets a specific version by ID.
     *
     * @param versionId - The version ID to find
     * @returns The version snapshot or null if not found
     */
    getVersion(versionId: string): ConfigVersionSnapshot | null;
    /**
     * Gets all versions for a config path.
     *
     * @param configPath - Dot-notation config path
     * @param layer - Hierarchy layer
     * @param sourceId - Source ID if applicable
     * @returns Array of version snapshots, oldest first
     */
    getVersionHistory(configPath: string, layer: string, sourceId: string | null): ConfigVersionSnapshot[];
    /**
     * Computes the diff between two versions.
     *
     * @param versionA - First version ID
     * @param versionB - Second version ID
     * @returns Diff result or null if either version not found
     */
    diffVersions(versionA: string, versionB: string): ConfigVersionDiff | null;
    /**
     * Creates a rollback point for the current version.
     *
     * @param configPath - Dot-notation config path
     * @param layer - Hierarchy layer
     * @param sourceId - Source ID if applicable
     * @param createdBy - Actor creating the rollback point
     * @returns The created rollback point or null if no current version
     */
    createRollbackPoint(configPath: string, layer: string, sourceId: string | null, createdBy: string): ConfigRollbackPoint | null;
    /**
     * Gets available rollback points for a config path.
     *
     * @param configPath - Dot-notation config path
     * @param layer - Hierarchy layer
     * @param sourceId - Source ID if applicable
     * @returns Array of rollback points
     */
    getRollbackPoints(configPath: string, layer: string, sourceId: string | null): ConfigRollbackPoint[];
    /**
     * Rolls back to a specific version, creating a new version with the old content.
     *
     * @param versionId - Version ID to rollback to
     * @param createdBy - Actor performing the rollback
     * @param reason - Reason for the rollback
     * @returns The new version snapshot created from rollback, or null if version not found
     */
    rollback(versionId: string, createdBy: string, reason?: string | null): ConfigVersionSnapshot | null;
    /**
     * Gets the content of a specific version for restoration.
     *
     * @param versionId - Version ID to get content from
     * @returns The configuration content or null if version not found
     */
    getVersionContent(versionId: string): Record<string, unknown> | null;
    /**
     * Cleans up old versions beyond maxVersionsPerPath and maxVersionAgeMs.
     *
     * @param configPath - Dot-notation config path
     * @param layer - Hierarchy layer
     * @param sourceId - Source ID if applicable
     * @returns Number of versions pruned
     */
    pruneVersions(configPath: string, layer: string, sourceId: string | null): number;
    /**
     * Cleans up all old versions across all config paths.
     *
     * @returns Number of versions pruned
     */
    pruneAllVersions(): number;
    /**
     * Builds a storage key from config path components.
     */
    private buildKey;
    /**
     * Internal prune logic for a specific key.
     */
    private pruneVersionsInternal;
    /**
     * Emits a version event to the event bus.
     */
    private emitVersionEvent;
    /**
     * Emits a rollback point event to the event bus.
     */
    private emitRollbackPointEvent;
}
