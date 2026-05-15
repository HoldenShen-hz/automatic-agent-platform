import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { MemoryRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/memory-repository.js";
import { SqliteDatabase } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../../helpers/fs.js";
import type { MemoryRecord } from "../../../../../../../src/platform/contracts/types/domain.js";

test("MemoryRepository insertMemory and getMemory work", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    const memory: MemoryRecord = {
      id: "memory-1",
      taskId: "task-1",
      sessionId: "session-1",
      agentId: "agent-1",
      executionId: "exec-1",
      memoryLayer: "working",
      scope: "task",
      contentJson: '{"text":"important info"}',
      classification: "fact",
      sourceTrustLevel: "high",
      qualityScore: 0.9,
      hitCount: 0,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: null,
      revokedAt: null,
      revocationReason: null,
      kind: "explicit",
      status: "active",
      importanceScore: 0.8,
      freshnessScore: 1.0,
      contentHash: "hash-abc",
    };

    repo.insertMemory(memory);

    const result = repo.getMemory("memory-1");
    assert.ok(result);
    assert.equal(result.id, "memory-1");
    assert.equal(result.contentJson, '{"text":"important info"}');
    assert.equal(result.qualityScore, 0.9);
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository getMemory returns null for non-existent", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);

    const result = repo.getMemory("nonexistent");
    assert.strictEqual(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository listMemories with taskId filter works", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    repo.insertMemory({
      id: "memory-list-1",
      taskId: "task-filter-1",
      sessionId: "session-1",
      agentId: "agent-1",
      executionId: "exec-1",
      memoryLayer: "working",
      scope: "task",
      contentJson: "{}",
      classification: "fact",
      sourceTrustLevel: "high",
      qualityScore: 0.9,
      hitCount: 0,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: null,
      revokedAt: null,
      revocationReason: null,
      kind: "explicit",
      status: "active",
      importanceScore: 0.8,
      freshnessScore: 1.0,
      contentHash: "hash-1",
    });

    repo.insertMemory({
      id: "memory-list-2",
      taskId: "task-filter-2",
      sessionId: "session-2",
      agentId: "agent-1",
      executionId: "exec-2",
      memoryLayer: "working",
      scope: "task",
      contentJson: "{}",
      classification: "fact",
      sourceTrustLevel: "high",
      qualityScore: 0.9,
      hitCount: 0,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: null,
      revokedAt: null,
      revocationReason: null,
      kind: "explicit",
      status: "active",
      importanceScore: 0.8,
      freshnessScore: 1.0,
      contentHash: "hash-2",
    });

    const results = repo.listMemories({ taskId: "task-filter-1" });
    assert.equal(results.length, 1);
    assert.equal(results[0].id, "memory-list-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository listMemories with scopes filter works", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    repo.insertMemory({
      id: "memory-scope-1",
      taskId: "task-scope-1",
      sessionId: "session-1",
      agentId: "agent-1",
      executionId: "exec-1",
      memoryLayer: "working",
      scope: "task",
      contentJson: "{}",
      classification: "fact",
      sourceTrustLevel: "high",
      qualityScore: 0.9,
      hitCount: 0,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: null,
      revokedAt: null,
      revocationReason: null,
      kind: "explicit",
      status: "active",
      importanceScore: 0.8,
      freshnessScore: 1.0,
      contentHash: "hash-scope-1",
    });

    repo.insertMemory({
      id: "memory-scope-2",
      taskId: "task-scope-1",
      sessionId: "session-1",
      agentId: "agent-1",
      executionId: "exec-1",
      memoryLayer: "working",
      scope: "session",
      contentJson: "{}",
      classification: "fact",
      sourceTrustLevel: "high",
      qualityScore: 0.9,
      hitCount: 0,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: null,
      revokedAt: null,
      revocationReason: null,
      kind: "explicit",
      status: "active",
      importanceScore: 0.8,
      freshnessScore: 1.0,
      contentHash: "hash-scope-2",
    });

    const results = repo.listMemories({ scopes: ["task"] });
    assert.equal(results.length, 1);
    assert.equal(results[0].scope, "task");
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository recordMemoryAccess increments hit count", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    repo.insertMemory({
      id: "memory-access-1",
      taskId: "task-access-1",
      sessionId: "session-1",
      agentId: "agent-1",
      executionId: "exec-1",
      memoryLayer: "working",
      scope: "task",
      contentJson: "{}",
      classification: "fact",
      sourceTrustLevel: "high",
      qualityScore: 0.9,
      hitCount: 5,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: null,
      revokedAt: null,
      revocationReason: null,
      kind: "explicit",
      status: "active",
      importanceScore: 0.8,
      freshnessScore: 1.0,
      contentHash: "hash-access-1",
    });

    repo.recordMemoryAccess("memory-access-1", now);

    const result = repo.getMemory("memory-access-1");
    assert.ok(result);
    assert.equal(result.hitCount, 6);
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository revokeMemory sets revoked fields", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    repo.insertMemory({
      id: "memory-revoke-1",
      taskId: "task-revoke-1",
      sessionId: "session-1",
      agentId: "agent-1",
      executionId: "exec-1",
      memoryLayer: "working",
      scope: "task",
      contentJson: "{}",
      classification: "fact",
      sourceTrustLevel: "high",
      qualityScore: 0.9,
      hitCount: 0,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: null,
      revokedAt: null,
      revocationReason: null,
      kind: "explicit",
      status: "active",
      importanceScore: 0.8,
      freshnessScore: 1.0,
      contentHash: "hash-revoke-1",
    });

    repo.revokeMemory("memory-revoke-1", now, "policy_violation");

    const result = repo.getMemory("memory-revoke-1");
    assert.ok(result);
    // revokeMemory only sets revoked_at and revocation_reason, not status
    assert.equal(result.revokedAt, now);
    assert.equal(result.revocationReason, "policy_violation");
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository findMemoryByContentHash finds active memory", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    repo.insertMemory({
      id: "memory-hash-1",
      taskId: "task-hash-1",
      sessionId: "session-1",
      agentId: "agent-1",
      executionId: "exec-1",
      memoryLayer: "working",
      scope: "task",
      contentJson: "{}",
      classification: "fact",
      sourceTrustLevel: "high",
      qualityScore: 0.9,
      hitCount: 0,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: null,
      revokedAt: null,
      revocationReason: null,
      kind: "explicit",
      status: "active",
      importanceScore: 0.8,
      freshnessScore: 1.0,
      contentHash: "unique-hash-abc",
    });

    const result = repo.findMemoryByContentHash("unique-hash-abc", "task");
    assert.ok(result);
    assert.equal(result.id, "memory-hash-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository findMemoryByContentHash returns null for revoked memory", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    repo.insertMemory({
      id: "memory-revoked-hash-1",
      taskId: "task-revoked-hash-1",
      sessionId: "session-1",
      agentId: "agent-1",
      executionId: "exec-1",
      memoryLayer: "working",
      scope: "task",
      contentJson: "{}",
      classification: "fact",
      sourceTrustLevel: "high",
      qualityScore: 0.9,
      hitCount: 0,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: null,
      revokedAt: now,
      revocationReason: "test",
      kind: "explicit",
      status: "revoked",
      importanceScore: 0.8,
      freshnessScore: 1.0,
      contentHash: "revoked-hash-xyz",
    });

    const result = repo.findMemoryByContentHash("revoked-hash-xyz", "task");
    assert.strictEqual(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryRepository getMemoryQualityReport builds report", () => {
  const workspace = createTempWorkspace("aa-memory-repo-");
  const dbPath = join(workspace, "memory.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MemoryRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    repo.insertMemory({
      id: "memory-quality-1",
      taskId: "task-quality-1",
      sessionId: "session-1",
      agentId: "agent-1",
      executionId: "exec-1",
      memoryLayer: "working",
      scope: "task",
      contentJson: "{}",
      classification: "fact",
      sourceTrustLevel: "high",
      qualityScore: 0.9,
      hitCount: 10,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: null,
      revokedAt: null,
      revocationReason: null,
      kind: "explicit",
      status: "active",
      importanceScore: 0.8,
      freshnessScore: 1.0,
      contentHash: "hash-quality-1",
    });

    const report = repo.getMemoryQualityReport({ taskId: "task-quality-1" });
    assert.ok(report);
    assert.ok(report.totalCount !== undefined);
    assert.ok(report.averageQualityScore !== undefined);
  } finally {
    cleanupPath(workspace);
  }
});
