/**
 * @fileoverview WAL Checkpoint Service
 *
 * Implements write-ahead logging and checkpointing for crash recovery:
 * - WAL entry types for all significant execution events
 * - Checkpoint creation at consistent points
 * - Crash recovery: replay WAL to rebuild in-memory state
 * - Projection rebuild via event replay
 * - Pruning old WAL entries
 *
 * @see docs_zh/contracts/ha_coordinator_and_leader_election_contract.md
 */

import { newId, nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import type {
  Checkpoint,
  CheckpointOptions,
  EventReplayPosition,
  EventReplayResult,
  HaLevel,
  HaLevelConfig,
  WalEntry,
  WalEntryType,
} from "./types.js";
import { HA_LEVEL_CONFIGS } from "./types.js";
import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";

// ── Logger ─────────────────────────────────────────────────────────

const logger = new StructuredLogger({ retentionLimit: 200 });

// ── DDL for WAL Tables ─────────────────────────────────────────────

export const WAL_CHECKPOINT_DDL = `
CREATE TABLE IF NOT EXISTS wal_entries (
  id TEXT PRIMARY KEY,
  entry_type TEXT NOT NULL,
  execution_id TEXT,
  task_id TEXT,
  session_id TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  checkpoint_id TEXT,
  sequence_number INTEGER NOT NULL,
  FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id)
);
CREATE INDEX IF NOT EXISTS idx_wal_entries_execution ON wal_entries(execution_id);
CREATE INDEX IF NOT EXISTS idx_wal_entries_type ON wal_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_wal_entries_created ON wal_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_wal_entries_sequence ON wal_entries(sequence_number);

CREATE TABLE IF NOT EXISTS checkpoints (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_wal_sequence INTEGER NOT NULL,
  metadata TEXT,
  FOREIGN KEY (execution_id) REFERENCES wal_entries(execution_id)
);
CREATE INDEX IF NOT EXISTS checkpoints_execution ON checkpoints(execution_id);
CREATE INDEX IF NOT EXISTS checkpoints_created ON checkpoints(created_at);

CREATE TABLE IF NOT EXISTS event_replay_positions (
  id TEXT PRIMARY KEY,
  consumer_name TEXT NOT NULL UNIQUE,
  last_processed_event_id TEXT,
  last_processed_sequence INTEGER NOT NULL DEFAULT 0,
  last_checkpoint_id TEXT,
  updated_at TEXT NOT NULL
);
`;

// ── Default Configuration ─────────────────────────────────────────

const DEFAULT_CHECKPOINT_INTERVAL_MS = 30_000; // 30 seconds
const DEFAULT_WAL_RETENTION_MS = 86_400_000; // 24 hours
const DEFAULT_BATCH_SIZE = 100;

/**
 * Options for creating a WalCheckpointService.
 */
export interface WalCheckpointServiceOptions {
  /** Database for persistence */
  db: AuthoritativeSqlDatabase;
  /** HA level (determines default intervals) */
  haLevel?: HaLevel;
  /** Override configuration */
  config?: Partial<HaLevelConfig>;
  /** Interval for automatic checkpoint creation */
  checkpointIntervalMs?: number;
  /** Retention period for WAL entries in ms */
  walRetentionMs?: number;
  /** Maximum entries to replay per batch */
  replayBatchSize?: number;
  /** Callback for checkpoint created */
  onCheckpointCreated?: (checkpoint: Checkpoint) => void;
  /** Callback for WAL entry written */
  onWalEntryWritten?: (entry: WalEntry) => void;
}

/**
 * WAL Checkpoint Service
 *
 * Provides:
 * - Write-ahead logging for durability
 * - Periodic checkpoint creation
 * - WAL replay for crash recovery
 * - Event replay for projection rebuild
 * - WAL pruning for storage management
 */
export class WalCheckpointService {
  private checkpointIntervalHandle: ReturnType<typeof setInterval> | null = null;
  private disposed: boolean = false;
  private running: boolean = false;

  // Sequence counter for WAL ordering
  private sequenceCounter: { value: number } = { value: 0 };

  private readonly config: {
    checkpointIntervalMs: number;
    walRetentionMs: number;
    replayBatchSize: number;
    walEnabled: boolean;
    eventReplayEnabled: boolean;
  };

  private readonly db: AuthoritativeSqlDatabase;
  private readonly onCheckpointCreated: ((checkpoint: Checkpoint) => void) | undefined;
  private readonly onWalEntryWritten: ((entry: WalEntry) => void) | undefined;

  // Metrics
  private metrics = {
    walEntriesWritten: 0,
    checkpointsCreated: 0,
    walEntriesPruned: 0,
    eventsReplayed: 0,
  };

  constructor(options: WalCheckpointServiceOptions) {
    this.db = options.db;

    // Build config with defaults
    const haLevel = options.haLevel ?? "HA_2";
    const haDefaults = HA_LEVEL_CONFIGS[haLevel];

    this.config = {
      checkpointIntervalMs: options.checkpointIntervalMs ?? haDefaults.walCheckpointIntervalMs,
      walRetentionMs: options.walRetentionMs ?? haDefaults.walRetentionMs,
      replayBatchSize: options.replayBatchSize ?? DEFAULT_BATCH_SIZE,
      walEnabled: options.config?.walEnabled ?? haDefaults.walEnabled,
      eventReplayEnabled: options.config?.eventReplayEnabled ?? haDefaults.eventReplayEnabled,
    };

    this.onCheckpointCreated = options.onCheckpointCreated ?? undefined;
    this.onWalEntryWritten = options.onWalEntryWritten ?? undefined;
    this.syncSequenceCounterFromStorage();

    if (!this.config.walEnabled) {
      logger.log({
        level: "info",
        message: "wal_checkpoint_service.disabled",
        data: { reason: "walEnabled is false" },
      });
    }

    logger.log({
      level: "info",
      message: "wal_checkpoint_service.service_created",
      data: {
        haLevel,
        config: this.config,
      },
    });
  }

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Initializes the database schema for WAL and checkpoints.
   */
  public initializeSchema(): void {
    this.db.connection.exec(WAL_CHECKPOINT_DDL);
    this.syncSequenceCounterFromStorage();
    logger.log({
      level: "info",
      message: "wal_checkpoint_service.schema_initialized",
    });
  }

  /**
   * Starts the checkpoint service background process.
   */
  public start(): void {
    if (this.disposed) {
      throw new Error("Cannot start disposed WalCheckpointService");
    }

    if (this.running) {
      return;
    }

    if (!this.config.walEnabled || this.config.checkpointIntervalMs <= 0) {
      logger.log({
        level: "info",
        message: "wal_checkpoint_service.not_started",
        data: { reason: "disabled by config" },
      });
      return;
    }

    this.running = true;
    this.startCheckpointLoop();

    logger.log({
      level: "info",
      message: "wal_checkpoint_service.started",
      data: { checkpointIntervalMs: this.config.checkpointIntervalMs },
    });
  }

  /**
   * Stops the checkpoint service.
   */
  public stop(): void {
    this.running = false;
    if (this.checkpointIntervalHandle !== null) {
      clearInterval(this.checkpointIntervalHandle);
      this.checkpointIntervalHandle = null;
    }

    logger.log({
      level: "info",
      message: "wal_checkpoint_service.stopped",
    });
  }

  /**
   * Disposes of the service.
   */
  public dispose(): void {
    this.stop();
    this.disposed = true;
  }

  /**
   * Writes a WAL entry.
   */
  public writeWalEntry(input: {
    entryType: WalEntryType;
    executionId?: string | null;
    taskId?: string | null;
    sessionId?: string | null;
    payload?: Record<string, unknown>;
    checkpointId?: string | null;
  }): WalEntry {
    if (!this.config.walEnabled) {
      throw new Error("WAL is disabled");
    }

    const sequenceNumber = this.nextSequence();
    const entry: WalEntry = {
      id: newId("wal"),
      entryType: input.entryType,
      executionId: input.executionId ?? null,
      taskId: input.taskId ?? null,
      sessionId: input.sessionId ?? null,
      payload: input.payload ?? {},
      createdAt: nowIso(),
      checkpointId: input.checkpointId ?? null,
      sequenceNumber,
    };

    this.db.connection
      .prepare(
        `INSERT INTO wal_entries (id, entry_type, execution_id, task_id, session_id, payload, created_at, checkpoint_id, sequence_number)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.entryType,
        entry.executionId,
        entry.taskId,
        entry.sessionId,
        JSON.stringify(entry.payload),
        entry.createdAt,
        entry.checkpointId,
        entry.sequenceNumber,
      );

    this.metrics.walEntriesWritten++;
    this.onWalEntryWritten?.(entry);

    return entry;
  }

  /**
   * Creates a checkpoint for an execution.
   */
  public createCheckpoint(options: CheckpointOptions): Checkpoint {
    if (!this.config.walEnabled) {
      throw new Error("WAL is disabled");
    }

    const lastSequence = this.sequenceCounter.value;
    const checkpoint: Checkpoint = {
      id: newId("ckpt"),
      executionId: options.executionId,
      state: options.state,
      createdAt: nowIso(),
      lastWalSequence: lastSequence,
      metadata: options.metadata ?? null,
    };

    this.db.connection
      .prepare(
        `INSERT INTO checkpoints (id, execution_id, state, created_at, last_wal_sequence, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        checkpoint.id,
        checkpoint.executionId,
        JSON.stringify(checkpoint.state),
        checkpoint.createdAt,
        checkpoint.lastWalSequence,
        checkpoint.metadata ? JSON.stringify(checkpoint.metadata) : null,
      );

    this.metrics.checkpointsCreated++;
    this.onCheckpointCreated?.(checkpoint);

    logger.log({
      level: "debug",
      message: "wal_checkpoint.checkpoint_created",
      data: {
        checkpointId: checkpoint.id,
        executionId: checkpoint.executionId,
        lastWalSequence: checkpoint.lastWalSequence,
      },
    });

    return checkpoint;
  }

  /**
   * Gets the latest checkpoint for an execution.
   */
  public getLatestCheckpoint(executionId: string): Checkpoint | null {
    const row = this.db.connection
      .prepare(`SELECT * FROM checkpoints WHERE execution_id = ? ORDER BY last_wal_sequence DESC LIMIT 1`)
      .get(executionId) as Record<string, unknown> | undefined;

    if (!row) {
      return null;
    }

    return {
      id: String(row.id),
      executionId: String(row.execution_id),
      state: JSON.parse(String(row.state)) as Record<string, unknown>,
      createdAt: String(row.created_at),
      lastWalSequence: Number(row.last_wal_sequence),
      metadata: row.metadata ? JSON.parse(String(row.metadata)) as Record<string, unknown> : null,
    };
  }

  /**
   * Gets WAL entries since a checkpoint for replay.
   */
  public getWalEntriesSince(checkpointId: string, limit?: number): WalEntry[] {
    const checkpoint = this.db.connection
      .prepare(`SELECT * FROM checkpoints WHERE id = ?`)
      .get(checkpointId) as Record<string, unknown> | undefined;

    if (!checkpoint) {
      return [];
    }

    const lastSequence = Number(checkpoint.last_wal_sequence);
    const effectiveLimit = limit ?? this.config.replayBatchSize;

    const rows = this.db.connection
      .prepare(`SELECT * FROM wal_entries WHERE sequence_number > ? ORDER BY sequence_number ASC LIMIT ?`)
      .all(lastSequence, effectiveLimit) as Record<string, unknown>[];

    return rows.map(this.mapRowToWalEntry);
  }

  /**
   * Replays WAL entries to rebuild state.
   */
  public async replayWal(
    executionId: string,
    handler: (entry: WalEntry) => Promise<void>,
  ): Promise<{ entriesReplayed: number }> {
    if (!this.config.eventReplayEnabled) {
      throw new Error("Event replay is disabled");
    }

    let entriesReplayed = 0;

    // Get latest checkpoint first
    const checkpoint = this.getLatestCheckpoint(executionId);

    if (checkpoint) {
      // Replay entries since checkpoint
      const entries = this.getWalEntriesSince(checkpoint.id);
      for (const entry of entries) {
        await handler(entry);
        entriesReplayed++;
      }
    } else {
      // No checkpoint, replay all entries for this execution
      const rows = this.db.connection
        .prepare(`SELECT * FROM wal_entries WHERE execution_id = ? ORDER BY sequence_number ASC`)
        .all(executionId) as Record<string, unknown>[];

      for (const row of rows) {
        const entry = this.mapRowToWalEntry(row);
        await handler(entry);
        entriesReplayed++;
      }
    }

    this.metrics.eventsReplayed += entriesReplayed;

    logger.log({
      level: "info",
      message: "wal_checkpoint.replay_complete",
      data: {
        executionId,
        entriesReplayed,
        hadCheckpoint: !!checkpoint,
      },
    });

    return { entriesReplayed };
  }

  /**
   * Saves the replay position for a consumer.
   */
  public saveReplayPosition(
    consumerName: string,
    position: EventReplayPosition,
  ): void {
    this.db.connection
      .prepare(
        `INSERT OR REPLACE INTO event_replay_positions (id, consumer_name, last_processed_event_id, last_processed_sequence, last_checkpoint_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId("replaypos"),
        consumerName,
        position.lastProcessedEventId,
        position.lastProcessedSequence,
        position.lastCheckpointId,
        nowIso(),
      );
  }

  /**
   * Gets the replay position for a consumer.
   */
  public getReplayPosition(consumerName: string): EventReplayPosition | null {
    const row = this.db.connection
      .prepare(`SELECT * FROM event_replay_positions WHERE consumer_name = ?`)
      .get(consumerName) as Record<string, unknown> | undefined;

    if (!row) {
      return null;
    }

    return {
      lastProcessedEventId: row.last_processed_event_id as string | null,
      lastProcessedSequence: Number(row.last_processed_sequence),
      lastCheckpointId: row.last_checkpoint_id as string | null,
    };
  }

  /**
   * Replays events from the event store for projection rebuild.
   */
  public async replayEvents(
    consumerName: string,
    handler: (entry: WalEntry) => Promise<void>,
    options?: {
      fromSequence?: number;
      limit?: number;
    },
  ): Promise<EventReplayResult> {
    const startPosition = this.getReplayPosition(consumerName) ?? {
      lastProcessedEventId: null,
      lastProcessedSequence: options?.fromSequence ?? 0,
      lastCheckpointId: null,
    };

    const startTime = Date.now();
    const limit = options?.limit ?? this.config.replayBatchSize;
    const fromSequence = options?.fromSequence ?? startPosition.lastProcessedSequence;

    // Get entries to replay
    const rows = this.db.connection
      .prepare(`SELECT * FROM wal_entries WHERE sequence_number > ? ORDER BY sequence_number ASC LIMIT ?`)
      .all(fromSequence, limit) as Record<string, unknown>[];

    let eventsReplayed = 0;
    let projectionsRebuilt = 0;
    let lastEntry: WalEntry | null = null;

    for (const row of rows) {
      const entry = this.mapRowToWalEntry(row);
      await handler(entry);
      eventsReplayed++;
      projectionsRebuilt++;
      lastEntry = entry;
    }

    const endPosition: EventReplayPosition = {
      lastProcessedEventId: lastEntry?.id ?? startPosition.lastProcessedEventId,
      lastProcessedSequence: lastEntry?.sequenceNumber ?? startPosition.lastProcessedSequence,
      lastCheckpointId: lastEntry?.checkpointId ?? startPosition.lastCheckpointId,
    };

    // Save position
    this.saveReplayPosition(consumerName, endPosition);

    const durationMs = Date.now() - startTime;

    return {
      eventsReplayed,
      projectionsRebuilt,
      startPosition,
      endPosition,
      durationMs,
    };
  }

  /**
   * Prunes old WAL entries and checkpoints.
   */
  public pruneOldEntries(olderThanMs?: number): { entriesPruned: number; checkpointsPruned: number } {
    const cutoff = olderThanMs ?? this.config.walRetentionMs;
    const cutoffTime = new Date(Date.now() - cutoff).toISOString();

    // Get entries to delete (those before cutoff AND already checkpointed)
    const entriesResult = this.db.connection
      .prepare(`DELETE FROM wal_entries WHERE created_at < ? AND checkpoint_id IS NOT NULL`)
      .run(cutoffTime);

    // Get checkpoints to delete (those with no newer entries)
    const checkpointsResult = this.db.connection
      .prepare(`DELETE FROM checkpoints WHERE created_at < ?`)
      .run(cutoffTime);

    const entriesPruned = Number(entriesResult.changes);
    const checkpointsPruned = Number(checkpointsResult.changes);

    this.metrics.walEntriesPruned += entriesPruned;

    logger.log({
      level: "info",
      message: "wal_checkpoint.pruned",
      data: {
        entriesPruned,
        checkpointsPruned,
        cutoffTime,
      },
    });

    return { entriesPruned, checkpointsPruned };
  }

  /**
   * Returns whether the service is running.
   */
  public isRunning(): boolean {
    return this.running && !this.disposed;
  }

  /**
   * Returns the current metrics.
   */
  public getMetrics(): Readonly<typeof this.metrics> {
    return { ...this.metrics };
  }

  // ── Private Methods ───────────────────────────────────────────────

  /**
   * Starts the automatic checkpoint loop.
   */
  private startCheckpointLoop(): void {
    if (this.checkpointIntervalHandle !== null) {
      return;
    }

    this.checkpointIntervalHandle = setInterval(() => {
      this.performScheduledCheckpoint();
    }, this.config.checkpointIntervalMs);
  }

  /**
   * Performs a scheduled checkpoint for active executions.
   */
  private performScheduledCheckpoint(): void {
    if (!this.running || this.disposed) {
      return;
    }

    // This would typically checkpoint executions that are currently running
    // For now, we just emit a metric - actual implementation would
    // integrate with the execution engine to checkpoint active executions
    logger.log({
      level: "debug",
      message: "wal_checkpoint.scheduled_checkpoint",
      data: { sequenceNumber: this.sequenceCounter.value },
    });
  }

  /**
   * Gets the next sequence number.
   */
  private nextSequence(): number {
    this.sequenceCounter.value += 1;
    return this.sequenceCounter.value;
  }

  private syncSequenceCounterFromStorage(): void {
    try {
      const row = this.db.connection
        .prepare(`SELECT MAX(sequence_number) AS max_sequence FROM wal_entries`)
        .get() as Record<string, unknown> | undefined;
      const persistedMax = Number(row?.max_sequence ?? row?.MAX ?? 0);
      if (Number.isFinite(persistedMax) && persistedMax > this.sequenceCounter.value) {
        this.sequenceCounter.value = persistedMax;
      }
    } catch {
      // Table may not exist yet during first bootstrap. The counter will sync after schema init.
    }
  }

  /**
   * Maps a database row to a WalEntry.
   */
  private mapRowToWalEntry(row: Record<string, unknown>): WalEntry {
    return {
      id: String(row.id),
      entryType: String(row.entry_type) as WalEntryType,
      executionId: row.execution_id as string | null,
      taskId: row.task_id as string | null,
      sessionId: row.session_id as string | null,
      payload: JSON.parse(String(row.payload)) as Record<string, unknown>,
      createdAt: String(row.created_at),
      checkpointId: row.checkpoint_id as string | null,
      sequenceNumber: Number(row.sequence_number),
    };
  }
}

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Creates a WalCheckpointService with HA-level-appropriate defaults.
 */
export function createWalCheckpointService(
  options: WalCheckpointServiceOptions,
): WalCheckpointService {
  return new WalCheckpointService(options);
}
