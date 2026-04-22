/**
 * Environment Deployment CLI Tests
 *
 * Tests for environment-deployment CLI module which handles environment
 * deployment operations including listing bundles, building reports, and exporting.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { loadEnvironmentDeploymentCliEnv } from "../../../../src/platform/control-plane/config-center/operations-cli-env.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

describe("loadEnvironmentDeploymentCliEnv", () => {
  it("parses list-bundles action", () => {
    const config = loadEnvironmentDeploymentCliEnv({
      AA_ENVIRONMENT_DEPLOYMENT_ACTION: "list-bundles",
      AA_REPO_ROOT_DIR: "/repo/root",
    });

    assert.equal(config.action, "list-bundles");
    assert.equal(config.repoRootDir, "/repo/root");
  });

  it("parses build action", () => {
    const config = loadEnvironmentDeploymentCliEnv({
      AA_ENVIRONMENT_DEPLOYMENT_ACTION: "build",
      AA_DB_PATH: "/tmp/test.db",
      AA_REPO_ROOT_DIR: "/repo/root",
      AA_TARGET_ENVIRONMENT: "dev",
      AA_VERSION: "1.0.0",
      AA_COMMIT_SHA: "abc123",
      AA_ROLLOUT_STRATEGY: "rolling",
    });

    assert.equal(config.action, "build");
    assert.equal(config.targetEnvironment, "dev");
    assert.equal(config.version, "1.0.0");
    assert.equal(config.commitSha, "abc123");
    assert.equal(config.rolloutStrategy, "rolling");
  });

  it("parses export action", () => {
    const config = loadEnvironmentDeploymentCliEnv({
      AA_ENVIRONMENT_DEPLOYMENT_ACTION: "export",
      AA_DB_PATH: "/tmp/test.db",
      AA_REPO_ROOT_DIR: "/repo/root",
      AA_TARGET_ENVIRONMENT: "prod",
    });

    assert.equal(config.action, "export");
    assert.equal(config.targetEnvironment, "prod");
  });

  it("parses optional task_id", () => {
    const config = loadEnvironmentDeploymentCliEnv({
      AA_ENVIRONMENT_DEPLOYMENT_ACTION: "build",
      AA_DB_PATH: "/tmp/test.db",
      AA_REPO_ROOT_DIR: "/repo/root",
      AA_TASK_ID: "task-123",
    });

    assert.equal(config.taskId, "task-123");
  });

  it("parses optional generated_at", () => {
    const config = loadEnvironmentDeploymentCliEnv({
      AA_ENVIRONMENT_DEPLOYMENT_ACTION: "build",
      AA_DB_PATH: "/tmp/test.db",
      AA_REPO_ROOT_DIR: "/repo/root",
      AA_GENERATED_AT: "2024-01-15T10:00:00Z",
    });

    assert.equal(config.generatedAt, "2024-01-15T10:00:00Z");
  });

  it("throws ValidationError when missing AA_DB_PATH for build action", () => {
    assert.throws(
      () =>
        loadEnvironmentDeploymentCliEnv({
          AA_ENVIRONMENT_DEPLOYMENT_ACTION: "build",
          AA_REPO_ROOT_DIR: "/repo/root",
          // Missing AA_DB_PATH
        }),
      (e) => e instanceof ValidationError && (e as ValidationError).code.includes("missing_env:AA_DB_PATH"),
    );
  });

  it("throws ValidationError when missing AA_REPO_ROOT_DIR for list-bundles action", () => {
    assert.throws(
      () =>
        loadEnvironmentDeploymentCliEnv({
          AA_ENVIRONMENT_DEPLOYMENT_ACTION: "list-bundles",
          // Missing AA_REPO_ROOT_DIR
        }),
      (e) => e instanceof ValidationError && (e as ValidationError).code.includes("missing_env:AA_REPO_ROOT_DIR"),
    );
  });
});
