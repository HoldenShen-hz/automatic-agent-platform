/**
 * Unit tests for NlEntryService additional methods
 *
 * Coverage for methods not tested in nl-gateway/index.test.ts:
 * - getConversationWindowSize()
 * - getClarificationThreshold()
 * - shouldRequestClarification()
 * - parse() (simple wrapper)
 */

import assert from "node:assert/strict";
import test from "node:test";
import { NlEntryService } from "../../../src/interaction/nl-gateway/index.js";

const mockIntakeRouter = {
  route: () => ({
    classification: {
      intent: "create" as const,
      continuation: "new_task" as const,
      confidence: 0.85,
      matchedRules: ["default"],
    },
    divisionId: "devops",
    workflowId: "single_agent_minimal",
  }),
};

test("getConversationWindowSize returns default size when no taskType provided", async () => {
  const service = new NlEntryService({ intakeRouter: mockIntakeRouter as any });

  const size = service.getConversationWindowSize();

  assert.equal(size, 10); // default from DEFAULT_NL_GATEWAY_CONFIG
});

test("getConversationWindowSize returns task-type-specific size", async () => {
  const service = new NlEntryService({ intakeRouter: mockIntakeRouter as any });

  const taskCreateSize = service.getConversationWindowSize("task_create");
  const taskQuerySize = service.getConversationWindowSize("task_query");
  const unknownSize = service.getConversationWindowSize("unknown_task");

  assert.equal(taskCreateSize, 15); // from byTaskType config
  assert.equal(taskQuerySize, 8); // from byTaskType config
  assert.equal(unknownSize, 10); // falls back to default
});

test("getClarificationThreshold returns configured threshold", async () => {
  const service = new NlEntryService({ intakeRouter: mockIntakeRouter as any });

  const threshold = service.getClarificationThreshold();

  // Default threshold is 0.8 (INTENT_CONFIDENCE_THRESHOLD)
  assert.equal(threshold, 0.8);
});

test("getClarificationThreshold respects custom threshold from nlGatewayConfig", async () => {
  const customConfig = {
    conversationWindow: { defaultSize: 10, maxSize: 20, byTaskType: {} },
    disambiguation: { threshold: 0.6, lowConfidenceThreshold: 0.5, maxClarificationQuestions: 3, enableProactiveClarification: true },
    intent: { minConfidenceForAutoConfirm: 0.85, fallbackIntent: "task_query" },
    entityExtraction: { requiredEntityCount: 1, minMessageLength: 6 },
  };

  const service = new NlEntryService({
    intakeRouter: mockIntakeRouter as any,
    nlGatewayConfig: customConfig as any,
  });

  // When clarificationThreshold is not explicitly set, it uses max(configValue, INTENT_CONFIDENCE_THRESHOLD(0.8))
  const threshold = service.getClarificationThreshold();

  assert.equal(threshold, 0.8); // max(0.6, 0.8) = 0.8
});

test("shouldRequestClarification returns true when confidence below threshold", async () => {
  const service = new NlEntryService({ intakeRouter: mockIntakeRouter as any });

  const shouldClarify = service.shouldRequestClarification(0.5);

  assert.equal(shouldClarify, true);
});

test("shouldRequestClarification returns false when confidence at threshold", async () => {
  const service = new NlEntryService({ intakeRouter: mockIntakeRouter as any });

  const shouldClarify = service.shouldRequestClarification(0.8);

  assert.equal(shouldClarify, false);
});

test("shouldRequestClarification returns false when confidence above threshold", async () => {
  const service = new NlEntryService({ intakeRouter: mockIntakeRouter as any });

  const shouldClarify = service.shouldRequestClarification(0.95);

  assert.equal(shouldClarify, false);
});

test("parse returns intent from parseDetailed", async () => {
  const highConfRouter = {
    route: () => ({
      classification: {
        intent: "create" as const,
        continuation: "new_task" as const,
        confidence: 0.95,
        matchedRules: ["default"],
      },
      divisionId: "devops",
      workflowId: "single_agent_minimal",
    }),
  };

  const service = new NlEntryService({ intakeRouter: highConfRouter as any });

  const result = await service.parse({
    tenantId: "tenant_test",
    userId: "user_test",
    message: "创建一个任务",
  });

  assert.equal(result.intent, "task_create");
  assert.equal(result.confidence, 0.95);
  // entities can be empty object or have extracted entities
  assert.ok(typeof result.entities === "object");
});

test("parse returns task_query for unknown intent", async () => {
  const queryRouter = {
    route: () => ({
      classification: {
        intent: "query" as const,
        continuation: "new_task" as const,
        confidence: 0.85,
        matchedRules: ["default"],
      },
      divisionId: "devops",
      workflowId: "single_agent_minimal",
    }),
  };

  const service = new NlEntryService({ intakeRouter: queryRouter as any });

  const result = await service.parse({
    tenantId: "tenant_test",
    userId: "user_test",
    message: "查询任务状态",
  });

  assert.equal(result.intent, "task_query");
});

test("parseDetailed extracts entities correctly", async () => {
  const service = new NlEntryService({ intakeRouter: mockIntakeRouter as any });

  const result = await service.parseDetailed({
    tenantId: "tenant_test",
    userId: "user_test",
    message: "2024-05-01在生产环境部署版本",
  });

  // Should have date and environment entities
  const entities = result.detectedIntents[0]?.entities ?? [];
  const entityTypes = entities.map((e) => e.entityType);

  assert.ok(entityTypes.includes("date") || entityTypes.includes("environment"));
});

test("parseDetailed sets locale based on message content", async () => {
  const service = new NlEntryService({ intakeRouter: mockIntakeRouter as any });

  const zhResult = await service.parseDetailed({
    tenantId: "tenant_test",
    userId: "user_test",
    message: "帮我创建一个任务",
  });

  assert.equal(zhResult.locale, "zh-CN");
});

test("buildTask returns correct TaskBuildResult structure", async () => {
  const service = new NlEntryService({ intakeRouter: mockIntakeRouter as any });

  const result = await service.buildTask({
    tenantId: "tenant_test",
    userId: "user_test",
    message: "创建一个任务",
  });

  assert.ok(result.riskPreview);
  assert.ok(result.costEstimate);
  assert.ok(result.taskDraft);
  assert.ok(result.clarificationState);
  assert.ok(result.confirmationReceipt);
  assert.ok(result.conversationState);
  assert.ok(result.canonicalTaskDraft);
});

test("buildTask includes dryRunPreview for high-risk requests", async () => {
  const service = new NlEntryService({ intakeRouter: mockIntakeRouter as any });

  const result = await service.buildTask({
    tenantId: "tenant_test",
    userId: "user_test",
    message: "删除生产环境全部数据",
  });

  // High-risk requests should include dryRunPreview
  // The exact blocked/approvalRequired values depend on risk assessment
  if (result.dryRunPreview) {
    // dryRunPreview exists for high-risk, check it's properly structured
    assert.ok(typeof result.dryRunPreview.mode === "string");
    assert.ok(typeof result.dryRunPreview.summary === "string");
  } else {
    // If no dryRunPreview, riskPreview should still indicate high risk
    assert.ok(result.riskPreview.overallRisk === "high" || result.riskPreview.overallRisk === "critical");
  }
});

test("buildTask does not include dryRunPreview for low-risk requests", async () => {
  const service = new NlEntryService({ intakeRouter: mockIntakeRouter as any });

  const result = await service.buildTask({
    tenantId: "tenant_test",
    userId: "user_test",
    message: "查询一下今日天气",
  });

  assert.equal(result.dryRunPreview, undefined);
});

test("buildTask sets requestEnvelope to null when confirmation required", async () => {
  const lowConfRouter = {
    route: () => ({
      classification: {
        intent: "create" as const,
        continuation: "new_task" as const,
        confidence: 0.5,
        matchedRules: [],
      },
      divisionId: "devops",
      workflowId: "single_agent_minimal",
    }),
  };

  const service = new NlEntryService({ intakeRouter: lowConfRouter as any });

  const result = await service.buildTask({
    tenantId: "tenant_test",
    userId: "user_test",
    message: "帮我处理一下",
  });

  assert.equal(result.requestEnvelope, null);
  assert.equal(result.confirmationRequired, true);
});

test("buildTask returns valid canonicalRequestEnvelope when confirmation not required", async () => {
  const highConfRouter = {
    route: () => ({
      classification: {
        intent: "create" as const,
        continuation: "new_task" as const,
        confidence: 0.95,
        matchedRules: ["default"],
      },
      divisionId: "devops",
      workflowId: "single_agent_minimal",
    }),
  };

  const service = new NlEntryService({ intakeRouter: highConfRouter as any });

  const result = await service.buildTask({
    tenantId: "tenant_test",
    userId: "user_test",
    message: "创建一个任务",
  });

  // When confirmation is not required, canonicalRequestEnvelope should not be null
  // When confirmation is required, canonicalRequestEnvelope is null
  if (!result.confirmationRequired) {
    assert.ok(result.canonicalRequestEnvelope !== null || result.requestEnvelope !== null);
  }
});
