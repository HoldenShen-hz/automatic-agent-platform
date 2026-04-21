/**
 * Deploy Command Tests
 *
 * Tests for environment-deployment and deployment-execution CLI modules.
 * These tests verify the env loaders and schema validation, not the actual CLI execution.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { loadEnvironmentDeploymentCliEnv } from "../../../../src/platform/control-plane/config-center/operations-cli-env.js";
import { loadDeploymentExecutionCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

test("loadEnvironmentDeploymentCliEnv parses valid list-bundles action", () => {
  const config = loadEnvironmentDeploymentCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_REPO_ROOT_DIR: "/workspace",
    AA_ENVIRONMENT_DEPLOYMENT_ACTION: "list-bundles",
  });

  assert.equal(config.action, "list-bundles");
  assert.equal(config.repoRootDir, "/workspace");
});

test("loadEnvironmentDeploymentCliEnv parses valid build action", () => {
  const config = loadEnvironmentDeploymentCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_REPO_ROOT_DIR: "/workspace",
    AA_ENVIRONMENT_DEPLOYMENT_ACTION: "build",
    AA_TARGET_ENVIRONMENT: "staging",
  });

  assert.equal(config.action, "build");
  assert.equal(config.targetEnvironment, "staging");
});

test("loadEnvironmentDeploymentCliEnv parses valid export action", () => {
  const config = loadEnvironmentDeploymentCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_REPO_ROOT_DIR: "/workspace",
    AA_ENVIRONMENT_DEPLOYMENT_ACTION: "export",
    AA_TARGET_ENVIRONMENT: "prod",
    AA_VERSION: "1.0.0",
    AA_COMMIT_SHA: "abc123",
  });

  assert.equal(config.action, "export");
  assert.equal(config.targetEnvironment, "prod");
  assert.equal(config.version, "1.0.0");
  assert.equal(config.commitSha, "abc123");
});

test("loadEnvironmentDeploymentCliEnv uses default action when not specified", () => {
  const config = loadEnvironmentDeploymentCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_REPO_ROOT_DIR: "/workspace",
  });

  assert.equal(config.action, "list-bundles");
});

test("loadEnvironmentDeploymentCliEnv handles optional fields", () => {
  const config = loadEnvironmentDeploymentCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_REPO_ROOT_DIR: "/workspace",
    AA_ENVIRONMENT_DEPLOYMENT_ACTION: "build",
    AA_ROLLOUT_STRATEGY: "canary",
    AA_GENERATED_AT: "2024-01-01T00:00:00Z",
    AA_TASK_ID: "task_123",
  });

  assert.equal(config.rolloutStrategy, "canary");
  assert.equal(config.generatedAt, "2024-01-01T00:00:00Z");
  assert.equal(config.taskId, "task_123");
});

test("loadEnvironmentDeploymentCliEnv throws when dbPath is missing for build action", () => {
  assert.throws(
    () =>
      loadEnvironmentDeploymentCliEnv({
        AA_REPO_ROOT_DIR: "/workspace",
        AA_ENVIRONMENT_DEPLOYMENT_ACTION: "build",
        // AA_DB_PATH missing - required for build/export
      }),
    (e: unknown) => e instanceof ValidationError,
  );
});

test("loadDeploymentExecutionCliEnv parses valid build_report action", () => {
  const config = loadDeploymentExecutionCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_DEPLOYMENT_EXECUTION_ACTION: "build_report",
    AA_DEPLOYMENT_ENVIRONMENT: "dev",
  });

  assert.equal(config.action, "build_report");
  assert.equal(config.environment, "dev");
});

test("loadDeploymentExecutionCliEnv parses valid export action", () => {
  const config = loadDeploymentExecutionCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_DEPLOYMENT_EXECUTION_ACTION: "export",
    AA_DEPLOYMENT_ENVIRONMENT: "prod",
    AA_DEPLOYMENT_VERSION: "2.0.0",
    AA_DEPLOYMENT_COMMIT_SHA: "def456",
  });

  assert.equal(config.action, "export");
  assert.equal(config.version, "2.0.0");
  assert.equal(config.commitSha, "def456");
});

test("loadDeploymentExecutionCliEnv uses default action when not specified", () => {
  const config = loadDeploymentExecutionCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_DEPLOYMENT_ENVIRONMENT: "staging",
  });

  assert.equal(config.action, "build_report");
});

test("loadDeploymentExecutionCliEnv handles optional rollout strategy", () => {
  const config = loadDeploymentExecutionCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_DEPLOYMENT_EXECUTION_ACTION: "build_report",
    AA_DEPLOYMENT_ENVIRONMENT: "prod",
    AA_DEPLOYMENT_ROLLOUT_STRATEGY: "blue_green",
  });

  assert.equal(config.rolloutStrategy, "blue_green");
});

test("loadDeploymentExecutionCliEnv handles optional artifact root", () => {
  const config = loadDeploymentExecutionCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_DEPLOYMENT_EXECUTION_ACTION: "build_report",
    AA_DEPLOYMENT_ARTIFACT_ROOT: "/artifacts",
  });

  assert.equal(config.artifactRoot, "/artifacts");
});

test("loadDeploymentExecutionCliEnv handles runner mode simulate", () => {
  const config = loadDeploymentExecutionCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_DEPLOYMENT_EXECUTION_ACTION: "build_report",
    AA_DEPLOYMENT_RUNNER_MODE: "simulate",
  });

  assert.equal(config.runnerMode, "simulate");
});

test("loadDeploymentExecutionCliEnv handles optional generated fields", () => {
  const config = loadDeploymentExecutionCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_DEPLOYMENT_EXECUTION_ACTION: "build_report",
    AA_GENERATED_AT: "2024-06-01T12:00:00Z",
    AA_TASK_ID: "task_456",
  });

  assert.equal(config.generatedAt, "2024-06-01T12:00:00Z");
  assert.equal(config.taskId, "task_456");
});
