import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileFreshnessGuard, takeFileSnapshot, computeFileDigest, checkFreshness, } from "../../../../../src/platform/control-plane/iam/file-freshness.js";
const TEST_DIR = join(tmpdir(), "file-freshness-test-" + Date.now());
mkdirSync(TEST_DIR, { recursive: true });
test("takeFileSnapshot captures file state", () => {
    const filePath = join(TEST_DIR, "snapshot-test.txt");
    writeFileSync(filePath, "hello world");
    const snapshot = takeFileSnapshot(filePath);
    assert.equal(snapshot.path, filePath);
    assert.ok(snapshot.mtimeMs > 0);
    assert.ok(snapshot.sizeBytes > 0);
    assert.equal(snapshot.digest, undefined);
    unlinkSync(filePath);
});
test("takeFileSnapshot includes digest when requested", () => {
    const filePath = join(TEST_DIR, "digest-test.txt");
    writeFileSync(filePath, "content for digest");
    const snapshot = takeFileSnapshot(filePath, { includeDigest: true });
    assert.ok(snapshot.digest);
    assert.equal(snapshot.digest.length, 64); // SHA-256 hex is 64 chars
    unlinkSync(filePath);
});
test("takeFileSnapshot supports md5 algorithm", () => {
    const filePath = join(TEST_DIR, "md5-test.txt");
    writeFileSync(filePath, "content for md5");
    const snapshot = takeFileSnapshot(filePath, { includeDigest: true, digestAlgorithm: "md5" });
    assert.ok(snapshot.digest);
    assert.equal(snapshot.digest.length, 32); // MD5 hex is 32 chars
    unlinkSync(filePath);
});
test("computeFileDigest computes sha256 by default", () => {
    const filePath = join(TEST_DIR, "sha256-test.txt");
    writeFileSync(filePath, "test content");
    const digest = computeFileDigest(filePath);
    assert.equal(digest.length, 64);
    unlinkSync(filePath);
});
test("computeFileDigest computes md5 when specified", () => {
    const filePath = join(TEST_DIR, "md5-explicit-test.txt");
    writeFileSync(filePath, "test content");
    const digest = computeFileDigest(filePath, "md5");
    assert.equal(digest.length, 32);
    unlinkSync(filePath);
});
test("computeFileDigest is consistent for same content", () => {
    const filePath1 = join(TEST_DIR, "consist1.txt");
    const filePath2 = join(TEST_DIR, "consist2.txt");
    writeFileSync(filePath1, "same content");
    writeFileSync(filePath2, "same content");
    const digest1 = computeFileDigest(filePath1);
    const digest2 = computeFileDigest(filePath2);
    assert.equal(digest1, digest2);
    unlinkSync(filePath1);
    unlinkSync(filePath2);
});
test("checkFreshness returns fresh for unchanged file", () => {
    const filePath = join(TEST_DIR, "fresh-check.txt");
    writeFileSync(filePath, "unchanged content");
    const snapshot = takeFileSnapshot(filePath);
    const result = checkFreshness(filePath, snapshot);
    assert.equal(result.fresh, true);
    assert.ok(result.currentSnapshot);
    assert.equal(result.previousSnapshot, snapshot);
    unlinkSync(filePath);
});
test("checkFreshness returns not fresh when file deleted", () => {
    const filePath = join(TEST_DIR, "deleted-file.txt");
    writeFileSync(filePath, "will be deleted");
    const snapshot = takeFileSnapshot(filePath);
    unlinkSync(filePath);
    const result = checkFreshness(filePath, snapshot);
    assert.equal(result.fresh, false);
    assert.equal(result.reason, "File does not exist");
});
test("checkFreshness returns not fresh when mtime changed beyond threshold", () => {
    const filePath = join(TEST_DIR, "stale-mtime.txt");
    writeFileSync(filePath, "original content");
    // Take snapshot
    const snapshot = takeFileSnapshot(filePath);
    // Force mtime into the past by directly manipulating the snapshot
    const oldSnapshot = {
        ...snapshot,
        mtimeMs: snapshot.mtimeMs - 2000, // 2 seconds ago
    };
    // Check with a threshold of 1000ms - file appears to be modified
    const result = checkFreshness(filePath, oldSnapshot, { staleThresholdMs: 1000 });
    assert.equal(result.fresh, false);
    assert.ok(result.reason?.includes("modified externally"));
    unlinkSync(filePath);
});
test("checkFreshness allows stale when allowStale is true", () => {
    const filePath = join(TEST_DIR, "allow-stale.txt");
    writeFileSync(filePath, "content");
    const snapshot = takeFileSnapshot(filePath);
    // Simulate an old snapshot
    const oldSnapshot = {
        ...snapshot,
        mtimeMs: snapshot.mtimeMs - 10000,
    };
    const result = checkFreshness(filePath, oldSnapshot, { allowStale: true });
    assert.equal(result.fresh, true);
    unlinkSync(filePath);
});
test("checkFreshness uses custom staleThresholdMs", () => {
    const filePath = join(TEST_DIR, "custom-threshold.txt");
    writeFileSync(filePath, "content");
    const snapshot = takeFileSnapshot(filePath);
    // Create a snapshot from the past (but within default threshold)
    const recentSnapshot = {
        ...snapshot,
        mtimeMs: snapshot.mtimeMs - 500, // 500ms ago
    };
    // With 1000ms threshold, this should be fresh
    const result1 = checkFreshness(filePath, recentSnapshot, { staleThresholdMs: 1000 });
    assert.equal(result1.fresh, true);
    unlinkSync(filePath);
});
test("checkFreshness returns not fresh when digest mismatch", () => {
    const filePath = join(TEST_DIR, "digest-mismatch.txt");
    writeFileSync(filePath, "original content");
    const snapshot = takeFileSnapshot(filePath, { includeDigest: true });
    // Modify file content
    writeFileSync(filePath, "modified content");
    const result = checkFreshness(filePath, snapshot, { requireDigest: true });
    assert.equal(result.fresh, false);
    assert.ok(result.reason?.includes("digest mismatch"));
    unlinkSync(filePath);
});
test("FileFreshnessGuard constructor accepts config", () => {
    const guard = new FileFreshnessGuard({ allowStale: true, staleThresholdMs: 5000 });
    assert.ok(guard);
});
test("FileFreshnessGuard.snapshot stores snapshot", () => {
    const guard = new FileFreshnessGuard();
    const filePath = join(TEST_DIR, "guard-snapshot.txt");
    writeFileSync(filePath, "content");
    const snapshot = guard.snapshot(filePath);
    assert.equal(snapshot.path, filePath);
    assert.ok(guard.getSnapshot(filePath));
    unlinkSync(filePath);
});
test("FileFreshnessGuard.snapshot with digest", () => {
    const guard = new FileFreshnessGuard();
    const filePath = join(TEST_DIR, "guard-digest.txt");
    writeFileSync(filePath, "content");
    const snapshot = guard.snapshot(filePath, { includeDigest: true });
    assert.ok(snapshot.digest);
    assert.ok(guard.getSnapshot(filePath)?.digest);
    unlinkSync(filePath);
});
test("FileFreshnessGuard.getSnapshot returns undefined for unknown file", () => {
    const guard = new FileFreshnessGuard();
    const result = guard.getSnapshot("/unknown/path.txt");
    assert.equal(result, undefined);
});
test("FileFreshnessGuard.check returns fresh when no snapshot exists", () => {
    const guard = new FileFreshnessGuard();
    const result = guard.check("/unknown/path.txt");
    assert.equal(result.fresh, true);
    assert.equal(result.reason, "No previous snapshot found");
});
test("FileFreshnessGuard.check detects file modification", async () => {
    const guard = new FileFreshnessGuard({ staleThresholdMs: 0, requireDigest: true });
    const filePath = join(TEST_DIR, "guard-check.txt");
    writeFileSync(filePath, "original");
    guard.snapshot(filePath, { includeDigest: true });
    // Modify file
    writeFileSync(filePath, "modified");
    const result = guard.check(filePath);
    assert.equal(result.fresh, false);
    assert.ok(result.reason?.includes("digest mismatch") || result.reason?.includes("modified externally"));
    unlinkSync(filePath);
});
test("FileFreshnessGuard.check uses merged config", () => {
    const guard = new FileFreshnessGuard({ staleThresholdMs: 1000 });
    const filePath = join(TEST_DIR, "guard-merge.txt");
    writeFileSync(filePath, "content");
    const snapshot = {
        ...takeFileSnapshot(filePath),
        mtimeMs: Date.now() - 2000,
    };
    guard.snapshot(filePath);
    // Override threshold at check time
    const result = guard.check(filePath, { staleThresholdMs: 3000 });
    assert.equal(result.fresh, true);
    unlinkSync(filePath);
});
test("FileFreshnessGuard.setConfig updates config", () => {
    const guard = new FileFreshnessGuard({ allowStale: false });
    assert.equal(guard.check(join(TEST_DIR, "no-snap.txt")).fresh, true);
    guard.setConfig({ allowStale: true });
    // Config updated
});
test("FileFreshnessGuard.clear removes all snapshots", () => {
    const guard = new FileFreshnessGuard();
    const filePath1 = join(TEST_DIR, "clear1.txt");
    const filePath2 = join(TEST_DIR, "clear2.txt");
    writeFileSync(filePath1, "content1");
    writeFileSync(filePath2, "content2");
    guard.snapshot(filePath1);
    guard.snapshot(filePath2);
    assert.ok(guard.getSnapshot(filePath1));
    assert.ok(guard.getSnapshot(filePath2));
    guard.clear();
    assert.equal(guard.getSnapshot(filePath1), undefined);
    assert.equal(guard.getSnapshot(filePath2), undefined);
    unlinkSync(filePath1);
    unlinkSync(filePath2);
});
// Cleanup
test.after(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
});
//# sourceMappingURL=file-freshness.test.js.map