import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { BuiltInMemoryProvider } from "../../../../src/platform/five-plane-state-evidence/memory/builtin-memory-provider.js";
import { MemoryService } from "../../../../src/platform/five-plane-state-evidence/memory/memory-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("memory provider seam does not widen scope or trust boundaries during prefetch", async () => {
  const workspace = createTempWorkspace("aa-memory-provider-security-");
  const dbPath = join(workspace, "memory-provider-security.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memory = new MemoryService(store);
    const provider = new BuiltInMemoryProvider(memory);

    memory.remember({
      sessionId: "session-safe",
      scope: "project",
      content: "safe operator guidance",
      classification: "internal",
      sourceTrustLevel: "trusted",
      createdAt: "2026-04-08T10:00:00.000Z",
    });
    memory.remember({
      sessionId: "session-safe",
      scope: "role:finance",
      content: "finance-only guidance",
      classification: "internal",
      sourceTrustLevel: "trusted",
      createdAt: "2026-04-08T10:01:00.000Z",
    });
    memory.remember({
      sessionId: "session-safe",
      scope: "project",
      content: "untrusted web memory",
      classification: "internal",
      sourceTrustLevel: "untrusted",
      createdAt: "2026-04-08T10:02:00.000Z",
    });

    const result = await provider.prefetch({
      sessionId: "session-safe",
      scopes: ["project"],
      sourceTrustLevels: ["trusted"],
      queryText: "guidance",
    });

    assert.equal(result.memories.length, 1);
    assert.equal(result.memories[0]?.scope, "project");
    assert.equal(result.memories[0]?.sourceTrustLevel, "trusted");
    assert.doesNotMatch(result.promptBlock, /finance-only guidance/);
    assert.doesNotMatch(result.promptBlock, /untrusted web memory/);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
