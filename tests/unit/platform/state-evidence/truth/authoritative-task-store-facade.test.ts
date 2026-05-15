import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { AuthoritativeTaskStoreFacade } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/authoritative-task-store-facade.js";
import { ApprovalRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/approval-repository.js";
import { ArtifactRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/artifact-repository.js";
import { DispatchRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/dispatch-repository.js";
import { EvolutionRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/evolution-repository.js";
import { IntelligenceRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/intelligence-repository.js";
import { LockRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/lock-repository.js";
import { MarketplaceRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/marketplace-repository.js";
import { MemoryRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/memory-repository.js";
import { OperationsRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/operations-repository.js";
import { OrganizationRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/organization-repository.js";
import { ReleaseRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/release-repository.js";
import { SecretRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/secret-repository.js";
import { WorkflowRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/workflow-repository.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("AuthoritativeTaskStore repositories() returns cached standalone repositories", () => {
  const workspace = createTempWorkspace("aa-authoritative-store-facade-");
  const dbPath = join(workspace, "authoritative-store-facade.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repositories = store.repositories();
    const repositoriesAgain = store.repositories();

    assert.ok(repositories.workflow instanceof WorkflowRepository);
    assert.ok(repositories.approval instanceof ApprovalRepository);
    assert.ok(repositories.secret instanceof SecretRepository);
    assert.ok(repositories.marketplace instanceof MarketplaceRepository);
    assert.ok(repositories.release instanceof ReleaseRepository);
    assert.ok(repositories.organization instanceof OrganizationRepository);
    assert.ok(repositories.intelligence instanceof IntelligenceRepository);
    assert.ok(repositories.artifact instanceof ArtifactRepository);
    assert.ok(repositories.evolution instanceof EvolutionRepository);
    assert.ok(repositories.memory instanceof MemoryRepository);
    assert.ok(repositories.lock instanceof LockRepository);
    assert.ok(repositories.dispatch instanceof DispatchRepository);
    assert.ok(repositories.governance instanceof OperationsRepository);
    assert.ok(repositories.operations instanceof OperationsRepository);
    assert.equal(repositories, repositoriesAgain);
    assert.equal(repositories.governance, repositories.operations);

    for (const repository of [
      repositories.workflow,
      repositories.approval,
      repositories.secret,
      repositories.marketplace,
      repositories.release,
      repositories.organization,
      repositories.intelligence,
      repositories.artifact,
      repositories.evolution,
      repositories.memory,
      repositories.lock,
      repositories.dispatch,
      repositories.governance,
      repositories.operations,
    ]) {
      assert.notEqual(repository, store);
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStoreFacade reuses core repository composition", () => {
  const workspace = createTempWorkspace("aa-authoritative-store-facade-compat-");
  const dbPath = join(workspace, "authoritative-store-facade-compat.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStoreFacade(db);
    const repositories = store.repositories();

    assert.ok(repositories.secret instanceof SecretRepository);
    assert.ok(repositories.operations instanceof OperationsRepository);
    assert.equal(repositories, store.repositories());
    assert.equal(repositories.governance, repositories.operations);
  } finally {
    cleanupPath(workspace);
  }
});
