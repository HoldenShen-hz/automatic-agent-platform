import assert from "node:assert/strict";
import test from "node:test";

import { ArtifactRecordSchema, parseArtifactRecord } from "../../../../src/platform/five-plane-state-evidence/artifacts/artifact-model.js";

test("ArtifactRecordSchema accepts canonical planId alongside modern artifact metadata", () => {
  const record = ArtifactRecordSchema.parse({
    artifactId: "artifact_1",
    harnessRunId: "harness_1",
    planId: "plan_1",
    planGraphBundleId: "pgb_1",
    type: "report",
    path: "artifacts/report.json",
    mimeType: "application/json",
    sizeBytes: 128,
    refs: [{
      refId: "ref_1",
      targetType: "execution",
      targetId: "exec_1",
    }],
    publishStatus: "published",
    createdAt: "2026-05-09T00:00:00.000Z",
    metadata: { channel: "ops" },
  });

  assert.equal(record.planId, "plan_1");
  assert.equal(record.publishStatus, "published");
  assert.equal(record.refs?.length, 1);
});

test("parseArtifactRecord backfills planId from legacy planGraphBundleId", () => {
  const record = parseArtifactRecord({
    artifactId: "artifact_legacy",
    harnessRunId: "harness_legacy",
    planGraphBundleId: "pgb_legacy",
    type: "report",
    path: "artifacts/legacy.json",
    mimeType: "application/json",
    sizeBytes: 64,
    publishStatus: "draft",
    createdAt: "2026-05-09T00:00:00.000Z",
  });

  assert.equal(record.planId, "pgb_legacy");
});
