import assert from "node:assert/strict";
import test from "node:test";

import { NlEntryService } from "../../../../src/interaction/nl-gateway/index.js";

test("NlEntryService parses detailed intent and extracts entities", async () => {
  const service = new NlEntryService();

  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "请在 2026-04-20 前把生产环境 deploy 状态同步到 slack，并控制预算在 ¥500 以内",
  });

  assert.equal(result.detectedIntents[0]?.intentType, "status_inquiry");
  assert.equal(result.suggestedDivisionId, "devops");
  assert.ok(result.detectedIntents[0]?.entities.some((entity) => entity.entityType === "date"));
  assert.ok(result.detectedIntents[0]?.entities.some((entity) => entity.entityType === "money"));
  assert.equal(result.locale, "zh-CN");
});

test("NlEntryService resolves locale from Accept-Language before default fallback", async () => {
  const service = new NlEntryService({
    localeConfig: {
      supportedLocales: ["zh-CN", "en-US"],
      defaultLocale: "zh-CN",
      localeResolutionOrder: ["accept_language", "default"],
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

test("NlEntryService buildTask marks destructive requests for confirmation", async () => {
  const service = new NlEntryService();

  const task = await service.buildTask({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "删除全部生产环境的旧配置",
  });

  assert.equal(task.riskPreview.overallRisk, "critical");
  assert.equal(task.confirmationRequired, true);
  assert.equal(task.requestEnvelope, null);
});

test("NlEntryService parseDetailed does not report stale Building state when no clarification is needed", async () => {
  const service = new NlEntryService({
    intakeRouter: {
      route: () => ({
        classification: {
          intent: "query" as const,
          continuation: "new_task" as const,
          confidence: 0.95,
          matchedRules: [],
        },
        divisionId: "engineering_ops",
        workflowId: "single_agent_minimal",
      }),
    } as never,
  });

  const result = await service.parseDetailed({
    tenantId: "tenant_1",
    userId: "user_1",
    message: "请查询 2026-05-01 engineering 团队任务状态",
  });

  assert.equal(result.requiresClarification, false);
  assert.equal(result.conversationState, "Executing");
});
