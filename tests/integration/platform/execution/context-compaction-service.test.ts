import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { buildStructuredToolResultParts, serializeMessageParts } from "../../../../src/platform/model-gateway/messages/message-parts.js";
import { ContextCompactionService } from "../../../../src/platform/execution/execution-engine/context-compaction-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function seedTaskAndSession(db: SqliteDatabase, store: AuthoritativeTaskStore, input: { taskId: string; sessionId: string }): void {
  const now = nowIso();
  db.transaction(() => {
    store.insertTask({
      id: input.taskId,
      parentId: null,
      rootId: input.taskId,
      divisionId: "general_ops",
      title: "Compaction task",
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
      id: input.sessionId,
      taskId: input.taskId,
      channel: "cli",
      status: "open",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

test("context compaction service trims older tool results before summarizing", () => {
  const workspace = createTempWorkspace("aa-context-compact-");
  const dbPath = join(workspace, "context-compact.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ContextCompactionService(db, store);
    seedTaskAndSession(db, store, { taskId: "task-compact", sessionId: "sess-compact" });

    db.transaction(() => {
      store.insertMessage({
        id: "msg-user",
        sessionId: "sess-compact",
        direction: "inbound",
        messageType: "user_request",
        content: "Please analyze a long task and preserve the final answer.",
        attachmentsJson: null,
        createdAt: "2026-04-03T10:00:00.000Z",
      });
      store.insertMessage({
        id: "msg-plan",
        sessionId: "sess-compact",
        direction: "system",
        messageType: "assistant_plan",
        content: "Plan the work, then draft and review the result.",
        attachmentsJson: null,
        createdAt: "2026-04-03T10:00:01.000Z",
      });
      for (let index = 0; index < 5; index += 1) {
        store.insertMessage({
          id: `msg-tool-${index}`,
          sessionId: "sess-compact",
          direction: "system",
          messageType: "tool_result",
          content: `Tool result ${index}: ${"verbose output ".repeat(20)}`,
          attachmentsJson: null,
          createdAt: `2026-04-03T10:00:0${index + 2}.000Z`,
        });
      }
    });

    const result = service.compactContext({
      taskId: "task-compact",
      sessionId: "sess-compact",
      maxContextTokens: 220,
      providerMaxOutputTokens: 40,
      recentToolResultWindow: 2,
      compactionMaxFrequencyPerSession: 2,
      occurredAt: "2026-04-03T10:10:00.000Z",
    });
    const records = store.listCompactionRecordsBySession("sess-compact");
    db.close();

    assert.equal(result.stage1Triggered, true);
    assert.equal(result.stage2Triggered, true);
    assert.equal(result.fallbackToStage1, false);
    assert.ok(result.contextMessages.some((message) => message.messageType === "compaction_summary"));
    assert.ok(records.some((record) => record.stage === "trim"));
    assert.ok(records.some((record) => record.stage === "summarize"));
    assert.ok(result.usageAfterStage2Tokens < result.usageBeforeTokens);
  } finally {
    cleanupPath(workspace);
  }
});

test("context compaction service preserves structured summaries and artifact refs when trimming tool result parts", () => {
  const workspace = createTempWorkspace("aa-context-compact-");
  const dbPath = join(workspace, "context-compact-structured.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ContextCompactionService(db, store);
    seedTaskAndSession(db, store, { taskId: "task-structured", sessionId: "sess-structured" });

    db.transaction(() => {
      store.insertMessage({
        id: "msg-user",
        sessionId: "sess-structured",
        direction: "inbound",
        messageType: "user_request",
        content: "Keep the latest task intent.",
        attachmentsJson: null,
        createdAt: "2026-04-03T11:00:00.000Z",
      });
      store.insertMessage({
        id: "msg-tool-old",
        sessionId: "sess-structured",
        direction: "system",
        messageType: "tool_result",
        content: `Old verbose tool output ${"payload ".repeat(30)}`,
        partsJson: serializeMessageParts(buildStructuredToolResultParts({
          messageId: "msg-tool-old",
          createdAt: "2026-04-03T11:00:01.000Z",
          summaryText: "Older tool output summary.",
          resultText: `Old verbose tool output ${"payload ".repeat(30)}`,
          artifactRefs: [{
            artifactId: "artifact-old",
            kind: "workflow_step_snapshot",
            uri: "/tmp/artifact-old.json",
            mimeType: "application/json",
            sizeBytes: 128,
            checksum: "abc123",
            createdAt: "2026-04-03T11:00:01.000Z",
          }],
          metadata: {
            totalTokens: 160,
          },
        })),
        attachmentsJson: null,
        createdAt: "2026-04-03T11:00:01.000Z",
      });
      store.insertMessage({
        id: "msg-tool-recent",
        sessionId: "sess-structured",
        direction: "system",
        messageType: "tool_result",
        content: "Recent tool output should stay intact.",
        attachmentsJson: null,
        createdAt: "2026-04-03T11:00:02.000Z",
      });
    });

    const result = service.compactContext({
      taskId: "task-structured",
      sessionId: "sess-structured",
      maxContextTokens: 120,
      providerMaxOutputTokens: 20,
      recentToolResultWindow: 1,
      compactionMaxFrequencyPerSession: 2,
      occurredAt: "2026-04-03T11:10:00.000Z",
    });
    db.close();

    const trimmedMessage = result.contextMessages.find((message) => message.messageId === "msg-tool-old");
    assert.equal(result.stage1Triggered, true);
    assert.equal(result.stage2Triggered, false);
    assert.ok(result.usageBeforeTokens >= 160);
    assert.equal(trimmedMessage?.trimmed, true);
    assert.ok((trimmedMessage?.estimatedTokens ?? 0) < 160);
    assert.equal(trimmedMessage?.content.includes("Older tool output summary."), true);
    assert.equal(trimmedMessage?.content.includes("Artifact ref kind=workflow_step_snapshot artifact_id=artifact-old"), true);
    assert.equal(trimmedMessage?.content.includes("Tool result trimmed for context budget."), true);
  } finally {
    cleanupPath(workspace);
  }
});

test("context compaction service falls back to stage1 when summarize frequency is exhausted", () => {
  const workspace = createTempWorkspace("aa-context-compact-");
  const dbPath = join(workspace, "context-compact-fallback.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ContextCompactionService(db, store);
    seedTaskAndSession(db, store, { taskId: "task-fallback", sessionId: "sess-fallback" });

    db.transaction(() => {
      store.insertMessage({
        id: "msg-user",
        sessionId: "sess-fallback",
        direction: "inbound",
        messageType: "user_request",
        content: "Keep the latest instruction.",
        attachmentsJson: null,
        createdAt: "2026-04-03T10:00:00.000Z",
      });
      for (let index = 0; index < 4; index += 1) {
        store.insertMessage({
          id: `msg-tool-${index}`,
          sessionId: "sess-fallback",
          direction: "system",
          messageType: "tool_result",
          content: `Historical result ${index}: ${"payload ".repeat(25)}`,
          attachmentsJson: null,
          createdAt: `2026-04-03T10:00:0${index + 1}.000Z`,
        });
      }
      store.insertCompactionRecord({
        id: "compact-existing",
        sessionId: "sess-fallback",
        taskId: "task-fallback",
        stage: "summarize",
        sourceMessageIdsJson: JSON.stringify(["msg-tool-0"]),
        summaryText: "Existing compacted summary",
        summaryRef: "msg-summary-existing",
        compactionReason: "prior_compaction",
        overflowTriggered: 1,
        autoTriggered: 1,
        tokenReductionEstimate: 20,
        createdAt: "2026-04-03T10:05:00.000Z",
      });
    });

    const result = service.compactContext({
      taskId: "task-fallback",
      sessionId: "sess-fallback",
      maxContextTokens: 150,
      providerMaxOutputTokens: 30,
      recentToolResultWindow: 1,
      compactionMaxFrequencyPerSession: 1,
      occurredAt: "2026-04-03T10:10:00.000Z",
    });
    db.close();

    assert.equal(result.stage1Triggered, true);
    assert.equal(result.stage2Triggered, true);
    assert.equal(result.fallbackToStage1, true);
    assert.equal(result.errorCode, "runtime.compaction_budget_exhausted");
    assert.ok(result.contextMessages.every((message) => message.messageType !== "compaction_summary"));
  } finally {
    cleanupPath(workspace);
  }
});
