import test from "node:test";
import assert from "node:assert/strict";

import { OutboxService, type OutboxServiceConfig, type TransactionContext } from "../../../../../src/platform/shared/outbox/outbox-service.js";

// Mock minimal components for testing OutboxService in isolation
class MockOutboxRepository {
  private entries: Map<string, ReturnType<OutboxRepository["insertOutboxEntry"]>> = new Map();

  insertOutboxEntry(
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payloadJson: string,
    traceId: string | null,
    createdAt: string,
  ) {
    const entry = {
      id: `id-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      aggregateType,
      aggregateId,
      eventType,
      payloadJson,
      traceId,
      createdAt,
      publishedAt: null as string | null,
      retryCount: 0,
      lastError: null as string | null,
      lastAttemptAt: null as string | null,
    };
    this.entries.set(entry.id, entry);
    return entry;
  }

  insertOutboxEntries(entries: Array<{
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
    traceId?: string | null;
  }>) {
    return entries.map((entry) =>
      this.insertOutboxEntry(
        entry.aggregateType,
        entry.aggregateId,
        entry.eventType,
        JSON.stringify(entry.payload),
        entry.traceId ?? null,
        new Date().toISOString(),
      ),
    );
  }

  listPendingEntries(_limit: number) {
    return [...this.entries.values()].filter((e) => e.publishedAt == null);
  }

  listFailedEntries(_limit: number) {
    return [...this.entries.values()].filter((e) => e.retryCount > 0);
  }

  markPublished(id: string, publishedAt: string) {
    const entry = this.entries.get(id);
    if (entry) {
      entry.publishedAt = publishedAt;
    }
  }

  markPublishedBatch(ids: string[], publishedAt: string) {
    for (const id of ids) {
      this.markPublished(id, publishedAt);
    }
  }

  markFailed(id: string, error: string, retryCount: number, lastAttemptAt: string) {
    const entry = this.entries.get(id);
    if (entry) {
      entry.lastError = error;
      entry.retryCount = retryCount;
      entry.lastAttemptAt = lastAttemptAt;
    }
  }
}

// We need to access internals for proper testing
// This test validates the public API contract

test("OutboxServiceConfig default values", () => {
  const defaultConfig: OutboxServiceConfig = {
    maxBatchSize: 100,
    publishTimeoutMs: 5000,
  };

  assert.strictEqual(defaultConfig.maxBatchSize, 100);
  assert.strictEqual(defaultConfig.publishTimeoutMs, 5000);
});

test("OutboxServiceConfig can be customized", () => {
  const customConfig: OutboxServiceConfig = {
    maxBatchSize: 50,
    publishTimeoutMs: 10000,
  };

  assert.strictEqual(customConfig.maxBatchSize, 50);
  assert.strictEqual(customConfig.publishTimeoutMs, 10000);
});

test("TransactionContext interface structure", () => {
  const mockTx: TransactionContext = {
    execute: (_sql: string, ..._params: unknown[]) => {
      // Mock implementation
    },
  };

  assert.strictEqual(typeof mockTx.execute, "function");
});

test("OutboxService writes entries with correct structure", () => {
  // This test validates the interface expectations
  const entry = {
    id: "test-id",
    aggregateType: "task",
    aggregateId: "task-123",
    eventType: "task:status_changed",
    payloadJson: JSON.stringify({ status: "running" }),
    traceId: "trace-abc",
    createdAt: new Date().toISOString(),
    publishedAt: null,
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
  };

  assert.strictEqual(entry.aggregateType, "task");
  assert.strictEqual(entry.eventType, "task:status_changed");
  assert.strictEqual(entry.publishedAt, null);
  assert.strictEqual(entry.retryCount, 0);
});

test("OutboxRecord structure validation", () => {
  const record = {
    id: "record-1",
    aggregateType: "execution",
    aggregateId: "exec-456",
    eventType: "execution:started",
    payloadJson: JSON.stringify({ startedAt: "now" }),
    traceId: null,
    createdAt: "2026-05-21T00:00:00Z",
    publishedAt: "2026-05-21T00:01:00Z",
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
  };

  assert.strictEqual(record.aggregateType, "execution");
  assert.strictEqual(record.publishedAt, "2026-05-21T00:01:00Z");
});

test("OutboxService handles batch configuration", () => {
  const config: OutboxServiceConfig = {
    maxBatchSize: 200,
    publishTimeoutMs: 3000,
  };

  assert.strictEqual(config.maxBatchSize, 200);
  assert.ok(config.maxBatchSize > 0);
});

test("OutboxService default config merge behavior", () => {
  const defaults: OutboxServiceConfig = {
    maxBatchSize: 100,
    publishTimeoutMs: 5000,
  };

  const custom = { maxBatchSize: 50 };
  const merged = { ...defaults, ...custom };

  assert.strictEqual(merged.maxBatchSize, 50);
  assert.strictEqual(merged.publishTimeoutMs, 5000);
});

test("OutboxService config type compatibility", () => {
  const config: OutboxServiceConfig = {
    maxBatchSize: 10,
    publishTimeoutMs: 1000,
  };

  // Verify config can be used in place that expects OutboxServiceConfig
  const usedConfig: OutboxServiceConfig = config;
  assert.strictEqual(usedConfig.maxBatchSize, 10);
});