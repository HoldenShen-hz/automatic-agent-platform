/**
 * Integration Test: Message Storage Integration
 *
 * Verifies message persistence and retrieval
 * using the actual database layer.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("message storage: can insert and retrieve messages via store", () => {
  const workspace = createTempWorkspace("aa-msg-storage-");

  try {
    const dbPath = join(workspace, "msg-storage.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const sessionId = newId("sess");
    const now = nowIso();

    // Create task first (session references task via FK)
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Message storage test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Insert message via store
    const messageId = newId("msg");
    db.transaction(() => {
      store.insertMessage({
        id: messageId,
        sessionId,
        direction: "inbound",
        messageType: "text",
        content: "Hello, how can I help you?",
        partsJson: JSON.stringify([{ type: "text", text: "Hello, how can I help you?" }]),
        attachmentsJson: null,
        createdAt: now,
      });
    });

    // Retrieve messages
    const messages = store.listMessagesBySession(sessionId);
    assert.ok(messages.length > 0, "Should have messages");
    assert.equal(messages[0]!.content, "Hello, how can I help you?");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("message storage: messages are ordered by creation time", () => {
  const workspace = createTempWorkspace("aa-msg-order-");

  try {
    const dbPath = join(workspace, "msg-order.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const sessionId = newId("sess");
    const now = nowIso();

    // Create task and session
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Message order test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Insert multiple messages with different timestamps
    const messages = [
      { content: "First message", delay: 0 },
      { content: "Second message", delay: 1 },
      { content: "Third message", delay: 2 },
    ];

    for (const msg of messages) {
      const msgId = newId("msg");
      const msgTime = new Date(Date.now() + msg.delay).toISOString();
      db.transaction(() => {
        store.insertMessage({
          id: msgId,
          sessionId,
          direction: "inbound",
          messageType: "text",
          content: msg.content,
          partsJson: JSON.stringify([{ type: "text", text: msg.content }]),
          attachmentsJson: null,
          createdAt: msgTime,
        });
      });
    }

    // Retrieve and verify order
    const retrievedMessages = store.listMessagesBySession(sessionId);
    assert.equal(retrievedMessages.length, 3, "Should have 3 messages");
    assert.ok(retrievedMessages[0]!.createdAt <= retrievedMessages[1]!.createdAt);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("message storage: message parts JSON is preserved", () => {
  const workspace = createTempWorkspace("aa-msg-parts-");

  try {
    const dbPath = join(workspace, "msg-parts.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const sessionId = newId("sess");
    const now = nowIso();

    // Create task and session
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Message parts test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Insert message with complex parts
    const parts = [
      { type: "text", text: "Here's the file content:" },
      { type: "tool_use", name: "Read", input: { path: "/workspace/file.txt" } },
      { type: "tool_result", toolName: "Read", content: "file content here" },
    ];

    const messageId = newId("msg");
    db.transaction(() => {
      store.insertMessage({
        id: messageId,
        sessionId,
        direction: "outbound",
        messageType: "tool_call",
        content: "Used Read tool",
        partsJson: JSON.stringify(parts),
        attachmentsJson: null,
        createdAt: now,
      });
    });

    // Retrieve and verify parts
    const messages = store.listMessagesBySession(sessionId);
    assert.ok(messages[0], "Should have at least one message");
    const retrievedParts = JSON.parse(messages[0]!.partsJson!);

    assert.equal(retrievedParts.length, 3);
    assert.equal(retrievedParts[0].type, "text");
    assert.equal(retrievedParts[1].type, "tool_use");
    assert.equal(retrievedParts[1].name, "Read");
    assert.equal(retrievedParts[2].type, "tool_result");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
