import test from "node:test";
import assert from "node:assert/strict";
import { loadOpsProgramCliEnv } from "../../../../src/platform/control-plane/config-center/operations-cli-env.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
test("loadOpsProgramCliEnv parses summary/export and fallback generic filter names", () => {
    const summary = loadOpsProgramCliEnv({
        AA_OPS_PROGRAM_ACTION: "summary",
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "dev",
        AA_TASK_ID: "task-789",
        AA_SHIFT_OWNER: "oncall-team",
        AA_ARTIFACT_ROOT: "/tmp/artifacts",
    });
    const exportConfig = loadOpsProgramCliEnv({
        AA_OPS_PROGRAM_ACTION: "export",
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "prod",
    });
    assert.equal(summary.taskId, "task-789");
    assert.equal(summary.shiftOwner, "oncall-team");
    assert.equal(summary.artifactRoot, "/tmp/artifacts");
    assert.equal(exportConfig.action, "export");
});
test("loadOpsProgramCliEnv uses summary as default action and requires environment", () => {
    const config = loadOpsProgramCliEnv({
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "dev",
    });
    assert.equal(config.action, "summary");
    assert.throws(() => loadOpsProgramCliEnv({
        AA_DB_PATH: "/tmp/test.db",
    }), (error) => error instanceof ValidationError && error.code === "missing_env:AA_ENVIRONMENT");
});
//# sourceMappingURL=ops-program.test.js.map