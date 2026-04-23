import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { loadEnterpriseGovernanceCliEnv } from "../../../../src/platform/control-plane/config-center/operations-cli-env.js";

describe("loadEnterpriseGovernanceCliEnv", () => {
  it("parses summary and export actions with current prefixes", () => {
    const summary = loadEnterpriseGovernanceCliEnv({
      AA_ENTERPRISE_GOVERNANCE_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "dev",
      AA_ENTERPRISE_GOVERNANCE_TASK_ID: "task-123",
      AA_ENTERPRISE_GOVERNANCE_SHIFT_OWNER: "oncall-team",
      AA_ENTERPRISE_GOVERNANCE_ARTIFACT_ROOT: "/tmp/artifacts",
    });
    const exportConfig = loadEnterpriseGovernanceCliEnv({
      AA_ENTERPRISE_GOVERNANCE_ACTION: "export",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "prod",
      AA_DEPENDENCY_MANIFEST_PATH: "/path/to/manifest.yaml",
      AA_DEPENDENCY_LOCKFILE_PATH: "/path/to/lockfile.json",
    });

    assert.equal(summary.action, "summary");
    assert.equal(summary.taskId, "task-123");
    assert.equal(summary.shiftOwner, "oncall-team");
    assert.equal(summary.artifactRoot, "/tmp/artifacts");
    assert.equal(exportConfig.action, "export");
    assert.equal(exportConfig.dependencyManifestPath, "/path/to/manifest.yaml");
    assert.equal(exportConfig.dependencyLockfilePath, "/path/to/lockfile.json");
  });

  it("uses summary as default action", () => {
    const config = loadEnterpriseGovernanceCliEnv({
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "dev",
    });

    assert.equal(config.action, "summary");
  });
});
