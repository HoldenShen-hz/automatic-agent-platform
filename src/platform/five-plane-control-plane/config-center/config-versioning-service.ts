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
  /** Event bus for emitting and subscribing to version events */
  eventBus?: DurableEventBus | null;
  /** Maximum number of versions to retain per config path (default: 50) */
  maxVersionsPerPath?: number;
  /** Maximum age of versions in milliseconds (default: 30 days) */
  maxVersionAgeMs?: number;
  /** Whether to persist events for replay on startup (default: true) */
  persistEvents?: boolean;
}

/**
 * Event payload for version creation (for event sourcing).
 */
interface ConfigVersionCreatedPayload {
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
}

/**
 * Event payload for rollback point creation.
 */
interface ConfigRollbackPointCreatedPayload {
  rollbackId: string;
  versionId: string;
  configPath: string;
  layer: string;
  createdAt: string;
  createdBy: string;
}

/**
 * Service for managing configuration versioning, diffs, and rollbacks.
 * Per §24.2: Implements event sourcing for complete history + rollback capability.
 * §24.2/R15-78: Version history is persisted via DurableEventBus and rebuilt on startup.
 *
 * Stores snapshots of configuration at each change, enabling:
 * - Tracking configuration history (event-sourced via DurableEventBus)
 * - Comparing any two versions
 * - Rolling back to previous configurations
 * - Audit trail of changes
 *
 * The event bus provides durability - even if the process restarts,
 * the events are replayed to rebuild the complete version history.
 */
export class ConfigVersioningService {
  private readonly eventBus: DurableEventBus | null;
  private readonly maxVersionsPerPath: number;
  private readonly maxVersionAgeMs: number;
  private readonly persistEvents: boolean;
  private _initialized = false;
  private _initPromise: Promise<void> | null = null;

  /** In-memory storage for version snapshots (rebuilt from events on init) */
  private readonly snapshots = new Map<string, ConfigVersionSnapshot[]>();

  /** In-memory storage for rollback points (rebuilt from events on init) */
  private readonly rollbackPoints = new Map<string, ConfigRollbackPoint[]>();

  public constructor(options: ConfigVersioningServiceOptions = {}) {
    this.eventBus = options.eventBus ?? null;
    this.maxVersionsPerPath = options.maxVersionsPerPath ?? 50;
    this.maxVersionAgeMs = options.maxVersionAgeMs ?? 30 * 24 * 60 * 60 * 1000;
    this.persistEvents = options.persistEvents ?? true;
  }

  /**
   * Initializes the service by subscribing to events and rebuilding state.
   * §24.2/R15-78: Ensures version history is rebuilt from persisted events on startup.
   * Automatically initializes on first use if not already initialized.
   */
  public async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    // Prevent concurrent initialization
    if (this._initPromise) {
      return this._initPromise;
    }

    if (!this.eventBus) {
      this._initialized = true;
      return;
    }

    this._initPromise = this.doInitialize();
    await this._initPromise;
    this._initialized = true;
  }

  /**
   * Internal initialization that subscribes to events for replay.
   */
  private async doInitialize(): Promise<void> {
    if (!this.eventBus) {
      return;
    }

    // Subscribe to version events for replay
    // These events contain the full content, enabling complete state rebuild
    await this.eventBus.subscribe(
      "config.version.created",
      async (event) => {
        const payload = JSON.parse(event.payloadJson) as ConfigVersionCreatedPayload;
        this.handleVersionCreatedEvent(payload);
      },
    );
    await this.eventBus.subscribe(
      "config.rollback_point.created",
      async (event) => {
        const payload = JSON.parse(event.payloadJson) as ConfigRollbackPointCreatedPayload;
        this.handleRollbackPointCreatedEvent(payload);
      },
    );
    // Also handle rollback events for replay
    await this.eventBus.subscribe(
      "config.version.rollback",
      async (event) => {
        const payload = JSON.parse(event.payloadJson) as ConfigVersionCreatedPayload;
        this.handleVersionCreatedEvent(payload);
      },
    );
  }

  /**
   * Ensures the service is initialized before operations.
   * Calls initialize() if not already initialized.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this._initialized) {
      await this.initialize();
    }
  }

  /**
   * Creates a new version snapshot for a configuration.
   * §24.2/R15-78: Ensures initialization is complete before creating version.
   *
   * @param configPath - Dot-notation path to the config
   * @param layer - Hierarchy layer
   * @param sourceId - Source ID if applicable
   * @param content - Full configuration content
   * @param createdBy - Actor who created this version
   * @param reason - Reason for the change
   * @returns The created version snapshot
   */
  public async createVersion(
    configPath: string,
    layer: string,
    sourceId: string | null,
    content: Record<string, unknown>,
    createdBy: string | null = null,
    reason: string | null = null,
  ): Promise<ConfigVersionSnapshot> {
    // §24.2/R15-78: Ensure we are initialized before creating versions
    // This guarantees events will be properly captured for replay
    await this.ensureInitialized();

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
    this.pruneVersionsInternal(key);

    // Emit event for durability
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
  public async getCurrentVersion(
    configPath: string,
    layer: string,
    sourceId: string | null,
  ): Promise<ConfigVersionSnapshot | null> {
    await this.ensureInitialized();
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
  public async getVersion(versionId: string): Promise<ConfigVersionSnapshot | null> {
    await this.ensureInitialized();
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
  public async getVersionHistory(
    configPath: string,
    layer: string,
    sourceId: string | null,
  ): Promise<ConfigVersionSnapshot[]> {
    await this.ensureInitialized();
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
  public async diffVersions(versionA: string, versionB: string): Promise<ConfigVersionDiff | null> {
    const snapshotA = await this.getVersion(versionA);
    const snapshotB = await this.getVersion(versionB);

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
  public async createRollbackPoint(
    configPath: string,
    layer: string,
    sourceId: string | null,
    createdBy: string,
  ): Promise<ConfigRollbackPoint | null> {
    const currentVersion = await this.getCurrentVersion(configPath, layer, sourceId);
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
  public async getRollbackPoints(
    configPath: string,
    layer: string,
    sourceId: string | null,
  ): Promise<ConfigRollbackPoint[]> {
    await this.ensureInitialized();
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
  public async rollback(
    versionId: string,
    createdBy: string,
    reason: string | null = null,
  ): Promise<ConfigVersionSnapshot | null> {
    const targetVersion = await this.getVersion(versionId);
    if (!targetVersion) {
      return null;
    }

    // Create a new version with the old content
    // R16-36 FIX #2120: Shallow copy `{...content}` doesn't deep-clone nested objects.
    // Nested objects would share references, causing mutations in one version to affect
    // another. Use structured clone for proper deep copy.
    const rollbackVersion = await this.createVersion(
      targetVersion.configPath,
      targetVersion.layer,
      targetVersion.sourceId,
      structuredClone(targetVersion.content),
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
  public async getVersionContent(versionId: string): Promise<Record<string, unknown> | null> {
    const version = await this.getVersion(versionId);
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
  public async pruneVersions(
    configPath: string,
    layer: string,
    sourceId: string | null,
  ): Promise<number> {
    await this.ensureInitialized();
    const key = this.buildKey(configPath, layer, sourceId);
    return this.pruneVersionsInternal(key);
  }

  /**
   * Cleans up all old versions across all config paths.
   *
   * @returns Number of versions pruned
   */
  public async pruneAllVersions(): Promise<number> {
    await this.ensureInitialized();
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
      this.snapshots.delete(key);
      return totalPruned;
    }

    this.snapshots.set(key, retainedVersions);
    return totalPruned;
  }

  /**
   * Emits a version event to the event bus for persistence and replay.
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
        content: snapshot.content, // Include content for full event replay
        contentHash: snapshot.contentHash,
        createdAt: snapshot.createdAt,
        createdBy: snapshot.createdBy,
        reason: snapshot.reason,
        parentVersionId: snapshot.parentVersionId,
      },
    });

    // Emit config.changed for all version creation events per §24.2
    // This includes normal versions and rollbacks
    this.eventBus.publish({
      eventType: "config.changed",
      payload: {
        configPath: snapshot.configPath,
        layer: snapshot.layer,
        sourceId: snapshot.sourceId,
        versionId: snapshot.versionId,
        contentHash: snapshot.contentHash,
        changedAt: snapshot.createdAt,
        reason: snapshot.reason,
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

  /**
   * Handles version created event for event sourcing replay.
   */
  private handleVersionCreatedEvent(payload: ConfigVersionCreatedPayload): void {
    const key = this.buildKey(payload.configPath, payload.layer, payload.sourceId);
    const versions = this.snapshots.get(key) ?? [];

    // Only add if not already present (idempotent replay)
    if (!versions.find((v) => v.versionId === payload.versionId)) {
      versions.push({
        versionId: payload.versionId,
        configPath: payload.configPath,
        layer: payload.layer,
        sourceId: payload.sourceId,
        content: payload.content,
        contentHash: payload.contentHash,
        createdAt: payload.createdAt,
        createdBy: payload.createdBy,
        reason: payload.reason,
        parentVersionId: payload.parentVersionId,
      });
      this.snapshots.set(key, versions);
    }
  }

  /**
   * Handles rollback point created event for event sourcing replay.
   */
  private handleRollbackPointCreatedEvent(payload: ConfigRollbackPointCreatedPayload): void {
    const key = this.buildKey(payload.configPath, payload.layer, null);
    const points = this.rollbackPoints.get(key) ?? [];

    // Only add if not already present (idempotent replay)
    if (!points.find((p) => p.rollbackId === payload.rollbackId)) {
      points.push({
        rollbackId: payload.rollbackId,
        versionId: payload.versionId,
        configPath: payload.configPath,
        layer: payload.layer,
        createdAt: payload.createdAt,
        createdBy: payload.createdBy,
      });
      this.rollbackPoints.set(key, points);
    }
  }
}
