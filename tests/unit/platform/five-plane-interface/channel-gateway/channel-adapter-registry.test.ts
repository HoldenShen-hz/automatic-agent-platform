import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  ChannelAdapterRegistry,
  type ChannelAdapter,
} from "../../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-service.js";
import type { GatewayDeliveryReceipt } from "../../../../../src/platform/five-plane-interface/channel-gateway/types.js";

function makeMockAdapter(channel: string): ChannelAdapter {
  return {
    channel,
    send: async () => ({
      deliveredAt: new Date().toISOString(),
      channel,
      targetId: "target_123",
      externalTargetId: "ext_123",
      requestUrl: "https://example.com",
      responseStatus: 200,
      providerMessageId: null,
    }),
  };
}

test("ChannelAdapterRegistry registers an adapter", () => {
  const registry = new ChannelAdapterRegistry();
  const adapter = makeMockAdapter("telegram");
  registry.register(adapter);
  assert.equal(registry.has("telegram"), true);
});

test("ChannelAdapterRegistry has returns false for unregistered channel", () => {
  const registry = new ChannelAdapterRegistry();
  assert.equal(registry.has("telegram"), false);
});

test("ChannelAdapterRegistry get returns registered adapter", () => {
  const registry = new ChannelAdapterRegistry();
  const adapter = makeMockAdapter("slack");
  registry.register(adapter);
  const result = registry.get("slack");
  assert.equal(result, adapter);
});

test("ChannelAdapterRegistry get returns undefined for unregistered channel", () => {
  const registry = new ChannelAdapterRegistry();
  const result = registry.get("telegram");
  assert.equal(result, undefined);
});

test("ChannelAdapterRegistry throws when registering duplicate channel", () => {
  const registry = new ChannelAdapterRegistry();
  registry.register(makeMockAdapter("telegram"));
  assert.throws(
    () => registry.register(makeMockAdapter("telegram")),
    /channel_adapter.already_registered/,
  );
});

test("ChannelAdapterRegistry registeredChannels returns all registered channels", () => {
  const registry = new ChannelAdapterRegistry();
  registry.register(makeMockAdapter("telegram"));
  registry.register(makeMockAdapter("slack"));
  registry.register(makeMockAdapter("webhook"));
  const channels = registry.registeredChannels();
  assert.deepEqual(channels, ["telegram", "slack", "webhook"]);
});

test("ChannelAdapterRegistry registeredChannels returns empty for empty registry", () => {
  const registry = new ChannelAdapterRegistry();
  const channels = registry.registeredChannels();
  assert.deepEqual(channels, []);
});

test("ChannelAdapterRegistry can register different channel adapters", () => {
  const registry = new ChannelAdapterRegistry();
  registry.register(makeMockAdapter("telegram"));
  registry.register(makeMockAdapter("slack"));
  registry.register(makeMockAdapter("webhook"));

  assert.equal(registry.has("telegram"), true);
  assert.equal(registry.has("slack"), true);
  assert.equal(registry.has("webhook"), true);
  assert.equal(registry.registeredChannels().length, 3);
});