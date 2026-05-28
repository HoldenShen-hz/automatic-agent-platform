import assert from "node:assert/strict";
import test from "node:test";

import {
  VcrFixtureStore,
  buildRequestFingerprint,
  VcrReplayMode,
  VcrReplayRequest,
  RecordedInteraction,
} from "../../../../src/platform/stability/vcr-replay-fixture.js";

test("VcrFixtureStore creates empty store with default mode", () => {
  const store = new VcrFixtureStore();

  assert.equal(store.mode, "vcr_replay");
});

test("VcrFixtureStore creates store with custom mode", () => {
  const store = new VcrFixtureStore([], "fixture_only");

  assert.equal(store.mode, "fixture_only");
});

test("VcrFixtureStore records and retrieves interaction", () => {
  const store = new VcrFixtureStore([], "vcr_replay");
  const request: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello" }],
  };

  const interaction = store.createInteraction({
    interactionId: "int_1",
    request,
    responsePayload: { content: "Hi there!" },
  });

  store.recordInteraction(interaction);
  const replayed = store.replay(request);

  assert.equal(replayed.interactionId, "int_1");
});

test("VcrFixtureStore replay throws when fixture missing in vcr_replay mode", () => {
  const store = new VcrFixtureStore([], "vcr_replay");
  const request: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello" }],
  };

  assert.throws(
    () => store.replay(request),
    (error: any) => error.code === "vcr.fixture_missing"
  );
});

test("VcrFixtureStore.loadFixture throws for null input", () => {
  assert.throws(
    () => VcrFixtureStore.loadFixture(null),
    (error: any) => error.code === "vcr.fixture_schema_invalid"
  );
});

test("VcrFixtureStore.loadFixture throws for non-object input", () => {
  assert.throws(
    () => VcrFixtureStore.loadFixture("not an object"),
    (error: any) => error.code === "vcr.fixture_schema_invalid"
  );
});

test("VcrFixtureStore.loadFixture accepts array of interactions", () => {
  const interactions: RecordedInteraction[] = [
    {
      interactionId: "int_1",
      provider: "openai",
      model: "gpt-4",
      requestFingerprint: "abc123",
      requestSummary: {
        messages: [{ role: "user", content: "Hello" }],
        toolSignature: "",
        keyParameters: {},
      },
      responsePayload: { content: "Hi" },
      recordedAt: new Date().toISOString(),
    },
  ];

  const result = VcrFixtureStore.loadFixture(interactions);

  assert.equal(result.length, 1);
  const firstInteraction = result.at(0);
  assert.ok(firstInteraction);
  assert.equal(firstInteraction.interactionId, "int_1");
});

test("VcrFixtureStore.loadFixture accepts object with interactions array", () => {
  const fixture = {
    interactions: [
      {
        interactionId: "int_1",
        provider: "openai",
        model: "gpt-4",
        requestFingerprint: "abc123",
        requestSummary: {
          messages: [{ role: "user", content: "Hello" }],
          toolSignature: "",
          keyParameters: {},
        },
        responsePayload: { content: "Hi" },
        recordedAt: new Date().toISOString(),
      },
    ],
  };

  const result = VcrFixtureStore.loadFixture(fixture);

  assert.equal(result.length, 1);
});

test("buildRequestFingerprint generates consistent fingerprint", () => {
  const request: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello" }],
  };

  const fingerprint1 = buildRequestFingerprint(request);
  const fingerprint2 = buildRequestFingerprint(request);

  assert.equal(fingerprint1, fingerprint2);
  assert.ok(fingerprint1.length === 64); // SHA-256 hex
});

test("buildRequestFingerprint generates different fingerprint for different requests", () => {
  const request1: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello" }],
  };

  const request2: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Goodbye" }],
  };

  const fingerprint1 = buildRequestFingerprint(request1);
  const fingerprint2 = buildRequestFingerprint(request2);

  assert.notEqual(fingerprint1, fingerprint2);
});

test("buildRequestFingerprint generates different fingerprint for different models", () => {
  const request1: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello" }],
  };

  const request2: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-3.5",
    messages: [{ role: "user", content: "Hello" }],
  };

  const fingerprint1 = buildRequestFingerprint(request1);
  const fingerprint2 = buildRequestFingerprint(request2);

  assert.notEqual(fingerprint1, fingerprint2);
});

test("buildRequestFingerprint generates different fingerprint for different providers", () => {
  const request1: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello" }],
  };

  const request2: VcrReplayRequest = {
    provider: "anthropic",
    model: "claude-3",
    messages: [{ role: "user", content: "Hello" }],
  };

  const fingerprint1 = buildRequestFingerprint(request1);
  const fingerprint2 = buildRequestFingerprint(request2);

  assert.notEqual(fingerprint1, fingerprint2);
});

test("buildRequestFingerprint includes tools in fingerprint", () => {
  const request1: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello" }],
    tools: ["tool_a"],
  };

  const request2: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello" }],
    tools: ["tool_b"],
  };

  const fingerprint1 = buildRequestFingerprint(request1);
  const fingerprint2 = buildRequestFingerprint(request2);

  assert.notEqual(fingerprint1, fingerprint2);
});

test("buildRequestFingerprint includes settings in fingerprint", () => {
  const request1: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello" }],
    settings: { temperature: 0.5 },
  };

  const request2: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello" }],
    settings: { temperature: 1.0 },
  };

  const fingerprint1 = buildRequestFingerprint(request1);
  const fingerprint2 = buildRequestFingerprint(request2);

  assert.notEqual(fingerprint1, fingerprint2);
});

test("VcrFixtureStore.createInteraction creates valid interaction", () => {
  const store = new VcrFixtureStore();
  const request: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello" }],
  };

  const interaction = store.createInteraction({
    interactionId: "int_1",
    request,
    responsePayload: { content: "Hi" },
  });

  assert.equal(interaction.interactionId, "int_1");
  assert.equal(interaction.provider, "openai");
  assert.equal(interaction.model, "gpt-4");
  assert.ok(typeof interaction.requestFingerprint === "string");
  assert.ok(interaction.requestSummary);
});

test("VcrFixtureStore.createInteraction accepts optional stream chunks", () => {
  const store = new VcrFixtureStore();
  const request: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello" }],
  };

  const interaction = store.createInteraction({
    interactionId: "int_1",
    request,
    responsePayload: { content: "Hi" },
    streamChunks: [{
      streamId: "stream-1",
      taskId: "task-1",
      channel: "updates",
      eventType: "message_delta",
      sequence: 1,
      payload: { content: "Hi" },
      createdAt: new Date().toISOString(),
    }],
  });

  assert.ok(interaction.streamChunks);
  assert.equal(interaction.streamChunks.length, 1);
});

test("VcrFixtureStore.createInteraction accepts optional usage snapshot", () => {
  const store = new VcrFixtureStore();
  const request: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello" }],
  };

  const interaction = store.createInteraction({
    interactionId: "int_1",
    request,
    responsePayload: { content: "Hi" },
    usageSnapshot: { tokens: 100 },
  });

  assert.ok(interaction.usageSnapshot);
  assert.equal(interaction.usageSnapshot.tokens, 100);
});

test("VcrFixtureStore.createInteraction uses provided recordedAt", () => {
  const store = new VcrFixtureStore();
  const request: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello" }],
  };

  const interaction = store.createInteraction({
    interactionId: "int_1",
    request,
    responsePayload: { content: "Hi" },
    recordedAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(interaction.recordedAt, "2026-01-01T00:00:00.000Z");
});

test("VcrFixtureStore.recordInteraction validates and stores", () => {
  const store = new VcrFixtureStore();
  const interaction: RecordedInteraction = {
    interactionId: "int_1",
    provider: "openai",
    model: "gpt-4",
    requestFingerprint: "abc123",
    requestSummary: {
      messages: [{ role: "user", content: "Hello" }],
      toolSignature: "",
      keyParameters: {},
    },
    responsePayload: { content: "Hi" },
    recordedAt: new Date().toISOString(),
  };

  const replayed = store.recordInteraction(interaction);
  const records = (store as unknown as {
    interactionsByFingerprint: Map<string, RecordedInteraction>;
  }).interactionsByFingerprint;
  assert.equal(replayed.requestFingerprint, "abc123");
  assert.equal(records.get("abc123")?.interactionId, interaction.interactionId);
});

test("VcrFixtureStore mode fixture_only allows missing fixture", () => {
  const store = new VcrFixtureStore([], "fixture_only");
  const request: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello" }],
  };

  // In fixture_only mode, replay should throw when fixture missing
  assert.throws(
    () => store.replay(request),
    (error: any) => error.code === "vcr.fixture_missing"
  );
});
