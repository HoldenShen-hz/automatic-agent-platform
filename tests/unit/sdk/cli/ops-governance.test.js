/**
 * Ops Governance CLI Tests
 *
 * Tests for ops-governance CLI module which provides health diagnostics,
 * system reports, and operational governance oversight.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadOpsGovernanceCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
test("loadOpsGovernanceCliEnv parses check action (default)", () => {
    const config = loadOpsGovernanceCliEnv({
        AA_OPS_GOVERNANCE_ACTION: "check",
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "dev",
    });
    assert.equal(config.action, "check");
    assert.equal(config.environment, "dev");
});
test("loadOpsGovernanceCliEnv parses export action", () => {
    const config = loadOpsGovernanceCliEnv({
        AA_OPS_GOVERNANCE_ACTION: "export",
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "prod",
    });
    assert.equal(config.action, "export");
    assert.equal(config.environment, "prod");
});
test("loadOpsGovernanceCliEnv parses report action", () => {
    const config = loadOpsGovernanceCliEnv({
        AA_OPS_GOVERNANCE_ACTION: "report",
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "staging",
    });
    assert.equal(config.action, "report");
    assert.equal(config.environment, "staging");
});
test("loadOpsGovernanceCliEnv parses audit action", () => {
    const config = loadOpsGovernanceCliEnv({
        AA_OPS_GOVERNANCE_ACTION: "audit",
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "prod",
    });
    assert.equal(config.action, "audit");
});
test("loadOpsGovernanceCliEnv parses optional task_id filter", () => {
    const config = loadOpsGovernanceCliEnv({
        AA_OPS_GOVERNANCE_ACTION: "check",
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "staging",
        AA_OPS_TASK_ID: "task-456",
    });
    assert.equal(config.taskId, "task-456");
});
test("loadOpsGovernanceCliEnv parses optional artifact root", () => {
    const config = loadOpsGovernanceCliEnv({
        AA_OPS_GOVERNANCE_ACTION: "check",
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "dev",
        AA_OPS_ARTIFACT_ROOT: "/tmp/artifacts",
    });
    assert.equal(config.artifactRoot, "/tmp/artifacts");
});
test("loadOpsGovernanceCliEnv parses optional generated_at", () => {
    const config = loadOpsGovernanceCliEnv({
        AA_OPS_GOVERNANCE_ACTION: "check",
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "dev",
        AA_GENERATED_AT: "2024-01-15T10:00:00Z",
    });
    assert.equal(config.generatedAt, "2024-01-15T10:00:00Z");
});
test("loadOpsGovernanceCliEnv uses check as default action", () => {
    const config = loadOpsGovernanceCliEnv({
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "dev",
    });
    assert.equal(config.action, "check");
});
//# sourceMappingURL=ops-governance.test.js.map