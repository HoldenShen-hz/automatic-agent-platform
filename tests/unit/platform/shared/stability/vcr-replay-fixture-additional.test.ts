/**
 * Unit tests for VCR Replay Fixture Module.
 *
 * Tests the VCR (Video Cassette Recorder) replay fixture for deterministic test replay.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVcrReplayFixture,
  createVcrReplayRecording,
  validateVcrReplayRecording,
  type VcrReplayFixtureOptions,
  type VcrReplayRecording,
} from "../../../../../src/platform/shared/stability/vcr-replay-fixture.js";

test("buildVcrReplayFixture returns fixture with replay and recording methods [vcr-replay-fixture-additional]", () => {
  const options: VcrReplayFixtureOptions = {
    fixtureId: "test-fixture",
    outputDir: "/tmp/vcr-test",
  };

  const fixture = buildVcrReplayFixture(options);

  assert.ok(fixture);
  assert.equal(fixture.fixtureId, "test-fixture");
  assert.ok(typeof fixture.replay === "function");
  assert.ok(typeof fixture.record === "function");
});

test("createVcrReplayRecording creates a valid recording structure [vcr-replay-fixture-additional]", () => {
  const recording = createVcrReplayRecording({
    fixtureId: "test-recording",
    recordedAt: "2026-04-07T00:00:00.000Z",
    durationMs: 1000,
    events: [
      {
        eventType: "test:event",
        timestamp: "2026-04-07T00:00:00.000Z",
        payload: { key: "value" },
      },
    ],
    metadata: { testId: "test-123" },
  });

  assert.ok(recording.fixtureId);
  assert.ok(recording.recordedAt);
  assert.equal(recording.durationMs, 1000);
  assert.equal(recording.events.length, 1);
});

test("createVcrReplayRecording requires events array [vcr-replay-fixture-additional]", () => {
  const recording = createVcrReplayRecording({
    fixtureId: "test-recording",
    recordedAt: "2026-04-07T00:00:00.000Z",
    durationMs: 1000,
    events: [],
    metadata: {},
  });

  assert.ok(Array.isArray(recording.events));
});

test("validateVcrReplayRecording accepts valid recording [vcr-replay-fixture-additional]", () => {
  const recording: VcrReplayRecording = {
    fixtureId: "valid-recording",
    recordedAt: "2026-04-07T00:00:00.000Z",
    durationMs: 500,
    events: [
      {
        eventType: "task:created",
        timestamp: "2026-04-07T00:00:00.000Z",
        payload: { taskId: "task-1" },
      },
    ],
    metadata: {},
  };

  const result = validateVcrReplayRecording(recording);

  assert.equal(result.valid, true);
});

test("validateVcrReplayRecording rejects missing fixtureId [vcr-replay-fixture-additional]", () => {
  const recording = {
    fixtureId: "",
    recordedAt: "2026-04-07T00:00:00.000Z",
    durationMs: 500,
    events: [],
    metadata: {},
  };

  const result = validateVcrReplayRecording(recording as VcrReplayRecording);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("fixtureId")));
});

test("validateVcrReplayRecording rejects negative duration [vcr-replay-fixture-additional]", () => {
  const recording = {
    fixtureId: "test-recording",
    recordedAt: "2026-04-07T00:00:00.000Z",
    durationMs: -100,
    events: [],
    metadata: {},
  };

  const result = validateVcrReplayRecording(recording as unknown as VcrReplayRecording);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("duration")));
});

test("VcrReplayRecording events have required fields [vcr-replay-fixture-additional]", () => {
  const recording = createVcrReplayRecording({
    fixtureId: "test-recording",
    recordedAt: "2026-04-07T00:00:00.000Z",
    durationMs: 1000,
    events: [
      {
        eventType: "dispatch:claimed",
        timestamp: "2026-04-07T00:00:00.100Z",
        payload: { executionId: "exec-1" },
      },
    ],
    metadata: {},
  });

  const event = recording.events[0];
  assert.ok(event.eventType.length > 0);
  assert.ok(event.timestamp.length > 0);
  assert.ok(event.payload);
});

test("buildVcrReplayFixture with seed provides deterministic replay [vcr-replay-fixture-additional]", () => {
  const options: VcrReplayFixtureOptions = {
    fixtureId: "seeded-fixture",
    outputDir: "/tmp/vcr-test",
    seed: 12345,
  };

  const fixture1 = buildVcrReplayFixture(options);
  const fixture2 = buildVcrReplayFixture(options);

  assert.equal(fixture1.fixtureId, fixture2.fixtureId);
  const recording = fixture1.record({
    recordedAt: "2026-04-07T00:00:00.000Z",
    durationMs: 10,
    events: [],
    metadata: {},
  });
  assert.equal(recording.metadata.replaySeed, 12345);
});

test("buildVcrReplayFixture replays seeded timelines deterministically [vcr-replay-fixture-additional]", () => {
  const recording: VcrReplayRecording = {
    fixtureId: "seeded-fixture",
    recordedAt: "2026-04-07T00:00:00.000Z",
    durationMs: 10,
    events: [
      {
        eventType: "frame:one",
        timestamp: "2026-04-07T00:00:00.000Z",
        payload: { index: 1 },
      },
      {
        eventType: "frame:two",
        timestamp: "2026-04-07T00:00:00.000Z",
        payload: { index: 2 },
      },
    ],
    metadata: {},
  };

  const fixtureA = buildVcrReplayFixture({
    fixtureId: "seeded-fixture",
    outputDir: "/tmp/vcr-test",
    seed: 12345,
  });
  const fixtureB = buildVcrReplayFixture({
    fixtureId: "seeded-fixture",
    outputDir: "/tmp/vcr-test",
    seed: 12345,
  });
  const fixtureC = buildVcrReplayFixture({
    fixtureId: "seeded-fixture",
    outputDir: "/tmp/vcr-test",
    seed: 54321,
  });

  const replayA = fixtureA.replay(recording);
  const replayB = fixtureB.replay(recording);
  const replayC = fixtureC.replay(recording);

  assert.deepEqual(replayA, replayB);
  assert.notDeepEqual(replayA, replayC);
  assert.ok(replayA[1]!.timestamp > replayA[0]!.timestamp);
});
