/**
 * ConfigRolloutRepository - Data access for config rollouts and version snapshots.
 *
 * This repository handles persistence for:
 * - ConfigVersionSnapshot records (config_version_snapshots table)
 * - ConfigRollbackPoint records (config_rollback_points table)
 * - ConfigRollout records (config_rollouts table)
 *
 * R15-78: Provides durable storage for ConfigVersioningService.
 * R15-79: Provides durable storage for ConfigRolloutService via ConfigRolloutStore interface.
 */

import type { SqliteConnection } from "../query-helper.js";
import { execute, queryAll, queryOne } from "../query-helper.js";
import { stableStringify } from "../../../../control-plane/config-center/config-governance-support.js";
import type {
  ConfigRollout,
  RolloutStage,
} from "../../../../control-plane/config-center/config-rollout-service.js";

/**
 * Represents a config version snapshot stored in the database.
 */
export interface ConfigVersionSnapshotRecord {
  versionId: string;
  configPath: string;
  layer: string;
  sourceId: string | null;
  contentJson: string;
  contentHash: string;
  createdAt: string;
  createdBy: string | null;
  reason: string | null;
  parentVersionId: string | null;
}

/**
 * Represents a config rollback point stored in the database.
 */
export interface ConfigRollbackPointRecord {
  rollbackId: string;
  versionId: string;
  configPath: string;
  layer: string;
  createdAt: string;
  createdBy: string;
}

/**
 * Represents a config rollout stored in the database (flattened for SQL).
 */
export interface ConfigRolloutRecord {
  rolloutId: string;
  configPath: string;
  layer: string;
  sourceId: string | null;
  stagePhase: string;
  stagePercentage: number;
  stageMinDurationMs: number;
  stageAutoProgress: boolean;
  startedAt: string;
  updatedAt: string;
  targetPercentage: number;
  currentPercentage: number;
  metadataJson: string | null;
  healthGatesJson: string;
  lastHealthCheckAt: string | null;
  lastHealthCheckPassed: boolean | null;
}

/**
 * Repository for persisting config version snapshots and rollback points.
 * R15-78: Provides durable storage for ConfigVersioningService.
 */
export class ConfigVersionSnapshotRepository {
  public constructor(private readonly conn: SqliteConnection) {}

  /**
   * Insert a new config version snapshot.
   */
  public insert(snapshot: ConfigVersionSnapshotRecord): void {
    execute(
      this.conn,
      `INSERT INTO config_version_snapshots (
        version_id, config_path, layer, source_id, content_json, content_hash,
        created_at, created_by, reason, parent_version_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      snapshot.versionId,
      snapshot.configPath,
      snapshot.layer,
      snapshot.sourceId,
      snapshot.contentJson,
      snapshot.contentHash,
      snapshot.createdAt,
      snapshot.createdBy,
      snapshot.reason,
      snapshot.parentVersionId,
    );
  }

  /**
   * Get a snapshot by version ID.
   */
  public getByVersionId(versionId: string): ConfigVersionSnapshotRecord | undefined {
    return queryOne<ConfigVersionSnapshotRecord>(
      this.conn,
      `SELECT
        version_id AS versionId, config_path AS configPath, layer,
        source_id AS sourceId, content_json AS contentJson, content_hash AS contentHash,
        created_at AS createdAt, created_by AS createdBy, reason, parent_version_id AS parentVersionId
       FROM config_version_snapshots WHERE version_id = ?`,
      versionId,
    );
  }

  /**
   * Get all snapshots for a config path, ordered by creation time.
   */
  public getByConfigPath(
    configPath: string,
    layer: string,
    sourceId: string | null,
  ): ConfigVersionSnapshotRecord[] {
    return queryAll<ConfigVersionSnapshotRecord>(
      this.conn,
      `SELECT
        version_id AS versionId, config_path AS configPath, layer,
        source_id AS sourceId, content_json AS contentJson, content_hash AS contentHash,
        created_at AS createdAt, created_by AS createdBy, reason, parent_version_id AS parentVersionId
       FROM config_version_snapshots
       WHERE config_path = ? AND layer = ? AND source_id = ?
       ORDER BY created_at ASC`,
      configPath,
      layer,
      sourceId,
    );
  }

  /**
   * Delete snapshots older than a given timestamp.
   */
  public deleteOlderThan(cutoffAt: string): number {
    return execute(
      this.conn,
      `DELETE FROM config_version_snapshots WHERE created_at < ?`,
      cutoffAt,
    );
  }

  /**
   * Delete snapshots exceeding maxCount for a given path.
   * Keeps the newest maxCount snapshots.
   */
  public deleteExcessByPath(
    configPath: string,
    layer: string,
    sourceId: string | null,
    maxCount: number,
  ): number {
    // Get IDs of snapshots to keep (newest maxCount)
    const toKeep = queryAll<{ versionId: string }>(
      this.conn,
      `SELECT version_id AS versionId
       FROM config_version_snapshots
       WHERE config_path = ? AND layer = ? AND source_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      configPath,
      layer,
      sourceId,
      maxCount,
    );

    if (toKeep.length === 0) {
      return 0;
    }

    const idsToDelete = toKeep.map((r) => r.versionId);
    return execute(
      this.conn,
      `DELETE FROM config_version_snapshots
       WHERE config_path = ? AND layer = ? AND source_id = ?
       AND version_id NOT IN (${idsToDelete.map(() => "?").join(",")})`,
      configPath,
      layer,
      sourceId,
      ...idsToDelete,
    );
  }
}

/**
 * Repository for persisting config rollback points.
 * R15-78: Provides durable storage for ConfigVersioningService rollback points.
 */
export class ConfigRollbackPointRepository {
  public constructor(private readonly conn: SqliteConnection) {}

  /**
   * Insert a new rollback point.
   */
  public insert(point: ConfigRollbackPointRecord): void {
    execute(
      this.conn,
      `INSERT INTO config_rollback_points (
        rollback_id, version_id, config_path, layer, created_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      point.rollbackId,
      point.versionId,
      point.configPath,
      point.layer,
      point.createdAt,
      point.createdBy,
    );
  }

  /**
   * Get rollback points for a config path.
   */
  public getByConfigPath(
    configPath: string,
    layer: string,
  ): ConfigRollbackPointRecord[] {
    return queryAll<ConfigRollbackPointRecord>(
      this.conn,
      `SELECT
        rollback_id AS rollbackId, version_id AS versionId, config_path AS configPath,
        layer, created_at AS createdAt, created_by AS createdBy
       FROM config_rollback_points
       WHERE config_path = ? AND layer = ?
       ORDER BY created_at DESC`,
      configPath,
      layer,
    );
  }
}

/**
 * Repository for persisting active config rollouts.
 * R15-79: Implements ConfigRolloutStore interface for ConfigRolloutService.
 */
export class ConfigRolloutRepository {
  public constructor(private readonly conn: SqliteConnection) {}

  /**
   * Save a rollout to the database.
   */
  public save(rollout: ConfigRolloutRecord): void {
    execute(
      this.conn,
      `INSERT OR REPLACE INTO config_rollouts (
        rollout_id, config_path, layer, source_id,
        stage_phase, stage_percentage, stage_min_duration_ms, stage_auto_progress,
        started_at, updated_at, target_percentage, current_percentage,
        metadata_json, health_gates_json,
        last_health_check_at, last_health_check_passed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      rollout.rolloutId,
      rollout.configPath,
      rollout.layer,
      rollout.sourceId,
      rollout.stagePhase,
      rollout.stagePercentage,
      rollout.stageMinDurationMs,
      rollout.stageAutoProgress ? 1 : 0,
      rollout.startedAt,
      rollout.updatedAt,
      rollout.targetPercentage,
      rollout.currentPercentage,
      rollout.metadataJson,
      rollout.healthGatesJson,
      rollout.lastHealthCheckAt,
      rollout.lastHealthCheckPassed !== null ? (rollout.lastHealthCheckPassed ? 1 : 0) : null,
    );
  }

  /**
   * Load a rollout by ID.
   */
  public load(rolloutId: string): ConfigRolloutRecord | undefined {
    return queryOne<ConfigRolloutRecord>(
      this.conn,
      `SELECT
        rollout_id AS rolloutId, config_path AS configPath, layer, source_id,
        stage_phase AS stagePhase, stage_percentage AS stagePercentage,
        stage_min_duration_ms AS stageMinDurationMs,
        stage_auto_progress AS stageAutoProgress,
        started_at AS startedAt, updated_at AS updatedAt,
        target_percentage AS targetPercentage, current_percentage AS currentPercentage,
        metadata_json AS metadataJson, health_gates_json AS healthGatesJson,
        last_health_check_at AS lastHealthCheckAt, last_health_check_passed AS lastHealthCheckPassed
       FROM config_rollouts WHERE rollout_id = ?`,
      rolloutId,
    );
  }

  /**
   * Load all active rollouts (not FULL or CANCELLED).
   */
  public loadAllActive(): ConfigRolloutRecord[] {
    return queryAll<ConfigRolloutRecord>(
      this.conn,
      `SELECT
        rollout_id AS rolloutId, config_path AS configPath, layer, source_id,
        stage_phase AS stagePhase, stage_percentage AS stagePercentage,
        stage_min_duration_ms AS stageMinDurationMs,
        stage_auto_progress AS stageAutoProgress,
        started_at AS startedAt, updated_at AS updatedAt,
        target_percentage AS targetPercentage, current_percentage AS currentPercentage,
        metadata_json AS metadataJson, health_gates_json AS healthGatesJson,
        last_health_check_at AS lastHealthCheckAt, last_health_check_passed AS lastHealthCheckPassed
       FROM config_rollouts
       WHERE stage_phase NOT IN ('full', 'cancelled')`,
    );
  }

  /**
   * Load all rollouts.
   */
  public loadAll(): ConfigRolloutRecord[] {
    return queryAll<ConfigRolloutRecord>(
      this.conn,
      `SELECT
        rollout_id AS rolloutId, config_path AS configPath, layer, source_id,
        stage_phase AS stagePhase, stage_percentage AS stagePercentage,
        stage_min_duration_ms AS stageMinDurationMs,
        stage_auto_progress AS stageAutoProgress,
        started_at AS startedAt, updated_at AS updatedAt,
        target_percentage AS targetPercentage, current_percentage AS currentPercentage,
        metadata_json AS metadataJson, health_gates_json AS healthGatesJson,
        last_health_check_at AS lastHealthCheckAt, last_health_check_passed AS lastHealthCheckPassed
       FROM config_rollouts`,
    );
  }

  /**
   * Delete a rollout by ID.
   */
  public delete(rolloutId: string): number {
    return execute(
      this.conn,
      `DELETE FROM config_rollouts WHERE rollout_id = ?`,
      rolloutId,
    );
  }
}

/**
 * Implements ConfigRolloutStore interface using SQLite.
 * R15-79: Provides durable storage for ConfigRolloutService.
 */
export class SqliteConfigRolloutStore {
  public constructor(private readonly conn: SqliteConnection) {}

  public async save(rollout: ConfigRollout): Promise<void> {
    const record: ConfigRolloutRecord = {
      rolloutId: rollout.rolloutId,
      configPath: rollout.configPath,
      layer: rollout.layer,
      sourceId: rollout.sourceId,
      stagePhase: rollout.stage.phase,
      stagePercentage: rollout.stage.percentage,
      stageMinDurationMs: rollout.stage.minDurationMs,
      stageAutoProgress: rollout.stage.autoProgress,
      startedAt: rollout.startedAt,
      updatedAt: rollout.updatedAt,
      targetPercentage: rollout.targetPercentage,
      currentPercentage: rollout.currentPercentage,
      metadataJson: rollout.metadata ? stableStringify(rollout.metadata) : null,
      healthGatesJson: stableStringify(rollout.healthGates ?? null),
      lastHealthCheckAt: rollout.lastHealthCheckAt ?? null,
      lastHealthCheckPassed: rollout.lastHealthCheckPassed ?? null,
    };
    new ConfigRolloutRepository(this.conn).save(record);
  }

  public async load(rolloutId: string): Promise<ConfigRollout | null> {
    const record = new ConfigRolloutRepository(this.conn).load(rolloutId);
    if (!record) {
      return null;
    }
    return this.recordToRollout(record);
  }

  public async loadAll(): Promise<ConfigRollout[]> {
    const records = new ConfigRolloutRepository(this.conn).loadAll();
    return records.map((r) => this.recordToRollout(r));
  }

  public async delete(rolloutId: string): Promise<void> {
    new ConfigRolloutRepository(this.conn).delete(rolloutId);
  }

  private recordToRollout(record: ConfigRolloutRecord): ConfigRollout {
    // NOTE: lastObserved* fields are not persisted in ConfigRolloutRecord
    // and are set to null since they are computed at runtime during health checks.
    const result: ConfigRollout = {
      rolloutId: record.rolloutId,
      configPath: record.configPath,
      layer: record.layer,
      sourceId: record.sourceId,
      stage: {
        phase: record.stagePhase as RolloutStage["phase"],
        percentage: record.stagePercentage,
        minDurationMs: record.stageMinDurationMs,
        autoProgress: record.stageAutoProgress,
      },
      startedAt: record.startedAt,
      updatedAt: record.updatedAt,
      targetPercentage: record.targetPercentage,
      currentPercentage: record.currentPercentage,
      metadata: record.metadataJson ? JSON.parse(record.metadataJson) : undefined,
      healthGates: JSON.parse(record.healthGatesJson),
      lastHealthCheckAt: record.lastHealthCheckAt,
      lastHealthCheckPassed: record.lastHealthCheckPassed,
      // These fields are not persisted and are populated at runtime
      lastObservedErrorRate: null as number | null,
      lastObservedLatencyRegression: null as number | null,
      lastObservedIncidentRate: null as number | null,
      lastHealthCheckReasons: [] as string[],
    };
    return result;
  }
}

/**
 * SQLite-backed implementation of ConfigVersioningService persistence.
 * R15-78: Persists version snapshots and rollback points to SQLite.
 */
export class SqliteConfigVersionStore {
  public constructor(private readonly conn: SqliteConnection) {}

  /**
   * Save a version snapshot to the database.
   */
  public saveSnapshot(snapshot: {
    versionId: string;
    configPath: string;
    layer: string;
    sourceId: string | null;
    content: Record<string, unknown>;
    contentHash: string;
    createdAt: string;
    createdBy: string | null;
    reason: string | null;
    parentVersionId: string | null;
  }): void {
    const record: ConfigVersionSnapshotRecord = {
      versionId: snapshot.versionId,
      configPath: snapshot.configPath,
      layer: snapshot.layer,
      sourceId: snapshot.sourceId,
      contentJson: stableStringify(snapshot.content),
      contentHash: snapshot.contentHash,
      createdAt: snapshot.createdAt,
      createdBy: snapshot.createdBy,
      reason: snapshot.reason,
      parentVersionId: snapshot.parentVersionId,
    };
    new ConfigVersionSnapshotRepository(this.conn).insert(record);
  }

  /**
   * Load all snapshots for a config path.
   */
  public loadSnapshots(
    configPath: string,
    layer: string,
    sourceId: string | null,
  ): Array<{
    versionId: string;
    configPath: string;
    layer: string;
    sourceId: string | null;
    content: Record<string, unknown>;
    contentHash: string;
    createdAt: string;
    createdBy: string | null;
    reason: string | null;
    parentVersionId: string | null;
  }> {
    const records = new ConfigVersionSnapshotRepository(this.conn).getByConfigPath(
      configPath,
      layer,
      sourceId,
    );
    return records.map((r) => ({
      versionId: r.versionId,
      configPath: r.configPath,
      layer: r.layer,
      sourceId: r.sourceId,
      content: JSON.parse(r.contentJson),
      contentHash: r.contentHash,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
      reason: r.reason,
      parentVersionId: r.parentVersionId,
    }));
  }

  /**
   * Save a rollback point to the database.
   */
  public saveRollbackPoint(point: {
    rollbackId: string;
    versionId: string;
    configPath: string;
    layer: string;
    createdAt: string;
    createdBy: string;
  }): void {
    const record: ConfigRollbackPointRecord = {
      rollbackId: point.rollbackId,
      versionId: point.versionId,
      configPath: point.configPath,
      layer: point.layer,
      createdAt: point.createdAt,
      createdBy: point.createdBy,
    };
    new ConfigRollbackPointRepository(this.conn).insert(record);
  }

  /**
   * Load rollback points for a config path.
   */
  public loadRollbackPoints(
    configPath: string,
    layer: string,
  ): Array<{
    rollbackId: string;
    versionId: string;
    configPath: string;
    layer: string;
    createdAt: string;
    createdBy: string;
  }> {
    const records = new ConfigRollbackPointRepository(this.conn).getByConfigPath(
      configPath,
      layer,
    );
    return records.map((r) => ({
      rollbackId: r.rollbackId,
      versionId: r.versionId,
      configPath: r.configPath,
      layer: r.layer,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
    }));
  }
}
