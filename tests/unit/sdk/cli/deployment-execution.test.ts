import test from "node:test";
import assert from "node:assert/strict";

import { loadDeploymentExecutionCliEnv } from "../../../../src/platform/five-plane-control-plane/config-center/remaining-cli-env-loaders.js";

test("loadDeploymentExecutionCliEnv parses build_report and export actions", () => {
  const report = loadDeploymentExecutionCliEnv({
    AA_DEPLOYMENT_EXECUTION_ACTION: "build_report",
    AA_DB_PATH: "/tmp/test.db",
    AA_DEPLOYMENT_ENVIRONMENT: "dev",
    AA_DEPLOYMENT_VERSION: "1.0.0",
    AA_DEPLOYMENT_COMMIT_SHA: "abc123",
    AA_DEPLOYMENT_ROLLOUT_STRATEGY: "rolling",
    AA_DEPLOYMENT_REPO_ROOT: "/repo/root",
    AA_DEPLOYMENT_ARTIFACT_ROOT: "/tmp/artifacts",
    AA_TASK_ID: "task-123",
    AA_DEPLOYMENT_EXECUTE: "true",
  });
  const exportConfig = loadDeploymentExecutionCliEnv({
    AA_DEPLOYMENT_EXECUTION_ACTION: "export",
    AA_DB_PATH: "/tmp/test.db",
    AA_DEPLOYMENT_ENVIRONMENT: "prod",
    AA_DEPLOYMENT_ROLLOUT_STRATEGY: "blue_green",
    AA_DEPLOYMENT_REPO_ROOT: "/repo/root",
    AA_DEPLOYMENT_RUNNER_MODE: "simulate",
  });

  assert.equal(report.action, "build_report");
  assert.equal(report.repoRootDir, "/repo/root");
  assert.equal(report.taskId, "task-123");
  assert.equal(report.execute, true);
  assert.equal(exportConfig.action, "export");
  assert.equal(exportConfig.runnerMode, "simulate");
});

test("loadDeploymentExecutionCliEnv uses current defaults", () => {
  const config = loadDeploymentExecutionCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_DEPLOYMENT_REPO_ROOT: "/repo/root",
  });

  assert.equal(config.action, "build_report");
  assert.equal(config.runnerMode, "local");
  assert.equal(config.rolloutStrategy, null);
  assert.equal(config.artifactRoot, "/repo/root/data/artifacts");
});
