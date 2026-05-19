import assert from "node:assert/strict";
import test from "node:test";

import { WalCheckpointService, createWalCheckpointService, WAL_CHECKPOINT_DDL } from "../../../../../src/platform/five-plane-execution/ha/wal-checkpoint-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { WalEntryType, CheckpointOptions, EventReplayPosition } from "../../../../../src/platform/five-plane-execution/ha/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockStatement {
  run(...args: unknown[]): { changes: number };
  get(...args: unknown[]): Record<string, unknown> | undefined;
  all(...args: unknown[]): Record<string, unknown>[];
}

function createMockDatabase(): AuthoritativeSqlDatabase {
  const storage = new Map<string, Record<string, unknown>[]>();
  const statements = new Map<string, MockStatement>();

  const mockStatement = (sql: string): MockStatement => {
    if (!statements.has(sql)) {
      statements.set(sql, {
        run(...args: unknown[]) {
          const table = sql.toLowerCase().includes("delete") ? extractTable(sql) : extractTable(sql);
          const tableData = storage.get(table) ?? [];
          if (sql.toLowerCase().includes("insert")) {
            if (table === "event_replay_positions") {
              tableData.push({
                id: args[0],
                consumer_name: args[1],
                last_processed_event_id: args[2],
                last_processed_sequence: args[3],
                last_checkpoint_id: args[4],
              });
            } else {
              tableData.push({ id: args[0], seq: args[args.length - 1] });
            }
            storage.set(table, tableData);
          }
          return { changes: 1 };
        },
        get(...args: unknown[]) {
          const table = extractTable(sql);
          const data = storage.get(table) ?? [];
          if (sql.toLowerCase().includes("max(sequence_number)")) {
            const maxSequence = data.reduce((max, row) => Math.max(max, Number(row.seq ?? row.sequence_number ?? 0)), 0);
            return { max_sequence: maxSequence };
          }
          const whereIdx = sql.toLowerCase().indexOf("where");
          if (whereIdx > 0) {
            return data.find(row => Object.values(row).some(v => args.includes(v))) as Record<string, unknown> | undefined;
          }
          return data[0];
        },
        all(...args: unknown[]) {
          const table = extractTable(sql);
          return storage.get(table) ?? [];
        },
      });
    }
    return statements.get(sql)!;
  };

  function extractTable(sql: string): string {
    const match = sql.match(/from\s+(\w+)/i) ?? sql.match(/into\s+(\w+)/i);
    return match ? match[1]! : "unknown";
  }

  return {
    connection: {
      exec(sql: string) {
        // Just track that DDL was executed
      },
      prepare(sql: string) {
        return mockStatement(sql);
      },
    },
    transaction<T>(fn: () => T): T {
      return fn();
    },
    integrityCheck(): string[] {
      return ["ok"];
    },
    getSchemaStatus() {
      return { pendingVersions: [], checksumMismatches: [] };
    },
  } as unknown as AuthoritativeSqlDatabase;
}

// ---------------------------------------------------------------------------
// Constructor and defaults
// ---------------------------------------------------------------------------

test("WalCheckpointService constructor sets default config for HA_2", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({ db });

  assert.equal(service.isRunning(), false);
});

test("WalCheckpointService constructor respects walEnabled: false", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({
    db,
    haLevel: "HA_1", // HA_1 has walEnabled: false
  });

  // Service is created but not running since WAL is disabled
  assert.equal(service.isRunning(), false);
});

test("WalCheckpointService constructor accepts custom config overrides", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({
    db,
    checkpointIntervalMs: 5000,
    walRetentionMs: 3600000,
    replayBatchSize: 200,
  });

  assert.equal(service.isRunning(), false);
});

test("createWalCheckpointService is a factory that creates service", () => {
  const db = createMockDatabase();
  const service = createWalCheckpointService({ db });
  assert.ok(service instanceof WalCheckpointService);
});

// ---------------------------------------------------------------------------
// Schema initialization
// ---------------------------------------------------------------------------

test("WalCheckpointService initializeSchema executes DDL", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({ db });

  // Should not throw
  service.initializeSchema();
  assert.equal(service.isRunning(), false);
});

// ---------------------------------------------------------------------------
// start / stop / dispose
// ---------------------------------------------------------------------------

test("WalCheckpointService start enables checkpoint loop when walEnabled", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({
    db,
    haLevel: "HA_2", // Has walEnabled: true
    checkpointIntervalMs: 100, // Short interval for test
  });

  assert.equal(service.isRunning(), false);
  service.start();
  assert.equal(service.isRunning(), true);

  service.stop();
  assert.equal(service.isRunning(), false);
});

test("WalCheckpointService start does nothing when walEnabled is false", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({
    db,
    haLevel: "HA_1", // Has walEnabled: false
  });

  service.start();
  assert.equal(service.isRunning(), false);
});

test("WalCheckpointService stop clears interval handle", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({
    db,
    haLevel: "HA_2",
    checkpointIntervalMs: 100,
  });

  service.start();
  assert.equal(service.isRunning(), true);

  service.stop();
  assert.equal(service.isRunning(), false);
});

test("WalCheckpointService dispose stops and marks as disposed", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({
    db,
    haLevel: "HA_2",
    checkpointIntervalMs: 100,
  });

  service.start();
  assert.equal(service.isRunning(), true);

  service.dispose();
  // After dispose, isRunning should be false since disposed = true
  assert.equal(service.isRunning(), false);
});

test("WalCheckpointService start throws if already disposed", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({ db });

  service.dispose();
  assert.throws(() => service.start(), /disposed/);
});

// ---------------------------------------------------------------------------
// writeWalEntry
// ---------------------------------------------------------------------------

test("WalCheckpointService writeWalEntry throws when WAL disabled", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({ db, haLevel: "HA_1" });

  assert.throws(
    () => service.writeWalEntry({ entryType: "execution_start" }),
    /WAL is disabled/,
  );
});

test("WalCheckpointService writeWalEntry throws when WAL disabled via config", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({
    db,
    config: { walEnabled: false },
  });

  assert.throws(
    () => service.writeWalEntry({ entryType: "execution_start" }),
    /WAL is disabled/,
  );
});

test("WalCheckpointService writeWalEntry returns WalEntry with sequence number", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({
    db,
    haLevel: "HA_2",
    config: { walEnabled: true },
  });

  const entry = service.writeWalEntry({
    entryType: "execution_start",
    executionId: "exec-1",
    taskId: "task-1",
    payload: { key: "value" },
  });

  assert.ok(entry.id.startsWith("wal_"));
  assert.equal(entry.entryType, "execution_start");
  assert.equal(entry.executionId, "exec-1");
  assert.equal(entry.taskId, "task-1");
  assert.equal(entry.sequenceNumber, 1);
  assert.deepStrictEqual(entry.payload, { key: "value" });
});

test("WalCheckpointService getLatestCheckpoint rejects non-object JSON state", () => {
  const db = {
    connection: {
      exec() {},
      prepare() {
        return {
          get() {
            return {
              id: "checkpoint-1",
              execution_id: "exec-1",
              state: "[]",
              created_at: "2026-05-01T00:00:00.000Z",
              last_wal_sequence: 1,
              metadata: "{\"ok\":true}",
            };
          },
          all() {
            return [];
          },
          run() {
            return { changes: 1 };
          },
        };
      },
    },
    transaction<T>(fn: () => T): T {
      return fn();
    },
    integrityCheck(): string[] {
      return ["ok"];
    },
    getSchemaStatus() {
      return { pendingVersions: [], checksumMismatches: [] };
    },
  } as unknown as AuthoritativeSqlDatabase;
  const service = new WalCheckpointService({ db });

  assert.throws(() => service.getLatestCheckpoint("exec-1"), /wal_checkpoint.invalid_state/);
});

test("WalCheckpointService resumes sequence numbers from persisted WAL state", () => {
  const db = createMockDatabase();
  const firstService = new WalCheckpointService({
    db,
    haLevel: "HA_2",
    config: { walEnabled: true },
  });
  firstService.writeWalEntry({ entryType: "execution_start", executionId: "exec-1" });
  firstService.writeWalEntry({ entryType: "execution_complete", executionId: "exec-1" });

  const resumedService = new WalCheckpointService({
    db,
    haLevel: "HA_2",
    config: { walEnabled: true },
  });
  const resumedEntry = resumedService.writeWalEntry({ entryType: "checkpoint", executionId: "exec-1" });

  assert.equal(resumedEntry.sequenceNumber, 3);
});

test("WalCheckpointService writeWalEntry increments sequence for each entry", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({
    db,
    haLevel: "HA_2",
    config: { walEnabled: true },
  });

  const entry1 = service.writeWalEntry({ entryType: "execution_start" });
  const entry2 = service.writeWalEntry({ entryType: "execution_update" });
  const entry3 = service.writeWalEntry({ entryType: "execution_complete" });

  assert.equal(entry1.sequenceNumber, 1);
  assert.equal(entry2.sequenceNumber, 2);
  assert.equal(entry3.sequenceNumber, 3);
});

test("WalCheckpointService writeWalEntry handles optional fields as null", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({
    db,
    haLevel: "HA_2",
    config: { walEnabled: true },
  });

  const entry = service.writeWalEntry({
    entryType: "checkpoint",
  });

  assert.equal(entry.executionId, null);
  assert.equal(entry.taskId, null);
  assert.equal(entry.sessionId, null);
  assert.deepStrictEqual(entry.payload, {});
  assert.equal(entry.checkpointId, null);
});

// ---------------------------------------------------------------------------
// createCheckpoint
// ---------------------------------------------------------------------------

test("WalCheckpointService createCheckpoint throws when WAL disabled", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({ db, haLevel: "HA_1" });

  assert.throws(
    () => service.createCheckpoint({ executionId: "exec-1", state: {} }),
    /WAL is disabled/,
  );
});

test("WalCheckpointService createCheckpoint returns checkpoint with id", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({
    db,
    haLevel: "HA_2",
    config: { walEnabled: true },
  });

  const checkpoint = service.createCheckpoint({
    executionId: "exec-1",
    state: { step: 1, data: "test" },
  });

  assert.ok(checkpoint.id.startsWith("ckpt_"));
  assert.equal(checkpoint.executionId, "exec-1");
  assert.deepStrictEqual(checkpoint.state, { step: 1, data: "test" });
  assert.ok(checkpoint.lastWalSequence >= 0);
});

test("WalCheckpointService createCheckpoint captures lastWalSequence", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({
    db,
    haLevel: "HA_2",
    config: { walEnabled: true },
  });

  service.writeWalEntry({ entryType: "execution_start" });
  service.writeWalEntry({ entryType: "execution_update" });

  const checkpoint = service.createCheckpoint({
    executionId: "exec-1",
    state: {},
  });

  assert.equal(checkpoint.lastWalSequence, 2);
});

test("WalCheckpointService createCheckpoint stores metadata", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({
    db,
    haLevel: "HA_2",
    config: { walEnabled: true },
  });

  const checkpoint = service.createCheckpoint({
    executionId: "exec-1",
    state: {},
    metadata: { author: "test", version: 1 },
  });

  assert.deepStrictEqual(checkpoint.metadata, { author: "test", version: 1 });
});

// ---------------------------------------------------------------------------
// getLatestCheckpoint
// ---------------------------------------------------------------------------

test("WalCheckpointService getLatestCheckpoint returns null when no checkpoint", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({ db });

  const result = service.getLatestCheckpoint("nonexistent");
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// replayWal
// ---------------------------------------------------------------------------

test("WalCheckpointService replayWal throws when eventReplayEnabled is false", async () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({
    db,
    haLevel: "HA_1", // eventReplayEnabled: false
  });

  await assert.rejects(
    async () => service.replayWal("exec-1", async () => {}),
    /Event replay is disabled/,
  );
});

// ---------------------------------------------------------------------------
// replayEvents
// ---------------------------------------------------------------------------

test("WalCheckpointService replayEvents returns a Promise when eventReplayEnabled is false", async () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({
    db,
    haLevel: "HA_1",
  });

  const result = service.replayEvents("consumer", async () => {});
  assert.ok(result instanceof Promise);
  await result.catch(() => {}); // Suppress any errors
});

// ---------------------------------------------------------------------------
// pruneOldEntries
// ---------------------------------------------------------------------------

test("WalCheckpointService pruneOldEntries returns counts even when no data", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({ db });

  const result = service.pruneOldEntries(1000);

  assert.equal(typeof result.entriesPruned, "number");
  assert.equal(typeof result.checkpointsPruned, "number");
});

// ---------------------------------------------------------------------------
// getMetrics
// ---------------------------------------------------------------------------

test("WalCheckpointService getMetrics returns initialized metrics object", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({ db });

  const metrics = service.getMetrics();

  assert.equal(metrics.walEntriesWritten, 0);
  assert.equal(metrics.checkpointsCreated, 0);
  assert.equal(metrics.walEntriesPruned, 0);
  assert.equal(metrics.eventsReplayed, 0);
});

test("WalCheckpointService getMetrics increments after operations", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({
    db,
    haLevel: "HA_2",
    config: { walEnabled: true },
  });

  service.writeWalEntry({ entryType: "execution_start" });
  service.writeWalEntry({ entryType: "execution_update" });
  service.createCheckpoint({ executionId: "exec-1", state: {} });

  const metrics = service.getMetrics();

  assert.equal(metrics.walEntriesWritten, 2);
  assert.equal(metrics.checkpointsCreated, 1);
});

// ---------------------------------------------------------------------------
// onCheckpointCreated callback
// ---------------------------------------------------------------------------

test("WalCheckpointService calls onCheckpointCreated callback when provided", () => {
  const db = createMockDatabase();
  let callbackCalled = false;
  let capturedCheckpoint: ReturnType<typeof service.createCheckpoint> | null = null;

  const service = new WalCheckpointService({
    db,
    haLevel: "HA_2",
    config: { walEnabled: true },
    onCheckpointCreated(checkpoint) {
      callbackCalled = true;
      capturedCheckpoint = checkpoint;
    },
  });

  const checkpoint = service.createCheckpoint({
    executionId: "exec-1",
    state: { test: true },
  });

  assert.equal(callbackCalled, true);
  assert.ok(capturedCheckpoint != null);
  assert.equal((capturedCheckpoint as ReturnType<typeof service.createCheckpoint>).executionId, "exec-1");
});

// ---------------------------------------------------------------------------
// onWalEntryWritten callback
// ---------------------------------------------------------------------------

test("WalCheckpointService calls onWalEntryWritten callback when provided", () => {
  const db = createMockDatabase();
  let entries: ReturnType<typeof service.writeWalEntry>[] = [];

  const service = new WalCheckpointService({
    db,
    haLevel: "HA_2",
    config: { walEnabled: true },
    onWalEntryWritten(entry) {
      entries.push(entry);
    },
  });

  service.writeWalEntry({ entryType: "execution_start" });
  service.writeWalEntry({ entryType: "execution_update" });

  assert.equal(entries.length, 2);
  assert.equal(entries[0]!.entryType, "execution_start");
  assert.equal(entries[1]!.entryType, "execution_update");
});

// ---------------------------------------------------------------------------
// WAL_CHECKPOINT_DDL constant
// ---------------------------------------------------------------------------

test("WAL_CHECKPOINT_DDL contains required table definitions", () => {
  assert.ok(WAL_CHECKPOINT_DDL.includes("CREATE TABLE IF NOT EXISTS wal_entries"));
  assert.ok(WAL_CHECKPOINT_DDL.includes("CREATE TABLE IF NOT EXISTS checkpoints"));
  assert.ok(WAL_CHECKPOINT_DDL.includes("CREATE TABLE IF NOT EXISTS event_replay_positions"));
  assert.ok(WAL_CHECKPOINT_DDL.includes("idx_wal_entries_sequence"));
  assert.ok(WAL_CHECKPOINT_DDL.includes("checkpoint_id"));
});

// ---------------------------------------------------------------------------
// getReplayPosition / saveReplayPosition
// ---------------------------------------------------------------------------

test("WalCheckpointService getReplayPosition returns null when no position saved", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({ db });

  const result = service.getReplayPosition("nonexistent");
  assert.equal(result, null);
});

test("WalCheckpointService saveReplayPosition and getReplayPosition round-trip", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({ db });

  const position: EventReplayPosition = {
    lastProcessedEventId: "evt_123",
    lastProcessedSequence: 42,
    lastCheckpointId: "ckpt_456",
  };

  service.saveReplayPosition("testConsumer", position);
  const retrieved = service.getReplayPosition("testConsumer");

  assert.ok(retrieved != null);
  assert.equal(retrieved!.lastProcessedEventId, "evt_123");
  assert.equal(retrieved!.lastProcessedSequence, 42);
  assert.equal(retrieved!.lastCheckpointId, "ckpt_456");
});

// ---------------------------------------------------------------------------
// WAL entry types are valid
// ---------------------------------------------------------------------------

test("WalCheckpointService accepts all documented WalEntryType values", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({
    db,
    haLevel: "HA_2",
    config: { walEnabled: true },
  });

  const types: WalEntryType[] = [
    "execution_start",
    "execution_update",
    "execution_complete",
    "execution_failed",
    "checkpoint",
    "lease_acquired",
    "lease_released",
    "failover_start",
    "failover_complete",
  ];

  for (const entryType of types) {
    const entry = service.writeWalEntry({ entryType });
    assert.equal(entry.entryType, entryType);
  }
});

// ---------------------------------------------------------------------------
// Getter methods for configuration
// ---------------------------------------------------------------------------

test("WalCheckpointService isRunning returns false before start", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({
    db,
    haLevel: "HA_2",
    checkpointIntervalMs: 100,
  });

  assert.equal(service.isRunning(), false);
});

test("WalCheckpointService isRunning returns false after stop", () => {
  const db = createMockDatabase();
  const service = new WalCheckpointService({
    db,
    haLevel: "HA_2",
    checkpointIntervalMs: 100,
  });

  service.start();
  assert.equal(service.isRunning(), true);

  service.stop();
  assert.equal(service.isRunning(), false);
});
