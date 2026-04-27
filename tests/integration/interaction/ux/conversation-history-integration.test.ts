/**
 * Integration Test: Conversation History Pipeline
 *
 * Tests integration between ConversationHistoryService, session management,
 * turn tracking, and history retrieval patterns.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ConversationHistoryService } from "../../../src/interaction/ux/conversation-history-service.js";
import type {
  ConversationSessionRecord,
  ConversationTurnRecord,
} from "../../../src/interaction/ux/conversation-history-service.js";

function createService(): ConversationHistoryService {
  return new ConversationHistoryService();
}

test("integration: ConversationHistoryService session lifecycle with multiple turns", async () => {
  const service = createService();

  // Start session
  const session = service.startSession("tenant_integ", "user_integ");

  // Add user turn
  let updated = await service.addTurn(session, {
    role: "user",
    message: "帮我创建一个代码审查任务",
    intent: "task_create",
    confidence: 0.92,
    entities: { taskType: "code_review" },
  });

  // Add assistant turn
  updated = await service.addTurn(updated, {
    role: "assistant",
    message: "好的，请提供任务标题",
    intent: "task_create",
  });

  // Add another user turn
  updated = await service.addTurn(updated, {
    role: "user",
    message: "标题：优化数据库查询",
    intent: "task_detail",
    confidence: 0.88,
  });

  assert.equal(updated.turns.length, 3);
  assert.equal(updated.turns[0]!.role, "user");
  assert.equal(updated.turns[1]!.role, "assistant");
  assert.equal(updated.turns[2]!.role, "user");
  assert.equal(updated.lastIntent, "task_detail");
  assert.ok(updated.sessionId.startsWith("conv_"));
});

test("integration: ConversationHistoryService handles role transitions correctly", async () => {
  const service = createService();

  let session = service.startSession("tenant_1", "user_1");

  // Simulate conversation flow: user -> assistant -> user -> assistant -> user
  session = await service.addTurn(session, { role: "user", message: "初始请求" });
  session = await service.addTurn(session, { role: "assistant", message: "确认信息" });
  session = await service.addTurn(session, { role: "user", message: "详细信息" });
  session = await service.addTurn(session, { role: "assistant", message: "任务已创建" });
  session = await service.addTurn(session, { role: "user", message: "好的，谢谢" });

  assert.equal(session.turns.length, 5);

  const roles = session.turns.map((t) => t.role);
  assert.deepEqual(roles, ["user", "assistant", "user", "assistant", "user"]);
});

test("integration: ConversationHistoryService completes session with final turn", async () => {
  const service = createService();

  let session = service.startSession("tenant_completion", "user_completion");

  session = await service.addTurn(session, {
    role: "user",
    message: "提交代码",
    intent: "code_submit",
    confidence: 0.95,
  });

  session = await service.addTurn(session, {
    role: "assistant",
    message: "代码已提交，正在执行审查",
  });

  const completed = await service.completeSession(session);

  assert.equal(completed.status, "completed");
  assert.equal(completed.turns.length, 2);
  assert.ok(completed.updatedAt >= completed.createdAt);
});

test("integration: ConversationHistoryService abandons session", async () => {
  const service = createService();

  const session = service.startSession("tenant_abandon", "user_abandon");

  const abandoned = await service.abandonSession(session);

  assert.equal(abandoned.status, "abandoned");
  assert.ok(abandoned.updatedAt);
});

test("integration: ConversationHistoryService session timestamps persist", async () => {
  const service = createService();

  const before = new Date().toISOString();
  const session = service.startSession("tenant_ts", "user_ts");
  const after = new Date().toISOString();

  assert.ok(session.createdAt >= before);
  assert.ok(session.createdAt <= after);
  assert.equal(session.updatedAt, session.createdAt);
});

test("integration: ConversationHistoryService turn timestamps are sequential", async () => {
  const service = createService();

  let session = service.startSession("tenant_seq", "user_seq");

  const beforeFirst = new Date().toISOString();
  session = await service.addTurn(session, { role: "user", message: "第一条消息" });
  const afterFirst = new Date().toISOString();

  // Small delay to ensure different timestamps
  await new Promise((resolve) => setTimeout(resolve, 10));

  session = await service.addTurn(session, { role: "assistant", message: "第二条消息" });
  const afterSecond = new Date().toISOString();

  assert.ok(session.turns[0]!.timestamp >= beforeFirst);
  assert.ok(session.turns[0]!.timestamp <= afterFirst);
  assert.ok(session.turns[1]!.timestamp >= session.turns[0]!.timestamp);
  assert.ok(session.turns[1]!.timestamp <= afterSecond);
});

test("integration: ConversationHistoryService with metadata preserved", async () => {
  const service = createService();

  let session = service.startSession("tenant_meta", "user_meta");

  session = await service.addTurn(session, {
    role: "user",
    message: "执行部署",
    intent: "deploy",
    metadata: { environment: "staging", version: "1.2.3" },
  });

  assert.deepEqual(session.turns[0]!.metadata, { environment: "staging", version: "1.2.3" });
});

test("integration: ConversationHistoryService isAvailable reflects memory service state", () => {
  const service = new ConversationHistoryService();
  assert.equal(service.isAvailable(), false);
});

test("integration: ConversationSessionRecord structure with all optional fields", () => {
  const session: ConversationSessionRecord = {
    sessionId: "conv_integ_test",
    tenantId: "tenant_integ",
    userId: "user_integ",
    turns: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastIntent: "task_create",
    status: "active",
  };

  assert.equal(session.sessionId, "conv_integ_test");
  assert.equal(session.lastIntent, "task_create");
  assert.equal(session.status, "active");
});

test("integration: ConversationHistoryService multiple sessions per user tracked independently", async () => {
  const service = createService();

  const session1 = service.startSession("tenant_multi", "user_multi");
  const session2 = service.startSession("tenant_multi", "user_multi");

  // Add different turns to each session
  let s1 = await service.addTurn(session1, { role: "user", message: "Session 1 message" });
  s1 = await service.addTurn(s1, { role: "assistant", message: "Session 1 response" });

  let s2 = await service.addTurn(session2, { role: "user", message: "Session 2 message" });

  assert.equal(s1.turns.length, 2);
  assert.equal(s2.turns.length, 1);
  assert.notEqual(s1.sessionId, s2.sessionId);
});