/**
 * Ops Command Tests
 *
 * Tests for ops-program and ops-governance CLI modules.
 * These tests verify the env loaders and schema validation for operations commands.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadOpsProgramCliEnv } from "../../../../src/platform/control-plane/config-center/operations-cli-env.js";
import { loadOpsGovernanceCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
test("loadOpsProgramCliEnv parses valid summary action", () => {
    const config = loadOpsProgramCliEnv({
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "development",
        AA_OPS_PROGRAM_ACTION: "summary",
    });
    assert.equal(config.action, "summary");
    assert.equal(config.environment, "development");
});
test("loadOpsProgramCliEnv parses valid export action", () => {
    const config = loadOpsProgramCliEnv({
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "production",
        AA_OPS_PROGRAM_ACTION: "export",
    });
    assert.equal(config.action, "export");
    assert.equal(config.environment, "production");
});
test("loadOpsProgramCliEnv uses default action when not specified", () => {
    const config = loadOpsProgramCliEnv({
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "staging",
    });
    assert.equal(config.action, "summary");
});
test("loadOpsProgramCliEnv handles optional artifact root", () => {
    const config = loadOpsProgramCliEnv({
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "development",
        AA_OPS_PROGRAM_ARTIFACT_ROOT: "/tmp/artifacts",
    });
    assert.equal(config.artifactRoot, "/tmp/artifacts");
});
test("loadOpsProgramCliEnv handles optional taskId", () => {
    const config = loadOpsProgramCliEnv({
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "development",
        AA_OPS_PROGRAM_TASK_ID: "task_ops_123",
    });
    assert.equal(config.taskId, "task_ops_123");
});
test("loadOpsProgramCliEnv handles optional shiftOwner", () => {
    const config = loadOpsProgramCliEnv({
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "production",
        AA_OPS_PROGRAM_SHIFT_OWNER: "ops-team",
    });
    assert.equal(config.shiftOwner, "ops-team");
});
test("loadOpsProgramCliEnv handles all optional fields together", () => {
    const config = loadOpsProgramCliEnv({
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "staging",
        AA_OPS_PROGRAM_ACTION: "export",
        AA_OPS_PROGRAM_ARTIFACT_ROOT: "/artifacts",
        AA_OPS_PROGRAM_TASK_ID: "task_789",
        AA_OPS_PROGRAM_SHIFT_OWNER: "night-shift",
    });
    assert.equal(config.action, "export");
    assert.equal(config.artifactRoot, "/artifacts");
    assert.equal(config.taskId, "task_789");
    assert.equal(config.shiftOwner, "night-shift");
});
test("loadOpsGovernanceCliEnv parses valid governance action", () => {
    const config = loadOpsGovernanceCliEnv({
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "prod",
        AA_OPS_GOVERNANCE_ACTION: "check",
    });
    assert.equal(config.action, "check");
});
test("loadOpsGovernanceCliEnv parses report action", () => {
    const config = loadOpsGovernanceCliEnv({
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "prod",
        AA_OPS_GOVERNANCE_ACTION: "report",
    });
    assert.equal(config.action, "report");
});
test("loadOpsGovernanceCliEnv parses audit action", () => {
    const config = loadOpsGovernanceCliEnv({
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "prod",
        AA_OPS_GOVERNANCE_ACTION: "audit",
    });
    assert.equal(config.action, "audit");
});
test("loadOpsGovernanceCliEnv uses default action when not specified", () => {
    const config = loadOpsGovernanceCliEnv({
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "prod",
    });
    assert.equal(config.action, "check");
});
test("loadOpsGovernanceCliEnv handles optional parameters", () => {
    const config = loadOpsGovernanceCliEnv({
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "prod",
        AA_OPS_GOVERNANCE_ACTION: "report",
    });
    assert.equal(config.action, "report");
    assert.equal(config.dbPath, "/tmp/test.db");
});
test("loadOpsGovernanceCliEnv throws invalid_env for unknown action", () => {
    assert.throws(() => loadOpsGovernanceCliEnv({
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "prod",
        AA_OPS_GOVERNANCE_ACTION: "unknown_action",
    }), (e) => e instanceof ValidationError && e.code.includes("invalid_env"));
});
//# sourceMappingURL=ops-command.test.js.map