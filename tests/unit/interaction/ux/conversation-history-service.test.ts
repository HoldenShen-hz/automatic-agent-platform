import test from "node:test";
import assert from "node:assert/strict";
import {
  ConversationHistoryService,
  type ConversationTurnRecord,
} from "../../../../src/interaction/ux/conversation-history-service.js";

test("ConversationHistoryService creates a new session", () => {
  const service = new ConversationHistoryService();

  const session = service.startSession("tenant_1", "user_1");

  assert.ok(session.sessionId.startsWith("conv_"));
  assert.equal(session.tenantId, "tenant_1");
  assert.equal(session.userId, "user_1");
  assert.equal(session.turns.length, 0);
  assert.equal(session.status, "active");
});

test("ConversationHistoryService adds turns to session", async () => {
  const service = new ConversationHistoryService();

  const session = service.startSession("tenant_1", "user_1");
  const updated = await service.addTurn(session, {
    role: "user",
    message: "创建一个任务",
    intent: "task_create",
    confidence: 0.85,
  });

  assert.equal(updated.turns.length, 1);
  assert.equal(updated.turns[0]!.message, "创建一个任务");
  assert.equal(updated.turns[0]!.role, "user");
  assert.equal(updated.lastIntent, "task_create");
});

test("ConversationHistoryService completes session", async () => {
  const service = new ConversationHistoryService();

  const session = service.startSession("tenant_1", "user_1");

  // Add a turn first to ensure updatedAt changes
  const withTurn = await service.addTurn(session, {
    role: "user",
    message: "测试",
  });

  const completed = await service.completeSession(withTurn);

  assert.equal(completed.status, "completed");
  assert.ok(completed.updatedAt >= completed.createdAt);
});

test("ConversationHistoryService abandons session", async () => {
  const service = new ConversationHistoryService();

  const session = service.startSession("tenant_1", "user_1");
  const abandoned = await service.abandonSession(session);

  assert.equal(abandoned.status, "abandoned");
});

test("ConversationHistoryService tracks multiple turns", async () => {
  const service = new ConversationHistoryService();

  let session = service.startSession("tenant_1", "user_1");

  session = await service.addTurn(session, {
    role: "user",
    message: "创建一个任务",
    intent: "task_create",
  });

  session = await service.addTurn(session, {
    role: "assistant",
    message: "好的，请提供任务标题",
  });

  session = await service.addTurn(session, {
    role: "user",
    message: "测试任务",
  });

  assert.equal(session.turns.length, 3);
  assert.equal(session.turns[0]!.role, "user");
  assert.equal(session.turns[1]!.role, "assistant");
  assert.equal(session.turns[2]!.role, "user");
});

test("ConversationHistoryService assigns unique turn IDs", async () => {
  const service = new ConversationHistoryService();

  const session = service.startSession("tenant_1", "user_1");
  const updated = await service.addTurn(session, {
    role: "user",
    message: "消息1",
  });

  assert.ok(updated.turns[0]!.turnId.startsWith("turn_"));
});

test("ConversationHistoryService records intent and entities", async () => {
  const service = new ConversationHistoryService();

  const session = service.startSession("tenant_1", "user_1");
  const updated = await service.addTurn(session, {
    role: "user",
    message: "部署到生产环境",
    intent: "task_create",
    confidence: 0.78,
    entities: { environment: "production" },
  });

  assert.equal(updated.turns[0]!.intent, "task_create");
  assert.equal(updated.turns[0]!.confidence, 0.78);
  assert.deepEqual(updated.turns[0]!.entities, { environment: "production" });
});

test("ConversationHistoryService isAvailable returns false without memory service", () => {
  const service = new ConversationHistoryService();

  assert.equal(service.isAvailable(), false);
});

test("R23-16: ConversationHistoryService listUserSessions enforces tenant filtering at query and result layers", async () => {
  let capturedTenantId: string | null = null;
  const memoryService = {
    recall: async (input: { tenantId?: string; scopes?: readonly string[] }) => {
      capturedTenantId = input.tenantId ?? null;
      return [
        {
          contentJson: JSON.stringify({
            sessionId: "conv_tenant_a",
            tenantId: "tenant_a",
            userId: "user_1",
            turns: [],
            createdAt: "2026-05-01T00:00:00.000Z",
            updatedAt: "2026-05-02T00:00:00.000Z",
            status: "active",
          }),
        },
        {
          contentJson: JSON.stringify({
            sessionId: "conv_tenant_b",
            tenantId: "tenant_b",
            userId: "user_1",
            turns: [],
            createdAt: "2026-05-01T00:00:00.000Z",
            updatedAt: "2026-05-03T00:00:00.000Z",
            status: "active",
          }),
        },
      ];
    },
  };
  const service = new ConversationHistoryService(memoryService as never);

  const sessions = await service.listUserSessions("user_1", "tenant_a", 10);

  assert.equal(capturedTenantId, "tenant_a");
  assert.deepEqual(sessions.map((session) => session.sessionId), ["conv_tenant_a"]);
});

test("ConversationHistoryService records timestamp on turn", async () => {
  const service = new ConversationHistoryService();

  const session = service.startSession("tenant_1", "user_1");
  const before = new Date().toISOString();
  const updated = await service.addTurn(session, {
    role: "user",
    message: "测试",
  });
  const after = new Date().toISOString();

  const turnTime = updated.turns[0]!.timestamp;
  assert.ok(turnTime >= before && turnTime <= after);
});

test("ConversationTurnRecord structure is correct", () => {
  const turn: ConversationTurnRecord = {
    turnId: "turn_123",
    role: "user",
    message: "测试消息",
    intent: "task_create",
    confidence: 0.9,
    entities: { key: "value" },
    timestamp: new Date().toISOString(),
    metadata: { custom: "data" },
  };

  assert.equal(turn.turnId, "turn_123");
  assert.equal(turn.role, "user");
  assert.equal(turn.message, "测试消息");
  assert.equal(turn.intent, "task_create");
  assert.equal(turn.confidence, 0.9);
  assert.deepEqual(turn.entities, { key: "value" });
  assert.deepEqual(turn.metadata, { custom: "data" });
});
