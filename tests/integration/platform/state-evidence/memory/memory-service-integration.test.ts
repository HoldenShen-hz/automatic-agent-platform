import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { MemoryService } from "../../../../../src/platform/state-evidence/memory/memory-service.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { createTempWorkspace, cleanupPath } from "../../../../helpers/fs.js";

function createMemoryService(workspace: string) {
  const db = new SqliteDatabase(join(workspace, "memory-integration.db"));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const service = new MemoryService(store);
  return { service, store, db };
}

test("MemoryService integration: multiple scopes with independent recall", () => {
  const workspace = createTempWorkspace("aa-memory-scopes-");
  try {
    const { service } = createMemoryService(workspace);

    service.remember({ scope: "project", content: "project memory" });
    service.remember({ scope: "session", content: "session memory" });
    service.remember({ scope: "task", content: "task memory" });

    const projectMemories = service.recall({ scopes: ["project"] });
    const sessionMemories = service.recall({ scopes: ["session"] });

    assert.equal(projectMemories.length, 1);
    assert.ok(projectMemories[0]?.contentJson.includes("project memory"));
    assert.equal(sessionMemories.length, 1);
    assert.ok(sessionMemories[0]?.contentJson.includes("session memory"));
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryService integration: recall with trust level filtering", () => {
  const workspace = createTempWorkspace("aa-memory-trust-");
  try {
    const { service } = createMemoryService(workspace);

    service.remember({ scope: "test", content: "trusted content", sourceTrustLevel: "trusted" });
    service.remember({ scope: "test", content: "external content", sourceTrustLevel: "external" });
    service.remember({ scope: "test", content: "untrusted content", sourceTrustLevel: "untrusted" });

    const memories = service.recall({ scopes: ["test"] });
    assert.equal(memories.length, 3);
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryService integration: revoke marks memory as inactive", () => {
  const workspace = createTempWorkspace("aa-memory-revoke-");
  try {
    const { service } = createMemoryService(workspace);

    const record = service.remember({ scope: "test", content: "to be revoked" });
    const revoked = service.revoke(record.id, "test_reason");

    assert.equal(revoked !== null, true);
    assert.equal(revoked?.revokedAt !== null && revoked?.revokedAt !== undefined, true);
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryService integration: recordFailureMemory creates structured failure record", () => {
  const workspace = createTempWorkspace("aa-memory-failure-");
  try {
    const { service } = createMemoryService(workspace);

    const record = service.recordFailureMemory({
      taskId: "task-fail",
      executionId: "exec-fail",
      agentId: "agent-1",
      reasonCode: "tool.timeout",
      errorMessage: "Command timed out",
    });

    assert.equal(record.taskId, "task-fail");
    assert.ok(record.contentJson.includes("tool.timeout"));
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryService integration: remember with structured content", () => {
  const workspace = createTempWorkspace("aa-memory-structured-");
  try {
    const { service } = createMemoryService(workspace);

    const structured = {
      type: "file_edit",
      file: "/workspace/test.ts",
      change: "added function foo()",
    };

    const record = service.remember({
      scope: "code",
      content: structured,
    });

    assert.ok(record.contentJson.includes("file_edit"));
    assert.ok(record.id.startsWith("mem_"));
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryService integration: recall updates hit count", () => {
  const workspace = createTempWorkspace("aa-memory-hitcount-");
  try {
    const { service } = createMemoryService(workspace);

    service.remember({ scope: "test", content: "hit me twice" });

    const first = service.recall({ scopes: ["test"] });
    assert.equal(first[0]?.hitCount, 1);

    const second = service.recall({ scopes: ["test"] });
    assert.equal(second[0]?.hitCount, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("MemoryService integration: multiple memories with different layers", () => {
  const workspace = createTempWorkspace("aa-memory-layers-");
  try {
    const { service } = createMemoryService(workspace);

    service.remember({ scope: "s1", content: "Layer3 memory content here", memoryLayer: "layer_3" });
    service.remember({ scope: "s2", content: "Layer5 memory content here", memoryLayer: "layer_5" });
    service.remember({ scope: "s3", content: "Layer7 memory content here", memoryLayer: "layer_7" });

    const memories = service.recall({ scopes: ["s1", "s2", "s3"] });
    assert.equal(memories.length, 3);
  } finally {
    cleanupPath(workspace);
  }
});
