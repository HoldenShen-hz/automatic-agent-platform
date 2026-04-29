import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { ConversationHistoryService } from "../../../../../src/interaction/ux/conversation-history-service.js";

function createMemoryServiceMock() {
  const remembered: unknown[] = [];
  const recalled: unknown[] = [];
  return {
    remembered,
    recalled,
    memoryService: {
      remember(input: unknown) {
        remembered.push(input);
        return {} as never;
      },
      recall(input?: unknown) {
        recalled.push(input ?? null);
        return [];
      },
    } as never,
  };
}

test("ConversationHistoryService startSession creates session", () => {
  const service = new ConversationHistoryService();
  const session = service.startSession("tenant-1", "user-1");

  assert.strictEqual(session.tenantId, "tenant-1");
  assert.strictEqual(session.userId, "user-1");
  assert.strictEqual(session.status, "active");
  assert.ok(session.sessionId.startsWith("conv_"));
  assert.strictEqual(session.turns.length, 0);
});

test("ConversationHistoryService isAvailable returns false without memory service", () => {
  const service = new ConversationHistoryService();
  assert.strictEqual(service.isAvailable(), false);
});

test("ConversationHistoryService addTurn adds turn to session", async () => {
  const service = new ConversationHistoryService();
  const session = service.startSession("tenant-1", "user-1");
  const updated = await service.addTurn(session, {
    role: "user",
    message: "Hello",
  });

  assert.strictEqual(updated.turns.length, 1);
  assert.strictEqual(updated.turns[0]!.message, "Hello");
  assert.strictEqual(updated.turns[0]!.role, "user");
});

test("ConversationHistoryService addTurn includes turnId and timestamp", async () => {
  const service = new ConversationHistoryService();
  const session = service.startSession("tenant-1", "user-1");
  const updated = await service.addTurn(session, {
    role: "assistant",
    message: "Hi there",
  });

  assert.ok(updated.turns[0]!.turnId.startsWith("turn_"));
  assert.ok(updated.turns[0]!.timestamp.length > 0);
});

test("ConversationHistoryService addTurn preserves existing turns", async () => {
  const service = new ConversationHistoryService();
  const session = service.startSession("tenant-1", "user-1");
  const withFirstTurn = await service.addTurn(session, { role: "user", message: "First" });
  const updated = await service.addTurn(withFirstTurn, { role: "assistant", message: "Second" });

  assert.strictEqual(updated.turns.length, 2);
  assert.strictEqual(updated.turns[0]!.message, "First");
  assert.strictEqual(updated.turns[1]!.message, "Second");
});

test("ConversationHistoryService addTurn sets lastIntent when provided", async () => {
  const service = new ConversationHistoryService();
  const session = service.startSession("tenant-1", "user-1");
  const updated = await service.addTurn(session, {
    role: "user",
    message: "Hello",
    intent: "greeting",
    confidence: 0.95,
  });

  assert.strictEqual(updated.lastIntent, "greeting");
});

test("ConversationHistoryService completeSession updates status", async () => {
  const service = new ConversationHistoryService();
  const session = service.startSession("tenant-1", "user-1");
  const completed = await service.completeSession(session);

  assert.strictEqual(completed.status, "completed");
});

test("ConversationHistoryService abandonSession updates status", async () => {
  const service = new ConversationHistoryService();
  const session = service.startSession("tenant-1", "user-1");
  const abandoned = await service.abandonSession(session);

  assert.strictEqual(abandoned.status, "abandoned");
});

test("ConversationHistoryService getSession returns null without memory service", async () => {
  const service = new ConversationHistoryService();
  const result = await service.getSession("any-session", "tenant-1");

  assert.strictEqual(result, null);
});

test("ConversationHistoryService listUserSessions returns empty without memory service", async () => {
  const service = new ConversationHistoryService();
  const sessions = await service.listUserSessions("user-1", "tenant-1");

  assert.deepStrictEqual(sessions, []);
});

test("ConversationHistoryService addTurn with entities", async () => {
  const service = new ConversationHistoryService();
  const session = service.startSession("tenant-1", "user-1");
  const updated = await service.addTurn(session, {
    role: "user",
    message: "Create a task",
    entities: { action: "create", object: "task" },
  });

  assert.deepStrictEqual(updated.turns[0]!.entities, { action: "create", object: "task" });
});

test("ConversationHistoryService addTurn with metadata", async () => {
  const service = new ConversationHistoryService();
  const session = service.startSession("tenant-1", "user-1");
  const updated = await service.addTurn(session, {
    role: "user",
    message: "Hello",
    metadata: { source: "web" },
  });

  assert.deepStrictEqual(updated.turns[0]!.metadata, { source: "web" });
});

test("ConversationHistoryService startSession accepts options", () => {
  const service = new ConversationHistoryService();
  const session = service.startSession("tenant-1", "user-1", {
    scope: "custom-scope",
    retentionDays: 30,
  });

  assert.strictEqual(session.tenantId, "tenant-1");
  assert.strictEqual(session.userId, "user-1");
});

test("ConversationHistoryService updatedAt changes on addTurn", async () => {
  const service = new ConversationHistoryService();
  const session = service.startSession("tenant-1", "user-1");
  const originalUpdated = session.updatedAt;

  await new Promise((resolve) => setTimeout(resolve, 10));
  const updated = await service.addTurn(session, { role: "user", message: "Hello" });

  assert.ok(updated.updatedAt >= originalUpdated);
});

test("ConversationHistoryService does not persist restricted sessions to long-term memory", async () => {
  const mock = createMemoryServiceMock();
  const service = new ConversationHistoryService(mock.memoryService);
  const session = service.startSession("tenant-1", "user-1");

  await service.addTurn(session, { role: "user", message: "regulated conversation" }, {
    dataHandling: "regulated",
  });

  assert.equal(mock.remembered.length, 0);
});

test("ConversationHistoryService persists standard sessions when memory service is available", async () => {
  const mock = createMemoryServiceMock();
  const service = new ConversationHistoryService(mock.memoryService);
  const session = service.startSession("tenant-1", "user-1");

  await service.completeSession(session);

  assert.equal(mock.remembered.length, 1);
});

test("ConversationHistoryService listUserSessions enforces tenantId at query time", async () => {
  const recallCalls: unknown[] = [];
  const service = new ConversationHistoryService({
    remember() {
      return {} as never;
    },
    recall(input?: unknown) {
      recallCalls.push(input ?? null);
      return [
        {
          contentJson: JSON.stringify({
            sessionId: "conv_1",
            tenantId: "tenant-1",
            userId: "user-1",
            turns: [],
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-02T00:00:00.000Z",
            status: "active",
          }),
        },
        {
          contentJson: JSON.stringify({
            sessionId: "conv_2",
            tenantId: "tenant-2",
            userId: "user-1",
            turns: [],
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-03T00:00:00.000Z",
            status: "active",
          }),
        },
      ];
    },
  } as never);

  const sessions = await service.listUserSessions("user-1", "tenant-1");

  assert.equal(recallCalls.length, 1);
  assert.deepEqual(recallCalls[0], {
    scopes: ["conversation"],
    tenantId: "tenant-1",
  });
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0]?.tenantId, "tenant-1");
});
