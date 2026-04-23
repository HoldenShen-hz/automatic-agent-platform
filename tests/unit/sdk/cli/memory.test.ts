import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { loadMemoryCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

describe("loadMemoryCliEnv", () => {
  it("parses remember and sync_turn actions with current keys", () => {
    const remember = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "remember",
      AA_MEMORY_SCOPE: "session",
      AA_TASK_ID: "task-123",
      AA_SESSION_ID: "session-456",
      AA_AGENT_ID: "agent-789",
      AA_EXECUTION_ID: "exec-abc",
      AA_MEMORY_TEXT: "memory content",
      AA_MEMORY_QUALITY_SCORE: "0.85",
      AA_MEMORY_LAYER: "episodic",
      AA_MEMORY_SOURCE_TRUST: "high",
      AA_MEMORY_CREATED_AT: "2024-02-01T09:00:00Z",
      AA_MEMORY_EXPIRES_AT: "2024-12-31T23:59:59Z",
    });
    const syncTurn = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "sync_turn",
      AA_MEMORY_SCOPE: "execution",
      AA_MEMORY_TEXT: "turn content",
      AA_EXECUTION_ID: "exec-def",
      AA_EXPERIENCE_TASK_CONTEXT: "context summary",
      AA_EXPERIENCE_TASK_INTENT: "intent summary",
      AA_EXPERIENCE_OUTCOME: "succeeded",
      AA_EXPERIENCE_QUALITY_SCORE: "0.92",
    });

    assert.equal(remember.qualityScore, 0.85);
    assert.equal(remember.sourceTrustLevel, "high");
    assert.equal(remember.createdAt, "2024-02-01T09:00:00Z");
    assert.equal(remember.expiresAt, "2024-12-31T23:59:59Z");
    assert.equal(syncTurn.experienceOutcome, "succeeded");
    assert.equal(syncTurn.experienceQualityScore, 0.92);
  });

  it("parses list and consolidate filters", () => {
    const list = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "list",
      AA_MEMORY_SCOPE: "task",
      AA_MEMORY_LAYERS: "episodic,semantic",
      AA_MEMORY_CLASSIFICATIONS: "fact,preference",
      AA_MEMORY_SOURCE_TRUST_LEVELS: "high,medium",
      AA_MEMORY_MIN_QUALITY_SCORE: "0.7",
      AA_MEMORY_LIMIT: "50",
      AA_MEMORY_INCLUDE_EXPIRED: "true",
      AA_MEMORY_INCLUDE_REVOKED: "false",
    });
    const consolidate = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "consolidate",
      AA_MEMORY_SCOPE: "task",
      AA_MEMORY_REVOKE_SOURCES: "true",
      AA_MEMORY_MIN_SOURCE_MEMORIES: "5",
      AA_MEMORY_MAX_SOURCE_MEMORIES: "20",
      AA_MEMORY_TARGET_LAYER: "semantic",
    });

    assert.deepEqual(list.memoryLayers, ["episodic", "semantic"]);
    assert.deepEqual(list.classifications, ["fact", "preference"]);
    assert.deepEqual(list.sourceTrustLevels, ["high", "medium"]);
    assert.equal(list.includeExpired, true);
    assert.equal(consolidate.targetMemoryLayer, "semantic");
  });

  it("parses revoke and rejects unknown actions", () => {
    const revoke = loadMemoryCliEnv({
      AA_MEMORY_ACTION: "revoke",
      AA_MEMORY_ID: "mem-123",
      AA_MEMORY_REVOCATION_REASON: "outdated",
    });

    assert.equal(revoke.memoryId, "mem-123");
    assert.equal(revoke.revocationReason, "outdated");

    assert.throws(
      () =>
        loadMemoryCliEnv({
          AA_MEMORY_ACTION: "unknown_action",
        }),
      (error) =>
        error instanceof ValidationError && error.code === "invalid_env:AA_MEMORY_ACTION",
    );
  });
});
