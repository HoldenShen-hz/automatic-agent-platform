import test from "node:test";
import assert from "node:assert/strict";
import {
  ConversationContextManager,
  type NlGatewayConfig,
} from "../../../../src/interaction/nl-gateway/index.js";

test("ConversationContextManager creates context with default window size", () => {
  const manager = new ConversationContextManager();

  const context = manager.getContext("tenant_1", "user_1");

  assert.equal(context.tenantId, "tenant_1");
  assert.equal(context.userId, "user_1");
  assert.equal(context.turnCount, 0);
  assert.equal(context.maxTurns, 10); // default
  assert.deepEqual(context.turns, []);
});

test("ConversationContextManager creates context with task-type specific window size", () => {
  const manager = new ConversationContextManager();

  const context = manager.getContext("tenant_1", "user_1", "task_create");

  assert.equal(context.maxTurns, 15); // task_create has 15
});

test("ConversationContextManager adds turns to conversation", () => {
  const manager = new ConversationContextManager();

  const intent = {
    intentType: "task_create" as const,
    domainHint: null,
    entities: [],
    urgency: "normal" as const,
    confidence: 0.8,
  };

  const context1 = manager.addTurn("tenant_1", "user_1", "创建一个任务", intent);

  assert.equal(context1.turnCount, 1);
  assert.equal(context1.turns.length, 1);
  assert.equal(context1.turns[0].message, "创建一个任务");
});

test("ConversationContextManager prunes to window size", () => {
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

  const intent = {
    intentType: "task_create" as const,
    domainHint: null,
    entities: [],
    urgency: "normal" as const,
    confidence: 0.8,
  };

  // Add 4 turns to a window of 3
  manager.addTurn("tenant_1", "user_1", "消息1", intent);
  manager.addTurn("tenant_1", "user_1", "消息2", intent);
  manager.addTurn("tenant_1", "user_1", "消息3", intent);
  // 4th turn should prune the first one
  const context = manager.addTurn("tenant_1", "user_1", "消息4", intent);

  // Should be pruned to last 3
  assert.equal(context.turnCount, 3);
  assert.equal(context.turns[0].message, "消息2");
  assert.equal(context.turns[1].message, "消息3");
  assert.equal(context.turns[2].message, "消息4");
});

test("ConversationContextManager clears context", () => {
  const manager = new ConversationContextManager();

  const intent = {
    intentType: "task_create" as const,
    domainHint: null,
    entities: [],
    urgency: "normal" as const,
    confidence: 0.8,
  };

  manager.addTurn("tenant_1", "user_1", "消息", intent);
  manager.clearContext("tenant_1", "user_1");

  const context = manager.getContext("tenant_1", "user_1");
  assert.equal(context.turnCount, 0);
});

test("ConversationContextManager isNearWindowLimit", () => {
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

  const intent = {
    intentType: "task_create" as const,
    domainHint: null,
    entities: [],
    urgency: "normal" as const,
    confidence: 0.8,
  };

  // Window is 5, so near limit when turnCount >= 3 (5-2)
  assert.equal(manager.isNearWindowLimit("tenant_1", "user_1"), false);

  manager.addTurn("tenant_1", "user_1", "消息1", intent);
  manager.addTurn("tenant_1", "user_1", "消息2", intent);
  assert.equal(manager.isNearWindowLimit("tenant_1", "user_1"), false);

  manager.addTurn("tenant_1", "user_1", "消息3", intent);
  assert.equal(manager.isNearWindowLimit("tenant_1", "user_1"), true);
});

test("ConversationContextManager getWindowSize", () => {
  const manager = new ConversationContextManager();

  assert.equal(manager.getWindowSize(), 10);
  assert.equal(manager.getWindowSize("task_query"), 8);
  assert.equal(manager.getWindowSize("unknown"), 10);
});

test("ConversationContextManager tracks lastIntent", () => {
  const manager = new ConversationContextManager();

  const intent1 = {
    intentType: "task_create" as const,
    domainHint: null,
    entities: [],
    urgency: "normal" as const,
    confidence: 0.8,
  };

  const intent2 = {
    intentType: "task_query" as const,
    domainHint: null,
    entities: [],
    urgency: "normal" as const,
    confidence: 0.9,
  };

  const context1 = manager.addTurn("tenant_1", "user_1", "创建任务", intent1);
  assert.equal(context1.lastIntent?.intentType, "task_create");

  const context2 = manager.addTurn("tenant_1", "user_1", "查询状态", intent2);
  assert.equal(context2.lastIntent?.intentType, "task_query");
});
