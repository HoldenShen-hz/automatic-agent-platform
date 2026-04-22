/**
 * Platform Operator CLI Tests
 *
 * Tests for platform-operator CLI module which manages platform-level operations
 * including evidence collection, package generation, and status management.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { loadPlatformOperatorCliEnv } from "../../../../src/platform/control-plane/config-center/operations-cli-env.js";

describe("loadPlatformOperatorCliEnv", () => {
  it("parses summary action", () => {
    const config = loadPlatformOperatorCliEnv({
      AA_PLATFORM_OPERATOR_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "dev",
    });

    assert.equal(config.action, "summary");
    assert.equal(config.environment, "dev");
  });

  it("parses export action", () => {
    const config = loadPlatformOperatorCliEnv({
      AA_PLATFORM_OPERATOR_ACTION: "export",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "prod",
    });

    assert.equal(config.action, "export");
    assert.equal(config.environment, "prod");
  });

  it("parses optional artifact root", () => {
    const config = loadPlatformOperatorCliEnv({
      AA_PLATFORM_OPERATOR_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "staging",
      AA_ARTIFACT_ROOT: "/tmp/artifacts",
    });

    assert.equal(config.artifactRoot, "/tmp/artifacts");
  });

  it("parses optional evidence root dir", () => {
    const config = loadPlatformOperatorCliEnv({
      AA_PLATFORM_OPERATOR_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "dev",
      AA_EVIDENCE_ROOT_DIR: "/tmp/evidence",
    });

    assert.equal(config.evidenceRootDir, "/tmp/evidence");
  });

  it("parses optional package output dir", () => {
    const config = loadPlatformOperatorCliEnv({
      AA_PLATFORM_OPERATOR_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "dev",
      AA_PACKAGE_OUTPUT_DIR: "/tmp/packages",
    });

    assert.equal(config.outputDir, "/tmp/packages");
  });

  it("parses optional target status", () => {
    const config = loadPlatformOperatorCliEnv({
      AA_PLATFORM_OPERATOR_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "dev",
      AA_TARGET_STATUS: "healthy",
    });

    assert.equal(config.targetStatus, "healthy");
  });

  it("parses optional generated_at", () => {
    const config = loadPlatformOperatorCliEnv({
      AA_PLATFORM_OPERATOR_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "dev",
      AA_GENERATED_AT: "2024-01-25T08:00:00Z",
    });

    assert.equal(config.generatedAt, "2024-01-25T08:00:00Z");
  });

  it("uses summary as default action", () => {
    const config = loadPlatformOperatorCliEnv({
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "dev",
    });

    assert.equal(config.action, "summary");
  });
});
