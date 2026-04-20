import assert from "node:assert/strict";
import test from "node:test";

import {
  loadDataPlaneCliEnv,
  loadEnterpriseGovernanceCliEnv,
  loadEnvironmentDeploymentCliEnv,
  loadOpsProgramCliEnv,
  loadPlatformOperatorCliEnv,
} from "../../../../../src/platform/control-plane/config-center/operations-cli-env.js";
import { loadAuthoritativeStorageAdminCliEnv } from "../../../../../src/platform/control-plane/config-center/ops-cli-env.js";

test("operations cli env loader parses enterprise governance inputs", () => {
  const config = loadEnterpriseGovernanceCliEnv({
    AA_DB_PATH: "/tmp/enterprise.db",
    AA_ENVIRONMENT: "prod",
    AA_ENTERPRISE_GOVERNANCE_ACTION: "export",
    AA_ENTERPRISE_GOVERNANCE_ARTIFACT_ROOT: "/tmp/artifacts",
    AA_ENTERPRISE_GOVERNANCE_TASK_ID: "task-1",
    AA_ENTERPRISE_GOVERNANCE_SHIFT_OWNER: "ops.lead",
    AA_DEPENDENCY_MANIFEST_PATH: "/tmp/package.json",
    AA_DEPENDENCY_LOCKFILE_PATH: "/tmp/package-lock.json",
  });

  assert.equal(config.dbPath, "/tmp/enterprise.db");
  assert.equal(config.environment, "prod");
  assert.equal(config.action, "export");
  assert.equal(config.artifactRoot, "/tmp/artifacts");
  assert.equal(config.taskId, "task-1");
  assert.equal(config.shiftOwner, "ops.lead");
});

test("operations cli env loader validates ops and platform enums", () => {
  assert.throws(
    () =>
      loadOpsProgramCliEnv({
        AA_DB_PATH: "/tmp/ops.db",
        AA_ENVIRONMENT: "qa",
      }),
    /invalid_env:AA_ENVIRONMENT/,
  );

  assert.throws(
    () =>
      loadPlatformOperatorCliEnv({
        AA_DB_PATH: "/tmp/platform.db",
        AA_ENVIRONMENT: "prod",
        AA_PLATFORM_TARGET_STATUS: "general",
      }),
    /invalid_env:AA_PLATFORM_TARGET_STATUS/,
  );
});

test("operations cli env loader parses environment deployment config", () => {
  const config = loadEnvironmentDeploymentCliEnv({
    AA_DB_PATH: "/tmp/deploy.db",
    AA_DEPLOYMENT_ACTION: "summary",
    AA_DEPLOYMENT_REPO_ROOT: "/repo",
    AA_DEPLOYMENT_TARGET_ENVIRONMENT: "staging",
    AA_DEPLOYMENT_ROLLOUT_STRATEGY: "blue_green",
    AA_DEPLOYMENT_VERSION: "1.2.3",
  }, "/fallback");

  assert.equal(config.dbPath, "/tmp/deploy.db");
  assert.equal(config.repoRootDir, "/repo");
  assert.equal(config.targetEnvironment, "staging");
  assert.equal(config.rolloutStrategy, "blue_green");
  assert.equal(config.version, "1.2.3");
});

test("operations cli env loader allows list-bundles without database path", () => {
  const config = loadEnvironmentDeploymentCliEnv({
    AA_DEPLOYMENT_ACTION: "list-bundles",
  }, "/repo");

  assert.equal(config.action, "list-bundles");
  assert.equal(config.dbPath, null);
  assert.equal(config.repoRootDir, "/repo");
});

test("operations cli env loader parses data-plane json payloads", () => {
  const config = loadDataPlaneCliEnv({
    AA_DB_PATH: "/tmp/data-plane.db",
    AA_DATA_PLANE_ACTION: "complete_movement_job",
    AA_JOB_ID: "job-1",
    AA_STATUS: "failed",
    AA_REPORT_JSON: "{\"reason\":\"quota\"}",
  });

  assert.equal(config.action, "complete_movement_job");
  assert.equal(config.jobId, "job-1");
  assert.equal(config.status, "failed");
  assert.deepEqual(config.report, { reason: "quota" });
});

test("operations cli env loader parses authoritative storage admin inputs", () => {
  const config = loadAuthoritativeStorageAdminCliEnv({
    AA_DB_PATH: "/tmp/authoritative.db",
    AA_AUTHORITATIVE_STORAGE_ACTION: "plan",
  });

  assert.equal(config.dbPath, "/tmp/authoritative.db");
  assert.equal(config.action, "plan");
});

test("operations cli env loader fail-closes on malformed data-plane json", () => {
  assert.throws(
    () =>
      loadDataPlaneCliEnv({
        AA_DB_PATH: "/tmp/data-plane.db",
        AA_DATA_PLANE_ACTION: "create_archive_bundle",
        AA_SOURCE_REFS_JSON: "{\"bad\":true}",
      }),
    /invalid_env:AA_SOURCE_REFS_JSON/,
  );
});
