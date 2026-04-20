import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { MemoryRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/memory-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";

test("MemoryRepository getMemory returns memory by ID", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);

    const now = new Date().toISOString();

    db.connection.exec(`
      INSERT INTO memories (id, task_id, session_id, agent_id, execution_id, memory_layer, scope, content_json, classification, source_trust_level, quality_score, hit_count, created_at, last_accessed_at, expires_at, revoked_at, revocation_reason, kind, status, importance_score, freshness_score, content_hash)
      VALUES ('memory-001', 'task-1', 'session-1', 'agent-1', 'exec-1', 'layer_3', 'task', '{"content":"test"}', 'learning', 'trusted', 0.8, 5, '${now}', '${now}', NULL, NULL, NULL, 'fact', 'active', 0.9, 0.7, 'hash001')
    `);

    const result = repo.getMemory("memory-001");
    assert.ok(result);
    assert.equal(result.id, "memory-001");
    assert.equal(result.taskId, "task-1");
    assert.equal(result.memoryLayer, "layer_3");
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository insertMemory persists a new memory record", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);

    const now = new Date().toISOString();
    repo.insertMemory({
      id: "memory-insert-001",
      taskId: "task-insert",
      sessionId: "session-insert",
      agentId: "agent-insert",
      executionId: "exec-insert",
      memoryLayer: "layer_3",
      scope: "task",
      contentJson: "{\"content\":\"inserted\"}",
      classification: "fact",
      sourceTrustLevel: "trusted",
      qualityScore: 0.8,
      hitCount: 0,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: null,
      revokedAt: null,
      revocationReason: null,
      kind: "fact",
      status: "active",
      importanceScore: 0.9,
      freshnessScore: 0.7,
      contentHash: "hash-insert-001",
    });

    const result = repo.getMemory("memory-insert-001");
    assert.equal(result?.contentHash, "hash-insert-001");
    assert.equal(result?.contentJson, "{\"content\":\"inserted\"}");
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository getMemory returns null for non-existent memory", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);

    const result = repo.getMemory("nonexistent-memory");
    assert.strictEqual(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository listMemories returns all memories", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);

    const now = new Date().toISOString();

    db.connection.exec(`
      INSERT INTO memories (id, task_id, session_id, agent_id, execution_id, memory_layer, scope, content_json, classification, source_trust_level, quality_score, hit_count, created_at, last_accessed_at, expires_at, revoked_at, revocation_reason, kind, status, importance_score, freshness_score, content_hash)
      VALUES ('memory-list-1', 'task-1', 'session-1', 'agent-1', 'exec-1', 'layer_3', 'task', '{"a":1}', 'fact', 'trusted', 0.8, 1, '${now}', '${now}', NULL, NULL, NULL, 'fact', 'active', 0.9, 0.7, 'hash1')
    `);

    db.connection.exec(`
      INSERT INTO memories (id, task_id, session_id, agent_id, execution_id, memory_layer, scope, content_json, classification, source_trust_level, quality_score, hit_count, created_at, last_accessed_at, expires_at, revoked_at, revocation_reason, kind, status, importance_score, freshness_score, content_hash)
      VALUES ('memory-list-2', 'task-2', 'session-2', 'agent-2', 'exec-2', 'layer_5', 'session', '{"b":2}', 'preference', 'external', 0.6, 3, '${now}', '${now}', NULL, NULL, NULL, 'fact', 'active', 0.5, 0.3, 'hash2')
    `);

    const results = repo.listMemories();
    assert.equal(results.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository listMemories with taskId filter works", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);

    const now = new Date().toISOString();

    db.connection.exec(`
      INSERT INTO memories (id, task_id, session_id, agent_id, execution_id, memory_layer, scope, content_json, classification, source_trust_level, quality_score, hit_count, created_at, last_accessed_at, expires_at, revoked_at, revocation_reason, kind, status, importance_score, freshness_score, content_hash)
      VALUES ('memory-task-1', 'task-filter', 'session-1', 'agent-1', 'exec-1', 'layer_3', 'task', '{}', 'fact', 'trusted', 0.8, 1, '${now}', '${now}', NULL, NULL, NULL, 'fact', 'active', 0.9, 0.7, 'hash-task-1')
    `);

    db.connection.exec(`
      INSERT INTO memories (id, task_id, session_id, agent_id, execution_id, memory_layer, scope, content_json, classification, source_trust_level, quality_score, hit_count, created_at, last_accessed_at, expires_at, revoked_at, revocation_reason, kind, status, importance_score, freshness_score, content_hash)
      VALUES ('memory-other', 'task-other', 'session-3', 'agent-3', 'exec-3', 'layer_3', 'task', '{}', 'fact', 'trusted', 0.9, 5, '${now}', '${now}', NULL, NULL, NULL, 'fact', 'active', 0.95, 0.8, 'hash-other')
    `);

    const results = repo.listMemories({ taskId: "task-filter" });
    assert.equal(results.length, 1);
    assert.equal(results[0]?.taskId, "task-filter");
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository revokeMemory sets revoked fields", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);

    const now = new Date().toISOString();
    const revokedAt = new Date(Date.now() + 7200000).toISOString();

    db.connection.exec(`
      INSERT INTO memories (id, task_id, session_id, agent_id, execution_id, memory_layer, scope, content_json, classification, source_trust_level, quality_score, hit_count, created_at, last_accessed_at, expires_at, revoked_at, revocation_reason, kind, status, importance_score, freshness_score, content_hash)
      VALUES ('memory-revoke', 'task-1', 'session-1', 'agent-1', 'exec-1', 'layer_3', 'task', '{}', 'fact', 'trusted', 0.8, 1, '${now}', '${now}', NULL, NULL, NULL, 'fact', 'active', 0.9, 0.7, 'hash-revoke')
    `);

    repo.revokeMemory("memory-revoke", revokedAt, "user_request");

    const result = repo.getMemory("memory-revoke");
    assert.ok(result);
    assert.equal(result.revokedAt, revokedAt);
    assert.equal(result.revocationReason, "user_request");
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository listMemories with empty scopes array returns all (no filter applied)", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);

    const now = new Date().toISOString();

    // Insert two memories with different scopes
    db.connection.exec(`
      INSERT INTO memories (id, task_id, session_id, agent_id, execution_id, memory_layer, scope, content_json, classification, source_trust_level, quality_score, hit_count, created_at, last_accessed_at, expires_at, revoked_at, revocation_reason, kind, status, importance_score, freshness_score, content_hash)
      VALUES ('memory-scope-1', 'task-scope', 'session-1', 'agent-1', 'exec-1', 'layer_3', 'task', '{}', 'fact', 'trusted', 0.8, 1, '${now}', '${now}', NULL, NULL, NULL, 'fact', 'active', 0.9, 0.7, 'hash-scope-1')
    `);
    db.connection.exec(`
      INSERT INTO memories (id, task_id, session_id, agent_id, execution_id, memory_layer, scope, content_json, classification, source_trust_level, quality_score, hit_count, created_at, last_accessed_at, expires_at, revoked_at, revocation_reason, kind, status, importance_score, freshness_score, content_hash)
      VALUES ('memory-scope-2', 'task-scope', 'session-2', 'agent-2', 'exec-2', 'layer_5', 'session', '{}', 'preference', 'external', 0.6, 2, '${now}', '${now}', NULL, NULL, NULL, 'fact', 'active', 0.5, 0.3, 'hash-scope-2')
    `);

    // Empty array should not apply filter - returns all memories
    const results = repo.listMemories({ scopes: [] });
    assert.equal(results.length, 2, "Empty scopes array should not filter out results");
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository listMemories with empty memoryLayers array returns all (no filter applied)", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);

    const now = new Date().toISOString();

    db.connection.exec(`
      INSERT INTO memories (id, task_id, session_id, agent_id, execution_id, memory_layer, scope, content_json, classification, source_trust_level, quality_score, hit_count, created_at, last_accessed_at, expires_at, revoked_at, revocation_reason, kind, status, importance_score, freshness_score, content_hash)
      VALUES ('memory-layer-1', 'task-layer', 'session-1', 'agent-1', 'exec-1', 'layer_3', 'task', '{}', 'fact', 'trusted', 0.8, 1, '${now}', '${now}', NULL, NULL, NULL, 'fact', 'active', 0.9, 0.7, 'hash-layer-1')
    `);

    // Empty array should not apply filter
    const results = repo.listMemories({ memoryLayers: [] });
    assert.equal(results.length, 1, "Empty memoryLayers array should not filter out results");
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository listMemories with empty classifications array returns all (no filter applied)", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);

    const now = new Date().toISOString();

    db.connection.exec(`
      INSERT INTO memories (id, task_id, session_id, agent_id, execution_id, memory_layer, scope, content_json, classification, source_trust_level, quality_score, hit_count, created_at, last_accessed_at, expires_at, revoked_at, revocation_reason, kind, status, importance_score, freshness_score, content_hash)
      VALUES ('memory-class-1', 'task-class', 'session-1', 'agent-1', 'exec-1', 'layer_3', 'task', '{}', 'fact', 'trusted', 0.8, 1, '${now}', '${now}', NULL, NULL, NULL, 'fact', 'active', 0.9, 0.7, 'hash-class-1')
    `);

    // Empty array should not apply filter
    const results = repo.listMemories({ classifications: [] });
    assert.equal(results.length, 1, "Empty classifications array should not filter out results");
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository listMemories with empty sourceTrustLevels array returns all (no filter applied)", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);

    const now = new Date().toISOString();

    db.connection.exec(`
      INSERT INTO memories (id, task_id, session_id, agent_id, execution_id, memory_layer, scope, content_json, classification, source_trust_level, quality_score, hit_count, created_at, last_accessed_at, expires_at, revoked_at, revocation_reason, kind, status, importance_score, freshness_score, content_hash)
      VALUES ('memory-trust-1', 'task-trust', 'session-1', 'agent-1', 'exec-1', 'layer_3', 'task', '{}', 'fact', 'trusted', 0.8, 1, '${now}', '${now}', NULL, NULL, NULL, 'fact', 'active', 0.9, 0.7, 'hash-trust-1')
    `);

    // Empty array should not apply filter
    const results = repo.listMemories({ sourceTrustLevels: [] });
    assert.equal(results.length, 1, "Empty sourceTrustLevels array should not filter out results");
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository recordMemoryAccess increments hit count and updates lastAccessedAt", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);

    const now = new Date().toISOString();
    const accessedAt = new Date(Date.now() + 60000).toISOString();

    db.connection.exec(`
      INSERT INTO memories (id, task_id, session_id, agent_id, execution_id, memory_layer, scope, content_json, classification, source_trust_level, quality_score, hit_count, created_at, last_accessed_at, expires_at, revoked_at, revocation_reason, kind, status, importance_score, freshness_score, content_hash)
      VALUES ('memory-access', 'task-1', 'session-1', 'agent-1', 'exec-1', 'layer_3', 'task', '{}', 'fact', 'trusted', 0.8, 5, '${now}', '${now}', NULL, NULL, NULL, 'fact', 'active', 0.9, 0.7, 'hash-access')
    `);

    repo.recordMemoryAccess("memory-access", accessedAt);

    const result = repo.getMemory("memory-access");
    assert.ok(result);
    assert.equal(result.hitCount, 6, "hitCount should be incremented from 5 to 6");
    assert.equal(result.lastAccessedAt, accessedAt);
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository findMemoryByContentHash returns active memory matching hash and scope", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);

    const now = new Date().toISOString();

    db.connection.exec(`
      INSERT INTO memories (id, task_id, session_id, agent_id, execution_id, memory_layer, scope, content_json, classification, source_trust_level, quality_score, hit_count, created_at, last_accessed_at, expires_at, revoked_at, revocation_reason, kind, status, importance_score, freshness_score, content_hash)
      VALUES ('memory-hash-1', 'task-1', 'session-1', 'agent-1', 'exec-1', 'layer_3', 'task', '{}', 'fact', 'trusted', 0.8, 1, '${now}', '${now}', NULL, NULL, NULL, 'fact', 'active', 0.9, 0.7, 'unique-hash-123')
    `);

    db.connection.exec(`
      INSERT INTO memories (id, task_id, session_id, agent_id, execution_id, memory_layer, scope, content_json, classification, source_trust_level, quality_score, hit_count, created_at, last_accessed_at, expires_at, revoked_at, revocation_reason, kind, status, importance_score, freshness_score, content_hash)
      VALUES ('memory-hash-2', 'task-2', 'session-2', 'agent-2', 'exec-2', 'layer_5', 'session', '{}', 'fact', 'trusted', 0.8, 2, '${now}', '${now}', NULL, NULL, NULL, 'fact', 'active', 0.9, 0.7, 'unique-hash-123')
    `);

    const result = repo.findMemoryByContentHash("unique-hash-123", "task");
    assert.ok(result, "should find active memory with matching hash and scope");
    assert.equal(result.id, "memory-hash-1");
    assert.equal(result.scope, "task");
    assert.equal(result.contentHash, "unique-hash-123");
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository findMemoryByContentHash returns memory with revokedAt set (only checks status column)", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);

    const now = new Date().toISOString();
    const revokedAt = new Date().toISOString();

    db.connection.exec(`
      INSERT INTO memories (id, task_id, session_id, agent_id, execution_id, memory_layer, scope, content_json, classification, source_trust_level, quality_score, hit_count, created_at, last_accessed_at, expires_at, revoked_at, revocation_reason, kind, status, importance_score, freshness_score, content_hash)
      VALUES ('memory-revoked', 'task-1', 'session-1', 'agent-1', 'exec-1', 'layer_3', 'task', '{}', 'fact', 'trusted', 0.8, 1, '${now}', '${now}', NULL, '${revokedAt}', 'user_request', 'fact', 'active', 0.9, 0.7, 'revoked-hash')
    `);

    const result = repo.findMemoryByContentHash("revoked-hash", "task");
    assert.ok(result, "findMemoryByContentHash only checks status='active', not revokedAt field");
    assert.equal(result.id, "memory-revoked");
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository findMemoryByContentHash returns null for non-existent hash", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);

    const result = repo.findMemoryByContentHash("nonexistent-hash", "task");
    assert.strictEqual(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository getMemoryQualityReport returns quality metrics", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);

    const now = new Date().toISOString();

    db.connection.exec(`
      INSERT INTO memories (id, task_id, session_id, agent_id, execution_id, memory_layer, scope, content_json, classification, source_trust_level, quality_score, hit_count, created_at, last_accessed_at, expires_at, revoked_at, revocation_reason, kind, status, importance_score, freshness_score, content_hash)
      VALUES ('memory-quality-1', 'task-quality', 'session-1', 'agent-1', 'exec-1', 'layer_3', 'task', '{}', 'fact', 'trusted', 0.9, 10, '${now}', '${now}', NULL, NULL, NULL, 'fact', 'active', 0.9, 0.8, 'hash-q1')
    `);

    db.connection.exec(`
      INSERT INTO memories (id, task_id, session_id, agent_id, execution_id, memory_layer, scope, content_json, classification, source_trust_level, quality_score, hit_count, created_at, last_accessed_at, expires_at, revoked_at, revocation_reason, kind, status, importance_score, freshness_score, content_hash)
      VALUES ('memory-quality-2', 'task-quality', 'session-1', 'agent-1', 'exec-1', 'layer_5', 'session', '{}', 'preference', 'external', 0.6, 3, '${now}', '${now}', NULL, NULL, NULL, 'fact', 'active', 0.5, 0.3, 'hash-q2')
    `);

    const report = repo.getMemoryQualityReport({ taskId: "task-quality" });

    assert.ok(report, "should return a quality report");
    assert.ok(typeof report.totalCount === "number", "report should have totalCount");
    assert.ok(typeof report.activeCount === "number", "report should have activeCount");
    assert.ok(typeof report.generatedAt === "string", "report should have generatedAt");
    assert.ok(Array.isArray(report.byScope), "report should have byScope array");
    assert.ok(Array.isArray(report.byLayer), "report should have byLayer array");
    assert.ok(Array.isArray(report.byClassification), "report should have byClassification array");
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository getMemoryQualityReport with no memories returns zeroed report", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);

    const report = repo.getMemoryQualityReport();

    assert.ok(report, "should return a quality report even with no memories");
    assert.equal(report.totalCount, 0, "totalCount should be 0");
    assert.equal(report.activeCount, 0, "activeCount should be 0");
  } finally {
    cleanupPath(workspace);
  }
});
