import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

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

test("AuthoritativeTaskStore constructor accepts SqliteDatabase", () => {
  const workspace = createTempWorkspace("aa-store-core-");
  const dbPath = join(workspace, "store-core.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    assert.ok(store.db != null);
    assert.equal(store.db.filePath, dbPath);
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStore repositories() returns all expected repositories", () => {
  const workspace = createTempWorkspace("aa-store-core-repos-");
  const dbPath = join(workspace, "store-core-repos.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repos = store.repositories();

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

test("AuthoritativeTaskStore repositories() returns cached instance", () => {
  const workspace = createTempWorkspace("aa-store-core-cache-");
  const dbPath = join(workspace, "store-core-cache.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repos1 = store.repositories();
    const repos2 = store.repositories();

    assert.equal(repos1, repos2);
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStore governance and operations are same instance", () => {
  const workspace = createTempWorkspace("aa-store-core-ops-");
  const dbPath = join(workspace, "store-core-ops.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repos = store.repositories();

    assert.equal(repos.governance, repos.operations);
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStore repository accessors return correct repositories", () => {
  const workspace = createTempWorkspace("aa-store-core-accessors-");
  const dbPath = join(workspace, "store-core-accessors.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    assert.ok(store.task instanceof TaskRepository);
    assert.ok(store.workflow instanceof WorkflowRepository);
    assert.ok(store.execution instanceof ExecutionRepository);
    assert.ok(store.session instanceof SessionRepository);
    assert.ok(store.event instanceof EventRepository);
    assert.ok(store.worker instanceof WorkerRepository);
    assert.ok(store.approval instanceof ApprovalRepository);
    assert.ok(store.billing instanceof BillingRepository);
    assert.ok(store.lease instanceof LeaseRepository);
    assert.ok(store.lock instanceof LockRepository);
    assert.ok(store.memory instanceof MemoryRepository);
    assert.ok(store.artifact instanceof ArtifactRepository);
    assert.ok(store.dispatch instanceof DispatchRepository);
    assert.ok(store.division instanceof DivisionRepository);
    assert.ok(store.secret instanceof SecretRepository);
    assert.ok(store.marketplace instanceof MarketplaceRepository);
    assert.ok(store.release instanceof ReleaseRepository);
    assert.ok(store.organization instanceof OrganizationRepository);
    assert.ok(store.intelligence instanceof IntelligenceRepository);
    assert.ok(store.evolution instanceof EvolutionRepository);
    assert.ok(store.governance instanceof OperationsRepository);
    assert.ok(store.operations instanceof OperationsRepository);
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStore accessors are consistent with repositories()", () => {
  const workspace = createTempWorkspace("aa-store-core-consistent-");
  const dbPath = join(workspace, "store-core-consistent.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repos = store.repositories();

    assert.equal(store.task, repos.task);
    assert.equal(store.workflow, repos.workflow);
    assert.equal(store.execution, repos.execution);
    assert.equal(store.session, repos.session);
    assert.equal(store.event, repos.event);
    assert.equal(store.worker, repos.worker);
    assert.equal(store.approval, repos.approval);
    assert.equal(store.billing, repos.billing);
    assert.equal(store.lease, repos.lease);
    assert.equal(store.lock, repos.lock);
    assert.equal(store.memory, repos.memory);
    assert.equal(store.artifact, repos.artifact);
    assert.equal(store.dispatch, repos.dispatch);
    assert.equal(store.division, repos.division);
    assert.equal(store.secret, repos.secret);
    assert.equal(store.marketplace, repos.marketplace);
    assert.equal(store.release, repos.release);
    assert.equal(store.organization, repos.organization);
    assert.equal(store.intelligence, repos.intelligence);
    assert.equal(store.evolution, repos.evolution);
    assert.equal(store.governance, repos.governance);
    assert.equal(store.operations, repos.operations);
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStore withConnection passes connection correctly", () => {
  const workspace = createTempWorkspace("aa-store-core-conn-");
  const dbPath = join(workspace, "store-core-conn.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const result = store.withConnection((conn) => {
      return conn;
    });

    assert.ok(result != null);
  } finally {
    cleanupPath(workspace);
  }
});

test("AuthoritativeTaskStore runtimeRecovery and views accessors return operations repo", () => {
  const workspace = createTempWorkspace("aa-store-core-views-");
  const dbPath = join(workspace, "store-core-views.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    assert.equal(store.runtimeRecovery, store.operations);
    assert.equal(store.views, store.operations);
  } finally {
    cleanupPath(workspace);
  }
});
