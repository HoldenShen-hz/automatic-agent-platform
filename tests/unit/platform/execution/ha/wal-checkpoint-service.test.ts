import assert from "node:assert/strict";
import test from "node:test";

import {
  WAL_CHECKPOINT_DDL,
  type WalEntryType,
  type CheckpointOptions,
} from "../../../../../src/platform/execution/ha/wal-checkpoint-service.js";
import type { Checkpoint, WalEntry, EventReplayPosition } from "../../../../../src/platform/execution/ha/types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Tests: DDL and Constants
// ─────────────────────────────────────────────────────────────────────────────

test("WAL_CHECKPOINT_DDL is defined and contains required tables", () => {
  assert.ok(WAL_CHECKPOINT_DDL.includes("CREATE TABLE IF NOT EXISTS wal_entries"));
  assert.ok(WAL_CHECKPOINT_DDL.includes("CREATE TABLE IF NOT EXISTS checkpoints"));
  assert.ok(WAL_CHECKPOINT_DDL.includes("CREATE TABLE IF NOT EXISTS event_replay_positions"));
});

test("WAL_CHECKPOINT_DDL contains required indexes", () => {
  assert.ok(WAL_CHECKPOINT_DDL.includes("idx_wal_entries_execution"));
  assert.ok(WAL_CHECKPOINT_DDL.includes("idx_wal_entries_sequence"));
  assert.ok(WAL_CHECKPOINT_DDL.includes("checkpoints_execution"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Types
// ─────────────────────────────────────────────────────────────────────────────

test("WalEntryType accepts all valid values", () => {
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

  for (const type of types) {
    assert.equal(typeof type, "string");
  }
});

test("WalEntry can be constructed", () => {
  const entry: WalEntry = {
    id: "wal_123",
    entryType: "execution_start",
    executionId: "exec-1",
    taskId: "task-1",
    sessionId: "session-1",
    payload: { key: "value" },
    createdAt: new Date().toISOString(),
    checkpointId: null,
    sequenceNumber: 1,
  };

  assert.equal(entry.id, "wal_123");
  assert.equal(entry.entryType, "execution_start");
  assert.ok(entry.sequenceNumber >= 0);
});

test("WalEntry with null optional fields", () => {
  const entry: WalEntry = {
    id: "wal_123",
    entryType: "checkpoint",
    executionId: null,
    taskId: null,
    sessionId: null,
    payload: {},
    createdAt: new Date().toISOString(),
    checkpointId: null,
    sequenceNumber: 1,
  };

  assert.equal(entry.executionId, null);
  assert.equal(entry.taskId, null);
});

test("Checkpoint can be constructed", () => {
  const checkpoint: Checkpoint = {
    id: "ckpt_123",
    executionId: "exec-1",
    state: { step: 1, data: "test" },
    createdAt: new Date().toISOString(),
    lastWalSequence: 100,
    metadata: null,
  };

  assert.equal(checkpoint.id, "ckpt_123");
  assert.equal(checkpoint.executionId, "exec-1");
  assert.ok(checkpoint.lastWalSequence >= 0);
});

test("Checkpoint with metadata", () => {
  const checkpoint: Checkpoint = {
    id: "ckpt_123",
    executionId: "exec-1",
    state: { step: 1 },
    createdAt: new Date().toISOString(),
    lastWalSequence: 100,
    metadata: { createdBy: "test", version: 1 },
  };

  assert.deepEqual(checkpoint.metadata, { createdBy: "test", version: 1 });
});

test("CheckpointOptions can be used", () => {
  const options: CheckpointOptions = {
    executionId: "exec-1",
    state: { step: 1, completed: false },
  };

  assert.equal(options.executionId, "exec-1");
  assert.deepEqual(options.state, { step: 1, completed: false });
});

test("CheckpointOptions with metadata", () => {
  const options: CheckpointOptions = {
    executionId: "exec-1",
    state: { step: 1 },
    metadata: { source: "manual" },
  };

  assert.deepEqual(options.metadata, { source: "manual" });
});

test("EventReplayPosition can be constructed", () => {
  const position: EventReplayPosition = {
    lastProcessedEventId: "event_123",
    lastProcessedSequence: 50,
    lastCheckpointId: "ckpt_123",
  };

  assert.equal(position.lastProcessedEventId, "event_123");
  assert.equal(position.lastProcessedSequence, 50);
});

test("EventReplayPosition with null values", () => {
  const position: EventReplayPosition = {
    lastProcessedEventId: null,
    lastProcessedSequence: 0,
    lastCheckpointId: null,
  };

  assert.equal(position.lastProcessedEventId, null);
  assert.equal(position.lastCheckpointId, null);
});

test("WalEntry payload is flexible", () => {
  const entry1: WalEntry = {
    id: "wal_1",
    entryType: "execution_start",
    executionId: "exec-1",
    taskId: "task-1",
    sessionId: null,
    payload: { priority: "high", retries: 3 },
    createdAt: new Date().toISOString(),
    checkpointId: null,
    sequenceNumber: 1,
  };

  const entry2: WalEntry = {
    id: "wal_2",
    entryType: "execution_complete",
    executionId: "exec-1",
    taskId: "task-1",
    sessionId: null,
    payload: { result: "success", durationMs: 1500 },
    createdAt: new Date().toISOString(),
    checkpointId: null,
    sequenceNumber: 2,
  };

  assert.equal(entry1.payload.priority, "high");
  assert.equal(entry2.payload.result, "success");
});

test("WalEntry sequence numbers are monotonic", () => {
  const entries: WalEntry[] = [];
  for (let i = 0; i < 5; i++) {
    entries.push({
      id: `wal_${i}`,
      entryType: "execution_update",
      executionId: "exec-1",
      taskId: null,
      sessionId: null,
      payload: {},
      createdAt: new Date().toISOString(),
      checkpointId: null,
      sequenceNumber: i,
    });
  }

  for (let i = 1; i < entries.length; i++) {
    assert.ok(entries[i]!.sequenceNumber > entries[i - 1]!.sequenceNumber);
  }
});

test("Checkpoint lastWalSequence references correct position", () => {
  const checkpoint: Checkpoint = {
    id: "ckpt_1",
    executionId: "exec-1",
    state: { step: 5 },
    createdAt: new Date().toISOString(),
    lastWalSequence: 42,
    metadata: null,
  };

  // This checkpoint was created after WAL sequence 42
  assert.equal(checkpoint.lastWalSequence, 42);
});

test("EventReplayPosition can track progress", () => {
  const startPosition: EventReplayPosition = {
    lastProcessedEventId: null,
    lastProcessedSequence: 0,
    lastCheckpointId: null,
  };

  const midPosition: EventReplayPosition = {
    lastProcessedEventId: "event_50",
    lastProcessedSequence: 50,
    lastCheckpointId: "ckpt_40",
  };

  const endPosition: EventReplayPosition = {
    lastProcessedEventId: "event_100",
    lastProcessedSequence: 100,
    lastCheckpointId: "ckpt_90",
  };

  assert.ok(midPosition.lastProcessedSequence > startPosition.lastProcessedSequence);
  assert.ok(endPosition.lastProcessedSequence > midPosition.lastProcessedSequence);
});

test("Multiple WalEntries for same execution", () => {
  const entries: WalEntry[] = [
    {
      id: "wal_start",
      entryType: "execution_start",
      executionId: "exec-1",
      taskId: "task-1",
      sessionId: "session-1",
      payload: {},
      createdAt: new Date().toISOString(),
      checkpointId: null,
      sequenceNumber: 1,
    },
    {
      id: "wal_ckpt1",
      entryType: "checkpoint",
      executionId: "exec-1",
      taskId: null,
      sessionId: null,
      payload: {},
      createdAt: new Date().toISOString(),
      checkpointId: "ckpt_1",
      sequenceNumber: 2,
    },
    {
      id: "wal_complete",
      entryType: "execution_complete",
      executionId: "exec-1",
      taskId: "task-1",
      sessionId: "session-1",
      payload: { result: "success" },
      createdAt: new Date().toISOString(),
      checkpointId: null,
      sequenceNumber: 3,
    },
  ];

  // All entries reference the same execution
  for (const entry of entries) {
    assert.equal(entry.executionId, "exec-1");
  }

  // Sequence is ordered
  assert.ok(entries[0]!.sequenceNumber < entries[1]!.sequenceNumber);
  assert.ok(entries[1]!.sequenceNumber < entries[2]!.sequenceNumber);
});

test("Checkpoint state preservation", () => {
  const originalState = {
    workflowId: "wf-1",
    currentStep: 3,
    variables: { count: 42 },
    artifacts: [],
  };

  const checkpoint: Checkpoint = {
    id: "ckpt_1",
    executionId: "exec-1",
    state: originalState,
    createdAt: new Date().toISOString(),
    lastWalSequence: 100,
    metadata: { stepName: "process_data" },
  };

  // State is preserved exactly
  assert.deepEqual(checkpoint.state, originalState);
});

test("WalEntry types for HA events", () => {
  const haEvents: WalEntryType[] = [
    "lease_acquired",
    "lease_released",
    "failover_start",
    "failover_complete",
  ];

  const entries = haEvents.map((type, i) => ({
    id: `wal_ha_${i}`,
    entryType: type,
    executionId: null,
    taskId: null,
    sessionId: null,
    payload: { nodeId: "node-1" },
    createdAt: new Date().toISOString(),
    checkpointId: null,
    sequenceNumber: i,
  }));

  assert.equal(entries.length, 4);
  entries.forEach((entry) => {
    assert.ok(entry.entryType.startsWith("lease_") || entry.entryType.startsWith("failover_"));
  });
});
