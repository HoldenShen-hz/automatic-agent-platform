import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ArtifactPublishLedger } from "../../../../../src/platform/state-evidence/artifacts/artifact-publish-ledger.js";
import { ArtifactPlaneService } from "../../../../../src/platform/state-evidence/artifacts/artifact-plane-service.js";
import { ArtifactPublishService } from "../../../../../src/platform/state-evidence/artifacts/artifact-publish-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("ArtifactPlaneService prepares and publishes governed bundles", () => {
  const plane = new ArtifactPlaneService();
  const prepared = plane.prepareBundle({
    taskId: "task_1",
    domainId: "coding",
    bundleType: "release_bundle",
    artifacts: [
      {
        artifactId: "artifact_1",
        taskId: "task_1",
        stepId: "step_1",
        agentRole: "builder",
        type: "source_code",
        path: "src/index.ts",
        contentHash: "hash",
        version: 1,
        parentArtifactId: null,
        size: 256,
        createdAt: new Date().toISOString(),
        status: "draft",
      },
    ],
  });

  assert.equal(prepared.governance.allowed, true);
  assert.match(prepared.preview, /Artifact Bundle/);

  const published = plane.publishBundle(prepared.bundle);
  assert.equal(published.bundle.publishStatus, "published");
  assert.match(published.preview, /published/);
});

test("ArtifactPlaneService records publish history to ledger", () => {
  const workspace = createTempWorkspace("aa-artifact-ledger-");

  try {
    const plane = new ArtifactPlaneService(
      undefined,
      undefined,
      undefined,
      new ArtifactPublishService(new ArtifactPublishLedger({
        ledgerPath: join(workspace, "publish-ledger.jsonl"),
      })),
    );
    const prepared = plane.prepareBundle({
      taskId: "task_2",
      domainId: "coding",
      bundleType: "release_bundle",
      artifacts: [
        {
          artifactId: "artifact_2",
          taskId: "task_2",
          stepId: "step_1",
          agentRole: "builder",
          type: "source_code",
          path: "src/index.ts",
          contentHash: "hash-2",
          version: 1,
          parentArtifactId: null,
          size: 128,
          createdAt: new Date().toISOString(),
          status: "draft",
        },
      ],
    });

    plane.publishBundle(prepared.bundle);
    const history = plane.listPublishHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0]?.bundleId, prepared.bundle.bundleId);
    assert.equal(history[0]?.publishStatus, "published");
  } finally {
    cleanupPath(workspace);
  }
});

test("ArtifactPlaneService handles workflow_snapshot bundle type", () => {
  const plane = new ArtifactPlaneService();
  const prepared = plane.prepareBundle({
    taskId: "task_3",
    domainId: "coding",
    bundleType: "workflow_snapshot",
    artifacts: [
      {
        artifactId: "artifact_3",
        taskId: "task_3",
        stepId: "step_1",
        agentRole: "builder",
        type: "source_code",
        path: "workflow.json",
        contentHash: "hash-3",
        version: 1,
        parentArtifactId: null,
        size: 64,
        createdAt: new Date().toISOString(),
        status: "draft",
      },
    ],
  });

  assert.equal(prepared.governance.allowed, true);
  assert.match(prepared.preview, /Artifact Bundle/);
});

test("ArtifactPlaneService publishBundle with empty artifacts list", () => {
  const plane = new ArtifactPlaneService();
  const prepared = plane.prepareBundle({
    taskId: "task_empty",
    domainId: "coding",
    bundleType: "release_bundle",
    artifacts: [],
  });

  const published = plane.publishBundle(prepared.bundle);
  assert.equal(published.bundle.publishStatus, "published");
  assert.equal(published.bundle.artifacts.length, 0);
});

test("ArtifactPlaneService blocks publishing bundles with sensitive metadata", () => {
  const plane = new ArtifactPlaneService();
  const prepared = plane.prepareBundle({
    taskId: "task_sensitive",
    domainId: "coding",
    bundleType: "release_bundle",
    artifacts: [
      {
        artifactId: "artifact_sensitive",
        taskId: "task_sensitive",
        stepId: "step_1",
        agentRole: "builder",
        type: "config",
        path: "secrets.env",
        contentHash: "hash",
        version: 1,
        parentArtifactId: null,
        size: 64,
        createdAt: new Date().toISOString(),
        status: "draft",
      },
    ],
    finalDeliverables: ["token=abc1234567890abcdef"],
  });

  assert.equal(prepared.governance.allowed, false);
  assert.ok(prepared.governance.issues.includes("artifact.sensitive_secret_detected"));
  assert.throws(
    () => plane.publishBundle(prepared.bundle),
    (error: unknown) => typeof error === "object" && error != null && "code" in error && error.code === "artifact_plane.publish_blocked",
  );
});
