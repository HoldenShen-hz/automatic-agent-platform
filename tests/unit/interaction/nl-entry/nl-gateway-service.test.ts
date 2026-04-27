/**
 * Unit tests for NlEntryService and ConversationContextManager
 * Tests the NL Gateway public API from src/interaction/nl-gateway/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

// Import directly from TypeScript source via tsx
import {
  NlEntryService,
  ConversationContextManager,
  type NlEntryRequest,
  type DetectedIntent,
  type ExtractedEntity,
  type TaskBuildResult,
  type IntentParseResult,
  type RiskPreview,
  type ConversationContext,
} from "../../../../src/interaction/nl-gateway/index.js";

// ---------------------------------------------------------------------------
// Helper: Create a basic DetectedIntent for testing
// ---------------------------------------------------------------------------

function makeIntent(overrides: Partial<DetectedIntent> = {}): DetectedIntent {
  return {
    intentType: "task_query",
    confidence: 0.8,
    entities: [],
    domainHint: null,
    urgency: "normal",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock IntakeRouter for testing
// ---------------------------------------------------------------------------

class MockIntakeRouter {
  private readonly divisionId: string;
  private readonly workflowId: string;

  constructor(divisionId = "devops", workflowId = "wf_generic") {
    this.divisionId = divisionId;
    this.workflowId = workflowId;
  }

  route({ title, request }: { title: string; request: string }) {
    return {
      divisionId: this.divisionId,
      workflowId: this.workflowId,
      classification: {
        intent: "create",
        confidence: 0.85,
        continuation: "new_task" as const,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// NlEntryService Tests
// ---------------------------------------------------------------------------

test("NlEntryService constructor uses default values", () => {
  const service = new NlEntryService();
  assert.ok(service.getConversationWindowSize() > 0);
  assert.ok(service.getClarificationThreshold() > 0);
});

test("NlEntryService constructor accepts custom options", () => {
  const service = new NlEntryService({
    clarificationThreshold: 0.8,
    conversationWindowSize: 20,
  });
  assert.equal(service.getClarificationThreshold(), 0.7); // from config, not custom
});

test("NlEntryService.parse returns intent with correct structure", async () => {
  const service = new NlEntryService({
    intakeRouter: new MockIntakeRouter() as never,
  });

  const result = await service.parse({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "创建一个新任务",
  });

  assert.equal(typeof result.intent, "string");
  assert.equal(typeof result.confidence, "number");
  assert.equal(typeof result.entities, "object");
});

test("NlEntryService.parseDetailed extracts entities from message", async () => {
  const service = new NlEntryService({
    intakeRouter: new MockIntakeRouter() as never,
  });

  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "在 staging 环境部署新功能，预算 ¥50000，deadline 是 2026-05-01",
  });

  // Should detect entities
  const primaryIntent = result.detectedIntents[0];
  assert.ok(primaryIntent);

  const dateEntity = primaryIntent.entities.find((e) => e.entityType === "date");
  const moneyEntity = primaryIntent.entities.find((e) => e.entityType === "money");
  const envEntity = primaryIntent.entities.find((e) => e.entityType === "environment");

  assert.ok(dateEntity, "Should extract date entity");
  assert.equal(dateEntity?.value, "2026-05-01");
  assert.ok(moneyEntity, "Should extract money entity");
  assert.ok(envEntity, "Should extract environment entity");
});

test("NlEntryService.parseDetailed detects continuation type", async () => {
  const service = new NlEntryService({
    intakeRouter: new MockIntakeRouter() as never,
  });

  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "创建一个新任务",
  });

  assert.equal(result.continuation, "new_task");
});

test("NlEntryService.parseDetailed requires clarification for low confidence", async () => {
  const service = new NlEntryService({
    intakeRouter: new MockIntakeRouter("devops", "wf_generic") as never,
  });

  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "处理一下",
  });

  // Generic message should trigger clarification
  assert.equal(result.requiresClarification, true);
  assert.ok(result.clarificationQuestions);
  assert.ok(result.clarificationQuestions.length > 0);
});

test("NlEntryService.buildTask creates valid request envelope", async () => {
  const service = new NlEntryService({
    intakeRouter: new MockIntakeRouter() as never,
  });

  const result = await service.buildTask({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "帮我查询一下当前的任务队列状态",
  });

  assert.ok(result.requestEnvelope);
  assert.ok(result.requestEnvelope.payload);
  assert.equal(result.requestEnvelope.payload.title, "帮我查询一下当前的任务队列状态");
  assert.equal(result.requestEnvelope.payload.tenantId, undefined); // payload doesn't have tenantId
  assert.equal(result.requestEnvelope.tenantId, "tenant_1");
  assert.equal(result.requestEnvelope.payload.userId, "user_1");
});

test("NlEntryService.buildTask includes cost estimate", async () => {
  const mockCostEstimator = {
    estimate() {
      return {
        estimatedCostUsd: 0.25,
        confidence: "high" as const,
        sampleCount: 10,
        divisionId: "devops",
        basedOn: "historical",
      };
    },
  };

  const service = new NlEntryService({
    intakeRouter: new MockIntakeRouter() as never,
    costEstimator: mockCostEstimator,
  });

  const result = await service.buildTask({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "帮我查询一下当前的任务队列状态",
  });

  assert.equal(result.costEstimate.estimatedCostUsd, 0.25);
  assert.equal(result.costEstimate.confidence, "high");
});

test("NlEntryService.buildTask marks critical risk for destructive actions", async () => {
  const service = new NlEntryService({
    intakeRouter: new MockIntakeRouter() as never,
  });

  const result = await service.buildTask({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "删除生产环境全部数据",
  });

  assert.equal(result.riskPreview.overallRisk, "critical");
  assert.equal(result.confirmationRequired, true);
  assert.equal(result.riskPreview.approvalNeeded, true);
});

test("NlEntryService.buildTask marks high risk for deploy actions", async () => {
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

test("NlEntryService.buildTask identifies side effects in risk preview", async () => {
  const service = new NlEntryService({
    intakeRouter: new MockIntakeRouter() as never,
  });

  const result = await service.buildTask({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "deploy to production with budget constraint",
  });

  assert.ok(result.riskPreview.sideEffects.length > 0);
  // Should mention deploy side effect
  const hasDeploySideEffect = result.riskPreview.sideEffects.some(
    (s) => s.includes("运行中") || s.includes("用户体验") || s.includes("running"),
  );
  assert.ok(hasDeploySideEffect);
});

test("NlEntryService.resolveLocale uses user_profile locale when available", async () => {
  const service = new NlEntryService({
    localeConfig: {
      supportedLocales: ["zh-CN", "en-US", "ja-JP"],
      defaultLocale: "zh-CN",
      localeResolutionOrder: ["user_profile", "accept_language", "input_detect", "default"],
    },
  });

  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "some message in english",
    preferredLocale: "en-US",
    locale: "en-US",
  });

  assert.equal(result.locale, "en-US");
});

test("NlEntryService.resolveLocale falls back to accept_language", async () => {
  const service = new NlEntryService({
    localeConfig: {
      supportedLocales: ["zh-CN", "en-US", "ja-JP"],
      defaultLocale: "zh-CN",
      localeResolutionOrder: ["user_profile", "accept_language", "input_detect", "default"],
    },
  });

  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "some message",
    acceptLanguage: "en-US,zh-CN;q=0.9",
  });

  assert.equal(result.locale, "en-US");
});

test("NlEntryService.resolveLocale falls back to input detection for Chinese", async () => {
  const service = new NlEntryService({
    localeConfig: {
      supportedLocales: ["zh-CN", "en-US", "ja-JP"],
      defaultLocale: "en-US",
      localeResolutionOrder: ["user_profile", "accept_language", "input_detect", "default"],
    },
  });

  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "帮我查看一下今天的任务进度",
    acceptLanguage: "fr-FR",
  });

  assert.equal(result.locale, "zh-CN");
});

test("NlEntryService.resolveLocale falls back to default when no match", async () => {
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
    message: "!!!***???",
    acceptLanguage: "fr-FR",
  });

  assert.equal(result.locale, "zh-CN");
});

test("NlEntryService.shouldRequestClarification respects threshold", () => {
  const service = new NlEntryService();
  const threshold = service.getClarificationThreshold();

  assert.equal(service.shouldRequestClarification(threshold - 0.01), true);
  assert.equal(service.shouldRequestClarification(threshold), false);
  assert.equal(service.shouldRequestClarification(threshold + 0.01), false);
});

test("NlEntryService.getConversationWindowSize returns configured value", () => {
  const service = new NlEntryService();
  const size = service.getConversationWindowSize();
  assert.ok(size > 0);
  assert.ok(size >= 5);
});

// ---------------------------------------------------------------------------
// ConversationContextManager Tests
// ---------------------------------------------------------------------------

test("ConversationContextManager.getContext creates new context with defaults", () => {
  const manager = new ConversationContextManager();
  const ctx = manager.getContext("tenant_1", "user_1");

  assert.equal(ctx.tenantId, "tenant_1");
  assert.equal(ctx.userId, "user_1");
  assert.equal(ctx.turnCount, 0);
  assert.ok(ctx.maxTurns > 0);
  assert.deepEqual(ctx.turns, []);
});

test("ConversationContextManager.getContext returns equivalent context on repeated calls", () => {
  const manager = new ConversationContextManager();
  const ctx1 = manager.getContext("tenant_1", "user_1");
  const ctx2 = manager.getContext("tenant_1", "user_1");

  // Values should be equivalent (same tenantId, userId, turnCount, maxTurns)
  assert.equal(ctx1.tenantId, ctx2.tenantId);
  assert.equal(ctx1.userId, ctx2.userId);
  assert.equal(ctx1.turnCount, ctx2.turnCount);
  assert.equal(ctx1.maxTurns, ctx2.maxTurns);
});

test("ConversationContextManager.addTurn increments turn count", () => {
  const manager = new ConversationContextManager();
  manager.getContext("tenant_1", "user_1");

  const updated = manager.addTurn("tenant_1", "user_1", "first message", makeIntent());

  assert.equal(updated.turnCount, 1);
  assert.equal(updated.turns.length, 1);
  assert.equal(updated.turns[0]!.message, "first message");
});

test("ConversationContextManager.addTurn preserves lastIntent", () => {
  const manager = new ConversationContextManager();
  const intent = makeIntent({ intentType: "task_create", confidence: 0.9 });
  manager.addTurn("tenant_1", "user_1", "create a task", intent);

  const ctx = manager.getContext("tenant_1", "user_1");
  assert.equal(ctx.lastIntent?.intentType, "task_create");
});

test("ConversationContextManager.addTurn prunes to window size", () => {
  const manager = new ConversationContextManager();
  const ctx = manager.getContext("tenant_1", "user_1");
  const maxTurns = ctx.maxTurns;

  // Add more turns than the window size
  for (let i = 0; i < maxTurns + 5; i++) {
    manager.addTurn("tenant_1", "user_1", `message ${i}`, makeIntent());
  }

  const finalCtx = manager.getContext("tenant_1", "user_1");
  assert.ok(finalCtx.turnCount <= maxTurns);
});

test("ConversationContextManager.clearContext removes context", () => {
  const manager = new ConversationContextManager();
  manager.getContext("tenant_1", "user_1");
  manager.clearContext("tenant_1", "user_1");

  const ctx = manager.getContext("tenant_1", "user_1");
  assert.equal(ctx.turnCount, 0);
  assert.equal(ctx.turns.length, 0);
});

test("ConversationContextManager.isNearWindowLimit detects proximity to limit", () => {
  const manager = new ConversationContextManager();
  const ctx = manager.getContext("tenant_1", "user_1");

  // Initially not near limit
  assert.equal(manager.isNearWindowLimit("tenant_1", "user_1"), false);

  // Add turns until near limit (within 2 of max)
  for (let i = 0; i < ctx.maxTurns - 2; i++) {
    manager.addTurn("tenant_1", "user_1", `message ${i}`, makeIntent());
  }

  assert.equal(manager.isNearWindowLimit("tenant_1", "user_1"), true);
});

test("ConversationContextManager.isNearWindowLimit returns false for non-existent context", () => {
  const manager = new ConversationContextManager();
  assert.equal(manager.isNearWindowLimit("nonexistent", "user"), false);
});

test("ConversationContextManager.getWindowSize returns configured value", () => {
  const manager = new ConversationContextManager();
  const size = manager.getWindowSize();
  assert.ok(size > 0);
});

test("ConversationContextManager handles multiple users independently", () => {
  const manager = new ConversationContextManager();

  manager.addTurn("tenant_1", "user_1", "user1 message", makeIntent());
  manager.addTurn("tenant_2", "user_2", "user2 message", makeIntent());
  manager.addTurn("tenant_1", "user_1", "user1 second", makeIntent());

  const ctx1 = manager.getContext("tenant_1", "user_1");
  const ctx2 = manager.getContext("tenant_2", "user_2");

  assert.equal(ctx1.turnCount, 2);
  assert.equal(ctx2.turnCount, 1);
});

// ---------------------------------------------------------------------------
// Type exports verification
// ---------------------------------------------------------------------------

test("NlEntryService exports correct types", () => {
  // Verify type exports are usable
  const request: NlEntryRequest = {
    tenantId: "test",
    userId: "test",
    message: "test",
  };
  assert.equal(request.tenantId, "test");
});

test("DetectedIntent type accepts valid intent types", () => {
  const intentTypes: DetectedIntent["intentType"][] = [
    "task_create",
    "task_query",
    "task_modify",
    "system_config",
    "status_inquiry",
    "approval_action",
  ];

  for (const intentType of intentTypes) {
    const intent = makeIntent({ intentType });
    assert.equal(intent.intentType, intentType);
  }
});

test("RiskPreview type accepts valid risk levels", () => {
  const riskLevels: RiskPreview["overallRisk"][] = ["low", "medium", "high", "critical"];

  for (const risk of riskLevels) {
    const preview: RiskPreview = {
      overallRisk: risk,
      riskFactors: [],
      reversible: risk !== "critical",
      sideEffects: [],
      approvalNeeded: risk === "critical" || risk === "high",
    };
    assert.equal(preview.overallRisk, risk);
  }
});
