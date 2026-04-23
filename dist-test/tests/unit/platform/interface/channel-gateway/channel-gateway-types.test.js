import assert from "node:assert/strict";
import test from "node:test";
test("TelegramGatewayConfig structure is correct", () => {
    const config = {
        botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
        baseUrl: "https://api.telegram.org",
    };
    assert.equal(config.botToken, "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
    assert.equal(config.baseUrl, "https://api.telegram.org");
});
test("TelegramGatewayConfig allows minimal definition", () => {
    const config = {
        botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    };
    assert.equal(config.botToken, "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
    assert.equal(config.baseUrl, undefined);
});
test("SlackGatewayConfig structure is correct", () => {
    const config = {
        botToken: "xoxb-fake-token-for-testing-purposes",
        baseUrl: "https://slack.com/api",
    };
    assert.equal(config.botToken, "xoxb-fake-token-for-testing-purposes");
    assert.equal(config.baseUrl, "https://slack.com/api");
});
test("WebhookGatewayConfig structure is correct", () => {
    const config = {
        defaultHeaders: {
            Authorization: "Bearer token123",
            "Content-Type": "application/json",
        },
    };
    assert.equal(config.defaultHeaders["Authorization"], "Bearer token123");
});
test("WebhookGatewayConfig allows minimal definition", () => {
    const config = {};
    assert.equal(config.defaultHeaders, undefined);
});
test("SendGatewayMessageInput structure is correct", () => {
    const input = {
        channel: "telegram",
        targetId: "user_123",
        text: "Hello, world!",
    };
    assert.equal(input.channel, "telegram");
    assert.equal(input.targetId, "user_123");
    assert.equal(input.text, "Hello, world!");
});
test("SendGatewayMessageInput allows query-based delivery", () => {
    const input = {
        query: "user@example.com",
        text: "Hello!",
    };
    assert.equal(input.query, "user@example.com");
    assert.equal(input.text, "Hello!");
});
test("SendGatewayMessageInput allows optional metadata", () => {
    const input = {
        targetId: "user_123",
        text: "Message with metadata",
        metadata: { priority: "high", source: "app" },
    };
    assert.deepEqual(input.metadata, { priority: "high", source: "app" });
});
test("SendGatewayMessageInput allows null metadata", () => {
    const input = {
        targetId: "user_123",
        text: "Message",
        metadata: null,
    };
    assert.equal(input.metadata, null);
});
test("GatewayDeliveryReceipt structure is correct", () => {
    const receipt = {
        deliveredAt: "2026-04-14T00:00:00.000Z",
        channel: "telegram",
        targetId: "user_123",
        externalTargetId: "987654321",
        requestUrl: "https://api.telegram.org/bot123/sendMessage",
        responseStatus: 200,
        providerMessageId: "msg_12345",
    };
    assert.equal(receipt.channel, "telegram");
    assert.equal(receipt.targetId, "user_123");
    assert.equal(receipt.externalTargetId, "987654321");
    assert.equal(receipt.responseStatus, 200);
});
test("GatewayDeliveryReceipt allows null externalTargetId and providerMessageId", () => {
    const receipt = {
        deliveredAt: "2026-04-14T00:00:00.000Z",
        channel: "webhook",
        targetId: "webhook_123",
        externalTargetId: null,
        requestUrl: "https://example.com/webhook",
        responseStatus: 200,
        providerMessageId: null,
    };
    assert.equal(receipt.externalTargetId, null);
    assert.equal(receipt.providerMessageId, null);
});
//# sourceMappingURL=channel-gateway-types.test.js.map