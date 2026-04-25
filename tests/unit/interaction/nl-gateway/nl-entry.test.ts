import test from "node:test";
import assert from "node:assert/strict";
import {
  NlEntryService,
  type NlEntryRequest,
  type DetectedIntent,
  type NlGatewayConfig,
} from "../../../../src/interaction/nl-gateway/index.js";

function createMockCostEstimator(divisionId?: string | null): CostEstimatorPort {
  return {
    estimate: (_divId?: string | null) => ({
      estimatedCostUsd: 0.15,
      confidence: "default" as const,
      sampleCount: 1,
      divisionId: divisionId ?? null,
      basedOn: "mock",
    }),
  };
}

interface CostEstimatorPort {
  estimate(divisionId?: string | null): {
    estimatedCostUsd: number;
    confidence: "high" | "medium" | "low" | "default";
    sampleCount: number;
    divisionId: string | null;
    basedOn: string;
  };
}

test("NlEntryService.getConversationWindowSize returns default when no taskType", () => {
  const service = new NlEntryService();
  assert.equal(service.getConversationWindowSize(), 10);
});

test("NlEntryService.getConversationWindowSize returns task-type specific size", () => {
  const service = new NlEntryService();
  assert.equal(service.getConversationWindowSize("task_create"), 15);
  assert.equal(service.getConversationWindowSize("task_query"), 8);
  assert.equal(service.getConversationWindowSize("task_modify"), 12);
  assert.equal(service.getConversationWindowSize("status_inquiry"), 5);
  assert.equal(service.getConversationWindowSize("approval_action"), 6);
});

test("NlEntryService.getClarificationThreshold returns configured threshold", () => {
  const service = new NlEntryService();
  assert.equal(service.getClarificationThreshold(), 0.7);
});

test("NlEntryService.shouldRequestClarification returns true when below threshold", () => {
  const service = new NlEntryService();
  assert.equal(service.shouldRequestClarification(0.5), true);
  assert.equal(service.shouldRequestClarification(0.69), true);
});

test("NlEntryService.shouldRequestClarification returns false when at or above threshold", () => {
  const service = new NlEntryService();
  assert.equal(service.shouldRequestClarification(0.7), false);
  assert.equal(service.shouldRequestClarification(0.85), false);
});

test("NlEntryService.parse returns simplified NlEntryIntent", async () => {
  const service = new NlEntryService();

  const result = await service.parse({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "创建一个部署任务",
  });

  assert.equal(typeof result.intent, "string");
  assert.equal(typeof result.confidence, "number");
  assert.equal(typeof result.entities, "object");
});

test("NlEntryService.parseDetailed extracts date entities", async () => {
  const service = new NlEntryService();

  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "请在 2026-04-20 前完成部署",
  });

  const dateEntity = result.detectedIntents[0]?.entities.find(
    (e) => e.entityType === "date",
  );
  assert.ok(dateEntity, "should extract date entity");
  assert.equal(dateEntity?.value, "2026-04-20");
});

test("NlEntryService.parseDetailed extracts money entities", async () => {
  const service = new NlEntryService();

  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "预算控制在 $5000 以内",
  });

  const moneyEntity = result.detectedIntents[0]?.entities.find(
    (e) => e.entityType === "money",
  );
  assert.ok(moneyEntity, "should extract money entity");
});

test("NlEntryService.parseDetailed extracts percentage entities", async () => {
  const service = new NlEntryService();

  // Note: PERCENT_PATTERN requires word char after %, so use 5%today
  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "error rate is 5%today",
  });

  const percentEntity = result.detectedIntents[0]?.entities.find(
    (e) => e.entityType === "percentage",
  );
  assert.ok(percentEntity, "should extract percentage entity");
  assert.equal(percentEntity?.normalized, 0.05);
});

test("NlEntryService.parseDetailed extracts environment entities", async () => {
  const service = new NlEntryService();

  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "部署到 production 环境",
  });

  const envEntity = result.detectedIntents[0]?.entities.find(
    (e) => e.entityType === "environment",
  );
  assert.ok(envEntity, "should extract environment entity");
  assert.equal(envEntity?.normalized, "production");
});

test("NlEntryService.parseDetailed extracts channel entities", async () => {
  const service = new NlEntryService();

  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "同步状态到 slack 频道",
  });

  const channelEntity = result.detectedIntents[0]?.entities.find(
    (e) => e.entityType === "channel",
  );
  assert.ok(channelEntity, "should extract channel entity");
  assert.equal(channelEntity?.normalized, "slack");
});

test("NlEntryService.parseDetailed derives urgency from message", async () => {
  const service = new NlEntryService();

  const urgentResult = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "立刻处理这个紧急问题",
  });
  assert.equal(urgentResult.detectedIntents[0]?.urgency, "high");

  const normalResult = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "今天需要完成",
  });
  assert.equal(normalResult.detectedIntents[0]?.urgency, "normal");

  const lowResult = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "有空的时候看一下",
  });
  assert.equal(lowResult.detectedIntents[0]?.urgency, "low");
});

test("NlEntryService.parseDetailed requires clarification for low confidence", async () => {
  const service = new NlEntryService({
    clarificationThreshold: 0.7,
  });

  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "处理一下",
  });

  assert.equal(result.requiresClarification, true);
  assert.ok(result.clarificationQuestions && result.clarificationQuestions.length > 0);
});

test("NlEntryService.buildTask includes cost estimate from estimator", async () => {
  const service = new NlEntryService({
    costEstimator: createMockCostEstimator("devops") as any,
  });

  const result = await service.buildTask({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "创建一个部署任务",
  });

  assert.equal(result.costEstimate.estimatedCostUsd, 0.15);
  assert.equal(result.costEstimate.basedOn, "mock");
});

test("NlEntryService.buildTask uses default cost when no estimator", async () => {
  const service = new NlEntryService();

  const result = await service.buildTask({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "创建一个部署任务",
  });

  assert.equal(result.costEstimate.estimatedCostUsd, 0.05);
  assert.equal(result.costEstimate.basedOn, "default");
});

test("NlEntryService.buildTask sets confirmationRequired for critical risk", async () => {
  const service = new NlEntryService();

  const result = await service.buildTask({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "删除全部生产环境数据",
  });

  assert.equal(result.riskPreview.overallRisk, "critical");
  assert.equal(result.confirmationRequired, true);
});

test("NlEntryService.buildTask sets confirmationRequired for high risk", async () => {
  const service = new NlEntryService();

  const result = await service.buildTask({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "部署到生产环境",
  });

  assert.equal(result.riskPreview.overallRisk, "high");
  assert.equal(result.confirmationRequired, true);
});

test("NlEntryService.buildTask builds correct request envelope", async () => {
  const service = new NlEntryService();

  const result = await service.buildTask({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "创建一个工单",
    channel: "slack",
  });

  assert.equal(result.requestEnvelope.tenantId, "tenant_1");
  assert.equal(result.requestEnvelope.payload.userId, "user_1");
  assert.equal(result.requestEnvelope.payload.title, "创建一个工单");
  assert.equal(result.requestEnvelope.payload.channel, "slack");
  assert.equal(result.requestEnvelope.metadata.source, "nl_entry");
});

test("NlEntryService.buildTask generates human-readable summary", async () => {
  const service = new NlEntryService();

  const result = await service.buildTask({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "部署应用到生产环境",
  });

  assert.ok(result.humanSummary.includes("路由到"));
  assert.ok(result.humanSummary.includes("工作流"));
  assert.ok(result.humanSummary.includes("风险等级"));
});

test("NlEntryService handles empty message gracefully", async () => {
  const service = new NlEntryService();

  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "",
  });

  assert.equal(result.detectedIntents.length, 1);
  assert.equal(result.confidence >= 0, true);
});

test("NlEntryService with custom config uses custom values", () => {
  const customConfig: NlGatewayConfig = {
    conversationWindow: {
      defaultSize: 20,
      maxSize: 50,
      byTaskType: {
        task_create: 30,
        task_query: 15,
        task_modify: 25,
        status_inquiry: 10,
        approval_action: 12,
      },
    },
    disambiguation: {
      threshold: 0.8,
      lowConfidenceThreshold: 0.6,
      maxClarificationQuestions: 5,
      enableProactiveClarification: true,
    },
    intent: {
      minConfidenceForAutoConfirm: 0.9,
      fallbackIntent: "task_query",
    },
    entityExtraction: {
      requiredEntityCount: 2,
      minMessageLength: 10,
    },
  };

  const service = new NlEntryService({ nlGatewayConfig: customConfig });

  assert.equal(service.getClarificationThreshold(), 0.8);
  assert.equal(service.shouldRequestClarification(0.75), true);
  assert.equal(service.shouldRequestClarification(0.85), false);
  assert.equal(service.getConversationWindowSize("task_create"), 30);
  assert.equal(service.getConversationWindowSize(), 20);
});

test("NlEntryService parseDetailed dedupes entities", async () => {
  const service = new NlEntryService();

  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "2026-04-20 2026-04-20 2026-04-20",
  });

  const dateEntities = result.detectedIntents[0]?.entities.filter(
    (e) => e.entityType === "date",
  );
  // Should dedupe to single entity
  assert.ok(dateEntities);
  assert.equal(dateEntities.length, 1);
});

test("NlEntryService parseDetailed sets continuation from router", async () => {
  const service = new NlEntryService();

  // "correction" keyword triggers correction continuation
  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "修正上次的错误",
  });

  assert.equal(result.continuation, "correction");
});

test("NlEntryService buildTask riskPreview reversible is false for irreversible actions", async () => {
  const service = new NlEntryService();

  const deleteResult = await service.buildTask({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "删除所有记录",
  });
  assert.equal(deleteResult.riskPreview.reversible, false);

  const createResult = await service.buildTask({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "创建一个新任务",
  });
  assert.equal(createResult.riskPreview.reversible, true);
});

test("NlEntryService buildTask riskPreview approvalNeeded for approval actions", async () => {
  const service = new NlEntryService();

  const result = await service.buildTask({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "approve the deployment request",
  });

  assert.equal(result.riskPreview.approvalNeeded, true);
});

test("NlEntryService locale resolution prefers user_profile locale", async () => {
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
    message: "create a task",
    locale: "en-US",
  });

  assert.equal(result.locale, "en-US");
});

test("NlEntryService locale resolution uses input detection", async () => {
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
    message: "创建一个任务",
  });

  assert.equal(result.locale, "zh-CN");
});

test("NlEntryService locale resolution falls back to default", async () => {
  const service = new NlEntryService({
    localeConfig: {
      supportedLocales: ["zh-CN", "en-US"],
      defaultLocale: "zh-CN",
      localeResolutionOrder: ["user_profile", "accept_language", "input_detect", "default"],
    },
  });

  // Use message with no detectable language chars (only numbers/symbols)
  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "!!! ### $$$",
  });

  assert.equal(result.locale, "zh-CN");
});

test("NlEntryService parseDetailed with acceptLanguage partial match", async () => {
  const service = new NlEntryService({
    localeConfig: {
      supportedLocales: ["zh-CN", "en-US", "ja-JP"],
      defaultLocale: "zh-CN",
      localeResolutionOrder: ["accept_language", "default"],
    },
  });

  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "hello",
    acceptLanguage: "en",
  });

  // "en" should partial match "en-US"
  assert.equal(result.locale, "en-US");
});
