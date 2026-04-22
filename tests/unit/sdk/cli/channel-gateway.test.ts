/**
 * Channel Gateway CLI Tests
 *
 * Tests for channel-gateway CLI module which manages message delivery
 * through the channel gateway supporting send, pending, status, targets, retry, fail.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { loadChannelGatewayEnv } from "../../../../src/platform/control-plane/config-center/channel-gateway-env.js";

describe("loadChannelGatewayEnv", () => {
  it("parses send action", () => {
    const config = loadChannelGatewayEnv({
      AA_CHANNEL_GATEWAY_ACTION: "send",
      AA_DB_PATH: "/tmp/test.db",
      AA_GATEWAY_MESSAGE: "Hello World",
      AA_CHANNEL_GATEWAY_CHANNEL: "telegram",
    });

    assert.equal(config.action, "send");
    assert.equal(config.message, "Hello World");
    assert.equal(config.channel, "telegram");
  });

  it("parses pending action", () => {
    const config = loadChannelGatewayEnv({
      AA_CHANNEL_GATEWAY_ACTION: "pending",
      AA_DB_PATH: "/tmp/test.db",
    });

    assert.equal(config.action, "pending");
  });

  it("parses status action", () => {
    const config = loadChannelGatewayEnv({
      AA_CHANNEL_GATEWAY_ACTION: "status",
      AA_DB_PATH: "/tmp/test.db",
      AA_DELIVERY_MESSAGE_ID: "msg-123",
    });

    assert.equal(config.action, "status");
    assert.equal(config.deliveryMessageId, "msg-123");
  });

  it("parses targets action", () => {
    const config = loadChannelGatewayEnv({
      AA_CHANNEL_GATEWAY_ACTION: "targets",
      AA_DB_PATH: "/tmp/test.db",
    });

    assert.equal(config.action, "targets");
  });

  it("parses retry action", () => {
    const config = loadChannelGatewayEnv({
      AA_CHANNEL_GATEWAY_ACTION: "retry",
      AA_DB_PATH: "/tmp/test.db",
      AA_DELIVERY_MESSAGE_ID: "msg-456",
    });

    assert.equal(config.action, "retry");
    assert.equal(config.deliveryMessageId, "msg-456");
  });

  it("parses fail action with failure reason", () => {
    const config = loadChannelGatewayEnv({
      AA_CHANNEL_GATEWAY_ACTION: "fail",
      AA_DB_PATH: "/tmp/test.db",
      AA_DELIVERY_MESSAGE_ID: "msg-789",
      AA_FAILURE_REASON: "permanent_failure",
    });

    assert.equal(config.action, "fail");
    assert.equal(config.deliveryMessageId, "msg-789");
    assert.equal(config.failureReason, "permanent_failure");
  });

  it("parses optional target_id and query", () => {
    const config = loadChannelGatewayEnv({
      AA_CHANNEL_GATEWAY_ACTION: "send",
      AA_DB_PATH: "/tmp/test.db",
      AA_GATEWAY_MESSAGE: "Test message",
      AA_CHANNEL_GATEWAY_TARGET_ID: "target-abc",
      AA_CHANNEL_GATEWAY_QUERY: "user@example.com",
    });

    assert.equal(config.targetId, "target-abc");
    assert.equal(config.query, "user@example.com");
  });

  it("returns send as default action", () => {
    const config = loadChannelGatewayEnv({
      AA_DB_PATH: "/tmp/test.db",
    });

    assert.equal(config.action, "send");
  });

  it("parses gateway configuration with telegram", () => {
    const config = loadChannelGatewayEnv({
      AA_CHANNEL_GATEWAY_ACTION: "send",
      AA_DB_PATH: "/tmp/test.db",
      AA_GATEWAY_MESSAGE: "Test",
      AA_TELEGRAM_BOT_TOKEN: "123456:ABC-DEF",
    });

    assert.deepEqual(config.gateway.telegram, { botToken: "123456:ABC-DEF" });
  });

  it("parses gateway configuration with slack", () => {
    const config = loadChannelGatewayEnv({
      AA_CHANNEL_GATEWAY_ACTION: "send",
      AA_DB_PATH: "/tmp/test.db",
      AA_GATEWAY_MESSAGE: "Test",
      AA_SLACK_BOT_TOKEN: "xoxb-123456",
    });

    assert.deepEqual(config.gateway.slack, { botToken: "xoxb-123456" });
  });
});
