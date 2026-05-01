import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import {
  ResumeCompatibilityCheck,
  type ResumeSnapshotDescriptor,
  type ResumeCompatibilityOptions,
  type ResumeDiffReport,
} from "../../../../../src/platform/execution/recovery/resume-compatibility-check.js";

describe("ResumeCompatibilityCheck", () => {
  const check = new ResumeCompatibilityCheck();

  function createDescriptor(overrides: Partial<ResumeSnapshotDescriptor> = {}): ResumeSnapshotDescriptor {
    return {
      runId: "run-001",
      contractVersion: "1.0.0",
      runtimeVersion: "2.1.0",
      graphHash: "abc123",
      artifactLockHash: "lock-xyz",
      ...overrides,
    };
  }

  function createOptions(overrides: Partial<ResumeCompatibilityOptions> = {}): ResumeCompatibilityOptions {
    return {
      timeoutMs: 5000,
      startedAtMs: 1000,
      nowMs: 2000,
      ...overrides,
    };
  }

  describe("compare", () => {
    it("should return compatible when all fields match", () => {
      const before = createDescriptor();
      const after = createDescriptor();
      const options = createOptions();

      const report = check.compare(before, after, options);

      assert.deepStrictEqual(report, {
        compatible: true,
        timedOut: false,
        differences: [],
      });
    });

    it("should detect difference in runId", () => {
      const before = createDescriptor({ runId: "run-001" });
      const after = createDescriptor({ runId: "run-002" });
      const options = createOptions();

      const report = check.compare(before, after, options);

      assert.strictEqual(report.compatible, false);
      assert.strictEqual(report.timedOut, false);
      assert.deepStrictEqual(report.differences, [
        { field: "runId", before: "run-001", after: "run-002" },
      ]);
    });

    it("should detect difference in contractVersion", () => {
      const before = createDescriptor({ contractVersion: "1.0.0" });
      const after = createDescriptor({ contractVersion: "2.0.0" });
      const options = createOptions();

      const report = check.compare(before, after, options);

      assert.strictEqual(report.compatible, false);
      assert.deepStrictEqual(report.differences, [
        { field: "contractVersion", before: "1.0.0", after: "2.0.0" },
      ]);
    });

    it("should detect difference in runtimeVersion", () => {
      const before = createDescriptor({ runtimeVersion: "2.1.0" });
      const after = createDescriptor({ runtimeVersion: "2.2.0" });
      const options = createOptions();

      const report = check.compare(before, after, options);

      assert.strictEqual(report.compatible, false);
      assert.deepStrictEqual(report.differences, [
        { field: "runtimeVersion", before: "2.1.0", after: "2.2.0" },
      ]);
    });

    it("should detect difference in graphHash", () => {
      const before = createDescriptor({ graphHash: "abc123" });
      const after = createDescriptor({ graphHash: "def456" });
      const options = createOptions();

      const report = check.compare(before, after, options);

      assert.strictEqual(report.compatible, false);
      assert.deepStrictEqual(report.differences, [
        { field: "graphHash", before: "abc123", after: "def456" },
      ]);
    });

    it("should detect difference in artifactLockHash", () => {
      const before = createDescriptor({ artifactLockHash: "lock-xyz" });
      const after = createDescriptor({ artifactLockHash: "lock-abc" });
      const options = createOptions();

      const report = check.compare(before, after, options);

      assert.strictEqual(report.compatible, false);
      assert.deepStrictEqual(report.differences, [
        { field: "artifactLockHash", before: "lock-xyz", after: "lock-abc" },
      ]);
    });

    it("should detect multiple differences", () => {
      const before = createDescriptor({
        runId: "run-001",
        contractVersion: "1.0.0",
        runtimeVersion: "2.1.0",
      });
      const after = createDescriptor({
        runId: "run-002",
        contractVersion: "2.0.0",
        runtimeVersion: "2.2.0",
      });
      const options = createOptions();

      const report = check.compare(before, after, options);

      assert.strictEqual(report.compatible, false);
      assert.strictEqual(report.differences.length, 3);
      assert.deepStrictEqual(report.differences, [
        { field: "runId", before: "run-001", after: "run-002" },
        { field: "contractVersion", before: "1.0.0", after: "2.0.0" },
        { field: "runtimeVersion", before: "2.1.0", after: "2.2.0" },
      ]);
    });

    it("should return timed out when nowMs - startedAtMs exceeds timeoutMs", () => {
      const before = createDescriptor();
      const after = createDescriptor();
      const options = createOptions({
        startedAtMs: 1000,
        nowMs: 7000,
        timeoutMs: 5000,
      });

      const report = check.compare(before, after, options);

      assert.strictEqual(report.compatible, false);
      assert.strictEqual(report.timedOut, true);
      assert.deepStrictEqual(report.differences, []);
    });

    it("should handle boundary case where nowMs - startedAtMs equals timeoutMs", () => {
      const before = createDescriptor();
      const after = createDescriptor();
      const options = createOptions({
        startedAtMs: 1000,
        nowMs: 6000,
        timeoutMs: 5000,
      });

      // Note: implementation uses strict >, so this case does NOT timeout
      const report = check.compare(before, after, options);

      assert.strictEqual(report.compatible, true);
      assert.strictEqual(report.timedOut, false);
    });

    it("should handle when nowMs - startedAtMs is just under timeoutMs", () => {
      const before = createDescriptor();
      const after = createDescriptor();
      const options = createOptions({
        startedAtMs: 1000,
        nowMs: 5999,
        timeoutMs: 5000,
      });

      const report = check.compare(before, after, options);

      assert.strictEqual(report.compatible, true);
      assert.strictEqual(report.timedOut, false);
    });

    it("should handle zero timeout", () => {
      const before = createDescriptor();
      const after = createDescriptor();
      const options = createOptions({
        timeoutMs: 0,
        startedAtMs: 1000,
        nowMs: 1001,
      });

      const report = check.compare(before, after, options);

      assert.strictEqual(report.compatible, false);
      assert.strictEqual(report.timedOut, true);
    });

    it("should detect all fields different simultaneously", () => {
      const before = createDescriptor({
        runId: "run-old",
        contractVersion: "1.0.0",
        runtimeVersion: "2.0.0",
        graphHash: "hash-old",
        artifactLockHash: "lock-old",
      });
      const after = createDescriptor({
        runId: "run-new",
        contractVersion: "2.0.0",
        runtimeVersion: "3.0.0",
        graphHash: "hash-new",
        artifactLockHash: "lock-new",
      });
      const options = createOptions();

      const report = check.compare(before, after, options);

      assert.strictEqual(report.compatible, false);
      assert.strictEqual(report.timedOut, false);
      assert.strictEqual(report.differences.length, 5);
    });
  });
});
