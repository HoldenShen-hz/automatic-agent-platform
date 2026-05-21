import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ResumeCompatibilityCheck,
  type ResumeSnapshotDescriptor,
  type ResumeCompatibilityOptions,
} from "../../../../src/platform/five-plane-execution/recovery/resume-compatibility-check.js";

describe("ResumeCompatibilityCheck", () => {
  const check = new ResumeCompatibilityCheck();

  const createSnapshot = (overrides: Partial<ResumeSnapshotDescriptor> = {}): ResumeSnapshotDescriptor => ({
    runId: "run-001",
    contractVersion: "1.0.0",
    runtimeVersion: "2.1.0",
    graphHash: "abc123",
    artifactLockHash: "lock789",
    ...overrides,
  });

  const createOptions = (overrides: Partial<ResumeCompatibilityOptions> = {}): ResumeCompatibilityOptions => ({
    timeoutMs: 60000,
    startedAtMs: 1000,
    nowMs: 5000,
    ...overrides,
  });

  describe("compare", () => {
    it("should return compatible when all fields match", () => {
      const before = createSnapshot();
      const after = createSnapshot();
      const options = createOptions();

      const report = check.compare(before, after, options);

      assert.strictEqual(report.compatible, true);
      assert.strictEqual(report.timedOut, false);
      assert.deepStrictEqual(report.differences, []);
    });

    it("should detect difference in runId", () => {
      const before = createSnapshot({ runId: "run-001" });
      const after = createSnapshot({ runId: "run-002" });
      const options = createOptions();

      const report = check.compare(before, after, options);

      assert.strictEqual(report.compatible, false);
      assert.strictEqual(report.timedOut, false);
      assert.strictEqual(report.differences.length, 1);
      assert.strictEqual(report.differences[0].field, "runId");
      assert.strictEqual(report.differences[0].before, "run-001");
      assert.strictEqual(report.differences[0].after, "run-002");
    });

    it("should detect difference in contractVersion", () => {
      const before = createSnapshot({ contractVersion: "1.0.0" });
      const after = createSnapshot({ contractVersion: "2.0.0" });
      const options = createOptions();

      const report = check.compare(before, after, options);

      assert.strictEqual(report.compatible, false);
      assert.strictEqual(report.differences[0].field, "contractVersion");
    });

    it("should detect difference in runtimeVersion", () => {
      const before = createSnapshot({ runtimeVersion: "1.0.0" });
      const after = createSnapshot({ runtimeVersion: "1.1.0" });
      const options = createOptions();

      const report = check.compare(before, after, options);

      assert.strictEqual(report.compatible, false);
      assert.strictEqual(report.differences[0].field, "runtimeVersion");
    });

    it("should detect difference in graphHash", () => {
      const before = createSnapshot({ graphHash: "old-hash" });
      const after = createSnapshot({ graphHash: "new-hash" });
      const options = createOptions();

      const report = check.compare(before, after, options);

      assert.strictEqual(report.compatible, false);
      assert.strictEqual(report.differences[0].field, "graphHash");
    });

    it("should detect difference in artifactLockHash", () => {
      const before = createSnapshot({ artifactLockHash: "lock-old" });
      const after = createSnapshot({ artifactLockHash: "lock-new" });
      const options = createOptions();

      const report = check.compare(before, after, options);

      assert.strictEqual(report.compatible, false);
      assert.strictEqual(report.differences[0].field, "artifactLockHash");
    });

    it("should detect multiple differences", () => {
      const before = createSnapshot({
        runId: "run-001",
        contractVersion: "1.0.0",
        runtimeVersion: "1.0.0",
      });
      const after = createSnapshot({
        runId: "run-002",
        contractVersion: "2.0.0",
        runtimeVersion: "2.0.0",
      });
      const options = createOptions();

      const report = check.compare(before, after, options);

      assert.strictEqual(report.compatible, false);
      assert.strictEqual(report.differences.length, 3);
    });

    it("should return timedOut true when timeout exceeded", () => {
      const before = createSnapshot();
      const after = createSnapshot();
      const options = createOptions({
        startedAtMs: 1000,
        nowMs: 1000 + 60000 + 1, // Just over timeoutMs
        timeoutMs: 60000,
      });

      const report = check.compare(before, after, options);

      assert.strictEqual(report.compatible, false);
      assert.strictEqual(report.timedOut, true);
      assert.deepStrictEqual(report.differences, []);
    });

    it("should return not timedOut when exactly at timeout boundary", () => {
      const before = createSnapshot();
      const after = createSnapshot();
      const options = createOptions({
        startedAtMs: 1000,
        nowMs: 1000 + 60000, // Exactly at timeout
        timeoutMs: 60000,
      });

      const report = check.compare(before, after, options);

      assert.strictEqual(report.timedOut, false);
    });

    it("should return timedOut false when timeout not exceeded", () => {
      const before = createSnapshot();
      const after = createSnapshot();
      const options = createOptions({
        startedAtMs: 1000,
        nowMs: 1000 + 30000, // Half of timeout
        timeoutMs: 60000,
      });

      const report = check.compare(before, after, options);

      assert.strictEqual(report.timedOut, false);
      assert.strictEqual(report.compatible, true);
    });

    it("should compare snapshots with different runIds as incompatible", () => {
      const before = createSnapshot();
      const after = createSnapshot({ runId: "different-run" });
      const options = createOptions();

      const report = check.compare(before, after, options);

      assert.strictEqual(report.compatible, false);
      assert.ok(report.differences.some((d) => d.field === "runId"));
    });

    it("should produce correct field labels in differences", () => {
      const before = createSnapshot({ graphHash: "hash-a" });
      const after = createSnapshot({ graphHash: "hash-b" });
      const options = createOptions();

      const report = check.compare(before, after, options);

      assert.strictEqual(report.differences[0].field, "graphHash");
      assert.strictEqual(report.differences[0].before, "hash-a");
      assert.strictEqual(report.differences[0].after, "hash-b");
    });

    it("should handle zero timeout", () => {
      const before = createSnapshot();
      const after = createSnapshot();
      const options = createOptions({ timeoutMs: 0, startedAtMs: 1000, nowMs: 1001 });

      const report = check.compare(before, after, options);

      assert.strictEqual(report.timedOut, true);
    });

    it("should handle very large timeout", () => {
      const before = createSnapshot();
      const after = createSnapshot({ runtimeVersion: "changed" });
      const options = createOptions({
        timeoutMs: Number.MAX_SAFE_INTEGER,
        startedAtMs: 1000,
        nowMs: 2000,
      });

      const report = check.compare(before, after, options);

      assert.strictEqual(report.timedOut, false);
      assert.strictEqual(report.compatible, false);
    });

    it("should preserve difference order", () => {
      const before = createSnapshot({
        runId: "r1",
        contractVersion: "c1",
        runtimeVersion: "rt1",
        graphHash: "g1",
        artifactLockHash: "a1",
      });
      const after = createSnapshot({
        runId: "r2",
        contractVersion: "c2",
        runtimeVersion: "rt2",
        graphHash: "g2",
        artifactLockHash: "a2",
      });
      const options = createOptions();

      const report = check.compare(before, after, options);

      assert.strictEqual(report.differences.length, 5);
      assert.strictEqual(report.differences[0].field, "runId");
      assert.strictEqual(report.differences[1].field, "contractVersion");
      assert.strictEqual(report.differences[2].field, "runtimeVersion");
      assert.strictEqual(report.differences[3].field, "graphHash");
      assert.strictEqual(report.differences[4].field, "artifactLockHash");
    });

    it("should return timedOut first in report structure", () => {
      const before = createSnapshot();
      const after = createSnapshot({ runtimeVersion: "changed" });
      const options = createOptions({
        timeoutMs: 1,
        startedAtMs: 0,
        nowMs: 100,
      });

      const report = check.compare(before, after, options);

      assert.strictEqual(report.timedOut, true);
      assert.strictEqual(report.compatible, false);
    });
  });
});