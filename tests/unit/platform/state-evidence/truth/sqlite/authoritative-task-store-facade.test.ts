import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { AuthoritativeTaskStoreFacade } from "../../../../../../src/platform/state-evidence/truth/sqlite/authoritative-task-store-facade.js";
import { AuthoritativeTaskStore } from "../../../../../../src/platform/state-evidence/truth/sqlite/authoritative-task-store-core.js";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { TaskRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/task-repository.js";
import { WorkflowRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/workflow-repository.js";
import { ExecutionRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/execution-repository.js";
import { SessionRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/session-repository.js";
import { EventRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/event-repository.js";
import { WorkerRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/worker-repository.js";
import { ApprovalRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/approval-repository.js";
import { BillingRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/billing-repository.js";
import { LeaseRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/lease-repository.js";
import { LockRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/lock-repository.js";
import { MemoryRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/memory-repository.js";
import { ArtifactRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/artifact-repository.js";
import { DispatchRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/dispatch-repository.js";
import { DivisionRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/division-repository.js";
import { SecretRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/secret-repository.js";
import { MarketplaceRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/marketplace-repository.js";
import { ReleaseRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/release-repository.js";
import { OrganizationRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/organization-repository.js";
import { IntelligenceRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/intelligence-repository.js";
import { EvolutionRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/evolution-repository.js";
import { OperationsRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/operations-repository.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";

test("AuthoritativeTaskStoreFacade extends AuthoritativeTaskStore", () => {
  const workspace = createTempWorkspace("aa-facade-extends-");
  const dbPath = join(workspace, "facade-extends.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const facade = new AuthoritativeTaskStoreFacade(db);

    assert.ok(facade instanceof AuthoritativeTaskStore);
    assert.ok(facade instanceof AuthoritativeTaskStoreFacade);
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStoreFacade constructor accepts SqliteDatabase", () => {
  const workspace = createTempWorkspace("aa-facade-ctor-");
  const dbPath = join(workspace, "facade-ctor.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const facade = new AuthoritativeTaskStoreFacade(db);

    assert.ok(facade.db != null);
    assert.equal(facade.db.filePath, dbPath);
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStoreFacade repositories() returns all expected repositories", () => {
  const workspace = createTempWorkspace("aa-facade-repos-");
  const dbPath = join(workspace, "facade-repos.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const facade = new AuthoritativeTaskStoreFacade(db);
    const repos = facade.repositories();

    assert.ok(repos.task instanceof TaskRepository);
    assert.ok(repos.workflow instanceof WorkflowRepository);
    assert.ok(repos.execution instanceof ExecutionRepository);
    assert.ok(repos.session instanceof SessionRepository);
    assert.ok(repos.event instanceof EventRepository);
    assert.ok(repos.worker instanceof WorkerRepository);
    assert.ok(repos.approval instanceof ApprovalRepository);
    assert.ok(repos.billing instanceof BillingRepository);
    assert.ok(repos.lease instanceof LeaseRepository);
    assert.ok(repos.lock instanceof LockRepository);
    assert.ok(repos.memory instanceof MemoryRepository);
    assert.ok(repos.artifact instanceof ArtifactRepository);
    assert.ok(repos.dispatch instanceof DispatchRepository);
    assert.ok(repos.division instanceof DivisionRepository);
    assert.ok(repos.secret instanceof SecretRepository);
    assert.ok(repos.marketplace instanceof MarketplaceRepository);
    assert.ok(repos.release instanceof ReleaseRepository);
    assert.ok(repos.organization instanceof OrganizationRepository);
    assert.ok(repos.intelligence instanceof IntelligenceRepository);
    assert.ok(repos.evolution instanceof EvolutionRepository);
    assert.ok(repos.governance instanceof OperationsRepository);
    assert.ok(repos.operations instanceof OperationsRepository);
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStoreFacade repositories() returns cached instance", () => {
  const workspace = createTempWorkspace("aa-facade-cache-");
  const dbPath = join(workspace, "facade-cache.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const facade = new AuthoritativeTaskStoreFacade(db);
    const repos1 = facade.repositories();
    const repos2 = facade.repositories();

    assert.equal(repos1, repos2);
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStoreFacade governance and operations are same instance", () => {
  const workspace = createTempWorkspace("aa-facade-ops-");
  const dbPath = join(workspace, "facade-ops.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const facade = new AuthoritativeTaskStoreFacade(db);
    const repos = facade.repositories();

    assert.equal(repos.governance, repos.operations);
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStoreFacade facade reuses core repository composition", () => {
  const workspace = createTempWorkspace("aa-facade-composition-");
  const dbPath = join(workspace, "facade-composition.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const facade = new AuthoritativeTaskStoreFacade(db);

    const storeRepos = store.repositories();
    const facadeRepos = facade.repositories();

    // Both should have governance and operations pointing to same instance
    assert.equal(storeRepos.governance, storeRepos.operations);
    assert.equal(facadeRepos.governance, facadeRepos.operations);
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStoreFacade withConnection passes connection correctly", () => {
  const workspace = createTempWorkspace("aa-facade-conn-");
  const dbPath = join(workspace, "facade-conn.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const facade = new AuthoritativeTaskStoreFacade(db);

    const result = facade.withConnection((conn) => {
      return conn;
    });

    assert.ok(result != null);
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStoreFacade repository accessors return correct repositories", () => {
  const workspace = createTempWorkspace("aa-facade-accessors-");
  const dbPath = join(workspace, "facade-accessors.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const facade = new AuthoritativeTaskStoreFacade(db);

    assert.ok(facade.task instanceof TaskRepository);
    assert.ok(facade.workflow instanceof WorkflowRepository);
    assert.ok(facade.execution instanceof ExecutionRepository);
    assert.ok(facade.session instanceof SessionRepository);
    assert.ok(facade.event instanceof EventRepository);
    assert.ok(facade.worker instanceof WorkerRepository);
    assert.ok(facade.approval instanceof ApprovalRepository);
    assert.ok(facade.billing instanceof BillingRepository);
    assert.ok(facade.lease instanceof LeaseRepository);
    assert.ok(facade.lock instanceof LockRepository);
    assert.ok(facade.memory instanceof MemoryRepository);
    assert.ok(facade.artifact instanceof ArtifactRepository);
    assert.ok(facade.dispatch instanceof DispatchRepository);
    assert.ok(facade.division instanceof DivisionRepository);
    assert.ok(facade.secret instanceof SecretRepository);
    assert.ok(facade.marketplace instanceof MarketplaceRepository);
    assert.ok(facade.release instanceof ReleaseRepository);
    assert.ok(facade.organization instanceof OrganizationRepository);
    assert.ok(facade.intelligence instanceof IntelligenceRepository);
    assert.ok(facade.evolution instanceof EvolutionRepository);
    assert.ok(facade.governance instanceof OperationsRepository);
    assert.ok(facade.operations instanceof OperationsRepository);
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStoreFacade accessors are consistent with repositories()", () => {
  const workspace = createTempWorkspace("aa-facade-consistent-");
  const dbPath = join(workspace, "facade-consistent.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const facade = new AuthoritativeTaskStoreFacade(db);
    const repos = facade.repositories();

    assert.equal(facade.task, repos.task);
    assert.equal(facade.workflow, repos.workflow);
    assert.equal(facade.execution, repos.execution);
    assert.equal(facade.session, repos.session);
    assert.equal(facade.event, repos.event);
    assert.equal(facade.worker, repos.worker);
    assert.equal(facade.approval, repos.approval);
    assert.equal(facade.billing, repos.billing);
    assert.equal(facade.lease, repos.lease);
    assert.equal(facade.lock, repos.lock);
    assert.equal(facade.memory, repos.memory);
    assert.equal(facade.artifact, repos.artifact);
    assert.equal(facade.dispatch, repos.dispatch);
    assert.equal(facade.division, repos.division);
    assert.equal(facade.secret, repos.secret);
    assert.equal(facade.marketplace, repos.marketplace);
    assert.equal(facade.release, repos.release);
    assert.equal(facade.organization, repos.organization);
    assert.equal(facade.intelligence, repos.intelligence);
    assert.equal(facade.evolution, repos.evolution);
    assert.equal(facade.governance, repos.governance);
    assert.equal(facade.operations, repos.operations);
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStoreFacade runtimeRecovery and views accessors return operations repo", () => {
  const workspace = createTempWorkspace("aa-facade-views-");
  const dbPath = join(workspace, "facade-views.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const facade = new AuthoritativeTaskStoreFacade(db);

    assert.equal(facade.runtimeRecovery, facade.operations);
    assert.equal(facade.views, facade.operations);
  } finally {
    cleanupPath(workspace);
  }
});
