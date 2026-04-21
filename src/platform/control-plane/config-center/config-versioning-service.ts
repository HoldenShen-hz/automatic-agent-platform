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

import { createHash } from "node:crypto";

import { DurableEventBus } from "../../state-evidence/events/durable-event-bus.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import {
  diffObjects,
  sha256,
  stableStringify,
  type ConfigDiffEntry,
} from "./config-governance-support.js";

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
export class ConfigVersioningService {
  private readonly eventBus: DurableEventBus | null;
  private readonly maxVersionsPerPath: number;
  private readonly maxVersionAgeMs: number;

  /** In-memory storage for version snapshots */
  private readonly snapshots = new Map<string, ConfigVersionSnapshot[]>();

  /** In-memory storage for rollback points */
  private readonly rollbackPoints = new Map<string, ConfigRollbackPoint[]>();

  public constructor(options: ConfigVersioningServiceOptions = {}) {
    this.eventBus = options.eventBus ?? null;
    this.maxVersionsPerPath = options.maxVersionsPerPath ?? 50;
    this.maxVersionAgeMs = options.maxVersionAgeMs ?? 30 * 24 * 60 * 60 * 1000;
  }

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
  public createVersion(
    configPath: string,
    layer: string,
    sourceId: string | null,
    content: Record<string, unknown>,
    createdBy: string | null = null,
    reason: string | null = null,
  ): ConfigVersionSnapshot {
    const key = this.buildKey(configPath, layer, sourceId);
    const versions = this.snapshots.get(key) ?? [];

    // Get parent version ID
    const parentVersionId = versions.length > 0 ? versions[versions.length - 1]!.versionId : null;

    // Create new snapshot
    const snapshot: ConfigVersionSnapshot = {
      versionId: newId("ver"),
      configPath,
      layer,
      sourceId,
      content,
      contentHash: sha256(stableStringify(content)),
      createdAt: nowIso(),
      createdBy,
      reason,
      parentVersionId,
    };

    // Add to versions list
    versions.push(snapshot);
    this.snapshots.set(key, versions);

    // Cleanup old versions
    this.pruneVersions(key);

    // Emit event
    this.emitVersionEvent("config.version.created", snapshot);

    return snapshot;
  }

  /**
   * Gets the current (latest) version for a config path.
   *
   * @param configPath - Dot-notation config path
   * @param layer - Hierarchy layer
   * @param sourceId - Source ID if applicable
   * @returns The latest version snapshot or null if none exists
   */
  public getCurrentVersion(
    configPath: string,
    layer: string,
    sourceId: string | null,
  ): ConfigVersionSnapshot | null {
    const key = this.buildKey(configPath, layer, sourceId);
    const versions = this.snapshots.get(key);
    if (!versions || versions.length === 0) {
      return null;
    }
    return versions[versions.length - 1]!;
  }

  /**
   * Gets a specific version by ID.
   *
   * @param versionId - The version ID to find
   * @returns The version snapshot or null if not found
   */
  public getVersion(versionId: string): ConfigVersionSnapshot | null {
    for (const versions of this.snapshots.values()) {
      const found = versions.find((v) => v.versionId === versionId);
      if (found) {
        return found;
      }
    }
    return null;
  }

  /**
   * Gets all versions for a config path.
   *
   * @param configPath - Dot-notation config path
   * @param layer - Hierarchy layer
   * @param sourceId - Source ID if applicable
   * @returns Array of version snapshots, oldest first
   */
  public getVersionHistory(
    configPath: string,
    layer: string,
    sourceId: string | null,
  ): ConfigVersionSnapshot[] {
    const key = this.buildKey(configPath, layer, sourceId);
    return this.snapshots.get(key) ?? [];
  }

  /**
   * Computes the diff between two versions.
   *
   * @param versionA - First version ID
   * @param versionB - Second version ID
   * @returns Diff result or null if either version not found
   */
  public diffVersions(versionA: string, versionB: string): ConfigVersionDiff | null {
    const snapshotA = this.getVersion(versionA);
    const snapshotB = this.getVersion(versionB);

    if (!snapshotA || !snapshotB) {
      return null;
    }

    const changes = diffObjects(snapshotA.content, snapshotB.content);

    return {
      versionA,
      versionB,
      changes,
      additions: changes.filter((c) => c.changeType === "added").length,
      removals: changes.filter((c) => c.changeType === "removed").length,
      modifications: changes.filter((c) => c.changeType === "changed").length,
    };
  }

  /**
   * Creates a rollback point for the current version.
   *
   * @param configPath - Dot-notation config path
   * @param layer - Hierarchy layer
   * @param sourceId - Source ID if applicable
   * @param createdBy - Actor creating the rollback point
   * @returns The created rollback point or null if no current version
   */
  public createRollbackPoint(
    configPath: string,
    layer: string,
    sourceId: string | null,
    createdBy: string,
  ): ConfigRollbackPoint | null {
    const currentVersion = this.getCurrentVersion(configPath, layer, sourceId);
    if (!currentVersion) {
      return null;
    }

    const key = this.buildKey(configPath, layer, sourceId);
    const points = this.rollbackPoints.get(key) ?? [];

    const rollbackPoint: ConfigRollbackPoint = {
      rollbackId: newId("rbp"),
      versionId: currentVersion.versionId,
      configPath,
      layer,
      createdAt: nowIso(),
      createdBy,
    };

    points.push(rollbackPoint);
    this.rollbackPoints.set(key, points);

    this.emitRollbackPointEvent("config.rollback_point.created", rollbackPoint);

    return rollbackPoint;
  }

  /**
   * Gets available rollback points for a config path.
   *
   * @param configPath - Dot-notation config path
   * @param layer - Hierarchy layer
   * @param sourceId - Source ID if applicable
   * @returns Array of rollback points
   */
  public getRollbackPoints(
    configPath: string,
    layer: string,
    sourceId: string | null,
  ): ConfigRollbackPoint[] {
    const key = this.buildKey(configPath, layer, sourceId);
    return this.rollbackPoints.get(key) ?? [];
  }

  /**
   * Rolls back to a specific version, creating a new version with the old content.
   *
   * @param versionId - Version ID to rollback to
   * @param createdBy - Actor performing the rollback
   * @param reason - Reason for the rollback
   * @returns The new version snapshot created from rollback, or null if version not found
   */
  public rollback(
    versionId: string,
    createdBy: string,
    reason: string | null = null,
  ): ConfigVersionSnapshot | null {
    const targetVersion = this.getVersion(versionId);
    if (!targetVersion) {
      return null;
    }

    // Create a new version with the old content
    const rollbackVersion = this.createVersion(
      targetVersion.configPath,
      targetVersion.layer,
      targetVersion.sourceId,
      { ...targetVersion.content }, // Deep clone
      createdBy,
      reason ?? `Rolled back to version ${versionId}`,
    );

    this.emitVersionEvent("config.version.rollback", rollbackVersion);

    return rollbackVersion;
  }

  /**
   * Gets the content of a specific version for restoration.
   *
   * @param versionId - Version ID to get content from
   * @returns The configuration content or null if version not found
   */
  public getVersionContent(versionId: string): Record<string, unknown> | null {
    const version = this.getVersion(versionId);
    return version ? { ...version.content } : null;
  }

  /**
   * Cleans up old versions beyond maxVersionsPerPath and maxVersionAgeMs.
   *
   * @param configPath - Dot-notation config path
   * @param layer - Hierarchy layer
   * @param sourceId - Source ID if applicable
   * @returns Number of versions pruned
   */
  public pruneVersions(
    configPath: string,
    layer: string,
    sourceId: string | null,
  ): number {
    const key = this.buildKey(configPath, layer, sourceId);
    return this.pruneVersionsInternal(key);
  }

  /**
   * Cleans up all old versions across all config paths.
   *
   * @returns Number of versions pruned
   */
  public pruneAllVersions(): number {
    let totalPruned = 0;
    for (const key of this.snapshots.keys()) {
      totalPruned += this.pruneVersionsInternal(key);
    }
    return totalPruned;
  }

  /**
   * Builds a storage key from config path components.
   */
  private buildKey(configPath: string, layer: string, sourceId: string | null): string {
    return `${layer}:${sourceId ?? "null"}:${configPath}`;
  }

  /**
   * Internal prune logic for a specific key.
   */
  private pruneVersionsInternal(key: string): number {
    const versions = this.snapshots.get(key);
    if (!versions) {
      return 0;
    }

    const cutoffTime = Date.now() - this.maxVersionAgeMs;
    const toRemove: number[] = [];

    // Find versions to remove (too old or exceeds max count)
    for (let i = 0; i < versions.length; i++) {
      const version = versions[i]!;
      const versionTime = new Date(version.createdAt).getTime();

      if (versionTime < cutoffTime || i >= this.maxVersionsPerPath) {
        toRemove.push(i);
      }
    }

    if (toRemove.length === 0) {
      return 0;
    }

    // Remove in reverse order to maintain indices
    for (let i = toRemove.length - 1; i >= 0; i--) {
      versions.splice(toRemove[i]!, 1);
    }

    return toRemove.length;
  }

  /**
   * Emits a version event to the event bus.
   */
  private emitVersionEvent(eventType: string, snapshot: ConfigVersionSnapshot): void {
    if (!this.eventBus) {
      return;
    }

    this.eventBus.publish({
      eventType,
      payload: {
        versionId: snapshot.versionId,
        configPath: snapshot.configPath,
        layer: snapshot.layer,
        sourceId: snapshot.sourceId,
        contentHash: snapshot.contentHash,
        createdAt: snapshot.createdAt,
        createdBy: snapshot.createdBy,
        reason: snapshot.reason,
        parentVersionId: snapshot.parentVersionId,
      },
    });
  }

  /**
   * Emits a rollback point event to the event bus.
   */
  private emitRollbackPointEvent(eventType: string, rollbackPoint: ConfigRollbackPoint): void {
    if (!this.eventBus) {
      return;
    }

    this.eventBus.publish({
      eventType,
      payload: {
        rollbackId: rollbackPoint.rollbackId,
        versionId: rollbackPoint.versionId,
        configPath: rollbackPoint.configPath,
        layer: rollbackPoint.layer,
        createdAt: rollbackPoint.createdAt,
        createdBy: rollbackPoint.createdBy,
      },
    });
  }
}
