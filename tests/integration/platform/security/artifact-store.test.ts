import assert from "node:assert/strict";
import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { ArtifactStore } from "../../../../src/platform/state-evidence/artifacts/artifact-store.js";
import { createWorkspaceWritePolicy } from "../../../../src/platform/control-plane/iam/sandbox-policy.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("artifact store blocks artifact roots outside the workspace sandbox", () => {
  const workspace = createTempWorkspace("aa-artifact-sec-");
  const outside = createTempWorkspace("aa-artifact-outside-");

  try {
    const store = new ArtifactStore({
      rootDir: join(outside, "artifacts"),
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
    });

    assert.throws(
      () =>
        store.writeJsonArtifact({
          taskId: "task_test",
          kind: "workflow_step_snapshot",
          fileName: "snapshot",
          content: { ok: true },
        }),
      /sandbox\.path_outside_allowed_roots/,
    );
  } finally {
    cleanupPath(workspace);
    cleanupPath(outside);
  }
});

test("artifact store blocks symlink artifact roots that escape the workspace", () => {
  const workspace = createTempWorkspace("aa-artifact-sec-");
  const outside = createTempWorkspace("aa-artifact-target-");

  try {
    mkdirSync(join(workspace, "linked-root-parent"), { recursive: true });
    mkdirSync(join(outside, "real-artifacts"), { recursive: true });
    symlinkSync(join(outside, "real-artifacts"), join(workspace, "linked-root-parent", "artifacts"));

    const store = new ArtifactStore({
      rootDir: join(workspace, "linked-root-parent", "artifacts"),
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
    });

    assert.throws(
      () =>
        store.writeJsonArtifact({
          taskId: "task_test",
          kind: "workflow_step_snapshot",
          fileName: "snapshot",
          content: { ok: true },
        }),
      /sandbox\.symlink_denied/,
    );
  } finally {
    cleanupPath(workspace);
    cleanupPath(outside);
  }
});
