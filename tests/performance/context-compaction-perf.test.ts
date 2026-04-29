/**
 * Performance Test: Context Compaction Service
 * G4 Benchmark — ContextCompactionService.compactContext() P99 < 50ms
 *
 * Design target: Context compaction <50ms P99
 * Tests the two-stage compaction (trim + summarize) performance.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";
import { ContextCompactionService, type ContextCompactionOptions } from "../../src/platform/execution/execution-engine/context-compaction-service.js";
import type { MessageRecord, CompactionRecord } from "../../src/platform/contracts/types/domain.js";
import type { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../src/platform/state-evidence/truth/authoritative-sql-database.js";

/**
 * Create a mock database with in-memory transaction support.
 */
function createMockDatabase(): AuthoritativeSqlDatabase {
  const messages: MessageRecord[] = [];
  const compactionRecords: CompactionRecord[] = [];

  return {
    transaction<T>(fn: () => T): T {
      return fn();
    },
    raw: {
      exec: () => {},
      prepare: () => ({ bind: () => ({ get: () => undefined }) }),
    },
  } as unknown as AuthoritativeSqlDatabase;
}

/**
 * Create a mock store with message and session operations.
 */
function createMockStore(messages: MessageRecord[]): AuthoritativeTaskStore {
  return {
    dispatch: {
      listMessagesBySession: () => messages,
    },
    session: {
      listMessagesBySession: () => messages,
      listCompactionRecordsBySession: () => [],
      insertCompactionRecord: (record: CompactionRecord) => {
        return record;
      },
    },
  } as unknown as AuthoritativeTaskStore;
}

/**
 * Generate test messages for compaction testing.
 */
function generateTestMessages(count: number, includeToolResults: boolean = true): MessageRecord[] {
  const messages: MessageRecord[] = [];
  const now = Date.now();

  // Add system messages (fixed prefix)
  messages.push({
    id: newId("msg"),
    sessionId: "test-session",
    direction: "system",
    messageType: "system",
    content: "You are a helpful assistant.",
    partsJson: null,
    attachmentsJson: null,
    createdAt: new Date(now - count * 60 * 1000).toISOString(),
  });

  // Add user messages and assistant responses
  for (let i = 0; i < count; i++) {
    messages.push({
      id: newId("msg"),
      sessionId: "test-session",
      direction: "inbound",
      messageType: "user_request",
      content: `User message ${i} with some content to simulate real messages`,
      partsJson: null,
      attachmentsJson: null,
      createdAt: new Date(now - (count - i) * 60 * 1000).toISOString(),
    });

    messages.push({
      id: newId("msg"),
      sessionId: "test-session",
      direction: "outbound",
      messageType: "assistant_response",
      content: `Assistant response ${i} with helpful information and analysis`,
      partsJson: null,
      attachmentsJson: null,
      createdAt: new Date(now - (count - i) * 60 * 1000 + 1000).toISOString(),
    });

    if (includeToolResults && i % 3 === 0) {
      messages.push({
        id: newId("msg"),
        sessionId: "test-session",
        direction: "outbound",
        messageType: "tool_result",
        content: `Tool result for tool call ${i} with output data and results`,
        partsJson: null,
        attachmentsJson: null,
        createdAt: new Date(now - (count - i) * 60 * 1000 + 2000).toISOString(),
      });
    }
  }

  return messages;
}

test("performance: ContextCompactionService.compactContext() with 50 messages P99 < 30ms", () => {
  const db = createMockDatabase();
  const messages = generateTestMessages(25); // 25 pairs = 50+ messages
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: newId("task"),
    sessionId: "test-session",
    maxContextTokens: 1000,
    stage1TriggerRatio: 0.7,
    stage2TriggerRatio: 0.85,
    recentToolResultWindow: 3,
  };

  const iterations = 500;

  // Warmup
  for (let i = 0; i < 10; i++) {
    service.compactContext(options);
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    service.compactContext(options);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`ContextCompaction (50 msgs): P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 30,
    `ContextCompaction P99 latency ${p99.toFixed(3)}ms exceeds 30ms target`,
  );

  assert.ok(
    p50 < 15,
    `ContextCompaction P50 latency ${p50.toFixed(3)}ms seems unexpectedly high`,
  );
});

test("performance: ContextCompactionService.compactContext() with 100 messages P99 < 50ms", () => {
  const db = createMockDatabase();
  const messages = generateTestMessages(50); // 50 pairs = 100+ messages
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: newId("task"),
    sessionId: "test-session",
    maxContextTokens: 1000,
    stage1TriggerRatio: 0.7,
    stage2TriggerRatio: 0.85,
    recentToolResultWindow: 3,
  };

  const iterations = 300;

  // Warmup
  for (let i = 0; i < 5; i++) {
    service.compactContext(options);
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    service.compactContext(options);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`ContextCompaction (100 msgs): P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 50,
    `ContextCompaction P99 latency ${p99.toFixed(3)}ms exceeds 50ms target`,
  );
});

test("performance: ContextCompactionService.compactContext() stage1 only (no trigger) P99 < 20ms", () => {
  const db = createMockDatabase();
  const messages = generateTestMessages(10); // Small set, won't trigger compaction
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: newId("task"),
    sessionId: "test-session",
    maxContextTokens: 50000, // Large budget, no compaction needed
    stage1TriggerRatio: 0.7,
    stage2TriggerRatio: 0.85,
    recentToolResultWindow: 3,
  };

  const iterations = 500;

  // Warmup
  for (let i = 0; i < 10; i++) {
    service.compactContext(options);
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    service.compactContext(options);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`ContextCompaction stage1 only: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 20,
    `ContextCompaction (stage1 only) P99 latency ${p99.toFixed(3)}ms exceeds 20ms target`,
  );
});

test("performance: ContextCompactionService.compactContext() throughput > 20 ops/sec", () => {
  const db = createMockDatabase();
  const messages = generateTestMessages(50);
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: newId("task"),
    sessionId: "test-session",
    maxContextTokens: 1000,
    stage1TriggerRatio: 0.7,
    stage2TriggerRatio: 0.85,
    recentToolResultWindow: 3,
  };

  const iterations = 50;

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    service.compactContext(options);
  }
  const elapsed = performance.now() - start;

  const opsPerSec = (iterations / elapsed) * 1000;

  console.log(`ContextCompaction throughput: ${opsPerSec.toFixed(1)} ops/sec`);

  assert.ok(
    opsPerSec > 20,
    `ContextCompaction throughput ${opsPerSec.toFixed(1)} ops/sec should be > 20 ops/sec`,
  );
});

test("performance: ContextCompactionService.compactContext() with KV cache enabled P99 < 50ms", () => {
  const db = createMockDatabase();
  const messages = generateTestMessages(50);
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: newId("task"),
    sessionId: "test-session",
    maxContextTokens: 1000,
    stage1TriggerRatio: 0.7,
    stage2TriggerRatio: 0.85,
    recentToolResultWindow: 3,
    kvCacheConfig: {
      strategy: {
        kvCacheEnabled: true,
        allowFallbackToFull: true,
      },
      domainBlockTemplates: {
        [newId("task")]: "domain block content for testing",
      },
    },
  };

  const iterations = 300;

  // Warmup
  for (let i = 0; i < 5; i++) {
    service.compactContext(options);
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    service.compactContext(options);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`ContextCompaction KV cache: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 50,
    `ContextCompaction (KV cache) P99 latency ${p99.toFixed(3)}ms exceeds 50ms target`,
  );
});

test("performance: ContextCompactionService.compactContext() with many tool results P99 < 50ms", () => {
  const db = createMockDatabase();
  const messages = generateTestMessages(30, true); // Include tool results
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: newId("task"),
    sessionId: "test-session",
    maxContextTokens: 800,
    stage1TriggerRatio: 0.7,
    stage2TriggerRatio: 0.85,
    recentToolResultWindow: 3,
  };

  const iterations = 300;

  // Warmup
  for (let i = 0; i < 5; i++) {
    service.compactContext(options);
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    service.compactContext(options);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`ContextCompaction (many tool results): P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 50,
    `ContextCompaction (many tool results) P99 latency ${p99.toFixed(3)}ms exceeds 50ms target`,
  );
});

test("performance: ContextCompactionService compactContext result analysis P99 < 60ms", () => {
  const db = createMockDatabase();
  const messages = generateTestMessages(50);
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: newId("task"),
    sessionId: "test-session",
    maxContextTokens: 1000,
    stage1TriggerRatio: 0.7,
    stage2TriggerRatio: 0.85,
    recentToolResultWindow: 3,
  };

  const iterations = 200;

  // Warmup
  for (let i = 0; i < 5; i++) {
    service.compactContext(options);
  }

  let totalTrimCandidates = 0;
  let totalStage1Triggered = 0;
  let totalStage2Triggered = 0;

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = service.compactContext(options);
    latencies.push(performance.now() - start);

    if (result.stage1Triggered) totalStage1Triggered++;
    if (result.stage2Triggered) totalStage2Triggered++;
    totalTrimCandidates += result.contextMessages.filter(m => m.trimmed).length;
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;

  console.log(`ContextCompaction analysis: P99=${p99.toFixed(3)}ms, stage1Triggered=${totalStage1Triggered}/${iterations}, stage2Triggered=${totalStage2Triggered}/${iterations}`);

  assert.ok(
    p99 < 60,
    `ContextCompaction analysis P99 latency ${p99.toFixed(3)}ms exceeds 60ms target`,
  );
});
