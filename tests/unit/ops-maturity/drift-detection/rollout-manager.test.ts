import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  SimpleRolloutManager,
  PersistentRolloutManager,
  type RolloutStage,
  type RolloutStatus,
  type RolloutMetrics,
  applyRolloutSchema,
  type RollbackHandler,
} from "../../../../src/ops-maturity/drift-detection/rollout-manager.js";
import { RolloutRepository } from "../../../../src/ops-maturity/drift-detection/rollout-repository.js";
import type { ImprovementProposal } from "../../../../src/ops-maturity/drift-detection/proposal-engine.js";

function createProposal(id: string): ImprovementProposal {
  return {
    id,
    title: "Test Proposal",
    description: "Test description",
    kind: "tool_routing_rule",
    target: "test",
    patch: "test patch",
    rationale: "test rationale",
    risk: "low",
    reviewRequirement: "auto",
    evidenceIds: [],
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    draftedAt: new Date().toISOString(),
  };
}

function createMetrics(overrides: Partial<RolloutMetrics> = {}): RolloutMetrics {
  return {
    successRate: 0.95,
    errorRate: 0.05,
    latencyMs: 150,
    costUsd: 0.25,
    ...overrides,
  };
}

function createTestDb(): { db: DatabaseSync; path: string } {
  const path = join(tmpdir(), `rollout-test-${Date.now()}.db`);
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  return { db, path };
}

// === SimpleRolloutManager Tests ===

test("SimpleRolloutManager.start creates rollout record", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = createProposal("prop_1");

  const record = await manager.start(proposal, "canary", 5);

  assert.equal(record.proposalId, "prop_1");
  assert.equal(record.stage, "canary");
  assert.equal(record.percentage, 5);
  assert.equal(record.status, "running");
  assert.ok(record.startedAt !== undefined);
});

test("SimpleRolloutManager.start sets default percentage for stage", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = createProposal("prop_1");

  const record = await manager.start(proposal, "canary", manager.getStagePercentage("canary"));

  assert.equal(record.percentage, 5);
});

test("SimpleRolloutManager.updateMetrics updates rollout metrics", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = createProposal("prop_1");
  await manager.start(proposal, "canary", 5);

  await manager.updateMetrics("prop_1", createMetrics({ successRate: 0.98 }));

  const record = await manager.getRollout("prop_1");
  assert.equal(record?.metrics?.successRate, 0.98);
});

test("SimpleRolloutManager.evaluateAndTriggerRollback enters rollback_pending on safety violations", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = createProposal("prop_sec");
  await manager.start(proposal, "canary", 5);
  await manager.updateMetrics("prop_sec", createMetrics({ securityViolations: 1 }));

  const triggered = await manager.evaluateAndTriggerRollback("prop_sec");
  const record = await manager.getRollout("prop_sec");

  assert.equal(triggered, true);
  assert.equal(record?.status, "rollback_pending");
  assert.match(record?.failureReason ?? "", /securityViolations/);
});

test("SimpleRolloutManager.updateMetrics does nothing for unknown proposal", async () => {
  const manager = new SimpleRolloutManager();

  await manager.updateMetrics("unknown", createMetrics());

  // Should not throw
});

test("SimpleRolloutManager.complete marks rollout as succeeded", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = createProposal("prop_1");
  await manager.start(proposal, "stable", 100);

  await manager.complete("prop_1");

  const record = await manager.getRollout("prop_1");
  assert.equal(record?.status, "succeeded");
  assert.ok(record?.completedAt !== undefined);
});

test("SimpleRolloutManager.complete does nothing for unknown proposal", async () => {
  const manager = new SimpleRolloutManager();

  await manager.complete("unknown");

  // Should not throw
});

test("SimpleRolloutManager.fail marks rollout as failed", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = createProposal("prop_1");
  await manager.start(proposal, "canary", 5);

  await manager.fail("prop_1", "Health check failed");

  const record = await manager.getRollout("prop_1");
  assert.equal(record?.status, "failed");
  assert.equal(record?.failureReason, "Health check failed");
  assert.ok(record?.completedAt !== undefined);
});

test("SimpleRolloutManager.rollback marks rollout as rolled_back", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = createProposal("prop_1");
  await manager.start(proposal, "canary", 5);

  await manager.rollback("prop_1", "Manual rollback requested");

  const record = await manager.getRollout("prop_1");
  assert.equal(record?.status, "rolled_back");
  assert.equal(record?.failureReason, "Manual rollback requested");
  assert.ok(record?.completedAt !== undefined);
});

test("SimpleRolloutManager.getRollout returns null for unknown proposal", async () => {
  const manager = new SimpleRolloutManager();

  const record = await manager.getRollout("unknown");

  assert.equal(record, null);
});

test("SimpleRolloutManager.getActiveRollouts returns only running rollouts", async () => {
  const manager = new SimpleRolloutManager();
  const proposal1 = createProposal("prop_1");
  const proposal2 = createProposal("prop_2");
  const proposal3 = createProposal("prop_3");

  await manager.start(proposal1, "canary", 5);
  await manager.start(proposal2, "stable", 100);
  await manager.complete("prop_2");
  await manager.start(proposal3, "shadow", 0);

  const activeRollouts = await manager.getActiveRollouts();

  assert.equal(activeRollouts.length, 2);
  assert.ok(activeRollouts.every(r => r.status === "running"));
});

test("SimpleRolloutManager.getActiveRollouts returns empty array when no rollouts", async () => {
  const manager = new SimpleRolloutManager();

  const activeRollouts = await manager.getActiveRollouts();

  assert.equal(activeRollouts.length, 0);
});

test("SimpleRolloutManager.getDefaultStageSequence returns correct order", () => {
  const manager = new SimpleRolloutManager();
  const sequence = manager.getDefaultStageSequence();

  assert.deepEqual(sequence, ["shadow", "canary", "partial", "stable"]);
});

test("SimpleRolloutManager.getStagePercentage returns correct percentages", () => {
  const manager = new SimpleRolloutManager();

  assert.equal(manager.getStagePercentage("shadow"), 0);
  assert.equal(manager.getStagePercentage("canary"), 5);
  assert.equal(manager.getStagePercentage("partial"), 25);
  assert.equal(manager.getStagePercentage("stable"), 100);
});

test("SimpleRolloutManager handles multiple rollouts", async () => {
  const manager = new SimpleRolloutManager();

  await manager.start(createProposal("prop_1"), "shadow", 0);
  await manager.start(createProposal("prop_2"), "canary", 5);
  await manager.start(createProposal("prop_3"), "partial", 25);

  const activeRollouts = await manager.getActiveRollouts();

  assert.equal(activeRollouts.length, 3);
});

test("RolloutStage type accepts all valid values", () => {
  const stages: RolloutStage[] = ["shadow", "canary", "partial", "stable"];

  for (const stage of stages) {
    assert.ok(["shadow", "canary", "partial", "stable"].includes(stage));
  }
});

test("RolloutStatus type accepts all valid values", () => {
  const statuses: RolloutStatus[] = ["running", "succeeded", "failed", "rolled_back"];

  for (const status of statuses) {
    assert.ok(["running", "succeeded", "failed", "rolled_back"].includes(status));
  }
});

// === RolloutRepository Tests ===

test("RolloutRepository.insert and getByProposalId round-trip", () => {
  const { db, path } = createTestDb();
  applyRolloutSchema(db);

  const repo = new RolloutRepository({ connection: db, filePath: path } as never);
  const record = {
    proposalId: "prop_1",
    stage: "canary" as const,
    percentage: 5,
    startedAt: new Date().toISOString(),
    status: "running" as const,
  };

  repo.insert(record);
  const retrieved = repo.getByProposalId("prop_1");

  assert.equal(retrieved?.proposalId, "prop_1");
  assert.equal(retrieved?.stage, "canary");
  assert.equal(retrieved?.percentage, 5);
  assert.equal(retrieved?.status, "running");

  db.close();
});

test("RolloutRepository.update modifies existing record", () => {
  const { db, path } = createTestDb();
  applyRolloutSchema(db);

  const repo = new RolloutRepository({ connection: db, filePath: path } as never);
  const record = {
    proposalId: "prop_1",
    stage: "canary" as const,
    percentage: 5,
    startedAt: new Date().toISOString(),
    status: "running" as const,
  };

  repo.insert(record);

  const updated = { ...record, status: "succeeded" as const, completedAt: new Date().toISOString() };
  repo.update(updated);

  const retrieved = repo.getByProposalId("prop_1");
  assert.equal(retrieved?.status, "succeeded");
  assert.ok(retrieved?.completedAt !== undefined);

  db.close();
});

test("RolloutRepository.listActive returns only active rollouts", () => {
  const { db, path } = createTestDb();
  applyRolloutSchema(db);

  const repo = new RolloutRepository({ connection: db, filePath: path } as never);

  repo.insert({ proposalId: "prop_1", stage: "canary", percentage: 5, startedAt: new Date().toISOString(), status: "running" });
  repo.insert({ proposalId: "prop_2", stage: "stable", percentage: 100, startedAt: new Date().toISOString(), status: "succeeded" });
  repo.insert({ proposalId: "prop_3", stage: "partial", percentage: 25, startedAt: new Date().toISOString(), status: "rollback_pending" });

  const active = repo.listActive();

  assert.equal(active.length, 2);
  assert.ok(active.every(r => r.status === "running" || r.status === "rollback_pending"));

  db.close();
});

test("RolloutRepository.delete removes record", () => {
  const { db, path } = createTestDb();
  applyRolloutSchema(db);

  const repo = new RolloutRepository({ connection: db, filePath: path } as never);
  repo.insert({ proposalId: "prop_1", stage: "canary", percentage: 5, startedAt: new Date().toISOString(), status: "running" });

  repo.delete("prop_1");

  const retrieved = repo.getByProposalId("prop_1");
  assert.equal(retrieved, null);

  db.close();
});

// === PersistentRolloutManager Tests ===

test("PersistentRolloutManager persists rollout state", async () => {
  const { db, path } = createTestDb();
  applyRolloutSchema(db);
  const repo = new RolloutRepository({ connection: db, filePath: path } as never);

  const manager = new PersistentRolloutManager(repo);
  const proposal = createProposal("prop_persist_1");
  await manager.start(proposal, "canary", 5);

  // Verify in-memory
  const inMemory = await manager.getRollout("prop_persist_1");
  assert.equal(inMemory?.proposalId, "prop_persist_1");

  // Verify persisted
  const fromDb = repo.getByProposalId("prop_persist_1");
  assert.equal(fromDb?.proposalId, "prop_persist_1");
  assert.equal(fromDb?.stage, "canary");

  db.close();
});

test("PersistentRolloutManager survives restart via repository reload", async () => {
  const { db, path } = createTestDb();
  applyRolloutSchema(db);
  const repo = new RolloutRepository({ connection: db, filePath: path } as never);

  // Create and start a rollout
  {
    const manager = new PersistentRolloutManager(repo);
    const proposal = createProposal("prop_restart");
    await manager.start(proposal, "canary", 5);
    await manager.updateMetrics("prop_restart", createMetrics());
  }

  // Simulate restart - new manager instance loads from repo
  {
    const manager2 = new PersistentRolloutManager(repo);
    const record = await manager2.getRollout("prop_restart");

    assert.equal(record?.proposalId, "prop_restart");
    assert.equal(record?.status, "running");
    assert.ok(record?.metrics !== undefined);
  }

  db.close();
});

test("PersistentRolloutManager.updateMetrics persists change", async () => {
  const { db, path } = createTestDb();
  applyRolloutSchema(db);
  const repo = new RolloutRepository({ connection: db, filePath: path } as never);

  const manager = new PersistentRolloutManager(repo);
  const proposal = createProposal("prop_metrics");
  await manager.start(proposal, "canary", 5);

  await manager.updateMetrics("prop_metrics", createMetrics({ successRate: 0.98 }));

  // Verify persisted
  const fromDb = repo.getByProposalId("prop_metrics");
  assert.equal(fromDb?.metrics?.successRate, 0.98);

  db.close();
});

test("PersistentRolloutManager.rollback performs actual rollback action", async () => {
  const { db, path } = createTestDb();
  applyRolloutSchema(db);
  const repo = new RolloutRepository({ connection: db, filePath: path } as never);

  const rollbackCalls: Array<{ proposalId: string; reason: string }> = [];
  const manager = new PersistentRolloutManager(repo);
  manager.setRollbackHandlerFactory(() => async (proposalId: string, reason: string) => {
    rollbackCalls.push({ proposalId, reason });
  });

  const proposal = createProposal("prop_rollback");
  await manager.start(proposal, "canary", 5);

  await manager.rollback("prop_rollback", "Test rollback reason");

  // Verify handler was called with correct arguments
  assert.equal(rollbackCalls.length, 1);
  assert.equal(rollbackCalls[0].proposalId, "prop_rollback");
  assert.equal(rollbackCalls[0].reason, "Test rollback reason");

  // Verify state was updated
  const record = await manager.getRollout("prop_rollback");
  assert.equal(record?.status, "rolled_back");
  assert.equal(record?.failureReason, "Test rollback reason");

  db.close();
});

test("PersistentRolloutManager.rollback persists state after action", async () => {
  const { db, path } = createTestDb();
  applyRolloutSchema(db);
  const repo = new RolloutRepository({ connection: db, filePath: path } as never);

  const manager = new PersistentRolloutManager(repo);
  manager.setRollbackHandlerFactory(() => async () => { /* no-op handler */ });

  const proposal = createProposal("prop_rollback_persist");
  await manager.start(proposal, "canary", 5);

  await manager.rollback("prop_rollback_persist", "Testing persistence");

  // Verify persisted to database
  const fromDb = repo.getByProposalId("prop_rollback_persist");
  assert.equal(fromDb?.status, "rolled_back");
  assert.equal(fromDb?.failureReason, "Testing persistence");

  db.close();
});

test("PersistentRolloutManager.complete persists", async () => {
  const { db, path } = createTestDb();
  applyRolloutSchema(db);
  const repo = new RolloutRepository({ connection: db, filePath: path } as never);

  const manager = new PersistentRolloutManager(repo);
  const proposal = createProposal("prop_complete");
  await manager.start(proposal, "stable", 100);

  await manager.complete("prop_complete");

  const fromDb = repo.getByProposalId("prop_complete");
  assert.equal(fromDb?.status, "succeeded");
  assert.ok(fromDb?.completedAt !== undefined);

  db.close();
});

test("PersistentRolloutManager.fail persists", async () => {
  const { db, path } = createTestDb();
  applyRolloutSchema(db);
  const repo = new RolloutRepository({ connection: db, filePath: path } as never);

  const manager = new PersistentRolloutManager(repo);
  const proposal = createProposal("prop_fail");
  await manager.start(proposal, "canary", 5);

  await manager.fail("prop_fail", "Health check failed");

  const fromDb = repo.getByProposalId("prop_fail");
  assert.equal(fromDb?.status, "failed");
  assert.equal(fromDb?.failureReason, "Health check failed");

  db.close();
});

test("PersistentRolloutManager.getActiveRollouts uses in-memory cache", async () => {
  const { db, path } = createTestDb();
  applyRolloutSchema(db);
  const repo = new RolloutRepository({ connection: db, filePath: path } as never);

  const manager = new PersistentRolloutManager(repo);
  await manager.start(createProposal("prop_active1"), "canary", 5);
  await manager.start(createProposal("prop_active2"), "partial", 25);
  await manager.start(createProposal("prop_done"), "stable", 100);
  await manager.complete("prop_done");

  const active = await manager.getActiveRollouts();

  assert.equal(active.length, 2);
  assert.ok(active.every(r => r.status === "running"));

  db.close();
});

test("PersistentRolloutManager survives concurrent updateMetrics", async () => {
  const { db, path } = createTestDb();
  applyRolloutSchema(db);
  const repo = new RolloutRepository({ connection: db, filePath: path } as never);

  const manager = new PersistentRolloutManager(repo);
  const proposal = createProposal("prop_concurrent");
  await manager.start(proposal, "canary", 5);

  // Simulate concurrent metric updates
  await Promise.all([
    manager.updateMetrics("prop_concurrent", createMetrics({ successRate: 0.98 })),
    manager.updateMetrics("prop_concurrent", createMetrics({ errorRate: 0.03 })),
    manager.updateMetrics("prop_concurrent", createMetrics({ latencyMs: 120 })),
  ]);

  const record = await manager.getRollout("prop_concurrent");
  // Last write wins (in-memory is Map-based)
  assert.ok(record?.metrics !== undefined);

  db.close();
});

// Type for manager variable used in tests
declare const manager: PersistentRolloutManager;

// === Rollback Handler Factory Tests ===

test("PersistentRolloutManager uses default handler when no factory set", async () => {
  const { db, path } = createTestDb();
  applyRolloutSchema(db);
  const repo = new RolloutRepository({ connection: db, filePath: path } as never);

  // Create manager without setting factory - should use no-op default
  const manager2 = new PersistentRolloutManager(repo);
  const proposal = createProposal("prop_default_handler");
  await manager2.start(proposal, "canary", 5);

  // Should not throw - default handler is no-op
  await manager2.rollback("prop_default_handler", "Default handler test");

  const record = await manager2.getRollout("prop_default_handler");
  assert.equal(record?.status, "rolled_back");

  db.close();
});

test("applyRolloutSchema creates correct table structure", () => {
  const { db } = createTestDb();

  applyRolloutSchema(db);

  // Verify table exists and has correct schema
  const tableInfo = db.prepare("PRAGMA table_info(rollout_records);").all() as Array<{ name: string }>;
  const columnNames = tableInfo.map(c => c.name);

  assert.ok(columnNames.includes("proposal_id"));
  assert.ok(columnNames.includes("stage"));
  assert.ok(columnNames.includes("percentage"));
  assert.ok(columnNames.includes("started_at"));
  assert.ok(columnNames.includes("completed_at"));
  assert.ok(columnNames.includes("status"));
  assert.ok(columnNames.includes("metrics_json"));
  assert.ok(columnNames.includes("failure_reason"));

  db.close();
});

test("applyRolloutSchema creates indexes", () => {
  const { db } = createTestDb();

  applyRolloutSchema(db);

  // Verify indexes exist
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_rollout_%';").all() as Array<{ name: string }>;

  assert.ok(indexes.some(i => i.name === "idx_rollout_records_status"));
  assert.ok(indexes.some(i => i.name === "idx_rollout_records_started_at"));

  db.close();
});