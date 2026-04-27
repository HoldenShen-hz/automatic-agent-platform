/**
 * Unit tests for ForensicSnapshot
 *
 * @see src/ops-maturity/emergency/forensic-snapshot/index.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildForensicSnapshot,
  summarizeForensicSnapshot,
  type ForensicSnapshotInput,
} from "../../../../src/ops-maturity/emergency/forensic-snapshot/index.js";

describe("ForensicSnapshot", () => {
  describe("buildForensicSnapshot", () => {
    test("creates snapshot with required fields", () => {
      const input: ForensicSnapshotInput = {
        snapshotId: "snap-001",
        scope: "task-execution",
        collectedAt: "2026-04-26T10:00:00Z",
        artifactIds: ["artifact-1", "artifact-2"],
      };

      const result = buildForensicSnapshot(input);

      assert.equal(result.snapshotId, "snap-001");
      assert.equal(result.scope, "task-execution");
      assert.equal(result.collectedAt, "2026-04-26T10:00:00Z");
      assert.equal(result.artifactIds.length, 2);
      assert.deepEqual(result.runtimeState, {});
      assert.deepEqual(result.configurationRefs, []);
      assert.deepEqual(result.logRefs, []);
    });

    test("includes optional runtime state when provided", () => {
      const input: ForensicSnapshotInput = {
        snapshotId: "snap-002",
        scope: "agent-lifecycle",
        collectedAt: "2026-04-26T10:00:00Z",
        artifactIds: [],
        runtimeState: { status: "running", memoryUsage: 1024 },
      };

      const result = buildForensicSnapshot(input);

      assert.deepEqual(result.runtimeState, { status: "running", memoryUsage: 1024 });
    });

    test("includes optional configuration refs when provided", () => {
      const input: ForensicSnapshotInput = {
        snapshotId: "snap-003",
        scope: "deployment",
        collectedAt: "2026-04-26T10:00:00Z",
        artifactIds: [],
        configurationRefs: ["config-1", "config-2"],
      };

      const result = buildForensicSnapshot(input);

      assert.equal(result.configurationRefs.length, 2);
      assert.equal(result.configurationRefs[0], "config-1");
    });

    test("includes optional log refs when provided", () => {
      const input: ForensicSnapshotInput = {
        snapshotId: "snap-004",
        scope: "error-analysis",
        collectedAt: "2026-04-26T10:00:00Z",
        artifactIds: [],
        logRefs: ["log-1", "log-2", "log-3"],
      };

      const result = buildForensicSnapshot(input);

      assert.equal(result.logRefs.length, 3);
    });

    test("uses empty arrays for undefined optional fields", () => {
      const input: ForensicSnapshotInput = {
        snapshotId: "snap-005",
        scope: "minimal",
        collectedAt: "2026-04-26T10:00:00Z",
        artifactIds: [],
      };

      const result = buildForensicSnapshot(input);

      assert.deepEqual(result.runtimeState, {});
      assert.deepEqual(result.configurationRefs, []);
      assert.deepEqual(result.logRefs, []);
    });
  });

  describe("summarizeForensicSnapshot", () => {
    test("summarizes snapshot with all fields populated", () => {
      const snapshot = buildForensicSnapshot({
        snapshotId: "snap-001",
        scope: "task-execution",
        collectedAt: "2026-04-26T10:00:00Z",
        artifactIds: ["a1", "a2", "a3"],
        configurationRefs: ["c1", "c2"],
        logRefs: ["l1"],
      });

      const summary = summarizeForensicSnapshot(snapshot);

      assert.ok(summary.includes("scope=task-execution"));
      assert.ok(summary.includes("artifacts=3"));
      assert.ok(summary.includes("configs=2"));
      assert.ok(summary.includes("logs=1"));
    });

    test("summarizes snapshot with empty optional fields", () => {
      const snapshot = buildForensicSnapshot({
        snapshotId: "snap-002",
        scope: "minimal-scope",
        collectedAt: "2026-04-26T10:00:00Z",
        artifactIds: [],
      });

      const summary = summarizeForensicSnapshot(snapshot);

      assert.ok(summary.includes("scope=minimal-scope"));
      assert.ok(summary.includes("artifacts=0"));
      assert.ok(summary.includes("configs=0"));
      assert.ok(summary.includes("logs=0"));
    });

    test("produces comma-separated format", () => {
      const snapshot = buildForensicSnapshot({
        snapshotId: "snap-003",
        scope: "test",
        collectedAt: "2026-04-26T10:00:00Z",
        artifactIds: ["a1"],
        configurationRefs: ["c1"],
        logRefs: ["l1"],
      });

      const summary = summarizeForensicSnapshot(snapshot);

      assert.ok(summary.includes(","));
    });
  });
});