/**
 * @fileoverview P2 Engineering Defect Tests - SYS-SEC-4.2: Path Traversal Consistency
 *
 * Tests that KnowledgeSnapshotStore rejects path traversal patterns and
 * absolute paths outside the sandbox root.
 *
 * Corresponding defect: knowledge-snapshot-store.ts directly reads files
 * without proper sandbox path validation.
 * Test type: Security Unit
 */

import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeSnapshotStore } from "../../../../../../src/platform/state-evidence/knowledge/archive/knowledge-snapshot-store.js";

test("[SYS-SEC-4.2] knowledge snapshot store rejects path traversal", () => {
  // Test relative path traversal with ..
  assert.throws(
    () => new KnowledgeSnapshotStore({ snapshotPath: "../../etc/passwd" }),
    /path_traversal_denied|path_scope_denied|sandbox|denied/i,
    "Must reject paths with .. traversal",
  );
});

test("[SYS-SEC-4.2] knowledge snapshot store rejects absolute path to /etc", () => {
  // Test absolute path outside sandbox
  assert.throws(
    () => new KnowledgeSnapshotStore({ snapshotPath: "/etc/shadow" }),
    /path_traversal_denied|path_scope_denied|sandbox|denied/i,
    "Must reject absolute paths outside sandbox root",
  );
});

test("[SYS-SEC-4.2] knowledge snapshot store rejects /tmp/../etc/passwd", () => {
  // Test encoded traversal attempt
  assert.throws(
    () => new KnowledgeSnapshotStore({ snapshotPath: "/tmp/../etc/passwd" }),
    /path_traversal_denied|path_scope_denied|sandbox|denied/i,
    "Must reject traversal attempts even within /tmp",
  );
});

test("[SYS-SEC-4.2] knowledge snapshot store rejects path with null bytes", () => {
  // Null byte injection attempt
  assert.throws(
    () => new KnowledgeSnapshotStore({ snapshotPath: "/tmp/aa-sandbox/\0invalid" } as any),
    /path_traversal_denied|path_scope_denied|sandbox|denied/i,
    "Must reject paths with null bytes",
  );
});

test("[SYS-SEC-4.2] knowledge snapshot store accepts valid relative path", () => {
  // Valid relative path should work
  const store = new KnowledgeSnapshotStore({
    snapshotPath: "test-snapshot.json",
  });
  assert.ok(store != null, "Valid relative path should be accepted");
});

test("[SYS-SEC-4.2] knowledge snapshot store accepts absolute path within /tmp/aa-sandbox", () => {
  // Absolute path within sandbox should work
  const sandboxPath = "/tmp/aa-sandbox/test-snapshot-" + Date.now() + ".json";
  const store = new KnowledgeSnapshotStore({ snapshotPath: sandboxPath });
  assert.ok(store != null, "Absolute path within sandbox should be accepted");
});

test("[SYS-SEC-4.2] knowledge snapshot store accepts nested path within sandbox", () => {
  // Nested absolute path within sandbox should work
  const store = new KnowledgeSnapshotStore({
    snapshotPath: "/tmp/aa-sandbox/subdir/nested/test.json",
  });
  assert.ok(store != null, "Nested path within sandbox should be accepted");
});

test("[SYS-SEC-4.2] knowledge snapshot store accepts paths within system temp dir", () => {
  // Paths within system temp directory should work
  const store = new KnowledgeSnapshotStore({
    snapshotPath: process.env.TMPDIR + "test-snapshot-" + Date.now() + ".json",
  });
  assert.ok(store != null, "Path within system temp dir should be accepted");
});

test("[SYS-SEC-4.2] knowledge snapshot store rejects /usr/bin traversal", () => {
  // Another absolute path traversal attempt
  assert.throws(
    () => new KnowledgeSnapshotStore({ snapshotPath: "/usr/bin/../../../etc/passwd" }),
    /path_traversal_denied|path_scope_denied|sandbox|denied/i,
    "Must reject deep traversal attempts",
  );
});

test("[SYS-SEC-4.2] knowledge snapshot store rejects windows-style path traversal", () => {
  // Windows-style path traversal
  assert.throws(
    () => new KnowledgeSnapshotStore({ snapshotPath: "..\\..\\etc\\passwd" }),
    /path_traversal_denied|path_scope_denied|sandbox|denied/i,
    "Must reject Windows-style path traversal",
  );
});

test("[SYS-SEC-4.2] knowledge snapshot store rejects /root/.ssh/authorized_keys", () => {
  // Sensitive system file access attempt
  assert.throws(
    () => new KnowledgeSnapshotStore({ snapshotPath: "/root/.ssh/authorized_keys" }),
    /path_traversal_denied|path_scope_denied|sandbox|denied/i,
    "Must reject access to sensitive system files",
  );
});

test("[SYS-SEC-4.2] knowledge snapshot store save/load works with valid sandbox path", () => {
  // Verify that valid paths actually work for save/load operations
  const sandboxPath = "/tmp/aa-sandbox/valid-test-" + Date.now() + ".json";
  const store = new KnowledgeSnapshotStore({ snapshotPath: sandboxPath });

  const saved = store.save({ namespaces: [], records: [] });
  assert.ok(saved.generatedAt != null, "Save should succeed with valid path");

  const loaded = store.load();
  assert.ok(loaded !== null, "Load should succeed with valid path");
  assert.equal(loaded!.namespaces.length, 0, "Loaded namespaces should be empty as saved");
  assert.equal(loaded!.records.length, 0, "Loaded records should be empty as saved");
});
