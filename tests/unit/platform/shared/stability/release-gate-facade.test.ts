import assert from "node:assert/strict";
import test from "node:test";

import { createReleaseManifestDraft } from "../../../../../src/platform/shared/stability/release-gate.js";

test("createReleaseManifestDraft populates stable defaults", () => {
  const manifest = createReleaseManifestDraft({
    artifactType: "tool",
    artifactId: "tool-gateway",
    artifactVersion: "1.9.0",
    dependencies: {
      receipts: "1.0.0",
      outbox: "existing",
    },
    createdBy: "release-bot",
    evalReportId: "eval-1",
  });

  assert.ok(manifest.releaseId.startsWith("release_"));
  assert.equal(manifest.artifactType, "tool");
  assert.equal(manifest.evalReportId, "eval-1");
  assert.ok(manifest.createdAt.includes("T"));
});
