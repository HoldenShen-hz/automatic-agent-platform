import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { PerceptionService } from "../../../../src/scale-ecosystem/marketplace/perception-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedPerceptionDataset } from "../../../helpers/perception.js";

test("perception service exports briefs with persisted artifacts and idempotent proposals", () => {
  const workspace = createTempWorkspace("aa-perception-integration-");
  const dbPath = join(workspace, "perception-integration.db");
  const artifactRoot = join(workspace, "artifacts");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const seeded = seedPerceptionDataset(db, store);
    const service = new PerceptionService(db, store, {
      artifactStoreOptions: { rootDir: artifactRoot },
    });

    const firstProposals = service.proposeActions({ briefId: seeded.briefId });
    const secondProposals = service.proposeActions({ briefId: seeded.briefId });
    assert.equal(secondProposals.length, firstProposals.length);
    assert.deepEqual(
      [...secondProposals.map((proposal) => proposal.proposalId)].sort(),
      [...firstProposals.map((proposal) => proposal.proposalId)].sort(),
    );

    const exported = service.exportBrief(seeded.briefId);
    assert.equal(exported.items.length, 2);
    assert.ok(existsSync(exported.jsonArtifact.uri));
    assert.ok(existsSync(exported.markdownArtifact.uri));

    const artifacts = store.listArtifactsByTask("perception_reporting");
    assert.equal(artifacts.length, 2);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
