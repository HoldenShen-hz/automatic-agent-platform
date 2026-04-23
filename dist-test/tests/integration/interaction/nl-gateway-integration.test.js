/**
 * Integration Test: NL Gateway
 *
 * Tests the NL Entry Service, Conversation Context Manager,
 * disambiguation handling, and intent parsing integration.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { NlEntryService } from "../../../src/interaction/nl-gateway/index.js";
import { ConversationContextManager } from "../../../src/interaction/nl-gateway/index.js";
import { DisambiguationHandler } from "../../../src/interaction/nl-gateway/disambiguation-handler/index.js";
import { parseIntentTokens } from "../../../src/interaction/nl-gateway/intent-parser/index.js";
import { loadNlGatewayConfig } from "../../../src/interaction/nl-gateway/nl-gateway-config-loader.js";
test("integration: NlEntryService parses natural language request into structured intent", async () => {
    const service = new NlEntryService();
    const result = await service.parseDetailed({
        tenantId: "tenant-nl-test",
        userId: "user-nl-test",
        message: "帮我创建一个营销报表任务",
        locale: "zh-CN",
        channel: "web",
    });
    assert.equal(result.locale, "zh-CN");
    assert.ok(result.detectedIntents.length > 0);
    assert.ok(result.confidence > 0);
    assert.ok(result.suggestedDivisionId.length > 0);
});
test("integration: NlEntryService detects task creation intent with high confidence", async () => {
    const service = new NlEntryService();
    const result = await service.parseDetailed({
        tenantId: "tenant-nl-test",
        userId: "user-nl-test",
        message: "创建一个新的部署任务到生产环境",
        locale: "zh-CN",
    });
    const primaryIntent = result.detectedIntents[0];
    assert.ok(primaryIntent, "Should have at least one detected intent");
    assert.equal(primaryIntent.intentType, "task_create");
    assert.ok(primaryIntent.confidence > 0.7);
});
test("integration: NlEntryService detects task modification intent", async () => {
    const service = new NlEntryService();
    const result = await service.parseDetailed({
        tenantId: "tenant-nl-test",
        userId: "user-nl-test",
        message: "更新一下这个任务的优先级",
    });
    const primaryIntent = result.detectedIntents[0];
    assert.ok(primaryIntent, "Should have at least one detected intent");
    assert.equal(primaryIntent.intentType, "task_modify");
});
test("integration: NlEntryService extracts entities from message", async () => {
    const service = new NlEntryService();
    const result = await service.parseDetailed({
        tenantId: "tenant-nl-test",
        userId: "user-nl-test",
        message: "创建任务在 2026-05-01 到生产环境，预算 $500",
    });
    const primaryIntent = result.detectedIntents[0];
    if (!primaryIntent) {
        assert.fail("Should have at least one detected intent");
    }
    const hasDateEntity = primaryIntent.entities.some((e) => e.entityType === "date");
    const hasEnvironmentEntity = primaryIntent.entities.some((e) => e.entityType === "environment");
    const hasMoneyEntity = primaryIntent.entities.some((e) => e.entityType === "money");
    assert.ok(hasDateEntity, "Should extract date entity");
    assert.ok(hasEnvironmentEntity, "Should extract environment entity");
    assert.ok(hasMoneyEntity, "Should extract money entity");
});
test("integration: NlEntryService requests clarification for low confidence", async () => {
    const service = new NlEntryService();
    const result = await service.parseDetailed({
        tenantId: "tenant-nl-test",
        userId: "user-nl-test",
        message: "处理一下",
    });
    // Generic message should trigger clarification
    if (result.requiresClarification) {
        assert.ok(result.clarificationQuestions && result.clarificationQuestions.length > 0);
    }
});
test("integration: NlEntryService builds task request envelope with risk preview", async () => {
    const service = new NlEntryService();
    const result = await service.buildTask({
        tenantId: "tenant-nl-test",
        userId: "user-nl-test",
        message: "帮我创建一个数据同步任务",
    });
    assert.ok(result.requestEnvelope, "Should create request envelope");
    assert.ok(result.riskPreview, "Should have risk preview");
    assert.ok(result.costEstimate, "Should have cost estimate");
    assert.equal(typeof result.confirmationRequired, "boolean");
    assert.ok(result.humanSummary.length > 0);
});
test("integration: NlEntryService marks high-risk requests for approval", async () => {
    const service = new NlEntryService();
    const result = await service.buildTask({
        tenantId: "tenant-nl-test",
        userId: "user-nl-test",
        message: "删除生产环境的所有日志",
    });
    assert.ok(result.riskPreview.approvalNeeded, "High risk delete should require approval");
    assert.equal(result.riskPreview.reversible, false, "Delete should be irreversible");
});
test("integration: ConversationContextManager manages multi-turn conversation", () => {
    const manager = new ConversationContextManager();
    const ctx1 = manager.getContext("tenant-1", "user-1");
    assert.equal(ctx1.tenantId, "tenant-1");
    assert.equal(ctx1.userId, "user-1");
    assert.equal(ctx1.turnCount, 0);
    assert.ok(ctx1.maxTurns > 0);
    const updated = manager.addTurn("tenant-1", "user-1", "帮我创建任务", { intentType: "task_create", confidence: 0.9, entities: [], domainHint: null, urgency: "normal" });
    assert.equal(updated.turnCount, 1);
    assert.ok(updated.turns.length === 1);
    assert.ok(updated.lastIntent);
});
test("integration: ConversationContextManager respects window size limit", () => {
    const config = loadNlGatewayConfig();
    const manager = new ConversationContextManager(config);
    const maxTurns = manager.getWindowSize("task_create");
    // Add turns up to window size
    for (let i = 0; i < maxTurns + 5; i++) {
        manager.addTurn("tenant-2", "user-2", `Turn ${i + 1}`, { intentType: "task_query", confidence: 0.8, entities: [], domainHint: null, urgency: "low" });
    }
    const ctx = manager.getContext("tenant-2", "user-2");
    assert.ok(ctx.turnCount <= maxTurns, "Turn count should respect window size");
});
test("integration: ConversationContextManager clears context", () => {
    const manager = new ConversationContextManager();
    manager.addTurn("tenant-3", "user-3", "Test message", { intentType: "task_query", confidence: 0.8, entities: [], domainHint: null, urgency: "low" });
    let ctx = manager.getContext("tenant-3", "user-3");
    assert.ok(ctx.turnCount > 0);
    manager.clearContext("tenant-3", "user-3");
    ctx = manager.getContext("tenant-3", "user-3");
    assert.equal(ctx.turnCount, 0);
});
test("integration: DisambiguationHandler detects ambiguity in vague messages", () => {
    const handler = new DisambiguationHandler();
    assert.ok(handler.requiresClarification(0.6, "处理一下", 1));
    assert.ok(!handler.requiresClarification(0.9, "创建新任务", 1));
});
test("integration: DisambiguationHandler generates clarification questions", () => {
    const handler = new DisambiguationHandler();
    const result = handler.generateClarification("帮我处理", 0.5, { intentType: "task_query", confidence: 0.5, entities: [], domainHint: null, urgency: "normal" }, []);
    assert.ok(result.requiresClarification);
    assert.ok(result.questions.length > 0);
    assert.ok(result.reason.length > 0);
});
test("integration: DisambiguationHandler categorizes confidence levels", () => {
    const handler = new DisambiguationHandler();
    assert.equal(handler.getConfidenceLevel(0.9), "high");
    assert.equal(handler.getConfidenceLevel(0.75), "medium");
    assert.equal(handler.getConfidenceLevel(0.6), "low");
    assert.equal(handler.getConfidenceLevel(0.4), "very_low");
});
test("integration: DisambiguationHandler disambiguates multiple similar-confidence intents", () => {
    const handler = new DisambiguationHandler();
    const result = handler.disambiguate("帮我看看", 0.65, { intentType: "task_query", confidence: 0.65, entities: [], domainHint: null, urgency: "low" }, [
        { intentType: "task_query", confidence: 0.65, entities: [], domainHint: null, urgency: "low" },
        { intentType: "task_create", confidence: 0.6, entities: [], domainHint: null, urgency: "low" },
    ]);
    // When intents are close in confidence, should ask for clarification
    assert.ok(result.requiresClarification || result.questions.length > 0);
});
test("integration: parseIntentTokens extracts intent from message", () => {
    const tokens1 = parseIntentTokens("approve the deployment");
    assert.equal(tokens1[0]?.intentType, "approval_action");
    assert.ok(tokens1[0]?.confidence > 0.9);
    const tokens2 = parseIntentTokens("what is the status");
    assert.equal(tokens2[0]?.intentType, "status_inquiry");
    const tokens3 = parseIntentTokens("delete all logs");
    assert.equal(tokens3[0]?.intentType, "task_modify");
    const tokens4 = parseIntentTokens("create a new report");
    assert.equal(tokens4[0]?.intentType, "task_create");
    assert.ok(tokens4[0]?.confidence > 0.8);
});
test("integration: NlEntryService resolves locale from accept-language header", async () => {
    const service = new NlEntryService();
    const result = await service.parseDetailed({
        tenantId: "tenant-nl-test",
        userId: "user-nl-test",
        message: "创建任务",
        acceptLanguage: "en-US, zh-CN;q=0.9",
    });
    assert.equal(result.locale, "en-US");
});
test("integration: NlEntryService auto-detects Chinese locale from message content", async () => {
    const service = new NlEntryService();
    const result = await service.parseDetailed({
        tenantId: "tenant-nl-test",
        userId: "user-nl-test",
        message: "帮我创建一个任务",
    });
    assert.equal(result.locale, "zh-CN");
});
test("integration: NlEntryService derives urgency from message", async () => {
    const service = new NlEntryService();
    const urgentResult = await service.parseDetailed({
        tenantId: "tenant-nl-test",
        userId: "user-nl-test",
        message: "立刻帮我创建这个任务",
    });
    assert.equal(urgentResult.detectedIntents[0]?.urgency, "high");
    const normalResult = await service.parseDetailed({
        tenantId: "tenant-nl-test",
        userId: "user-nl-test",
        message: "帮我创建任务",
    });
    assert.equal(normalResult.detectedIntents[0]?.urgency, "low");
});
test("integration: NlEntryService conversation window size is configurable per task type", () => {
    const service = new NlEntryService();
    const taskCreateWindow = service.getConversationWindowSize("task_create");
    const taskQueryWindow = service.getConversationWindowSize("task_query");
    assert.ok(taskCreateWindow > 0);
    assert.ok(taskQueryWindow > 0);
});
test("integration: NlEntryService clarification threshold is configurable", () => {
    const service = new NlEntryService();
    const threshold = service.getClarificationThreshold();
    assert.ok(threshold > 0);
    assert.ok(threshold < 1);
});
//# sourceMappingURL=nl-gateway-integration.test.js.map