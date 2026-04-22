/**
 * Enterprise Governance CLI Tests
 *
 * Tests for enterprise-governance CLI module which provides governance oversight
 * including dependency manifest tracking, health monitoring, and diagnostics.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { loadEnterpriseGovernanceCliEnv } from "../../../../src/platform/control-plane/config-center/operations-cli-env.js";

describe("loadEnterpriseGovernanceCliEnv", () => {
  it("parses build_report action", () => {
    const config = loadEnterpriseGovernanceCliEnv({
      AA_ENTERPRISE_GOVERNANCE_ACTION: "build_report",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "dev",
    });

    assert.equal(config.action, "build_report");
    assert.equal(config.environment, "dev");
  });

  it("parses export action", () => {
    const config = loadEnterpriseGovernanceCliEnv({
      AA_ENTERPRISE_GOVERNANCE_ACTION: "export",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "prod",
    });

    assert.equal(config.action, "export");
    assert.equal(config.environment, "prod");
  });

  it("parses optional task_id filter", () => {
    const config = loadEnterpriseGovernanceCliEnv({
      AA_ENTERPRISE_GOVERNANCE_ACTION: "build_report",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "staging",
      AA_TASK_ID: "task-123",
    });

    assert.equal(config.taskId, "task-123");
  });

  it("parses optional shift_owner filter", () => {
    const config = loadEnterpriseGovernanceCliEnv({
      AA_ENTERPRISE_GOVERNANCE_ACTION: "build_report",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "prod",
      AA_SHIFT_OWNER: "oncall-team",
    });

    assert.equal(config.shiftOwner, "oncall-team");
  });

  it("parses optional dependency manifest paths", () => {
    const config = loadEnterpriseGovernanceCliEnv({
      AA_ENTERPRISE_GOVERNANCE_ACTION: "build_report",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "prod",
      AA_DEPENDENCY_MANIFEST_PATH: "/path/to/manifest.yaml",
      AA_DEPENDENCY_LOCKFILE_PATH: "/path/to/lockfile.json",
    });

    assert.equal(config.dependencyManifestPath, "/path/to/manifest.yaml");
    assert.equal(config.dependencyLockfilePath, "/path/to/lockfile.json");
  });

  it("parses optional artifact root", () => {
    const config = loadEnterpriseGovernanceCliEnv({
      AA_ENTERPRISE_GOVERNANCE_ACTION: "build_report",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "dev",
      AA_ARTIFACT_ROOT: "/tmp/artifacts",
    });

    assert.equal(config.artifactRoot, "/tmp/artifacts");
  });

  it("uses build_report as default action", () => {
    const config = loadEnterpriseGovernanceCliEnv({
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "dev",
    });

    assert.equal(config.action, "build_report");
  });
});
