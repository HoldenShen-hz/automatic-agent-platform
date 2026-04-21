import assert from "node:assert/strict";
import test from "node:test";
import { loadChannelGatewayEnv } from "../../../../../src/platform/control-plane/config-center/channel-gateway-env.js";
test("loadChannelGatewayEnv parses send action and gateway provider config", () => {
    const config = loadChannelGatewayEnv({
        AA_DB_PATH: "/tmp/channel-gateway.db",
        AA_CHANNEL_GATEWAY_ACTION: "send",
        AA_GATEWAY_MESSAGE: "Ship the webhook notification.",
        AA_GATEWAY_CHANNEL: "webhook",
        AA_GATEWAY_QUERY: "ops-hook",
        AA_GATEWAY_TELEGRAM_BOT_TOKEN: "telegram-token",
        AA_GATEWAY_SLACK_BOT_TOKEN: "slack-token",
        AA_GATEWAY_WEBHOOK_DEFAULT_HEADERS_JSON: JSON.stringify({
            "x-default": "yes",
        }),
    });
    assert.equal(config.dbPath, "/tmp/channel-gateway.db");
    assert.equal(config.action, "send");
    assert.equal(config.message, "Ship the webhook notification.");
    assert.equal(config.channel, "webhook");
    assert.equal(config.query, "ops-hook");
    assert.equal(config.gateway.telegram?.botToken, "telegram-token");
    assert.equal(config.gateway.slack?.botToken, "slack-token");
    assert.equal(config.gateway.webhook?.defaultHeaders["x-default"], "yes");
});
test("loadChannelGatewayEnv rejects invalid actions", () => {
    assert.throws(() => loadChannelGatewayEnv({
        AA_DB_PATH: "/tmp/channel-gateway.db",
        AA_CHANNEL_GATEWAY_ACTION: "explode",
    }), /gateway\.invalid_action/);
});
test("loadChannelGatewayEnv rejects malformed webhook headers json", () => {
    assert.throws(() => loadChannelGatewayEnv({
        AA_DB_PATH: "/tmp/channel-gateway.db",
        AA_GATEWAY_MESSAGE: "hello",
        AA_GATEWAY_WEBHOOK_DEFAULT_HEADERS_JSON: "{\"x-default\":1}",
    }), /gateway\.invalid_webhook_headers_json/);
});
test("loadChannelGatewayEnv requires message and delivery ids for action-specific flows", () => {
    assert.throws(() => loadChannelGatewayEnv({
        AA_DB_PATH: "/tmp/channel-gateway.db",
    }), /missing_env:AA_GATEWAY_MESSAGE/);
    assert.throws(() => loadChannelGatewayEnv({
        AA_DB_PATH: "/tmp/channel-gateway.db",
        AA_CHANNEL_GATEWAY_ACTION: "status",
    }), /missing_env:AA_DELIVERY_MESSAGE_ID/);
});
//# sourceMappingURL=channel-gateway-env.test.js.map