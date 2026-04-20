import assert from "node:assert/strict";
import test from "node:test";

import type {
  VcrReplayMode,
  VcrRequestMessage,
  VcrReplayRequest,
  RecordedInteraction,
} from "../../../../../src/platform/shared/stability/vcr-replay-fixture.js";
import type { StreamEventFrame } from "../../../../../src/platform/interface/channel-gateway/stream-bridge.js";

test("VcrReplayMode accepts all valid values", () => {
  const modes: VcrReplayMode[] = ["fixture_only", "vcr_replay", "vcr_record"];
  assert.equal(modes.length, 3);
  for (const mode of modes) {
    const result: VcrReplayMode = mode;
    assert.ok(result === mode);
  }
});

test("VcrRequestMessage structure is correct", () => {
  const message: VcrRequestMessage = {
    role: "user",
    content: "Hello, world!",
  };

  assert.equal(message.role, "user");
  assert.equal(message.content, "Hello, world!");
});

test("VcrRequestMessage role accepts all valid values", () => {
  const roles: VcrRequestMessage["role"][] = ["system", "user", "assistant"];

  for (const role of roles) {
    const message: VcrRequestMessage = { role, content: "test" };
    assert.ok(message.role === role);
  }
});

test("VcrReplayRequest structure is correct", () => {
  const request: VcrReplayRequest = {
    provider: "anthropic",
    model: "claude-opus-4-5",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello!" },
    ],
    tools: ["web-search", "calculator"],
    settings: {
      temperature: 0.7,
      reasoningLevel: "standard",
      topP: 0.9,
    },
  };

  assert.equal(request.provider, "anthropic");
  assert.equal(request.model, "claude-opus-4-5");
  assert.equal(request.messages.length, 2);
  assert.equal(request.tools?.length, 2);
  assert.equal(request.settings?.temperature, 0.7);
});

test("VcrReplayRequest allows minimal definition", () => {
  const request: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Hi" }],
  };

  assert.equal(request.provider, "openai");
  assert.equal(request.tools, undefined);
  assert.equal(request.settings, undefined);
});

test("VcrReplayRequest allows partial settings", () => {
  const request: VcrReplayRequest = {
    provider: "anthropic",
    model: "claude-sonnet-4",
    messages: [{ role: "user", content: "Test" }],
    settings: {
      temperature: 0.5,
    },
  };

  assert.equal(request.settings?.temperature, 0.5);
  assert.equal(request.settings?.reasoningLevel, undefined);
  assert.equal(request.settings?.topP, undefined);
});

test("RecordedInteraction structure is correct", () => {
  const interaction: RecordedInteraction = {
    interactionId: "inter_123",
    provider: "anthropic",
    model: "claude-opus-4-5",
    requestFingerprint: "abc123def456",
    requestSummary: {
      messages: [{ role: "user", content: "Hello" }],
      toolSignature: "web-search,calculator",
      keyParameters: { temperature: 0.7 },
    },
    responsePayload: { completion: "Hi there!" },
    usageSnapshot: { inputTokens: 100, outputTokens: 50 },
    recordedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.equal(interaction.interactionId, "inter_123");
  assert.equal(interaction.requestFingerprint, "abc123def456");
  assert.equal(interaction.responsePayload.completion, "Hi there!");
  assert.equal(interaction.usageSnapshot?.inputTokens, 100);
});

test("RecordedInteraction allows optional fields", () => {
  const interaction: RecordedInteraction = {
    interactionId: "inter_456",
    provider: "openai",
    model: "gpt-4",
    requestFingerprint: "xyz789",
    requestSummary: {
      messages: [],
      toolSignature: "",
      keyParameters: {},
    },
    responsePayload: {},
    recordedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.equal(interaction.streamChunks, undefined);
  assert.equal(interaction.usageSnapshot, undefined);
});

test("RecordedInteraction allows stream chunks", () => {
  const streamChunk: StreamEventFrame = {
    streamId: "stream_abc",
    taskId: "task_123",
    channel: "output",
    eventType: "message_delta",
    sequence: 1,
    payload: { delta: "Hello" },
    createdAt: "2026-04-14T00:00:00.000Z",
  };

  const interaction: RecordedInteraction = {
    interactionId: "inter_stream",
    provider: "anthropic",
    model: "claude-opus-4-5",
    requestFingerprint: "stream123",
    requestSummary: {
      messages: [{ role: "user", content: "Count to 5" }],
      toolSignature: "",
      keyParameters: {},
    },
    responsePayload: {},
    streamChunks: [streamChunk],
    recordedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.ok(interaction.streamChunks !== undefined);
  assert.equal(interaction.streamChunks.length, 1);
  assert.equal(interaction.streamChunks![0]!.eventType, "message_delta");
});

test("RecordedInteraction requestSummary structure is correct", () => {
  const interaction: RecordedInteraction = {
    interactionId: "inter_summary",
    provider: "anthropic",
    model: "claude-sonnet-4",
    requestFingerprint: "summary123",
    requestSummary: {
      messages: [
        { role: "system", content: "You are a poet." },
        { role: "user", content: "Write a haiku" },
      ],
      toolSignature: "writePoem",
      keyParameters: { temperature: 1.0, reasoningLevel: "high" },
    },
    responsePayload: { poem: "Autumn moonlight..." },
    recordedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.equal(interaction.requestSummary.messages.length, 2);
  assert.equal(interaction.requestSummary.toolSignature, "writePoem");
  assert.equal(interaction.requestSummary.keyParameters.temperature, 1.0);
});
