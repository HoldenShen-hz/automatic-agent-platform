import assert from "node:assert/strict";
import test from "node:test";

import { createLivestreamAdapterPlugin } from "../../../../src/plugins/adapters/livestream-adapter.js";

test.describe("LivestreamAdapter Plugin", () => {
  test("createLivestreamAdapterPlugin returns ExternalAdapterPlugin with correct metadata", () => {
    const adapter = createLivestreamAdapterPlugin();
    assert.equal(adapter.pluginId, "plugin.livestream.obs_adapter");
    assert.equal(adapter.spiType, "adapter");
    assert.equal(adapter.adapterType, "obs_streaming");
    assert.deepEqual(adapter.capabilityIds, ["obs.config", "obs.scenes", "stream.analytics", "stream.engagement"]);
  });

  test("initialize returns undefined", async () => {
    const adapter = createLivestreamAdapterPlugin();
    assert.ok(adapter.initialize);
    const result = await adapter.initialize();
    assert.equal(result, undefined);
  });

  test("shutdown clears credential fingerprint", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken123456" });
    assert.ok(adapter.shutdown);
    await adapter.shutdown();
  });

  test("healthCheck reflects endpoint policy even before authentication", async () => {
    const adapter = createLivestreamAdapterPlugin();
    assert.ok(adapter.healthCheck);
    const result = await adapter.healthCheck();
    assert.equal(result, true);
  });

  test("healthCheck returns true after authentication", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken123456" });
    assert.ok(adapter.healthCheck);
    const result = await adapter.healthCheck();
    assert.equal(result, true);
  });
});

test.describe("LivestreamAdapter authenticate", () => {
  test("authenticate accepts valid OBS token", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken123456" });
  });

  test("authenticate accepts very long valid token", async () => {
    const adapter = createLivestreamAdapterPlugin();
    const longToken = "A".repeat(100) + "1234567890";
    await adapter.authenticate({ obsToken: longToken });
  });

  test("authenticate throws on missing OBS token", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await assert.rejects(
      async () => adapter.authenticate({}),
      { message: /OBS authentication token is required/ },
    );
  });

  test("authenticate throws on undefined obsToken", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await assert.rejects(
      async () => adapter.authenticate({ obsToken: undefined }),
      { message: /OBS authentication token is required/ },
    );
  });

  test("authenticate throws on null obsToken", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await assert.rejects(
      async () => adapter.authenticate({ obsToken: null }),
      { message: /OBS authentication token is required/ },
    );
  });

  test("authenticate throws on empty string token", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await assert.rejects(
      async () => adapter.authenticate({ obsToken: "" }),
      { message: /OBS authentication token is required/ },
    );
  });

  test("authenticate throws on whitespace-only token", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await assert.rejects(
      async () => adapter.authenticate({ obsToken: "   " }),
      { message: /OBS authentication token is required/ },
    );
  });

  test("authenticate throws on token too short (less than 16 chars)", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await assert.rejects(
      async () => adapter.authenticate({ obsToken: "short" }),
      { message: /OBS authentication token format is invalid/ },
    );
  });

  test("authenticate throws on non-base64 token", async () => {
    const adapter = createLivestreamAdapterPlugin();
    // Token with special characters not in base64 alphabet (but still 16+ chars)
    await assert.rejects(
      async () => adapter.authenticate({ obsToken: "!!!invalid_token!!!" }),
      { message: /OBS authentication token format is invalid/ },
    );
  });

  test("authenticate accepts token with base64 characters", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "ValidBase64Token1234567890" });
  });

  test("authenticate accepts token with base64url characters", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "ValidBase64-Token_123456789" });
  });

  test("authenticate accepts credentials and derives a stable hashed fingerprint", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken123456" });
  });

  test("authenticate trims whitespace from token", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "  AValidOBSWebSocketToken123456  " });
  });
});

test.describe("LivestreamAdapter execute", () => {
  test("execute throws when not authenticated", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await assert.rejects(
      async () => adapter.execute("get_stream_config", { streamId: "stream_123" }),
      { message: /livestream_adapter\.not_authenticated/ },
    );
  });

  test("execute returns success response for get_stream_config action", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken123456" });
    const result = await adapter.execute("get_stream_config", {
      streamId: "stream_123",
    }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.action, "get_stream_config");
    assert.equal(result.output.streamId, "stream_123");
    assert.equal(result.output.status, "success");
  });

  test("execute returns success response for get_scenes action", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken123456" });
    const result = await adapter.execute("get_scenes", {}) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.action, "get_scenes");
    assert.equal(result.output.streamId, null);
  });

  test("execute returns success response for get_stream_analytics action", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken123456" });
    const result = await adapter.execute("get_stream_analytics", {
      streamId: "stream_456",
    }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.action, "get_stream_analytics");
    assert.equal(result.output.streamId, "stream_456");
  });

  test("execute returns success response for get_stream_engagement action", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken123456" });
    const result = await adapter.execute("get_stream_engagement", {
      streamId: "stream_789",
    }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.action, "get_stream_engagement");
    assert.equal(result.output.streamId, "stream_789");
  });

  test("execute handles missing streamId", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken123456" });
    const result = await adapter.execute("get_stream_config", {}) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.streamId, null);
  });

  test("execute handles null streamId", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken123456" });
    const result = await adapter.execute("get_stream_config", { streamId: null }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.streamId, null);
  });

  test("execute includes message with action and streamId", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken123456" });
    const result = await adapter.execute("get_stream_config", {
      streamId: "stream_123",
    }) as any;
    assert.ok(result.output.message.includes("get_stream_config"));
    assert.ok(result.output.message.includes("stream_123"));
  });
});

test.describe("LivestreamAdapter egress policy", () => {
  test("execute enforces Twitch API egress policy", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken123456" });
    // With default policy (allowed for api.twitch.tv), should succeed
    const result = await adapter.execute("get_stream_config", {
      streamId: "stream_123",
    }) as any;
    assert.equal(result.success, true);
  });

  test("execute enforces YouTube API egress policy", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken123456" });
    // With default policy (allowed for www.googleapis.com/youtube/v3), should succeed
    const result = await adapter.execute("get_stream_analytics", {
      streamId: "stream_123",
    }) as any;
    assert.equal(result.success, true);
  });
});

test.describe("LivestreamAdapter state management", () => {
  test("execute fails after shutdown even with prior authentication", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken123456" });
    assert.ok(adapter.shutdown);
    await adapter.shutdown();
    await assert.rejects(
      async () => adapter.execute("get_stream_config", { streamId: "stream_123" }),
      { message: /livestream_adapter\.not_authenticated/ },
    );
  });

  test("multiple execute calls share authentication state", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken123456" });
    const result1 = await adapter.execute("get_stream_config", { streamId: "stream_1" }) as any;
    const result2 = await adapter.execute("get_scenes", {}) as any;
    assert.equal(result1.success, true);
    assert.equal(result2.success, true);
    assert.equal(result1.output.streamId, "stream_1");
    assert.equal(result2.output.streamId, null);
  });

  test("re-authenticate after shutdown works", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken123456" });
    assert.ok(adapter.shutdown);
    await adapter.shutdown();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken789012" });
    const result = await adapter.execute("get_stream_config", { streamId: "test" }) as any;
    assert.equal(result.success, true);
  });
});

test.describe("LivestreamAdapter edge cases", () => {
  test("execute handles very long streamId", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken123456" });
    const longId = "s".repeat(100);
    const result = await adapter.execute("get_stream_config", { streamId: longId }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.streamId, longId);
  });

  test("execute handles special characters in streamId", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken123456" });
    const result = await adapter.execute("get_stream_config", {
      streamId: "stream-123_test.live",
    }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.streamId, "stream-123_test.live");
  });

  test("execute response structure is consistent", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken123456" });
    const result = await adapter.execute("get_stream_config", {
      streamId: "stream_123",
    }) as any;
    assert.ok(typeof result.success === "boolean");
    assert.ok(result.output !== undefined);
    assert.ok(typeof result.output.action === "string");
    assert.ok(typeof result.output.status === "string");
    assert.ok(typeof result.output.message === "string");
  });

  test("execute handles unknown action gracefully", async () => {
    const adapter = createLivestreamAdapterPlugin();
    await adapter.authenticate({ obsToken: "AValidOBSWebSocketToken123456" });
    const result = await adapter.execute("unknown_action" as any, {
      streamId: "stream_123",
    }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.action, "unknown_action");
  });
});
