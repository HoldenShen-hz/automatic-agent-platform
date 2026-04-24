// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { NlEntryService, ConversationContextManager, type NlEntryRequest } from "../../../../src/interaction/nl-gateway/index.js";

// --- Mocks ---

class MockIntakeRouter {
  route({ title, request }: { title: string; request: string }) {
    return {
      divisionId: "devops",
      workflowId: "wf_generic",
      classification: {
        intent: "create",
        confidence: 0.85,
        continuation: "new_task" as const,
      },
    };
  }
}

const mockCostEstimator = {
  estimate() {
    return {
      estimatedCostUsd: 0.1,
      confidence: "low",
      sampleCount: 1,
      divisionId: null,
      basedOn: "default",
    };
  },
};

// --- Tests ---

test.skip("NlEntryService.parse returns parsed intent", async () => {
  const service = new NlEntryService({
    intakeRouter: new MockIntakeRouter() as never,
  });

  const result = await service.parse({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "帮我部署一个新服务到生产环境",
  });

  assert.equal(result.intent, "task_create");
  assert.ok(result.confidence > 0);
});

test.skip("NlEntryService.parseDetailed extracts entities and locale", async () => {
  const service = new NlEntryService({
    intakeRouter: new MockIntakeRouter() as never,
  });

  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "请在 2026-04-20 前把生产环境 deploy 状态同步到 slack，并控制预算在 ¥500 以内",
  });

  assert.equal(result.suggestedDivisionId, "devops");
  assert.ok(result.detectedIntents.length > 0);
  assert.ok(result.detectedIntents[0]!.entities.some((e) => e.entityType === "date"));
  assert.ok(result.detectedIntents[0]!.entities.some((e) => e.entityType === "money"));
  assert.equal(result.locale, "zh-CN");
  assert.equal(result.continuation, "new_task");
});

test.skip("NlEntryService.buildTask creates request envelope with cost estimate", async () => {
  const service = new NlEntryService({
    intakeRouter: new MockIntakeRouter() as never,
    costEstimator: mockCostEstimator,
  });

  const result = await service.buildTask({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "帮我查询一下当前的任务队列状态",
  });

  assert.ok(result.requestEnvelope.metadata.confirmationRequired);
  assert.equal(result.costEstimate.estimatedCostUsd, 0.1);
  assert.ok(result.humanSummary.length > 0);
});

test.skip("NlEntryService.buildTask marks critical-risk requests for confirmation", async () => {
  const service = new NlEntryService({
    intakeRouter: new MockIntakeRouter() as never,
    costEstimator: mockCostEstimator,
  });

  const result = await service.buildTask({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "删除全部生产环境的旧配置",
  });

  assert.equal(result.riskPreview.overallRisk, "critical");
  assert.equal(result.confirmationRequired, true);
  assert.equal(result.requestEnvelope.payload.confirmationRequired, true);
});

test.skip("NlEntryService.buildTask marks high-risk deploy requests for confirmation", async () => {
  const service = new NlEntryService({
    intakeRouter: new MockIntakeRouter() as never,
  });

  const result = await service.buildTask({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "发布新版本到生产环境",
  });

  assert.equal(result.riskPreview.overallRisk, "high");
  assert.equal(result.confirmationRequired, true);
});

test("NlEntryService.getConversationWindowSize returns configured value", () => {
  const service = new NlEntryService();
  const size = service.getConversationWindowSize();
  assert.ok(size > 0);
});

test("NlEntryService.shouldRequestClarification uses threshold", () => {
  const service = new NlEntryService();
  const threshold = service.getClarificationThreshold();
  assert.equal(service.shouldRequestClarification(threshold - 0.01), false);
  assert.equal(service.shouldRequestClarification(threshold), false);
  assert.equal(service.shouldRequestClarification(threshold + 0.01), true);
});

test.skip("NlEntryService.resolveLocale prefers user_profile locale", () => {
  const service = new NlEntryService({
    localeConfig: {
      supportedLocales: ["zh-CN", "en-US"],
      defaultLocale: "zh-CN",
      localeResolutionOrder: ["user_profile", "accept_language", "input_detect", "default"],
    },
  });

  const result = service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "Please summarize the release risks.",
    preferredLocale: "en-US",
    locale: "en-US",
    acceptLanguage: "zh-CN",
  });

  assert.equal(result.locale, "en-US");
});

test.skip("NlEntryService.resolveLocale falls back to Accept-Language", async () => {
  const service = new NlEntryService({
    localeConfig: {
      supportedLocales: ["zh-CN", "en-US"],
      defaultLocale: "zh-CN",
      localeResolutionOrder: ["user_profile", "accept_language", "input_detect", "default"],
    },
  });

  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "Please summarize the release risks.",
    acceptLanguage: "en-US,en;q=0.9",
  });

  assert.equal(result.locale, "en-US");
});

test.skip("NlEntryService.resolveLocale falls back to input detection for Chinese", async () => {
  const service = new NlEntryService({
    localeConfig: {
      supportedLocales: ["zh-CN", "en-US"],
      defaultLocale: "en-US",
      localeResolutionOrder: ["user_profile", "accept_language", "input_detect", "default"],
    },
  });

  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "帮我查看一下今天的任务进度",
    acceptLanguage: "en-US",
  });

  assert.equal(result.locale, "zh-CN");
});

test("ConversationContextManager.getContext creates new context", () => {
  const manager = new ConversationContextManager();
  const ctx = manager.getContext("tenant_1", "user_1");

  assert.equal(ctx.tenantId, "tenant_1");
  assert.equal(ctx.userId, "user_1");
  assert.equal(ctx.turnCount, 0);
  assert.ok(ctx.maxTurns > 0);
});

test("ConversationContextManager.addTurn increments turn count", () => {
  const manager = new ConversationContextManager();
  manager.getContext("tenant_1", "user_1");

  const updated = manager.addTurn("tenant_1", "user_1", "帮我部署服务", {
    intentType: "task_create",
    domainHint: "devops",
    entities: [],
    urgency: "normal",
    confidence: 0.9,
  });

  assert.equal(updated.turnCount, 1);
  assert.equal(updated.turns.length, 1);
  assert.equal(updated.turns[0]!.message, "帮我部署服务");
});

test("ConversationContextManager.addTurn prunes to window size", () => {
  const manager = new ConversationContextManager();
  const ctx = manager.getContext("tenant_1", "user_1");
  const maxTurns = ctx.maxTurns;

  for (let i = 0; i < maxTurns + 3; i++) {
    manager.addTurn("tenant_1", "user_1", `消息 ${i}`, {
      intentType: "task_query",
      domainHint: null,
      entities: [],
      urgency: "low",
      confidence: 0.5,
    });
  }

  const finalCtx = manager.getContext("tenant_1", "user_1");
  assert.equal(finalCtx.turnCount, maxTurns);
});

test("ConversationContextManager.clearContext removes context", () => {
  const manager = new ConversationContextManager();
  manager.getContext("tenant_1", "user_1");
  manager.clearContext("tenant_1", "user_1");

  const ctx = manager.getContext("tenant_1", "user_1");
  assert.equal(ctx.turnCount, 0);
  assert.equal(ctx.turns.length, 0);
});

test("ConversationContextManager.isNearWindowLimit detects limit proximity", () => {
  const manager = new ConversationContextManager();
  const ctx = manager.getContext("tenant_1", "user_1");

  assert.equal(manager.isNearWindowLimit("tenant_1", "user_1"), false);

  // Add turns until near limit
  for (let i = 0; i < ctx.maxTurns - 1; i++) {
    manager.addTurn("tenant_1", "user_1", `消息 ${i}`, {
      intentType: "task_query",
      domainHint: null,
      entities: [],
      urgency: "low",
      confidence: 0.5,
    });
  }

  assert.equal(manager.isNearWindowLimit("tenant_1", "user_1"), true);
});

test("ConversationContextManager.getWindowSize returns configured value", () => {
  const manager = new ConversationContextManager();
  const size = manager.getWindowSize();
  assert.ok(size > 0);
});
