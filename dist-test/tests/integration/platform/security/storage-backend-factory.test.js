import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";
import { cleanupPath, createFile, createTempWorkspace } from "../../../helpers/fs.js";
function runModuleWithEnv(source, env) {
    const options = {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
            ...process.env,
            ...env,
        },
        stdio: ["ignore", "pipe", "pipe"],
    };
    try {
        const stdout = execFileSync(process.execPath, ["--input-type=module", "--eval", source], options);
        return {
            stdout,
            stderr: "",
            status: 0,
        };
    }
    catch (error) {
        const failure = error;
        return {
            stdout: failure.stdout ?? "",
            stderr: failure.stderr ?? "",
            status: failure.status ?? 1,
        };
    }
}
function distModuleHref(relativePathFromTest) {
    return new URL(relativePathFromTest, import.meta.url).href;
}
test("single-task runtime routes postgres dual-run sync access through shadow sqlite", async () => {
    const workspace = createTempWorkspace("aa-storage-runtime-sec-");
    const dbPath = join(workspace, "single-task.db");
    const shadowPath = join(workspace, "shadow", "runtime.db");
    try {
        createFile(shadowPath, "");
        const source = `
      import { runSingleTaskExecution } from ${JSON.stringify(distModuleHref("../../../../src/platform/execution/execution-engine/single-task-execution.js"))};
      void (async () => {
        await runSingleTaskExecution({
          dbPath: ${JSON.stringify(dbPath)},
          title: "Single-task storage fail-close",
          request: "Verify postgres execution fail-close."
        });
      })();
    `;
        const result = runModuleWithEnv(source, {
            AA_CONFIG_ENV: "staging",
            AA_STORAGE_DRIVER: "postgres",
            AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
            AA_STORAGE_POSTGRES_DUAL_RUN: "true",
            AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH: shadowPath,
        });
        assert.equal(result.status, 0);
        assert.equal(result.stderr, "");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("multi-step runtime routes postgres dual-run sync access through shadow sqlite", () => {
    const workspace = createTempWorkspace("aa-storage-runtime-sec-");
    const dbPath = join(workspace, "multi-step.db");
    const shadowPath = join(workspace, "shadow", "runtime.db");
    try {
        createFile(shadowPath, "");
        const source = `
      import { runMultiStepOrchestration } from ${JSON.stringify(distModuleHref("../../../../src/platform/execution/execution-engine/multi-step-orchestration.js"))};
      void (async () => {
        await runMultiStepOrchestration({
          dbPath: ${JSON.stringify(dbPath)},
          title: "Multi-step storage fail-close",
          request: "Verify postgres execution fail-close."
        });
      })();
    `;
        const result = runModuleWithEnv(source, {
            AA_CONFIG_ENV: "staging",
            AA_STORAGE_DRIVER: "postgres",
            AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
            AA_STORAGE_POSTGRES_DUAL_RUN: "true",
            AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH: shadowPath,
        });
        assert.equal(result.status, 0);
        assert.equal(result.stderr, "");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("cli authoritative storage context routes postgres dual-run sync access through the shadow sqlite database", () => {
    const workspace = createTempWorkspace("aa-storage-cli-sec-");
    const dbPath = join(workspace, "single-task.db");
    const shadowPath = join(workspace, "shadow", "runtime.db");
    try {
        createFile(shadowPath, "");
        const source = `
      import { openCliAuthoritativeStorageContext } from ${JSON.stringify(distModuleHref("../../../../src/sdk/cli/authoritative-storage.js"))};
      const storage = openCliAuthoritativeStorageContext(${JSON.stringify(dbPath)});
      storage.migrate();
    `;
        const result = runModuleWithEnv(source, {
            AA_CONFIG_ENV: "staging",
            AA_STORAGE_DRIVER: "postgres",
            AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
            AA_STORAGE_POSTGRES_DUAL_RUN: "true",
            AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH: shadowPath,
        });
        assert.equal(result.status, 0);
        assert.equal(result.stderr, "");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("authoritative storage admin uses the async postgres path and surfaces driver installation requirements", () => {
    const workspace = createTempWorkspace("aa-storage-admin-sec-");
    const dbPath = join(workspace, "single-task.db");
    const shadowPath = join(workspace, "shadow", "runtime.db");
    try {
        createFile(shadowPath, "");
        const source = `
      await import(${JSON.stringify(distModuleHref("../../../../src/sdk/cli/authoritative-storage-admin.js"))});
    `;
        const result = runModuleWithEnv(source, {
            AA_DB_PATH: dbPath,
            AA_AUTHORITATIVE_STORAGE_ACTION: "summary",
            AA_CONFIG_ENV: "staging",
            AA_STORAGE_DRIVER: "postgres",
            AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
            AA_STORAGE_POSTGRES_DUAL_RUN: "true",
            AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH: shadowPath,
        });
        assert.notEqual(result.status, 0);
        // Accept either: driver_not_installed (when postgres package unavailable)
        // or connection_failed (when postgres IS installed but host unreachable)
        assert.ok(/storage\.postgres_driver_not_installed|postgres\.connection_failed/.test(result.stderr), `Expected fail-close error, got: ${result.stderr}`);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=storage-backend-factory.test.js.map