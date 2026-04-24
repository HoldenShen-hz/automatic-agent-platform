import assert from "node:assert/strict";
import test from "node:test";

import {
  buildForensicSnapshot,
  summarizeForensicSnapshot,
  type ForensicSnapshot,
  type ForensicSnapshotInput,
} from "../../../../../src/ops-maturity/emergency/forensic-snapshot/index.js";

test("buildForensicSnapshot creates snapshot with all fields", () => {
  const input: ForensicSnapshotInput = {
    snapshotId: "snap-001",
    scope: "platform",
    collectedAt: "2026-04-24T00:00:00.000Z",
    artifactIds: ["art-1", "art-2", "art-3"],
    runtimeState: { severity: "critical", triggerSignals: ["sig-1"] },
    configurationRefs: ["cfg-1", "cfg-2"],
    logRefs: ["log-1"],
  };

  const result = buildForensicSnapshot(input);

  assert.equal(result.snapshotId, "snap-001");
  assert.equal(result.scope, "platform");
  assert.equal(result.collectedAt, "2026-04-24T00:00:00.000Z");
  assert.equal(result.artifactIds.length, 3);
  assert.equal(result.configurationRefs.length, 2);
  assert.equal(result.logRefs.length, 1);
  assert.equal(result.runtimeState.severity, "critical");
});

test("buildForensicSnapshot applies defaults for missing optional fields", () => {
  const input: ForensicSnapshotInput = {
    snapshotId: "snap-minimal",
    scope: "division-a",
    collectedAt: "2026-04-24T00:00:00.000Z",
    artifactIds: [],
  };

  const result = buildForensicSnapshot(input);

  assert.deepEqual(result.runtimeState, {});
  assert.deepEqual(result.configurationRefs, []);
  assert.deepEqual(result.logRefs, []);
});

test("buildForensicSnapshot handles empty artifactIds", () => {
  const input: ForensicSnapshotInput = {
    snapshotId: "snap-empty",
    scope: "test",
    collectedAt: "2026-04-24T00:00:00.000Z",
    artifactIds: [],
  };

  const result = buildForensicSnapshot(input);

  assert.deepEqual(result.artifactIds, []);
  assert.equal(result.artifactIds.length, 0);
});

test("buildForensicSnapshot preserves runtimeState object", () => {
  const input: ForensicSnapshotInput = {
    snapshotId: "snap-state",
    scope: "platform",
    collectedAt: "2026-04-24T00:00:00.000Z",
    artifactIds: [],
    runtimeState: { nested: { deep: true }, array: [1, 2, 3] },
  };

  const result = buildForensicSnapshot(input);

  assert.deepEqual(result.runtimeState, { nested: { deep: true }, array: [1, 2, 3] });
});

test("buildForensicSnapshot handles multiple configuration references", () => {
  const input: ForensicSnapshotInput = {
    snapshotId: "snap-configs",
    scope: "platform",
    collectedAt: "2026-04-24T00:00:00.000Z",
    artifactIds: [],
    configurationRefs: ["a", "b", "c", "d"],
  };

  const result = buildForensicSnapshot(input);

  assert.equal(result.configurationRefs.length, 4);
  assert.deepEqual(result.configurationRefs, ["a", "b", "c", "d"]);
});

test("buildForensicSnapshot handles multiple log references", () => {
  const input: ForensicSnapshotInput = {
    snapshotId: "snap-logs",
    scope: "platform",
    collectedAt: "2026-04-24T00:00:00.000Z",
    artifactIds: [],
    logRefs: ["log-a", "log-b"],
  };

  const result = buildForensicSnapshot(input);

  assert.equal(result.logRefs.length, 2);
});

test("summarizeForensicSnapshot formats correctly with all fields", () => {
  const snapshot: ForensicSnapshot = {
    snapshotId: "snap-123",
    scope: "platform",
    collectedAt: "2026-04-24T00:00:00.000Z",
    artifactIds: ["a1", "a2"],
    runtimeState: {},
    configurationRefs: ["c1"],
    logRefs: ["l1"],
  };

  const result = summarizeForensicSnapshot(snapshot);

  assert.ok(result.includes("scope=platform"));
  assert.ok(result.includes("artifacts=2"));
  assert.ok(result.includes("configs=1"));
  assert.ok(result.includes("logs=1"));
});

test("summarizeForensicSnapshot handles empty snapshot", () => {
  const snapshot: ForensicSnapshot = {
    snapshotId: "snap-empty",
    scope: "test",
    collectedAt: "2026-04-24T00:00:00.000Z",
    artifactIds: [],
    runtimeState: {},
    configurationRefs: [],
    logRefs: [],
  };

  const result = summarizeForensicSnapshot(snapshot);

  assert.ok(result.includes("scope=test"));
  assert.ok(result.includes("artifacts=0"));
  assert.ok(result.includes("configs=0"));
  assert.ok(result.includes("logs=0"));
});

test("summarizeForensicSnapshot shows correct counts", () => {
  const snapshot: ForensicSnapshot = {
    snapshotId: "snap-counts",
    scope: "division-a",
    collectedAt: "2026-04-24T00:00:00.000Z",
    artifactIds: ["a", "b", "c", "d", "e"],
    runtimeState: {},
    configurationRefs: ["c1", "c2"],
    logRefs: ["l1", "l2", "l3"],
  };

  const result = summarizeForensicSnapshot(snapshot);

  assert.ok(result.includes("artifacts=5"));
  assert.ok(result.includes("configs=2"));
  assert.ok(result.includes("logs=3"));
});

test("ForensicSnapshot interface fields are readonly", () => {
  const snapshot: ForensicSnapshot = {
    snapshotId: "snap-readonly",
    scope: "platform",
    collectedAt: "2026-04-24T00:00:00.000Z",
    artifactIds: ["art-1"],
    runtimeState: {},
    configurationRefs: [],
    logRefs: [],
  };

  assert.equal(snapshot.snapshotId, "snap-readonly");
  assert.equal(snapshot.scope, "platform");
});

test("buildForensicSnapshot handles runtimeState with string values", () => {
  const input: ForensicSnapshotInput = {
    snapshotId: "snap-strings",
    scope: "platform",
    collectedAt: "2026-04-24T00:00:00.000Z",
    artifactIds: [],
    runtimeState: { reason: "capacity_exceeded", actor: "system" },
  };

  const result = buildForensicSnapshot(input);

  assert.equal(result.runtimeState.reason, "capacity_exceeded");
  assert.equal(result.runtimeState.actor, "system");
});

test("buildForensicSnapshot handles runtimeState with number values", () => {
  const input: ForensicSnapshotInput = {
    snapshotId: "snap-nums",
    scope: "platform",
    collectedAt: "2026-04-24T00:00:00.000Z",
    artifactIds: [],
    runtimeState: { errorCount: 42, threshold: 10.5 },
  };

  const result = buildForensicSnapshot(input);

  assert.equal(result.runtimeState.errorCount, 42);
  assert.equal(result.runtimeState.threshold, 10.5);
});

test("buildForensicSnapshot handles runtimeState with boolean values", () => {
  const input: ForensicSnapshotInput = {
    snapshotId: "snap-bools",
    scope: "platform",
    collectedAt: "2026-04-24T00:00:00.000Z",
    artifactIds: [],
    runtimeState: { critical: true, autoResolved: false },
  };

  const result = buildForensicSnapshot(input);

  assert.equal(result.runtimeState.critical, true);
  assert.equal(result.runtimeState.autoResolved, false);
});

test("ForensicSnapshotInput interface structure", () => {
  const input: ForensicSnapshotInput = {
    snapshotId: "snap-input",
    scope: "test-scope",
    collectedAt: "2026-04-24T12:00:00.000Z",
    artifactIds: ["art-1"],
    runtimeState: { test: true },
    configurationRefs: ["cfg-1"],
    logRefs: ["log-1"],
  };

  assert.ok(input.snapshotId.length > 0);
  assert.ok(input.scope.length > 0);
  assert.ok(input.collectedAt.length > 0);
});

test("buildForensicSnapshot returns distinct copies", () => {
  const input: ForensicSnapshotInput = {
    snapshotId: "snap-distinct",
    scope: "platform",
    collectedAt: "2026-04-24T00:00:00.000Z",
    artifactIds: ["art-1"],
    runtimeState: { value: 1 },
    configurationRefs: ["cfg-1"],
    logRefs: ["log-1"],
  };

  const result1 = buildForensicSnapshot(input);
  const result2 = buildForensicSnapshot(input);

  assert.notEqual(result1, result2);
  assert.notEqual(result1.runtimeState, result2.runtimeState);
});

test("summarizeForensicSnapshot output format", () => {
  const snapshot: ForensicSnapshot = {
    snapshotId: "snap-format",
    scope: "my-scope",
    collectedAt: "2026-04-24T00:00:00.000Z",
    artifactIds: [],
    runtimeState: {},
    configurationRefs: [],
    logRefs: [],
  };

  const result = summarizeForensicSnapshot(snapshot);
  const parts = result.split(",");

  assert.equal(parts.length, 4);
  assert.ok(parts[0].startsWith("scope="));
  assert.ok(parts[1].startsWith("artifacts="));
  assert.ok(parts[2].startsWith("configs="));
  assert.ok(parts[3].startsWith("logs="));
});

test("ForensicSnapshot snapshotId is string", () => {
  const snapshot: ForensicSnapshot = {
    snapshotId: "snap-id-test",
    scope: "platform",
    collectedAt: "2026-04-24T00:00:00.000Z",
    artifactIds: [],
    runtimeState: {},
    configurationRefs: [],
    logRefs: [],
  };

  assert.equal(typeof snapshot.snapshotId, "string");
});

test("ForensicSnapshot collectedAt is ISO string", () => {
  const snapshot: ForensicSnapshot = {
    snapshotId: "snap-date-test",
    scope: "platform",
    collectedAt: "2026-04-24T00:00:00.000Z",
    artifactIds: [],
    runtimeState: {},
    configurationRefs: [],
    logRefs: [],
  };

  assert.ok(snapshot.collectedAt.endsWith("Z"));
  assert.doesNotThrow(() => new Date(snapshot.collectedAt));
});

test("ForensicSnapshot artifactIds is readonly array", () => {
  const snapshot: ForensicSnapshot = {
    snapshotId: "snap-artifacts",
    scope: "platform",
    collectedAt: "2026-04-24T00:00:00.000Z",
    artifactIds: ["a", "b"],
    runtimeState: {},
    configurationRefs: [],
    logRefs: [],
  };

  assert.ok(Array.isArray(snapshot.artifactIds));
  assert.equal(snapshot.artifactIds.length, 2);
});