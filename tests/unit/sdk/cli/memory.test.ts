/**
 * Memory CLI Tests
 *
 * Tests for memory CLI module which handles memory operations including
 * initialization, remembering facts, prefetching, querying, and consolidation.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { loadMemoryCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

describe("loadMemoryCliEnv", () => {
  it("parses initialize action", () => {
    const config = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "initialize",
    });

    assert.equal(config.action, "initialize");
  });

  it("parses remember action with scope", () => {
    const config = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "remember",
      AA_MEMORY_SCOPE: "task",
      AA_MEMORY_TEXT: "test memory content",
    });

    assert.equal(config.action, "remember");
    assert.equal(config.scope, "task");
    assert.equal(config.memoryText, "test memory content");
  });

  it("parses remember with optional parameters", () => {
    const config = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "remember",
      AA_MEMORY_SCOPE: "session",
      AA_TASK_ID: "task-123",
      AA_SESSION_ID: "session-456",
      AA_AGENT_ID: "agent-789",
      AA_EXECUTION_ID: "exec-abc",
      AA_MEMORY_TEXT: "memory content",
      AA_QUALITY_SCORE: "0.85",
      AA_MEMORY_LAYER: "episodic",
      AA_SOURCE_TRUST_LEVEL: "high",
    });

    assert.equal(config.taskId, "task-123");
    assert.equal(config.sessionId, "session-456");
    assert.equal(config.agentId, "agent-789");
    assert.equal(config.executionId, "exec-abc");
    assert.equal(config.qualityScore, 0.85);
    assert.equal(config.memoryLayer, "episodic");
    assert.equal(config.sourceTrustLevel, "high");
  });

  it("parses prefetch action", () => {
    const config = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "prefetch",
      AA_MEMORY_SCOPE: "task",
      AA_TASK_ID: "task-xyz",
    });

    assert.equal(config.action, "prefetch");
    assert.equal(config.scope, "task");
    assert.equal(config.taskId, "task-xyz");
  });

  it("parses queue_prefetch action", () => {
    const config = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "queue_prefetch",
      AA_MEMORY_SCOPE: "session",
      AA_SESSION_ID: "session-123",
      AA_PREFETCH_AWAIT: "false",
    });

    assert.equal(config.action, "queue_prefetch");
    assert.equal(config.prefetchAwait, false);
  });

  it("parses queue_prefetch with await", () => {
    const config = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "queue_prefetch",
      AA_MEMORY_SCOPE: "session",
      AA_SESSION_ID: "session-123",
      AA_PREFETCH_AWAIT: "true",
    });

    assert.equal(config.prefetchAwait, true);
  });

  it("parses system_prompt_block action", () => {
    const config = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "system_prompt_block",
      AA_MEMORY_SCOPE: "agent",
      AA_AGENT_ID: "agent-abc",
    });

    assert.equal(config.action, "system_prompt_block");
    assert.equal(config.scope, "agent");
    assert.equal(config.agentId, "agent-abc");
  });

  it("parses sync_turn action", () => {
    const config = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "sync_turn",
      AA_MEMORY_SCOPE: "execution",
      AA_MEMORY_TEXT: "turn content",
      AA_EXECUTION_ID: "exec-def",
    });

    assert.equal(config.action, "sync_turn");
    assert.equal(config.scope, "execution");
    assert.equal(config.memoryText, "turn content");
  });

  it("parses sync_turn with experience", () => {
    const config = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "sync_turn",
      AA_MEMORY_SCOPE: "execution",
      AA_MEMORY_TEXT: "turn content",
      AA_TASK_ID: "task-ghi",
      AA_SESSION_ID: "session-ghi",
      AA_AGENT_ID: "agent-ghi",
      AA_EXECUTION_ID: "exec-ghi",
      AA_EXPERIENCE_TASK_CONTEXT: "context summary",
      AA_EXPERIENCE_TASK_INTENT: "intent summary",
      AA_EXPERIENCE_OUTCOME: "succeeded",
      AA_EXPERIENCE_QUALITY_SCORE: "0.92",
    });

    assert.equal(config.experienceTaskContext, "context summary");
    assert.equal(config.experienceTaskIntent, "intent summary");
    assert.equal(config.experienceOutcome, "succeeded");
    assert.equal(config.experienceQualityScore, 0.92);
  });

  it("parses shutdown action", () => {
    const config = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "shutdown",
    });

    assert.equal(config.action, "shutdown");
  });

  it("parses list action", () => {
    const config = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "list",
      AA_MEMORY_SCOPE: "task",
      AA_TASK_ID: "task-123",
      AA_INCLUDE_EXPIRED: "true",
      AA_INCLUDE_REVOKED: "false",
    });

    assert.equal(config.action, "list");
    assert.equal(config.includeExpired, true);
    assert.equal(config.includeRevoked, false);
  });

  it("parses list with filters", () => {
    const config = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "list",
      AA_MEMORY_SCOPE: "task",
      AA_MEMORY_LAYERS: '["episodic","semantic"]',
      AA_CLASSIFICATIONS: '["fact","preference"]',
      AA_SOURCE_TRUST_LEVELS: '["high","medium"]',
      AA_MIN_QUALITY_SCORE: "0.7",
      AA_LIMIT: "50",
    });

    assert.deepEqual(config.memoryLayers, ["episodic", "semantic"]);
    assert.deepEqual(config.classifications, ["fact", "preference"]);
    assert.deepEqual(config.sourceTrustLevels, ["high", "medium"]);
    assert.equal(config.minQualityScore, 0.7);
    assert.equal(config.limit, 50);
  });

  it("parses quality action", () => {
    const config = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "quality",
      AA_MEMORY_SCOPE: "agent",
      AA_AGENT_ID: "agent-abc",
    });

    assert.equal(config.action, "quality");
    assert.equal(config.scope, "agent");
  });

  it("parses consolidate action", () => {
    const config = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "consolidate",
      AA_MEMORY_SCOPE: "task",
      AA_TASK_ID: "task-456",
      AA_REVOKE_SOURCE_MEMORIES: "true",
      AA_MIN_SOURCE_MEMORIES: "5",
      AA_MAX_SOURCE_MEMORIES: "20",
    });

    assert.equal(config.action, "consolidate");
    assert.equal(config.revokeSourceMemories, true);
    assert.equal(config.minSourceMemories, 5);
    assert.equal(config.maxSourceMemories, 20);
  });

  it("parses revoke action", () => {
    const config = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "revoke",
      AA_MEMORY_ID: "mem-123",
      AA_MEMORY_REVOCATION_REASON: "outdated",
    });

    assert.equal(config.action, "revoke");
    assert.equal(config.memoryId, "mem-123");
    assert.equal(config.revocationReason, "outdated");
  });

  it("throws ValidationError for unknown action", () => {
    assert.throws(
      () =>
        loadMemoryCliEnv({
          AA_MEMORY_ACTION: "unknown_action",
        }),
      (e) => e instanceof ValidationError && (e as ValidationError).code.includes("unsupported_memory_action"),
    );
  });

  it("parses optional db_path", () => {
    const config = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "list",
      AA_MEMORY_SCOPE: "task",
      AA_DB_PATH: "/tmp/memory.db",
    });

    assert.equal(config.dbPath, "/tmp/memory.db");
  });

  it("parses optional created_at", () => {
    const config = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "remember",
      AA_MEMORY_SCOPE: "task",
      AA_MEMORY_TEXT: "test",
      AA_CREATED_AT: "2024-02-01T09:00:00Z",
    });

    assert.equal(config.createdAt, "2024-02-01T09:00:00Z");
  });

  it("parses optional expires_at", () => {
    const config = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "remember",
      AA_MEMORY_SCOPE: "task",
      AA_MEMORY_TEXT: "test",
      AA_EXPIRES_AT: "2024-12-31T23:59:59Z",
    });

    assert.equal(config.expiresAt, "2024-12-31T23:59:59Z");
  });

  it("parses optional target_memory_layer for consolidate", () => {
    const config = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "consolidate",
      AA_MEMORY_SCOPE: "task",
      AA_TARGET_MEMORY_LAYER: "semantic",
    });

    assert.equal(config.targetMemoryLayer, "semantic");
  });
});
