/**
 * Unit tests for ForensicSnapshot
 *
 * @see src/ops-maturity/emergency/forensic-snapshot/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildForensicSnapshot,
  summarizeForensicSnapshot,
  type ForensicSnapshotInput,
} from "../../../../../src/ops-maturity/emergency/forensic-snapshot/index.js";

test.describe("ForensicSnapshot", () => {
  test.describe("buildForensicSnapshot", () => {
    test("creates snapshot with all fields", () => {
      const input: ForensicSnapshotInput = {
        snapshotId: "snap-123",
        scope: "platform",
        collectedAt: "2026-04-22T10:00:00Z",
        artifactIds: ["artifact-1", "artifact-2"],
        runtimeState: { severity: "high" },
        configurationRefs: ["config-1"],
        logRefs: ["log-1"],
      };

      const result = buildForensicSnapshot(input);

      assert.equal(result.snapshotId, "snap-123");
      assert.equal(result.scope, "platform");
      assert.equal(result.collectedAt, "2026-04-22T10:00:00Z");
      assert.deepEqual(result.artifactIds, ["artifact-1", "artifact-2"]);
      assert.deepEqual(result.runtimeState, { severity: "high" });
      assert.deepEqual(result.configurationRefs, ["config-1"]);
      assert.deepEqual(result.logRefs, ["log-1"]);
    });

    test("applies default values for optional fields", () => {
      const input: ForensicSnapshotInput = {
        snapshotId: "snap-123",
        scope: "platform",
        collectedAt: "2026-04-22T10:00:00Z",
        artifactIds: [],
      };

      const result = buildForensicSnapshot(input);

      assert.deepEqual(result.runtimeState, {});
      assert.deepEqual(result.configurationRefs, []);
      assert.deepEqual(result.logRefs, []);
      assert.deepEqual(result.planeAcknowledgments, []);
    });

    test("handles empty artifactIds array", () => {
      const input: ForensicSnapshotInput = {
        snapshotId: "snap-123",
        scope: "platform",
        collectedAt: "2026-04-22T10:00:00Z",
        artifactIds: [],
      };

      const result = buildForensicSnapshot(input);

      assert.deepEqual(result.artifactIds, []);
    });

    test("preserves runtimeState when provided", () => {
      const input: ForensicSnapshotInput = {
        snapshotId: "snap-123",
        scope: "platform",
        collectedAt: "2026-04-22T10:00:00Z",
        artifactIds: [],
        runtimeState: { triggerSignals: ["signal-1", "signal-2"], severity: "critical" },
      };

      const result = buildForensicSnapshot(input);

      assert.deepEqual(result.runtimeState, { triggerSignals: ["signal-1", "signal-2"], severity: "critical" });
    });

    test("handles complex runtimeState with nested objects", () => {
      const input: ForensicSnapshotInput = {
        snapshotId: "snap-123",
        scope: "platform",
        collectedAt: "2026-04-22T10:00:00Z",
        artifactIds: [],
        runtimeState: { nested: { deep: { value: 42 } }, array: [1, 2, 3] },
      };

      const result = buildForensicSnapshot(input);

      assert.deepEqual(result.runtimeState, { nested: { deep: { value: 42 } }, array: [1, 2, 3] });
    });

    test("handles multiple configuration references", () => {
      const input: ForensicSnapshotInput = {
        snapshotId: "snap-123",
        scope: "platform",
        collectedAt: "2026-04-22T10:00:00Z",
        artifactIds: [],
        configurationRefs: ["config-a", "config-b", "config-c"],
      };

      const result = buildForensicSnapshot(input);

      assert.deepEqual(result.configurationRefs, ["config-a", "config-b", "config-c"]);
    });

    test("handles multiple log references", () => {
      const input: ForensicSnapshotInput = {
        snapshotId: "snap-123",
        scope: "platform",
        collectedAt: "2026-04-22T10:00:00Z",
        artifactIds: [],
        logRefs: ["log-1", "log-2"],
      };

      const result = buildForensicSnapshot(input);

      assert.deepEqual(result.logRefs, ["log-1", "log-2"]);
    });
  });

  test.describe("summarizeForensicSnapshot", () => {
    test("summarizes snapshot with all fields", () => {
      const snapshot = buildForensicSnapshot({
        snapshotId: "snap-123",
        scope: "platform",
        collectedAt: "2026-04-22T10:00:00Z",
        artifactIds: ["a1", "a2"],
        configurationRefs: ["c1"],
        logRefs: ["l1"],
      });

      const result = summarizeForensicSnapshot(snapshot);

      assert.equal(result, "scope=platform,artifacts=2,configs=1,logs=1,planes=0");
    });

    test("summarizes snapshot with empty arrays", () => {
      const snapshot = buildForensicSnapshot({
        snapshotId: "snap-123",
        scope: "platform",
        collectedAt: "2026-04-22T10:00:00Z",
        artifactIds: [],
      });

      const result = summarizeForensicSnapshot(snapshot);

      assert.equal(result, "scope=platform,artifacts=0,configs=0,logs=0,planes=0");
    });

    test("summarizes snapshot with many artifacts", () => {
      const snapshot = buildForensicSnapshot({
        snapshotId: "snap-123",
        scope: "division-a",
        collectedAt: "2026-04-22T10:00:00Z",
        artifactIds: ["a1", "a2", "a3", "a4", "a5"],
      });

      const result = summarizeForensicSnapshot(snapshot);

      assert.equal(result, "scope=division-a,artifacts=5,configs=0,logs=0,planes=0");
    });

    test("summarizes snapshot with only configs", () => {
      const snapshot = buildForensicSnapshot({
        snapshotId: "snap-123",
        scope: "platform",
        collectedAt: "2026-04-22T10:00:00Z",
        artifactIds: [],
        configurationRefs: ["c1", "c2", "c3"],
      });

      const result = summarizeForensicSnapshot(snapshot);

      assert.equal(result, "scope=platform,artifacts=0,configs=3,logs=0,planes=0");
    });

    test("summarizes snapshot with only logs", () => {
      const snapshot = buildForensicSnapshot({
        snapshotId: "snap-123",
        scope: "platform",
        collectedAt: "2026-04-22T10:00:00Z",
        artifactIds: [],
        logRefs: ["l1"],
      });

      const result = summarizeForensicSnapshot(snapshot);

      assert.equal(result, "scope=platform,artifacts=0,configs=0,logs=1,planes=0");
    });
  });
});
