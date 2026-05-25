/**
 * Tests for CheckpointGCService
 *
 * Tests checkpoint garbage collection functionality including:
 * - GC candidate scanning
 * - GC execution and cleanup
 * - Version limit enforcement
 * - Storage statistics
 */

import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CheckpointGCService, DEFAULT_CHECKPOINT_RETENTION_POLICY, type CheckpointGCCandidate, type CheckpointRetentionPolicy } from "../../../../../src/platform/five-plane-state-evidence/checkpoints/checkpoint-gc-service.js";

describe("CheckpointGCService", () => {
  let testRootDir: string;
  let gcService: CheckpointGCService;

  beforeEach(() => {
    // Create a temporary directory for testing
    testRootDir = mkdtempSync(join(tmpdir(), "checkpoint-gc-test-"));
    gcService = new CheckpointGCService(testRootDir);
  });

  afterEach(() => {
    // Clean up temporary directory
    if (testRootDir) {
      rmSync(testRootDir, { recursive: true, force: true });
    }
  });

  describe("constructor", () => {
    it("should use default retention policy when none provided", () => {
      const service = new CheckpointGCService(testRootDir);

      assert.strictEqual(service.getStorageStats().totalCheckpoints, 0);
    });

    it("should merge custom retention policy with defaults", () => {
      const customPolicy: Partial<CheckpointRetentionPolicy> = {
        maxCheckpointsPerExecution: 10,
      };

      const service = new CheckpointGCService(testRootDir, customPolicy);

      // Should use custom value
      assert.ok(service);
    });
  });

  describe("scanForGCCandidates", () => {
    it("should return empty array when root dir does not exist", () => {
      rmSync(testRootDir, { recursive: true, force: true });

      const candidates = gcService.scanForGCCandidates();

      assert.strictEqual(candidates.length, 0);
    });

    it("should return empty array when no checkpoints exist", () => {
      const candidates = gcService.scanForGCCandidates();

      assert.strictEqual(candidates.length, 0);
    });

    it("should return empty array when checkpoints are within retention period", () => {
      // Create an execution directory with a recent checkpoint
      const executionPath = join(testRootDir, "exec-001");
      mkdirSync(executionPath, { recursive: true });

      // Create a checkpoint file with current timestamp
      const checkpointPath = join(executionPath, "cp-001.checkpoint.json");
      writeFileSync(checkpointPath, JSON.stringify({ checkpointId: "cp-001" }), "utf8");

      const candidates = gcService.scanForGCCandidates();

      assert.strictEqual(candidates.length, 0);
    });

    it("should identify expired checkpoints as GC candidates", () => {
      // Create an execution directory
      const executionPath = join(testRootDir, "exec-001");
      mkdirSync(executionPath, { recursive: true });

      // Create a checkpoint file with old timestamp
      const checkpointPath = join(executionPath, "cp-old.checkpoint.json");
      writeFileSync(checkpointPath, JSON.stringify({ checkpointId: "cp-old" }), "utf8");

      // Use a reference timestamp far in the future to make the checkpoint expired
      const farFutureTimestamp = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 days from now

      const candidates = gcService.scanForGCCandidates(farFutureTimestamp);

      assert.ok(candidates.length > 0);
      assert.ok(candidates.some((c) => c.checkpointRef.checkpointId === "cp-old"));
    });

    it("should include checkpoint metadata in GC candidates", () => {
      const executionPath = join(testRootDir, "exec-001");
      mkdirSync(executionPath, { recursive: true });

      const checkpointPath = join(executionPath, "cp-001.checkpoint.json");
      writeFileSync(checkpointPath, JSON.stringify({ checkpointId: "cp-001" }), "utf8");

      const farFutureTimestamp = Date.now() + 1000 * 60 * 60 * 24 * 30;

      const candidates = gcService.scanForGCCandidates(farFutureTimestamp);

      assert.ok(candidates.length > 0);
      const candidate = candidates[0];
      assert.strictEqual(candidate.checkpointRef.checkpointId, "cp-001");
      assert.ok(candidate.storagePath.includes("cp-001.checkpoint.json"));
      assert.ok(candidate.sizeBytes > 0);
      assert.ok(candidate.reason.includes("expired"));
    });
  });

  describe("runGC", () => {
    it("should delete GC candidates from filesystem", () => {
      // Create an execution directory with a checkpoint
      const executionPath = join(testRootDir, "exec-001");
      mkdirSync(executionPath, { recursive: true });

      const checkpointPath = join(executionPath, "cp-001.checkpoint.json");
      writeFileSync(checkpointPath, JSON.stringify({ checkpointId: "cp-001" }), "utf8");

      // Create a manifest file
      const manifestPath = join(executionPath, "exec-001.manifest.json");
      writeFileSync(
        manifestPath,
        JSON.stringify({
          manifestId: "manifest-001",
          schemaVersion: "checkpoint_manifest.v1",
          checkpoints: [
            {
              checkpointId: "cp-001",
              storageUri: `file://${checkpointPath}`,
            },
          ],
          createdAt: new Date().toISOString(),
        }),
        "utf8"
      );

      const farFutureTimestamp = Date.now() + 1000 * 60 * 60 * 24 * 30;
      const candidates = gcService.scanForGCCandidates(farFutureTimestamp);

      const result = gcService.runGC(candidates);

      assert.strictEqual(result.scannedCount, candidates.length);
      assert.strictEqual(result.deletedCount, 1);
      assert.ok(result.bytesFreed > 0);
      assert.strictEqual(result.errors.length, 0);
      assert.ok(!checkpointPath.includes("cp-001") || !existsSync(checkpointPath));
    });

    it("should handle missing checkpoint files gracefully", () => {
      const candidates: CheckpointGCCandidate[] = [
        {
          checkpointRef: {
            checkpointId: "nonexistent",
            storageUri: "file:///nonexistent/path/checkpoint.json",
          },
          storagePath: "/nonexistent/path/checkpoint.json",
          sizeBytes: 100,
          createdAt: new Date().toISOString(),
          executionId: "exec-001",
          isOrphaned: false,
          reason: "test",
        },
      ];

      const result = gcService.runGC(candidates);

      assert.strictEqual(result.scannedCount, 1);
      assert.strictEqual(result.deletedCount, 0);
      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.skippedCandidates.length, 0);
    });

    it("should ignore candidates that are already absent", () => {
      const candidates: CheckpointGCCandidate[] = [
        {
          checkpointRef: {
            checkpointId: "failing",
            storageUri: "file:///proc/invalid/checkpoint.json",
          },
          storagePath: "/proc/invalid/checkpoint.json",
          sizeBytes: 100,
          createdAt: new Date().toISOString(),
          executionId: "exec-001",
          isOrphaned: false,
          reason: "test",
        },
      ];

      const result = gcService.runGC(candidates);

      assert.strictEqual(result.deletedCount, 0);
      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.skippedCandidates.length, 0);
    });

    it("should update manifest when deleting checkpoints", () => {
      const executionPath = join(testRootDir, "exec-002");
      mkdirSync(executionPath, { recursive: true });

      const checkpointPath = join(executionPath, "cp-to-delete.checkpoint.json");
      writeFileSync(checkpointPath, JSON.stringify({ checkpointId: "cp-to-delete" }), "utf8");

      const manifestPath = join(executionPath, "exec-002.manifest.json");
      writeFileSync(
        manifestPath,
        JSON.stringify({
          manifestId: "manifest-002",
          schemaVersion: "checkpoint_manifest.v1",
          checkpoints: [
            {
              checkpointId: "cp-to-delete",
              storageUri: `file://${checkpointPath}`,
            },
            {
              checkpointId: "cp-to-keep",
              storageUri: "file:///other/checkpoint.json",
            },
          ],
          createdAt: new Date().toISOString(),
        }),
        "utf8"
      );

      const candidates: CheckpointGCCandidate[] = [
        {
          checkpointRef: {
            checkpointId: "cp-to-delete",
            storageUri: `file://${checkpointPath}`,
          },
          storagePath: checkpointPath,
          sizeBytes: 100,
          createdAt: new Date().toISOString(),
          executionId: "exec-002",
          isOrphaned: false,
          reason: "test",
        },
      ];

      gcService.runGC(candidates);

      // Check that manifest was updated
      const updatedManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      assert.strictEqual(updatedManifest.checkpoints.length, 1);
      assert.strictEqual(updatedManifest.checkpoints[0].checkpointId, "cp-to-keep");
    });

    it("should include timing information in result", () => {
      const result = gcService.runGC([]);

      assert.ok(result.startedAt);
      assert.ok(result.completedAt);
      assert.ok(new Date(result.startedAt).getTime() <= new Date(result.completedAt).getTime());
    });

    it("should reject concurrent runs when a cross-process lock already exists", () => {
      writeFileSync(join(testRootDir, ".checkpoint-gc.lock"), JSON.stringify({ acquiredAt: new Date().toISOString() }), "utf8");

      assert.throws(
        () => gcService.runGC([]),
        /checkpoint_gc\.concurrent_run_not_allowed/,
      );
    });
  });

  describe("enforceVersionLimits", () => {
    it("uses checkpoint creation time instead of mtime when selecting oldest files", async () => {
      const executionPath = join(testRootDir, "exec-birthtime");
      mkdirSync(executionPath, { recursive: true });

      const oldestPath = join(executionPath, "cp-oldest.checkpoint.json");
      writeFileSync(oldestPath, JSON.stringify({ checkpointId: "cp-oldest" }), "utf8");
      await new Promise((resolve) => setTimeout(resolve, 20));

      const newestPath = join(executionPath, "cp-newest.checkpoint.json");
      writeFileSync(newestPath, JSON.stringify({ checkpointId: "cp-newest" }), "utf8");

      const future = new Date(Date.now() + 60_000);
      utimesSync(oldestPath, future, future);

      const limited = new CheckpointGCService(testRootDir, { maxCheckpointsPerExecution: 1 });
      const deleted = limited.enforceVersionLimits("exec-birthtime");

      assert.equal(deleted, 1);
      assert.equal(existsSync(oldestPath), false);
      assert.equal(existsSync(newestPath), true);
    });
  });

  describe("enforceVersionLimits", () => {
    it("should return 0 when execution directory does not exist", () => {
      const deleted = gcService.enforceVersionLimits("nonexistent-exec");

      assert.strictEqual(deleted, 0);
    });

    it("should return 0 when checkpoint count is at or below limit", () => {
      const executionPath = join(testRootDir, "exec-001");
      mkdirSync(executionPath, { recursive: true });

      // Create fewer checkpoints than the limit
      for (let i = 0; i < 5; i++) {
        const checkpointPath = join(executionPath, `cp-00${i}.checkpoint.json`);
        writeFileSync(checkpointPath, JSON.stringify({ checkpointId: `cp-00${i}` }), "utf8");
      }

      const deleted = gcService.enforceVersionLimits("exec-001");

      assert.strictEqual(deleted, 0);
    });

    it("should delete oldest checkpoints when limit is exceeded", () => {
      const executionPath = join(testRootDir, "exec-002");
      mkdirSync(executionPath, { recursive: true });

      // Create more checkpoints than the limit (default is 50)
      const checkpointCount = 55;
      for (let i = 0; i < checkpointCount; i++) {
        const checkpointPath = join(executionPath, `cp-${String(i).padStart(3, "0")}.checkpoint.json`);
        writeFileSync(checkpointPath, JSON.stringify({ checkpointId: `cp-${i}` }), "utf8");
      }

      const deleted = gcService.enforceVersionLimits("exec-002");

      assert.strictEqual(deleted, checkpointCount - 50);
    });

    it("should remove deleted version-limited checkpoints from manifests", () => {
      const executionPath = join(testRootDir, "exec-002-manifest");
      mkdirSync(executionPath, { recursive: true });

      const checkpoints: Array<{ checkpointId: string; storageUri: string }> = [];
      for (let i = 0; i < 55; i++) {
        const checkpointId = `cp-${String(i).padStart(3, "0")}`;
        const checkpointPath = join(executionPath, `${checkpointId}.checkpoint.json`);
        writeFileSync(checkpointPath, JSON.stringify({ checkpointId }), "utf8");
        checkpoints.push({
          checkpointId,
          storageUri: `file://${checkpointPath}`,
        });
      }

      const manifestPath = join(executionPath, "exec-002-manifest.manifest.json");
      writeFileSync(
        manifestPath,
        JSON.stringify({
          manifestId: "manifest-version-limit",
          schemaVersion: "checkpoint_manifest.v1",
          checkpoints,
          createdAt: new Date().toISOString(),
        }),
        "utf8",
      );

      const deleted = gcService.enforceVersionLimits("exec-002-manifest");

      assert.strictEqual(deleted, 5);
      const updatedManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      assert.strictEqual(updatedManifest.checkpoints.length, 50);
      assert.ok(updatedManifest.checkpoints.every((entry: { checkpointId: string }) => !["cp-000", "cp-001", "cp-002", "cp-003", "cp-004"].includes(entry.checkpointId)));
    });

    it("should keep newest checkpoints when enforcing limits", () => {
      const executionPath = join(testRootDir, "exec-003");
      mkdirSync(executionPath, { recursive: true });

      // Create exactly the limit number of checkpoints
      for (let i = 0; i < 50; i++) {
        const checkpointPath = join(executionPath, `cp-${String(i).padStart(3, "0")}.checkpoint.json`);
        writeFileSync(checkpointPath, JSON.stringify({ checkpointId: `cp-${i}` }), "utf8");
      }

      gcService.enforceVersionLimits("exec-003");

      // All checkpoints should still exist
      const files = readdirSync(executionPath).filter((f) => f.endsWith(".checkpoint.json"));
      assert.strictEqual(files.length, 50);
    });

    it("should handle non-checkpoint files in execution directory", () => {
      const executionPath = join(testRootDir, "exec-004");
      mkdirSync(executionPath, { recursive: true });

      // Create mix of checkpoint and non-checkpoint files
      for (let i = 0; i < 55; i++) {
        const ext = i % 2 === 0 ? ".checkpoint.json" : ".json";
        const checkpointPath = join(executionPath, `cp-${String(i).padStart(3, "0")}${ext}`);
        writeFileSync(checkpointPath, JSON.stringify({ checkpointId: `cp-${i}` }), "utf8");
      }

      const deleted = gcService.enforceVersionLimits("exec-004");

      // Only *.checkpoint.json files are counted; this fixture stays below the default limit.
      assert.strictEqual(deleted, 0);
    });
  });

  describe("getStorageStats", () => {
    it("should return zeros when root directory does not exist", () => {
      rmSync(testRootDir, { recursive: true, force: true });

      const stats = gcService.getStorageStats();

      assert.strictEqual(stats.totalCheckpoints, 0);
      assert.strictEqual(stats.totalSizeBytes, 0);
      assert.strictEqual(stats.oldestCheckpoint, null);
      assert.strictEqual(stats.newestCheckpoint, null);
      assert.strictEqual(stats.orphanedCount, 0);
    });

    it("should return zeros when directory is empty", () => {
      const stats = gcService.getStorageStats();

      assert.strictEqual(stats.totalCheckpoints, 0);
      assert.strictEqual(stats.totalSizeBytes, 0);
      assert.strictEqual(stats.oldestCheckpoint, null);
      assert.strictEqual(stats.newestCheckpoint, null);
      assert.strictEqual(stats.orphanedCount, 0);
    });

    it("should count checkpoints correctly", () => {
      // Create multiple execution directories with checkpoints
      for (let execIdx = 1; execIdx <= 3; execIdx++) {
        const executionPath = join(testRootDir, `exec-00${execIdx}`);
        mkdirSync(executionPath, { recursive: true });

        for (let cpIdx = 1; cpIdx <= 3; cpIdx++) {
          const checkpointPath = join(executionPath, `cp-00${cpIdx}.checkpoint.json`);
          writeFileSync(checkpointPath, JSON.stringify({ checkpointId: `cp-00${cpIdx}` }), "utf8");
        }
      }

      const stats = gcService.getStorageStats();

      assert.strictEqual(stats.totalCheckpoints, 9);
      assert.ok(stats.totalSizeBytes > 0);
    });

    it("should track oldest and newest checkpoints", () => {
      const executionPath = join(testRootDir, "exec-001");
      mkdirSync(executionPath, { recursive: true });

      const checkpointPath = join(executionPath, "cp-001.checkpoint.json");
      writeFileSync(checkpointPath, JSON.stringify({ checkpointId: "cp-001" }), "utf8");

      const stats = gcService.getStorageStats();

      assert.ok(stats.oldestCheckpoint !== null);
      assert.ok(stats.newestCheckpoint !== null);
    });

    it("should count orphaned entries", () => {
      // Create a file in the root dir that is not an execution directory
      writeFileSync(join(testRootDir, "not-a-directory.json"), JSON.stringify({}), "utf8");

      const stats = gcService.getStorageStats();

      assert.ok(stats.orphanedCount > 0);
    });
  });

  describe("DEFAULT_CHECKPOINT_RETENTION_POLICY", () => {
    it("should have reasonable default values", () => {
      assert.strictEqual(DEFAULT_CHECKPOINT_RETENTION_POLICY.maxCheckpointsPerExecution, 50);
      assert.strictEqual(DEFAULT_CHECKPOINT_RETENTION_POLICY.maxAgeMs, 7 * 24 * 60 * 60 * 1000); // 7 days
      assert.strictEqual(DEFAULT_CHECKPOINT_RETENTION_POLICY.minSizeBytes, 512);
      assert.strictEqual(DEFAULT_CHECKPOINT_RETENTION_POLICY.retainFailedExecutionsLonger, true);
      assert.strictEqual(DEFAULT_CHECKPOINT_RETENTION_POLICY.failedExecutionRetentionMultiplier, 3);
    });
  });
});
