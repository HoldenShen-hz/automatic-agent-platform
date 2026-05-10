/**
 * Integration Test: VCR Replay Fixture
 *
 * Verifies:
 * - Fixture loading from various input formats
 * - Multi-interaction replay scenarios
 * - Error handling for invalid fixtures
 * - Fingerprint consistency across replay cycles
 */

import assert from "node:assert/strict";
import { readFileSync, writeFileSync, rmSync, mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  VcrFixtureStore,
  buildRequestFingerprint,
  VcrReplayMode,
  VcrReplayRequest,
  RecordedInteraction,
} from "../../../../src/platform/stability/vcr-replay-fixture.js";

function createTempWorkspace(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function cleanupPath(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

test("VcrFixtureStore integration: load and replay multiple interactions", () => {
  const store = new VcrFixtureStore([], "vcr_replay");

  const request1: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello, world!" }],
  };

  const request2: VcrReplayRequest = {
    provider: "anthropic",
    model: "claude-3-opus",
    messages: [{ role: "user", content: "Tell me a story" }],
    tools: ["bash", "read"],
    settings: { temperature: 0.7 },
  };

  const interaction1 = store.createInteraction({
    interactionId: "int_001",
    request: request1,
    responsePayload: { content: "Hello! How can I help?" },
    usageSnapshot: { inputTokens: 5, outputTokens: 8 },
  });

  const interaction2 = store.createInteraction({
    interactionId: "int_002",
    request: request2,
    responsePayload: { content: "Once upon a time..." },
    usageSnapshot: { inputTokens: 6, outputTokens: 120 },
    streamChunks: [
      {
        streamId: "stream-1",
        taskId: "task-1",
        channel: "updates",
        eventType: "message_delta",
        sequence: 1,
        payload: { content: "Once" },
        createdAt: new Date().toISOString(),
      },
      {
        streamId: "stream-1",
        taskId: "task-1",
        channel: "updates",
        eventType: "message_delta",
        sequence: 2,
        payload: { content: " once upon" },
        createdAt: new Date().toISOString(),
      },
    ],
  });

  store.recordInteraction(interaction1);
  store.recordInteraction(interaction2);

  const replayed1 = store.replay(request1);
  const replayed2 = store.replay(request2);

  assert.equal(replayed1.interactionId, "int_001");
  assert.equal(replayed2.interactionId, "int_002");
  assert.ok(replayed1.usageSnapshot);
  assert.ok(replayed2.streamChunks);
  assert.equal(replayed2.streamChunks.length, 2);
});

test("VcrFixtureStore integration: replay with different tools order produces same fingerprint", () => {
  const store = new VcrFixtureStore([], "vcr_replay");

  const request1: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Use the tools" }],
    tools: ["bash", "read", "write"],
  };

  const request2: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Use the tools" }],
    tools: ["write", "bash", "read"],
  };

  // Both should have same fingerprint since tools are sorted
  const fp1 = buildRequestFingerprint(request1);
  const fp2 = buildRequestFingerprint(request2);

  assert.equal(fp1, fp2);

  const interaction = store.createInteraction({
    interactionId: "int_tools_test",
    request: request1,
    responsePayload: { content: "Done" },
  });

  store.recordInteraction(interaction);

  // Both requests should replay the same interaction
  const replayed1 = store.replay(request1);
  const replayed2 = store.replay(request2);

  assert.equal(replayed1.interactionId, replayed2.interactionId);
});

test("VcrFixtureStore.loadFixture integration: loads from JSON file with interactions wrapper", () => {
  const workspace = createTempWorkspace("aa-vcr-fixture-");
  const fixturePath = join(workspace, "fixture.json");

  try {
    const fixture = {
      interactions: [
        {
          interactionId: "file_int_001",
          provider: "openai",
          model: "gpt-4",
          requestFingerprint: "fingerprint_from_file",
          requestSummary: {
            messages: [{ role: "user", content: "Hello from file" }],
            toolSignature: "",
            keyParameters: {},
          },
          responsePayload: { content: "Response from file" },
          recordedAt: "2026-01-15T10:00:00.000Z",
        },
        {
          interactionId: "file_int_002",
          provider: "anthropic",
          model: "claude-3-sonnet",
          requestFingerprint: "another_fingerprint",
          requestSummary: {
            messages: [{ role: "user", content: "Another request" }],
            toolSignature: "bash",
            keyParameters: { temperature: 0.5 },
          },
          responsePayload: { content: "Another response" },
          recordedAt: "2026-01-15T11:00:00.000Z",
        },
      ],
    };

    writeFileSync(fixturePath, JSON.stringify(fixture), "utf8");

    const loaded = VcrFixtureStore.loadFixture(JSON.parse(readFileSync(fixturePath, "utf8")));

    assert.equal(loaded.length, 2);
    assert.equal(loaded[0]?.interactionId, "file_int_001");
    assert.equal(loaded[1]?.interactionId, "file_int_002");
    assert.equal(loaded[1]?.requestSummary.toolSignature, "bash");
  } finally {
    cleanupPath(workspace);
  }
});

test("VcrFixtureStore.loadFixture integration: loads raw array from JSON file", () => {
  const workspace = createTempWorkspace("aa-vcr-raw-");
  const fixturePath = join(workspace, "raw_fixture.json");

  try {
    const rawInteractions = [
      {
        interactionId: "raw_int_001",
        provider: "google",
        model: "gemini-pro",
        requestFingerprint: "raw_fingerprint",
        requestSummary: {
          messages: [{ role: "user", content: "Raw interaction" }],
          toolSignature: "",
          keyParameters: {},
        },
        responsePayload: { content: "Raw response" },
        recordedAt: "2026-02-01T09:00:00.000Z",
      },
    ];

    writeFileSync(fixturePath, JSON.stringify(rawInteractions), "utf8");

    const loaded = VcrFixtureStore.loadFixture(JSON.parse(readFileSync(fixturePath, "utf8")));

    assert.equal(loaded.length, 1);
    assert.equal(loaded[0]?.interactionId, "raw_int_001");
    assert.equal(loaded[0]?.provider, "google");
  } finally {
    cleanupPath(workspace);
  }
});

test("VcrFixtureStore.loadFixture integration: empty array returns empty result", () => {
  const result = VcrFixtureStore.loadFixture([]);
  assert.equal(result.length, 0);
});

test("VcrFixtureStore.loadFixture integration: throws for malformed interaction object", () => {
  const malformedInteractions = [
    {
      interactionId: "bad_int",
      // missing required fields
      provider: "openai",
      // model missing
    },
  ];

  assert.throws(
    () => VcrFixtureStore.loadFixture(malformedInteractions),
    (error: any) => error.code === "vcr.fixture_schema_invalid"
  );
});

test("VcrFixtureStore integration: secret redaction in fingerprints", () => {
  const request1: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [
      {
        role: "user",
        content: "Authorization: Bearer sk-1234567890abcdef and api_key=super-secret-key",
      },
    ],
  };

  const request2: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [
      {
        role: "user",
        content: "Authorization: Bearer sk-xxxxxx and api_key=different-secret",
      },
    ],
  };

  // Both should have the same fingerprint because secrets are redacted
  const fp1 = buildRequestFingerprint(request1);
  const fp2 = buildRequestFingerprint(request2);

  assert.equal(fp1, fp2);
});

test("VcrFixtureStore integration: mode vcr_record allows recording", () => {
  const store = new VcrFixtureStore([], "vcr_record");

  const request: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "New request" }],
  };

  // In vcr_record mode, we can create and record an interaction
  const interaction = store.createInteraction({
    interactionId: "new_int",
    request,
    responsePayload: { content: "New response" },
  });

  store.recordInteraction(interaction);
  const replayed = store.replay(request);

  assert.equal(replayed.interactionId, "new_int");
});

test("VcrFixtureStore integration: settings with reasoningLevel affect fingerprint", () => {
  const store = new VcrFixtureStore([], "vcr_replay");

  const request1: VcrReplayRequest = {
    provider: "anthropic",
    model: "claude-3-opus",
    messages: [{ role: "user", content: "Think carefully" }],
    settings: { reasoningLevel: "minimal" },
  };

  const request2: VcrReplayRequest = {
    provider: "anthropic",
    model: "claude-3-opus",
    messages: [{ role: "user", content: "Think carefully" }],
    settings: { reasoningLevel: "full" },
  };

  const fp1 = buildRequestFingerprint(request1);
  const fp2 = buildRequestFingerprint(request2);

  assert.notEqual(fp1, fp2);

  const interaction = store.createInteraction({
    interactionId: "reasoning_int",
    request: request1,
    responsePayload: { content: "Minimal reasoning response" },
  });

  store.recordInteraction(interaction);

  const replayed = store.replay(request1);
  assert.equal(replayed.interactionId, "reasoning_int");

  // request2 should not find a fixture
  assert.throws(
    () => store.replay(request2),
    (error: any) => error.code === "vcr.fixture_missing"
  );
});

test("VcrFixtureStore integration: replay preserves responsePayload exactly", () => {
  const store = new VcrFixtureStore([], "vcr_replay");

  const complexResponse = {
    content: "Complex response",
    metadata: {
      model: "gpt-4",
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 20 },
    },
    toolCalls: [
      { name: "bash", args: { command: "ls -la" } },
    ],
  };

  const request: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Complex response test" }],
  };

  store.recordInteraction(
    store.createInteraction({
      interactionId: "complex_int",
      request,
      responsePayload: complexResponse,
    })
  );

  const replayed = store.replay(request);

  assert.deepEqual(replayed.responsePayload, complexResponse);
  assert.equal(replayed.responsePayload.toolCalls?.[0]?.name, "bash");
  assert.equal(replayed.responsePayload.metadata?.usage?.promptTokens, 10);
});

test("VcrFixtureStore integration: topP parameter affects fingerprint", () => {
  const request1: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Temperature test" }],
    settings: { topP: 0.9 },
  };

  const request2: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Temperature test" }],
    settings: { topP: 1.0 },
  };

  const fp1 = buildRequestFingerprint(request1);
  const fp2 = buildRequestFingerprint(request2);

  assert.notEqual(fp1, fp2);
});

test("VcrFixtureStore integration: empty tools array vs no tools property", () => {
  const request1: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Test" }],
    tools: [],
  };

  const request2: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [{ role: "user", content: "Test" }],
  };

  const fp1 = buildRequestFingerprint(request1);
  const fp2 = buildRequestFingerprint(request2);

  // Both should produce same fingerprint since sorted empty string equals undefined
  assert.equal(fp1, fp2);
});

test("VcrFixtureStore integration: system messages included in fingerprint", () => {
  const request1: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello" },
    ],
  };

  const request2: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello" },
    ],
  };

  const fp1 = buildRequestFingerprint(request1);
  const fp2 = buildRequestFingerprint(request2);

  assert.equal(fp1, fp2);

  const request3: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are a useful assistant." }, // Different system message
      { role: "user", content: "Hello" },
    ],
  };

  const fp3 = buildRequestFingerprint(request3);

  assert.notEqual(fp1, fp3);
});

test("VcrFixtureStore integration: assistant messages included in fingerprint", () => {
  const request1: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
      { role: "user", content: "How are you?" },
    ],
  };

  const request2: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
      { role: "user", content: "How are you?" },
    ],
  };

  const fp1 = buildRequestFingerprint(request1);
  const fp2 = buildRequestFingerprint(request2);

  assert.equal(fp1, fp2);

  const request3: VcrReplayRequest = {
    provider: "openai",
    model: "gpt-4",
    messages: [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hello there!" }, // Different response
      { role: "user", content: "How are you?" },
    ],
  };

  const fp3 = buildRequestFingerprint(request3);

  assert.notEqual(fp1, fp3);
});
