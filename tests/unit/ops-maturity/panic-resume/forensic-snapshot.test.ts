import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildForensicSnapshot,
  summarizeForensicSnapshot,
  type ForensicSnapshotInput,
  type ForensicSnapshot,
  type PlaneForensicEvidence,
} from "../../../../src/ops-maturity/emergency/forensic-snapshot/index.js";

describe("forensic-snapshot", () => {
  describe("buildForensicSnapshot", () => {
    it("should build a forensic snapshot with all fields", () => {
      const input: ForensicSnapshotInput = {
        snapshotId: "snapshot-001",
        scope: "platform/us-east-1",
        collectedAt: "2026-05-21T10:00:00Z",
        artifactIds: ["artifact-1", "artifact-2"],
        runtimeState: { cpu: 0.8, memory: 0.6 },
        configurationRefs: ["config-1", "config-2"],
        logRefs: ["log-1", "log-2", "log-3"],
        planeAcknowledgments: [
          { plane: "P1", localStopState: "ack", evidenceRef: "p1-evidence" },
          { plane: "P2", localStopState: "ack", evidenceRef: "p2-evidence" },
        ],
      };

      const snapshot = buildForensicSnapshot(input);

      assert.strictEqual(snapshot.snapshotId, "snapshot-001");
      assert.strictEqual(snapshot.scope, "platform/us-east-1");
      assert.strictEqual(snapshot.collectedAt, "2026-05-21T10:00:00Z");
      assert.deepStrictEqual(snapshot.artifactIds, [
        "artifact-1",
        "artifact-2",
      ]);
      assert.deepStrictEqual(snapshot.runtimeState, { cpu: 0.8, memory: 0.6 });
      assert.deepStrictEqual(snapshot.configurationRefs, [
        "config-1",
        "config-2",
      ]);
      assert.deepStrictEqual(snapshot.logRefs, ["log-1", "log-2", "log-3"]);
      assert.strictEqual(snapshot.planeAcknowledgments.length, 2);
    });

    it("should build snapshot with empty arrays when not provided", () => {
      const input: ForensicSnapshotInput = {
        snapshotId: "snapshot-002",
        scope: "region/us-west-1",
        collectedAt: "2026-05-21T11:00:00Z",
        artifactIds: [],
      };

      const snapshot = buildForensicSnapshot(input);

      assert.deepStrictEqual(snapshot.artifactIds, []);
      assert.deepStrictEqual(snapshot.runtimeState, {});
      assert.deepStrictEqual(snapshot.configurationRefs, []);
      assert.deepStrictEqual(snapshot.logRefs, []);
      assert.deepStrictEqual(snapshot.planeAcknowledgments, []);
    });

    it("should clone runtimeState to avoid reference sharing", () => {
      const input: ForensicSnapshotInput = {
        snapshotId: "snapshot-003",
        scope: "tenant/test-tenant",
        collectedAt: "2026-05-21T12:00:00Z",
        artifactIds: [],
        runtimeState: { value: 42 },
      };

      const snapshot = buildForensicSnapshot(input);
      const original = input.runtimeState as Record<string, unknown>;

      original.value = 99;

      assert.strictEqual(snapshot.runtimeState.value, 42);
    });

    it("should copy arrays to avoid reference sharing", () => {
      const input: ForensicSnapshotInput = {
        snapshotId: "snapshot-004",
        scope: "domain/test-domain",
        collectedAt: "2026-05-21T13:00:00Z",
        artifactIds: ["original-artifact"],
        configurationRefs: ["original-config"],
      };

      const snapshot = buildForensicSnapshot(input);

      (input.artifactIds as string[]).push("modified-artifact");
      (input.configurationRefs as string[]).push("modified-config");

      assert.strictEqual(snapshot.artifactIds.length, 1);
      assert.strictEqual(snapshot.artifactIds[0], "original-artifact");
      assert.strictEqual(snapshot.configurationRefs.length, 1);
    });

    it("should handle planeAcknowledgments with all plane types", () => {
      const planeEvidence: PlaneForensicEvidence[] = [
        { plane: "P1", localStopState: "ack", evidenceRef: "p1" },
        { plane: "P2", localStopState: "failed", evidenceRef: "p2" },
        { plane: "P3", localStopState: "timeout", evidenceRef: "p3" },
        { plane: "P4", localStopState: "ack", evidenceRef: "p4" },
        { plane: "P5", localStopState: "ack", evidenceRef: "p5" },
      ];

      const input: ForensicSnapshotInput = {
        snapshotId: "snapshot-005",
        scope: "run/test-run",
        collectedAt: "2026-05-21T14:00:00Z",
        artifactIds: [],
        planeAcknowledgments: planeEvidence,
      };

      const snapshot = buildForensicSnapshot(input);

      assert.strictEqual(snapshot.planeAcknowledgments.length, 5);
      assert.strictEqual(snapshot.planeAcknowledgments[0].plane, "P1");
      assert.strictEqual(
        snapshot.planeAcknowledgments[1].localStopState,
        "failed",
      );
    });
  });

  describe("summarizeForensicSnapshot", () => {
    it("should summarize snapshot with all artifact types", () => {
      const snapshot: ForensicSnapshot = buildForensicSnapshot({
        snapshotId: "summary-001",
        scope: "platform/global",
        collectedAt: "2026-05-21T15:00:00Z",
        artifactIds: ["a1", "a2", "a3"],
        configurationRefs: ["c1", "c2"],
        logRefs: ["l1"],
        planeAcknowledgments: [
          { plane: "P1", localStopState: "ack", evidenceRef: "e1" },
          { plane: "P2", localStopState: "ack", evidenceRef: "e2" },
          { plane: "P3", localStopState: "ack", evidenceRef: "e3" },
        ],
      });

      const summary = summarizeForensicSnapshot(snapshot);

      assert.match(summary, /scope=platform\/global/);
      assert.match(summary, /artifacts=3/);
      assert.match(summary, /configs=2/);
      assert.match(summary, /logs=1/);
      assert.match(summary, /planes=3/);
    });

    it("should handle empty artifact arrays", () => {
      const snapshot: ForensicSnapshot = buildForensicSnapshot({
        snapshotId: "summary-002",
        scope: "region/ap-south-1",
        collectedAt: "2026-05-21T16:00:00Z",
        artifactIds: [],
        configurationRefs: [],
        logRefs: [],
        planeAcknowledgments: [],
      });

      const summary = summarizeForensicSnapshot(snapshot);

      assert.match(summary, /artifacts=0/);
      assert.match(summary, /configs=0/);
      assert.match(summary, /logs=0/);
      assert.match(summary, /planes=0/);
    });

    it("should handle non-array artifactIds (defensive)", () => {
      const snapshot = {
        snapshotId: "summary-003",
        scope: "tenant/demo",
        collectedAt: "2026-05-21T17:00:00Z",
        artifactIds: "not-an-array" as unknown as readonly string[],
        configurationRefs: [],
        logRefs: [],
        planeAcknowledgments: [],
      } as ForensicSnapshot;

      const summary = summarizeForensicSnapshot(snapshot);

      assert.match(summary, /artifacts=0/);
    });

    it("should handle non-array configurationRefs (defensive)", () => {
      const snapshot = {
        snapshotId: "summary-004",
        scope: "domain/production",
        collectedAt: "2026-05-21T18:00:00Z",
        artifactIds: [],
        configurationRefs: { length: 5 } as unknown as readonly string[],
        logRefs: [],
        planeAcknowledgments: [],
      } as ForensicSnapshot;

      const summary = summarizeForensicSnapshot(snapshot);

      assert.match(summary, /configs=0/);
    });

    it("should handle non-array logRefs (defensive)", () => {
      const snapshot = {
        snapshotId: "summary-005",
        scope: "node/worker-1",
        collectedAt: "2026-05-21T19:00:00Z",
        artifactIds: [],
        configurationRefs: [],
        logRefs: null as unknown as readonly string[],
        planeAcknowledgments: [],
      } as ForensicSnapshot;

      const summary = summarizeForensicSnapshot(snapshot);

      assert.match(summary, /logs=0/);
    });

    it("should handle non-array planeAcknowledgments (defensive)", () => {
      const snapshot = {
        snapshotId: "summary-006",
        scope: "run/execution-42",
        collectedAt: "2026-05-21T20:00:00Z",
        artifactIds: [],
        configurationRefs: [],
        logRefs: [],
        planeAcknowledgments: {
          length: 7,
        } as unknown as readonly PlaneForensicEvidence[],
      } as ForensicSnapshot;

      const summary = summarizeForensicSnapshot(snapshot);

      assert.match(summary, /planes=0/);
    });

    it("should format summary as comma-separated key=value pairs", () => {
      const snapshot = buildForensicSnapshot({
        snapshotId: "summary-007",
        scope: "platform/eu-west-1",
        collectedAt: "2026-05-21T21:00:00Z",
        artifactIds: ["art1"],
        configurationRefs: ["cfg1", "cfg2", "cfg3", "cfg4"],
        logRefs: ["log1", "log2"],
        planeAcknowledgments: [
          { plane: "P1", localStopState: "ack", evidenceRef: "e1" },
          { plane: "P2", localStopState: "ack", evidenceRef: "e2" },
        ],
      });

      const summary = summarizeForensicSnapshot(snapshot);
      const parts = summary.split(",");

      assert.strictEqual(parts.length, 5);
      assert.strictEqual(parts.filter((p) => p.startsWith("scope=")).length, 1);
      assert.strictEqual(
        parts.filter((p) => p.startsWith("artifacts=")).length,
        1,
      );
      assert.strictEqual(
        parts.filter((p) => p.startsWith("configs=")).length,
        1,
      );
      assert.strictEqual(parts.filter((p) => p.startsWith("logs=")).length, 1);
      assert.strictEqual(
        parts.filter((p) => p.startsWith("planes=")).length,
        1,
      );
    });
  });
});
