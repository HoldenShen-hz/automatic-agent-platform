import test from "node:test";
import assert from "node:assert/strict";

import { loadEnvironmentDeploymentCliEnv } from "../../../../src/platform/control-plane/config-center/operations-cli-env.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

test("loadEnvironmentDeploymentCliEnv parses current deployment env names", () => {
  const list = loadEnvironmentDeploymentCliEnv({
    AA_DEPLOYMENT_ACTION: "list-bundles",
    AA_DEPLOYMENT_REPO_ROOT: "/repo/root",
  });
  const build = loadEnvironmentDeploymentCliEnv({
    AA_DEPLOYMENT_ACTION: "build",
    AA_DB_PATH: "/tmp/test.db",
    AA_DEPLOYMENT_REPO_ROOT: "/repo/root",
    AA_DEPLOYMENT_TARGET_ENVIRONMENT: "dev",
    AA_DEPLOYMENT_VERSION: "1.0.0",
    AA_DEPLOYMENT_COMMIT_SHA: "abc123",
    AA_DEPLOYMENT_ROLLOUT_STRATEGY: "rolling",
    AA_DEPLOYMENT_TASK_ID: "task-123",
    AA_DEPLOYMENT_GENERATED_AT: "2024-01-15T10:00:00Z",
  });

  assert.equal(list.action, "list-bundles");
  assert.equal(list.repoRootDir, "/repo/root");
  assert.equal(list.dbPath, null);
  assert.equal(build.targetEnvironment, "dev");
  assert.equal(build.taskId, "task-123");
  assert.equal(build.generatedAt, "2024-01-15T10:00:00Z");
});

test("loadEnvironmentDeploymentCliEnv uses current defaults and still requires db path for build", () => {
  const config = loadEnvironmentDeploymentCliEnv({});

  assert.equal(config.action, "list-bundles");
  assert.equal(config.repoRootDir, process.cwd());

  assert.throws(
    () =>
      loadEnvironmentDeploymentCliEnv({
        AA_DEPLOYMENT_ACTION: "build",
      }),
    (error) =>
      error instanceof ValidationError && error.code === "missing_env:AA_DB_PATH",
  );
});
