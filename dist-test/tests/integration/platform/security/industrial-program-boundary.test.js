import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
const repoRoot = process.cwd();
function expectArtifactEscapeFailure(scriptName, env) {
    assert.throws(() => execFileSync(process.execPath, [join(repoRoot, "dist", "src", "sdk", "cli", scriptName)], {
        cwd: repoRoot,
        env: {
            ...process.env,
            ...env,
        },
        stdio: "pipe",
    }), /sandbox\./);
}
test("industrial program CLIs fail closed when artifact roots escape the workspace sandbox", () => {
    const workspace = createTempWorkspace("aa-industrial-program-boundary-");
    const outside = createTempWorkspace("aa-industrial-program-outside-");
    try {
        const dbPath = join(workspace, "industrial-program-boundary.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        db.close();
        expectArtifactEscapeFailure("ops-program.js", {
            AA_DB_PATH: dbPath,
            AA_ENVIRONMENT: "prod",
            AA_OPS_PROGRAM_ACTION: "export",
            AA_OPS_PROGRAM_ARTIFACT_ROOT: join(outside, "ops"),
        });
        expectArtifactEscapeFailure("ha-program.js", {
            AA_DB_PATH: dbPath,
            AA_ENVIRONMENT: "prod",
            AA_HA_PROGRAM_ACTION: "export",
            AA_HA_PROGRAM_ARTIFACT_ROOT: join(outside, "ha"),
        });
        expectArtifactEscapeFailure("compliance-program.js", {
            AA_DB_PATH: dbPath,
            AA_COMPLIANCE_PROGRAM_ACTION: "export",
            AA_COMPLIANCE_PROGRAM_ARTIFACT_ROOT: join(outside, "compliance"),
        });
    }
    finally {
        cleanupPath(workspace);
        cleanupPath(outside);
    }
});
//# sourceMappingURL=industrial-program-boundary.test.js.map