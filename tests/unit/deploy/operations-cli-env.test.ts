/**
 * Operations CLI Env Tests
 *
 * Tests for the operations CLI environment variable loaders
 * including enterprise governance, ops program, and environment deployment.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  loadEnterpriseGovernanceCliEnv,
  loadOpsProgramCliEnv,
  loadEnvironmentDeploymentCliEnv,
  loadPlatformOperatorCliEnv,
  loadDataPlaneCliEnv,
  loadAcceptanceReadinessCliEnv,
} from "../../../src/platform/five-plane-control-plane/config-center/operations-cli-env.js";

test("loadEnterpriseGovernanceCliEnv parses enterprise governance config", () => {
  const config = loadEnterpriseGovernanceCliEnv({
    AA_DB_PATH: "/tmp/governance.db",
    AA_ENVIRONMENT: "prod",
    AA_ENTERPRISE_GOVERNANCE_ACTION: "export",
    AA_ENTERPRISE_GOVERNANCE_ARTIFACT_ROOT: "/tmp/artifacts",
    AA_ENTERPRISE_GOVERNANCE_TASK_ID: "task-1",
    AA_ENTERPRISE_GOVERNANCE_SHIFT_OWNER: "ops.lead",
    AA_DEPENDENCY_MANIFEST_PATH: "/tmp/manifest.json",
    AA_DEPENDENCY_LOCKFILE_PATH: "/tmp/lock.json",
  });

  assert.equal(config.dbPath, "/tmp/governance.db");
  assert.equal(config.environment, "prod");
  assert.equal(config.action, "export");
  assert.equal(config.artifactRoot, "/tmp/artifacts");
  assert.equal(config.taskId, "task-1");
  assert.equal(config.shiftOwner, "ops.lead");
  assert.equal(config.dependencyManifestPath, "/tmp/manifest.json");
  assert.equal(config.dependencyLockfilePath, "/tmp/lock.json");
});

test("loadEnterpriseGovernanceCliEnv defaults action to summary", () => {
  const config = loadEnterpriseGovernanceCliEnv({
    AA_DB_PATH: "/tmp/db",
    AA_ENVIRONMENT: "dev",
  });

  assert.equal(config.action, "summary");
});

test("loadEnterpriseGovernanceCliEnv rejects invalid environment", () => {
  assert.throws(
    () =>
      loadEnterpriseGovernanceCliEnv({
        AA_DB_PATH: "/tmp/db",
        AA_ENVIRONMENT: "invalid",
      }),
    /invalid_env:AA_ENVIRONMENT/,
  );
});

test("loadOpsProgramCliEnv parses ops program config", () => {
  const config = loadOpsProgramCliEnv({
    AA_DB_PATH: "/tmp/ops.db",
    AA_ENVIRONMENT: "staging",
    AA_OPS_PROGRAM_ACTION: "export",
    AA_OPS_PROGRAM_ARTIFACT_ROOT: "/tmp/ops-artifacts",
    AA_OPS_PROGRAM_TASK_ID: "ops-task-1",
    AA_OPS_PROGRAM_SHIFT_OWNER: "shift-lead",
  });

  assert.equal(config.dbPath, "/tmp/ops.db");
  assert.equal(config.environment, "staging");
  assert.equal(config.action, "export");
  assert.equal(config.artifactRoot, "/tmp/ops-artifacts");
  assert.equal(config.taskId, "ops-task-1");
  assert.equal(config.shiftOwner, "shift-lead");
});

test("loadOpsProgramCliEnv accepts AA_HA_PROGRAM_ACTION as fallback", () => {
  const config = loadOpsProgramCliEnv({
    AA_DB_PATH: "/tmp/ops.db",
    AA_ENVIRONMENT: "test",
    AA_HA_PROGRAM_ACTION: "export",
  });

  assert.equal(config.action, "export");
});

test("loadOpsProgramCliEnv defaults to summary action", () => {
  const config = loadOpsProgramCliEnv({
    AA_DB_PATH: "/tmp/ops.db",
    AA_ENVIRONMENT: "dev",
  });

  assert.equal(config.action, "summary");
});

test("loadOpsProgramCliEnv uses AA_ARTIFACT_ROOT as fallback for artifactRoot", () => {
  const config = loadOpsProgramCliEnv({
    AA_DB_PATH: "/tmp/ops.db",
    AA_ENVIRONMENT: "dev",
    AA_ARTIFACT_ROOT: "/fallback/artifacts",
  });

  assert.equal(config.artifactRoot, "/fallback/artifacts");
});

test("loadPlatformOperatorCliEnv parses platform operator config", () => {
  const config = loadPlatformOperatorCliEnv({
    AA_DB_PATH: "/tmp/platform.db",
    AA_ENVIRONMENT: "prod",
    AA_PLATFORM_ACTION: "export",
    AA_PLATFORM_ARTIFACT_ROOT: "/tmp/platform-artifacts",
    AA_PLATFORM_TARGET_STATUS: "production_ready",
    AA_PLATFORM_EVIDENCE_ROOT: "/tmp/evidence",
    AA_PLATFORM_OUTPUT_DIR: "/tmp/output",
    AA_GENERATED_AT: "2026-04-26T00:00:00.000Z",
  });

  assert.equal(config.dbPath, "/tmp/platform.db");
  assert.equal(config.environment, "prod");
  assert.equal(config.action, "export");
  assert.equal(config.artifactRoot, "/tmp/platform-artifacts");
  assert.equal(config.targetStatus, "production_ready");
  assert.equal(config.evidenceRootDir, "/tmp/evidence");
  assert.equal(config.outputDir, "/tmp/output");
});

test("loadPlatformOperatorCliEnv defaults targetStatus to canary", () => {
  const config = loadPlatformOperatorCliEnv({
    AA_DB_PATH: "/tmp/db",
    AA_ENVIRONMENT: "prod",
  });

  assert.equal(config.targetStatus, "canary");
});

test("loadPlatformOperatorCliEnv rejects invalid target status", () => {
  assert.throws(
    () =>
      loadPlatformOperatorCliEnv({
        AA_DB_PATH: "/tmp/db",
        AA_ENVIRONMENT: "prod",
        AA_PLATFORM_TARGET_STATUS: "invalid",
      }),
    /invalid_env:AA_PLATFORM_TARGET_STATUS/,
  );
});

test("loadAcceptanceReadinessCliEnv parses acceptance readiness config", () => {
  const config = loadAcceptanceReadinessCliEnv({
    AA_DB_PATH: "/tmp/acceptance.db",
    AA_ACCEPTANCE_READINESS_ACTION: "export",
    AA_ACCEPTANCE_READINESS_REPO_ROOT: "/repo",
    AA_ACCEPTANCE_READINESS_EVIDENCE_ROOT: "/evidence",
    AA_ACCEPTANCE_READINESS_ARTIFACT_ROOT: "/artifacts",
    AA_ACCEPTANCE_READINESS_TARGET_ENVIRONMENT: "prod",
    AA_ACCEPTANCE_READINESS_VERSION: "1.0.0",
    AA_ACCEPTANCE_READINESS_COMMIT_SHA: "abcdef12",
    AA_ACCEPTANCE_READINESS_ROLLOUT_STRATEGY: "canary",
  });

  assert.equal(config.dbPath, "/tmp/acceptance.db");
  assert.equal(config.action, "export");
  assert.equal(config.repoRootDir, "/repo");
  assert.equal(config.evidenceRootDir, "/evidence");
  assert.equal(config.artifactRoot, "/artifacts");
  assert.equal(config.targetEnvironment, "prod");
  assert.equal(config.version, "1.0.0");
  assert.equal(config.commitSha, "abcdef12");
  assert.equal(config.rolloutStrategy, "canary");
});

test("loadAcceptanceReadinessCliEnv defaults target environment to prod", () => {
  const config = loadAcceptanceReadinessCliEnv({
    AA_DB_PATH: "/tmp/db",
  });

  assert.equal(config.targetEnvironment, "prod");
});

test("loadAcceptanceReadinessCliEnv defaults action to summary", () => {
  const config = loadAcceptanceReadinessCliEnv({
    AA_DB_PATH: "/tmp/db",
  });

  assert.equal(config.action, "summary");
});

test("loadDataPlaneCliEnv parses data plane config", () => {
  const config = loadDataPlaneCliEnv({
    AA_DB_PATH: "/tmp/dataplane.db",
    AA_DATA_PLANE_ACTION: "create_analytics_fact",
    AA_ARTIFACT_ROOT: "/artifacts",
    AA_NAMESPACE_ID: "ns-1",
    AA_FACT_ID: "fact-1",
    AA_METRIC_NAME: "test_metric",
    AA_DIMENSIONS_JSON: '{"region":"us"}',
    AA_VALUE: "100",
    AA_VERSION: "1.0.0",
  });

  assert.equal(config.dbPath, "/tmp/dataplane.db");
  assert.equal(config.action, "create_analytics_fact");
  assert.equal(config.artifactRoot, "/artifacts");
  assert.equal(config.namespaceId, "ns-1");
  assert.equal(config.factId, "fact-1");
  assert.equal(config.metricName, "test_metric");
  assert.deepEqual(config.dimensions, { region: "us" });
  assert.equal(config.value, 100);
  assert.equal(config.version, "1.0.0");
});

test("loadDataPlaneCliEnv parses movement job config", () => {
  const config = loadDataPlaneCliEnv({
    AA_DB_PATH: "/tmp/dataplane.db",
    AA_DATA_PLANE_ACTION: "start_movement_job",
    AA_JOB_ID: "job-1",
    AA_SOURCE_NAMESPACE_ID: "source-ns",
    AA_TARGET_NAMESPACE_ID: "target-ns",
    AA_MOVEMENT_TYPE: "analytics_etl",
    AA_INPUT_REFS_JSON: '["ref1","ref2"]',
  });

  assert.equal(config.action, "start_movement_job");
  assert.equal(config.jobId, "job-1");
  assert.equal(config.sourceNamespaceId, "source-ns");
  assert.equal(config.targetNamespaceId, "target-ns");
  assert.equal(config.movementType, "analytics_etl");
  assert.deepEqual(config.inputRefs, ["ref1", "ref2"]);
});

test("loadDataPlaneCliEnv parses complete_movement_job with status", () => {
  const config = loadDataPlaneCliEnv({
    AA_DB_PATH: "/tmp/dataplane.db",
    AA_DATA_PLANE_ACTION: "complete_movement_job",
    AA_JOB_ID: "job-1",
    AA_STATUS: "failed",
    AA_REPORT_JSON: '{"reason":"quota_exceeded"}',
  });

  assert.equal(config.action, "complete_movement_job");
  assert.equal(config.jobId, "job-1");
  assert.equal(config.status, "failed");
  assert.deepEqual(config.report, { reason: "quota_exceeded" });
});

test("loadDataPlaneCliEnv defaults action to summary", () => {
  const config = loadDataPlaneCliEnv({
    AA_DB_PATH: "/tmp/dataplane.db",
  });

  assert.equal(config.action, "summary");
});

test("loadDataPlaneCliEnv parses tenant id", () => {
  const config = loadDataPlaneCliEnv({
    AA_DB_PATH: "/tmp/dataplane.db",
    AA_TENANT_ID: "tenant-123",
  });

  assert.equal(config.tenantId, "tenant-123");
});