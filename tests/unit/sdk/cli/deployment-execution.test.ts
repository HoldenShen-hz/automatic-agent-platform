/**
 * Deployment Execution CLI Tests
 *
 * Tests for deployment-execution CLI module which manages deployment workflows
 * including publish, promote, and rollback operations.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { loadDeploymentExecutionCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";

describe("loadDeploymentExecutionCliEnv", () => {
  it("parses build_report action", () => {
    const config = loadDeploymentExecutionCliEnv({
      AA_DEPLOYMENT_EXECUTION_ACTION: "build_report",
      AA_DB_PATH: "/tmp/test.db",
      AA_DEPLOYMENT_ENVIRONMENT: "dev",
      AA_DEPLOYMENT_VERSION: "1.0.0",
      AA_DEPLOYMENT_COMMIT_SHA: "abc123",
      AA_DEPLOYMENT_ROLLOUT_STRATEGY: "rolling",
      AA_DEPLOYMENT_REPO_ROOT_DIR: "/repo/root",
      AA_DEPLOYMENT_ARTIFACT_ROOT: "/tmp/artifacts",
    });

    assert.equal(config.action, "build_report");
    assert.equal(config.environment, "dev");
    assert.equal(config.version, "1.0.0");
    assert.equal(config.commitSha, "abc123");
    assert.equal(config.rolloutStrategy, "rolling");
  });

  it("parses export action", () => {
    const config = loadDeploymentExecutionCliEnv({
      AA_DEPLOYMENT_EXECUTION_ACTION: "export",
      AA_DB_PATH: "/tmp/test.db",
      AA_DEPLOYMENT_ENVIRONMENT: "prod",
      AA_DEPLOYMENT_VERSION: "2.0.0",
      AA_DEPLOYMENT_COMMIT_SHA: "def456",
      AA_DEPLOYMENT_ROLLOUT_STRATEGY: "blue_green",
      AA_DEPLOYMENT_REPO_ROOT_DIR: "/repo/root",
      AA_DEPLOYMENT_ARTIFACT_ROOT: "/tmp/artifacts",
    });

    assert.equal(config.action, "export");
    assert.equal(config.environment, "prod");
    assert.equal(config.rolloutStrategy, "blue_green");
  });

  it("parses simulate runner mode", () => {
    const config = loadDeploymentExecutionCliEnv({
      AA_DEPLOYMENT_EXECUTION_ACTION: "build_report",
      AA_DB_PATH: "/tmp/test.db",
      AA_DEPLOYMENT_REPO_ROOT_DIR: "/repo/root",
      AA_DEPLOYMENT_ARTIFACT_ROOT: "/tmp/artifacts",
      AA_DEPLOYMENT_RUNNER_MODE: "simulate",
    });

    assert.equal(config.runnerMode, "simulate");
  });

  it("parses execute runner mode", () => {
    const config = loadDeploymentExecutionCliEnv({
      AA_DEPLOYMENT_EXECUTION_ACTION: "build_report",
      AA_DB_PATH: "/tmp/test.db",
      AA_DEPLOYMENT_REPO_ROOT_DIR: "/repo/root",
      AA_DEPLOYMENT_ARTIFACT_ROOT: "/tmp/artifacts",
      AA_DEPLOYMENT_RUNNER_MODE: "execute",
    });

    assert.equal(config.runnerMode, "execute");
  });

  it("parses optional task_id", () => {
    const config = loadDeploymentExecutionCliEnv({
      AA_DEPLOYMENT_EXECUTION_ACTION: "build_report",
      AA_DB_PATH: "/tmp/test.db",
      AA_DEPLOYMENT_REPO_ROOT_DIR: "/repo/root",
      AA_DEPLOYMENT_TASK_ID: "task-abc",
    });

    assert.equal(config.taskId, "task-abc");
  });

  it("parses optional generated_at", () => {
    const config = loadDeploymentExecutionCliEnv({
      AA_DEPLOYMENT_EXECUTION_ACTION: "build_report",
      AA_DB_PATH: "/tmp/test.db",
      AA_DEPLOYMENT_REPO_ROOT_DIR: "/repo/root",
      AA_GENERATED_AT: "2024-01-20T12:00:00Z",
    });

    assert.equal(config.generatedAt, "2024-01-20T12:00:00Z");
  });

  it("parses optional execute flag", () => {
    const config = loadDeploymentExecutionCliEnv({
      AA_DEPLOYMENT_EXECUTION_ACTION: "build_report",
      AA_DB_PATH: "/tmp/test.db",
      AA_DEPLOYMENT_REPO_ROOT_DIR: "/repo/root",
      AA_DEPLOYMENT_EXECUTE: "true",
    });

    assert.equal(config.execute, true);
  });

  it("uses build_report as default action", () => {
    const config = loadDeploymentExecutionCliEnv({
      AA_DB_PATH: "/tmp/test.db",
      AA_DEPLOYMENT_REPO_ROOT_DIR: "/repo/root",
    });

    assert.equal(config.action, "build_report");
  });

  it("uses rolling as default rollout strategy", () => {
    const config = loadDeploymentExecutionCliEnv({
      AA_DEPLOYMENT_EXECUTION_ACTION: "build_report",
      AA_DB_PATH: "/tmp/test.db",
      AA_DEPLOYMENT_REPO_ROOT_DIR: "/repo/root",
    });

    assert.equal(config.rolloutStrategy, "rolling");
  });
});
