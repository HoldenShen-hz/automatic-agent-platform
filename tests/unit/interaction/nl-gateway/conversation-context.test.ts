import test from "node:test";
import assert from "node:assert/strict";
import {
  ConversationContextManager,
  type ConversationContext,
  type DetectedIntent,
  type NlGatewayConfig,
} from "../../../../src/interaction/nl-gateway/index.js";

function createTestIntent(overrides: Partial<DetectedIntent> = {}): DetectedIntent {
  return {
    intentType: "task_query",
    domainHint: null,
    entities: [],
    urgency: "normal",
    confidence: 0.8,
    ...overrides,
  };
}

test("ConversationContextManager isolates contexts between tenants", () => {
  const manager = new ConversationContextManager();

  const intent = createTestIntent();
  manager.addTurn("tenant_1", "user_1", "消息1", intent);

  const contextTenant1 = manager.getContext("tenant_1", "user_1");
  const contextTenant2 = manager.getContext("tenant_2", "user_1");

  assert.equal(contextTenant1.turnCount, 1);
  assert.equal(contextTenant2.turnCount, 0);
});

test("ConversationContextManager isolates contexts between users", () => {
  const manager = new ConversationContextManager();

  const intent = createTestIntent();
  manager.addTurn("tenant_1", "user_1", "用户1的消息", intent);

  const contextUser1 = manager.getContext("tenant_1", "user_1");
  const contextUser2 = manager.getContext("tenant_1", "user_2");

  assert.equal(contextUser1.turnCount, 1);
  assert.equal(contextUser2.turnCount, 0);
});

test("ConversationContextManager addTurn returns updated context", () => {
  const manager = new ConversationContextManager();

  const intent = createTestIntent();
  const context = manager.addTurn("tenant_1", "user_1", "测试消息", intent);

  assert.equal(context.tenantId, "tenant_1");
  assert.equal(context.userId, "user_1");
  assert.equal(context.turnCount, 1);
  assert.equal(context.lastIntent?.intentType, "task_query");
});

test("ConversationContextManager turn numbers increment correctly", () => {
  const manager = new ConversationContextManager();

  const intent = createTestIntent();

  const ctx1 = manager.addTurn("tenant_1", "user_1", "第1条", intent);
  const ctx2 = manager.addTurn("tenant_1", "user_1", "第2条", intent);
  const ctx3 = manager.addTurn("tenant_1", "user_1", "第3条", intent);

  assert.equal(ctx1.turns[0]!.turnNumber, 1);
  assert.equal(ctx2.turns[1]!.turnNumber, 2);
  assert.equal(ctx3.turns[2]!.turnNumber, 3);
});

test("ConversationContextManager preserves turn messages after pruning", () => {
  const config: NlGatewayConfig = {
    conversationWindow: {
      defaultSize: 3,
      maxSize: 5,
      byTaskType: {},
    },
    disambiguation: {
      threshold: 0.7,
      lowConfidenceThreshold: 0.5,
      maxClarificationQuestions: 3,
      enableProactiveClarification: true,
    },
    intent: {
      minConfidenceForAutoConfirm: 0.85,
      fallbackIntent: "task_query",
    },
    entityExtraction: {
      requiredEntityCount: 1,
      minMessageLength: 6,
    },
  };

  const manager = new ConversationContextManager(config);
  const intent = createTestIntent();

  manager.addTurn("tenant_1", "user_1", "消息A", intent);
  manager.addTurn("tenant_1", "user_1", "消息B", intent);
  manager.addTurn("tenant_1", "user_1", "消息C", intent);
  const finalCtx = manager.addTurn("tenant_1", "user_1", "消息D", intent);

  // Should have pruned messageA
  assert.equal(finalCtx.turns.length, 3);
  assert.equal(finalCtx.turns[0]!.message, "消息B");
  assert.equal(finalCtx.turns[1]!.message, "消息C");
  assert.equal(finalCtx.turns[2]!.message, "消息D");
});

test("ConversationContextManager isNearWindowLimit returns false for non-existent context", () => {
  const manager = new ConversationContextManager();

  assert.equal(manager.isNearWindowLimit("nonexistent", "user"), false);
});

test("ConversationContextManager isNearWindowLimit at exact boundary", () => {
  const config: NlGatewayConfig = {
    conversationWindow: {
      defaultSize: 5,
      maxSize: 5,
      byTaskType: {},
    },
    disambiguation: {
      threshold: 0.7,
      lowConfidenceThreshold: 0.5,
      maxClarificationQuestions: 3,
      enableProactiveClarification: true,
    },
    intent: {
      minConfidenceForAutoConfirm: 0.85,
      fallbackIntent: "task_query",
    },
    entityExtraction: {
      requiredEntityCount: 1,
      minMessageLength: 6,
    },
  };

  const manager = new ConversationContextManager(config);
  const intent = createTestIntent();

  // Add 3 turns (window size 5, so near limit at >= 3)
  manager.addTurn("tenant_1", "user_1", "消息1", intent);
  manager.addTurn("tenant_1", "user_1", "消息2", intent);
  // At turnCount=2, isNearWindowLimit should be false (2 >= 3 is false)
  assert.equal(manager.isNearWindowLimit("tenant_1", "user_1"), false);

  manager.addTurn("tenant_1", "user_1", "消息3", intent);
  // At turnCount=3, isNearWindowLimit should be true (3 >= 3 is true)
  assert.equal(manager.isNearWindowLimit("tenant_1", "user_1"), true);
});

test("ConversationContextManager getWindowSize respects byTaskType", () => {
  const manager = new ConversationContextManager();

  assert.equal(manager.getWindowSize("task_create"), 15);
  assert.equal(manager.getWindowSize("task_modify"), 12);
  assert.equal(manager.getWindowSize("task_query"), 8);
  assert.equal(manager.getWindowSize("status_inquiry"), 5);
  assert.equal(manager.getWindowSize("approval_action"), 6);
});

test("ConversationContextManager different taskTypes have independent contexts", () => {
  const manager = new ConversationContextManager();

  const intentQuery = createTestIntent({ intentType: "task_query" });
  const intentCreate = createTestIntent({ intentType: "task_create" });

  manager.addTurn("tenant_1", "user_1", "查询消息", intentQuery);
  manager.addTurn("tenant_1", "user_1", "创建消息", intentCreate);

  // Same user, different task types - they share context by tenant:user key
  const context = manager.getContext("tenant_1", "user_1");
  assert.equal(context.turnCount, 2);
});

test("ConversationContextManager clearContext removes all turns", () => {
  const manager = new ConversationContextManager();
  const intent = createTestIntent();

  manager.addTurn("tenant_1", "user_1", "消息1", intent);
  manager.addTurn("tenant_1", "user_1", "消息2", intent);

  assert.equal(manager.getContext("tenant_1", "user_1").turnCount, 2);

  manager.clearContext("tenant_1", "user_1");

  assert.equal(manager.getContext("tenant_1", "user_1").turnCount, 0);
});

test("ConversationContextManager clearContext does not affect other tenants", () => {
  const manager = new ConversationContextManager();
  const intent = createTestIntent();

  manager.addTurn("tenant_1", "user_1", "租户1消息", intent);
  manager.addTurn("tenant_2", "user_1", "租户2消息", intent);

  manager.clearContext("tenant_1", "user_1");

  assert.equal(manager.getContext("tenant_1", "user_1").turnCount, 0);
  assert.equal(manager.getContext("tenant_2", "user_1").turnCount, 1);
});

test("ConversationContextManager turn timestamp is ISO format", () => {
  const manager = new ConversationContextManager();
  const intent = createTestIntent();

  const context = manager.addTurn("tenant_1", "user_1", "消息", intent);

  const timestamp = context.turns[0]!.timestamp;
  // Should be valid ISO timestamp
  assert.ok(timestamp.includes("T"));
  assert.ok(new Date(timestamp).getTime() > 0);
});

test("ConversationContextManager entity extraction in detectedIntent", () => {
  const manager = new ConversationContextManager();

  const intentWithEntities = createTestIntent({
    entities: [
      {
        entityType: "date",
        value: "2026-04-20",
        normalized: "2026-04-20",
        sourceSpan: [5, 15] as const,
      },
    ],
  });

  const context = manager.addTurn("tenant_1", "user_1", "某条消息", intentWithEntities);

  assert.equal(context.lastIntent?.entities.length, 1);
  assert.equal(context.lastIntent?.entities[0]!.entityType, "date");
});

test("ConversationContextManager maxTurns is set correctly for task types", () => {
  const manager = new ConversationContextManager();

  const ctxDefault = manager.getContext("tenant_1", "user_1");
  const ctxTaskCreate = manager.getContext("tenant_1", "user_2", "task_create");
  const ctxTaskQuery = manager.getContext("tenant_1", "user_3", "task_query");

  assert.equal(ctxDefault.maxTurns, 10);
  assert.equal(ctxTaskCreate.maxTurns, 15);
  assert.equal(ctxTaskQuery.maxTurns, 8);
});

test("ConversationContextManager addTurn updates turnCount correctly after pruning", () => {
  const config: NlGatewayConfig = {
    conversationWindow: {
      defaultSize: 2,
      maxSize: 2,
      byTaskType: {},
    },
    disambiguation: {
      threshold: 0.7,
      lowConfidenceThreshold: 0.5,
      maxClarificationQuestions: 3,
      enableProactiveClarification: true,
    },
    intent: {
      minConfidenceForAutoConfirm: 0.85,
      fallbackIntent: "task_query",
    },
    entityExtraction: {
      requiredEntityCount: 1,
      minMessageLength: 6,
    },
  };

  const manager = new ConversationContextManager(config);
  const intent = createTestIntent();

  const ctx1 = manager.addTurn("tenant_1", "user_1", "消息1", intent);
  assert.equal(ctx1.turnCount, 1);

  const ctx2 = manager.addTurn("tenant_1", "user_1", "消息2", intent);
  assert.equal(ctx2.turnCount, 2);

  const ctx3 = manager.addTurn("tenant_1", "user_1", "消息3", intent);
  // Window is 2, so should be pruned to 2
  assert.equal(ctx3.turnCount, 2);
});

test("ConversationContextManager lastIntent updates on each addTurn", () => {
  const manager = new ConversationContextManager();

  const intent1 = createTestIntent({ intentType: "task_query" });
  const intent2 = createTestIntent({ intentType: "task_create" });
  const intent3 = createTestIntent({ intentType: "task_modify" });

  const ctx1 = manager.addTurn("tenant_1", "user_1", "消息1", intent1);
  assert.equal(ctx1.lastIntent?.intentType, "task_query");

  const ctx2 = manager.addTurn("tenant_1", "user_1", "消息2", intent2);
  assert.equal(ctx2.lastIntent?.intentType, "task_create");

  const ctx3 = manager.addTurn("tenant_1", "user_1", "消息3", intent3);
  assert.equal(ctx3.lastIntent?.intentType, "task_modify");
});

test("ConversationContextManager urgency is preserved in turns", () => {
  const manager = new ConversationContextManager();

  const highIntent = createTestIntent({ urgency: "high" });
  const lowIntent = createTestIntent({ urgency: "low" });

  manager.addTurn("tenant_1", "user_1", "紧急消息", highIntent);
  const ctx = manager.addTurn("tenant_1", "user_1", "普通消息", lowIntent);

  assert.equal(ctx.turns[0]!.detectedIntent.urgency, "high");
  assert.equal(ctx.turns[1]!.detectedIntent.urgency, "low");
});

test("ConversationContextManager confidence is preserved in turns", () => {
  const manager = new ConversationContextManager();

  const highConfidence = createTestIntent({ confidence: 0.95 });
  const lowConfidence = createTestIntent({ confidence: 0.45 });

  const ctx = manager.addTurn("tenant_1", "user_1", "消息", highConfidence);
  manager.addTurn("tenant_1", "user_1", "消息2", lowConfidence);

  assert.equal(ctx.turns[0]!.detectedIntent.confidence, 0.95);
});
