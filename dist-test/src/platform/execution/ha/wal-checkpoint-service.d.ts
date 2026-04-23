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
import type { Checkpoint, CheckpointOptions, EventReplayPosition, EventReplayResult, HaLevel, HaLevelConfig, WalEntry, WalEntryType } from "./types.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
export declare const WAL_CHECKPOINT_DDL = "\nCREATE TABLE IF NOT EXISTS wal_entries (\n  id TEXT PRIMARY KEY,\n  entry_type TEXT NOT NULL,\n  execution_id TEXT,\n  task_id TEXT,\n  session_id TEXT,\n  payload TEXT NOT NULL,\n  created_at TEXT NOT NULL,\n  checkpoint_id TEXT,\n  sequence_number INTEGER NOT NULL,\n  FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id)\n);\nCREATE INDEX IF NOT EXISTS idx_wal_entries_execution ON wal_entries(execution_id);\nCREATE INDEX IF NOT EXISTS idx_wal_entries_type ON wal_entries(entry_type);\nCREATE INDEX IF NOT EXISTS idx_wal_entries_created ON wal_entries(created_at);\nCREATE INDEX IF NOT EXISTS idx_wal_entries_sequence ON wal_entries(sequence_number);\n\nCREATE TABLE IF NOT EXISTS checkpoints (\n  id TEXT PRIMARY KEY,\n  execution_id TEXT NOT NULL,\n  state TEXT NOT NULL,\n  created_at TEXT NOT NULL,\n  last_wal_sequence INTEGER NOT NULL,\n  metadata TEXT,\n  FOREIGN KEY (execution_id) REFERENCES wal_entries(execution_id)\n);\nCREATE INDEX IF NOT EXISTS checkpoints_execution ON checkpoints(execution_id);\nCREATE INDEX IF NOT EXISTS checkpoints_created ON checkpoints(created_at);\n\nCREATE TABLE IF NOT EXISTS event_replay_positions (\n  id TEXT PRIMARY KEY,\n  consumer_name TEXT NOT NULL UNIQUE,\n  last_processed_event_id TEXT,\n  last_processed_sequence INTEGER NOT NULL DEFAULT 0,\n  last_checkpoint_id TEXT,\n  updated_at TEXT NOT NULL\n);\n";
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
export declare class WalCheckpointService {
    private checkpointIntervalHandle;
    private disposed;
    private running;
    private sequenceCounter;
    private readonly config;
    private readonly db;
    private readonly onCheckpointCreated;
    private readonly onWalEntryWritten;
    private metrics;
    constructor(options: WalCheckpointServiceOptions);
    /**
     * Initializes the database schema for WAL and checkpoints.
     */
    initializeSchema(): void;
    /**
     * Starts the checkpoint service background process.
     */
    start(): void;
    /**
     * Stops the checkpoint service.
     */
    stop(): void;
    /**
     * Disposes of the service.
     */
    dispose(): void;
    /**
     * Writes a WAL entry.
     */
    writeWalEntry(input: {
        entryType: WalEntryType;
        executionId?: string | null;
        taskId?: string | null;
        sessionId?: string | null;
        payload?: Record<string, unknown>;
        checkpointId?: string | null;
    }): WalEntry;
    /**
     * Creates a checkpoint for an execution.
     */
    createCheckpoint(options: CheckpointOptions): Checkpoint;
    /**
     * Gets the latest checkpoint for an execution.
     */
    getLatestCheckpoint(executionId: string): Checkpoint | null;
    /**
     * Gets WAL entries since a checkpoint for replay.
     */
    getWalEntriesSince(checkpointId: string, limit?: number): WalEntry[];
    /**
     * Replays WAL entries to rebuild state.
     */
    replayWal(executionId: string, handler: (entry: WalEntry) => Promise<void>): Promise<{
        entriesReplayed: number;
    }>;
    /**
     * Saves the replay position for a consumer.
     */
    saveReplayPosition(consumerName: string, position: EventReplayPosition): void;
    /**
     * Gets the replay position for a consumer.
     */
    getReplayPosition(consumerName: string): EventReplayPosition | null;
    /**
     * Replays events from the event store for projection rebuild.
     */
    replayEvents(consumerName: string, handler: (entry: WalEntry) => Promise<void>, options?: {
        fromSequence?: number;
        limit?: number;
    }): Promise<EventReplayResult>;
    /**
     * Prunes old WAL entries and checkpoints.
     */
    pruneOldEntries(olderThanMs?: number): {
        entriesPruned: number;
        checkpointsPruned: number;
    };
    /**
     * Returns whether the service is running.
     */
    isRunning(): boolean;
    /**
     * Returns the current metrics.
     */
    getMetrics(): Readonly<typeof this.metrics>;
    /**
     * Starts the automatic checkpoint loop.
     */
    private startCheckpointLoop;
    /**
     * Performs a scheduled checkpoint for active executions.
     */
    private performScheduledCheckpoint;
    /**
     * Gets the next sequence number.
     */
    private nextSequence;
    /**
     * Maps a database row to a WalEntry.
     */
    private mapRowToWalEntry;
}
/**
 * Creates a WalCheckpointService with HA-level-appropriate defaults.
 */
export declare function createWalCheckpointService(options: WalCheckpointServiceOptions): WalCheckpointService;
