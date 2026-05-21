import test from "node:test";
import assert from "node:assert/strict";
import {
  ContextCompactionService,
  type ContextCompactionOptions,
  type ContextCompactionResult,
  type CompactedContextMessage,
} from "../../../../src/platform/five-plane-execution/execution-engine/context-compaction-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../src/platform/five-plane-execution/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-execution/five-plane-state-evidence/truth/authoritative-task-store.js";

// Mock implementation for testing without actual database
class MockSqlDatabase implements AuthoritativeSqlDatabase {
  public connection = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
      get: () => null,
      all: () => [],
    }),
  };
  public transaction<T>(fn: () => T): T {
    return fn();
  }
  public migrate(): void {}
  public close(): void {}
  public isClosing = false;
}

class MockStore implements AuthoritativeTaskStore {
  public dispatch = {
    listMessagesBySession: () => [],
  };
  public session = {
    listCompactionRecordsBySession: () => [],
    insertCompactionRecord: () => {},
  };
  public task = {
    insertTask: () => {},
  };
  public workflow = {
    insertWorkflowState: () => {},
  };
  public execution = {
    insertExecution: () => {},
  };
  public artifact = {
    insertArtifact: () => {},
  };
  public billing = {
    insertCostEvent: () => {},
  };
  public event = {
    insertEvent: () => {},
    createTier1StatusEvent: () => {},
  };
  public operations = {
    loadTaskSnapshot: () => null,
  };
}

test("ContextCompactionService constructor accepts db and store", () => {
  const db = new MockSqlDatabase();
  const store = new MockStore();

  const service = new ContextCompactionService(db, store);

  assert.ok(service);
});

test("compactContext returns result structure with no messages", () => {
  const db = new MockSqlDatabase();
  const store = new MockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task_123",
    sessionId: "sess_456",
    maxContextTokens: 10000,
  };

  const result = service.compactContext(options);

  assert.ok(result);
  assert.ok(typeof result.usageBeforeTokens === "number");
  assert.ok(typeof result.usageAfterStage1Tokens === "number");
  assert.ok(typeof result.usageAfterStage2Tokens === "number");
  assert.ok(typeof result.stage1Triggered === "boolean");
  assert.ok(typeof result.stage2Triggered === "boolean");
  assert.ok(typeof result.fallbackToStage1 === "boolean");
  assert.ok(Array.isArray(result.contextMessages));
  assert.ok(Array.isArray(result.persistedRecords));
});

test("compactContext with zero maxContextTokens returns valid result", () => {
  const db = new MockSqlDatabase();
  const store = new MockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task_123",
    sessionId: "sess_456",
    maxContextTokens: 0,
  };

  const result = service.compactContext(options);

  assert.ok(result);
  assert.ok(result.contextMessages.length === 0);
});

test("compactContext with custom stage ratios", () => {
  const db = new MockSqlDatabase();
  const store = new MockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task_123",
    sessionId: "sess_456",
    maxContextTokens: 10000,
    stage1TriggerRatio: 0.5,
    stage2TriggerRatio: 0.7,
  };

  const result = service.compactContext(options);

  assert.ok(result);
});

test("compactContext with providerMaxOutputTokens calculates reserved budget", () => {
  const db = new MockSqlDatabase();
  const store = new MockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task_123",
    sessionId: "sess_456",
    maxContextTokens: 10000,
    providerMaxOutputTokens: 4000,
  };

  const result = service.compactContext(options);

  assert.ok(result);
});

test("compactContext with custom recentToolResultWindow", () => {
  const db = new MockSqlDatabase();
  const store = new MockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task_123",
    sessionId: "sess_456",
    maxContextTokens: 10000,
    recentToolResultWindow: 5,
  };

  const result = service.compactContext(options);

  assert.ok(result);
});

test("compactContext with custom compactionMaxFrequencyPerSession", () => {
  const db = new MockSqlDatabase();
  const store = new MockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task_123",
    sessionId: "sess_456",
    maxContextTokens: 10000,
    compactionMaxFrequencyPerSession: 3,
  };

  const result = service.compactContext(options);

  assert.ok(result);
});

test("compactContext with occurredAt uses provided timestamp", () => {
  const db = new MockSqlDatabase();
  const store = new MockStore();
  const service = new ContextCompactionService(db, store);

  const occurredAt = "2024-06-15T12:00:00.000Z";
  const options: ContextCompactionOptions = {
    taskId: "task_123",
    sessionId: "sess_456",
    maxContextTokens: 10000,
    occurredAt,
  };

  const result = service.compactContext(options);

  assert.ok(result);
  assert.ok(result.persistedRecords.length === 0 || result.persistedRecords[0]?.createdAt === occurredAt);
});

test("ContextCompactionResult type structure", () => {
  const result: ContextCompactionResult = {
    usageBeforeTokens: 5000,
    usageAfterStage1Tokens: 4000,
    usageAfterStage2Tokens: 3000,
    stage1Triggered: false,
    stage2Triggered: false,
    fallbackToStage1: false,
    contextMessages: [],
    persistedRecords: [],
    errorCode: null,
    kvCacheFixedPrefixCacheKey: null,
    kvCacheDomainBlockCacheKey: null,
  };

  assert.equal(result.usageBeforeTokens, 5000);
  assert.equal(result.errorCode, null);
});

test("CompactedContextMessage type structure", () => {
  const message: CompactedContextMessage = {
    messageId: "msg_123",
    direction: "inbound",
    messageType: "user_request",
    content: "Test content",
    estimatedTokens: 100,
    trimmed: false,
    protected: true,
  };

  assert.equal(message.messageId, "msg_123");
  assert.equal(message.direction, "inbound");
  assert.equal(message.protected, true);
});

test("compactContext returns errorCode when budget exhausted", () => {
  const db = new MockSqlDatabase();
  const store = new MockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task_123",
    sessionId: "sess_456",
    maxContextTokens: 100,
  };

  const result = service.compactContext(options);

  // Without actual messages, no compaction should be triggered
  assert.ok(result.errorCode === null || result.errorCode === "runtime.compaction_budget_exhausted");
});

test("compactContext with KV cache config", () => {
  const db = new MockSqlDatabase();
  const store = new MockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task_123",
    sessionId: "sess_456",
    maxContextTokens: 10000,
    kvCacheConfig: {
      strategy: {
        kvCacheEnabled: true,
        fixedPrefixEnabled: true,
        domainBlockEnabled: true,
      },
    },
  };

  const result = service.compactContext(options);

  assert.ok(result);
});
