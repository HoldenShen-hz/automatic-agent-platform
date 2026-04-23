import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { loadPlatformOperatorCliEnv } from "../../../../src/platform/control-plane/config-center/operations-cli-env.js";

describe("loadPlatformOperatorCliEnv", () => {
  it("parses current platform operator env names", () => {
    const config = loadPlatformOperatorCliEnv({
      AA_PLATFORM_ACTION: "export",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "dev",
      AA_PLATFORM_ARTIFACT_ROOT: "/tmp/artifacts",
      AA_PLATFORM_EVIDENCE_ROOT: "/tmp/evidence",
      AA_PLATFORM_OUTPUT_DIR: "/tmp/packages",
      AA_PLATFORM_TARGET_STATUS: "tenant_gray",
      AA_GENERATED_AT: "2024-01-25T08:00:00Z",
    });

    assert.equal(config.action, "export");
    assert.equal(config.artifactRoot, "/tmp/artifacts");
    assert.equal(config.evidenceRootDir, "/tmp/evidence");
    assert.equal(config.outputDir, "/tmp/packages");
    assert.equal(config.targetStatus, "tenant_gray");
    assert.equal(config.generatedAt, "2024-01-25T08:00:00Z");
  });

  it("uses summary and canary defaults", () => {
    const config = loadPlatformOperatorCliEnv({
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "dev",
    });

    assert.equal(config.action, "summary");
    assert.equal(config.targetStatus, "canary");
  });
});
