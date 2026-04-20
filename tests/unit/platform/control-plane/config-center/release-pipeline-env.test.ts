import assert from "node:assert/strict";
import test from "node:test";

import { loadReleasePipelineCliEnv } from "../../../../../src/platform/control-plane/config-center/release-pipeline-env.js";

test("release pipeline env loader parses execute inputs", () => {
  const config = loadReleasePipelineCliEnv({
    AA_DB_PATH: "/tmp/release.db",
    AA_RELEASE_ACTION: "execute",
    AA_RELEASE_RUNNER: "simulate",
    AA_RELEASE_TRIGGER_DEPLOY: "true",
    AA_RELEASE_ENVIRONMENT: "pre-prod",
    AA_RELEASE_VERSION: "1.2.3",
    AA_RELEASE_COMMIT_SHA: "abcdef123456",
    AA_RELEASE_ROLLOUT_STRATEGY: "blue_green",
    AA_RELEASE_REGISTRY: "ghcr.io/acme",
    AA_RELEASE_IMAGE_REPOSITORY: "automatic-agent",
    AA_RELEASE_TASK_ID: "task-1",
  });

  assert.equal(config.action, "execute");
  assert.equal(config.dbPath, "/tmp/release.db");
  assert.equal(config.runnerMode, "simulate");
  assert.equal(config.triggerDeploy, true);
  assert.equal(config.environment, "pre-prod");
  assert.equal(config.rolloutStrategy, "blue_green");
  assert.equal(config.registry, "ghcr.io/acme");
  assert.equal(config.imageRepository, "automatic-agent");
  assert.equal(config.taskId, "task-1");
});

test("release pipeline env loader rejects invalid environment", () => {
  assert.throws(
    () =>
      loadReleasePipelineCliEnv({
        AA_RELEASE_ACTION: "execute",
        AA_RELEASE_ENVIRONMENT: "qa",
        AA_RELEASE_VERSION: "1.2.3",
        AA_RELEASE_COMMIT_SHA: "abcdef123456",
        AA_RELEASE_ROLLOUT_STRATEGY: "rolling",
      }),
    /release\.invalid_environment/,
  );
});

test("release pipeline env loader accepts valid staging environment", () => {
  const config = loadReleasePipelineCliEnv({
    AA_RELEASE_ACTION: "execute",
    AA_RELEASE_ENVIRONMENT: "staging",
    AA_RELEASE_VERSION: "2.0.0",
    AA_RELEASE_COMMIT_SHA: "abcdef123456",
    AA_RELEASE_ROLLOUT_STRATEGY: "rolling",
  });

  assert.equal(config.environment, "staging");
  assert.equal(config.rolloutStrategy, "rolling");
});
