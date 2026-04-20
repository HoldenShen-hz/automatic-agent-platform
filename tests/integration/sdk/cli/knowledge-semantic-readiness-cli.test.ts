import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../");
const CLI_PATH = `${REPO_ROOT}/dist/src/cli/knowledge-semantic-readiness.js`;

test("knowledge-semantic-readiness CLI fails closed when pgvector prerequisites are not met", () => {
  const workspace = createTempWorkspace("aa-knowledge-semantic-readiness-cli-");
  const dbPath = join(workspace, "knowledge-semantic-readiness.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  try {
    const result = spawnSync("node", ["--enable-source-maps", CLI_PATH], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        AA_DB_PATH: dbPath,
        AA_KNOWLEDGE_VECTOR_BACKEND: "pgvector",
        NODE_NO_WARNINGS: "1",
      },
      encoding: "utf8",
    });

    assert.equal(result.status, 1);
    const output = JSON.parse(result.stdout) as {
      ready: boolean;
      checks: Array<{ name: string; ok: boolean; errorCode: string | null }>;
    };
    assert.equal(output.ready, false);
    assert.equal(output.checks[0]?.name, "storage_driver_postgres");
    assert.equal(output.checks[0]?.ok, false);
    assert.match(output.checks[0]?.errorCode ?? "", /requires_postgres_driver/);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});
