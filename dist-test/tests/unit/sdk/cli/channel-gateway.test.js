import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadChannelGatewayEnv } from "../../../../src/platform/control-plane/config-center/channel-gateway-env.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
describe("loadChannelGatewayEnv", () => {
    it("parses send action with current gateway env names", () => {
        const config = loadChannelGatewayEnv({
            AA_CHANNEL_GATEWAY_ACTION: "send",
            AA_DB_PATH: "/tmp/test.db",
            AA_GATEWAY_MESSAGE: "Hello World",
            AA_GATEWAY_CHANNEL: "telegram",
            AA_GATEWAY_TARGET_ID: "user-1",
            AA_GATEWAY_QUERY: "ops",
        });
        assert.equal(config.action, "send");
        assert.equal(config.message, "Hello World");
        assert.equal(config.channel, "telegram");
        assert.equal(config.targetId, "user-1");
        assert.equal(config.query, "ops");
    });
    it("parses delivery actions and failure reason", () => {
        const status = loadChannelGatewayEnv({
            AA_CHANNEL_GATEWAY_ACTION: "status",
            AA_DB_PATH: "/tmp/test.db",
            AA_DELIVERY_MESSAGE_ID: "msg-123",
        });
        const failure = loadChannelGatewayEnv({
            AA_CHANNEL_GATEWAY_ACTION: "fail",
            AA_DB_PATH: "/tmp/test.db",
            AA_DELIVERY_MESSAGE_ID: "msg-789",
            AA_DELIVERY_FAILURE_REASON: "permanent_failure",
        });
        assert.equal(status.deliveryMessageId, "msg-123");
        assert.equal(failure.failureReason, "permanent_failure");
    });
    it("parses nested gateway provider config", () => {
        const config = loadChannelGatewayEnv({
            AA_CHANNEL_GATEWAY_ACTION: "send",
            AA_DB_PATH: "/tmp/test.db",
            AA_GATEWAY_MESSAGE: "Test",
            AA_GATEWAY_TELEGRAM_BOT_TOKEN: "123456:ABC-DEF",
            AA_GATEWAY_SLACK_BOT_TOKEN: "xoxb-123456",
        });
        assert.deepEqual(config.gateway.telegram, { botToken: "123456:ABC-DEF" });
        assert.deepEqual(config.gateway.slack, { botToken: "xoxb-123456" });
    });
    it("requires action-specific identifiers", () => {
        assert.throws(() => loadChannelGatewayEnv({
            AA_DB_PATH: "/tmp/test.db",
        }), (error) => error instanceof ValidationError && error.code === "missing_env:AA_GATEWAY_MESSAGE");
        assert.throws(() => loadChannelGatewayEnv({
            AA_CHANNEL_GATEWAY_ACTION: "retry",
            AA_DB_PATH: "/tmp/test.db",
        }), (error) => error instanceof ValidationError && error.code === "missing_env:AA_DELIVERY_MESSAGE_ID");
    });
});
//# sourceMappingURL=channel-gateway.test.js.map