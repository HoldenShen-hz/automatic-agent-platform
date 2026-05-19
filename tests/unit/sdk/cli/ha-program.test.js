import test from "node:test";
import assert from "node:assert/strict";
import { loadHaProgramCliEnv } from "../../../../src/platform/control-plane/config-center/product-cli-env.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
test("loadHaProgramCliEnv parses actions and optional artifact root", () => {
    const summary = loadHaProgramCliEnv({
        AA_HA_PROGRAM_ACTION: "summary",
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "dev",
        AA_HA_PROGRAM_ARTIFACT_ROOT: "/tmp/artifacts",
    });
    const exportConfig = loadHaProgramCliEnv({
        AA_HA_PROGRAM_ACTION: "export",
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "prod",
    });
    assert.equal(summary.action, "summary");
    assert.equal(summary.artifactRoot, "/tmp/artifacts");
    assert.equal(exportConfig.action, "export");
});
test("loadHaProgramCliEnv uses summary as default action and requires environment", () => {
    const config = loadHaProgramCliEnv({
        AA_DB_PATH: "/tmp/test.db",
        AA_ENVIRONMENT: "dev",
    });
    assert.equal(config.action, "summary");
    assert.throws(() => loadHaProgramCliEnv({
        AA_DB_PATH: "/tmp/test.db",
    }), (error) => error instanceof ValidationError && error.code === "missing_env:AA_ENVIRONMENT");
});
//# sourceMappingURL=ha-program.test.js.map