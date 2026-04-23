import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { SkillGovernanceService } from "../../../../src/platform/execution/tool-executor/skill-governance-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
function resolveScriptPath() {
    return process.env.AA_TEST_SKILL_CREATOR_SCRIPT
        ?? join(process.cwd(), "dist", "src", "sdk", "cli", "skill-creator.js");
}
function runCli(env) {
    const stdout = execFileSync(process.execPath, [resolveScriptPath()], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            ...env,
        },
        encoding: "utf8",
    });
    return JSON.parse(stdout);
}
test("skill creator CLI can create scaffold and register it in the registry", () => {
    const workspace = createTempWorkspace("aa-skill-creator-cli-");
    const dbPath = join(workspace, "skill-creator.db");
    try {
        const created = runCli({
            AA_DB_PATH: dbPath,
            AA_SKILL_CREATOR_ACTION: "create",
            AA_SKILL_ROOT: join(workspace, "skills"),
            AA_SKILL_NAME: "Code Review Helper",
            AA_SKILL_DESCRIPTION: "Creates a reusable skill scaffold for code review tasks.",
            AA_SKILL_REQUIRED_TOOLS_JSON: JSON.stringify(["read", "bash"]),
            AA_SKILL_RESOURCE_DIRS_JSON: JSON.stringify(["scripts", "references"]),
            AA_SKILL_REGISTER: "true",
        });
        assert.equal(created.skillId, "code-review-helper");
        assert.equal(created.registered, true);
        assert.ok(existsSync(join(created.skillPath, "SKILL.md")));
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const governance = new SkillGovernanceService(store);
        const skill = governance.getSkill("code-review-helper");
        assert.ok(skill);
        assert.equal(skill?.name, "Code Review Helper");
        db.close();
        const validation = runCli({
            AA_SKILL_CREATOR_ACTION: "validate",
            AA_SKILL_PATH: created.skillPath,
        });
        assert.equal(validation.valid, true);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=skill-creator-cli.test.js.map