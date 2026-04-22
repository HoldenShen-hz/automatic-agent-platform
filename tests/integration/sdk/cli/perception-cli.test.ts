import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { runBuiltCliExpectFailure } from "../../../helpers/cli.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function runCli<T>(env: NodeJS.ProcessEnv): T {
  const stdout = execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "sdk", "cli", "perception.js")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  });
  return JSON.parse(stdout) as T;
}

test("perception CLI can register sources, ingest intel, build briefs, propose actions, and export briefs", () => {
  const workspace = createTempWorkspace("aa-perception-cli-");
  const dbPath = join(workspace, "perception-cli.db");
  const artifactRoot = join(workspace, "artifacts");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.close();

    const source = runCli<{ sourceId: string }>({
      AA_DB_PATH: dbPath,
      AA_PERCEPTION_ACTION: "upsert_source",
      AA_SOURCE_ID: "source-cli-1",
      AA_SOURCE_TYPE: "rss",
      AA_SOURCE_NAME: "CLI Source",
      AA_SOURCE_PRIORITY: "9",
    });
    assert.equal(source.sourceId, "source-cli-1");

    const ingested = runCli<{ insertedItems: Array<{ intelId: string }>; skippedDuplicateCount: number }>({
      AA_DB_PATH: dbPath,
      AA_PERCEPTION_ACTION: "ingest",
      AA_SOURCE_ID: "source-cli-1",
      AA_INTEL_ITEMS_JSON: JSON.stringify([
        {
          title: "CLI incident signal",
          summary: "A significant signal arrived through the CLI ingestion path.",
          rawRef: "https://example.test/cli-incident",
          relevanceScore: 0.91,
          importance: 0.95,
          tags: ["incident", "cli"],
          capturedAt: "2026-04-08T11:00:00.000Z",
          ttlHours: 24,
        },
      ]),
    });
    assert.equal(ingested.insertedItems.length, 1);
    assert.equal(ingested.skippedDuplicateCount, 0);

    const brief = runCli<{ brief: { briefId: string }; items: Array<{ intelId: string }> }>({
      AA_DB_PATH: dbPath,
      AA_PERCEPTION_ACTION: "brief",
      AA_SOURCE_IDS_JSON: JSON.stringify(["source-cli-1"]),
      AA_BRIEF_GENERATED_AT: "2026-04-08T11:10:00.000Z",
    });
    assert.equal(brief.items.length, 1);

    const proposals = runCli<Array<{ proposalId: string }>>({
      AA_DB_PATH: dbPath,
      AA_PERCEPTION_ACTION: "propose",
      AA_BRIEF_ID: brief.brief.briefId,
    });
    assert.equal(proposals.length, 1);

    const exported = runCli<{ jsonArtifact: { uri: string }; markdownArtifact: { uri: string } }>({
      AA_DB_PATH: dbPath,
      AA_PERCEPTION_ACTION: "export",
      AA_BRIEF_ID: brief.brief.briefId,
      AA_ARTIFACT_ROOT: artifactRoot,
    });
    assert.match(exported.jsonArtifact.uri, /intel-brief-/);
    assert.match(exported.markdownArtifact.uri, /intel-brief-/);

    const db2 = new SqliteDatabase(dbPath);
    db2.migrate();
    const store2 = new AuthoritativeTaskStore(db2);
    assert.equal(store2.listPerceptionSources().length, 1);
    assert.equal(store2.listIntelBriefs(10).length, 1);
    assert.equal(store2.listActionProposalsByBrief(brief.brief.briefId).length, 1);
    db2.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("perception CLI fail-closes when postgres storage execution is requested", () => {
  const failure = runBuiltCliExpectFailure("perception.js", {
    AA_DB_PATH: "/tmp/perception-postgres.db",
    AA_PERCEPTION_ACTION: "sources",
    AA_STORAGE_DRIVER: "postgres",
    AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
  });

  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});
