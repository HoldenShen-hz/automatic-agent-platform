import test from "node:test";
import assert from "node:assert/strict";
import { loadNlGatewayConfig, getConversationWindowSize, shouldRequestClarification, } from "../../../../src/interaction/nl-gateway/nl-gateway-config-loader.js";
test("loadNlGatewayConfig returns valid config", () => {
    const config = loadNlGatewayConfig();
    assert.ok(config !== undefined);
    assert.ok(config.conversationWindow !== undefined);
    assert.ok(config.disambiguation !== undefined);
    assert.ok(config.intent !== undefined);
    assert.ok(config.entityExtraction !== undefined);
});
test("loadNlGatewayConfig has correct default values", () => {
    const config = loadNlGatewayConfig();
    // Conversation window defaults
    assert.equal(config.conversationWindow.defaultSize, 10);
    assert.equal(config.conversationWindow.maxSize, 20);
    assert.ok(config.conversationWindow.byTaskType !== undefined);
    // Disambiguation defaults
    assert.equal(config.disambiguation.threshold, 0.7);
    assert.equal(config.disambiguation.lowConfidenceThreshold, 0.5);
    assert.equal(config.disambiguation.maxClarificationQuestions, 3);
    assert.equal(config.disambiguation.enableProactiveClarification, true);
    // Intent defaults
    assert.equal(config.intent.minConfidenceForAutoConfirm, 0.85);
    assert.equal(config.intent.fallbackIntent, "task_query");
    // Entity extraction defaults
    assert.equal(config.entityExtraction.requiredEntityCount, 1);
    assert.equal(config.entityExtraction.minMessageLength, 6);
});
test("getConversationWindowSize returns task-type specific size when available", () => {
    const config = loadNlGatewayConfig();
    assert.equal(getConversationWindowSize(config, "task_create"), 15);
    assert.equal(getConversationWindowSize(config, "task_query"), 8);
    assert.equal(getConversationWindowSize(config, "task_modify"), 12);
    assert.equal(getConversationWindowSize(config, "status_inquiry"), 5);
    assert.equal(getConversationWindowSize(config, "approval_action"), 6);
});
test("getConversationWindowSize returns default when task type not found", () => {
    const config = loadNlGatewayConfig();
    assert.equal(getConversationWindowSize(config, "unknown_type"), config.conversationWindow.defaultSize);
    assert.equal(getConversationWindowSize(config), config.conversationWindow.defaultSize);
});
test("shouldRequestClarification returns true when confidence below threshold", () => {
    const config = loadNlGatewayConfig();
    assert.equal(shouldRequestClarification(config, 0.5), true);
    assert.equal(shouldRequestClarification(config, 0.3), true);
});
test("shouldRequestClarification returns false when confidence above threshold", () => {
    const config = loadNlGatewayConfig();
    assert.equal(shouldRequestClarification(config, 0.8), false);
    assert.equal(shouldRequestClarification(config, 0.9), false);
});
test("conversation window has max size limit", () => {
    const config = loadNlGatewayConfig();
    assert.ok(config.conversationWindow.maxSize >= config.conversationWindow.defaultSize);
    for (const size of Object.values(config.conversationWindow.byTaskType)) {
        assert.ok(size <= config.conversationWindow.maxSize);
    }
});
test("disambiguation thresholds are in valid range", () => {
    const config = loadNlGatewayConfig();
    assert.ok(config.disambiguation.threshold >= 0 && config.disambiguation.threshold <= 1);
    assert.ok(config.disambiguation.lowConfidenceThreshold >= 0 && config.disambiguation.lowConfidenceThreshold <= 1);
    assert.ok(config.disambiguation.lowConfidenceThreshold < config.disambiguation.threshold);
});
test("intent minConfidenceForAutoConfirm is in valid range", () => {
    const config = loadNlGatewayConfig();
    assert.ok(config.intent.minConfidenceForAutoConfirm >= 0);
    assert.ok(config.intent.minConfidenceForAutoConfirm <= 1);
    assert.ok(config.intent.minConfidenceForAutoConfirm > config.disambiguation.threshold);
});
test("entity extraction minMessageLength is reasonable", () => {
    const config = loadNlGatewayConfig();
    assert.ok(config.entityExtraction.minMessageLength > 0);
    assert.ok(config.entityExtraction.minMessageLength <= 20);
});
//# sourceMappingURL=nl-gateway-config-loader.test.js.map