import { resolve } from "node:path";

import test from "node:test";
import assert from "node:assert/strict";

import { KnowledgeSnapshotStore } from "../../../../../src/platform/state-evidence/knowledge/archive/knowledge-snapshot-store.js";

test("[SYS-SEC-4.2] KnowledgeSnapshotStore rejects path traversal attempts", () => {
  assert.throws(
    () => new KnowledgeSnapshotStore({ snapshotPath: "../../etc/passwd" }),
    /sandbox|path|denied/i,
    "Should reject paths outside sandbox root",
  );
});

test("[SYS-SEC-4.2] KnowledgeSnapshotStore rejects absolute paths outside workspace", () => {
  assert.throws(
    () => new KnowledgeSnapshotStore({ snapshotPath: "/etc/shadow" }),
    /sandbox|path|denied/i,
    "Should reject absolute paths outside sandbox",
  );
});

test("[SYS-SEC-4.2] KnowledgeSnapshotStore accepts relative paths within sandbox", () => {
  const store = new KnowledgeSnapshotStore({
    snapshotPath: "./snapshots/knowledge.json",
  });
  assert.ok(store !== null, "Should accept relative path within sandbox");
});

test("[SYS-SEC-4.2] KnowledgeSnapshotStore accepts absolute paths within workspace", () => {
  const store = new KnowledgeSnapshotStore({
    snapshotPath: resolve("/tmp/aa-sandbox/snapshots/knowledge.json"),
  });
  assert.ok(store !== null, "Should accept absolute path within workspace");
});
