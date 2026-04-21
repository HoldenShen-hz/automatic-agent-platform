import { resolve } from "node:path";

import test from "node:test";
import assert from "node:assert/strict";

import { KnowledgeSnapshotStore } from "../../../../src/platform/state-evidence/knowledge/archive/knowledge-snapshot-store.js";

test("[SYS-SEC-4.2] knowledge snapshot store rejects path traversal", () => {
  assert.throws(
    () => new KnowledgeSnapshotStore({ snapshotPath: "../../etc/passwd" }),
    { message: /sandbox|path|denied/i },
    "Must reject paths outside sandbox root",
  );
});

test("[SYS-SEC-4.2] knowledge snapshot store rejects absolute paths outside sandbox", () => {
  assert.throws(
    () => new KnowledgeSnapshotStore({ snapshotPath: "/etc/shadow" }),
    { message: /sandbox|path|denied/i },
    "Must reject absolute paths outside sandbox",
  );
});

test("[SYS-SEC-4.2] knowledge snapshot store accepts relative paths within sandbox", () => {
  const store = new KnowledgeSnapshotStore({
    snapshotPath: "./snapshots/knowledge.json",
  });
  assert.ok(store !== null, "Should accept relative path within sandbox");
});

test("[SYS-SEC-4.2] knowledge snapshot store accepts absolute paths within workspace", () => {
  const store = new KnowledgeSnapshotStore({
    snapshotPath: resolve("/tmp/aa-sandbox/snapshots/knowledge.json"),
  });
  assert.ok(store !== null, "Should accept absolute path within workspace");
});