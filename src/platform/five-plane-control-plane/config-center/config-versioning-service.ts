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

import { DurableEventBus } from "../../five-plane-state-evidence/events/durable-event-bus.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { ValidationError } from "../../contracts/errors.js";
import {
  diffObjects,
  sha256,
  stableStringify,
  type ConfigDiffEntry,
} from "./config-governance-support.js";
import type { SqliteConnection } from "../../five-plane-state-evidence/truth/sqlite/query-helper.js";
import { queryAllOrEmpty, execute } from "../../five-plane-state-evidence/truth/sqlite/query-helper.js";

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
  /** SQLite connection for durable storage (R10-07) */
  sqliteDb?: SqliteConnection | null;
}

/**
 * Service for managing configuration versioning, diffs, and rollbacks.
 *
 * Stores snapshots of configuration at each change, enabling:
 * - Tracking configuration history
 * - Comparing any two versions
 * - Rolling back to previous configurations
 * - Audit trail of changes
 *
 * R10-07: Supports durable SQLite storage for snapshots and rollback points.
 */
export class ConfigVersioningService {
  private readonly eventBus: DurableEventBus | null;
  private readonly maxVersionsPerPath: number;
  private readonly maxVersionAgeMs: number;
  private readonly sqliteDb: SqliteConnection | null;
  private readonly useDurableStorage: boolean;

  /** In-memory storage for version snapshots (fallback when no SQLite) */
  private readonly snapshots = new Map<string, ConfigVersionSnapshot[]>();

  /** In-memory storage for rollback points (fallback when no SQLite) */
  private readonly rollbackPoints = new Map<string, ConfigRollbackPoint[]>();

  public constructor(options: ConfigVersioningServiceOptions = {}) {
    this.eventBus = options.eventBus ?? null;
    this.maxVersionsPerPath = options.maxVersionsPerPath ?? 50;
    this.maxVersionAgeMs = options.maxVersionAgeMs ?? 30 * 24 * 60 * 60 * 1000;
    this.sqliteDb = options.sqliteDb ?? null;
    this.useDurableStorage = this.sqliteDb != null;

    if (this.useDurableStorage) {
      this.initializeDurableStorage();
    }
  }

  /**
   * R10-07: Initialize SQLite tables for durable storage.
   */
  private initializeDurableStorage(): void {
    if (!this.sqliteDb) return;

    this.sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS config_version_snapshots (
        snapshot_id TEXT PRIMARY KEY,
        config_path TEXT NOT NULL,
        layer TEXT NOT NULL,
        source_id TEXT,
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_by TEXT,
        reason TEXT,
        parent_version_id TEXT,
        key TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_config_versions_key ON config_version_snapshots(key);
      CREATE INDEX IF NOT EXISTS idx_config_versions_created_at ON config_version_snapshots(created_at);

      CREATE TABLE IF NOT EXISTS config_rollback_points (
        rollback_id TEXT PRIMARY KEY,
        version_id TEXT NOT NULL,
        config_path TEXT NOT NULL,
        layer TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        key TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_rollback_points_key ON config_rollback_points(key);
    `);
  }

  /**
   * R10-07: Load snapshots from SQLite for a given key.
   */
  private loadSnapshotsFromDb(key: string): ConfigVersionSnapshot[] {
    if (!this.sqliteDb) return [];

    interface SnapshotRow {
      snapshot_id: string;
      config_path: string;
      layer: string;
      source_id: string | null;
      content: string;
      content_hash: string;
      created_at: string;
      created_by: string | null;
      reason: string | null;
      parent_version_id: string | null;
    }

    const rows = queryAllOrEmpty<SnapshotRow>(
      this.sqliteDb,
      `SELECT * FROM config_version_snapshots WHERE key = ? ORDER BY created_at ASC`,
      key,
    );

    return rows.map((row) => ({
      versionId: row.snapshot_id,
      configPath: row.config_path,
      layer: row.layer,
      sourceId: row.source_id,
      content: JSON.parse(row.content),
      contentHash: row.content_hash,
      createdAt: row.created_at,
      createdBy: row.created_by,
      reason: row.reason,
      parentVersionId: row.parent_version_id,
    }));
  }

  /**
   * R10-07: Load rollback points from SQLite for a given key.
   */
  private loadRollbackPointsFromDb(key: string): ConfigRollbackPoint[] {
    if (!this.sqliteDb) return [];

    interface RollbackRow {
      rollback_id: string;
      version_id: string;
      config_path: string;
      layer: string;
      created_at: string;
      created_by: string;
    }

    const rows = queryAllOrEmpty<RollbackRow>(
      this.sqliteDb,
      `SELECT * FROM config_rollback_points WHERE key = ? ORDER BY created_at ASC`,
      key,
    );

    return rows.map((row) => ({
      rollbackId: row.rollback_id,
      versionId: row.version_id,
      configPath: row.config_path,
      layer: row.layer,
      createdAt: row.created_at,
      createdBy: row.created_by,
    }));
  }

  /**
   * R10-07: Save a snapshot to SQLite.
   */
  private saveSnapshotToDb(key: string, snapshot: ConfigVersionSnapshot): void {
    if (!this.sqliteDb) return;

    execute(
      this.sqliteDb,
      `INSERT OR REPLACE INTO config_version_snapshots
       (snapshot_id, config_path, layer, source_id, content, content_hash, created_at, created_by, reason, parent_version_id, key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      snapshot.versionId,
      snapshot.configPath,
      snapshot.layer,
      snapshot.sourceId,
      JSON.stringify(snapshot.content),
      snapshot.contentHash,
      snapshot.createdAt,
      snapshot.createdBy,
      snapshot.reason,
      snapshot.parentVersionId,
      key,
    );
  }

  /**
   * R10-07: Save a rollback point to SQLite.
   */
  private saveRollbackPointToDb(key: string, point: ConfigRollbackPoint): void {
    if (!this.sqliteDb) return;

    execute(
      this.sqliteDb,
      `INSERT OR REPLACE INTO config_rollback_points
       (rollback_id, version_id, config_path, layer, created_at, created_by, key)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      point.rollbackId,
      point.versionId,
      point.configPath,
      point.layer,
      point.createdAt,
      point.createdBy,
      key,
    );
  }

  /**
   * R10-07: Get snapshots for a key, loading from DB if using durable storage.
   */
  private getSnapshots(key: string): ConfigVersionSnapshot[] {
    if (this.useDurableStorage) {
      return this.loadSnapshotsFromDb(key);
    }
    return this.snapshots.get(key) ?? [];
  }

  /**
   * R10-07: Set snapshots for a key, saving to DB if using durable storage.
   */
  private setSnapshots(key: string, snapshots: ConfigVersionSnapshot[]): void {
    if (this.useDurableStorage) {
      if (this.sqliteDb) {
        this.runDurableWriteTransaction(() => {
          execute(this.sqliteDb!, `DELETE FROM config_version_snapshots WHERE key = ?`, key);
          for (const snapshot of snapshots) {
            this.saveSnapshotToDb(key, snapshot);
          }
        });
      }
    } else {
      this.snapshots.set(key, snapshots);
    }
  }

  /**
   * R10-07: Get rollback points for a key, loading from DB if using durable storage.
   */
  private getRollbackPointsForKey(key: string): ConfigRollbackPoint[] {
    if (this.useDurableStorage) {
      return this.loadRollbackPointsFromDb(key);
    }
    return this.rollbackPoints.get(key) ?? [];
  }

  /**
   * R10-07: Set rollback points for a key, saving to DB if using durable storage.
   */
  private setRollbackPoints(key: string, points: ConfigRollbackPoint[]): void {
    if (this.useDurableStorage) {
      if (this.sqliteDb) {
        this.runDurableWriteTransaction(() => {
          execute(this.sqliteDb!, `DELETE FROM config_rollback_points WHERE key = ?`, key);
          for (const point of points) {
            this.saveRollbackPointToDb(key, point);
          }
        });
      }
    } else {
      this.rollbackPoints.set(key, points);
    }
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
    const versions = this.getSnapshots(key);

    // Get parent version ID
    const parentVersionId = versions.at(-1)?.versionId ?? null;

    // Create new snapshot
    const snapshot: ConfigVersionSnapshot = {
      versionId: newId("ver"),
      configPath,
      layer,
      sourceId,
      content: cloneConfigContent(content),
      contentHash: sha256(stableStringify(content)),
      createdAt: nowIso(),
      createdBy,
      reason,
      parentVersionId,
    };

    // Add to versions list
    versions.push(snapshot);
    this.setSnapshots(key, versions);

    // Cleanup old versions
    this.pruneVersionsInternal(key);

    // Emit event - R5-54 fix: use correct event type for version creation
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
    const versions = this.getSnapshots(key);
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
    if (this.useDurableStorage && this.sqliteDb) {
      // For durable storage, we need to search across all keys
      // This is less efficient but necessary for ID-based lookups
      interface SnapshotRow {
        snapshot_id: string;
        config_path: string;
        layer: string;
        source_id: string | null;
        content: string;
        content_hash: string;
        created_at: string;
        created_by: string | null;
        reason: string | null;
        parent_version_id: string | null;
      }
      const rows = queryAllOrEmpty<SnapshotRow>(
        this.sqliteDb,
        `SELECT * FROM config_version_snapshots WHERE snapshot_id = ?`,
        versionId,
      );
      if (rows.length === 0) return null;
      const row = rows[0]!;
      return {
        versionId: row.snapshot_id,
        configPath: row.config_path,
        layer: row.layer,
        sourceId: row.source_id,
        content: JSON.parse(row.content),
        contentHash: row.content_hash,
        createdAt: row.created_at,
        createdBy: row.created_by,
        reason: row.reason,
        parentVersionId: row.parent_version_id,
      };
    }

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
    return this.getSnapshots(key);
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
    const points = this.getRollbackPointsForKey(key);

    const rollbackPoint: ConfigRollbackPoint = {
      rollbackId: newId("rbp"),
      versionId: currentVersion.versionId,
      configPath,
      layer,
      createdAt: nowIso(),
      createdBy,
    };

    points.push(rollbackPoint);
    this.setRollbackPoints(key, points);

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
    return this.getRollbackPointsForKey(key);
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
    const currentVersion = this.getCurrentVersion(
      targetVersion.configPath,
      targetVersion.layer,
      targetVersion.sourceId,
    );
    this.assertRollbackCompatibility(currentVersion, targetVersion);

    // Create a new version with the old content
    const rollbackVersion = this.createVersion(
      targetVersion.configPath,
      targetVersion.layer,
      targetVersion.sourceId,
      cloneConfigContent(targetVersion.content),
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
    return version ? cloneConfigContent(version.content) : null;
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
    if (this.useDurableStorage && this.sqliteDb) {
      // For durable storage, get distinct keys from the database
      interface KeyRow { key: string; }
      const keys = queryAllOrEmpty<KeyRow>(
        this.sqliteDb,
        `SELECT DISTINCT key FROM config_version_snapshots`,
      );
      for (const { key } of keys) {
        totalPruned += this.pruneVersionsInternal(key);
      }
    } else {
      for (const key of this.snapshots.keys()) {
        totalPruned += this.pruneVersionsInternal(key);
      }
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
    const versions = this.getSnapshots(key);
    if (!versions || versions.length === 0) {
      return 0;
    }

    const cutoffTime = Date.now() - this.maxVersionAgeMs;
    const freshVersions = versions.filter((version) => {
      const versionTime = new Date(version.createdAt).getTime();
      return versionTime >= cutoffTime;
    });
    const countPrunedByAge = versions.length - freshVersions.length;
    const retainedVersions =
      freshVersions.length <= this.maxVersionsPerPath
        ? freshVersions
        : freshVersions.slice(-this.maxVersionsPerPath);
    const totalPruned = versions.length - retainedVersions.length;

    if (totalPruned === 0) {
      return 0;
    }

    if (countPrunedByAge === versions.length) {
      // All versions pruned - delete from storage
      if (this.useDurableStorage && this.sqliteDb) {
        this.runDurableWriteTransaction(() => {
          execute(this.sqliteDb!, `DELETE FROM config_version_snapshots WHERE key = ?`, key);
        });
      } else {
        this.snapshots.delete(key);
      }
      return totalPruned;
    }

    this.setSnapshots(key, retainedVersions);
    return totalPruned;
  }

  private runDurableWriteTransaction(operation: () => void): void {
    if (!this.sqliteDb) {
      operation();
      return;
    }
    this.sqliteDb.exec("BEGIN IMMEDIATE");
    try {
      operation();
      this.sqliteDb.exec("COMMIT");
    } catch (error) {
      this.sqliteDb.exec("ROLLBACK");
      throw error;
    }
  }

  private assertRollbackCompatibility(
    currentVersion: ConfigVersionSnapshot | null,
    targetVersion: ConfigVersionSnapshot,
  ): void {
    if (currentVersion == null) {
      return;
    }
    const currentSchemaVersion = readSchemaVersion(currentVersion.content);
    const targetSchemaVersion = readSchemaVersion(targetVersion.content);
    if (
      currentSchemaVersion != null &&
      targetSchemaVersion != null &&
      currentSchemaVersion !== targetSchemaVersion
    ) {
      throw new ValidationError(
        "config.rollback_incompatible_schema_version",
        "config.rollback_incompatible_schema_version",
      );
    }
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

function cloneConfigContent(content: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(content) as Record<string, unknown>;
}

function readSchemaVersion(content: Record<string, unknown>): string | null {
  const schemaVersion = content["schemaVersion"] ?? content["schema_version"];
  return typeof schemaVersion === "string" && schemaVersion.length > 0 ? schemaVersion : null;
}
